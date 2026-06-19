/**
 * convert-tile-layers.test.ts — Wave B-2 Godot TileMapLayer conversion.
 *
 * Locks the image-backed-vs-color split: image-backed tilesets bake atlas
 * cells; color-only tilesets export metadata only. Also covers the
 * tile_map_data byte encoding the .tscn embeds.
 */

import { describe, it, expect } from 'vitest';
import { convertTileLayers, encodeTileMapData } from '../convert-tile-layers.js';
import type { WorldProject, Tileset, TileLayer } from '@world-forge/schema';

function proj(tilesets: Tileset[], tileLayers: TileLayer[], tileSize = 32): WorldProject {
  return { map: { tileSize }, tilesets, tileLayers } as unknown as WorldProject;
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

describe('convertTileLayers — color-only tilesets', () => {
  it('exports a scaffold with no atlas cells but a tile count', () => {
    const { tileLayers } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'c-wall', gridX: 1, gridY: 0 },
    ])]));
    expect(tileLayers).toHaveLength(1);
    const l = tileLayers[0];
    expect(l.imageBacked).toBe(false);
    expect(l.atlasSources).toHaveLength(0);
    expect(l.cells).toHaveLength(0);
    expect(l.tileCount).toBe(2);
    expect(l.tileSize).toBe(32);
    expect(l.nodeName).toBe('Ground');
  });

  it('reports an approximated fidelity entry for color layers', () => {
    const { fidelity } = convertTileLayers(proj([colorTs], [layer([{ tileId: 'c-floor', gridX: 0, gridY: 0 }])]));
    const entry = fidelity.find((f) => f.domain === 'tiles' && f.level === 'approximated');
    expect(entry).toBeDefined();
    expect(entry!.message).toMatch(/scaffold/i);
  });
});

describe('convertTileLayers — image-backed tilesets', () => {
  it('bakes cells with atlas coords from row/col and a texture source', () => {
    const { tileLayers } = convertTileLayers(proj([imgTs], [layer([
      { tileId: 'i-a', gridX: 0, gridY: 0 },
      { tileId: 'i-b', gridX: 1, gridY: 0 },
    ])]));
    const l = tileLayers[0];
    expect(l.imageBacked).toBe(true);
    expect(l.atlasSources).toHaveLength(1);
    expect(l.atlasSources[0]).toMatchObject({ tilesetId: 'img', texturePath: 'res://assets/tilesets/img.png', tileWidth: 16, tileHeight: 16, sourceId: 0 });
    expect(l.cells).toHaveLength(2);
    // i-a → col0/row0; i-b → col3/row2 (atlasX = col, atlasY = row).
    expect(l.cells).toContainEqual({ gridX: 0, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0 });
    expect(l.cells).toContainEqual({ gridX: 1, gridY: 0, sourceId: 0, atlasX: 3, atlasY: 2 });
  });

  it('reports a lossless fidelity entry for image-backed layers', () => {
    const { fidelity } = convertTileLayers(proj([imgTs], [layer([{ tileId: 'i-a', gridX: 0, gridY: 0 }])]));
    expect(fidelity.some((f) => f.domain === 'tiles' && f.level === 'lossless')).toBe(true);
  });

  it('handles two image tilesets with distinct sources', () => {
    const imgTs2: Tileset = {
      id: 'img2', name: 'Img2', tileWidth: 16, tileHeight: 16, imagePath: 'tiles/cave.png',
      tiles: [{ id: 'j-a', tilesetId: 'img2', row: 0, col: 1, tags: [], walkable: true, opacity: 1 }],
    };
    const { tileLayers } = convertTileLayers(proj([imgTs, imgTs2], [layer([
      { tileId: 'i-a', gridX: 0, gridY: 0 },
      { tileId: 'j-a', gridX: 1, gridY: 0 },
    ])]));
    const l = tileLayers[0];
    expect(l.atlasSources).toHaveLength(2);
    expect(l.cells.find((c) => c.gridX === 0)!.sourceId).toBe(0);
    expect(l.cells.find((c) => c.gridX === 1)!.sourceId).toBe(1);
  });
});

describe('convertTileLayers — solid (non-walkable) cells', () => {
  it('collects non-walkable cells regardless of image backing', () => {
    // colorTs: c-floor walkable, c-wall not. imgTs tiles are walkable.
    const { tileLayers } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'c-wall', gridX: 1, gridY: 0 },
      { tileId: 'c-wall', gridX: 2, gridY: 0 },
    ])]));
    expect(tileLayers[0].solidCells).toEqual([
      { gridX: 1, gridY: 0 },
      { gridX: 2, gridY: 0 },
    ]);
  });

  it('has no solid cells when every tile is walkable', () => {
    const { tileLayers } = convertTileLayers(proj([imgTs], [layer([
      { tileId: 'i-a', gridX: 0, gridY: 0 },
      { tileId: 'i-b', gridX: 1, gridY: 0 },
    ])]));
    expect(tileLayers[0].solidCells).toEqual([]);
  });
});

describe('convertTileLayers — dropped tiles', () => {
  it('drops placements whose tileId is in no tileset and reports it', () => {
    const { tileLayers, fidelity } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'ghost', gridX: 1, gridY: 0 },
    ])]));
    expect(tileLayers[0].tileCount).toBe(1); // only the resolved one
    expect(fidelity.some((f) => f.domain === 'tiles' && f.level === 'dropped')).toBe(true);
  });
});

describe('encodeTileMapData', () => {
  it('emits a format header then 12 bytes per cell', () => {
    const bytes = encodeTileMapData([{ gridX: 1, gridY: 2, sourceId: 0, atlasX: 3, atlasY: 0 }]);
    // header uint16 = 0 (TileMapLayer format id), then x,y,source,atlasX,atlasY,alt — each LE uint16.
    expect(bytes).toEqual([0, 0, 1, 0, 2, 0, 0, 0, 3, 0, 0, 0, 0, 0]);
    expect(bytes).toHaveLength(2 + 12);
  });

  it('encodes negative grid coords as int16 two’s complement', () => {
    const bytes = encodeTileMapData([{ gridX: -1, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0 }]);
    // -1 → 0xFFFF → [255, 255]
    expect(bytes.slice(2, 4)).toEqual([255, 255]);
  });

  it('grows by 12 bytes per additional cell', () => {
    const two = encodeTileMapData([
      { gridX: 0, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0 },
      { gridX: 1, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0 },
    ]);
    expect(two).toHaveLength(2 + 24);
  });
});
