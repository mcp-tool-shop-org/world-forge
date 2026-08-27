// convert-spawn-points.ts — WorldProject.spawnPoints → ContentPack.spawnPoints
//
// F-0e432e10: convertPlayerTemplate copied only the dangling spawnPointId
// string. An engine that must place the player had an id with no zone, and
// import synthesized a single imported-spawn on zones[0], collapsing multiple
// starts / a non-first default.

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

/** One player start. Grid is optional on the wire (charter); schema authors it. */
export interface ExportedSpawnPoint {
  id: string;
  zoneId: string;
  isDefault: boolean;
  gridX?: number;
  gridY?: number;
}

/**
 * Convert project.spawnPoints → ContentPack.spawnPoints.
 *
 * Every authored record is emitted (id, zoneId, isDefault, grid). A spawn
 * whose zoneId does not resolve still crosses — dropping it would leave the
 * playerTemplate.spawnPointId dangling, which is the defect this closes —
 * but is warned so the author can restore the zone.
 */
export function convertSpawnPoints(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ExportedSpawnPoint[] {
  const zoneIds = new Set(project.zones.map((z) => z.id));

  return project.spawnPoints.map((sp) => {
    if (!zoneIds.has(sp.zoneId)) {
      const msg = `Spawn point "${sp.id}" references zone "${sp.zoneId}" which is not in project.zones — the record is still exported so playerTemplate.spawnPointId is not a dangling id.`;
      warnings?.push(msg);
      fidelity?.push({
        domain: 'world',
        level: 'approximated',
        severity: 'warning',
        entityId: sp.id,
        fieldPath: `spawnPoints.${sp.id}.zoneId`,
        message: msg,
        reason: 'spawn-point-zone-missing',
      });
    }

    return {
      id: sp.id,
      zoneId: sp.zoneId,
      isDefault: sp.isDefault,
      gridX: sp.gridX,
      gridY: sp.gridY,
    };
  });
}
