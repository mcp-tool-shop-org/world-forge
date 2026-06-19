import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { fallbackTileColor } from '../tile-render.js';
import { buttonBase } from '../ui/styles.js';
import type { Tileset, TileDefinition } from '@world-forge/schema';

/** Swatch background for a tile — the sliced sheet image when available, else its fallback color. */
function tileSwatchStyle(tileset: Tileset, def: TileDefinition, size: number): CSSProperties {
  if (tileset.imagePath) {
    const sheetW = (tileset.imageWidth ?? tileset.tileWidth) * (size / tileset.tileWidth);
    const sheetH = (tileset.imageHeight ?? tileset.tileHeight) * (size / tileset.tileHeight);
    return {
      width: size, height: size,
      backgroundImage: `url("${tileset.imagePath}")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `-${def.col * size}px -${def.row * size}px`,
      backgroundSize: `${sheetW}px ${sheetH}px`,
      imageRendering: 'pixelated',
    };
  }
  return { width: size, height: size, background: fallbackTileColor(def.tags) };
}

/**
 * Tile Palette — pick the active tile / tileset / layer for the tile-paint brush.
 * Self-gating: renders only while the tile-paint tool is active. "New tileset"
 * seeds floor/wall/water/door tiles so the user can paint immediately without art.
 */
export function TilePalette() {
  const { project, addTileset, addTileLayer, removeTileLayer } = useProjectStore();
  const {
    activeTool, activeTilesetId, activeTileId, activeTileLayerId, tileEraseMode,
    setActiveTileset, setActiveTile, setActiveTileLayer, toggleTileEraseMode,
  } = useEditorStore();

  if (activeTool !== 'tile-paint') return null;

  const tilesets = project.tilesets ?? [];
  const layers = project.tileLayers ?? [];
  const activeTileset = tilesets.find((t) => t.id === activeTilesetId) ?? tilesets[0];
  const activeLayerId = activeTileLayerId ?? layers[0]?.id ?? null;

  const createTileset = () => {
    const id = `tileset-${Date.now()}`;
    addTileset({
      id, name: `Tileset ${tilesets.length + 1}`,
      tileWidth: project.map.tileSize, tileHeight: project.map.tileSize,
      tiles: [
        { id: `${id}-floor`, tilesetId: id, row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
        { id: `${id}-wall`, tilesetId: id, row: 0, col: 1, tags: ['wall'], walkable: false, opacity: 1 },
        { id: `${id}-water`, tilesetId: id, row: 0, col: 2, tags: ['water'], walkable: false, opacity: 1 },
        { id: `${id}-door`, tilesetId: id, row: 0, col: 3, tags: ['door'], walkable: true, opacity: 1 },
      ],
    });
    setActiveTileset(id);
    setActiveTile(`${id}-floor`);
  };

  const createLayer = () => {
    const id = `tile-layer-${Date.now()}`;
    addTileLayer({ id, name: `Layer ${layers.length + 1}`, zIndex: layers.length, tiles: [] });
    setActiveTileLayer(id);
  };

  const row = (active: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '3px 6px', marginBottom: 2, fontSize: 12, cursor: 'pointer', borderRadius: 3,
    background: active ? 'rgba(31,111,235,0.2)' : '#21262d',
    border: `1px solid ${active ? '#1f6feb' : '#30363d'}`,
    color: active ? '#fff' : '#c9d1d9',
  });
  const addBtn: CSSProperties = { ...buttonBase, padding: '2px 6px', fontSize: 11, borderRadius: 3, marginTop: 2 };
  const sectionLabel: CSSProperties = { marginTop: 12, fontSize: 11, color: '#8b949e', marginBottom: 4 };
  const hint: CSSProperties = { fontSize: 11, color: '#6e7681', marginBottom: 4 };

  return (
    <div style={{ marginTop: 12 }} data-testid="wf-tile-palette">
      <div style={{ ...sectionLabel, marginTop: 0 }}>Tile Layers</div>
      {layers.length === 0 && <div style={hint}>No layers yet — painting creates one.</div>}
      {layers.map((l) => (
        <div key={l.id} style={row(l.id === activeLayerId)} onClick={() => setActiveTileLayer(l.id)}>
          <span>{l.name} <span style={{ color: '#6e7681' }}>({l.tiles.length})</span></span>
          <button
            title="Delete layer"
            style={{ ...buttonBase, padding: '0 5px', fontSize: 12 }}
            onClick={(e) => { e.stopPropagation(); removeTileLayer(l.id); if (activeTileLayerId === l.id) setActiveTileLayer(null); }}
          >×</button>
        </div>
      ))}
      <button style={addBtn} onClick={createLayer}>+ New layer</button>

      <div style={sectionLabel}>Tilesets</div>
      {tilesets.length === 0 && <div style={hint}>No tilesets — create one to start painting.</div>}
      {tilesets.map((ts) => (
        <div key={ts.id} style={row(ts.id === (activeTilesetId ?? tilesets[0]?.id))} onClick={() => setActiveTileset(ts.id)}>
          <span>{ts.name} <span style={{ color: '#6e7681' }}>({ts.tiles.length})</span></span>
          <span style={{ color: ts.imagePath ? '#3fb950' : '#6e7681', fontSize: 10 }}>{ts.imagePath ? 'img' : 'color'}</span>
        </div>
      ))}
      <button style={addBtn} onClick={createTileset}>+ New tileset</button>

      {activeTileset && (
        <>
          <div style={sectionLabel}>Tiles — {activeTileset.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {activeTileset.tiles.map((t) => {
              const active = t.id === activeTileId;
              return (
                <button
                  key={t.id}
                  title={`${t.tags.join(', ') || 'tile'} (r${t.row} c${t.col})`}
                  onClick={() => setActiveTile(t.id)}
                  style={{
                    padding: 0, cursor: 'pointer', lineHeight: 0, background: 'none',
                    border: `2px solid ${active ? '#1f6feb' : '#30363d'}`, borderRadius: 3,
                  }}
                >
                  <span style={{ display: 'block', ...tileSwatchStyle(activeTileset, t, 28) }} />
                </button>
              );
            })}
          </div>
        </>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={tileEraseMode} onChange={toggleTileEraseMode} /> Erase mode
        <span style={{ color: '#6e7681', fontSize: 10 }}>(or hold Alt)</span>
      </label>
      <div style={{ marginTop: 6, fontSize: 10, color: '#6e7681' }}>Left-drag to paint into the active layer.</div>
    </div>
  );
}
