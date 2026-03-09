import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { frameBounds } from '../viewport.js';
import { getCanvasSize } from '../frame-helpers.js';

export function DistrictPanel() {
  const { project, addDistrict, updateDistrict, updateZone } = useProjectStore();
  const { selection, setSelection, setViewport } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);

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
    // Select all zones in district
    setSelection({ zones: district.zoneIds, entities: [], landmarks: [], spawns: [] });
    // Frame them
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
      {project.districts.map((d) => (
        <div key={d.id} style={{ marginBottom: 6, padding: 4, background: '#161b22', borderRadius: 3, fontSize: 12 }}>
          <input
            style={{ background: 'transparent', border: 'none', color: '#c9d1d9', fontSize: 12, width: '100%' }}
            value={d.name}
            onChange={(e) => updateDistrict(d.id, { name: e.target.value })}
          />
          <div
            style={{ fontSize: 10, color: d.zoneIds.length > 0 ? '#58a6ff' : '#8b949e', cursor: d.zoneIds.length > 0 ? 'pointer' : 'default' }}
            onClick={() => d.zoneIds.length > 0 && handleFrameDistrict(d.id)}
          >
            {d.zoneIds.length} zones
          </div>
          {selectedZoneIds.length > 0 && (
            <button onClick={() => handleAssignZone(d.id)}
              style={{ fontSize: 10, background: '#21262d', color: '#58a6ff', border: '1px solid #30363d', borderRadius: 2, cursor: 'pointer', padding: '1px 4px', marginTop: 2 }}>
              + Assign {selectedZoneIds.length === 1 ? 'selected zone' : `${selectedZoneIds.length} zones`}
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
