/**
 * convert-structures.ts — WorldProject town structures → Godot scene nodes.
 *
 * Buildings own an absolute tile footprint (gridX/gridY + width/height), so they
 * export as StaticBody2D nodes at their footprint origin with a tile-sized
 * collision rect (the wall-collision pattern) — a building blocks movement; you
 * enter via its linked interior zone. Hubs and strongholds are zone-attached
 * (no footprint of their own), so each is placed at its zone's center and emitted
 * as a Node2D carrying its data as metadata, like the economy scaffold. Hubs /
 * strongholds whose zoneId resolves to no zone are dropped with a fidelity
 * warning; buildings are never dropped (their coordinates are absolute).
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

export interface GodotBuilding {
    nodeName: string;
    id: string;
    name: string;
    buildingType: string;
    /** Footprint origin (top-left) in pixels. */
    position: GodotVec2;
    /** Footprint size in pixels (drives the collision rect). */
    footprint: { w: number; h: number };
    /** Footprint size in tiles (preserved as metadata). */
    widthTiles: number;
    heightTiles: number;
    zoneId?: string;
    interiorZoneId?: string;
    tags: string[];
}

export interface GodotHub {
    nodeName: string;
    id: string;
    name: string;
    zoneId: string;
    position: GodotVec2;
    hubType: string;
    serviceTypes: string[];
    connectedZoneIds: string[];
}

export interface GodotStronghold {
    nodeName: string;
    id: string;
    name: string;
    zoneId: string;
    position: GodotVec2;
    factionId?: string;
    defenseLevel: number;
    garrisonEntityIds: string[];
}

export interface ConvertStructuresResult {
    buildings: GodotBuilding[];
    hubs: GodotHub[];
    strongholds: GodotStronghold[];
    fidelity: FidelityEntry[];
}

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

export function convertStructures(project: WorldProject): ConvertStructuresResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];

    // Zone-center lookup (pixels) for positioning zone-attached hubs/strongholds.
    const zoneCenter = new Map<string, GodotVec2>();
    for (const z of project.zones) {
        zoneCenter.set(z.id, {
            x: (z.gridX + z.gridWidth / 2) * tileSize,
            y: (z.gridY + z.gridHeight / 2) * tileSize,
        });
    }

    const seen = new Map<string, number>();
    const uniqueName = (base: string): string => {
        const safe = sanitizeNodeName(base) || 'Node';
        const n = seen.get(safe) ?? 0;
        seen.set(safe, n + 1);
        return n === 0 ? safe : `${safe}_${n + 1}`;
    };

    const buildings: GodotBuilding[] = [];
    for (const b of project.buildings ?? []) {
        buildings.push({
            nodeName: uniqueName(`Building_${b.id}`),
            id: b.id,
            name: b.name,
            buildingType: b.buildingType,
            position: { x: b.gridX * tileSize, y: b.gridY * tileSize },
            footprint: { w: Math.max(1, b.width * tileSize), h: Math.max(1, b.height * tileSize) },
            widthTiles: b.width,
            heightTiles: b.height,
            zoneId: b.zoneId,
            interiorZoneId: b.interiorZoneId,
            tags: b.tags.slice(),
        });
    }

    const hubs: GodotHub[] = [];
    let droppedHubs = 0;
    for (const h of project.hubs ?? []) {
        const center = zoneCenter.get(h.zoneId);
        if (!center) {
            droppedHubs++;
            continue;
        }
        hubs.push({
            nodeName: uniqueName(`Hub_${h.id}`),
            id: h.id,
            name: h.name,
            zoneId: h.zoneId,
            position: center,
            hubType: h.hubType,
            serviceTypes: h.serviceTypes.slice(),
            connectedZoneIds: h.connectedZoneIds.slice(),
        });
    }

    const strongholds: GodotStronghold[] = [];
    let droppedStrongholds = 0;
    for (const s of project.strongholds ?? []) {
        const center = zoneCenter.get(s.zoneId);
        if (!center) {
            droppedStrongholds++;
            continue;
        }
        strongholds.push({
            nodeName: uniqueName(`Stronghold_${s.id}`),
            id: s.id,
            name: s.name,
            zoneId: s.zoneId,
            position: center,
            factionId: s.factionId,
            defenseLevel: s.defenseLevel,
            garrisonEntityIds: s.garrisonEntityIds.slice(),
        });
    }

    const dropped = droppedHubs + droppedStrongholds;
    if (dropped > 0) {
        fidelity.push({
            level: 'dropped',
            domain: 'structures',
            severity: 'warning',
            fieldPath: 'hubs/strongholds',
            message: `${dropped} zone-attached structure(s) (${droppedHubs} hub, ${droppedStrongholds} stronghold) reference a zoneId with no matching zone — dropped.`,
            reason: 'A hub/stronghold could not be positioned because its zone was not found.',
        });
    }
    if (buildings.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'structures',
            severity: 'info',
            fieldPath: 'buildings',
            message: `${buildings.length} building(s) exported as StaticBody2D footprints (tile-sized collision rect), with building data as metadata. Interior zones are linked by id; entering is runtime-driven.`,
            reason: 'A building footprint is solid geometry; the door/interior transition is driven by the runtime from interior_zone_id metadata + the content pack.',
        });
    }
    if (hubs.length + strongholds.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'structures',
            severity: 'info',
            fieldPath: 'hubs/strongholds',
            message: `${hubs.length} hub(s) + ${strongholds.length} stronghold(s) exported as Node2D placeholders at zone centers, with their data as metadata.`,
            reason: 'Hubs and strongholds have no authored position; they are placed at their zone center and the runtime drives service/garrison behavior from the metadata + content pack.',
        });
    }

    return { buildings, hubs, strongholds, fidelity };
}
