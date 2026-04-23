import { useMemo, useRef } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { ScenePreview } from './ScenePreview.js';
import { getModeProfile } from '../mode-profiles.js';
import { PanelHeader } from './shared.js';
import { labelText, inputCompact, buttonDangerFull as deleteBtnStyle } from '../ui/styles.js';
import { VisibilityToggle } from './shared.js';
import type { ParallaxLayer, Zone } from '@world-forge/schema';
import {
  validateElevationRange,
  parseElevation,
  createDefaultLayer,
  filterParallaxAssets,
  filterSkylineAssets,
  sortLayersForPreview,
  isLayerIdUnique,
} from './zone-2d5-helpers.js';

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
      {/* ED-FT-001: full edit surface for the 2.5D fields. */}
      <Advanced25DSection zone={zone} />
      <button onClick={() => { removeZone(zone.id); setSelectedZone(null); }}
        style={deleteBtnStyle}>
        Delete Zone
      </button>
    </div>
  );
}

/**
 * ED-FT-001: full 2.5D editor — elevation, elevation range, parallax layers,
 * skyline ref. Replaces the Stage C read-only preview. All writes go through
 * `updateZone` which routes through the undo/redo stack in zustand.
 */
function Advanced25DSection({ zone }: { zone: Zone }) {
  const { updateZone } = useProjectStore();
  const project = useProjectStore((s) => s.project);
  const parallaxChoices = filterParallaxAssets(project.assets);
  const skylineChoices = filterSkylineAssets(project.assets);

  const rangeError = validateElevationRange(
    zone.elevationRange?.floor,
    zone.elevationRange?.ceiling,
  );

  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleElevationChange = (raw: string) => {
    const parsed = parseElevation(raw);
    updateZone(zone.id, { elevation: parsed });
  };

  const handleRangeChange = (side: 'floor' | 'ceiling', raw: string) => {
    const parsed = parseElevation(raw);
    const current = zone.elevationRange;
    if (parsed == null && current == null) return;
    const nextFloor = side === 'floor' ? parsed : current?.floor;
    const nextCeiling = side === 'ceiling' ? parsed : current?.ceiling;
    // Clear only when both sides are undefined.
    if (nextFloor == null && nextCeiling == null) {
      updateZone(zone.id, { elevationRange: undefined });
      return;
    }
    updateZone(zone.id, {
      elevationRange: {
        floor: nextFloor ?? 0,
        ceiling: nextCeiling ?? 0,
      },
    });
  };

  const handleRangeClear = () => {
    updateZone(zone.id, { elevationRange: undefined });
  };

  const handleAddLayer = () => {
    const next = createDefaultLayer(zone.parallaxLayers ?? []);
    updateZone(zone.id, { parallaxLayers: [...(zone.parallaxLayers ?? []), next] });
  };

  const handleRemoveLayer = (idx: number) => {
    const layers = [...(zone.parallaxLayers ?? [])];
    layers.splice(idx, 1);
    updateZone(zone.id, { parallaxLayers: layers.length > 0 ? layers : undefined });
  };

  const handleLayerField = <K extends keyof ParallaxLayer>(
    idx: number, field: K, value: ParallaxLayer[K],
  ) => {
    const layers = [...(zone.parallaxLayers ?? [])];
    if (!layers[idx]) return;
    layers[idx] = { ...layers[idx], [field]: value };
    updateZone(zone.id, { parallaxLayers: layers });
  };

  const focusLayerRow = (id: string) => {
    const el = rowRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const firstInput = el.querySelector('input, select') as HTMLElement | null;
      firstInput?.focus();
    }
  };

  const layers = zone.parallaxLayers ?? [];
  const elevation = zone.elevation;
  const range = zone.elevationRange;

  return (
    <details
      data-testid="zone-advanced-25d"
      open
      style={{ margin: '8px 0', fontSize: 12, color: 'var(--wf-text-muted)' }}
    >
      <summary style={{ cursor: 'pointer', color: 'var(--wf-text-hint)' }}>
        Advanced: 2.5D
      </summary>
      <div style={{ padding: '6px 8px', borderLeft: '2px solid var(--wf-border-default)', marginTop: 4 }}>
        {/* Elevation */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--wf-text-primary)', marginBottom: 2 }}>
            Elevation (m)
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              data-testid="elevation-slider"
              type="range"
              min={-100}
              max={100}
              step={0.5}
              value={elevation ?? 0}
              onChange={(e) => handleElevationChange(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              data-testid="elevation-number"
              type="number"
              step={0.5}
              value={elevation ?? ''}
              onChange={(e) => handleElevationChange(e.target.value)}
              placeholder="—"
              style={{ ...inputStyle, width: 70 }}
            />
          </div>
        </div>

        {/* Elevation range */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--wf-text-primary)', marginBottom: 2 }}>
            Elevation Range (m)
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              data-testid="elevation-range-floor"
              type="number"
              step={0.5}
              value={range?.floor ?? ''}
              onChange={(e) => handleRangeChange('floor', e.target.value)}
              placeholder="floor"
              style={{ ...inputStyle, width: 80 }}
            />
            <span style={{ fontSize: 11 }}>{'\u2192'}</span>
            <input
              data-testid="elevation-range-ceiling"
              type="number"
              step={0.5}
              value={range?.ceiling ?? ''}
              onChange={(e) => handleRangeChange('ceiling', e.target.value)}
              placeholder="ceiling"
              style={{ ...inputStyle, width: 80 }}
            />
            {range && (
              <button
                onClick={handleRangeClear}
                title="Clear elevation range"
                style={{ ...chipStyle, fontSize: 10 }}
              >
                Clear
              </button>
            )}
          </div>
          {rangeError && (
            <div
              data-testid="elevation-range-error"
              style={{ fontSize: 11, color: '#f85149', marginTop: 2 }}
            >
              {rangeError.message}
            </div>
          )}
        </div>

        {/* Parallax layers */}
        <div style={{ marginBottom: 10 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4,
          }}>
            <span style={{ fontSize: 11, color: 'var(--wf-text-primary)' }}>
              Parallax Layers ({layers.length})
            </span>
            <button
              data-testid="parallax-add-layer"
              onClick={handleAddLayer}
              style={chipStyle}
            >
              + Add layer
            </button>
          </div>
          {layers.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--wf-text-hint)', fontStyle: 'italic', padding: '2px 0' }}>
              No parallax layers. Add one to build depth for 2.5D scenes.
            </div>
          )}
          {layers.map((layer, idx) => {
            const idUnique = isLayerIdUnique(layers, layer.id, idx);
            const assetValid = layer.assetRef === '' || parallaxChoices.some((a) => a.id === layer.assetRef);
            return (
              <div
                key={idx}
                ref={(el) => { rowRefs.current[layer.id] = el; }}
                data-testid={`parallax-row-${idx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 60px 1fr 1fr auto',
                  gap: 4,
                  alignItems: 'center',
                  padding: '4px 0',
                  borderTop: idx > 0 ? '1px solid var(--wf-border-subtle)' : 'none',
                }}
              >
                <input
                  data-testid={`parallax-id-${idx}`}
                  type="text"
                  value={layer.id}
                  onChange={(e) => handleLayerField(idx, 'id', e.target.value)}
                  placeholder="id"
                  style={{
                    ...inputStyle,
                    borderColor: !idUnique ? '#f85149' : undefined,
                  }}
                  title={!idUnique ? 'Layer ids must be unique' : 'Layer id'}
                />
                <input
                  data-testid={`parallax-depth-${idx}`}
                  type="number"
                  value={layer.depth}
                  onChange={(e) => handleLayerField(idx, 'depth', Number(e.target.value))}
                  placeholder="depth"
                  style={inputStyle}
                />
                <select
                  data-testid={`parallax-asset-${idx}`}
                  value={layer.assetRef}
                  onChange={(e) => handleLayerField(idx, 'assetRef', e.target.value)}
                  style={{
                    ...inputStyle,
                    borderColor: !assetValid ? '#f85149' : undefined,
                  }}
                >
                  <option value="">— pick asset —</option>
                  {parallaxChoices.map((a) => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <input
                    data-testid={`parallax-scroll-slider-${idx}`}
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.scrollFactor}
                    onChange={(e) => handleLayerField(idx, 'scrollFactor', Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <input
                    data-testid={`parallax-scroll-number-${idx}`}
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={layer.scrollFactor}
                    onChange={(e) => handleLayerField(idx, 'scrollFactor', Number(e.target.value))}
                    style={{ ...inputStyle, width: 45 }}
                  />
                </div>
                <button
                  data-testid={`parallax-remove-${idx}`}
                  onClick={() => handleRemoveLayer(idx)}
                  title="Remove layer"
                  style={{ ...chipStyle, color: '#f85149' }}
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* ED-FT-004: visual stack preview */}
          {layers.length > 0 && (
            <ParallaxPreviewStack
              layers={layers}
              assets={project.assets}
              onLayerClick={focusLayerRow}
            />
          )}
        </div>

        {/* Skyline */}
        <label style={labelStyle}>Skyline Ref
          <select
            data-testid="skyline-ref"
            style={inputStyle}
            value={zone.skylineRef ?? ''}
            onChange={(e) => updateZone(zone.id, { skylineRef: e.target.value || undefined })}
          >
            <option value="">None</option>
            {skylineChoices.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          {zone.skylineRef && !project.assets.some((a) => a.id === zone.skylineRef) && (
            <span style={{ color: '#f85149', fontSize: 11 }}>Missing asset: {zone.skylineRef}</span>
          )}
        </label>
      </div>
    </details>
  );
}

/**
 * ED-FT-004: compact visual stack. Furthest layer drawn first (top-back),
 * closest last (bottom-front). Each rectangle shows a faded thumbnail when a
 * path is available; otherwise a neutral colored box with the asset id.
 */
function ParallaxPreviewStack({
  layers,
  assets,
  onLayerClick,
}: {
  layers: import('@world-forge/schema').ParallaxLayer[];
  assets: import('@world-forge/schema').AssetEntry[];
  onLayerClick: (layerId: string) => void;
}) {
  const sorted = sortLayersForPreview(layers);
  // Neutral color palette for placeholder tiles, cycled by index for variety.
  const placeholderPalette = ['#2e333d', '#3b4150', '#4a5263', '#5b6576'];

  return (
    <div
      data-testid="parallax-preview-stack"
      style={{
        position: 'relative',
        height: 80,
        marginTop: 8,
        border: '1px solid var(--wf-border-default)',
        background: 'var(--wf-bg-app)',
        borderRadius: 3,
        overflow: 'hidden',
      }}
    >
      {sorted.map((layer, i) => {
        const asset = assets.find((a) => a.id === layer.assetRef);
        const hasPath = asset?.path != null && asset.path.length > 0;
        const z = i + 1; // further back layers drawn first = lower z
        // Stack tiles with a small offset so each is visible.
        const offset = i * 6;
        const color = placeholderPalette[i % placeholderPalette.length];
        return (
          <button
            key={layer.id + '::' + i}
            data-testid={`parallax-preview-tile-${layer.id}`}
            onClick={() => onLayerClick(layer.id)}
            title={`Click to edit layer ${layer.id}`}
            style={{
              position: 'absolute',
              left: offset + 6,
              top: offset + 6,
              right: offset + 6,
              height: 60 - offset,
              background: hasPath
                ? `center / cover no-repeat url(${safeUrl(asset!.path)})`
                : color,
              opacity: 0.85,
              border: '1px solid var(--wf-border-default)',
              borderRadius: 2,
              zIndex: z,
              color: 'var(--wf-text-primary)',
              fontSize: 10,
              padding: '2px 6px',
              textAlign: 'left',
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              background: 'rgba(0,0,0,0.55)', padding: '1px 4px', borderRadius: 2,
            }}>
              {layer.id} · sf {layer.scrollFactor.toFixed(2)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Defensive: paths may contain spaces or parentheses. Escape for url(). */
function safeUrl(path: string): string {
  // Escape backslashes and quotes, wrap in single quotes.
  return `'${path.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const labelStyle: React.CSSProperties = labelText;
const inputStyle: React.CSSProperties = inputCompact;
const chipStyle: React.CSSProperties = {
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
  borderRadius: 12, padding: '1px 8px', fontSize: 11, cursor: 'pointer',
};
