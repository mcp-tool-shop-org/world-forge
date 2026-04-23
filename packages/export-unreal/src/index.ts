// @world-forge/export-unreal — Unreal Engine 5 export pipeline

export { exportToUnreal } from './export.js';
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
  UnrealActorSpawnEntry, UnrealActorManifest, UnrealBlueprintTag, ConvertEntitiesResult,
} from './convert-entities.js';

export { convertConnections } from './convert-connections.js';
export type { UnrealLevelStreamingHint, ConvertConnectionsResult } from './convert-connections.js';

export { convertWorldPartition } from './convert-world-partition.js';
export type {
  UnrealWorldPartitionHint, ConvertWorldPartitionResult,
} from './convert-world-partition.js';

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
