// tile-renderer.test.ts — tests for TileLayerRenderer missing-tile warning (IB-003, IB-017)

import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) { this.children.push(child); }
    removeChildren() { this.children = []; }
  }
  class MockGraphics {
    rect() { return this; }
    fill() { return this; }
  }
  return { Container: MockContainer, Graphics: MockGraphics };
});

import { TileLayerRenderer } from '../tile-renderer.js';
import type { TileLayer, Tileset } from '@world-forge/schema';

function makeTileset(tiles: { id: string; tags: string[] }[]): Tileset {
  return {
    id: 'ts-1',
    name: 'Test Tileset',
    tileWidth: 32,
    tileHeight: 32,
    tiles: tiles.map((t) => ({
      id: t.id,
      tilesetId: 'ts-1',
      row: 0,
      col: 0,
      tags: t.tags,
      walkable: true,
      opacity: 1,
    })),
  };
}

describe('TileLayerRenderer', () => {
  it('renders tiles that exist in the tileset', () => {
    const renderer = new TileLayerRenderer(32);
    const tilesets = [makeTileset([{ id: 'floor-1', tags: [] }])];
    const layers: TileLayer[] = [{
      id: 'layer-1', name: 'Ground', zIndex: 0,
      tiles: [{ tileId: 'floor-1', gridX: 0, gridY: 0 }],
    }];
    renderer.update(layers, tilesets);
    // layerContainer is the only child of root container
    expect(renderer.container.children.length).toBe(1);
  });

  it('warns and skips when tileId is missing from all tilesets (IB-003)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new TileLayerRenderer(32);
    const tilesets = [makeTileset([{ id: 'floor-1', tags: [] }])];
    const layers: TileLayer[] = [{
      id: 'layer-1', name: 'Ground', zIndex: 0,
      tiles: [{ tileId: 'nonexistent-tile', gridX: 0, gridY: 0 }],
    }];
    renderer.update(layers, tilesets);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/nonexistent-tile/);
    warnSpy.mockRestore();
  });

  it('renders valid tiles and warns only for missing ones (IB-017)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new TileLayerRenderer(32);
    const tilesets = [makeTileset([{ id: 'wall-1', tags: ['wall'] }])];
    const layers: TileLayer[] = [{
      id: 'layer-1', name: 'Walls', zIndex: 1,
      tiles: [
        { tileId: 'wall-1', gridX: 0, gridY: 0 },
        { tileId: 'ghost-tile', gridX: 1, gridY: 0 },
        { tileId: 'wall-1', gridX: 2, gridY: 0 },
      ],
    }];
    renderer.update(layers, tilesets);

    // Only one warning for the ghost tile
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/ghost-tile/);
    warnSpy.mockRestore();
  });

  it('handles empty layers without errors', () => {
    const renderer = new TileLayerRenderer(32);
    expect(() => renderer.update([], [])).not.toThrow();
    expect(renderer.container.children.length).toBe(0);
  });
});
