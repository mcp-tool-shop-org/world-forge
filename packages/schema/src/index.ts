/**
 * @world-forge/schema — spatial data types for world authoring
 *
 * ── Schema stability contract ──────────────────────────────
 * The WorldProject schema is semver-stable within major versions. Breaking
 * changes (removed fields, renamed required fields, changed enum tightening)
 * bump the major version. Additive changes (new optional fields, new union
 * variants) ship as minor or patch releases.
 *
 *   - v4.x is backward-compatible with all v4.0+ projects.
 *   - New optional fields (e.g. 2.5D parallax layers, skylineRef) default to
 *     undefined. Arrays added after v4.0 (craftingStations, marketNodes,
 *     tilesets, tileLayers, props, propPlacements, ambientLayers, tones) are
 *     required on WorldProject; a legally authored v4.0 JSON that omits them
 *     must be run through stampProjectSchemaVersion() or normalizeProjectShape()
 *     so they default to [] before validateProject. validateProject stays honest
 *     for present-but-wrong types; stamp only backfills omitted arrays.
 *   - WorldProject.schemaVersion (optional) records which generation authored
 *     the JSON. Omitted = pre-stamp v4.x. Exporters should read
 *     `project.schemaVersion` first and `ValidationResult.schemaVersion`
 *     (the producing validator) second. Stamp new documents with
 *     stampProjectSchemaVersion() (also backfills omitted required arrays).
 *   - v5.0+ will ship with a migration tool that reads earlier major projects
 *     and writes a v5 JSON. Do not rely on hand-editing to cross a major.
 *
 * When evolving the schema, prefer additive, optional-field changes so that
 * authored worlds keep opening without a migration pass.
 */

export type {
  WorldMap, Zone, ZoneExit, ZoneElevationRange, ZoneEntryGate, Interactable,
  ZoneConnection, ConnectionKind, Landmark,
  TransitionEntity, TransitionEntityType,
  PhysicsMode, GravityDirection,
} from './spatial.js';

export type {
  District, DistrictMetrics, EconomyProfile,
  FactionPresence, PatrolRoute, PressureHotspot,
} from './districts.js';

export type {
  EntityRole, EntityStats, EntityResources, EntityAI,
  EntityPlacement, ItemSlot, ItemRarity, ItemPlacement,
  EncounterAnchor, SpawnPoint, CraftingStation, MarketNode,
  LootTable, LootTableEntry,
} from './entities.js';

export type { Building, Hub, Stronghold } from './town.js';

export type { Stratum, StratumLink } from './stratum.js';

export type {
  HazardEffect, HazardTrigger, HazardPassability, HazardDefinition,
} from './hazard.js';

export type {
  SpawnConditionType, SpawnConditionNode,
} from './spawn-condition.js';
export {
  parseSpawnCondition,
  validateSpawnCondition,
  // C3/P1: the codec's INVERSE. Exported because every importer needs it —
  // see formatSpawnCondition's docstring for the measured regression that
  // proved a one-directional compiler is only half a codec.
  formatSpawnCondition,
  formatConditionSpec,
} from './spawn-condition.js';

export type {
  ScalarValue, DialogueCondition, DialogueEffect,
  DialogueChoice, DialogueNode, DialogueDefinition,
} from './dialogue.js';

export type { PlayerTemplate } from './player-template.js';

export type {
  TraitEffectType, TraitEffect,
  ArchetypeDefinition, BackgroundDefinition,
  TraitDefinition, DisciplineDefinition,
  CrossDisciplineTitle, ClassEntanglement,
  BuildCatalogDefinition,
} from './build-catalog.js';

export type {
  ProgressionEffect, ProgressionNode, ProgressionTreeDefinition,
} from './progression-tree.js';

export type {
  Tileset, TileDefinition, TileLayer, TilePlacement,
  PropDefinition, PropPlacement, AmbientLayer, ParallaxLayer,
} from './visual.js';

export type { CanonAdapter, CanonStarterKit, CanonMotifSceneRef } from './canon-adapter.js';

export type { AssetKind, AssetProvenance, AssetEntry, PackCompatibility, AssetPack } from './assets.js';

export type { WorldProject, WorldProjectRequiredArrayField, WorldProjectOptionalArrayField } from './project.js';
export {
  WORLD_PROJECT_REQUIRED_ARRAY_FIELDS,
  WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS,
} from './project.js';
export { createEmptyProject, normalizeProjectShape, backfillOmittedRequiredArrays } from './project-shape.js';

export type { AuthoringMode } from './authoring-mode.js';
export { AUTHORING_MODES, isValidMode, DEFAULT_MODE, MODE_GRID_DEFAULTS } from './authoring-mode.js';

export type { ValidationError, ValidationResult, ValidateOptions, ClosedUnionSet } from './validate.js';
export {
  validateProject, stampProjectSchemaVersion,
  VALID_CONNECTION_KINDS, VALID_ASSET_KINDS,
  VALID_TRANSITION_TYPES, VALID_ENTITY_ROLES, VALID_ITEM_SLOTS,
  VALID_ITEM_RARITIES, VALID_INTERACTABLE_TYPES,
  VALID_LANDMARK_INTERACTION_TYPES, VALID_AMBIENT_LAYER_TYPES,
  VALID_PHYSICS_MODES, VALID_GRAVITY_DIRECTIONS,
  SCHEMA_VERSION,
} from './validate.js';

export type { CanonAdapterErrorCode } from './canon-adapter.js';
export { CanonAdapterError } from './canon-adapter.js';

export type { AdvisoryItem, AdvisoryResult } from './advisory.js';
export { advisoryValidation } from './advisory.js';

export type { DepStatus, DepDomain, DependencyEdge, DependencySummary, DependencyReport, ScanDependenciesLookups } from './dependencies.js';
export { scanDependencies } from './dependencies.js';

export type {
  HealthStatus, ContentCounts, SystemCompleteness,
  RegionSummary, EncounterSummary, ConnectionSummary,
  ValidationSummary, AdvisorySummary, DependencyHealthSummary,
  ReviewSnapshot, BuildReviewSnapshotOptions,
} from './review.js';
export { classifyHealth, buildReviewSnapshot } from './review.js';
