import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { PanelHeader } from './shared.js';
import { buttonBase } from '../ui/styles.js';
import type { HazardEffect } from '@world-forge/schema';

const card: CSSProperties = { border: '1px solid #30363d', borderRadius: 4, padding: 6, marginBottom: 6, background: '#161b22' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const section: CSSProperties = { fontSize: 11, color: '#8b949e', margin: '10px 0 4px' };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };
const effectCard: CSSProperties = { border: '1px solid #30363d', borderRadius: 3, padding: 5, marginBottom: 4, background: '#0d1117' };

/** A fresh effect of the given kind, used when adding an effect or switching kinds. */
function defaultEffect(kind: HazardEffect['kind']): HazardEffect {
  switch (kind) {
    case 'damage': return { kind: 'damage', amount: 5, tickOn: 'turn-end' };
    case 'status': return { kind: 'status', statusId: 'poison', chance: 0.5, stacking: 'refresh' };
    case 'instakill': return { kind: 'instakill' };
    case 'ignite': return { kind: 'ignite', igniteChance: 0.3 };
  }
}

/**
 * HazardLibraryPanel — project-level editor for typed HazardDefinitions, including
 * their effects union. Rendered in the Map tab when no single zone is selected.
 * Zones opt into hazards via the Hazards checklist in ZoneProperties.
 */
export function HazardLibraryPanel() {
  const { project, addHazardDefinition, updateHazardDefinition, removeHazardDefinition } = useProjectStore();
  const hazards = project.hazardDefinitions ?? [];

  // Immutably replace effect i on a hazard, then persist.
  const setEffects = (hid: string, effects: HazardEffect[]) => updateHazardDefinition(hid, { effects });

  return (
    <div style={{ marginTop: 12 }} data-testid="wf-hazard-library-panel">
      <PanelHeader title="Hazard Library" />
      <div style={{ ...section, marginTop: 0 }}>Hazards ({hazards.length})</div>

      {hazards.map((h) => (
        <div key={h.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: '#6e7681' }}>{h.id}</span>
            <button title="Remove hazard" style={delBtn} onClick={() => removeHazardDefinition(h.id)}>×</button>
          </div>
          <label style={lbl}>Name
            <input style={inp} value={h.name} onChange={(e) => updateHazardDefinition(h.id, { name: e.target.value })} />
          </label>
          <div style={grid2}>
            <label style={lbl}>Trigger
              <select style={inp} value={h.trigger} onChange={(e) => updateHazardDefinition(h.id, { trigger: e.target.value as typeof h.trigger })}>
                <option value="on-enter">on-enter</option>
                <option value="per-turn">per-turn</option>
                <option value="on-exit">on-exit</option>
                <option value="timed">timed</option>
              </select>
            </label>
            <label style={lbl}>Passable
              <select style={inp} value={h.passable ?? ''} onChange={(e) => updateHazardDefinition(h.id, { passable: (e.target.value || undefined) as typeof h.passable })}>
                <option value="">— default —</option>
                <option value="yes">yes</option>
                <option value="flying-only">flying-only</option>
                <option value="never">never</option>
              </select>
            </label>
          </div>
          <div style={grid2}>
            <label style={lbl}>Move cost delta
              <input style={inp} type="number" value={h.moveCostDelta ?? 0}
                onChange={(e) => updateHazardDefinition(h.id, { moveCostDelta: Number(e.target.value) || 0 })} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 18 }}>
              <input type="checkbox" checked={!!h.blocksVision}
                onChange={(e) => updateHazardDefinition(h.id, { blocksVision: e.target.checked })} /> Blocks vision
            </label>
          </div>

          <div style={{ fontSize: 11, color: '#8b949e', margin: '6px 0 3px' }}>Effects ({h.effects.length})</div>
          {h.effects.map((eff, i) => (
            <div key={i} style={effectCard}>
              <div style={rowHead}>
                <select style={{ ...inp, width: 'auto', marginTop: 0 }} value={eff.kind}
                  onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? defaultEffect(e.target.value as HazardEffect['kind']) : x))}>
                  <option value="damage">damage</option>
                  <option value="status">status</option>
                  <option value="instakill">instakill</option>
                  <option value="ignite">ignite</option>
                </select>
                <button title="Remove effect" style={delBtn} onClick={() => setEffects(h.id, h.effects.filter((_, xi) => xi !== i))}>×</button>
              </div>
              {eff.kind === 'damage' && (
                <div style={grid2}>
                  <label style={lbl}>Amount
                    <input style={inp} type="number" value={eff.amount}
                      onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? { ...eff, amount: Number(e.target.value) || 0 } : x))} />
                  </label>
                  <label style={lbl}>Tick on
                    <select style={inp} value={eff.tickOn}
                      onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? { ...eff, tickOn: e.target.value as 'turn-start' | 'turn-end' } : x))}>
                      <option value="turn-start">turn-start</option>
                      <option value="turn-end">turn-end</option>
                    </select>
                  </label>
                </div>
              )}
              {eff.kind === 'status' && (
                <>
                  <label style={lbl}>Status id
                    <input style={inp} value={eff.statusId}
                      onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? { ...eff, statusId: e.target.value } : x))} />
                  </label>
                  <div style={grid2}>
                    <label style={lbl}>Chance (0–1)
                      <input style={inp} type="number" step="0.05" value={eff.chance}
                        onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? { ...eff, chance: Number(e.target.value) || 0 } : x))} />
                    </label>
                    <label style={lbl}>Stacking
                      <select style={inp} value={eff.stacking}
                        onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? { ...eff, stacking: e.target.value as 'refresh' | 'stack' | 'ignore' } : x))}>
                        <option value="refresh">refresh</option>
                        <option value="stack">stack</option>
                        <option value="ignore">ignore</option>
                      </select>
                    </label>
                  </div>
                </>
              )}
              {eff.kind === 'ignite' && (
                <label style={lbl}>Ignite chance (0–1)
                  <input style={inp} type="number" step="0.05" value={eff.igniteChance}
                    onChange={(e) => setEffects(h.id, h.effects.map((x, xi) => xi === i ? { ...eff, igniteChance: Number(e.target.value) || 0 } : x))} />
                </label>
              )}
              {eff.kind === 'instakill' && <div style={{ fontSize: 11, color: '#6e7681' }}>Instantly defeats the occupant.</div>}
            </div>
          ))}
          <button style={addBtn} onClick={() => setEffects(h.id, [...h.effects, defaultEffect('damage')])}>+ Add effect</button>
        </div>
      ))}

      <button style={addBtn} onClick={() => addHazardDefinition({ id: `hazard-${Date.now()}`, name: 'Hazard', effects: [defaultEffect('damage')], trigger: 'on-enter', tags: [] })}>+ Add hazard</button>
    </div>
  );
}
