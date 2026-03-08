import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';

export function DistrictPanel() {
  const { project, addDistrict, updateDistrict, updateZone } = useProjectStore();
  const { selectedZoneId } = useEditorStore();

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

  const handleAssignZone = (districtId: string) => {
    if (!selectedZoneId) return;
    const district = project.districts.find((d) => d.id === districtId);
    if (!district) return;
    if (!district.zoneIds.includes(selectedZoneId)) {
      updateDistrict(districtId, { zoneIds: [...district.zoneIds, selectedZoneId] });
    }
    updateZone(selectedZoneId, { parentDistrictId: districtId });
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Districts</div>
      {project.districts.map((d) => (
        <div key={d.id} style={{ marginBottom: 6, padding: 4, background: '#161b22', borderRadius: 3, fontSize: 12 }}>
          <input
            style={{ background: 'transparent', border: 'none', color: '#c9d1d9', fontSize: 12, width: '100%' }}
            value={d.name}
            onChange={(e) => updateDistrict(d.id, { name: e.target.value })}
          />
          <div style={{ fontSize: 10, color: '#8b949e' }}>{d.zoneIds.length} zones</div>
          {selectedZoneId && (
            <button onClick={() => handleAssignZone(d.id)}
              style={{ fontSize: 10, background: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: 2, cursor: 'pointer', padding: '1px 4px', marginTop: 2 }}>
              + Assign selected zone
            </button>
          )}
        </div>
      ))}
      <button onClick={handleCreate}
        style={{ fontSize: 11, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 3, cursor: 'pointer', padding: '3px 8px', width: '100%' }}>
        + New District
      </button>
    </div>
  );
}
