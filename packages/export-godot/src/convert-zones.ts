/**
 * convert-zones.ts — WorldProject zones → Godot Node2D / TileMap scene entries.
 *
 * Each zone becomes a Node2D (or TileMapLayer) in the Godot scene tree.
 * Positions are in pixel coordinates (grid × tileSize), matching Godot 2D.
 */

import type { WorldProject, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, extentToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

export interface GodotZoneResource {
    /** Resource path: res://world_data/zones/<id>.tres */
    resourcePath: string;
    /** Zone ID — round-trip stable. */
    id: string;
    displayName: string;
    description: string;
    tags: string[];
    /** Position in pixels (Y-down). */
    position: GodotVec2;
    /** Size in pixels. */
    size: GodotVec2;
    /** Grid dimensions in tile units. */
    gridWidth: number;
    gridHeight: number;
    light: number;
    noise: number;
    hazards: string[];
    neighbors: string[];
    exits: Array<{ targetZoneId: string; label: string; condition?: string }>;
    interactables: Array<{ name: string; type: string; description?: string }>;
    parentDistrictId?: string;
    backgroundAssetId?: string;
    tilesetId?: string;
    elevation?: number;
    elevationRange?: { floor: number; ceiling: number };
    /** Suggested Godot node name (sanitized for scene tree). */
    nodeName: string;
}

export interface ConvertZonesResult {
    zones: GodotZoneResource[];
    fidelity: FidelityEntry[];
}

/**
 * Sanitize a string for use as a Godot node name.
 * Godot allows most characters but @ and / are problematic in node paths.
 */
function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

export function convertZones(project: WorldProject): ConvertZonesResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];
    const zones: GodotZoneResource[] = project.zones.map((z) => convertZone(z, tileSize, fidelity));
    return { zones, fidelity };
}

function convertZone(z: Zone, tileSize: number, fidelity: FidelityEntry[]): GodotZoneResource {
    const position = gridToGodot2D(z.gridX, z.gridY, tileSize);
    const size = extentToGodot2D(z.gridWidth, z.gridHeight, tileSize);

    // Track fidelity for elevation (Godot 2D flattens it; preserved as metadata).
    if (z.elevation !== undefined && z.elevation !== 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'zones',
            severity: 'info',
            entityId: z.id,
            fieldPath: `zones.${z.id}.elevation`,
            message: `Zone "${z.id}" elevation ${z.elevation}m preserved as metadata, not spatial offset in 2D.`,
            reason: 'Godot 2D has no Z-axis in the scene tree. Elevation stored as resource property.',
        });
    }

    // Parallax layers are handled by convert-scenes (separate pass).
    if (z.parallaxLayers && z.parallaxLayers.length > 0) {
        fidelity.push({
            level: 'lossless',
            domain: 'zones',
            severity: 'info',
            entityId: z.id,
            fieldPath: `zones.${z.id}.parallaxLayers`,
            message: `Zone "${z.id}" has ${z.parallaxLayers.length} parallax layer(s) — mapped to ParallaxBackground nodes.`,
            reason: 'Native Godot ParallaxBackground / ParallaxLayer mapping.',
        });
    }

    return {
        resourcePath: `res://world_data/zones/${z.id}.tres`,
        id: z.id,
        displayName: z.name,
        description: z.description,
        tags: z.tags.slice(),
        position,
        size,
        gridWidth: z.gridWidth,
        gridHeight: z.gridHeight,
        light: z.light,
        noise: z.noise,
        hazards: z.hazards.slice(),
        neighbors: z.neighbors.slice(),
        exits: z.exits.map((e) => ({
            targetZoneId: e.targetZoneId,
            label: e.label,
            condition: e.condition,
        })),
        interactables: z.interactables.map((i) => ({
            name: i.name,
            type: i.type,
            description: i.description,
        })),
        parentDistrictId: z.parentDistrictId,
        backgroundAssetId: z.backgroundId,
        tilesetId: z.tilesetId,
        elevation: z.elevation,
        elevationRange: z.elevationRange ? { floor: z.elevationRange.floor, ceiling: z.elevationRange.ceiling } : undefined,
        nodeName: sanitizeNodeName(z.name),
    };
}
