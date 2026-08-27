// import-spawn-points.ts — ContentPack.spawnPoints → schema SpawnPoint[]

import type { SpawnPoint } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import type { ExportedSpawnPoint } from './convert-spawn-points.js';

/**
 * Restore spawn records from the pack channel.
 *
 * Returns `fromPack: false` when the key is missing so the caller can fall
 * back to synthesizing a single imported-spawn on zones[0] (legacy packs).
 * An explicit empty array is restored as empty — that is a real "no starts"
 * claim, not a missing channel.
 */
export function importSpawnPoints(
  exported: ExportedSpawnPoint[] | undefined,
): { spawnPoints: SpawnPoint[]; fidelity: FidelityEntry[]; fromPack: boolean } {
  const fidelity: FidelityEntry[] = [];
  if (!Array.isArray(exported)) {
    return { spawnPoints: [], fidelity, fromPack: false };
  }

  const spawnPoints: SpawnPoint[] = exported.map((sp) => ({
    id: sp.id,
    zoneId: sp.zoneId,
    gridX: sp.gridX ?? 0,
    gridY: sp.gridY ?? 0,
    isDefault: Boolean(sp.isDefault),
  }));

  if (spawnPoints.length > 0) {
    fidelity.push({
      level: 'lossless', domain: 'world', severity: 'info',
      message: `${spawnPoints.length} spawn point(s) restored from pack spawnPoints[] data`,
      reason: 'spawn-points-from-pack',
    });
  }

  return { spawnPoints, fidelity, fromPack: true };
}
