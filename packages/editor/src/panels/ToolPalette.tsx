import { useEditorStore, getSelectedZoneId, getSelectionCount, type EditorTool } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { computeContentBounds, fitBoundsToViewport, centerOnZone, frameBounds, MIN_ZOOM, MAX_ZOOM } from '../viewport.js';
import { ACTIVE_TAB_BG } from './shared.js';
import { buttonBase } from '../ui/styles.js';

const tools: { id: EditorTool; label: string; key: string }[] = [
  { id: 'select', label: 'Select', key: 'V' },
  { id: 'zone-paint', label: 'Zone', key: 'Z' },
  { id: 'connection', label: 'Connect', key: 'C' },
  { id: 'entity-place', label: 'Entity', key: 'E' },
  { id: 'landmark', label: 'Landmark', key: 'L' },
  { id: 'spawn', label: 'Spawn', key: 'S' },
];

export function ToolPalette() {
  const {
    activeTool, setTool, selection,
    showGrid, showConnections, showEntities, showLandmarks, showSpawns, showBackgrounds, showAmbient,
    snapToObjects, toggleSnapToObjects,
    toggleGrid, toggleConnections, toggleEntities, toggleLandmarks, toggleSpawns, toggleBackgrounds, toggleAmbient,
    viewport, setViewport, resetViewport,
  } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const { project } = useProjectStore();
  const tileSize = project.map.tileSize;

  const getCanvasSize = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
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
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Tools</div>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '4px 8px', marginBottom: 2, cursor: 'pointer', fontSize: 12,
            background: activeTool === t.id ? ACTIVE_TAB_BG : '#21262d',
            color: activeTool === t.id ? '#fff' : '#c9d1d9',
            border: '1px solid #30363d', borderRadius: 3,
          }}
        >
          [{t.key}] {t.label}
        </button>
      ))}

      <div style={{ marginTop: 12, fontSize: 11, color: '#8b949e' }}>Viewport</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
        <button style={btnStyle} onClick={() => setViewport({ zoom: Math.min(MAX_ZOOM, viewport.zoom + 0.1) })}>+</button>
        <span style={{ fontSize: 11, color: '#c9d1d9', minWidth: 36, textAlign: 'center' }}>{zoomPercent}%</span>
        <button style={btnStyle} onClick={() => setViewport({ zoom: Math.max(MIN_ZOOM, viewport.zoom - 0.1) })}>-</button>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
        <button style={btnStyle} onClick={fitToContent}>Fit</button>
        <button style={{ ...btnStyle, opacity: selCount > 0 ? 1 : 0.4 }} onClick={centerOnSelected} disabled={selCount === 0}>Center</button>
        <button style={btnStyle} onClick={resetViewport}>Reset</button>
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#8b949e' }}>Layers</div>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showGrid} onChange={toggleGrid} /> Grid
      </label>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showConnections} onChange={toggleConnections} /> Connections
      </label>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showEntities} onChange={toggleEntities} /> Entities
      </label>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showLandmarks} onChange={toggleLandmarks} /> Landmarks
      </label>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showSpawns} onChange={toggleSpawns} /> Spawns
      </label>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showBackgrounds} onChange={toggleBackgrounds} /> Backgrounds
      </label>
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={showAmbient} onChange={toggleAmbient} /> Ambient
      </label>
      <hr style={{ margin: '6px 0 4px', borderColor: '#30363d', borderStyle: 'solid', borderWidth: '1px 0 0' }} />
      <label style={{ display: 'block', fontSize: 12, cursor: 'pointer' }}>
        <input type="checkbox" checked={snapToObjects} onChange={toggleSnapToObjects} /> Snap to Objects
      </label>
    </div>
  );
}
