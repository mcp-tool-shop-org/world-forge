import { useEffect } from 'react';
import { useEditorStore, getSelectedZoneId, getSelectionCount, type EditorTool } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { computeContentBounds, fitBoundsToViewport, centerOnZone, frameBounds, MIN_ZOOM, MAX_ZOOM } from '../viewport.js';
import { activeTabBg as ACTIVE_TAB_BG } from '../ui/styles.js';
import { buttonBase } from '../ui/styles.js';
import { defaultShowElevation } from './zone-2d5-helpers.js';
import { LayerChip } from './shared.js';

const tools: { id: EditorTool; label: string; key: string; icon: string }[] = [
  { id: 'select', label: 'Select', key: 'V', icon: '\u25C7' },
  { id: 'zone-paint', label: 'Zone', key: 'Z', icon: '\u25A6' },
  { id: 'connection', label: 'Connect', key: 'C', icon: '\u2194' },
  { id: 'entity-place', label: 'Entity', key: 'E', icon: '\u25C9' },
  { id: 'landmark', label: 'Landmark', key: 'L', icon: '\u25B2' },
  { id: 'spawn', label: 'Spawn', key: 'S', icon: '\u2605' },
  { id: 'tile-paint', label: 'Tiles', key: 'T', icon: '\u25A3' },
  { id: 'prop-place', label: 'Prop', key: 'O', icon: '\u25A2' },
];

export function ToolPalette() {
  const {
    activeTool, setTool, selection,
    showGrid, showConnections, showEntities, showLandmarks, showSpawns, showBackgrounds, showTiles, showProps, showAmbient, showMinimap, showElevation,
    snapToObjects, toggleSnapToObjects,
    toggleGrid, toggleConnections, toggleEntities, toggleLandmarks, toggleSpawns, toggleBackgrounds, toggleTiles, toggleProps, toggleAmbient, toggleMinimap, toggleElevation,
    viewport, setViewport, resetViewport,
    showPerfStats, togglePerfStats,
    showRendererDiagnostics, toggleRendererDiagnostics,
  } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const { project } = useProjectStore();
  const tileSize = project.map.tileSize;

  // F-2514135c: ED-FT-003 helper had zero callers; editor-store rehydrates
  // with a hard default-on. Apply the mode-aware default only when the
  // localStorage key has never been set.
  useEffect(() => {
    try {
      if (localStorage.getItem('wf-show-elevation') != null) return;
      const next = defaultShowElevation(project.mode);
      if (next !== useEditorStore.getState().showElevation) {
        useEditorStore.setState({ showElevation: next });
      }
      localStorage.setItem('wf-show-elevation', String(next));
    } catch { /* private mode / quota — keep in-memory default */ }
  }, [project.mode]);

  const getCanvasSize = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      // EUB-013: warn when canvas DOM element is missing
      console.warn('[ToolPalette] Canvas DOM element not found — viewport operations will be skipped.');
      return null;
    }
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    return cw > 0 && ch > 0 ? { cw, ch } : null;
  };

  const fitToContent = () => {
    const size = getCanvasSize();
    if (!size) return;
    const bounds = computeContentBounds(project, tileSize);
    if (!bounds) return;
    setViewport(fitBoundsToViewport(bounds, size.cw, size.ch));
  };

  const selCount = getSelectionCount(selection);

  const centerOnSelected = () => {
    const size = getCanvasSize();
    if (!size) return;
    // Single zone: center on it
    if (selectedZoneId) {
      const zone = project.zones.find((z) => z.id === selectedZoneId);
      if (!zone) return;
      setViewport(centerOnZone(zone, tileSize, size.cw, size.ch));
      return;
    }
    // Multi-selection: frame all selected items
    if (selCount > 0) {
      const items: Array<{ gridX: number; gridY: number; gridWidth?: number; gridHeight?: number }> = [];
      for (const zid of selection.zones) {
        const z = project.zones.find((zone) => zone.id === zid);
        if (z) items.push({ gridX: z.gridX, gridY: z.gridY, gridWidth: z.gridWidth, gridHeight: z.gridHeight });
      }
      for (const eid of selection.entities) {
        const ep = project.entityPlacements.find((e) => e.entityId === eid);
        if (ep) {
          const zone = project.zones.find((z) => z.id === ep.zoneId);
          items.push({ gridX: ep.gridX ?? (zone ? zone.gridX + 2 : 0), gridY: ep.gridY ?? (zone ? zone.gridY + 2 : 0) });
        }
      }
      for (const lid of selection.landmarks) {
        const lm = project.landmarks.find((l) => l.id === lid);
        if (lm) items.push({ gridX: lm.gridX, gridY: lm.gridY });
      }
      for (const sid of selection.spawns) {
        const sp = project.spawnPoints.find((s) => s.id === sid);
        if (sp) items.push({ gridX: sp.gridX, gridY: sp.gridY });
      }
      if (items.length === 0) return;
      const vp = frameBounds(items, tileSize, size.cw, size.ch);
      if (vp) setViewport(vp);
    }
  };

  const zoomPercent = Math.round(viewport.zoom * 100);

  const btnStyle = {
    ...buttonBase, padding: '2px 6px', fontSize: 11, borderRadius: 3,
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>Tools</div>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
            padding: '4px 8px', marginBottom: 2, cursor: 'pointer', fontSize: 12,
            background: activeTool === t.id ? ACTIVE_TAB_BG : 'var(--wf-bg-control)',
            color: activeTool === t.id ? '#fff' : 'var(--wf-text-primary)',
            border: '1px solid var(--wf-border-default)', borderRadius: 3,
          }}
        >
          <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }} aria-hidden>{t.icon}</span>
          <span style={{ flex: 1 }}>{t.label}</span>
          <kbd style={{ fontSize: 10, color: activeTool === t.id ? '#fff' : 'var(--wf-text-muted)' }}>{t.key}</kbd>
        </button>
      ))}

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--wf-text-muted)' }}>Viewport</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
        <button style={btnStyle} onClick={() => setViewport({ zoom: Math.min(MAX_ZOOM, viewport.zoom + 0.1) })}>+</button>
        <span style={{ fontSize: 11, color: 'var(--wf-text-primary)', minWidth: 36, textAlign: 'center' }}>{zoomPercent}%</span>
        <button style={btnStyle} onClick={() => setViewport({ zoom: Math.max(MIN_ZOOM, viewport.zoom - 0.1) })}>-</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
        <button style={btnStyle} onClick={fitToContent}>Fit</button>
        <button style={{ ...btnStyle, opacity: selCount > 0 ? 1 : 0.4 }} onClick={centerOnSelected} disabled={selCount === 0}>Center</button>
        <button style={btnStyle} onClick={resetViewport}>Reset</button>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--wf-text-muted)' }}>Layers</div>
      <LayerChip label="Grid" pressed={showGrid} onToggle={toggleGrid} />
      <LayerChip label="Connections" pressed={showConnections} onToggle={toggleConnections} />
      <LayerChip label="Entities" pressed={showEntities} onToggle={toggleEntities} />
      <LayerChip label="Landmarks" pressed={showLandmarks} onToggle={toggleLandmarks} />
      <LayerChip label="Spawns" pressed={showSpawns} onToggle={toggleSpawns} />
      <LayerChip label="Backgrounds" pressed={showBackgrounds} onToggle={toggleBackgrounds} />
      <LayerChip label="Tiles" pressed={showTiles} onToggle={toggleTiles} />
      <LayerChip label="Props" pressed={showProps} onToggle={toggleProps} />
      <LayerChip label="Ambient" pressed={showAmbient} onToggle={toggleAmbient} />
      <LayerChip label="Minimap" pressed={showMinimap} onToggle={toggleMinimap} />
      <LayerChip label="Show Elevation" pressed={showElevation} onToggle={toggleElevation} />
      <hr style={{ margin: '6px 0 4px', borderColor: 'var(--wf-border-default)', borderStyle: 'solid', borderWidth: '1px 0 0' }} />
      <LayerChip label="Snap to Objects" pressed={snapToObjects} onToggle={toggleSnapToObjects} />
      <LayerChip label="Perf Stats" pressed={showPerfStats} onToggle={togglePerfStats} />
      <LayerChip label="Show renderer diagnostics" pressed={showRendererDiagnostics} onToggle={toggleRendererDiagnostics} />
    </div>
  );
}
