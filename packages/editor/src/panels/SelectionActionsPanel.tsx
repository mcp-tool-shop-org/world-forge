// SelectionActionsPanel.tsx — align, distribute, and batch zone operations for multi-selection

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectionCount } from '../store/editor-store.js';
import type { AlignAxis, DistributeAxis } from '../layout.js';
import { buttonBase, buttonAccent, inputBase, selectBase } from '../ui/styles.js';

export function SelectionActionsPanel() {
  const { project, updateProject, alignSelected, distributeSelected } = useProjectStore();
  const { selection, clearSelection } = useEditorStore();
  const [tagInput, setTagInput] = useState('');

  const count = getSelectionCount(selection);
  if (count < 2) return null;

  const handleAlign = (axis: AlignAxis) => alignSelected(selection, axis);
  const handleDistribute = (axis: DistributeAxis) => distributeSelected(selection, axis);

  // --- Zone-specific batch ops (migrated from BatchZoneActions) ---
  const zoneCount = selection.zones.length;

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
    if (!confirm(`Delete ${zoneCount} zones? This cannot be undone.`)) return;
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 'bold' }}>
          {count} objects selected
        </span>
        <button onClick={clearSelection} style={smallBtn}>Deselect</button>
      </div>

      {/* Align */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Align</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
          <button onClick={() => handleAlign('left')} style={actionBtn} title="Align left edges">Left</button>
          <button onClick={() => handleAlign('center-h')} style={actionBtn} title="Align horizontal centers">Center H</button>
          <button onClick={() => handleAlign('right')} style={actionBtn} title="Align right edges">Right</button>
          <button onClick={() => handleAlign('top')} style={actionBtn} title="Align top edges">Top</button>
          <button onClick={() => handleAlign('center-v')} style={actionBtn} title="Align vertical centers">Center V</button>
          <button onClick={() => handleAlign('bottom')} style={actionBtn} title="Align bottom edges">Bottom</button>
        </div>
      </div>

      {/* Distribute */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Distribute</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          <button
            onClick={() => handleDistribute('horizontal')}
            style={{ ...actionBtn, ...(count < 3 ? disabledStyle : {}) }}
            disabled={count < 3}
            title="Distribute horizontally (3+ objects)"
          >
            Horizontal
          </button>
          <button
            onClick={() => handleDistribute('vertical')}
            style={{ ...actionBtn, ...(count < 3 ? disabledStyle : {}) }}
            disabled={count < 3}
            title="Distribute vertically (3+ objects)"
          >
            Vertical
          </button>
        </div>
      </div>

      {/* Zone-specific operations */}
      {zoneCount > 0 && (
        <>
          <div style={{ borderTop: '1px solid #30363d', marginTop: 8, paddingTop: 8 }}>
            <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
              Zone Operations ({zoneCount} zone{zoneCount > 1 ? 's' : ''})
            </div>
          </div>

          {/* District assignment */}
          {project.districts.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <select
                value=""
                onChange={(e) => { if (e.target.value) handleAssignDistrict(e.target.value); }}
                style={selectStyle}
              >
                <option value="">Assign district...</option>
                {project.districts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tag batch-add */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                placeholder="Add tag to zones"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button onClick={handleAddTag} style={smallBtn}>Add</button>
            </div>
          </div>

          {/* Delete all selected zones */}
          {zoneCount > 1 && (
            <button
              onClick={handleDeleteAll}
              style={{ ...smallBtn, color: '#f85149', borderColor: '#f8514966', width: '100%', marginTop: 4 }}
            >
              Delete {zoneCount} zones
            </button>
          )}
        </>
      )}
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  ...buttonAccent, fontSize: 10, padding: '2px 6px', borderRadius: 2,
};

const actionBtn: React.CSSProperties = {
  ...buttonBase, fontSize: 10, padding: '4px 2px', borderRadius: 2,
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.4, cursor: 'default',
};

const selectStyle: React.CSSProperties = {
  ...selectBase, padding: '3px 4px', fontSize: 12,
};

const inputStyle: React.CSSProperties = {
  ...inputBase, padding: '3px 4px', fontSize: 12, width: 'auto',
};
