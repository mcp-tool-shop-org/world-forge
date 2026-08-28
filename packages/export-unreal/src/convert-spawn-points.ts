// convert-spawn-points.ts — F-dd8da467: PlayerStart-shaped spawn locations.

import type { WorldProject, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToUnrealAxis, DEFAULT_TILE_SIZE_CM, type UnrealVec3 } from './coordinate-transform.js';

export interface UnrealPlayerStart {
  Id: string;
  ZoneId: string;
  LocationCm: UnrealVec3;
  IsDefault: boolean;
}

export interface ConvertSpawnPointsResult {
  spawns: UnrealPlayerStart[];
  fidelity: FidelityEntry[];
}

export function convertSpawnPoints(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertSpawnPointsResult {
  const spawns: UnrealPlayerStart[] = [];
  const fidelity: FidelityEntry[] = [];
  const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));

  for (const sp of project.spawnPoints) {
    const zone = zonesById.get(sp.zoneId);
    if (!zone) {
      fidelity.push({
        level: 'dropped',
        domain: 'world',
        severity: 'error',
        entityId: sp.id,
        fieldPath: `spawnPoints.${sp.id}.zoneId`,
        message: `Spawn point "${sp.id}" dropped — zone "${sp.zoneId}" not found.`,
        reason: 'Orphan zone reference.',
      });
      continue;
    }
    const elevation = zone.elevation ?? 0;
    spawns.push({
      Id: sp.id,
      ZoneId: sp.zoneId,
      LocationCm: gridToUnrealAxis(sp.gridX, sp.gridY, tileSizeCm, elevation),
      IsDefault: sp.isDefault,
    });
    fidelity.push({
      level: 'lossless',
      domain: 'world',
      severity: 'info',
      entityId: sp.id,
      fieldPath: `spawnPoints.${sp.id}`,
      message: `Spawn point "${sp.id}" mapped to PlayerStart LocationCm.`,
      reason: 'unreal-player-start',
    });
  }

  return { spawns, fidelity };
}
