import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedConnection } from '../store/editor-store.js';

export function ConnectionProperties() {
  const { project, updateConnection, removeConnection } = useProjectStore();
  const { selectedConnection, clearSelection } = useEditorStore();
  const conn = selectedConnection
    ? project.connections.find(
        (c) => c.fromZoneId === selectedConnection.from && c.toZoneId === selectedConnection.to,
      )
    : null;
  if (!conn) return null;

  const fromZone = project.zones.find((z) => z.id === conn.fromZoneId);
  const toZone = project.zones.find((z) => z.id === conn.toZoneId);

  const handleSwapDirection = () => {
    // Atomic: remove old + add reversed in single updateProject
    const store = useProjectStore.getState();
    store.updateProject((p) => ({
      ...p,
      connections: p.connections.map((c) =>
        c.fromZoneId === conn.fromZoneId && c.toZoneId === conn.toZoneId
          ? { ...c, fromZoneId: conn.toZoneId, toZoneId: conn.fromZoneId }
          : c,
      ),
    }));
    // Update selection to match new direction
    useEditorStore.getState().selectConnection(conn.toZoneId, conn.fromZoneId);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Connection Properties</div>
      <label style={labelStyle}>From
        <input style={inputStyle} value={fromZone?.name ?? conn.fromZoneId} readOnly />
      </label>
      <label style={labelStyle}>To
        <input style={inputStyle} value={toZone?.name ?? conn.toZoneId} readOnly />
      </label>
      <label style={labelStyle}>Label
        <input style={inputStyle} value={conn.label ?? ''}
          onChange={(e) => updateConnection(conn.fromZoneId, conn.toZoneId, { label: e.target.value || undefined })} />
      </label>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={conn.bidirectional}
          onChange={(e) => updateConnection(conn.fromZoneId, conn.toZoneId, { bidirectional: e.target.checked })} />
        Bidirectional
      </label>
      <label style={labelStyle}>Condition
        <input style={inputStyle} value={conn.condition ?? ''} placeholder="e.g. has-tag:chapel-key"
          onChange={(e) => updateConnection(conn.fromZoneId, conn.toZoneId, { condition: e.target.value || undefined })} />
      </label>
      {!conn.bidirectional && (
        <button style={{ ...btnStyle, background: '#30363d', marginBottom: 4 }} onClick={handleSwapDirection}>
          Swap Direction
        </button>
      )}
      <button style={{ ...btnStyle, background: '#da3633' }} onClick={() => {
        removeConnection(conn.fromZoneId, conn.toZoneId);
        clearSelection();
      }}>
        Delete Connection
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', fontSize: 12, marginTop: 2,
};
const btnStyle: React.CSSProperties = {
  display: 'block', width: '100%', color: '#fff', border: 'none',
  borderRadius: 3, padding: '4px 8px', cursor: 'pointer', fontSize: 12,
};
