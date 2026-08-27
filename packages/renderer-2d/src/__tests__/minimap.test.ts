// minimap.test.ts — tests for MinimapRenderer division-by-zero guard (IB-001)

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
    label = '';
    rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    fills: Array<{ color?: number; alpha?: number }> = [];
    strokes: Array<{ width?: number; color?: number; alpha?: number }> = [];
    rect(x: number, y: number, w: number, h: number) {
      this.rects.push({ x, y, w, h });
      return this;
    }
    fill(arg?: { color?: number; alpha?: number }) { this.fills.push(arg ?? {}); return this; }
    stroke(arg?: { width?: number; color?: number; alpha?: number }) { this.strokes.push(arg ?? {}); return this; }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Graphics', opts }); }
  }
  return { Container: MockContainer, Graphics: MockGraphics };
});

import { MinimapRenderer } from '../minimap.js';
import type { Zone, District } from '@world-forge/schema';

describe('MinimapRenderer', () => {
  const zones: Zone[] = [
    {
      id: 'z1', name: 'Test Zone', gridX: 0, gridY: 0, gridWidth: 5, gridHeight: 5,
      biome: 'forest', mood: 'calm', lightingPreset: 'daylight',
    } as unknown as Zone,
  ];
  const districts: District[] = [];

  it('renders normally with valid grid dimensions', () => {
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 10, gridHeight: 10 });
    expect(() => renderer.update(zones, districts)).not.toThrow();
    // background + 1 zone = 2 children
    expect(renderer.container.children.length).toBe(2);
  });

  it('skips rendering and warns when gridWidth is 0 (IB-001)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 0, gridHeight: 10 });
    renderer.update(zones, districts);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/gridWidth.*0/);
    // No children should be added
    expect(renderer.container.children.length).toBe(0);
    warnSpy.mockRestore();
  });

  it('skips rendering and warns when gridHeight is 0 (IB-001)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 10, gridHeight: 0 });
    renderer.update(zones, districts);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/gridHeight.*0/);
    expect(renderer.container.children.length).toBe(0);
    warnSpy.mockRestore();
  });

  it('skips rendering when both dimensions are 0', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 0, gridHeight: 0 });
    renderer.update(zones, districts);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(renderer.container.children.length).toBe(0);
    warnSpy.mockRestore();
  });

  it('destroys previous Graphics on re-update to prevent leaks (INF-A-004)', () => {
    destroyCalls.length = 0;
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 10, gridHeight: 10 });
    renderer.update(zones, districts);
    // First update: container was empty, nothing to destroy.
    expect(destroyCalls.length).toBe(0);
    // background + 1 zone = 2 children
    expect(renderer.container.children.length).toBe(2);

    renderer.update(zones, districts);
    // Second update: 2 previous Graphics objects should have been destroyed.
    const graphicsDestroyed = destroyCalls.filter((c) => c.kind === 'Graphics').length;
    expect(graphicsDestroyed).toBe(2);
    for (const call of destroyCalls) {
      expect(call.opts).toEqual({ children: true });
    }
    // Bounded child count after re-update.
    expect(renderer.container.children.length).toBe(2);
  });

  it('keeps container child count bounded across many updates (INF-A-004)', () => {
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 10, gridHeight: 10 });
    for (let i = 0; i < 10; i++) {
      renderer.update(zones, districts);
    }
    expect(renderer.container.children.length).toBe(2);
  });

  it('destroy() clears the container and prevents subsequent render leaks (INF-A-011)', () => {
    destroyCalls.length = 0;
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 10, gridHeight: 10 });
    renderer.update(zones, districts);
    expect(renderer.container.children.length).toBe(2);

    renderer.destroy();
    const containerDestroyed = destroyCalls.filter((c) => c.kind === 'Container');
    expect(containerDestroyed.length).toBe(1);
    expect(containerDestroyed[0].opts).toEqual({ children: true });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = renderer.container.children.length;
    renderer.update(zones, districts);
    expect(renderer.container.children.length).toBe(before);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/destroyed/);
    warnSpy.mockRestore();

    renderer.destroy();
    expect(destroyCalls.filter((c) => c.kind === 'Container').length).toBe(1);
  });

  it('F-6e1482bc: letterboxes a 30×25 grid so zone w/h stay similar to the map', () => {
    type G = {
      label: string;
      rects: Array<{ x: number; y: number; w: number; h: number }>;
      strokes: Array<{ width?: number; alpha?: number }>;
    };
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 30, gridHeight: 25 });
    renderer.update(zones, districts);
    const children = renderer.container.children as G[];
    // children[0] is the square background; zone rect is the first non-bg.
    const zoneG = children[1];
    const zoneRect = zoneG.rects.find((r) => r.w !== 100 || r.h !== 100) ?? zoneG.rects[0];
    expect(zoneRect.w / zoneRect.h).toBeCloseTo(zones[0].gridWidth / zones[0].gridHeight, 5);
    expect(zoneG.strokes.some((s) => (s.width ?? 0) >= 1 && (s.alpha ?? 0) >= 0.8)).toBe(true);
  });

  it('F-6e1482bc: viewportRect child is present when a camera rect is passed', () => {
    const renderer = new MinimapRenderer({ size: 100, gridWidth: 30, gridHeight: 25 });
    renderer.update(zones, districts, { x: 2, y: 2, w: 8, h: 6 });
    const vp = (renderer.container.children as Array<{ label?: string }>).find(
      (c) => c.label === 'viewportRect',
    );
    expect(vp, 'expected a Graphics child labelled viewportRect').toBeTruthy();
  });
});
