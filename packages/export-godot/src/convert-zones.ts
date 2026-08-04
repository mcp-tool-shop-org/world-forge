/**
 * convert-zones.ts — WorldProject zones → Godot Node2D / TileMap scene entries.
 *
 * Each zone becomes a Node2D (or TileMapLayer) in the Godot scene tree.
 * Positions are in pixel coordinates (grid × tileSize), matching Godot 2D.
 */

import type { WorldProject, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, extentToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';
import { sanitizeNodeName } from './node-naming.js';

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

export function convertZones(project: WorldProject): ConvertZonesResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];

    // Zone nodes are top-level siblings directly under the scene root (unlike
    // entities/items, which are scoped inside their own zone's container), so
    // de-dup here is a single global map — mirrors convert-hazards.ts /
    // convert-economy.ts / convert-structures.ts / convert-strata.ts. This was
    // the one converter left with neither the empty-name fallback nor the
    // sibling-collision guard every other converter in this package already
    // has (F-00cf78db / F-ea909411):
    //  - An authored zone name that sanitizes to '' produced an empty
    //    `nodeName`, which becomes a literal `parent=""` NodePath on the
    //    zone's own Collision/Navigation/Entities/Items/SpawnPoints/
    //    Transitions containers. That tokenizes as well-formed to
    //    assertParseable()'s NODE_HEADER_RE — a zero-length quoted value is
    //    syntactically valid — but a real Godot 4.7.stable engine segfaults
    //    (signal 11) loading it, inside its own resource loader, before any
    //    script runs.
    //  - Zone.name has no uniqueness constraint (only Zone.id is checked), so
    //    two zones sharing an authored display name is ordinary, schema-legal
    //    content (e.g. two rooms both named "Storage Room"). Godot scene
    //    deserialization does NOT auto-uniquify colliding sibling node names
    //    the way runtime add_child() does, so the second zone becomes
    //    unreachable via get_node()/$Path addressing, silently.
    const seen = new Map<string, number>();
    const uniqueZoneNodeName = (zoneId: string, base: string): string => {
        const safe = sanitizeNodeName(base) || 'Zone';
        const n = seen.get(safe) ?? 0;
        seen.set(safe, n + 1);
        if (n === 0) return safe;
        const deduped = `${safe}_${n + 1}`;
        fidelity.push({
            level: 'approximated',
            domain: 'zones',
            severity: 'warning',
            entityId: zoneId,
            fieldPath: `zones.${zoneId}.name`,
            message: `Zone "${zoneId}" node name "${safe}" collided with another zone's sanitized name — renamed to "${deduped}" so both remain reachable in the scene tree.`,
            reason: 'Zone.name has no uniqueness constraint (only Zone.id is checked), and Godot scene deserialization does not auto-uniquify colliding sibling node names the way runtime add_child() does — an unresolved collision would leave the second zone unreachable via get_node()/$Path addressing.',
        });
        return deduped;
    };

    const zones: GodotZoneResource[] = project.zones.map((z) => convertZone(z, tileSize, fidelity, uniqueZoneNodeName));
    return { zones, fidelity };
}

function convertZone(
    z: Zone,
    tileSize: number,
    fidelity: FidelityEntry[],
    uniqueZoneNodeName: (zoneId: string, base: string) => string,
): GodotZoneResource {
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

    // Parallax layers round-trip in the JSON pack but are NOT yet emitted as
    // ParallaxBackground/ParallaxLayer scene nodes — report that honestly
    // rather than claiming a lossless mapping that doesn't happen.
    if (z.parallaxLayers && z.parallaxLayers.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'zones',
            severity: 'info',
            entityId: z.id,
            fieldPath: `zones.${z.id}.parallaxLayers`,
            message: `Zone "${z.id}" has ${z.parallaxLayers.length} parallax layer(s) preserved as metadata; ParallaxBackground scene-node emission is not yet implemented.`,
            reason: 'Parallax data round-trips in the pack; .tscn ParallaxBackground nodes are a planned enhancement.',
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
        nodeName: uniqueZoneNodeName(z.id, z.name),
    };
}
