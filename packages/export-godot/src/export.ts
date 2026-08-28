/**
 * export.ts — Full export pipeline: WorldProject → GodotContentPack + fidelity report.
 *
 * Peer to `@world-forge/export-unreal` but targeted at Godot 4 projects.
 * Produces structured JSON (for data-driven loading) plus .tscn scene text
 * (for direct import into the Godot editor).
 */

import type { WorldProject, ValidationError } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

import { convertZones, type GodotZoneResource } from './convert-zones.js';
import { convertDistricts, type GodotDistrictResource } from './convert-districts.js';
import { convertEntities, type GodotEntityManifest } from './convert-entities.js';
import { convertItems, type GodotItemResource } from './convert-items.js';
import { convertConnections, type GodotNavigationLink } from './convert-connections.js';
import { convertDialogues, type GodotDialogueResource } from './convert-dialogues.js';
import { convertAssets, type GodotAssetBinding } from './convert-assets.js';
import { convertLootTables, type GodotLootTableResource } from './convert-loot-tables.js';
import { convertSpawnPoints, type GodotSpawnMarker } from './convert-spawn-points.js';
import { convertTransitions, type GodotTransitionNode } from './convert-transitions.js';
import { convertTileLayers, type GodotTileLayer } from './convert-tile-layers.js';
import { convertProps, type GodotPropNode } from './convert-props.js';
import { convertEconomy, type GodotMarketNode, type GodotCraftingStation } from './convert-economy.js';
import { convertStructures, type GodotBuilding, type GodotHub, type GodotStronghold } from './convert-structures.js';
import { convertStrata, type GodotStratum, type GodotStratumLink } from './convert-strata.js';
import { convertHazards, type GodotHazardPlacement } from './convert-hazards.js';
import { convertGates, type GodotZoneGate } from './convert-gates.js';
import { buildWorldScene } from './scene-builder.js';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';
import { collectDroppedFieldFidelity } from './field-coverage.js';
import { serializeResource } from './tres-serializer.js';
import { planAuthoredAssetCopies, type GodotAssetCopy } from './copy-assets.js';
import { PLAYER_MOVE_SCRIPT, PLAYER_SCRIPT_PATH, WORLD_RUNTIME_SCRIPT, WORLD_RUNTIME_SCRIPT_PATH } from './godot-project.js';

export type { GodotAssetCopy } from './copy-assets.js';

/**
 * Pack format version (semver). Bump rules:
 *   - **Major** — required field added/removed, or field semantics change.
 *   - **Minor** — optional field added (old loaders ignore it).
 *   - **Patch** — clarifications, doc-only changes.
 * When the pack shape changes, bump this constant and add a migration in
 * migrations.ts. 1.1.0 added `files` (resourcePath → .tres body) and
 * `zoneGates` on the JSON pack.
 */
export const GODOT_PACK_FORMAT_VERSION = '1.1.0';

export interface GodotPackMeta {
    id: string;
    name: string;
    description?: string;
    version: string;
    author?: string;
    license?: string;
    formatVersion: string;
    sourceProjectId: string;
    tileSize: number;
    gridWidth: number;
    gridHeight: number;
}

export interface GodotContentPack {
    meta: GodotPackMeta;
    zones: GodotZoneResource[];
    districts: GodotDistrictResource[];
    entities: GodotEntityManifest;
    items: GodotItemResource[];
    navigationLinks: GodotNavigationLink[];
    dialogues: GodotDialogueResource[];
    assets: GodotAssetBinding[];
    lootTables: GodotLootTableResource[];
    spawnMarkers: GodotSpawnMarker[];
    transitions: GodotTransitionNode[];
    tileLayers: GodotTileLayer[];
    props: GodotPropNode[];
    markets: GodotMarketNode[];
    craftingStations: GodotCraftingStation[];
    buildings: GodotBuilding[];
    hubs: GodotHub[];
    strongholds: GodotStronghold[];
    strata: GodotStratum[];
    stratumLinks: GodotStratumLink[];
    hazards: GodotHazardPlacement[];
    /** Entry gates copied onto the JSON pack (same data as zone-node scene metadata). */
    zoneGates: GodotZoneGate[];
    /**
     * Map of stamped `resourcePath` → `.tres` file body. Every zone, district,
     * dialogue, loot table, and item resourcePath has an entry so
     * ResourceLoader.load() can resolve the path against this pack.
     */
    files: Record<string, string>;
    /** The generated .tscn scene text (main world scene). Empty when includeWorldTscn is false. */
    worldSceneTscn: string;
}

export interface GodotExportOptions {
    /** Override the project version string in the pack. */
    version?: string;
    /** When false, skip .tscn generation (worldSceneTscn is ''). Default true. */
    includeWorldTscn?: boolean;
    /** Prefix for the per-project scene uid (default `wf` → uid://wf_<project.id>). */
    sceneUidPrefix?: string;
    /**
     * Directory used to resolve authored AssetEntry.path / tileset.imagePath /
     * prop.imagePath as local files (typically the folder of the project JSON).
     * When omitted, image-copy planning is skipped.
     */
    assetBaseDir?: string;
}

export interface GodotExportResult {
    success: true;
    contentPack: GodotContentPack;
    warnings: string[];
    fidelity: FidelityReport;
    /** Local image files to copy under --out at destRel (res:// stripped). */
    assetCopies: GodotAssetCopy[];
}

export interface GodotExportError {
    success: false;
    errors: ValidationError[];
}

export function exportToGodot(
    project: WorldProject,
    options?: GodotExportOptions,
): GodotExportResult | GodotExportError {
    const validation = validateProject(project);
    if (!validation.valid) {
        return { success: false, errors: validation.errors };
    }

    const warnings: string[] = [];
    const fidelityEntries: FidelityEntry[] = [];

    // Run all converters. Wrap in try/catch for structured error on converter bugs.
    let zonesResult: ReturnType<typeof convertZones>;
    let districtsResult: ReturnType<typeof convertDistricts>;
    let entitiesResult: ReturnType<typeof convertEntities>;
    let itemsResult: ReturnType<typeof convertItems>;
    let connectionsResult: ReturnType<typeof convertConnections>;
    let dialoguesResult: ReturnType<typeof convertDialogues>;
    let assetsResult: ReturnType<typeof convertAssets>;
    let lootResult: ReturnType<typeof convertLootTables>;
    let spawnResult: ReturnType<typeof convertSpawnPoints>;
    let transitionsResult: ReturnType<typeof convertTransitions>;
    let tileLayersResult: ReturnType<typeof convertTileLayers>;
    let propsResult: ReturnType<typeof convertProps>;
    let economyResult: ReturnType<typeof convertEconomy>;
    let structuresResult: ReturnType<typeof convertStructures>;
    let strataResult: ReturnType<typeof convertStrata>;
    let hazardsResult: ReturnType<typeof convertHazards>;
    let gatesResult: ReturnType<typeof convertGates>;

    try {
        zonesResult = convertZones(project);
        districtsResult = convertDistricts(project);
        entitiesResult = convertEntities(project);
        itemsResult = convertItems(project);
        connectionsResult = convertConnections(project);
        dialoguesResult = convertDialogues(project);
        assetsResult = convertAssets(project);
        lootResult = convertLootTables(project);
        spawnResult = convertSpawnPoints(project);
        transitionsResult = convertTransitions(project);
        tileLayersResult = convertTileLayers(project);
        propsResult = convertProps(project);
        economyResult = convertEconomy(project);
        structuresResult = convertStructures(project);
        strataResult = convertStrata(project);
        hazardsResult = convertHazards(project);
        gatesResult = convertGates(project);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            errors: [{ path: 'converter', message: `Converter failed: ${message}. Report this as a bug.` }],
        };
    }

    // Collect fidelity entries from all converters.
    fidelityEntries.push(...zonesResult.fidelity);
    fidelityEntries.push(...districtsResult.fidelity);
    fidelityEntries.push(...entitiesResult.fidelity);
    fidelityEntries.push(...itemsResult.fidelity);
    fidelityEntries.push(...connectionsResult.fidelity);
    fidelityEntries.push(...dialoguesResult.fidelity);
    fidelityEntries.push(...assetsResult.fidelity);
    fidelityEntries.push(...lootResult.fidelity);
    fidelityEntries.push(...spawnResult.fidelity);
    fidelityEntries.push(...transitionsResult.fidelity);
    fidelityEntries.push(...tileLayersResult.fidelity);
    fidelityEntries.push(...propsResult.fidelity);
    fidelityEntries.push(...economyResult.fidelity);
    fidelityEntries.push(...structuresResult.fidelity);
    fidelityEntries.push(...strataResult.fidelity);
    fidelityEntries.push(...hazardsResult.fidelity);
    fidelityEntries.push(...gatesResult.fidelity);
    fidelityEntries.push(...collectDroppedFieldFidelity(project));

    let assetCopies: GodotAssetCopy[] = [];
    if (options?.assetBaseDir) {
        const planned = planAuthoredAssetCopies({
            assets: assetsResult.assets,
            tilesets: project.tilesets ?? [],
            props: project.props ?? [],
            baseDir: options.assetBaseDir,
        });
        assetCopies = planned.copies;
        fidelityEntries.push(...planned.fidelity);
    }

    // Advisory warnings.
    if (project.entityPlacements.length === 0) {
        warnings.push('No entity placements — the exported world will have no NPCs/enemies.');
    }
    if (project.connections.length === 0 && project.zones.length > 1) {
        warnings.push('Multiple zones but no connections — NavigationLink2D nodes will not be generated.');
    }
    if (project.assets.length === 0) {
        warnings.push('No assets declared — the Godot project will need manual asset binding.');
    }
    if (project.spawnPoints.length === 0) {
        warnings.push('No spawn points — player start position is undefined.');
    }
    if (entitiesResult.manifest.incomplete) {
        warnings.push(`${entitiesResult.manifest.dropped.length} entity/entities dropped due to orphan zone references.`);
    }

    let worldSceneTscn = '';
    if (options?.includeWorldTscn !== false) {
        try {
            worldSceneTscn = buildWorldScene({
                projectName: project.name,
                projectId: project.id,
                sceneUidPrefix: options?.sceneUidPrefix,
                tileSize: project.map.tileSize,
                fidelity: fidelityEntries,
                zones: zonesResult.zones,
                entities: entitiesResult.manifest,
                items: itemsResult.items,
                navigationLinks: connectionsResult.links,
                spawnMarkers: spawnResult.spawnMarkers,
                transitions: transitionsResult.transitions,
                tileLayers: tileLayersResult.tileLayers,
                props: propsResult.props,
                markets: economyResult.markets,
                craftingStations: economyResult.craftingStations,
                buildings: structuresResult.buildings,
                hubs: structuresResult.hubs,
                strongholds: structuresResult.strongholds,
                strata: strataResult.strata,
                stratumLinks: strataResult.links,
                zoneStrata: strataResult.zoneStrata,
                hazards: hazardsResult.placements,
                zoneGates: gatesResult.zoneGates,
                dialogues: dialoguesResult.dialogues.map((d) => ({ id: d.id, resourcePath: d.resourcePath })),
                lootTables: lootResult.lootTables.map((t) => ({ id: t.id, resourcePath: t.resourcePath })),
                playerTemplate: project.playerTemplate
                    ? {
                        name: project.playerTemplate.name,
                        baseStats: project.playerTemplate.baseStats,
                        baseResources: project.playerTemplate.baseResources,
                        spawnPointId: project.playerTemplate.spawnPointId,
                        tags: project.playerTemplate.tags,
                        startingInventory: project.playerTemplate.startingInventory,
                    }
                    : undefined,
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                success: false,
                errors: [{ path: 'scene', message }],
            };
        }
    }

    const proj = project as unknown as Record<string, unknown>;
    const meta: GodotPackMeta = {
        id: `${project.id}-godot`,
        name: project.name,
        description: (proj.description as string | undefined),
        version: options?.version ?? (proj.version as string | undefined) ?? '1.0.0',
        author: project.author,
        license: project.license,
        formatVersion: GODOT_PACK_FORMAT_VERSION,
        sourceProjectId: project.id,
        tileSize: project.map.tileSize,
        gridWidth: project.map.gridWidth,
        gridHeight: project.map.gridHeight,
    };

    const contentPack: GodotContentPack = {
        meta,
        zones: zonesResult.zones,
        districts: districtsResult.districts,
        entities: entitiesResult.manifest,
        items: itemsResult.items,
        navigationLinks: connectionsResult.links,
        dialogues: dialoguesResult.dialogues,
        assets: assetsResult.assets,
        lootTables: lootResult.lootTables,
        spawnMarkers: spawnResult.spawnMarkers,
        transitions: transitionsResult.transitions,
        tileLayers: tileLayersResult.tileLayers,
        props: propsResult.props,
        markets: economyResult.markets,
        craftingStations: economyResult.craftingStations,
        buildings: structuresResult.buildings,
        hubs: structuresResult.hubs,
        strongholds: structuresResult.strongholds,
        strata: strataResult.strata,
        stratumLinks: strataResult.links,
        hazards: hazardsResult.placements,
        zoneGates: Object.values(gatesResult.zoneGates),
        files: {
            ...collectTresFiles({
                zones: zonesResult.zones,
                districts: districtsResult.districts,
                dialogues: dialoguesResult.dialogues,
                lootTables: lootResult.lootTables,
                items: itemsResult.items,
            }),
            [PLAYER_SCRIPT_PATH]: PLAYER_MOVE_SCRIPT,
            [WORLD_RUNTIME_SCRIPT_PATH]: WORLD_RUNTIME_SCRIPT,
        },
        worldSceneTscn,
    };

    const fidelityReport = buildFidelityReport(fidelityEntries, {
        droppedEntityCount: entitiesResult.manifest.dropped.length,
    });

    // Promote drop/approximation loss onto warnings[] so a warnings-only
    // consumer sees the same authored content that vanished from the pack.
    // Keep the four empty-world advisories above; this copies every
    // level:'dropped' entry and every approximated entry at error/warning
    // severity (info approximations stay in the fidelity report only).
    if (fidelityReport.summary.dropped > 0) {
        warnings.push(`${fidelityReport.summary.dropped} authored field(s)/object(s) dropped during Godot export.`);
    }
    const seenWarning = new Set(warnings);
    for (const e of fidelityEntries) {
        const promote = e.level === 'dropped'
            || (e.level === 'approximated' && (e.severity === 'error' || e.severity === 'warning'));
        if (!promote) continue;
        if (seenWarning.has(e.message)) continue;
        seenWarning.add(e.message);
        warnings.push(e.message);
    }

    return {
        success: true,
        contentPack,
        warnings,
        fidelity: fidelityReport,
        assetCopies,
    };
}

function collectTresFiles(parts: {
    zones: GodotZoneResource[];
    districts: GodotDistrictResource[];
    dialogues: GodotDialogueResource[];
    lootTables: GodotLootTableResource[];
    items: GodotItemResource[];
}): Record<string, string> {
    const files: Record<string, string> = {};
    const put = (className: string, path: string, obj: object) => {
        files[path] = serializeResource(className, obj as Record<string, unknown>);
    };
    for (const z of parts.zones) put('GodotZoneResource', z.resourcePath, z);
    for (const d of parts.districts) put('GodotDistrictResource', d.resourcePath, d);
    for (const dlg of parts.dialogues) put('GodotDialogueResource', dlg.resourcePath, dlg);
    for (const t of parts.lootTables) put('GodotLootTableResource', t.resourcePath, t);
    for (const i of parts.items) put('GodotItemResource', i.resourcePath, i);
    return files;
}
