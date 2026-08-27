import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { nextId } from '../ids.js';
import type { TransitionEntityType } from '@world-forge/schema';
import { PanelHeader, EmptyState, useFocusHighlight } from './shared.js';
import { buttonBase } from '../ui/styles.js';
import {
  TRANSITION_TYPES, defaultTransition, pickDefaultTargetZoneId,
  withAddedTransition, withUpdatedTransition, withRemovedTransition,
  parseCsv, emptyToUndef,
} from './item-loot-transition-helpers.js';

const card: CSSProperties = { border: '1px solid var(--wf-border-default)', borderRadius: 4, padding: 6, marginBottom: 6, background: 'var(--wf-bg-panel)' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: 'var(--wf-bg-app)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };

/**
 * TransitionProperties — zone-scoped TransitionEntity editor (elevator/warp/
 * transporter/cargo-lift/stairwell). Composed as a sibling of EconomyPanel
 * because App.tsx is editor-core. Mutates via updateProject.
 */
export function TransitionProperties() {
  const { project, updateProject } = useProjectStore();
  const { selection } = useEditorStore();
  const zoneId = getSelectedZoneId(selection);
  const focusRef = useFocusHighlight('transitions');
  if (!zoneId) return null;

  const transitions = (project.transitions ?? []).filter((t) => t.zoneId === zoneId);
  const zone = project.zones.find((z) => z.id === zoneId);
  const ox = zone?.gridX ?? 0;
  const oy = zone?.gridY ?? 0;

  const add = () => {
    const target = pickDefaultTargetZoneId(zoneId, project.zones.map((z) => z.id));
    updateProject((p) => withAddedTransition(p, {
      ...defaultTransition(nextId('tr'), zoneId, target),
      gridX: ox, gridY: oy,
    }), 'Add transition');
  };
  const patch = (id: string, updates: Parameters<typeof withUpdatedTransition>[2]) =>
    updateProject((p) => withUpdatedTransition(p, id, updates), 'Update transition');
  const remove = (id: string) => updateProject((p) => withRemovedTransition(p, id), 'Delete transition');

  return (
    <div ref={focusRef} style={{ marginTop: 12 }} data-testid="wf-transition-properties">
      <PanelHeader title="Transitions" badge={transitions.length} />
      {transitions.length === 0 && (
        <EmptyState
          title="No transitions"
          description="Add an elevator, warp, transporter, cargo lift, or stairwell targeting another zone."
          icon={'\u2195'}
        />
      )}
      {transitions.map((t) => (
        <div key={t.id} style={card} data-testid={`wf-transition-card-${t.id}`}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{t.id}</span>
            <button title="Remove transition" style={delBtn} onClick={() => remove(t.id)}>×</button>
          </div>
          <label style={lbl}>Type
            <select style={inp} value={t.type} data-testid="wf-transition-type"
              onChange={(e) => patch(t.id, { type: e.target.value as TransitionEntityType })}>
              {TRANSITION_TYPES.map((ty) => <option key={ty} value={ty}>{ty}</option>)}
            </select>
          </label>
          <label style={lbl}>Target zone
            <select style={inp} value={t.targetZoneId}
              onChange={(e) => patch(t.id, { targetZoneId: e.target.value })}>
              {project.zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </label>
          <div style={grid2}>
            <label style={lbl}>Grid X
              <input style={inp} type="number" value={t.gridX ?? ox}
                onChange={(e) => patch(t.id, { gridX: Number(e.target.value) || 0 })} />
            </label>
            <label style={lbl}>Grid Y
              <input style={inp} type="number" value={t.gridY ?? oy}
                onChange={(e) => patch(t.id, { gridY: Number(e.target.value) || 0 })} />
            </label>
          </div>
          <label style={lbl}>Label
            <input style={inp} value={t.label ?? ''} onChange={(e) => patch(t.id, { label: emptyToUndef(e.target.value) })} />
          </label>
          <label style={lbl}>Animation
            <input style={inp} value={t.animation ?? ''} onChange={(e) => patch(t.id, { animation: emptyToUndef(e.target.value) })} />
          </label>
          <label style={lbl}>Duration (seconds)
            <input style={inp} type="number" min={0} step={0.1} value={t.durationSeconds ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                patch(t.id, { durationSeconds: raw === '' ? undefined : Number(raw) });
              }} />
          </label>
          <label style={lbl}>Tags (comma-separated)
            <input style={inp} value={(t.tags ?? []).join(', ')}
              onChange={(e) => patch(t.id, { tags: parseCsv(e.target.value) })} />
          </label>
        </div>
      ))}
      <button style={addBtn} data-testid="wf-add-transition" onClick={add}>+ Add transition</button>
    </div>
  );
}
