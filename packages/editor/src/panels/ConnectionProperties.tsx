import { useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedConnection } from '../store/editor-store.js';
import type { ConnectionKind, AuthoringMode } from '@world-forge/schema';
import { getModeProfile } from '../mode-profiles.js';
import { PanelHeader, labelStyle as sharedLabelStyle, inputStyle as sharedInputStyle, deleteBtnStyle } from './shared.js';

/** Display labels for all 12 connection kinds. */
export const KIND_LABELS: Record<ConnectionKind, string> = {
  passage: 'Passage', door: 'Door', stairs: 'Stairs', road: 'Road',
  portal: 'Portal', secret: 'Secret', hazard: 'Hazard',
  channel: 'Channel', route: 'Route', docking: 'Docking',
  warp: 'Warp', trail: 'Trail',
};

/** All connection kinds in canonical order. */
const ALL_KINDS: ConnectionKind[] = Object.keys(KIND_LABELS) as ConnectionKind[];

/**
 * Build a mode-ordered connection kind list.
 * Mode-relevant kinds come first, then remaining kinds in canonical order.
 * Pure function — exported for testing.
 */
export function getOrderedKinds(mode: AuthoringMode | undefined): { preferred: ConnectionKind[]; other: ConnectionKind[] } {
  const profile = getModeProfile(mode);
  const preferredSet = new Set(profile.connectionKinds);
  const other = ALL_KINDS.filter((k) => !preferredSet.has(k));
  return { preferred: profile.connectionKinds, other };
}

export function ConnectionProperties() {
  const { project, updateConnection, removeConnection } = useProjectStore();
  const { selectedConnection, clearSelection } = useEditorStore();
  const conn = selectedConnection
    ? project.connections.find(
        (c) => c.fromZoneId === selectedConnection.from && c.toZoneId === selectedConnection.to,
      )
    : null;
  const { preferred, other } = useMemo(() => getOrderedKinds(project.mode), [project.mode]);
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
      <PanelHeader title="Connection Properties" />
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
      <label style={labelStyle}>Kind
        <select style={inputStyle} value={conn.kind ?? 'passage'}
          onChange={(e) => {
            const v = e.target.value as ConnectionKind;
            updateConnection(conn.fromZoneId, conn.toZoneId, { kind: v === 'passage' ? undefined : v });
          }}>
          {preferred.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
          {other.length > 0 && <option disabled>── Other ──</option>}
          {other.map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
        </select>
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
      <button style={deleteBtnStyle} onClick={() => {
        removeConnection(conn.fromZoneId, conn.toZoneId);
        clearSelection();
      }}>
        Delete Connection
      </button>
    </div>
  );
}

const labelStyle: React.CSSProperties = { ...sharedLabelStyle };
const inputStyle: React.CSSProperties = { ...sharedInputStyle, padding: '3px 6px', marginTop: 2 };
const btnStyle: React.CSSProperties = {
  display: 'block', width: '100%', color: '#fff', border: 'none',
  borderRadius: 3, padding: '4px 8px', cursor: 'pointer', fontSize: 12,
};
