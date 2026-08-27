// @world-forge/export-godot — Godot 4 export pipeline

export { exportToGodot, GODOT_PACK_FORMAT_VERSION } from './export.js';
export type {
    GodotContentPack, GodotPackMeta,
    GodotExportOptions, GodotExportResult, GodotExportError,
} from './export.js';

export { convertZones } from './convert-zones.js';
export type { GodotZoneResource, ConvertZonesResult } from './convert-zones.js';

export { convertDistricts } from './convert-districts.js';
export type { GodotDistrictResource, ConvertDistrictsResult } from './convert-districts.js';

export { convertEntities } from './convert-entities.js';
export type {
    GodotEntityInstance, GodotEntityManifest, GodotDroppedEntity, GodotSceneTemplate, ConvertEntitiesResult,
} from './convert-entities.js';

export { convertItems } from './convert-items.js';
export type { GodotItemResource, ConvertItemsResult } from './convert-items.js';

export { convertConnections } from './convert-connections.js';
export type { GodotNavigationLink, GodotTransitionMode, ConvertConnectionsResult } from './convert-connections.js';

export { convertDialogues } from './convert-dialogues.js';
export type { GodotDialogueResource, GodotDialogueNode, GodotDialogueChoice, ConvertDialoguesResult } from './convert-dialogues.js';

export { convertAssets, deriveGodotFilename, FALLBACK_ASSET_DIR } from './convert-assets.js';
export type { GodotAssetBinding, ConvertAssetsResult } from './convert-assets.js';

export { convertLootTables } from './convert-loot-tables.js';
export type { GodotLootTableResource, GodotLootEntry, ConvertLootTablesResult } from './convert-loot-tables.js';

export { convertSpawnPoints } from './convert-spawn-points.js';
export type { GodotSpawnMarker, ConvertSpawnPointsResult } from './convert-spawn-points.js';

export { convertTransitions } from './convert-transitions.js';
export type { GodotTransitionNode, ConvertTransitionsResult } from './convert-transitions.js';

export { convertTileLayers, encodeTileMapData, fallbackTileColor, cssHexToGodotColor } from './convert-tile-layers.js';
export type {
    GodotTileLayer, GodotTileCell, GodotTileAtlasSource, ConvertTileLayersResult,
} from './convert-tile-layers.js';

export { convertProps } from './convert-props.js';
export type { GodotPropNode, ConvertPropsResult } from './convert-props.js';

export { convertEconomy } from './convert-economy.js';
export type { GodotMarketNode, GodotCraftingStation, ConvertEconomyResult } from './convert-economy.js';

export { convertStructures } from './convert-structures.js';
export type { GodotBuilding, GodotHub, GodotStronghold, ConvertStructuresResult } from './convert-structures.js';

export { convertStrata, STRATUM_Z_BAND } from './convert-strata.js';
export type { GodotStratum, GodotStratumLink, ConvertStrataResult } from './convert-strata.js';

export { convertHazards } from './convert-hazards.js';
export type { GodotHazardPlacement, ConvertHazardsResult } from './convert-hazards.js';

export { convertGates } from './convert-gates.js';
export type { GodotZoneGate, ConvertGatesResult } from './convert-gates.js';

export { buildWorldScene, uniquifyRootNodeNames, RESERVED_ROOT_NODE_NAMES } from './scene-builder.js';
export type { SceneBuildInput } from './scene-builder.js';

export { serializeTres, objectToTresFields, serializeResource } from './tres-serializer.js';
export type { TresField, TresValue } from './tres-serializer.js';

export {
    collectDroppedFieldFidelity, COVERED_FIELDS, KNOWN_DROPPED, ALL_WORLD_PROJECT_FIELDS,
} from './field-coverage.js';

export {
    migrateGodotPack, parseSemVer, compareSemVer, isMigrationError, MIGRATIONS,
} from './migrations.js';
export type { MigrationResult, MigrationError, SemVer } from './migrations.js';

export { uniqueSiblingName, sanitizeNodeName } from './node-naming.js';

export {
    gridToGodot2D, gridToGodot3D, extentToGodot2D, DEFAULT_TILE_SIZE_PX, resolveTileSize,
} from './coordinate-transform.js';
export type { GodotVec2, GodotVec3 } from './coordinate-transform.js';

export { summarizeFidelity, buildFidelityReport, formatDroppedIdentities } from './fidelity.js';
export type {
    FidelityLevel, FidelitySeverity, FidelityDomain,
    FidelityEntry, DomainSummary, FidelitySummary, FidelityReport,
} from './fidelity.js';

