import { useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { ScenePreview } from './ScenePreview.js';
import { getModeProfile } from '../mode-profiles.js';

export function ZoneProperties() {
  const { project, updateZone, removeZone } = useProjectStore();
  const { selection, setSelectedZone } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const zone = project.zones.find((z) => z.id === selectedZoneId);
  const suggestedTags = useMemo(() => getModeProfile(project.mode).suggestedZoneTags, [project.mode]);
  if (!zone) return null;
  const unusedTags = suggestedTags.filter((t) => !zone.tags.includes(t));

  return (
    <div>
      <ScenePreview zoneId={zone.id} />
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Zone Properties</div>
      <label style={labelStyle}>Name
        <input style={inputStyle} value={zone.name}
          onChange={(e) => updateZone(zone.id, { name: e.target.value })} />
      </label>
      <label style={labelStyle}>Tags (comma-separated)
        <input style={inputStyle} value={zone.tags.join(', ')}
          onChange={(e) => updateZone(zone.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
      </label>
      {unusedTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          {unusedTags.map((tag) => (
            <button key={tag} style={chipStyle}
              onClick={() => updateZone(zone.id, { tags: [...zone.tags, tag] })}>
              + {tag}
            </button>
          ))}
        </div>
      )}
      <label style={labelStyle}>Description
        <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={zone.description}
          onChange={(e) => updateZone(zone.id, { description: e.target.value })} />
      </label>
      <label style={labelStyle}>Light (0-10)
        <input style={inputStyle} type="range" min={0} max={10} value={zone.light}
          onChange={(e) => updateZone(zone.id, { light: Number(e.target.value) })} />
        <span style={{ fontSize: 11 }}>{zone.light}</span>
      </label>
      <label style={labelStyle}>District
        <select style={inputStyle} value={zone.parentDistrictId ?? ''}
          onChange={(e) => updateZone(zone.id, { parentDistrictId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.districts.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>Background
        <select style={inputStyle} value={zone.backgroundId ?? ''}
          onChange={(e) => updateZone(zone.id, { backgroundId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.assets.filter((a) => a.kind === 'background').map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        {zone.backgroundId && !project.assets.some((a) => a.id === zone.backgroundId) && (
          <span style={{ color: '#f85149', fontSize: 11 }}>Missing asset: {zone.backgroundId}</span>
        )}
      </label>
      <label style={labelStyle}>Tileset
        <select style={inputStyle} value={zone.tilesetId ?? ''}
          onChange={(e) => updateZone(zone.id, { tilesetId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.assets.filter((a) => a.kind === 'tileset').map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
        {zone.tilesetId && !project.assets.some((a) => a.id === zone.tilesetId) && (
          <span style={{ color: '#f85149', fontSize: 11 }}>Missing asset: {zone.tilesetId}</span>
        )}
      </label>
      <button onClick={() => { removeZone(zone.id); setSelectedZone(null); }}
        style={{ ...btnStyle, background: '#da3633', marginTop: 8 }}>
        Delete Zone
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
const chipStyle: React.CSSProperties = {
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
  borderRadius: 12, padding: '1px 8px', fontSize: 11, cursor: 'pointer',
};
