import type { CSSProperties } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore } from './store/editor-store.js';
import { PanelHeader, VisibilityToggle } from './panels/shared.js';
import { labelText, inputCompact, buttonDangerFull as deleteBtnStyle } from './ui/styles.js';

export function SpawnProperties() {
  const { project, updateSpawnPoint, removeSpawnPoint, setDefaultSpawnPoint } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();

  const spId = selection.spawns.length === 1 ? selection.spawns[0] : null;
  const sp = spId ? project.spawnPoints.find((s) => s.id === spId) : null;
  if (!sp) return null;

  const zone = project.zones.find((z) => z.id === sp.zoneId);

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
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          data-testid="wf-spawn-is-default"
          checked={sp.isDefault}
          onChange={(e) => {
            if (e.target.checked) setDefaultSpawnPoint(sp.id);
            else updateSpawnPoint(sp.id, { isDefault: false });
          }}
        />
        Default spawn
      </label>
      <button style={deleteBtnStyle} onClick={() => { removeSpawnPoint(sp.id); clearSelection(); }}>
        Delete Spawn
      </button>
    </div>
  );
}

const labelStyle: CSSProperties = labelText;
const inputStyle: CSSProperties = inputCompact;
