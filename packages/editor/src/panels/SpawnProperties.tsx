import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { PanelHeader, VisibilityToggle } from './shared.js';
import { labelText, inputCompact, buttonDangerFull as deleteBtnStyle } from '../ui/styles.js';
import { applySpawnDefault } from './landmark-spawn-helpers.js';

const labelStyle: React.CSSProperties = labelText;
const inputStyle: React.CSSProperties = inputCompact;

/**
 * SpawnProperties — selected-spawn inspector (mirrors EncounterProperties).
 * App.tsx (editor-core) must mount this when selection.spawns.length === 1.
 * Toggling isDefault on clears isDefault on every other spawn in one undo step.
 */
export function SpawnProperties() {
  const { project, updateProject, removeSpawnPoint } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();

  const id = selection.spawns.length === 1 ? selection.spawns[0] : null;
  const sp = id ? project.spawnPoints.find((s) => s.id === id) : null;
  if (!sp) return null;

  const zone = project.zones.find((z) => z.id === sp.zoneId);

  const setDefault = (isDefault: boolean) => {
    updateProject((p) => ({
      ...p,
      spawnPoints: applySpawnDefault(p.spawnPoints, sp.id, isDefault),
    }), isDefault ? 'Set default spawn' : 'Clear default spawn');
  };

  return (
    <div data-testid="wf-spawn-properties">
      <PanelHeader title="Spawn Properties" actions={<VisibilityToggle id={sp.id} />} />
      <label style={labelStyle}>ID
        <input style={inputStyle} value={sp.id} readOnly />
      </label>
      <label style={labelStyle}>Zone
        <input style={inputStyle} value={zone?.name ?? sp.zoneId} readOnly />
        {!zone && <span style={{ color: 'var(--wf-danger-text)', fontSize: 11 }}>Zone deleted</span>}
      </label>
      <label style={labelStyle}>Grid X
        <input style={inputStyle} type="number" value={sp.gridX} readOnly />
      </label>
      <label style={labelStyle}>Grid Y
        <input style={inputStyle} type="number" value={sp.gridY} readOnly />
      </label>
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6 }} data-testid="wf-spawn-default">
        <input type="checkbox" checked={sp.isDefault} onChange={(e) => setDefault(e.target.checked)} />
        Default spawn
      </label>
      <button style={deleteBtnStyle} onClick={() => { removeSpawnPoint(sp.id); clearSelection(); }}>
        Delete Spawn
      </button>
    </div>
  );
}
