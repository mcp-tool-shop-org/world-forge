// convert-player-template.ts — WorldProject player template → engine player setup

import type { WorldProject } from '@world-forge/schema';

/** Exported player template for the engine to use at character creation. */
export type ExportedPlayerTemplate = {
  name: string;
  defaultArchetypeId?: string;
  defaultBackgroundId?: string;
  baseStats: Record<string, number>;
  baseResources: Record<string, number>;
  startingInventory: string[];
  startingEquipment: Record<string, string>;
  spawnPointId: string;
  tags: string[];
  custom: Record<string, string | number | boolean>;
};

export function convertPlayerTemplate(project: WorldProject): ExportedPlayerTemplate | undefined {
  if (!project.playerTemplate) return undefined;

  const pt = project.playerTemplate;
  return {
    name: pt.name,
    defaultArchetypeId: pt.defaultArchetypeId,
    defaultBackgroundId: pt.defaultBackgroundId,
    baseStats: { ...pt.baseStats },
    baseResources: { ...pt.baseResources },
    startingInventory: [...pt.startingInventory],
    startingEquipment: { ...pt.startingEquipment },
    spawnPointId: pt.spawnPointId,
    tags: [...pt.tags],
    custom: { ...pt.custom },
  };
}
