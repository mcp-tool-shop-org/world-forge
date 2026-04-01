// paste.ts — pure function for pasting clipboard contents into a project

import type { WorldProject, Zone, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor } from '@world-forge/schema';
import type { ClipboardData } from './store/editor-store.js';

export interface PasteResult {
  project: WorldProject;
  newIds: string[];
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

  // Remap zones
  const newZones: Zone[] = clipboard.zones.map((z) => ({
    ...structuredClone(z),
    id: nextId('zone', z.id),
    name: `${z.name} (paste)`,
    gridX: z.gridX + dx,
    gridY: z.gridY + dy,
    neighbors: z.neighbors
      .map((nid) => idMap.get(nid))
      .filter((nid): nid is string => nid != null),
  }));

  // Remap entities
  const newEntities: EntityPlacement[] = clipboard.entities.map((e) => ({
    ...structuredClone(e),
    entityId: nextId('entity', e.entityId),
    zoneId: idMap.get(e.zoneId) ?? e.zoneId,
    gridX: e.gridX != null ? e.gridX + dx : e.gridX,
    gridY: e.gridY != null ? e.gridY + dy : e.gridY,
  }));

  // Remap landmarks
  const newLandmarks: Landmark[] = clipboard.landmarks.map((l) => ({
    ...structuredClone(l),
    id: nextId('lm', l.id),
    zoneId: idMap.get(l.zoneId) ?? l.zoneId,
    gridX: l.gridX + dx,
    gridY: l.gridY + dy,
  }));

  // Remap spawns
  const newSpawns: SpawnPoint[] = clipboard.spawns.map((s) => ({
    ...structuredClone(s),
    id: nextId('spawn', s.id),
    zoneId: idMap.get(s.zoneId) ?? s.zoneId,
    gridX: s.gridX + dx,
    gridY: s.gridY + dy,
  }));

  // Remap encounters
  const newEncounters: EncounterAnchor[] = clipboard.encounters.map((enc) => ({
    ...structuredClone(enc),
    id: nextId('enc', enc.id),
    zoneId: idMap.get(enc.zoneId) ?? enc.zoneId,
  }));

  const newProject: WorldProject = {
    ...project,
    zones: [...project.zones, ...newZones],
    entityPlacements: [...project.entityPlacements, ...newEntities],
    landmarks: [...project.landmarks, ...newLandmarks],
    spawnPoints: [...project.spawnPoints, ...newSpawns],
    encounterAnchors: [...project.encounterAnchors, ...newEncounters],
  };

  return { project: newProject, newIds };
}
