import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { frameBounds } from '../viewport.js';
import { getCanvasSize } from '../frame-helpers.js';
import { inputStyle as sharedInputStyle, ConfirmButton } from './shared.js';
import { inputCompact } from '../ui/styles.js';
import type { DistrictMetrics } from '@world-forge/schema';

export function DistrictPanel() {
  const {
    project, addDistrict, updateDistrict, removeDistrict, updateZone,
    addFaction, updateFaction, removeFaction,
    addPressureHotspot, updatePressureHotspot, removePressureHotspot,
  } = useProjectStore();
  const { selection, setSelection, setViewport } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleCreate = () => {
    const id = `district-${Date.now()}`;
    addDistrict({
      id,
      name: `District ${project.districts.length + 1}`,
      zoneIds: [],
      tags: [],
      baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    });
  };

  const selectedZoneIds = selection.zones;
  const tileSize = project.map.tileSize;

  const handleFrameDistrict = (districtId: string) => {
    const district = project.districts.find((d) => d.id === districtId);
    if (!district || district.zoneIds.length === 0) return;
    setSelection({ zones: district.zoneIds, entities: [], landmarks: [], spawns: [], encounters: [] });
    const items = district.zoneIds.map((zid) => project.zones.find((z) => z.id === zid)).filter(Boolean) as Array<{ gridX: number; gridY: number; gridWidth: number; gridHeight: number }>;
    if (items.length === 0) return;
    const size = getCanvasSize();
    if (!size) return;
    const vp = frameBounds(items, tileSize, size.cw, size.ch);
    if (vp) setViewport(vp);
  };

  const handleAssignZone = (districtId: string) => {
    if (selectedZoneIds.length === 0) return;
    const district = project.districts.find((d) => d.id === districtId);
    if (!district) return;
    for (const zid of selectedZoneIds) {
      if (!district.zoneIds.includes(zid)) {
        updateDistrict(districtId, { zoneIds: [...district.zoneIds, ...selectedZoneIds.filter((z) => !district.zoneIds.includes(z))] });
      }
      updateZone(zid, { parentDistrictId: districtId });
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Districts</div>
      {project.districts.map((d) => {
        const isExpanded = expanded === d.id;
        const factions = project.factionPresences.filter((f) => f.districtIds.includes(d.id));
        const hotspots = project.pressureHotspots.filter((h) => d.zoneIds.includes(h.zoneId));

        return (
          <div key={d.id} style={{ marginBottom: 6, padding: 4, background: '#161b22', borderRadius: 3, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ cursor: 'pointer', color: '#8b949e', fontSize: 10 }}
                onClick={() => setExpanded(isExpanded ? null : d.id)}>
                {isExpanded ? '\u25BC' : '\u25B6'}
              </span>
              <input
                style={{ background: 'transparent', border: 'none', color: '#c9d1d9', fontSize: 12, flex: 1 }}
                value={d.name}
                onChange={(e) => updateDistrict(d.id, { name: e.target.value })}
              />
            </div>
            <div
              style={{ fontSize: 10, color: d.zoneIds.length > 0 ? '#58a6ff' : '#8b949e', cursor: d.zoneIds.length > 0 ? 'pointer' : 'default', paddingLeft: 14 }}
              onClick={() => d.zoneIds.length > 0 && handleFrameDistrict(d.id)}
            >
              {d.zoneIds.length} zones{factions.length > 0 ? ` · ${factions.length} factions` : ''}{hotspots.length > 0 ? ` · ${hotspots.length} hotspots` : ''}
            </div>
            {selectedZoneIds.length > 0 && (
              <button onClick={() => handleAssignZone(d.id)}
                style={{ fontSize: 10, background: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: 2, cursor: 'pointer', padding: '1px 4px', marginTop: 2 }}>
                + Assign {selectedZoneIds.length === 1 ? 'selected zone' : `${selectedZoneIds.length} zones`}
              </button>
            )}

            {isExpanded && (
              <div style={{ marginTop: 6, paddingLeft: 4 }}>
                {/* Metrics */}
                <div style={sectionLabel}>Metrics</div>
                {(['commerce', 'morale', 'safety', 'stability'] as (keyof DistrictMetrics)[]).map((k) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginBottom: 2 }}>
                    <span style={{ width: 52, color: '#8b949e' }}>{k}</span>
                    <input type="range" min={0} max={100} value={d.baseMetrics[k]}
                      style={{ flex: 1 }}
                      onChange={(e) => updateDistrict(d.id, { baseMetrics: { ...d.baseMetrics, [k]: parseInt(e.target.value) } })} />
                    <span style={{ width: 24, color: '#c9d1d9', fontSize: 10, textAlign: 'right' }}>{d.baseMetrics[k]}</span>
                  </label>
                ))}

                {/* Tags */}
                <div style={sectionLabel}>Tags</div>
                <input style={inputStyle} value={d.tags.join(', ')} placeholder="comma-separated"
                  onChange={(e) => updateDistrict(d.id, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />

                {/* Controlling Faction */}
                <div style={sectionLabel}>Controlling Faction</div>
                <input style={inputStyle} value={d.controllingFaction ?? ''} placeholder="faction ID"
                  onChange={(e) => updateDistrict(d.id, { controllingFaction: e.target.value || undefined })} />

                {/* Economy Profile */}
                <div style={sectionLabel}>Economy — Supply Categories</div>
                <input style={inputStyle} value={d.economyProfile.supplyCategories.join(', ')} placeholder="e.g. weapons, potions"
                  onChange={(e) => updateDistrict(d.id, { economyProfile: { ...d.economyProfile, supplyCategories: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) } })} />
                <div style={sectionLabel}>Economy — Scarcity Defaults</div>
                <textarea style={{ ...inputStyle, minHeight: 40, resize: 'vertical' }}
                  value={Object.entries(d.economyProfile.scarcityDefaults).map(([k, v]) => `${k}=${v}`).join('\n')}
                  placeholder="key=value per line"
                  onChange={(e) => {
                    const obj: Record<string, number> = {};
                    for (const line of e.target.value.split('\n')) {
                      const [k, v] = line.split('=');
                      if (k?.trim() && v?.trim()) obj[k.trim()] = parseFloat(v.trim()) || 0;
                    }
                    updateDistrict(d.id, { economyProfile: { ...d.economyProfile, scarcityDefaults: obj } });
                  }} />

                {/* Faction Presences */}
                <div style={sectionLabel}>Faction Presences</div>
                {factions.map((f) => (
                  <div key={f.factionId} style={{ padding: 3, background: '#0d1117', borderRadius: 2, marginBottom: 3 }}>
                    <div style={{ fontSize: 11, color: '#c9d1d9' }}>{f.factionId}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginTop: 2 }}>
                      <span style={{ color: '#8b949e', width: 50 }}>influence</span>
                      <input type="range" min={0} max={100} value={f.influence} style={{ flex: 1 }}
                        onChange={(e) => updateFaction(f.factionId, { influence: parseInt(e.target.value) })} />
                      <span style={{ width: 20, color: '#c9d1d9' }}>{f.influence}</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginTop: 1 }}>
                      <span style={{ color: '#8b949e', width: 50 }}>alert</span>
                      <input type="range" min={0} max={100} value={f.alertLevel} style={{ flex: 1 }}
                        onChange={(e) => updateFaction(f.factionId, { alertLevel: parseInt(e.target.value) })} />
                      <span style={{ width: 20, color: '#c9d1d9' }}>{f.alertLevel}</span>
                    </label>
                    <button style={{ ...smallBtn, color: '#f85149' }}
                      onClick={() => removeFaction(f.factionId)}>remove</button>
                  </div>
                ))}
                <button style={smallBtn} onClick={() => {
                  addFaction({
                    factionId: `faction-${Date.now()}`,
                    districtIds: [d.id],
                    influence: 50,
                    alertLevel: 0,
                  });
                }}>+ Faction</button>

                {/* Pressure Hotspots */}
                <div style={sectionLabel}>Pressure Hotspots</div>
                {hotspots.map((h) => (
                  <div key={h.id} style={{ padding: 3, background: '#0d1117', borderRadius: 2, marginBottom: 3 }}>
                    <div style={{ fontSize: 11, color: '#c9d1d9' }}>{h.id}</div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginTop: 2 }}>
                      <span style={{ color: '#8b949e', width: 50 }}>type</span>
                      <input style={{ ...inputStyle, marginTop: 0, fontSize: 10 }} value={h.pressureType}
                        onChange={(e) => updatePressureHotspot(h.id, { pressureType: e.target.value })} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginTop: 1 }}>
                      <span style={{ color: '#8b949e', width: 50 }}>prob</span>
                      <input style={{ ...inputStyle, marginTop: 0, fontSize: 10 }} type="number" min={0} max={1} step={0.05} value={h.baseProbability}
                        onChange={(e) => updatePressureHotspot(h.id, { baseProbability: parseFloat(e.target.value) || 0 })} />
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, marginTop: 1 }}>
                      <span style={{ color: '#8b949e', width: 50 }}>tags</span>
                      <input style={{ ...inputStyle, marginTop: 0, fontSize: 10 }} value={h.tags.join(', ')}
                        onChange={(e) => updatePressureHotspot(h.id, { tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
                    </label>
                    <button style={{ ...smallBtn, color: '#f85149' }}
                      onClick={() => removePressureHotspot(h.id)}>remove</button>
                  </div>
                ))}
                {d.zoneIds.length > 0 && (
                  <button style={smallBtn} onClick={() => {
                    addPressureHotspot({
                      id: `hotspot-${Date.now()}`,
                      zoneId: d.zoneIds[0],
                      pressureType: 'generic',
                      baseProbability: 0.5,
                      tags: [],
                    });
                  }}>+ Hotspot</button>
                )}

                {/* Delete District */}
                <ConfirmButton label="Delete District" onConfirm={() => { removeDistrict(d.id); if (expanded === d.id) setExpanded(null); }}
                  style={{ fontSize: 10, padding: '3px 8px', marginTop: 8, width: 'auto' }} />
              </div>
            )}
          </div>
        );
      })}
      <button onClick={handleCreate}
        style={{ fontSize: 11, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 3, cursor: 'pointer', padding: '3px 8px', width: '100%' }}>
        + Add District
      </button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = { fontSize: 10, color: '#8b949e', marginTop: 6, marginBottom: 2 };
const inputStyle: React.CSSProperties = {
  ...inputCompact, fontSize: 11, padding: '2px 5px',
};
const smallBtn: React.CSSProperties = {
  fontSize: 10, background: 'transparent', color: '#58a6ff', border: 'none',
  cursor: 'pointer', padding: '2px 0', marginTop: 2,
};
