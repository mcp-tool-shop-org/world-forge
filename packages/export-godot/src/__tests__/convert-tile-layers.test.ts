/**
 * convert-tile-layers.test.ts — Wave B-2 Godot TileMapLayer conversion.
 *
 * Locks the image-backed-vs-color split: image-backed tilesets bake atlas
 * cells; color-only tilesets record {gridX, gridY, color, opacity} on cells
 * (editor/renderer-2d tag table) so the scene can paint ColorRects. Also
 * covers the tile_map_data byte encoding the .tscn embeds.
 */

import { describe, it, expect } from 'vitest';
import { convertTileLayers, encodeTileMapData, fallbackTileColor, cssHexToGodotColor } from '../convert-tile-layers.js';
import { buildWorldScene } from '../scene-builder.js';
import type { WorldProject, Tileset, TileLayer } from '@world-forge/schema';
import type { GodotZoneResource } from '../convert-zones.js';

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
  it('records wall+floor color cells so a loader can reconstruct the grid (F-cb227692)', () => {
    const { tileLayers } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'c-wall', gridX: 1, gridY: 0 },
    ])]));
    expect(tileLayers).toHaveLength(1);
    const l = tileLayers[0];
    expect(l.imageBacked).toBe(false);
    expect(l.atlasSources).toHaveLength(0);
    expect(l.tileCount).toBe(2);
    expect(l.tileSize).toBe(32);
    expect(l.nodeName).toBe('Ground');
    expect(l.cells).toHaveLength(2);
    expect(l.cells).toContainEqual({
      gridX: 0, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0,
      color: '#333333', opacity: 1,
    });
    expect(l.cells).toContainEqual({
      gridX: 1, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0,
      color: '#555555', opacity: 1,
    });
  });

  it('keeps the editor/renderer-2d tag→color table and opacity', () => {
    const tagged: Tileset = {
      id: 'color', name: 'Color', tileWidth: 32, tileHeight: 32,
      tiles: [
        { id: 'c-water', tilesetId: 'color', row: 0, col: 0, tags: ['water'], walkable: true, opacity: 0.5 },
        { id: 'c-door', tilesetId: 'color', row: 0, col: 1, tags: ['door'], walkable: true, opacity: 1 },
      ],
    };
    const { tileLayers } = convertTileLayers(proj([tagged], [layer([
      { tileId: 'c-water', gridX: 0, gridY: 0 },
      { tileId: 'c-door', gridX: 1, gridY: 0 },
    ])]));
    expect(tileLayers[0].cells).toContainEqual({
      gridX: 0, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0,
      color: '#2244aa', opacity: 0.5,
    });
    expect(tileLayers[0].cells).toContainEqual({
      gridX: 1, gridY: 0, sourceId: 0, atlasX: 0, atlasY: 0,
      color: '#886622', opacity: 1,
    });
  });

  it('reports an approximated fidelity entry for color layers', () => {
    const { fidelity } = convertTileLayers(proj([colorTs], [layer([{ tileId: 'c-floor', gridX: 0, gridY: 0 }])]));
    const entry = fidelity.find((f) => f.domain === 'tiles' && f.level === 'approximated');
    expect(entry).toBeDefined();
    expect(entry!.message).toMatch(/ColorRect/i);
  });

  it('pack cells and scene ColorRects agree for a wall+floor color layer (F-cb227692)', () => {
    const { tileLayers } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'c-wall', gridX: 1, gridY: 0 },
    ])]));
    const zone: GodotZoneResource = {
      resourcePath: 'res://world_data/zones/z.tres',
      id: 'z', displayName: 'Z', description: '', tags: [],
      position: { x: 0, y: 0 }, size: { x: 64, y: 64 },
      gridWidth: 2, gridHeight: 2, light: 1, noise: 0,
      hazards: [], neighbors: [], exits: [], interactables: [],
      nodeName: 'Z',
    };
    const tscn = buildWorldScene({
      projectName: 'ColorWorld',
      zones: [zone],
      entities: { byZone: {}, all: [], dropped: [], incomplete: false },
      items: [], navigationLinks: [], spawnMarkers: [], transitions: [],
      tileLayers,
    });
    expect(tileLayers[0].cells).toHaveLength(2);
    expect(tscn).toContain('type="ColorRect"');
    expect(tscn).toContain('color = Color(0.2, 0.2, 0.2, 1)');
    expect(tscn).toContain('color = Color(0.333333, 0.333333, 0.333333, 1)');
    expect(tscn).not.toContain('tile_map_data');
  });
});

describe('fallbackTileColor / cssHexToGodotColor', () => {
  it('matches editor wall/water/door/floor hexes', () => {
    expect(fallbackTileColor(['wall'])).toBe('#555555');
    expect(fallbackTileColor(['water'])).toBe('#2244aa');
    expect(fallbackTileColor(['door'])).toBe('#886622');
    expect(fallbackTileColor([])).toBe('#333333');
    expect(fallbackTileColor(['water', 'wall'])).toBe('#555555');
  });

  it('formats hex + opacity as a Godot Color() literal', () => {
    expect(cssHexToGodotColor('#333333', 1)).toBe('Color(0.2, 0.2, 0.2, 1)');
    expect(cssHexToGodotColor('#555555', 1)).toBe('Color(0.333333, 0.333333, 0.333333, 1)');
    expect(cssHexToGodotColor('#2244aa', 0.5)).toMatch(/^Color\(/);
    expect(cssHexToGodotColor('#2244aa', 0.5)).toContain('0.5');
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
    expect(l.atlasSources[0]).toMatchObject({ tilesetId: 'img', texturePath: 'res://assets/tilesets/town.png', tileWidth: 16, tileHeight: 16, sourceId: 0 });
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

describe('convertTileLayers — tile size / tileset size mismatch (F-004/F-551b1a9b)', () => {
  it('warns with the concrete mismatch numbers when a tileset\'s own pixel size differs from the project tile size', () => {
    // imgTs is 16x16; the project grid here is 32px — a very ordinary
    // mixed-resolution pixel-art setup (a 16px tileset used inside a
    // 32px-grid world). TileSet.tile_size (from project tileSize) and this
    // atlas source's texture_region_size (from imgTs.tileWidth/tileHeight)
    // will disagree in the emitted scene; nothing warned about that before.
    const { fidelity } = convertTileLayers(proj([imgTs], [layer([{ tileId: 'i-a', gridX: 0, gridY: 0 }])], 32));
    const mismatch = fidelity.find((f) => f.domain === 'tiles' && f.fieldPath === 'tileLayers.L.tileSize');
    expect(mismatch).toBeDefined();
    expect(mismatch!.level).toBe('approximated');
    expect(mismatch!.severity).toBe('warning');
    expect(mismatch!.message).toContain('16x16');
    expect(mismatch!.message).toContain('32px');
  });

  it('emits exactly one mismatch warning per (layer, tileset) pair, not once per tile', () => {
    const { fidelity } = convertTileLayers(proj([imgTs], [layer([
      { tileId: 'i-a', gridX: 0, gridY: 0 },
      { tileId: 'i-b', gridX: 1, gridY: 0 },
    ])], 32));
    const mismatches = fidelity.filter((f) => f.fieldPath === 'tileLayers.L.tileSize');
    expect(mismatches).toHaveLength(1);
  });

  it('does not warn when the tileset\'s pixel size matches the project tile size', () => {
    const { fidelity } = convertTileLayers(proj([colorTs], [layer([{ tileId: 'c-floor', gridX: 0, gridY: 0 }])], 32));
    expect(fidelity.some((f) => f.fieldPath === 'tileLayers.L.tileSize')).toBe(false);
  });

  it('does not warn for an image tileset whose size matches an explicitly-set project tile size', () => {
    const { fidelity } = convertTileLayers(proj([imgTs], [layer([{ tileId: 'i-a', gridX: 0, gridY: 0 }])], 16));
    expect(fidelity.some((f) => f.fieldPath === 'tileLayers.L.tileSize')).toBe(false);
  });
});

describe('convertTileLayers — dropped tiles', () => {
  it('drops placements whose tileId is in no tileset and reports it', () => {
    const { tileLayers, fidelity } = convertTileLayers(proj([colorTs], [layer([
      { tileId: 'c-floor', gridX: 0, gridY: 0 },
      { tileId: 'ghost', gridX: 1, gridY: 0 },
    ])]));
    expect(tileLayers[0].tileCount).toBe(1); // only the resolved one
    const dropped = fidelity.find((f) => f.domain === 'tiles' && f.level === 'dropped');
    expect(dropped).toBeDefined();
    expect(dropped!.message).toContain('ghost');
    expect(dropped!.message).toContain('L');
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
