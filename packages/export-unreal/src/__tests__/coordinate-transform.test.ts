import { describe, it, expect } from 'vitest';
import {
  pixelsToUnrealCm,
  elevationToZ,
  worldForgeToUnrealAxis,
  gridToUnrealAxis,
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
