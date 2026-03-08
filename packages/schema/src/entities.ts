// entities.ts — NPC, enemy, item placement, and spawn types

/** Role an entity plays in the world. */
export type EntityRole = 'npc' | 'enemy' | 'merchant' | 'quest-giver' | 'companion' | 'boss';

/** Where an entity spawns on the map. */
export interface EntityPlacement {
  entityId: string;
  zoneId: string;
  gridX?: number;
  gridY?: number;
  role: EntityRole;
  spawnCondition?: string;
  factionId?: string;
  dialogueId?: string;
}

/** Where an item can be found on the map. */
export interface ItemPlacement {
  itemId: string;
  zoneId: string;
  gridX?: number;
  gridY?: number;
  container?: string;
  hidden: boolean;
}

/** A point where encounters can trigger. */
export interface EncounterAnchor {
  id: string;
  zoneId: string;
  encounterType: string;
  enemyIds: string[];
  probability: number;
  cooldownTurns: number;
  tags: string[];
}

/** A player start position. */
export interface SpawnPoint {
  id: string;
  zoneId: string;
  gridX: number;
  gridY: number;
  isDefault: boolean;
}

/** A world-placed crafting station. */
export interface CraftingStation {
  id: string;
  zoneId: string;
  stationType: string;
  availableRecipes: string[];
}

/** A trade or shop point on the map. */
export interface MarketNode {
  id: string;
  zoneId: string;
  merchantEntityId?: string;
  supplyCategories: string[];
  priceModifier: number;
  contrabandAvailable: boolean;
}
