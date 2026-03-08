// import-player-template.ts — engine ExportedPlayerTemplate → schema PlayerTemplate

import type { PlayerTemplate } from '@world-forge/schema';
import type { ExportedPlayerTemplate } from './convert-player-template.js';

export function importPlayerTemplate(
  exported: ExportedPlayerTemplate | undefined,
): PlayerTemplate | undefined {
  if (!exported) return undefined;

  return {
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
  };
}
