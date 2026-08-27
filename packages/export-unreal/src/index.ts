// @world-forge/export-unreal — Unreal Engine 5 export pipeline

export { exportToUnreal, UNREAL_PACK_FORMAT_VERSION } from './export.js';
export type {
  UnrealContentPack, UnrealPackMeta,
  UnrealExportOptions, UnrealExportResult, UnrealExportError,
  PackSignature, SigningAlgorithm,
} from './export.js';

export { importFromUnreal } from './import.js';
export type { UnrealImportResult, UnrealImportError } from './import.js';

export { convertZones } from './convert-zones.js';
export type { UnrealZoneDataAsset, UnrealParallaxLayer, ConvertZonesResult } from './convert-zones.js';

export { convertDistricts } from './convert-districts.js';
export type { UnrealDistrictDataAsset, ConvertDistrictsResult } from './convert-districts.js';

export { convertEntities } from './convert-entities.js';
export type {
  UnrealActorSpawnEntry, UnrealActorManifest, UnrealBlueprintTag, UnrealDroppedEntity, ConvertEntitiesResult,
} from './convert-entities.js';

export { convertConnections } from './convert-connections.js';
export type { UnrealLevelStreamingHint, ConvertConnectionsResult } from './convert-connections.js';

export { convertWorldPartition } from './convert-world-partition.js';
export type {
  UnrealWorldPartitionHint, ConvertWorldPartitionResult,
} from './convert-world-partition.js';

export { convertParallax } from './convert-parallax.js';
export type {
  UnrealParallaxActor, UnrealParallaxManifest, ConvertParallaxResult,
} from './convert-parallax.js';

export { convertTransitions } from './convert-transitions.js';
export type {
  UnrealTransitionEntity, UnrealDroppedTransition, ConvertTransitionsResult,
} from './convert-transitions.js';

export {
  pixelsToUnrealCm, elevationToZ, worldForgeToUnrealAxis, gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
} from './coordinate-transform.js';
export type { UnrealVec3, WorldForgePoint } from './coordinate-transform.js';

export { summarizeFidelity, buildFidelityReport } from './fidelity.js';
export type {
  FidelityLevel, FidelitySeverity, FidelityDomain,
  FidelityEntry, DomainSummary, FidelitySummary, FidelityReport,
} from './fidelity.js';

// UE-FT-008: schema versioning + migration framework (browser-safe)
export {
  migratePack, parseSemVer, compareSemVer, isMigrationError, MIGRATIONS,
} from './migrations.js';
export type {
  SemVer, Migration, MigrationResult, MigrationError, MigrationWarning,
} from './migrations.js';

// F-36785d5f: Node-only APIs (node:crypto / node:fs) are NOT re-exported from
// this browser-safe barrel. Import them from the dedicated subpaths:
//   @world-forge/export-unreal/signing
//   @world-forge/export-unreal/summary
//   @world-forge/export-unreal/diff
// PackSignature / SigningAlgorithm types live on UnrealPackMeta (export.ts)
// as type-only imports, so they do not pull node:crypto into this graph.
