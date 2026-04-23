// zone-renderer.test.ts — tests for ZoneOverlayRenderer leak-free cleanup (INF-A-001)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const destroyCalls: Array<{ kind: string; opts: unknown }> = [];

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
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
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
});
