// paste.ts — pure function for pasting clipboard contents into a project

import type { WorldProject, Zone, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor, ZoneConnection } from '@world-forge/schema';
import type { ClipboardData, SelectionSet } from './store/editor-store.js';

export interface PasteResult {
  project: WorldProject;
  newIds: string[];
  /** Selection covering exactly the newly pasted objects (mirrors DuplicateResult.newSelection in duplicate.ts). */
  newSelection: SelectionSet;
}

/** Default grid offset applied when pasting (to avoid exact overlap). */
const PASTE_OFFSET = 2;

/**
 * Paste clipboard contents into a project at an optional offset.
 * Creates new items with remapped IDs and shifted positions.
 * Pure function — does not mutate inputs.
 */
export function pasteFromClipboard(
  clipboard: ClipboardData,
  project: WorldProject,
  offset?: { dx: number; dy: number },
): PasteResult {
  const dx = offset?.dx ?? PASTE_OFFSET;
  const dy = offset?.dy ?? PASTE_OFFSET;

  const now = Date.now();
  let counter = 0;
  const idMap = new Map<string, string>();
  const newIds: string[] = [];

  function nextId(prefix: string, oldId: string): string {
    const id = `${prefix}-${now}-${counter++}`;
    idMap.set(oldId, id);
    newIds.push(id);
    return id;
  }

  // Prior finding (neighbor-remapping bug, dormant only because paste was never
  // wired up in production): assign EVERY new ID before remapping ANY
  // cross-reference. The previous single-pass version called `nextId` for a
  // zone and remapped its `neighbors`/`exits` in the SAME `.map()` callback, so
  // a same-batch reference to a zone appearing LATER in `clipboard.zones` hadn't
  // been assigned an ID yet — `idMap.get()` returned undefined and the
  // filter silently dropped it, even though it WAS part of this paste batch.
  // Building the complete ID map first (mirroring duplicate.ts's two-pass
  // approach — see duplicateSelected in duplicate.ts) makes remapping
  // order-independent.
  for (const z of clipboard.zones) nextId('zone', z.id);
  for (const e of clipboard.entities) nextId('entity', e.entityId);
  for (const l of clipboard.landmarks) nextId('lm', l.id);
  for (const s of clipboard.spawns) nextId('spawn', s.id);
  for (const enc of clipboard.encounters) nextId('enc', enc.id);

  // Remap zones
  const newZones: Zone[] = clipboard.zones.map((z) => ({
    ...structuredClone(z),
    id: idMap.get(z.id)!,
    name: `${z.name} (paste)`,
    gridX: z.gridX + dx,
    gridY: z.gridY + dy,
    neighbors: z.neighbors
      .map((nid) => idMap.get(nid))
      .filter((nid): nid is string => nid != null),
    // Same defect class as `neighbors` above, found while wiring this feature
    // up: exits were never remapped OR filtered at all (they passed straight
    // through via `...structuredClone(z)`), so a pasted zone's exit kept
    // pointing at the ORIGINAL target zone instead of its pasted sibling.
    // duplicate.ts's equivalent (`zone.exits.filter(...).map(...)`) already
    // gets this right — mirrored here for parity.
    exits: z.exits
      .filter((exit) => idMap.has(exit.targetZoneId))
      .map((exit) => ({ ...exit, targetZoneId: idMap.get(exit.targetZoneId)! })),
  }));

  // Remap entities
  const newEntities: EntityPlacement[] = clipboard.entities.map((e) => ({
    ...structuredClone(e),
    entityId: idMap.get(e.entityId)!,
    zoneId: idMap.get(e.zoneId) ?? e.zoneId,
    gridX: e.gridX != null ? e.gridX + dx : e.gridX,
    gridY: e.gridY != null ? e.gridY + dy : e.gridY,
  }));

  // Remap landmarks
  const newLandmarks: Landmark[] = clipboard.landmarks.map((l) => ({
    ...structuredClone(l),
    id: idMap.get(l.id)!,
    zoneId: idMap.get(l.zoneId) ?? l.zoneId,
    gridX: l.gridX + dx,
    gridY: l.gridY + dy,
  }));

  // Remap spawns
  const newSpawns: SpawnPoint[] = clipboard.spawns.map((s) => ({
    ...structuredClone(s),
    id: idMap.get(s.id)!,
    zoneId: idMap.get(s.zoneId) ?? s.zoneId,
    gridX: s.gridX + dx,
    gridY: s.gridY + dy,
  }));

  // Remap encounters
  const newEncounters: EncounterAnchor[] = clipboard.encounters.map((enc) => ({
    ...structuredClone(enc),
    id: idMap.get(enc.id)!,
    zoneId: idMap.get(enc.zoneId) ?? enc.zoneId,
  }));

  // F-923c690c: remap connections whose both ends are in this paste batch
  // (same two-pass as duplicateSelected). Canvas draws lines exclusively
  // from project.connections, so dropping them left pasted rooms isolated.
  const newConnections: ZoneConnection[] = (clipboard.connections ?? [])
    .filter((c) => idMap.has(c.fromZoneId) && idMap.has(c.toZoneId))
    .map((c) => ({
      ...structuredClone(c),
      fromZoneId: idMap.get(c.fromZoneId)!,
      toZoneId: idMap.get(c.toZoneId)!,
    }));

  // F-923c690c: append pasted zone ids to any district that contained the
  // originals — otherwise parentDistrictId points at a district whose
  // zoneIds list does not contain the new room.
  const originalZoneIds = clipboard.zones.map((z) => z.id);
  const districts = project.districts.map((d) => {
    const pastedInDistrict = originalZoneIds.filter((zid) => d.zoneIds.includes(zid));
    if (pastedInDistrict.length === 0) return d;
    return { ...d, zoneIds: [...d.zoneIds, ...pastedInDistrict.map((zid) => idMap.get(zid)!)] };
  });

  const newProject: WorldProject = {
    ...project,
    zones: [...project.zones, ...newZones],
    connections: [...project.connections, ...newConnections],
    districts,
    entityPlacements: [...project.entityPlacements, ...newEntities],
    landmarks: [...project.landmarks, ...newLandmarks],
    spawnPoints: [...project.spawnPoints, ...newSpawns],
    encounterAnchors: [...project.encounterAnchors, ...newEncounters],
  };

  return {
    project: newProject,
    newIds,
    newSelection: {
      zones: newZones.map((z) => z.id),
      entities: newEntities.map((e) => e.entityId),
      landmarks: newLandmarks.map((l) => l.id),
      spawns: newSpawns.map((s) => s.id),
      encounters: newEncounters.map((enc) => enc.id),
    },
  };
}
