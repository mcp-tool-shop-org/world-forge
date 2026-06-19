import { describe, it, expect } from 'vitest';
import { fallbackTileColor } from '../tile-render.js';
import { useEditorStore } from '../store/editor-store.js';

describe('fallbackTileColor', () => {
  it('maps wall/water/door tags to their placeholder colors', () => {
    expect(fallbackTileColor(['wall'])).toBe('#555555');
    expect(fallbackTileColor(['water'])).toBe('#2244aa');
    expect(fallbackTileColor(['door'])).toBe('#886622');
  });

  it('defaults to the floor color for untagged or unknown tiles', () => {
    expect(fallbackTileColor([])).toBe('#333333');
    expect(fallbackTileColor(['grass', 'decor'])).toBe('#333333');
  });

  it('applies wall > water > door > floor precedence on multi-tag tiles', () => {
    expect(fallbackTileColor(['water', 'wall'])).toBe('#555555');
    expect(fallbackTileColor(['door', 'water'])).toBe('#2244aa');
    expect(fallbackTileColor(['floor', 'door'])).toBe('#886622');
  });
});

describe('editor-store showTiles toggle', () => {
  it('defaults to on so painted tiles are visible', () => {
    expect(useEditorStore.getState().showTiles).toBe(true);
  });

  it('toggleTiles flips the flag and is reversible', () => {
    const before = useEditorStore.getState().showTiles;
    useEditorStore.getState().toggleTiles();
    expect(useEditorStore.getState().showTiles).toBe(!before);
    useEditorStore.getState().toggleTiles();
    expect(useEditorStore.getState().showTiles).toBe(before);
  });
});
