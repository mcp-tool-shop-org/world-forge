// import-player-template.ts — engine ExportedPlayerTemplate → schema PlayerTemplate

import type { PlayerTemplate } from '@world-forge/schema';
import type { ExportedPlayerTemplate } from './convert-player-template.js';
import type { FidelityEntry } from './fidelity.js';

export function importPlayerTemplate(
  exported: ExportedPlayerTemplate | undefined,
): { template: PlayerTemplate | undefined; fidelity: FidelityEntry[] } {
  const fidelity: FidelityEntry[] = [];
  if (!exported) return { template: undefined, fidelity };

  if (!exported.spawnPointId) {
    fidelity.push({
      level: 'approximated', domain: 'player', severity: 'info',
      fieldPath: 'spawnPointId',
      message: 'Player template spawn point ID will be generated during import',
      reason: 'spawn-point-generated',
    });
  }

  return {
    template: {
      name: exported.name,
      defaultArchetypeId: exported.defaultArchetypeId,
      defaultBackgroundId: exported.defaultBackgroundId,
      baseStats: { ...exported.baseStats },
      baseResources: { ...exported.baseResources },
      startingInventory: [...exported.startingInventory],
      startingEquipment: { ...exported.startingEquipment },
      spawnPointId: exported.spawnPointId,
      tags: [...exported.tags],
      custom: { ...exported.custom },
    },
    fidelity,
  };
}
