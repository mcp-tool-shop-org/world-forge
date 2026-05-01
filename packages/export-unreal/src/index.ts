// @world-forge/export-unreal — Unreal Engine 5 export pipeline

export { exportToUnreal, UNREAL_PACK_FORMAT_VERSION } from './export.js';
export type {
  UnrealContentPack, UnrealPackMeta,
  UnrealExportOptions, UnrealExportResult, UnrealExportError,
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
  UnrealTransitionEntity, ConvertTransitionsResult,
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

// ── Node-only APIs (require node:crypto / node:fs) ────────────
// These functions are NOT browser-safe. Import them only in Node.js contexts.

// UE-FT-007: pack signing (node:crypto)
export { signMeta, composeSignedMeta, verifyPackSignature } from './signing.js';
export type { PackSignature, SigningAlgorithm, VerifyResult } from './signing.js';

// UE-FT-005: CLI summary + diff helpers (node:fs)
export { summarizePack, formatSummary } from './summary.js';
export type { PackSummary, SummaryError } from './summary.js';
export { diffPacks, formatDiff } from './diff.js';
export type { PackDiff, CategoryDiff, DiffError } from './diff.js';
