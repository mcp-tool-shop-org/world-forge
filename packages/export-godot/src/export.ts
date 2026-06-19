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
import { buildWorldScene } from './scene-builder.js';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';

export const GODOT_PACK_FORMAT_VERSION = '1.0.0';

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
    /** The generated .tscn scene text (main world scene). */
    worldSceneTscn: string;
}

export interface GodotExportOptions {
    /** Override the project version string in the pack. */
    version?: string;
}

export interface GodotExportResult {
    success: true;
    contentPack: GodotContentPack;
    warnings: string[];
    fidelity: FidelityReport;
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

    // Build the .tscn scene.
    const worldSceneTscn = buildWorldScene({
        projectName: project.name,
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
    });

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
        worldSceneTscn,
    };

    const fidelityReport = buildFidelityReport(fidelityEntries, {
        droppedEntityCount: entitiesResult.manifest.dropped.length,
    });

    return {
        success: true,
        contentPack,
        warnings,
        fidelity: fidelityReport,
    };
}
