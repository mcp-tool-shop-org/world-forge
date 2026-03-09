// ObjectListPanel.tsx — hierarchical object browser (districts → zones → entities/landmarks/spawns)

import { useState, useEffect, useRef, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, isSelected as isSel } from '../store/editor-store.js';
import { computeFrameViewport, getCanvasSize } from '../frame-helpers.js';
import { frameBounds } from '../viewport.js';

interface DistrictGroup {
  districtId: string | null; // null = "Unassigned"
  districtName: string;
  zoneIds: string[];
}

export function ObjectListPanel() {
  const { project } = useProjectStore();
  const {
    selection, selectZone, selectEntity, selectLandmark, selectSpawn,
    setSelection, setViewport, setRightTab,
  } = useEditorStore();

  const [filter, setFilter] = useState('');
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(() => new Set(['__unassigned__']));
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // Group zones by district
  const groups = useMemo((): DistrictGroup[] => {
    const assigned = new Set<string>();
    const result: DistrictGroup[] = [];

    for (const d of project.districts) {
      const zoneIds = d.zoneIds.filter((zid) => project.zones.some((z) => z.id === zid));
      for (const zid of zoneIds) assigned.add(zid);
      result.push({ districtId: d.id, districtName: d.name, zoneIds });
    }

    const unassigned = project.zones.filter((z) => !assigned.has(z.id)).map((z) => z.id);
    if (unassigned.length > 0) {
      result.push({ districtId: null, districtName: 'Unassigned', zoneIds: unassigned });
    }

    return result;
  }, [project]);

  const q = filter.toLowerCase();

  const toggleDistrict = (key: string) => {
    setExpandedDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleZone = (id: string) => {
    setExpandedZones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectZone = (id: string) => {
    selectZone(id, false);
    const size = getCanvasSize();
    if (size) {
      const vp = computeFrameViewport({ type: 'zone', id }, project, size.cw, size.ch);
      if (vp) setViewport(vp);
    }
  };

  const handleSelectEntity = (id: string) => {
    selectEntity(id, false);
    const size = getCanvasSize();
    if (size) {
      const vp = computeFrameViewport({ type: 'entity', id }, project, size.cw, size.ch);
      if (vp) setViewport(vp);
    }
  };

  const handleSelectLandmark = (id: string) => {
    selectLandmark(id, false);
    const size = getCanvasSize();
    if (size) {
      const vp = computeFrameViewport({ type: 'landmark', id }, project, size.cw, size.ch);
      if (vp) setViewport(vp);
    }
  };

  const handleSelectSpawn = (id: string) => {
    selectSpawn(id, false);
    const size = getCanvasSize();
    if (size) {
      const vp = computeFrameViewport({ type: 'spawn', id }, project, size.cw, size.ch);
      if (vp) setViewport(vp);
    }
  };

  const handleSelectDistrict = (districtId: string) => {
    const district = project.districts.find((d) => d.id === districtId);
    if (!district || district.zoneIds.length === 0) return;
    setSelection({ zones: district.zoneIds, entities: [], landmarks: [], spawns: [] });
    const size = getCanvasSize();
    if (size) {
      const items = district.zoneIds
        .map((zid) => project.zones.find((z) => z.id === zid))
        .filter(Boolean) as Array<{ gridX: number; gridY: number; gridWidth: number; gridHeight: number }>;
      const vp = frameBounds(items, project.map.tileSize, size.cw, size.ch);
      if (vp) setViewport(vp);
    }
  };

  // Auto-scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector('[data-selected="true"]');
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  }, [selection]);

  const matchesFilter = (name: string, id: string) => {
    if (!q) return true;
    return name.toLowerCase().includes(q) || id.toLowerCase().includes(q);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter objects..."
        style={{
          width: '100%', background: '#0d1117', border: '1px solid #30363d',
          borderRadius: 4, padding: '6px 8px', color: '#c9d1d9', fontSize: 12,
          outline: 'none', marginBottom: 6, boxSizing: 'border-box',
        }}
      />
      <div ref={listRef} style={{ flex: 1, overflow: 'auto', fontSize: 12 }}>
        {groups.map((group) => {
          const key = group.districtId ?? '__unassigned__';
          const expanded = expandedDistricts.has(key);

          // Filter zones in this group
          const visibleZones = group.zoneIds.filter((zid) => {
            const zone = project.zones.find((z) => z.id === zid);
            if (!zone) return false;
            if (!q) return true;
            // Show zone if it matches, or any child matches
            if (matchesFilter(zone.name, zone.id)) return true;
            const entities = project.entityPlacements.filter((e) => e.zoneId === zid);
            if (entities.some((e) => matchesFilter(e.name ?? e.entityId, e.entityId))) return true;
            const landmarks = project.landmarks.filter((l) => l.zoneId === zid);
            if (landmarks.some((l) => matchesFilter(l.name, l.id))) return true;
            const spawns = project.spawnPoints.filter((s) => s.zoneId === zid);
            if (spawns.some((s) => matchesFilter(s.id, s.id))) return true;
            return false;
          });

          if (q && visibleZones.length === 0) return null;

          return (
            <div key={key} style={{ marginBottom: 4 }}>
              {/* District header */}
              <div
                onClick={() => group.districtId ? handleSelectDistrict(group.districtId) : toggleDistrict(key)}
                onDoubleClick={() => toggleDistrict(key)}
                style={{
                  padding: '3px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                  background: '#161b22', borderRadius: 3, fontWeight: 'bold', color: '#79c0ff',
                }}
              >
                <span style={{ fontSize: 10, width: 12, textAlign: 'center', color: '#8b949e' }}>
                  {expanded ? '\u25BC' : '\u25B6'}
                </span>
                <span onClick={(e) => { e.stopPropagation(); toggleDistrict(key); }} style={{ cursor: 'pointer' }}>
                  {group.districtName}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8b949e' }}>
                  {visibleZones.length} zones
                </span>
              </div>

              {expanded && visibleZones.map((zid) => {
                const zone = project.zones.find((z) => z.id === zid);
                if (!zone) return null;
                const zoneExpanded = expandedZones.has(zid);
                const zoneSelected = isSel(selection, 'zone', zid);
                const entities = project.entityPlacements.filter((e) => e.zoneId === zid);
                const landmarks = project.landmarks.filter((l) => l.zoneId === zid);
                const spawns = project.spawnPoints.filter((s) => s.zoneId === zid);
                const childCount = entities.length + landmarks.length + spawns.length;

                // Filter children
                const visEntities = q ? entities.filter((e) => matchesFilter(e.name ?? e.entityId, e.entityId)) : entities;
                const visLandmarks = q ? landmarks.filter((l) => matchesFilter(l.name, l.id)) : landmarks;
                const visSpawns = q ? spawns.filter((s) => matchesFilter(s.id, s.id)) : spawns;

                return (
                  <div key={zid} style={{ marginLeft: 12 }}>
                    {/* Zone row */}
                    <div
                      data-selected={zoneSelected}
                      onClick={() => handleSelectZone(zid)}
                      onDoubleClick={() => toggleZone(zid)}
                      style={{
                        padding: '2px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                        borderLeft: zoneSelected ? '2px solid #58a6ff' : '2px solid transparent',
                      }}
                    >
                      {childCount > 0 && (
                        <span
                          onClick={(e) => { e.stopPropagation(); toggleZone(zid); }}
                          style={{ fontSize: 10, width: 12, textAlign: 'center', color: '#8b949e', cursor: 'pointer' }}
                        >
                          {zoneExpanded ? '\u25BC' : '\u25B6'}
                        </span>
                      )}
                      {childCount === 0 && <span style={{ width: 12 }} />}
                      <span style={{ color: '#58a6ff', fontSize: 9, fontWeight: 'bold', background: '#0d1117', borderRadius: 2, padding: '0 3px' }}>Z</span>
                      <span style={{ color: zoneSelected ? '#fff' : '#c9d1d9' }}>{zone.name}</span>
                      {childCount > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8b949e' }}>{childCount}</span>
                      )}
                    </div>

                    {/* Zone children */}
                    {zoneExpanded && (
                      <div style={{ marginLeft: 16 }}>
                        {visEntities.map((ep) => {
                          const sel = isSel(selection, 'entity', ep.entityId);
                          return (
                            <div
                              key={ep.entityId}
                              data-selected={sel}
                              onClick={() => handleSelectEntity(ep.entityId)}
                              style={{
                                padding: '1px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                borderLeft: sel ? '2px solid #3fb950' : '2px solid transparent',
                              }}
                            >
                              <span style={{ color: '#3fb950', fontSize: 9, fontWeight: 'bold', background: '#0d1117', borderRadius: 2, padding: '0 3px' }}>E</span>
                              <span style={{ color: sel ? '#fff' : '#c9d1d9' }}>{ep.name ?? ep.entityId}</span>
                              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#8b949e' }}>{ep.role}</span>
                            </div>
                          );
                        })}
                        {visLandmarks.map((lm) => {
                          const sel = isSel(selection, 'landmark', lm.id);
                          return (
                            <div
                              key={lm.id}
                              data-selected={sel}
                              onClick={() => handleSelectLandmark(lm.id)}
                              style={{
                                padding: '1px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                borderLeft: sel ? '2px solid #d2a8ff' : '2px solid transparent',
                              }}
                            >
                              <span style={{ color: '#d2a8ff', fontSize: 9, fontWeight: 'bold', background: '#0d1117', borderRadius: 2, padding: '0 3px' }}>L</span>
                              <span style={{ color: sel ? '#fff' : '#c9d1d9' }}>{lm.name}</span>
                            </div>
                          );
                        })}
                        {visSpawns.map((sp) => {
                          const sel = isSel(selection, 'spawn', sp.id);
                          return (
                            <div
                              key={sp.id}
                              data-selected={sel}
                              onClick={() => handleSelectSpawn(sp.id)}
                              style={{
                                padding: '1px 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                borderLeft: sel ? '2px solid #f0883e' : '2px solid transparent',
                              }}
                            >
                              <span style={{ color: '#f0883e', fontSize: 9, fontWeight: 'bold', background: '#0d1117', borderRadius: 2, padding: '0 3px' }}>S</span>
                              <span style={{ color: sel ? '#fff' : '#c9d1d9' }}>{sp.id}</span>
                              {sp.isDefault && <span style={{ fontSize: 9, color: '#8b949e' }}>(default)</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}

        {project.zones.length === 0 && (
          <div style={{ padding: '16px 8px', color: '#8b949e', textAlign: 'center' }}>
            No objects yet. Paint zones on the canvas to get started.
          </div>
        )}
      </div>
    </div>
  );
}
