import { describe, it, expect } from 'vitest';
import {
  pixelsToUnrealCm,
  elevationToZ,
  worldForgeToUnrealAxis,
  gridToUnrealAxis,
  zToElevationMeters,
  unrealAxisToGrid,
  DEFAULT_TILE_SIZE_CM,
} from '../coordinate-transform.js';

describe('pixelsToUnrealCm', () => {
  it('converts pixels to cm at default world scale (100 cm per tile)', () => {
    // 1 tile = 32 px → 1 px = 100/32 = 3.125 cm
    expect(pixelsToUnrealCm(32, 32)).toBe(100);
    expect(pixelsToUnrealCm(1, 32)).toBeCloseTo(3.125, 6);
    expect(pixelsToUnrealCm(100, 32)).toBeCloseTo(312.5, 6);
  });

  it('respects custom tileSizeCm', () => {
    // 1 tile = 32 px mapped to 200 cm → 1 px = 6.25 cm
    expect(pixelsToUnrealCm(1, 32, 200)).toBeCloseTo(6.25, 6);
  });

  it('is linear and passes through zero', () => {
    expect(pixelsToUnrealCm(0, 32)).toBe(0);
    expect(pixelsToUnrealCm(-16, 32)).toBeCloseTo(-50, 6);
  });

  it('throws on non-positive tile size', () => {
    expect(() => pixelsToUnrealCm(10, 0)).toThrow(RangeError);
    expect(() => pixelsToUnrealCm(10, -1)).toThrow(RangeError);
  });

  it('throws on non-finite or non-positive tileSizeCm (UE-B-002)', () => {
    expect(() => pixelsToUnrealCm(10, 32, 0)).toThrow(RangeError);
    expect(() => pixelsToUnrealCm(10, 32, -1)).toThrow(RangeError);
    expect(() => pixelsToUnrealCm(10, 32, Number.NaN)).toThrow(RangeError);
    expect(() => pixelsToUnrealCm(10, 32, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('elevationToZ', () => {
  it('converts metres → centimetres', () => {
    expect(elevationToZ(0)).toBe(0);
    expect(elevationToZ(1)).toBe(100);
    expect(elevationToZ(2.5)).toBe(250);
    expect(elevationToZ(-1.5)).toBe(-150);
  });
});

describe('worldForgeToUnrealAxis', () => {
  it('flips Y and lifts Z (anchor point assertion)', () => {
    // (100 px, 50 px, elevation=2 m) at tileSize=32 → (312.5 cm, -156.25 cm, 200 cm)
    const result = worldForgeToUnrealAxis({ x: 100, y: 50, elevation: 2 }, 32);
    expect(result.X).toBeCloseTo(312.5, 6);
    expect(result.Y).toBeCloseTo(-156.25, 6);
    expect(result.Z).toBe(200);
  });

  it('defaults elevation to 0', () => {
    const result = worldForgeToUnrealAxis({ x: 32, y: 32 }, 32);
    expect(result).toEqual({ X: 100, Y: -100, Z: 0 });
  });

  it('uses DEFAULT_TILE_SIZE_CM constant when caller omits it', () => {
    const result = worldForgeToUnrealAxis({ x: 32, y: 32 }, 32);
    expect(result.X).toBe(DEFAULT_TILE_SIZE_CM);
  });
});

describe('gridToUnrealAxis', () => {
  it('maps grid tiles directly to UE cm and flips Y', () => {
    expect(gridToUnrealAxis(3, 4)).toEqual({ X: 300, Y: -400, Z: 0 });
    expect(gridToUnrealAxis(0, 0, 200, 1.5)).toEqual({ X: 0, Y: -0, Z: 150 });
  });

  it('respects elevation in metres', () => {
    const result = gridToUnrealAxis(1, 1, 100, 3);
    expect(result.Z).toBe(300);
  });

  it('throws on non-finite or non-positive tileSizeCm (UE-B-002)', () => {
    expect(() => gridToUnrealAxis(1, 1, 0)).toThrow(RangeError);
    expect(() => gridToUnrealAxis(1, 1, -5)).toThrow(RangeError);
    expect(() => gridToUnrealAxis(1, 1, Number.NaN)).toThrow(RangeError);
    expect(() => gridToUnrealAxis(1, 1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('coordinate-transform float precision at very large values (UE-A-010)', () => {
  it('pixelsToUnrealCm stays finite and within tolerance at 1e6 pixels, tileSize=32', () => {
    const px = 1_000_000;
    const result = pixelsToUnrealCm(px, 32);
    // Expected: 1_000_000 * 100 / 32 = 3_125_000 cm
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeCloseTo(3_125_000, 3);
    // Relative error must be tiny (< 1e-9).
    expect(Math.abs(result - 3_125_000) / 3_125_000).toBeLessThan(1e-9);
  });

  it('elevationToZ stays finite and exact at 1e6 metres', () => {
    const z = elevationToZ(1_000_000);
    // 1e6 m × 100 = 1e8 cm.
    expect(Number.isFinite(z)).toBe(true);
    expect(z).toBe(100_000_000);
  });

  it('worldForgeToUnrealAxis handles 1e6-pixel canvas + 1e6-metre elevation without drift', () => {
    const result = worldForgeToUnrealAxis(
      { x: 1_000_000, y: 1_000_000, elevation: 1_000_000 },
      32,
    );
    expect(Number.isFinite(result.X)).toBe(true);
    expect(Number.isFinite(result.Y)).toBe(true);
    expect(Number.isFinite(result.Z)).toBe(true);
    expect(result.X).toBeCloseTo(3_125_000, 3);
    expect(result.Y).toBeCloseTo(-3_125_000, 3);
    expect(result.Z).toBe(100_000_000);
  });

  it('gridToUnrealAxis stays finite at 1e6 grid tiles with 1e6-metre elevation', () => {
    const result = gridToUnrealAxis(1_000_000, 1_000_000, 100, 1_000_000);
    expect(Number.isFinite(result.X)).toBe(true);
    expect(Number.isFinite(result.Y)).toBe(true);
    expect(Number.isFinite(result.Z)).toBe(true);
    expect(result.X).toBe(100_000_000);
    expect(result.Y).toBe(-100_000_000);
    expect(result.Z).toBe(100_000_000);
  });
});

// ── F-0a3cfe3e: explicit, tested invariants for the axis/unit conversion ──
//
// There is no engine smoke test for this exporter — nothing in this repo has
// ever loaded a pack into a real UE5 project, so a sign or axis-assignment
// error here would silently mirror or misplace every zone/actor/parallax
// layer in-engine and nothing would catch it. That gap cannot be closed
// without real UE5 access. What CAN be done from inside this repo: pin down
// the transform's invariants — round-trip identity, sign conventions, and
// scale — as permanent, executable tests, so any future change to the axis
// mapping has to consciously break an assertion that says what the mapping
// promises, rather than silently drifting the way the ALL_WORLD_PROJECT_FIELDS
// array did (see parity.test.ts / F-e2908aac).

describe('zToElevationMeters (inverse of elevationToZ)', () => {
  it('round-trips elevation → Z → elevation exactly', () => {
    for (const m of [0, 1, -1.5, 2.5, 1000, -3.25, 1_000_000]) {
      expect(zToElevationMeters(elevationToZ(m))).toBeCloseTo(m, 6);
    }
  });

  it('is the algebraic inverse (divide by 100) with no hidden rounding', () => {
    expect(zToElevationMeters(0)).toBe(0);
    expect(zToElevationMeters(100)).toBe(1);
    expect(zToElevationMeters(-150)).toBe(-1.5);
  });
});

describe('unrealAxisToGrid (inverse of gridToUnrealAxis)', () => {
  it('recovers integer grid coordinates from gridToUnrealAxis output (round-trip identity)', () => {
    const cases: Array<[number, number]> = [
      [0, 0], [3, 4], [-5, 12], [100, -100], [1, 0], [0, 1], [-1, -1],
    ];
    for (const [gridX, gridY] of cases) {
      const forward = gridToUnrealAxis(gridX, gridY, 100);
      const back = unrealAxisToGrid(forward.X, forward.Y, 100);
      expect(back.gridX).toBe(gridX);
      expect(back.gridY).toBe(gridY);
    }
  });

  it('round-trips at a non-default tileSizeCm (48 px source tile scale)', () => {
    const forward = gridToUnrealAxis(7, -9, 48);
    const back = unrealAxisToGrid(forward.X, forward.Y, 48);
    expect(back).toEqual({ gridX: 7, gridY: -9 });
  });

  it('round-trips at large grid coordinates without precision loss', () => {
    const forward = gridToUnrealAxis(1_000_000, -1_000_000, 100);
    const back = unrealAxisToGrid(forward.X, forward.Y, 100);
    expect(back).toEqual({ gridX: 1_000_000, gridY: -1_000_000 });
  });

  it('throws on non-finite or non-positive tileSizeCm (mirrors gridToUnrealAxis guards)', () => {
    expect(() => unrealAxisToGrid(1, 1, 0)).toThrow(RangeError);
    expect(() => unrealAxisToGrid(1, 1, -5)).toThrow(RangeError);
    expect(() => unrealAxisToGrid(1, 1, Number.NaN)).toThrow(RangeError);
    expect(() => unrealAxisToGrid(1, 1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe('coordinate-transform sign conventions (explicit invariants)', () => {
  it('increasing WorldForge grid y (down-screen) strictly DEcreases Unreal Y', () => {
    // This is the highest-risk line in the whole exporter per F-0a3cfe3e: get
    // this sign backwards and every zone/actor mirrors across the Y axis in UE5.
    const a = gridToUnrealAxis(0, 0, 100);
    const b = gridToUnrealAxis(0, 1, 100);
    expect(b.Y).toBeLessThan(a.Y);
  });

  it('increasing WorldForge grid x strictly increases Unreal X (no flip on this axis)', () => {
    const a = gridToUnrealAxis(0, 0, 100);
    const b = gridToUnrealAxis(1, 0, 100);
    expect(b.X).toBeGreaterThan(a.X);
  });

  it('increasing authored elevation strictly increases Unreal Z (up stays up)', () => {
    const a = gridToUnrealAxis(0, 0, 100, 0);
    const b = gridToUnrealAxis(0, 0, 100, 1);
    expect(b.Z).toBeGreaterThan(a.Z);
  });

  it('X and Y are independent axes — moving one never perturbs the other', () => {
    const base = gridToUnrealAxis(5, 5, 100);
    const xOnly = gridToUnrealAxis(9, 5, 100);
    const yOnly = gridToUnrealAxis(5, 9, 100);
    expect(xOnly.Y).toBe(base.Y);
    expect(yOnly.X).toBe(base.X);
  });

  it('the Y flip is an exact negation, not an offset or a different scale', () => {
    // worldForgeToUnrealAxis documents "Y: -y" as the axis flip. Pin the
    // *shape* of that relationship (exact sign inversion of the same
    // magnitude), not just "some value less than before".
    for (const y of [0, 1, 32, 1000, -7]) {
      const result = worldForgeToUnrealAxis({ x: 0, y }, 32, 100);
      const expectedMagnitude = pixelsToUnrealCm(y, 32, 100);
      expect(result.Y).toBeCloseTo(-expectedMagnitude, 9);
    }
  });
});

describe('coordinate-transform scale invariants (explicit)', () => {
  it('doubling tileSizeCm doubles the cm output for the same grid input', () => {
    const at100 = gridToUnrealAxis(3, 4, 100);
    const at200 = gridToUnrealAxis(3, 4, 200);
    expect(at200.X).toBeCloseTo(at100.X * 2, 9);
    expect(at200.Y).toBeCloseTo(at100.Y * 2, 9);
  });

  it('pixelsToUnrealCm scales linearly with tileSizeCm', () => {
    expect(pixelsToUnrealCm(32, 32, 200)).toBeCloseTo(pixelsToUnrealCm(32, 32, 100) * 2, 9);
  });

  it('elevationToZ scales linearly at exactly 100 cm per metre, always', () => {
    expect(elevationToZ(2)).toBe(elevationToZ(1) * 2);
    expect(elevationToZ(1) - elevationToZ(0)).toBe(100);
  });

  it('scale is independent of position — cm-per-tile ratio holds at any grid offset', () => {
    const near = gridToUnrealAxis(1, 1, 100);
    const far = gridToUnrealAxis(1001, 1001, 100);
    // 1000 extra tiles at 100 cm/tile = 100,000 extra cm on each axis.
    expect(far.X - near.X).toBeCloseTo(100_000, 6);
    expect(far.Y - near.Y).toBeCloseTo(-100_000, 6);
  });
});
