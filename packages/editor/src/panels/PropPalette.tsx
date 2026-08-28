import { useState, type CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { buttonBase, inputBase as inputStyle, labelText as labelStyle } from '../ui/styles.js';
import type { PropDefinition } from '@world-forge/schema';
import { EmptyState } from './shared.js';

/** Swatch background for a prop — its image when set, else a color by behavior. */
function propSwatch(def: PropDefinition, size: number): CSSProperties {
  if (def.imagePath) {
    return { width: size, height: size, backgroundImage: `url("${def.imagePath}")`, backgroundSize: 'cover', imageRendering: 'pixelated' };
  }
  const bg = def.interactable ? 'color-mix(in srgb, var(--wf-warning) 70%, transparent)' : (!def.walkable ? 'color-mix(in srgb, var(--wf-text-muted) 70%, transparent)' : 'color-mix(in srgb, var(--wf-success-text) 55%, transparent)');
  return { width: size, height: size, background: bg };
}

/**
 * Prop Palette — pick the active prop definition for the prop-place tool, or
 * create one. Self-gating: renders only while the prop-place tool is active.
 * Click the canvas to place the active prop; placement count shows on each row.
 */
export function PropPalette() {
  const { project, addProp, updateProp } = useProjectStore();
  const { activeTool, activePropId, setActiveProp } = useEditorStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (activeTool !== 'prop-place') return null;

  const props = project.props ?? [];
  const placements = project.propPlacements ?? [];
  const activeId = activePropId ?? props[0]?.id ?? null;

  const createProp = () => {
    const id = `prop-def-${Date.now()}`;
    addProp({ id, name: `Prop ${props.length + 1}`, width: 1, height: 1, tags: ['decor'], walkable: false, interactable: false });
    setActiveProp(id);
  };

  const row = (active: boolean): CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '3px 6px', marginBottom: 2, fontSize: 12, cursor: 'pointer', borderRadius: 3,
    background: active ? 'color-mix(in srgb, var(--wf-accent) 20%, transparent)' : 'var(--wf-bg-control)',
    border: `1px solid ${active ? 'var(--wf-accent)' : 'var(--wf-border-default)'}`,
    color: 'var(--wf-text-primary)',
  });
  const addBtn: CSSProperties = { ...buttonBase, padding: '2px 6px', fontSize: 11, borderRadius: 3, marginTop: 2 };

  return (
    <div style={{ marginTop: 12 }} data-testid="wf-prop-palette">
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>Props</div>
      {props.length === 0 && (
        <EmptyState
          title="No props yet"
          description="Create a prop definition, then click the canvas to place it."
          icon={'\u25A2'}
          actions={[{ label: '+ New prop', onClick: createProp }]}
        />
      )}
      {props.map((p) => {
        const count = placements.filter((pl) => pl.propId === p.id).length;
        const expanded = expandedId === p.id;
        return (
          <div key={p.id}>
            <div style={row(p.id === activeId)} onClick={() => setActiveProp(p.id)}>
              <span style={{ display: 'block', flexShrink: 0, ...propSwatch(p, 20) }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
              <span style={{ color: 'var(--wf-text-muted)' }}>({count})</span>
              <button
                type="button"
                data-testid="wf-prop-expand"
                style={{ ...buttonBase, padding: '0 6px', fontSize: 11 }}
                onClick={(e) => { e.stopPropagation(); setExpandedId(expanded ? null : p.id); }}
              >{expanded ? 'hide' : 'edit'}</button>
            </div>
            {expanded && (
              <div style={{ padding: '4px 6px 8px', marginBottom: 4, background: 'var(--wf-bg-app)', border: '1px solid var(--wf-border-default)', borderRadius: 3 }}
                onClick={(e) => e.stopPropagation()}>
                <label style={labelStyle}>Name
                  <input style={inputStyle} data-testid="wf-prop-name" value={p.name}
                    onChange={(e) => updateProp(p.id, { name: e.target.value })} />
                </label>
                <label style={labelStyle}>Image path
                  <input style={inputStyle} data-testid="wf-prop-image" value={p.imagePath ?? ''}
                    onChange={(e) => updateProp(p.id, { imagePath: e.target.value || undefined })} />
                </label>
                <label style={labelStyle}>Width
                  <input style={inputStyle} data-testid="wf-prop-width" type="number" value={p.width}
                    onChange={(e) => updateProp(p.id, { width: Number(e.target.value) || 1 })} />
                </label>
                <label style={labelStyle}>Height
                  <input style={inputStyle} data-testid="wf-prop-height" type="number" value={p.height}
                    onChange={(e) => updateProp(p.id, { height: Number(e.target.value) || 1 })} />
                </label>
                <label style={labelStyle}>Tags
                  <input style={inputStyle} data-testid="wf-prop-tags" value={p.tags.join(', ')}
                    onChange={(e) => updateProp(p.id, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                </label>
                <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" data-testid="wf-prop-walkable" checked={p.walkable}
                    onChange={(e) => updateProp(p.id, { walkable: e.target.checked })} /> Walkable
                </label>
                <label style={{ ...labelStyle, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" data-testid="wf-prop-interactable" checked={p.interactable}
                    onChange={(e) => updateProp(p.id, { interactable: e.target.checked })} /> Interactable
                </label>
              </div>
            )}
          </div>
        );
      })}
      <button style={addBtn} onClick={createProp}>+ New prop</button>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--wf-text-muted)' }}>Click the canvas to place the active prop.</div>
    </div>
  );
}
