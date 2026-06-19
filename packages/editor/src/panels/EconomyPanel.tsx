import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { PanelHeader } from './shared.js';
import { buttonBase } from '../ui/styles.js';

const card: CSSProperties = { border: '1px solid #30363d', borderRadius: 4, padding: 6, marginBottom: 6, background: '#161b22' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const section: CSSProperties = { fontSize: 11, color: '#8b949e', margin: '10px 0 4px' };
const csv = (s: string): string[] => s.split(',').map((x) => x.trim()).filter(Boolean);

/**
 * EconomyPanel — edit the selected zone's market nodes + crafting stations
 * (zone-attached town economy). Rendered in the Map tab under ZoneProperties
 * when a single zone is selected; null otherwise.
 */
export function EconomyPanel() {
  const {
    project,
    addMarketNode, updateMarketNode, removeMarketNode,
    addCraftingStation, updateCraftingStation, removeCraftingStation,
  } = useProjectStore();
  const { selection } = useEditorStore();
  const zoneId = getSelectedZoneId(selection);
  if (!zoneId) return null;

  const markets = (project.marketNodes ?? []).filter((m) => m.zoneId === zoneId);
  const stations = (project.craftingStations ?? []).filter((c) => c.zoneId === zoneId);

  return (
    <div style={{ marginTop: 12 }} data-testid="wf-economy-panel">
      <PanelHeader title="Economy" />

      <div style={{ ...section, marginTop: 0 }}>Markets ({markets.length})</div>
      {markets.map((m) => (
        <div key={m.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: '#6e7681' }}>{m.id}</span>
            <button title="Remove market" style={delBtn} onClick={() => removeMarketNode(m.id)}>×</button>
          </div>
          <label style={lbl}>Supply categories (comma-separated)
            <input style={inp} value={m.supplyCategories.join(', ')}
              onChange={(e) => updateMarketNode(m.id, { supplyCategories: csv(e.target.value) })} />
          </label>
          <label style={lbl}>Price modifier
            <input style={inp} type="number" step="0.1" value={m.priceModifier}
              onChange={(e) => updateMarketNode(m.id, { priceModifier: Number(e.target.value) || 0 })} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={m.contrabandAvailable}
              onChange={(e) => updateMarketNode(m.id, { contrabandAvailable: e.target.checked })} /> Contraband available
          </label>
        </div>
      ))}
      <button style={addBtn} onClick={() => addMarketNode({ id: `market-${Date.now()}`, zoneId, supplyCategories: [], priceModifier: 1, contrabandAvailable: false })}>+ Add market</button>

      <div style={section}>Crafting Stations ({stations.length})</div>
      {stations.map((c) => (
        <div key={c.id} style={card}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: '#6e7681' }}>{c.id}</span>
            <button title="Remove station" style={delBtn} onClick={() => removeCraftingStation(c.id)}>×</button>
          </div>
          <label style={lbl}>Station type
            <input style={inp} value={c.stationType}
              onChange={(e) => updateCraftingStation(c.id, { stationType: e.target.value })} />
          </label>
          <label style={lbl}>Recipes (comma-separated)
            <input style={inp} value={c.availableRecipes.join(', ')}
              onChange={(e) => updateCraftingStation(c.id, { availableRecipes: csv(e.target.value) })} />
          </label>
        </div>
      ))}
      <button style={addBtn} onClick={() => addCraftingStation({ id: `craft-${Date.now()}`, zoneId, stationType: 'general', availableRecipes: [] })}>+ Add crafting station</button>
    </div>
  );
}
