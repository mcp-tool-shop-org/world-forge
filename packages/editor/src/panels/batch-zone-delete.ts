// batch-zone-delete.ts — multi-select zone delete matching removeZone/removeSelected.
//
// F-4342e70c: SelectionActionsPanel's batch-delete used to cascade-wipe
// entityPlacements/landmarks/spawnPoints whose zoneId was in the set, while
// leaving encounterAnchors/itemPlacements/propPlacements as orphans — two
// policies in one handler. Confirm copy also claimed the mutation could not
// be undone even though it goes through updateProject (undoable).

import type { WorldProject } from '@world-forge/schema';

/** Confirm copy for batch zone delete. Undoable — do not claim otherwise. */
export function batchDeleteConfirmMessage(zoneCount: number): string {
  return `Delete ${zoneCount} zones?`;
}

/**
 * Remove only the selected zones plus their connections and district
 * membership. Attached entities/landmarks/spawns/encounters/items/props
 * stay in the project as orphans (same contract as removeZone/removeSelected).
 */
export function deleteSelectedZonesOnly(project: WorldProject, zoneIds: string[]): WorldProject {
  const ids = new Set(zoneIds);
  return {
    ...project,
    zones: project.zones.filter((z) => !ids.has(z.id)),
    connections: project.connections.filter((c) => !ids.has(c.fromZoneId) && !ids.has(c.toZoneId)),
    districts: project.districts.map((d) => ({
      ...d,
      zoneIds: d.zoneIds.filter((zid) => !ids.has(zid)),
    })),
  };
}
