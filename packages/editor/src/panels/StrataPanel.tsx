import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { PanelHeader } from './shared.js';
import { buttonBase } from '../ui/styles.js';

const card: CSSProperties = { border: '1px solid #30363d', borderRadius: 4, padding: 6, marginBottom: 6, background: '#161b22' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const section: CSSProperties = { fontSize: 11, color: '#8b949e', margin: '10px 0 4px' };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };

/**
 * StrataPanel — project-level editor for vertical strata + the connectors between
 * them. Rendered in the Map tab when no single zone is selected (strata are a
 * project-level world-structure concern, not zone-attached). Per-zone assignment
 * lives in ZoneProperties (the Stratum dropdown).
 */
export function StrataPanel() {
  const {
    project,
    addStratum, updateStratum, removeStratum,
    addStratumLink, updateStratumLink, removeStratumLink,
  } = useProjectStore();

  const strata = project.strata ?? [];
  const links = project.stratumLinks ?? [];
  const nextOrder = strata.length ? Math.max(...strata.map((s) => s.order)) + 1 : 0;

  return (
    <div style={{ marginTop: 12 }} data-testid="wf-strata-panel">
      <PanelHeader title="Strata" />

      <div style={{ ...section, marginTop: 0 }}>Vertical layers ({strata.length})</div>
      {strata.map((s) => (
        <div key={s.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: '#6e7681' }}>{s.id}</span>
            <button title="Remove stratum" style={delBtn} onClick={() => removeStratum(s.id)}>×</button>
          </div>
          <label style={lbl}>Name
            <input style={inp} value={s.name} onChange={(e) => updateStratum(s.id, { name: e.target.value })} />
          </label>
          <label style={lbl}>Order (signed: surface 0, under −1, sky +1)
            <input style={inp} type="number" value={s.order}
              onChange={(e) => updateStratum(s.id, { order: Number(e.target.value) || 0 })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={!!s.zRange}
              onChange={(e) => updateStratum(s.id, { zRange: e.target.checked ? { floor: 0, ceiling: 10 } : undefined })} />
            Metric z-range
          </label>
          {s.zRange && (
            <div style={grid2}>
              <label style={lbl}>Floor
                <input style={inp} type="number" value={s.zRange.floor}
                  onChange={(e) => updateStratum(s.id, { zRange: { floor: Number(e.target.value) || 0, ceiling: s.zRange!.ceiling } })} />
              </label>
              <label style={lbl}>Ceiling
                <input style={inp} type="number" value={s.zRange.ceiling}
                  onChange={(e) => updateStratum(s.id, { zRange: { floor: s.zRange!.floor, ceiling: Number(e.target.value) || 0 } })} />
              </label>
            </div>
          )}
        </div>
      ))}
      <button style={addBtn} onClick={() => addStratum({ id: `stratum-${Date.now()}`, name: 'Stratum', order: nextOrder, tags: [] })}>+ Add stratum</button>

      <div style={section}>Stratum links ({links.length})</div>
      {links.map((l) => (
        <div key={l.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: '#6e7681' }}>{l.id}</span>
            <button title="Remove link" style={delBtn} onClick={() => removeStratumLink(l.id)}>×</button>
          </div>
          <div style={grid2}>
            <label style={lbl}>From
              <select style={inp} value={l.fromStratumId} onChange={(e) => updateStratumLink(l.id, { fromStratumId: e.target.value })}>
                {strata.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label style={lbl}>To
              <select style={inp} value={l.toStratumId} onChange={(e) => updateStratumLink(l.id, { toStratumId: e.target.value })}>
                {strata.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          </div>
          <label style={lbl}>Link type
            <input style={inp} value={l.linkType} onChange={(e) => updateStratumLink(l.id, { linkType: e.target.value })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={l.bidirectional}
              onChange={(e) => updateStratumLink(l.id, { bidirectional: e.target.checked })} /> Bidirectional
          </label>
        </div>
      ))}
      <button style={addBtn} disabled={strata.length < 2}
        title={strata.length < 2 ? 'Add at least two strata to link them' : undefined}
        onClick={() => addStratumLink({ id: `slink-${Date.now()}`, fromStratumId: strata[0].id, toStratumId: strata[1].id, bidirectional: true, linkType: 'stairs' })}>
        + Add link
      </button>
    </div>
  );
}
