// player-template.ts — player character template for authored worlds

/**
 * Defines the starting player configuration for a world pack.
 * Maps to ai-rpg-engine's CharacterBuild defaults + starting state.
 */
export interface PlayerTemplate {
  /** Default player name (can be overridden at character creation). */
  name: string;

  /** Default archetype ID from the build catalog. */
  defaultArchetypeId?: string;

  /** Default background ID from the build catalog. */
  defaultBackgroundId?: string;

  /** Starting stats before archetype/background modifiers. */
  baseStats: Record<string, number>;

  /** Starting resources (hp, stamina, etc.). */
  baseResources: Record<string, number>;

  /** Starting inventory — item IDs from itemPlacements or build catalog. */
  startingInventory: string[];

  /** Starting equipment — slot → item ID mapping. */
  startingEquipment: Record<string, string>;

  /** Spawn point ID — where the player starts. */
  spawnPointId: string;

  /** Starting tags. */
  tags: string[];

  /** Freeform custom data for pack-specific setup. */
  custom: Record<string, string | number | boolean>;
}
