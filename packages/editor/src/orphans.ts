// orphans.ts — ED-B-002: detect and repair orphaned objects whose parent
// reference (zone) has been deleted. Keeps the logic pure + testable so the
// Object List panel can render an "Orphaned" group and offer repair without
// knowing about the rules.
//
// Design note: we do NOT silently clean up orphans on zone delete. That would
// erase the user's work. Instead we surface them as first-class, selectable,
// repairable rows so the user decides whether to move them to a new zone or
// delete them with an undoable action.
//
// F-7002ff8c: the original scan only covered encounterAnchors. Every other
// zoneId-bearing collection is now in the same table; encounters stay the
// first row so findOrphanedEncounters remains a compatible wrapper.

import type { WorldProject, EncounterAnchor } from '@world-forge/schema';

/** An encounter whose `zoneId` no longer points to an existing zone. */
export interface OrphanedEncounter {
  encounter: EncounterAnchor;
  /** The missing zone id the encounter still references — shown in the UI hint. */
  missingZoneId: string;
}

export type ZoneAttachedCollection =
  | 'encounterAnchors'
  | 'entityPlacements'
  | 'landmarks'
  | 'spawnPoints'
  | 'itemPlacements'
  | 'marketNodes'
  | 'craftingStations'
  | 'buildings'
  | 'hubs'
  | 'strongholds'
  | 'propPlacements'
  | 'pressureHotspots';

export interface OrphanedByZone {
  collection: ZoneAttachedCollection;
  id: string;
  missingZoneId: string;
}

interface CollectionRow {
  collection: ZoneAttachedCollection;
  idField: string;
}

/** Encounters first — Object List and findOrphanedEncounters depend on that order. */
const ZONE_ID_TABLE: CollectionRow[] = [
  { collection: 'encounterAnchors', idField: 'id' },
  { collection: 'entityPlacements', idField: 'entityId' },
  { collection: 'landmarks', idField: 'id' },
  { collection: 'spawnPoints', idField: 'id' },
  { collection: 'itemPlacements', idField: 'itemId' },
  { collection: 'marketNodes', idField: 'id' },
  { collection: 'craftingStations', idField: 'id' },
  { collection: 'buildings', idField: 'id' },
  { collection: 'hubs', idField: 'id' },
  { collection: 'strongholds', idField: 'id' },
  { collection: 'propPlacements', idField: 'id' },
  { collection: 'pressureHotspots', idField: 'id' },
];

function rowsOf(project: WorldProject, collection: ZoneAttachedCollection): Array<Record<string, unknown>> {
  const arr = project[collection];
  return Array.isArray(arr) ? (arr as Array<Record<string, unknown>>) : [];
}

/** Pure scan. Returns orphans in table order (encounters first). */
export function findOrphanedByZone(project: WorldProject): OrphanedByZone[] {
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const out: OrphanedByZone[] = [];
  for (const row of ZONE_ID_TABLE) {
    for (const obj of rowsOf(project, row.collection)) {
      const zoneId = obj.zoneId;
      if (typeof zoneId === 'string' && zoneId.length > 0 && !zoneIds.has(zoneId)) {
        out.push({
          collection: row.collection,
          id: String(obj[row.idField] ?? ''),
          missingZoneId: zoneId,
        });
      }
    }
  }
  return out;
}

/** Reassign any zone-attached orphan to an existing zone. No-op if target is missing. */
export function reassignOrphanZone(
  project: WorldProject,
  collection: ZoneAttachedCollection,
  id: string,
  newZoneId: string,
): WorldProject {
  const zoneExists = project.zones.some((z) => z.id === newZoneId);
  if (!zoneExists) return project;
  const row = ZONE_ID_TABLE.find((r) => r.collection === collection);
  if (!row) return project;
  const current = rowsOf(project, collection);
  return {
    ...project,
    [collection]: current.map((obj) =>
      String(obj[row.idField]) === id ? { ...obj, zoneId: newZoneId } : obj,
    ),
  } as WorldProject;
}

/** Delete a zone-attached object by collection + id. */
export function deleteOrphan(
  project: WorldProject,
  collection: ZoneAttachedCollection,
  id: string,
): WorldProject {
  const row = ZONE_ID_TABLE.find((r) => r.collection === collection);
  if (!row) return project;
  const current = rowsOf(project, collection);
  return {
    ...project,
    [collection]: current.filter((obj) => String(obj[row.idField]) !== id),
  } as WorldProject;
}

/** Pure scan. Returns the orphans in the order they appear in the project. */
export function findOrphanedEncounters(project: WorldProject): OrphanedEncounter[] {
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const out: OrphanedEncounter[] = [];
  for (const enc of project.encounterAnchors) {
    if (!zoneIds.has(enc.zoneId)) {
      out.push({ encounter: enc, missingZoneId: enc.zoneId });
    }
  }
  return out;
}

/** Reassign an orphaned encounter to a new, existing zone. No-op if target is missing. */
export function reassignEncounterZone(
  project: WorldProject,
  encounterId: string,
  newZoneId: string,
): WorldProject {
  return reassignOrphanZone(project, 'encounterAnchors', encounterId, newZoneId);
}

/** Delete an orphaned encounter by id. Single-encounter variant for per-row repair. */
export function deleteEncounter(project: WorldProject, encounterId: string): WorldProject {
  return deleteOrphan(project, 'encounterAnchors', encounterId);
}
