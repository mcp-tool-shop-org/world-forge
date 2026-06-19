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
 *   - Runtime will accept a v4.0 JSON under v4.2 without modification; new
 *     optional fields (e.g. 2.5D parallax layers, skylineRef) simply default
 *     to undefined.
 *   - v5.0+ will ship with a migration tool that reads earlier major projects
 *     and writes a v5 JSON. Do not rely on hand-editing to cross a major.
 *
 * When evolving the schema, prefer additive, optional-field changes so that
 * authored worlds keep opening without a migration pass.
 */

export type {
  WorldMap, Zone, ZoneExit, ZoneElevationRange, Interactable,
  ZoneConnection, ConnectionKind, Landmark,
  TransitionEntity, TransitionEntityType,
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
export { parseSpawnCondition, validateSpawnCondition } from './spawn-condition.js';

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

export type { WorldProject } from './project.js';

export type { AuthoringMode } from './authoring-mode.js';
export { AUTHORING_MODES, isValidMode, DEFAULT_MODE } from './authoring-mode.js';

export type { ValidationError, ValidationResult, ValidateOptions } from './validate.js';
export { validateProject, VALID_CONNECTION_KINDS, VALID_ASSET_KINDS, SCHEMA_VERSION } from './validate.js';

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
