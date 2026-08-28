import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { PanelHeader, EmptyState, useFocusHighlight } from './shared.js';
import { buttonBase } from '../ui/styles.js';

const card: CSSProperties = { border: '1px solid var(--wf-border-default)', borderRadius: 4, padding: 6, marginBottom: 6, background: 'var(--wf-bg-panel)' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: 'var(--wf-bg-app)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const section: CSSProperties = { fontSize: 11, color: 'var(--wf-text-muted)', margin: '10px 0 4px' };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };
const csv = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);
const numInp = (v: number, on: (n: number) => void) => (
  <input style={inp} type="number" value={v} onChange={(e) => on(Number(e.target.value) || 0)} />
);

/**
 * TownStructuresPanel — edit the selected zone's placed town structures:
 * buildings, hubs, and strongholds. Rendered in the Map tab under EconomyPanel
 * when a single zone is selected; null otherwise. Sibling of EconomyPanel —
 * structures change independently of the market/crafting economy fields.
 */
export function TownStructuresPanel() {
  const {
    project,
    addBuilding, updateBuilding, removeBuilding,
    addHub, updateHub, removeHub,
    addStronghold, updateStronghold, removeStronghold,
  } = useProjectStore();
  const { selection } = useEditorStore();
  const zoneId = getSelectedZoneId(selection);
  const focusRef = useFocusHighlight('town');
  if (!zoneId) return null;

  const zone = project.zones.find((z) => z.id === zoneId);
  const ox = zone?.gridX ?? 0;
  const oy = zone?.gridY ?? 0;

  const buildings = (project.buildings ?? []).filter((b) => b.zoneId === zoneId);
  const hubs = (project.hubs ?? []).filter((h) => h.zoneId === zoneId);
  const strongholds = (project.strongholds ?? []).filter((s) => s.zoneId === zoneId);

  return (
    <div ref={focusRef} style={{ marginTop: 12 }} data-testid="wf-town-structures-panel">
      <PanelHeader title="Town Structures" />

      <div style={{ ...section, marginTop: 0 }}>Buildings ({buildings.length})</div>
      {buildings.length === 0 && hubs.length === 0 && strongholds.length === 0 && (
        <EmptyState
          title="No town structures"
          description="Add a building, hub, or stronghold to furnish this zone."
          icon={'\u25A8'}
        />
      )}
      {buildings.map((b) => (
        <div key={b.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{b.id}</span>
            <button title="Remove building" style={delBtn} onClick={() => removeBuilding(b.id)}>×</button>
          </div>
          <label style={lbl}>Name
            <input style={inp} value={b.name} onChange={(e) => updateBuilding(b.id, { name: e.target.value })} />
          </label>
          <label style={lbl}>Building type
            <input style={inp} value={b.buildingType} onChange={(e) => updateBuilding(b.id, { buildingType: e.target.value })} />
          </label>
          <div style={grid2}>
            <label style={lbl}>Grid X{numInp(b.gridX, (n) => updateBuilding(b.id, { gridX: n }))}</label>
            <label style={lbl}>Grid Y{numInp(b.gridY, (n) => updateBuilding(b.id, { gridY: n }))}</label>
            <label style={lbl}>Width{numInp(b.width, (n) => updateBuilding(b.id, { width: n }))}</label>
            <label style={lbl}>Height{numInp(b.height, (n) => updateBuilding(b.id, { height: n }))}</label>
          </div>
          <label style={lbl}>Interior zone id (enter target)
            <input style={inp} value={b.interiorZoneId ?? ''}
              onChange={(e) => updateBuilding(b.id, { interiorZoneId: e.target.value || undefined })} />
          </label>
          <label style={lbl}>Tags (comma-separated)
            <input style={inp} value={(b.tags ?? []).join(', ')}
              onChange={(e) => updateBuilding(b.id, { tags: csv(e.target.value) })} />
          </label>
        </div>
      ))}
      <button style={addBtn} onClick={() => addBuilding({ id: `building-${Date.now()}`, name: 'Building', buildingType: 'house', gridX: ox, gridY: oy, width: 2, height: 2, zoneId, tags: [] })}>+ Add building</button>

      <div style={section}>Hubs ({hubs.length})</div>
      {hubs.map((h) => (
        <div key={h.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{h.id}</span>
            <button title="Remove hub" style={delBtn} onClick={() => removeHub(h.id)}>×</button>
          </div>
          <label style={lbl}>Name
            <input style={inp} value={h.name} onChange={(e) => updateHub(h.id, { name: e.target.value })} />
          </label>
          <label style={lbl}>Hub type
            <input style={inp} value={h.hubType} onChange={(e) => updateHub(h.id, { hubType: e.target.value })} />
          </label>
          <label style={lbl}>Service types (comma-separated)
            <input style={inp} value={h.serviceTypes.join(', ')}
              onChange={(e) => updateHub(h.id, { serviceTypes: csv(e.target.value) })} />
          </label>
          <label style={lbl}>Connected zone ids (comma-separated)
            <input style={inp} value={h.connectedZoneIds.join(', ')}
              onChange={(e) => updateHub(h.id, { connectedZoneIds: csv(e.target.value) })} />
          </label>
          <label style={lbl}>Tags (comma-separated)
            <input style={inp} value={(h.tags ?? []).join(', ')}
              onChange={(e) => updateHub(h.id, { tags: csv(e.target.value) })} />
          </label>
        </div>
      ))}
      <button style={addBtn} onClick={() => addHub({ id: `hub-${Date.now()}`, name: 'Hub', zoneId, hubType: 'town-center', serviceTypes: [], connectedZoneIds: [], tags: [] })}>+ Add hub</button>

      <div style={section}>Strongholds ({strongholds.length})</div>
      {strongholds.map((s) => (
        <div key={s.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{s.id}</span>
            <button title="Remove stronghold" style={delBtn} onClick={() => removeStronghold(s.id)}>×</button>
          </div>
          <label style={lbl}>Name
            <input style={inp} value={s.name} onChange={(e) => updateStronghold(s.id, { name: e.target.value })} />
          </label>
          <label style={lbl}>Faction id
            <input style={inp} value={s.factionId ?? ''}
              onChange={(e) => updateStronghold(s.id, { factionId: e.target.value || undefined })} />
          </label>
          <label style={lbl}>Defense level
            <input style={inp} type="number" value={s.defenseLevel}
              onChange={(e) => updateStronghold(s.id, { defenseLevel: Number(e.target.value) || 0 })} />
          </label>
          <label style={lbl}>Garrison entity ids (comma-separated)
            <input style={inp} value={s.garrisonEntityIds.join(', ')}
              onChange={(e) => updateStronghold(s.id, { garrisonEntityIds: csv(e.target.value) })} />
          </label>
          <label style={lbl}>Tags (comma-separated)
            <input style={inp} value={(s.tags ?? []).join(', ')}
              onChange={(e) => updateStronghold(s.id, { tags: csv(e.target.value) })} />
          </label>
        </div>
      ))}
      <button style={addBtn} onClick={() => addStronghold({ id: `stronghold-${Date.now()}`, name: 'Stronghold', zoneId, defenseLevel: 1, garrisonEntityIds: [], tags: [] })}>+ Add stronghold</button>
    </div>
  );
}
