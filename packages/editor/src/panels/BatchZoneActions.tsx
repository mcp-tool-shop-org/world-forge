// @deprecated — superseded by SelectionActionsPanel.tsx in v2.3.0
// BatchZoneActions.tsx — batch operations when multiple zones are selected

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';

export function BatchZoneActions() {
  const { project, updateProject } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();
  const [tagInput, setTagInput] = useState('');

  const count = selection.zones.length;
  if (count < 2) return null;

  const handleAssignDistrict = (districtId: string) => {
    updateProject((p) => {
      const zones = p.zones.map((z) =>
        selection.zones.includes(z.id) ? { ...z, parentDistrictId: districtId } : z,
      );
      const districts = p.districts.map((d) => {
        if (d.id === districtId) {
          const merged = new Set([...d.zoneIds, ...selection.zones]);
          return { ...d, zoneIds: [...merged] };
        }
        // Remove these zones from other districts
        const filtered = d.zoneIds.filter((zid) => !selection.zones.includes(zid));
        return filtered.length !== d.zoneIds.length ? { ...d, zoneIds: filtered } : d;
      });
      return { ...p, zones, districts };
    });
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    updateProject((p) => ({
      ...p,
      zones: p.zones.map((z) =>
        selection.zones.includes(z.id) && !z.tags.includes(tag)
          ? { ...z, tags: [...z.tags, tag] }
          : z,
      ),
    }));
    setTagInput('');
  };

  const handleDeleteAll = () => {
    if (!confirm(`Delete ${count} zones? This cannot be undone.`)) return;
    updateProject((p) => {
      const ids = new Set(selection.zones);
      return {
        ...p,
        zones: p.zones.filter((z) => !ids.has(z.id)),
        connections: p.connections.filter((c) => !ids.has(c.fromZoneId) && !ids.has(c.toZoneId)),
        districts: p.districts.map((d) => ({
          ...d,
          zoneIds: d.zoneIds.filter((zid) => !ids.has(zid)),
        })),
        entityPlacements: p.entityPlacements.filter((e) => !ids.has(e.zoneId)),
        landmarks: p.landmarks.filter((l) => !ids.has(l.zoneId)),
        spawnPoints: p.spawnPoints.filter((s) => !ids.has(s.zoneId)),
      };
    });
    clearSelection();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 'bold' }}>{count} zones selected</span>
        <button onClick={clearSelection} style={smallBtn}>Deselect</button>
      </div>

      {/* District assignment */}
      {project.districts.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Assign district to all</div>
          <select
            value=""
            onChange={(e) => { if (e.target.value) handleAssignDistrict(e.target.value); }}
            style={selectStyle}
          >
            <option value="">Choose district...</option>
            {project.districts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Tag batch-add */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Add tag to all</div>
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
            placeholder="tag name"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={handleAddTag} style={smallBtn}>Add</button>
        </div>
      </div>

      {/* Delete all */}
      <button onClick={handleDeleteAll} style={{ ...smallBtn, color: '#f85149', borderColor: '#f8514966', width: '100%', marginTop: 4 }}>
        Delete {count} zones
      </button>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  fontSize: 10, background: '#21262d', color: '#58a6ff',
  border: '1px solid #30363d', borderRadius: 2, cursor: 'pointer', padding: '2px 6px',
};

const selectStyle: React.CSSProperties = {
  width: '100%', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 3, padding: '3px 4px', fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, padding: '3px 4px', fontSize: 12,
};
