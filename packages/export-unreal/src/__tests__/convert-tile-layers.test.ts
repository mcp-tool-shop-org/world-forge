/**
 * convert-tile-layers.test.ts — F-9615478f tile cells + walkable collision + HISM.
 */

import { describe, it, expect } from 'vitest';
import { convertTileLayers, fallbackTileColor, HISM_TILE_THRESHOLD } from '../convert-tile-layers.js';
import type { WorldProject, Tileset, TileLayer, Zone } from '@world-forge/schema';

function proj(
  tilesets: Tileset[],
  tileLayers: TileLayer[],
  zones: Zone[] = [],
): WorldProject {
  return { map: { tileSize: 32 }, tilesets, tileLayers, zones } as unknown as WorldProject;
}

const colorTs: Tileset = {
  id: 'color', name: 'Color', tileWidth: 32, tileHeight: 32,
  tiles: [
    { id: 'c-floor', tilesetId: 'color', row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
    { id: 'c-wall', tilesetId: 'color', row: 1, col: 2, tags: ['wall'], walkable: false, opacity: 1 },
  ],
};
const imgTs: Tileset = {
  id: 'img', name: 'Img', tileWidth: 16, tileHeight: 16, imagePath: 'tiles/town.png',
  tiles: [
    { id: 'i-a', tilesetId: 'img', row: 0, col: 0, tags: [], walkable: true, opacity: 1 },
    { id: 'i-b', tilesetId: 'img', row: 2, col: 3, tags: [], walkable: true, opacity: 1 },
  ],
};
const layer = (tiles: TileLayer['tiles'], over: Partial<TileLayer> = {}): TileLayer =>
  ({ id: 'L', name: 'Ground', zIndex: 0, tiles, ...over });

describe('fallbackTileColor', () => {
  it('matches editor wall/water/door/floor hexes', () => {
    expect(fallbackTileColor(['wall'])).toBe('#555555');
    expect(fallbackTileColor(['water'])).toBe('#2244aa');
    expect(fallbackTileColor(['door'])).toBe('#886622');
    expect(fallbackTileColor([])).toBe('#333333');
  });
});

describe('convertTileLayers — cells', () => {
  it('emits GridX/Y, TileId, AtlasCol/Row, Walkable for image-backed tiles', () => {
    const { manifest } = convertTileLayers(proj([imgTs], [layer([
      { tileId: 'i-a', gridX: 0, gridY: 0 },
      { tileId: 'i-b', gridX: 1, gridY: 0 },
    ])]));
    expect(manifest.Layers).toHaveLength(1);
    expect(manifest.Layers[0].ImageBacked).toBe(true);
    expect(manifest.Layers[0].Cells).toContainEqual(expect.objectContaining({
      GridX: 0, GridY: 0, TileId: 'i-a', AtlasCol: 0, AtlasRow: 0, Walkable: true,
    }));
    expect(manifest.Layers[0].Cells).toContainEqual(expect.objectContaining({
      GridX: 1, GridY: 0, TileId: 'i-b', AtlasCol: 3, AtlasRow: 2, Walkable: true,
    }));
  });

  it('records color+opacity for color-only tiles so a loader can reconstruct the grid', () => {
    const { manifest } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'c-wall', gridX: 1, gridY: 0 },
    ])]));
    expect(manifest.Layers[0].ImageBacked).toBe(false);
    expect(manifest.Layers[0].Cells).toContainEqual(expect.objectContaining({
      GridX: 0, TileId: 'c-floor', Color: '#333333', Opacity: 1, Walkable: true,
    }));
    expect(manifest.Layers[0].Cells).toContainEqual(expect.objectContaining({
      GridX: 1, TileId: 'c-wall', Color: '#555555', Walkable: false,
    }));
  });

  it('emits CollisionBoxes from !walkable tiles', () => {
    const { manifest } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'c-wall', gridX: 1, gridY: 0 },
    ])], [{ id: 'z1', gridX: 0, gridY: 0, gridWidth: 10, gridHeight: 10 } as Zone]), 100);
    expect(manifest.CollisionBoxes).toHaveLength(1);
    expect(manifest.CollisionBoxes[0]).toMatchObject({
      Source: 'tile', TileId: 'c-wall', ZoneId: 'z1',
      ExtentCm: { WidthCm: 100, DepthCm: 100, HeightCm: 100 },
    });
    expect(manifest.CollisionBoxes[0].OriginCm.X).toBe(100);
    expect(manifest.CollisionBoxes[0].OriginCm.Z).toBe(0);
    expect(manifest.Layers[0].CollisionBoxes).toHaveLength(1);
  });

  it('drops unknown tile ids with a fidelity warning', () => {
    const { manifest, fidelity } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'ghost', gridX: 1, gridY: 0 },
    ])]));
    expect(manifest.Layers[0].TileCount).toBe(1);
    expect(fidelity.some((f) => f.level === 'dropped' && f.message.includes('ghost'))).toBe(true);
  });
});

describe('convertTileLayers — HISM (UE-FT-006)', () => {
  it(`emits HISM clusters when a zone has ${HISM_TILE_THRESHOLD}+ tiles`, () => {
    const tiles = Array.from({ length: HISM_TILE_THRESHOLD }, (_, i) => ({
      tileId: 'i-a', gridX: i % 10, gridY: Math.floor(i / 10),
    }));
    const zone = { id: 'z-big', gridX: 0, gridY: 0, gridWidth: 20, gridHeight: 20 } as Zone;
    const { manifest, fidelity } = convertTileLayers(proj([imgTs], [layer(tiles)], [zone]));
    expect(manifest.HismClusters.length).toBeGreaterThan(0);
    expect(manifest.HismClusters[0].ZoneId).toBe('z-big');
    expect(manifest.HismClusters[0].TileId).toBe('i-a');
    expect(manifest.HismClusters[0].InstanceTransforms).toHaveLength(HISM_TILE_THRESHOLD);
    expect(fidelity.some((f) => f.fieldPath === 'tiles.hism.z-big')).toBe(true);
  });

  it('does not emit HISM clusters below the threshold', () => {
    const { manifest } = convertTileLayers(proj([imgTs], [layer([
      { tileId: 'i-a', gridX: 0, gridY: 0 },
    ])], [{ id: 'z1', gridX: 0, gridY: 0, gridWidth: 10, gridHeight: 10 } as Zone]));
    expect(manifest.HismClusters).toEqual([]);
  });
});
