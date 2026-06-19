import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { Tileset, TileLayer, WorldProject } from '@world-forge/schema';

function makeTileset(id: string, overrides: Partial<Tileset> = {}): Tileset {
  return {
    id,
    name: `Tileset ${id}`,
    tileWidth: 16,
    tileHeight: 16,
    tiles: [
      { id: `${id}-floor`, tilesetId: id, row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
      { id: `${id}-wall`, tilesetId: id, row: 0, col: 1, tags: ['wall'], walkable: false, opacity: 1 },
    ],
    ...overrides,
  };
}

function makeLayer(id: string, overrides: Partial<TileLayer> = {}): TileLayer {
  return { id, name: `Layer ${id}`, zIndex: 0, tiles: [], ...overrides };
}

const store = () => useProjectStore.getState();
const layerById = (id: string) => store().project.tileLayers.find((l) => l.id === id)!;

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('tile store — tilesets', () => {
  it('starts with no tilesets', () => {
    expect(store().project.tilesets).toEqual([]);
  });

  it('adds a tileset', () => {
    store().addTileset(makeTileset('ts1'));
    const { tilesets } = store().project;
    expect(tilesets).toHaveLength(1);
    expect(tilesets[0].id).toBe('ts1');
    expect(tilesets[0].tiles).toHaveLength(2);
  });

  it('adds multiple tilesets preserving order', () => {
    store().addTileset(makeTileset('ts1'));
    store().addTileset(makeTileset('ts2'));
    expect(store().project.tilesets.map((t) => t.id)).toEqual(['ts1', 'ts2']);
  });

  it('updates a tileset', () => {
    store().addTileset(makeTileset('ts1'));
    store().updateTileset('ts1', { name: 'Renamed', imagePath: 'tiles/town.png' });
    const ts = store().project.tilesets[0];
    expect(ts.name).toBe('Renamed');
    expect(ts.imagePath).toBe('tiles/town.png');
  });

  it('update on a missing tileset is a no-op', () => {
    store().addTileset(makeTileset('ts1'));
    store().updateTileset('nope', { name: 'X' });
    expect(store().project.tilesets[0].name).toBe('Tileset ts1');
  });

  it('removes a tileset', () => {
    store().addTileset(makeTileset('ts1'));
    store().addTileset(makeTileset('ts2'));
    store().removeTileset('ts1');
    expect(store().project.tilesets.map((t) => t.id)).toEqual(['ts2']);
  });

  it('removing a tileset leaves placements intact (renderer handles missing tiles)', () => {
    store().addTileset(makeTileset('ts1'));
    store().addTileLayer(makeLayer('layer1'));
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    store().removeTileset('ts1');
    expect(store().project.tilesets).toHaveLength(0);
    // Deliberately non-cascade: removing a tileset must not silently wipe painted work.
    expect(layerById('layer1').tiles).toHaveLength(1);
  });
});

describe('tile store — layers', () => {
  it('adds a layer', () => {
    store().addTileLayer(makeLayer('layer1', { name: 'Ground', zIndex: 2 }));
    const layers = store().project.tileLayers;
    expect(layers).toHaveLength(1);
    expect(layers[0].name).toBe('Ground');
    expect(layers[0].zIndex).toBe(2);
    expect(layers[0].tiles).toEqual([]);
  });

  it('updates a layer (rename + reorder)', () => {
    store().addTileLayer(makeLayer('layer1'));
    store().updateTileLayer('layer1', { name: 'Overhead', zIndex: 5 });
    expect(layerById('layer1').name).toBe('Overhead');
    expect(layerById('layer1').zIndex).toBe(5);
  });

  it('removes a layer', () => {
    store().addTileLayer(makeLayer('layer1'));
    store().addTileLayer(makeLayer('layer2'));
    store().removeTileLayer('layer1');
    expect(store().project.tileLayers.map((l) => l.id)).toEqual(['layer2']);
  });
});

describe('tile store — placements', () => {
  beforeEach(() => {
    store().addTileset(makeTileset('ts1'));
    store().addTileLayer(makeLayer('layer1'));
  });

  it('paints a tile into a layer', () => {
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 2, gridY: 3 });
    expect(layerById('layer1').tiles).toEqual([{ tileId: 'ts1-floor', gridX: 2, gridY: 3 }]);
  });

  it('painting the same cell twice does not duplicate (idempotent drag)', () => {
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 2, gridY: 3 });
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 2, gridY: 3 });
    expect(layerById('layer1').tiles).toHaveLength(1);
  });

  it('painting a different tile at the same cell overwrites', () => {
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 2, gridY: 3 });
    store().addTilePlacement('layer1', { tileId: 'ts1-wall', gridX: 2, gridY: 3 });
    expect(layerById('layer1').tiles).toHaveLength(1);
    expect(layerById('layer1').tiles[0].tileId).toBe('ts1-wall');
  });

  it('paints distinct cells independently', () => {
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 1, gridY: 0 });
    expect(layerById('layer1').tiles).toHaveLength(2);
  });

  it('painting to a missing layer is a no-op', () => {
    store().addTilePlacement('ghost', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    expect(layerById('layer1').tiles).toHaveLength(0);
  });

  it('erases a placed tile', () => {
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 2, gridY: 3 });
    store().removeTilePlacement('layer1', 2, 3);
    expect(layerById('layer1').tiles).toHaveLength(0);
  });

  it('erasing an empty cell is a no-op', () => {
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 2, gridY: 3 });
    store().removeTilePlacement('layer1', 9, 9);
    expect(layerById('layer1').tiles).toHaveLength(1);
  });

  it('erase only affects the target layer', () => {
    store().addTileLayer(makeLayer('layer2'));
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    store().addTilePlacement('layer2', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    store().removeTilePlacement('layer1', 0, 0);
    expect(layerById('layer1').tiles).toHaveLength(0);
    expect(layerById('layer2').tiles).toHaveLength(1);
  });
});

describe('tile store — undo/redo + labels', () => {
  it('uses the documented undo labels', () => {
    store().addTileset(makeTileset('ts1'));
    expect(store().getUndoLabel()).toBe('Add tileset');
    store().addTileLayer(makeLayer('layer1'));
    expect(store().getUndoLabel()).toBe('Add tile layer');
    store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    expect(store().getUndoLabel()).toBe('Paint tile');
    store().removeTilePlacement('layer1', 0, 0);
    expect(store().getUndoLabel()).toBe('Erase tile');
    store().removeTileLayer('layer1');
    expect(store().getUndoLabel()).toBe('Delete tile layer');
  });

  it('undo reverts a paint, redo replays it', () => {
    store().addTileLayer(makeLayer('layer1'));
    store().addTilePlacement('layer1', { tileId: 't', gridX: 0, gridY: 0 });
    expect(layerById('layer1').tiles).toHaveLength(1);
    store().undo();
    expect(layerById('layer1').tiles).toHaveLength(0);
    store().redo();
    expect(layerById('layer1').tiles).toHaveLength(1);
  });

  it('does not mutate the captured undo snapshot', () => {
    store().addTileLayer(makeLayer('layer1'));
    const before = store().project;
    store().addTilePlacement('layer1', { tileId: 't', gridX: 0, gridY: 0 });
    // The snapshot held in the undo stack must still show the empty layer.
    expect(before.tileLayers[0].tiles).toHaveLength(0);
  });
});

describe('tile store — robustness against legacy saves', () => {
  it('tolerates a project missing the tile arrays', () => {
    // Simulate an older save where tilesets/tileLayers predate the schema; the
    // `?? []` guards must keep the helpers from throwing.
    const legacy = { ...createEmptyProject(), tilesets: undefined, tileLayers: undefined } as unknown as WorldProject;
    useProjectStore.setState({ project: legacy, undoStack: [], redoStack: [], dirty: false });
    expect(() => {
      store().addTileset(makeTileset('ts1'));
      store().addTileLayer(makeLayer('layer1'));
      store().addTilePlacement('layer1', { tileId: 'ts1-floor', gridX: 0, gridY: 0 });
    }).not.toThrow();
    expect(store().project.tilesets).toHaveLength(1);
    expect(layerById('layer1').tiles).toHaveLength(1);
  });
});
