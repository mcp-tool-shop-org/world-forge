// project.ts — WorldProject container type

import type { WorldMap, Zone, ZoneConnection, Landmark, TransitionEntity } from './spatial.js';
import type { District, FactionPresence, PressureHotspot } from './districts.js';
import type {
  EntityPlacement, ItemPlacement, EncounterAnchor,
  SpawnPoint, CraftingStation, MarketNode, LootTable,
} from './entities.js';
import type { Building, Hub, Stronghold } from './town.js';
import type { Stratum, StratumLink } from './stratum.js';
import type { HazardDefinition } from './hazard.js';
import type { DialogueDefinition } from './dialogue.js';
import type { PlayerTemplate } from './player-template.js';
import type { BuildCatalogDefinition } from './build-catalog.js';
import type { ProgressionTreeDefinition } from './progression-tree.js';
import type {
  Tileset, TileLayer, PropDefinition, PropPlacement, AmbientLayer,
} from './visual.js';
import type { AssetEntry, AssetPack } from './assets.js';
import type { AuthoringMode } from './authoring-mode.js';

/** Complete authored world — everything needed to export to ai-rpg-engine. */
export interface WorldProject {
  id: string;
  name: string;
  description: string;
  version: string;

  genre: string;
  tones: string[];
  difficulty: string;
  narratorTone: string;
  /**
   * Schema generation that authored this document. Additive; omitted means a
   * pre-stamp v4.x file. create-empty / editor save should stamp SCHEMA_VERSION
   * via stampProjectSchemaVersion(). validateProject does not mutate this field;
   * it records the *producing validator* on ValidationResult.schemaVersion.
   * Exporters should read project.schemaVersion first and
   * ValidationResult.schemaVersion second.
   */
  schemaVersion?: string;
  /** Scale/scope of the world (dungeon, ocean, space, etc.). Optional for backward compat. */
  mode?: AuthoringMode;

  /** Who created this project. */
  author?: string;
  /** License governing the project content (e.g. 'CC-BY-4.0', 'MIT', 'custom'). */
  license?: string;
  /** High-level category for the project (e.g. 'fantasy', 'sci-fi', 'horror'). */
  category?: string;
  /** Freeform tags for discovery and filtering. */
  projectTags?: string[];

  map: WorldMap;
  zones: Zone[];
  connections: ZoneConnection[];
  districts: District[];
  landmarks: Landmark[];

  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];

  dialogues: DialogueDefinition[];

  playerTemplate?: PlayerTemplate;
  buildCatalog?: BuildCatalogDefinition;
  progressionTrees: ProgressionTreeDefinition[];

  entityPlacements: EntityPlacement[];
  itemPlacements: ItemPlacement[];
  encounterAnchors: EncounterAnchor[];
  spawnPoints: SpawnPoint[];
  craftingStations: CraftingStation[];
  marketNodes: MarketNode[];

  /**
   * Placed town structures — enterable buildings, service/connectivity hubs,
   * and fortified faction strongholds. Additive since v4.5 — existing projects
   * without these fields validate normally (they default to undefined / []).
   */
  buildings?: Building[];
  hubs?: Hub[];
  strongholds?: Stronghold[];

  /**
   * World-modeling layer — discrete vertical strata and the connectors between
   * them. Additive since v4.5 — existing projects without these fields validate
   * normally. See docs/world-modeling-design.md.
   */
  strata?: Stratum[];
  stratumLinks?: StratumLink[];

  /**
   * Typed environmental hazard definitions, referenced by zones via
   * Zone.hazardRefs. Additive since v4.5 — the legacy Zone.hazards string[]
   * field is untouched. See docs/world-modeling-design.md.
   */
  hazardDefinitions?: HazardDefinition[];

  tilesets: Tileset[];
  tileLayers: TileLayer[];
  props: PropDefinition[];
  propPlacements: PropPlacement[];
  ambientLayers: AmbientLayer[];
  assets: AssetEntry[];
  assetPacks: AssetPack[];

  /**
   * Weighted loot pools for containers, kills, and chests. Additive since v4.3 —
   * existing projects without this field validate normally.
   */
  lootTables?: LootTable[];
  /**
   * Placed elevator / warp / transporter / cargo-lift / stairwell transitions.
   * Additive since v4.3 — existing projects without this field validate normally.
   */
  transitions?: TransitionEntity[];
}

/**
 * Required WorldProject array fields. validateProject's structural guard, createEmptyProject,
 * and normalizeProjectShape all iterate this list so a new required array cannot land on
 * the type without also joining the guard and the v4.x backfill.
 */
export const WORLD_PROJECT_REQUIRED_ARRAY_FIELDS = [
  'zones',
  'connections',
  'districts',
  'entityPlacements',
  'itemPlacements',
  'spawnPoints',
  'landmarks',
  'dialogues',
  'progressionTrees',
  'encounterAnchors',
  'factionPresences',
  'pressureHotspots',
  'assets',
  'assetPacks',
  'craftingStations',
  'marketNodes',
  'tilesets',
  'tileLayers',
  'props',
  'propPlacements',
  'ambientLayers',
  'tones',
] as const satisfies readonly (keyof WorldProject)[];

export type WorldProjectRequiredArrayField = typeof WORLD_PROJECT_REQUIRED_ARRAY_FIELDS[number];

/**
 * Optional WorldProject array fields. Omitted (undefined) stays valid; present-but-not-an-array
 * is a structural error. The shape normalizer leaves omitted optionals undefined.
 */
export const WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS = [
  'buildings',
  'hubs',
  'strongholds',
  'lootTables',
  'transitions',
  'strata',
  'stratumLinks',
  'hazardDefinitions',
  'projectTags',
] as const satisfies readonly (keyof WorldProject)[];

export type WorldProjectOptionalArrayField = typeof WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS[number];

/** Required `T[]` keys on WorldProject (not `T[] | undefined`). */
type RequiredArrayKeys = {
  [K in keyof WorldProject]-?: WorldProject[K] extends readonly unknown[]
    ? (undefined extends WorldProject[K] ? never : K)
    : never
}[keyof WorldProject];

/** Optional `T[] | undefined` keys on WorldProject. */
type OptionalArrayKeys = {
  [K in keyof WorldProject]-?: undefined extends WorldProject[K]
    ? (NonNullable<WorldProject[K]> extends readonly unknown[] ? K : never)
    : never
}[keyof WorldProject];

type _AssertRequiredArraysCovered = Exclude<RequiredArrayKeys, WorldProjectRequiredArrayField> extends never
  ? Exclude<WorldProjectRequiredArrayField, RequiredArrayKeys> extends never
    ? true
    : WorldProjectRequiredArrayField
  : RequiredArrayKeys;
const _assertRequiredArraysCovered: _AssertRequiredArraysCovered = true;
void _assertRequiredArraysCovered;

type _AssertOptionalArraysCovered = Exclude<OptionalArrayKeys, WorldProjectOptionalArrayField> extends never
  ? Exclude<WorldProjectOptionalArrayField, OptionalArrayKeys> extends never
    ? true
    : WorldProjectOptionalArrayField
  : OptionalArrayKeys;
const _assertOptionalArraysCovered: _AssertOptionalArraysCovered = true;
void _assertOptionalArraysCovered;
