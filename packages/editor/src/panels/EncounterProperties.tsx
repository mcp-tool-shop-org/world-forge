import { useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { getModeProfile } from '../mode-profiles.js';

export function EncounterProperties() {
  const { project, updateEncounter, removeEncounter } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();

  const encId = selection.encounters.length === 1 ? selection.encounters[0] : null;
  const enc = encId ? project.encounterAnchors.find((e) => e.id === encId) : null;
  const encounterSuggestions = useMemo(() => getModeProfile(project.mode).encounterTypes, [project.mode]);
  if (!enc) return null;

  const zone = project.zones.find((z) => z.id === enc.zoneId);

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Encounter Properties</div>
      <label style={labelStyle}>ID
        <input style={inputStyle} value={enc.id} readOnly />
      </label>
      <label style={labelStyle}>Zone
        <input style={inputStyle} value={zone?.name ?? enc.zoneId} readOnly />
      </label>
      <label style={labelStyle}>Encounter Type
        <input style={inputStyle} value={enc.encounterType} list="encounter-type-suggestions"
          onChange={(e) => updateEncounter(enc.id, { encounterType: e.target.value })} />
        <datalist id="encounter-type-suggestions">
          {encounterSuggestions.map((t) => <option key={t} value={t} />)}
        </datalist>
      </label>
      <label style={labelStyle}>Enemy IDs (comma-separated)
        <input style={inputStyle} value={enc.enemyIds.join(', ')}
          onChange={(e) => updateEncounter(enc.id, { enemyIds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <label style={labelStyle}>Probability (0–1)
        <input style={inputStyle} type="number" min={0} max={1} step={0.05} value={enc.probability}
          onChange={(e) => updateEncounter(enc.id, { probability: parseFloat(e.target.value) || 0 })} />
      </label>
      <label style={labelStyle}>Cooldown Turns
        <input style={inputStyle} type="number" min={0} step={1} value={enc.cooldownTurns}
          onChange={(e) => updateEncounter(enc.id, { cooldownTurns: parseInt(e.target.value) || 0 })} />
      </label>
      <label style={labelStyle}>Tags (comma-separated)
        <input style={inputStyle} value={enc.tags.join(', ')}
          onChange={(e) => updateEncounter(enc.id, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <button style={btnStyle} onClick={() => { removeEncounter(enc.id); clearSelection(); }}>
        Delete Encounter
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
  display: 'block', width: '100%', color: '#fff', background: '#da3633', border: 'none',
  borderRadius: 3, padding: '4px 8px', cursor: 'pointer', fontSize: 12, marginTop: 8,
};
