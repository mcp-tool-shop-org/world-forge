import { useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { ScenePreview } from './ScenePreview.js';
import { getModeProfile } from '../mode-profiles.js';
import { PanelHeader } from './shared.js';
import { labelText, inputCompact, labelText as sharedLabelStyle, inputBase as sharedInputStyle, buttonDangerFull as deleteBtnStyle } from '../ui/styles.js';
import { VisibilityToggle } from './shared.js';

export function ZoneProperties() {
  const { project, updateZone, removeZone } = useProjectStore();
  const { selection, setSelectedZone } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const zone = project.zones.find((z) => z.id === selectedZoneId);
  const suggestedTags = useMemo(() => getModeProfile(project.mode).suggestedZoneTags, [project.mode]);
  if (!zone) return (
    <div style={{ fontSize: 12, color: '#d29922', padding: '8px 0' }}>
      This zone was deleted. Select another zone to see its properties.
    </div>
  );
  const unusedTags = suggestedTags.filter((t) => !zone.tags.includes(t));

  return (
    <div>
      <ScenePreview zoneId={zone.id} />
      <PanelHeader title="Zone Properties" actions={<VisibilityToggle id={zone.id} />} />
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
      {/* ED-B-003: 2.5D fields are read-only for now — full editor UI is a
          Phase 5 feature. Surface them so authors can see what's set without
          opening the project JSON. */}
      <Advanced25DSection
        elevation={zone.elevation}
        elevationRange={zone.elevationRange}
        parallaxLayers={zone.parallaxLayers}
        skylineRef={zone.skylineRef}
      />
      <button onClick={() => { removeZone(zone.id); setSelectedZone(null); }}
        style={deleteBtnStyle}>
        Delete Zone
      </button>
    </div>
  );
}

/**
 * ED-B-003: Read-only preview of the 2.5D zone fields. Editing is deferred to
 * Phase 5 — users can still hand-edit the JSON. Rendered even when all fields
 * are empty so the user can see the section exists and what it covers.
 */
function Advanced25DSection(props: {
  elevation?: number;
  elevationRange?: { floor: number; ceiling: number };
  parallaxLayers?: unknown[];
  skylineRef?: string;
}) {
  const anySet = props.elevation != null || props.elevationRange != null
    || (props.parallaxLayers && props.parallaxLayers.length > 0)
    || (props.skylineRef != null && props.skylineRef.length > 0);

  return (
    <details
      data-testid="zone-advanced-25d"
      style={{ margin: '8px 0', fontSize: 11, color: 'var(--wf-text-muted)' }}
    >
      <summary style={{ cursor: 'pointer', color: 'var(--wf-text-hint)' }}>
        Advanced: 2.5D (preview)
      </summary>
      <div style={{ padding: '4px 8px', borderLeft: '2px solid var(--wf-border-default)', marginTop: 4 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', rowGap: 2, columnGap: 8 }}>
          <span>Elevation (m):</span>
          <span style={{ color: 'var(--wf-text-primary)' }}>{props.elevation ?? '\u2014'}</span>
          <span>Elevation range:</span>
          <span style={{ color: 'var(--wf-text-primary)' }}>
            {props.elevationRange ? `${props.elevationRange.floor} \u2192 ${props.elevationRange.ceiling}` : '\u2014'}
          </span>
          <span>Parallax layers:</span>
          <span style={{ color: 'var(--wf-text-primary)' }}>
            {props.parallaxLayers && props.parallaxLayers.length > 0 ? `${props.parallaxLayers.length} layer(s)` : '\u2014'}
          </span>
          <span>Skyline ref:</span>
          <span style={{ color: 'var(--wf-text-primary)' }}>{props.skylineRef ?? '\u2014'}</span>
        </div>
        <div style={{ fontSize: 10, fontStyle: 'italic', marginTop: 6, color: 'var(--wf-text-hint)' }}>
          {anySet
            ? 'Edit these fields in your project JSON or a future release \u2014 editor UI coming in Phase 5.'
            : 'No 2.5D fields set. Edit these in your project JSON or a future release \u2014 editor UI coming in Phase 5.'}
        </div>
      </div>
    </details>
  );
}

const labelStyle: React.CSSProperties = labelText;
const inputStyle: React.CSSProperties = inputCompact;
const chipStyle: React.CSSProperties = {
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
  borderRadius: 12, padding: '1px 8px', fontSize: 11, cursor: 'pointer',
};
