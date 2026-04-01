// minimap.test.ts — tests for MinimapRenderer division-by-zero guard (IB-001)

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) { this.children.push(child); }
    removeChildren() { this.children = []; }
  }
  class MockGraphics {
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
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
});
