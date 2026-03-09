import { useEditorStore, type EditorTool } from '../store/editor-store.js';

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
    activeTool, setTool,
    showGrid, showConnections, showEntities, showLandmarks, showSpawns, showBackgrounds, showAmbient,
    toggleGrid, toggleConnections, toggleEntities, toggleLandmarks, toggleSpawns, toggleBackgrounds, toggleAmbient,
  } = useEditorStore();

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
            background: activeTool === t.id ? '#1f6feb' : '#21262d',
            color: activeTool === t.id ? '#fff' : '#c9d1d9',
            border: '1px solid #30363d', borderRadius: 3,
          }}
        >
          [{t.key}] {t.label}
        </button>
      ))}
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
    </div>
  );
}
