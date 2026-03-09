// duplicate.ts — pure duplication logic for selected objects

import type { WorldProject, Zone, EntityPlacement, Landmark, SpawnPoint, ZoneConnection } from '@world-forge/schema';

export interface SelectionSet {
  zones: string[];
  entities: string[];
  landmarks: string[];
  spawns: string[];
}

export interface DuplicateResult {
  project: WorldProject;
  newSelection: SelectionSet;
}

const DUPE_OFFSET = 2;

export function duplicateSelected(
  project: WorldProject,
  selection: SelectionSet,
): DuplicateResult {
  const count = selection.zones.length + selection.entities.length + selection.landmarks.length + selection.spawns.length;
  if (count === 0) return { project, newSelection: { zones: [], entities: [], landmarks: [], spawns: [] } };

  // Build old-to-new ID map
  const idMap = new Map<string, string>();
  const now = Date.now();
  let counter = 0;
  for (const id of selection.zones) idMap.set(id, `zone-${now}-${counter++}`);
  for (const id of selection.entities) idMap.set(id, `entity-${now}-${counter++}`);
  for (const id of selection.landmarks) idMap.set(id, `lm-${now}-${counter++}`);
  for (const id of selection.spawns) idMap.set(id, `spawn-${now}-${counter++}`);

  // Duplicate zones
  const newZones: Zone[] = [];
  for (const zoneId of selection.zones) {
    const zone = project.zones.find(z => z.id === zoneId);
    if (!zone) continue;
    newZones.push({
      ...zone,
      id: idMap.get(zoneId)!,
      name: `${zone.name} (copy)`,
      gridX: zone.gridX + DUPE_OFFSET,
      gridY: zone.gridY + DUPE_OFFSET,
      neighbors: zone.neighbors.filter(n => idMap.has(n)).map(n => idMap.get(n)!),
      exits: zone.exits.filter(e => idMap.has(e.targetZoneId)).map(e => ({ ...e, targetZoneId: idMap.get(e.targetZoneId)! })),
    });
  }

  // Duplicate entities
  const newEntities: EntityPlacement[] = [];
  for (const entityId of selection.entities) {
    const ep = project.entityPlacements.find(e => e.entityId === entityId);
    if (!ep) continue;
    newEntities.push({
      ...ep,
      entityId: idMap.get(entityId)!,
      zoneId: idMap.get(ep.zoneId) ?? ep.zoneId,
      gridX: ep.gridX != null ? ep.gridX + DUPE_OFFSET : undefined,
      gridY: ep.gridY != null ? ep.gridY + DUPE_OFFSET : undefined,
    });
  }

  // Duplicate landmarks
  const newLandmarks: Landmark[] = [];
  for (const lmId of selection.landmarks) {
    const lm = project.landmarks.find(l => l.id === lmId);
    if (!lm) continue;
    newLandmarks.push({
      ...lm,
      id: idMap.get(lmId)!,
      zoneId: idMap.get(lm.zoneId) ?? lm.zoneId,
      gridX: lm.gridX + DUPE_OFFSET,
      gridY: lm.gridY + DUPE_OFFSET,
    });
  }

  // Duplicate spawns (isDefault always false)
  const newSpawns: SpawnPoint[] = [];
  for (const spId of selection.spawns) {
    const sp = project.spawnPoints.find(s => s.id === spId);
    if (!sp) continue;
    newSpawns.push({
      ...sp,
      id: idMap.get(spId)!,
      zoneId: idMap.get(sp.zoneId) ?? sp.zoneId,
      gridX: sp.gridX + DUPE_OFFSET,
      gridY: sp.gridY + DUPE_OFFSET,
      isDefault: false,
    });
  }

  // Duplicate connections between duplicated zones only
  const zoneSet = new Set(selection.zones);
  const newConnections: ZoneConnection[] = project.connections
    .filter(c => zoneSet.has(c.fromZoneId) && zoneSet.has(c.toZoneId))
    .map(c => ({ ...c, fromZoneId: idMap.get(c.fromZoneId)!, toZoneId: idMap.get(c.toZoneId)! }));

  // Update districts to include duplicated zones
  const districts = project.districts.map(d => {
    const dupeZonesInDistrict = selection.zones.filter(zid => d.zoneIds.includes(zid));
    if (dupeZonesInDistrict.length === 0) return d;
    return { ...d, zoneIds: [...d.zoneIds, ...dupeZonesInDistrict.map(zid => idMap.get(zid)!)] };
  });

  return {
    project: {
      ...project,
      zones: [...project.zones, ...newZones],
      connections: [...project.connections, ...newConnections],
      districts,
      entityPlacements: [...project.entityPlacements, ...newEntities],
      landmarks: [...project.landmarks, ...newLandmarks],
      spawnPoints: [...project.spawnPoints, ...newSpawns],
    },
    newSelection: {
      zones: newZones.map(z => z.id),
      entities: newEntities.map(e => e.entityId),
      landmarks: newLandmarks.map(l => l.id),
      spawns: newSpawns.map(s => s.id),
    },
  };
}
