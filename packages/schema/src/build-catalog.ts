// build-catalog.ts — character creation catalog for authored worlds
// Matches ai-rpg-engine/character-creation BuildCatalog shape.

import type { ScalarValue } from './dialogue.js';

/** What a trait or discipline effect does. */
export type TraitEffectType =
  | 'stat-modifier'
  | 'resource-modifier'
  | 'grant-tag'
  | 'verb-access'
  | 'faction-modifier';

export interface TraitEffect {
  type: TraitEffectType;
  /** Stat/resource/tag/verb/faction name depending on type. */
  stat?: string;
  resource?: string;
  tag?: string;
  verb?: string;
  faction?: string;
  /** Numeric value for modifiers. */
  amount?: number;
}

export interface ArchetypeDefinition {
  id: string;
  name: string;
  description: string;
  /** Stat priority weights (e.g., { vigor: 2, instinct: 1 }). */
  statPriorities: Record<string, number>;
  /** Resource overrides from base (e.g., { hp: 100, mana: 50 }). */
  resourceOverrides?: Record<string, number>;
  /** Tags granted at character creation. */
  startingTags: string[];
  /** Item IDs granted at creation. */
  startingInventory?: string[];
  /** Progression tree this archetype follows. */
  progressionTreeId: string;
  /** Verbs unlocked by this archetype. */
  grantedVerbs?: string[];
}

export interface BackgroundDefinition {
  id: string;
  name: string;
  description: string;
  /** Stat adjustments from background. */
  statModifiers: Record<string, number>;
  /** Tags granted by background. */
  startingTags: string[];
  /** Item IDs granted by background. */
  startingInventory?: string[];
  /** Faction reputation adjustments. */
  factionModifiers?: Record<string, number>;
}

export interface TraitDefinition {
  id: string;
  name: string;
  description: string;
  category: 'perk' | 'flaw';
  effects: TraitEffect[];
  /** Trait IDs that conflict with this one. */
  incompatibleWith?: string[];
}

export interface DisciplineDefinition {
  id: string;
  name: string;
  description: string;
  /** Special action verb granted. */
  grantedVerb: string;
  /** Always-active effect. */
  passive: TraitEffect;
  /** Trade-off for using this discipline. */
  drawback: TraitEffect;
  /** Tags required to select this discipline. */
  requiredTags?: string[];
}

export interface CrossDisciplineTitle {
  archetypeId: string;
  disciplineId: string;
  title: string;
  tags: string[];
}

export interface ClassEntanglement {
  id: string;
  archetypeId: string;
  disciplineId: string;
  description: string;
  effects: TraitEffect[];
}

/** Complete build catalog — everything needed for character creation. */
export interface BuildCatalogDefinition {
  /** Stat point budget for allocations. */
  statBudget: number;
  /** Maximum traits a player can select. */
  maxTraits: number;
  /** Minimum flaws required. */
  requiredFlaws: number;
  archetypes: ArchetypeDefinition[];
  backgrounds: BackgroundDefinition[];
  traits: TraitDefinition[];
  disciplines: DisciplineDefinition[];
  crossTitles: CrossDisciplineTitle[];
  entanglements: ClassEntanglement[];
}
