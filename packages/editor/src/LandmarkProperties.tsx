import type { CSSProperties } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore } from './store/editor-store.js';
import { PanelHeader, VisibilityToggle } from './panels/shared.js';
import { labelText, inputCompact, buttonDangerFull as deleteBtnStyle } from './ui/styles.js';

const INTERACTION_TYPES = ['inspect', 'use', 'enter', 'talk', 'none'] as const;

export function LandmarkProperties() {
  const { project, updateLandmark, removeLandmark } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();

  const lmId = selection.landmarks.length === 1 ? selection.landmarks[0] : null;
  const lm = lmId ? project.landmarks.find((l) => l.id === lmId) : null;
  if (!lm) return null;

  const zone = project.zones.find((z) => z.id === lm.zoneId);
  const icons = project.assets.filter((a) => a.kind === 'icon');

  return (
    <div data-testid="wf-landmark-properties">
      <PanelHeader title="Landmark Properties" actions={<VisibilityToggle id={lm.id} />} />
      <label style={labelStyle}>Name
        <input style={inputStyle} value={lm.name}
          onChange={(e) => updateLandmark(lm.id, { name: e.target.value })} />
      </label>
      <label style={labelStyle}>Zone
        <input style={inputStyle} value={zone?.name ?? lm.zoneId} readOnly />
        {!zone && <span style={{ color: 'var(--wf-danger-text)', fontSize: 11 }}>Zone deleted</span>}
      </label>
      <label style={labelStyle}>Description
        <input style={inputStyle} value={lm.description ?? ''}
          onChange={(e) => updateLandmark(lm.id, { description: e.target.value || undefined })} />
      </label>
      <label style={labelStyle}>Tags (comma-separated)
        <input style={inputStyle} value={lm.tags.join(', ')}
          onChange={(e) => updateLandmark(lm.id, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <label style={labelStyle}>Interaction Type
        <select style={inputStyle} data-testid="wf-landmark-interaction"
          value={lm.interactionType}
          onChange={(e) => updateLandmark(lm.id, { interactionType: e.target.value as typeof INTERACTION_TYPES[number] })}>
          {INTERACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Icon
        <select style={inputStyle} data-testid="wf-landmark-icon"
          value={lm.iconId ?? ''}
          onChange={(e) => updateLandmark(lm.id, { iconId: e.target.value || undefined })}>
          <option value="">— none —</option>
          {icons.map((a) => <option key={a.id} value={a.id}>{a.label || a.id}</option>)}
        </select>
      </label>
      <button style={deleteBtnStyle} onClick={() => { removeLandmark(lm.id); clearSelection(); }}>
        Delete Landmark
      </button>
    </div>
  );
}

const labelStyle: CSSProperties = labelText;
const inputStyle: CSSProperties = inputCompact;
