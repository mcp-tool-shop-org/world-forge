// parallax-renderer.test.ts — INF-FT-005 ParallaxRenderer

import { describe, it, expect, vi, beforeEach } from 'vitest';

const destroyCalls: Array<{ kind: string; opts: unknown }> = [];

vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    layerId?: string;
    scrollFactor?: number;
    x = 0;
    y = 0;
    position = {
      set: (x: number, y: number) => {
        (this as unknown as MockContainer).x = x;
        (this as unknown as MockContainer).y = y;
      },
    };
    addChild(child: unknown) { this.children.push(child); return child; }
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
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Graphics', opts }); }
  }
  class MockSprite {
    width = 0;
    height = 0;
    src?: string;
    static from(src: string) {
      const s = new MockSprite();
      s.src = src;
      return s;
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Sprite', opts }); }
  }
  return { Container: MockContainer, Graphics: MockGraphics, Sprite: MockSprite };
});

import { ParallaxRenderer } from '../parallax-renderer.js';
import type { AssetEntry, Zone } from '@world-forge/schema';

function zoneWithLayers(id: string, layers: Zone['parallaxLayers'], gridX = 0, gridY = 0): Zone {
  return {
    id,
    name: id,
    gridX,
    gridY,
    gridWidth: 4,
    gridHeight: 3,
    parallaxLayers: layers,
  } as unknown as Zone;
}

describe('ParallaxRenderer', () => {
  let renderer: ParallaxRenderer;

  beforeEach(() => {
    destroyCalls.length = 0;
    renderer = new ParallaxRenderer({ tileSize: 32 });
  });

  it('getDiagnostics reports className and tracks destroy', () => {
    const d = renderer.getDiagnostics();
    expect(d.className).toBe('ParallaxRenderer');
    expect(d.destroyed).toBe(false);
    expect(d.childCount).toBe(0);
    renderer.destroy();
    expect(renderer.getDiagnostics().destroyed).toBe(true);
  });

  it('draws two layers far-first (higher depth first in children)', () => {
    const zones = [zoneWithLayers('z1', [
      { id: 'near', depth: 10, assetRef: 'missing', scrollFactor: 0.8 },
      { id: 'far', depth: 100, assetRef: 'missing', scrollFactor: 0.2 },
    ])];
    renderer.update(zones, []);
    expect(renderer.container.children).toHaveLength(2);
    const ids = renderer.container.children.map((c) => (c as { layerId?: string }).layerId);
    expect(ids).toEqual(['far', 'near']);
  });

  it('far layer moves less than near layer under the same pan (F-bf006015)', () => {
    const zones = [zoneWithLayers('z1', [
      { id: 'near', depth: 10, assetRef: 'missing', scrollFactor: 0.8 },
      { id: 'far', depth: 100, assetRef: 'missing', scrollFactor: 0.2 },
    ])];
    renderer.update(zones, []);
    renderer.applyPan(100, 50);
    const byId = new Map(
      renderer.container.children.map((c) => {
        const n = c as { layerId: string; x: number; y: number };
        return [n.layerId, n];
      }),
    );
    const far = byId.get('far')!;
    const near = byId.get('near')!;
    // zone origin is (0,0); pan 100/50 × scrollFactor
    expect(far.x).toBe(20);
    expect(far.y).toBe(10);
    expect(near.x).toBe(80);
    expect(near.y).toBe(40);
    expect(Math.abs(far.x)).toBeLessThan(Math.abs(near.x));
  });

  it('uses a Sprite when the asset has a path, else a tinted rect', () => {
    const assets: AssetEntry[] = [
      { id: 'bg-sky', kind: 'background', label: 'Sky', path: 'bg/sky.png', tags: [] },
    ];
    const zones = [zoneWithLayers('z1', [
      { id: 'sky', depth: 80, assetRef: 'bg-sky', scrollFactor: 0.1 },
      { id: 'fog', depth: 20, assetRef: 'no-such', scrollFactor: 0.4 },
    ])];
    renderer.update(zones, assets);
    const sky = renderer.container.children.find((c) => (c as { layerId?: string }).layerId === 'sky') as { children: Array<{ src?: string }> };
    const fog = renderer.container.children.find((c) => (c as { layerId?: string }).layerId === 'fog') as { children: Array<{ src?: string }> };
    expect(sky.children[0].src).toBe('bg/sky.png');
    expect(fog.children[0].src).toBeUndefined();
  });

  it('setShowParallax(false) draws nothing after update', () => {
    const zones = [zoneWithLayers('z1', [
      { id: 'far', depth: 100, assetRef: 'missing', scrollFactor: 0.2 },
    ])];
    renderer.setShowParallax(false);
    renderer.update(zones, []);
    expect(renderer.container.children).toHaveLength(0);
  });

  it('destroys previous children on re-update', () => {
    const zones = [zoneWithLayers('z1', [
      { id: 'far', depth: 100, assetRef: 'missing', scrollFactor: 0.2 },
    ])];
    renderer.update(zones, []);
    expect(destroyCalls.length).toBe(0);
    renderer.update(zones, []);
    expect(destroyCalls.length).toBeGreaterThan(0);
  });
});
