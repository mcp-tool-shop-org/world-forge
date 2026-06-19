import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { buttonBase } from '../ui/styles.js';
import type { PropDefinition } from '@world-forge/schema';

/** Swatch background for a prop — its image when set, else a color by behavior. */
function propSwatch(def: PropDefinition, size: number): CSSProperties {
  if (def.imagePath) {
    return { width: size, height: size, backgroundImage: `url("${def.imagePath}")`, backgroundSize: 'cover', imageRendering: 'pixelated' };
  }
  const bg = def.interactable ? 'rgba(210,153,34,0.7)' : (!def.walkable ? 'rgba(110,118,129,0.7)' : 'rgba(63,185,80,0.55)');
  return { width: size, height: size, background: bg };
}

/**
 * Prop Palette — pick the active prop definition for the prop-place tool, or
 * create one. Self-gating: renders only while the prop-place tool is active.
 * Click the canvas to place the active prop; placement count shows on each row.
 */
export function PropPalette() {
  const { project, addProp } = useProjectStore();
  const { activeTool, activePropId, setActiveProp } = useEditorStore();

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
    background: active ? 'rgba(31,111,235,0.2)' : '#21262d',
    border: `1px solid ${active ? '#1f6feb' : '#30363d'}`,
    color: active ? '#fff' : '#c9d1d9',
  });
  const addBtn: CSSProperties = { ...buttonBase, padding: '2px 6px', fontSize: 11, borderRadius: 3, marginTop: 2 };

  return (
    <div style={{ marginTop: 12 }} data-testid="wf-prop-palette">
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Props</div>
      {props.length === 0 && <div style={{ fontSize: 11, color: '#6e7681', marginBottom: 4 }}>No props yet — create one to place.</div>}
      {props.map((p) => {
        const count = placements.filter((pl) => pl.propId === p.id).length;
        return (
          <div key={p.id} style={row(p.id === activeId)} onClick={() => setActiveProp(p.id)}>
            <span style={{ display: 'block', flexShrink: 0, ...propSwatch(p, 20) }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            <span style={{ color: '#6e7681' }}>({count})</span>
          </div>
        );
      })}
      <button style={addBtn} onClick={createProp}>+ New prop</button>
      <div style={{ marginTop: 6, fontSize: 10, color: '#6e7681' }}>Click the canvas to place the active prop.</div>
    </div>
  );
}
