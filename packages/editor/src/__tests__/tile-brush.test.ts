import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import type { TileLayer } from '@world-forge/schema';

const store = () => useProjectStore.getState();
const layer = (id: string): TileLayer => ({ id, name: id, zIndex: 0, tiles: [] });
const layerById = (id: string) => store().project.tileLayers.find((l) => l.id === id)!;

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('applyTileEdits — brush stroke commit', () => {
  beforeEach(() => { store().addTileLayer(layer('L')); });

  it('paints a batch of cells in one call', () => {
    store().applyTileEdits('L', [
      { gridX: 0, gridY: 0, tileId: 't1' },
      { gridX: 1, gridY: 0, tileId: 't1' },
      { gridX: 2, gridY: 0, tileId: 't2' },
    ]);
    expect(layerById('L').tiles).toHaveLength(3);
    expect(layerById('L').tiles.map((t) => t.tileId).sort()).toEqual(['t1', 't1', 't2']);
  });

  it('commits the whole stroke as ONE undo step', () => {
    const before = store().getUndoCount();
    store().applyTileEdits('L', [
      { gridX: 0, gridY: 0, tileId: 't1' },
      { gridX: 1, gridY: 0, tileId: 't1' },
      { gridX: 2, gridY: 0, tileId: 't1' },
    ]);
    expect(store().getUndoCount()).toBe(before + 1);
    expect(store().getUndoLabel()).toBe('Paint tiles');
    store().undo();
    expect(layerById('L').tiles).toHaveLength(0); // entire stroke reverted at once
  });

  it('erases a batch (tileId null) and labels it "Erase tiles"', () => {
    store().applyTileEdits('L', [{ gridX: 0, gridY: 0, tileId: 't1' }, { gridX: 1, gridY: 0, tileId: 't1' }]);
    store().applyTileEdits('L', [{ gridX: 0, gridY: 0, tileId: null }, { gridX: 1, gridY: 0, tileId: null }]);
    expect(layerById('L').tiles).toHaveLength(0);
    expect(store().getUndoLabel()).toBe('Erase tiles');
  });

  it('overwrites existing cells on re-paint', () => {
    store().applyTileEdits('L', [{ gridX: 5, gridY: 5, tileId: 't1' }]);
    store().applyTileEdits('L', [{ gridX: 5, gridY: 5, tileId: 't2' }]);
    expect(layerById('L').tiles).toHaveLength(1);
    expect(layerById('L').tiles[0].tileId).toBe('t2');
  });

  it('leaves cells outside the batch untouched', () => {
    store().applyTileEdits('L', [{ gridX: 0, gridY: 0, tileId: 'keep' }]);
    store().applyTileEdits('L', [{ gridX: 9, gridY: 9, tileId: 'new' }]);
    const tiles = layerById('L').tiles;
    expect(tiles).toHaveLength(2);
    expect(tiles.find((t) => t.gridX === 0)?.tileId).toBe('keep');
  });

  it('targets only the named layer', () => {
    store().addTileLayer(layer('L2'));
    store().applyTileEdits('L', [{ gridX: 0, gridY: 0, tileId: 't' }]);
    expect(layerById('L').tiles).toHaveLength(1);
    expect(layerById('L2').tiles).toHaveLength(0);
  });
});

describe('editor-store — tile brush selection state', () => {
  beforeEach(() => {
    useEditorStore.setState({ activeTilesetId: null, activeTileId: null, activeTileLayerId: null, tileEraseMode: false, activeTool: 'select' });
  });

  it('tracks active tileset / tile / layer', () => {
    const ed = useEditorStore.getState();
    ed.setActiveTileset('ts1');
    ed.setActiveTile('ts1-floor');
    ed.setActiveTileLayer('layer1');
    const s = useEditorStore.getState();
    expect(s.activeTilesetId).toBe('ts1');
    expect(s.activeTileId).toBe('ts1-floor');
    expect(s.activeTileLayerId).toBe('layer1');
  });

  it('toggles erase mode', () => {
    expect(useEditorStore.getState().tileEraseMode).toBe(false);
    useEditorStore.getState().toggleTileEraseMode();
    expect(useEditorStore.getState().tileEraseMode).toBe(true);
    useEditorStore.getState().toggleTileEraseMode();
    expect(useEditorStore.getState().tileEraseMode).toBe(false);
  });

  it('supports the tile-paint tool', () => {
    useEditorStore.getState().setTool('tile-paint');
    expect(useEditorStore.getState().activeTool).toBe('tile-paint');
  });
});

describe('hotkeys', () => {
  it('binds T to the tile-paint tool', () => {
    const b = HOTKEY_BINDINGS.find((x) => x.key === 'KeyT');
    expect(b?.action).toBe('tool-tile');
  });
});
