import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import type { Landmark } from '@world-forge/schema';
import { PanelHeader, VisibilityToggle } from './shared.js';
import { labelText, inputCompact, buttonDangerFull as deleteBtnStyle } from '../ui/styles.js';
import { LANDMARK_INTERACTIONS, parseLandmarkTags } from './landmark-spawn-helpers.js';

const labelStyle: React.CSSProperties = labelText;
const inputStyle: React.CSSProperties = inputCompact;

/**
 * LandmarkProperties — selected-landmark inspector (mirrors EncounterProperties).
 * App.tsx (editor-core) must mount this when selection.landmarks.length === 1.
 */
export function LandmarkProperties() {
  const { project, updateLandmark, removeLandmark } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();

  const id = selection.landmarks.length === 1 ? selection.landmarks[0] : null;
  const lm = id ? project.landmarks.find((l) => l.id === id) : null;
  if (!lm) return null;

  const zone = project.zones.find((z) => z.id === lm.zoneId);
  const patch = (updates: Partial<Landmark>) => updateLandmark(lm.id, updates);

  return (
    <div data-testid="wf-landmark-properties">
      <PanelHeader title="Landmark Properties" actions={<VisibilityToggle id={lm.id} />} />
      <label style={labelStyle}>ID
        <input style={inputStyle} value={lm.id} readOnly />
      </label>
      <label style={labelStyle}>Zone
        <input style={inputStyle} value={zone?.name ?? lm.zoneId} readOnly />
        {!zone && <span style={{ color: 'var(--wf-danger-text)', fontSize: 11 }}>Zone deleted</span>}
      </label>
      <label style={labelStyle}>Name
        <input style={inputStyle} value={lm.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>
      <label style={labelStyle}>Description
        <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={lm.description ?? ''}
          onChange={(e) => patch({ description: e.target.value || undefined })} />
      </label>
      <label style={labelStyle}>Interaction
        <select style={inputStyle} value={lm.interactionType} data-testid="wf-landmark-interaction"
          onChange={(e) => patch({ interactionType: e.target.value as Landmark['interactionType'] })}>
          {LANDMARK_INTERACTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Icon
        <select style={inputStyle} value={lm.iconId ?? ''} data-testid="wf-landmark-icon"
          onChange={(e) => patch({ iconId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.assets.filter((a) => a.kind === 'icon').map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>Tags (comma-separated)
        <input style={inputStyle} value={lm.tags.join(', ')}
          onChange={(e) => patch({ tags: parseLandmarkTags(e.target.value) })} />
      </label>
      <button style={deleteBtnStyle} onClick={() => { removeLandmark(lm.id); clearSelection(); }}>
        Delete Landmark
      </button>
    </div>
  );
}
