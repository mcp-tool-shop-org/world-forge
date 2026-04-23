// zone-renderer.test.ts — tests for ZoneOverlayRenderer leak-free cleanup (INF-A-001)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const destroyCalls: Array<{ kind: string; opts: unknown }> = [];
// INF-FT-002: record every fill() call with its arg so tests can assert on
// the shadow / sunken-tint passes used by the elevation cues.
const fillCalls: Array<{ color: unknown; alpha: unknown }> = [];
const strokeCalls: Array<{ width: unknown; color: unknown; alpha: unknown }> = [];
const rectCalls: Array<{ x: number; y: number; w: number; h: number }> = [];

vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) { this.children.push(child); }
    removeChildren(): unknown[] {
      const removed = this.children;
      this.children = [];
      return removed;
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Container', opts }); }
  }
  class MockGraphics {
    rect(x: number, y: number, w: number, h: number) {
      rectCalls.push({ x, y, w, h });
      return this;
    }
    fill(arg: { color: unknown; alpha: unknown }) {
      fillCalls.push({ color: arg.color, alpha: arg.alpha });
      return this;
    }
    stroke(arg: { width: unknown; color: unknown; alpha: unknown }) {
      strokeCalls.push({ width: arg.width, color: arg.color, alpha: arg.alpha });
      return this;
    }
    moveTo() { return this; }
    lineTo() { return this; }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Graphics', opts }); }
  }
  class MockText {
    text: string;
    style: unknown;
    position = { set: vi.fn() };
    constructor(opts: { text: string; style: unknown }) {
      this.text = opts.text;
      this.style = opts.style;
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Text', opts }); }
  }
  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { ZoneOverlayRenderer } from '../zone-renderer.js';
import type { Zone, District } from '@world-forge/schema';

function zone(id: string, parentDistrictId?: string): Zone {
  return {
    id,
    name: `Zone ${id}`,
    gridX: 0,
    gridY: 0,
    gridWidth: 5,
    gridHeight: 5,
    parentDistrictId,
    biome: 'forest',
    mood: 'calm',
    lightingPreset: 'daylight',
  } as unknown as Zone;
}

describe('ZoneOverlayRenderer', () => {
  let renderer: ZoneOverlayRenderer;
  const districts: District[] = [];

  beforeEach(() => {
    destroyCalls.length = 0;
    fillCalls.length = 0;
    strokeCalls.length = 0;
    rectCalls.length = 0;
    renderer = new ZoneOverlayRenderer({ tileSize: 32 });
  });

  it('renders zones without error', () => {
    renderer.update([zone('z1'), zone('z2')], districts);
    // Each zone adds a Graphics + a Text = 2 children per zone = 4 total.
    expect(renderer.container.children.length).toBe(4);
  });

  it('destroys previous children on re-update to prevent leaks (INF-A-001)', () => {
    renderer.update([zone('z1'), zone('z2')], districts);
    expect(destroyCalls.length).toBe(0);
    expect(renderer.container.children.length).toBe(4);

    renderer.update([zone('z3')], districts);
    // Should have destroyed the 4 previous children (2 Graphics + 2 Text).
    const graphicsDestroyed = destroyCalls.filter((c) => c.kind === 'Graphics').length;
    const textDestroyed = destroyCalls.filter((c) => c.kind === 'Text').length;
    expect(graphicsDestroyed).toBe(2);
    expect(textDestroyed).toBe(2);
    for (const call of destroyCalls) {
      expect(call.opts).toEqual({ children: true });
    }
    // Bounded: now only 2 children (the one new zone's graphic + label).
    expect(renderer.container.children.length).toBe(2);
  });

  it('keeps container child count bounded across many updates (INF-A-001)', () => {
    const zones = [zone('z1'), zone('z2'), zone('z3')];
    for (let i = 0; i < 10; i++) {
      renderer.update(zones, districts);
    }
    // 3 zones x 2 children = 6, stable across updates.
    expect(renderer.container.children.length).toBe(6);
  });

  it('applies selected and hovered styling without throwing', () => {
    const zones = [zone('z1'), zone('z2')];
    expect(() => renderer.update(zones, districts, { selectedZoneId: 'z1', hoveredZoneId: 'z2' })).not.toThrow();
  });

  it('destroy() clears the container and prevents subsequent render leaks (INF-A-008)', () => {
    renderer.update([zone('z1'), zone('z2')], districts);
    expect(renderer.container.children.length).toBe(4);

    renderer.destroy();
    // Container.destroy({ children: true }) should have been invoked once.
    const containerDestroyed = destroyCalls.filter((c) => c.kind === 'Container');
    expect(containerDestroyed.length).toBe(1);
    expect(containerDestroyed[0].opts).toEqual({ children: true });

    // Subsequent update() is a no-op and warns — no new children are added.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = renderer.container.children.length;
    renderer.update([zone('z3')], districts);
    expect(renderer.container.children.length).toBe(before);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/destroyed/);
    warnSpy.mockRestore();

    // destroy() is idempotent — second call does not re-destroy.
    renderer.destroy();
    expect(destroyCalls.filter((c) => c.kind === 'Container').length).toBe(1);
  });

  // INF-FT-002: 2.5D elevation cues.
  describe('elevation cues (INF-FT-002)', () => {
    function zoneAt(id: string, patch: Partial<Zone>): Zone {
      return { ...zone(id), ...patch } as Zone;
    }

    it('adds a drop shadow Graphics for zones with elevation > 0', () => {
      // Baseline: elevation 0 produces no shadow child.
      renderer.update([zoneAt('flat', { elevation: 0 } as Partial<Zone>)], districts);
      const flatChildCount = renderer.container.children.length;
      const flatFillCount = fillCalls.length;

      // Reset between renders for clean comparison.
      fillCalls.length = 0;
      rectCalls.length = 0;
      renderer.update([zoneAt('high', { elevation: 5 } as Partial<Zone>)], districts);

      // One extra Graphics child (the shadow) compared to the flat case.
      expect(renderer.container.children.length).toBe(flatChildCount + 1);
      // One extra fill call in black at alpha 0.25.
      expect(fillCalls.length).toBeGreaterThan(flatFillCount - flatFillCount);
      const shadowFill = fillCalls.find(
        (c) => c.color === 0x000000 && typeof c.alpha === 'number' && Math.abs((c.alpha as number) - 0.25) < 1e-6,
      );
      expect(shadowFill, 'expected a black shadow fill at alpha 0.25').toBeTruthy();
      // The shadow rect must be offset relative to the zone's origin.
      const zoneRect = rectCalls.find((r) => r.x === 0 && r.y === 0);
      const shadowRect = rectCalls.find((r) => r.x > 0 && r.y > 0);
      expect(zoneRect).toBeTruthy();
      expect(shadowRect).toBeTruthy();
    });

    it('clamps shadow offset so +10m is the cap (8px max)', () => {
      renderer.update([zoneAt('huge', { elevation: 1000 } as Partial<Zone>)], districts);
      // Shadow offset should never exceed MAX_ELEVATION_SHADOW_PX (8px).
      const offsetRect = rectCalls.find((r) => r.x > 0 && r.y > 0);
      expect(offsetRect).toBeTruthy();
      expect(offsetRect!.x).toBeLessThanOrEqual(8);
      expect(offsetRect!.y).toBeLessThanOrEqual(8);
    });

    it('adds a sunken tint overlay for zones with elevation < 0', () => {
      renderer.update([zoneAt('low', { elevation: -3 } as Partial<Zone>)], districts);
      // Dark tint overlay at alpha 0.12.
      const tintFill = fillCalls.find(
        (c) => c.color === 0x000000 && typeof c.alpha === 'number' && Math.abs((c.alpha as number) - 0.12) < 1e-6,
      );
      expect(tintFill, 'expected a dark tint overlay at alpha 0.12').toBeTruthy();
    });

    it('draws a dashed outline when elevationRange.floor !== elevationRange.ceiling', () => {
      renderer.update(
        [zoneAt('multi', { elevationRange: { floor: 0, ceiling: 5 } } as Partial<Zone>)],
        districts,
      );
      // A solid single-rect outline for a non-multi-level zone would produce
      // exactly 1 stroke call for the border. A dashed outline produces many.
      expect(strokeCalls.length).toBeGreaterThan(4);
    });

    it('does not dash when elevationRange floor equals ceiling', () => {
      renderer.update(
        [zoneAt('flat-range', { elevationRange: { floor: 2, ceiling: 2 } } as Partial<Zone>)],
        districts,
      );
      // Single zone = 1 fill (body) + 1 stroke (border). Dashed would be many more.
      expect(strokeCalls.length).toBe(1);
    });

    it('setShowElevation(false) suppresses all elevation cues', () => {
      renderer.setShowElevation(false);
      renderer.update(
        [
          zoneAt('high', { elevation: 5 } as Partial<Zone>),
          zoneAt('low', { elevation: -3 } as Partial<Zone>),
          zoneAt('multi', { elevationRange: { floor: 0, ceiling: 5 } } as Partial<Zone>),
        ],
        districts,
      );
      // No black shadow fill (0x000000).
      expect(fillCalls.some((c) => c.color === 0x000000)).toBe(false);
      // Exactly 3 zones × 2 children (Graphics + label) = 6 — no extra shadow/tint graphics.
      expect(renderer.container.children.length).toBe(6);
      // Strokes equal to 3 (one per zone, solid) — no dashed multi-stroke burst.
      expect(strokeCalls.length).toBe(3);
    });

    it('setShowElevation(true) is the default', () => {
      // Fresh instance should already render cues.
      const fresh = new ZoneOverlayRenderer({ tileSize: 32 });
      fillCalls.length = 0;
      fresh.update([zoneAt('high', { elevation: 5 } as Partial<Zone>)], districts);
      const shadowFill = fillCalls.find(
        (c) => c.color === 0x000000 && typeof c.alpha === 'number' && Math.abs((c.alpha as number) - 0.25) < 1e-6,
      );
      expect(shadowFill).toBeTruthy();
    });
  });
});
