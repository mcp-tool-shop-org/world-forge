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

/**
 * Convert project player template → engine player template (or `undefined`
 * if none authored).
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 */
export function convertPlayerTemplate(
  project: WorldProject,
  warnings?: string[],
): ExportedPlayerTemplate | undefined {
  if (!project.playerTemplate) return undefined;

  const pt = project.playerTemplate;

  // AIR-B-009: Validate spawnPointId references a declared spawn point. The
  // project validator will normally catch this, but if a caller skips
  // validation or amends the project post-validation we still surface a clear
  // warning instead of silently emitting a dangling reference.
  if (warnings) {
    const spawnIds = new Set(project.spawnPoints.map((sp) => sp.id));
    if (!spawnIds.has(pt.spawnPointId)) {
      const fallback = project.spawnPoints.find((sp) => sp.isDefault)?.id
        ?? project.spawnPoints[0]?.id;
      const suggestion = fallback
        ? ` Consider falling back to spawn point "${fallback}".`
        : ' No spawn points are declared — add at least one before exporting.';
      warnings.push(
        `Player template spawnPointId "${pt.spawnPointId}" is not declared in project.spawnPoints — the game will not know where to place the player.${suggestion}`,
      );
    }
  }

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
