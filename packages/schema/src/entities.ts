// entities.ts — NPC, enemy, item placement, and spawn types

/** Role an entity plays in the world. */
export type EntityRole = 'npc' | 'enemy' | 'merchant' | 'quest-giver' | 'companion' | 'boss';

/** Stat block for an entity (maps to engine's baseStats). */
export interface EntityStats {
  vigor?: number;
  instinct?: number;
  will?: number;
  [key: string]: number | undefined;
}

/** Resource pool for an entity (maps to engine's baseResources). */
export interface EntityResources {
  hp?: number;
  stamina?: number;
  [key: string]: number | undefined;
}

/** AI behavior profile for enemies/companions. */
export interface EntityAI {
  profileId?: string;
  goals?: string[];
  fears?: string[];
}

/** Where an entity spawns on the map. */
export interface EntityPlacement {
  entityId: string;
  name?: string;
  zoneId: string;
  gridX?: number;
  gridY?: number;
  role: EntityRole;
  spawnCondition?: string;
  factionId?: string;
  dialogueId?: string;
  stats?: EntityStats;
  resources?: EntityResources;
  ai?: EntityAI;
  tags?: string[];
  custom?: Record<string, string>;
  portraitId?: string;
  spriteId?: string;
}

/** Item slot type (maps to engine's equipment slots). */
export type ItemSlot = 'weapon' | 'armor' | 'trinket' | 'tool' | 'accessory' | 'consumable';

/** Item rarity (maps to engine's rarity tiers). */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** Where an item can be found on the map. */
export interface ItemPlacement {
  itemId: string;
  name?: string;
  description?: string;
  zoneId: string;
  gridX?: number;
  gridY?: number;
  container?: string;
  hidden: boolean;
  slot?: ItemSlot;
  rarity?: ItemRarity;
  statModifiers?: Record<string, number>;
  resourceModifiers?: Record<string, number>;
  grantedTags?: string[];
  grantedVerbs?: string[];
  iconId?: string;
  /**
   * Optional reference to a LootTable. When set, the engine rolls the table
   * to populate the container/item drop instead of (or in addition to) the
   * single-item placement fields above.
   */
  lootTableId?: string;
}

/**
 * Entry in a loot table — a single pool member with a drop weight.
 *
 * LootTables power weighted item drops from containers, kills, or chests.
 * Each entry contributes its `weight` to a weighted pick; higher weight =
 * more likely to be rolled. Optional `quantity` randomizes stack size, and
 * `condition` gates eligibility at roll time (same grammar as
 * EntityPlacement.spawnCondition — see spawn-condition.ts).
 */
export interface LootTableEntry {
  /** Reference to an ItemPlacement.itemId OR a free-form item id the engine resolves. */
  itemId: string;
  /** Relative weight for weighted pick. Must be > 0 and finite. */
  weight: number;
  /** Optional quantity range [min, max]. If min===max, drops exactly that count. */
  quantity?: { min: number; max: number };
  /** Optional condition under which this entry is eligible (reuses SpawnCondition grammar — see spawn-condition.ts). */
  condition?: string;
  /** Optional rarity tier for UI display. */
  rarity?: ItemRarity;
}

/**
 * A weighted pool of item entries. Engines roll `rolls` times (default 1)
 * and pick one entry per roll based on weights.
 */
export interface LootTable {
  id: string;
  /** Total rolls per open / kill / chest. Default 1. Must be >= 1 when provided. */
  rolls?: number;
  /** Weighted entries. Must contain at least one entry. */
  entries: LootTableEntry[];
  /** Tags for filtering / discovery. */
  tags?: string[];
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
