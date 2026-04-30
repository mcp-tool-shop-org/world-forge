/**
 * convert-connections.ts — ZoneConnection → Godot navigation hints.
 *
 * Godot 4's NavigationServer2D uses NavigationLink2D to connect navigation
 * regions across zones. Each ZoneConnection becomes a navigation link
 * descriptor that the runtime can instantiate.
 */

import type { WorldProject, ConnectionKind, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

/** Maps connection kind to a Godot-side transition behavior hint. */
export type GodotTransitionMode = 'walk' | 'door' | 'stairs' | 'portal' | 'teleport';

const KIND_TO_TRANSITION: Record<ConnectionKind, GodotTransitionMode> = {
    passage: 'walk',
    door: 'door',
    stairs: 'stairs',
    road: 'walk',
    portal: 'portal',
    secret: 'door',
    hazard: 'walk',
    channel: 'walk',
    route: 'walk',
    docking: 'door',
    warp: 'teleport',
    trail: 'walk',
};

export interface GodotNavigationLink {
    /** Source zone ID. */
    fromZoneId: string;
    /** Target zone ID. */
    toZoneId: string;
    /** Connection kind (from schema). */
    kind: ConnectionKind;
    bidirectional: boolean;
    label?: string;
    condition?: string;
    /** Godot-side transition behavior. */
    transitionMode: GodotTransitionMode;
    /** Start point in global pixel coords (center of source zone edge). */
    startPosition: GodotVec2;
    /** End point in global pixel coords (center of target zone edge). */
    endPosition: GodotVec2;
}

export interface ConvertConnectionsResult {
    links: GodotNavigationLink[];
    fidelity: FidelityEntry[];
}

export function convertConnections(project: WorldProject): ConvertConnectionsResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];
    const links: GodotNavigationLink[] = [];
    const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));

    for (const c of project.connections) {
        const kind: ConnectionKind = c.kind ?? 'passage';
        const fromZone = zonesById.get(c.fromZoneId);
        const toZone = zonesById.get(c.toZoneId);

        if (!fromZone || !toZone) {
            fidelity.push({
                level: 'dropped',
                domain: 'connections',
                severity: 'error',
                fieldPath: `connections.${c.fromZoneId}->${c.toZoneId}`,
                message: `Connection ${c.fromZoneId} → ${c.toZoneId} dropped — zone not found.`,
                reason: !fromZone ? `Source zone "${c.fromZoneId}" missing.` : `Target zone "${c.toZoneId}" missing.`,
            });
            continue;
        }

        if (c.kind === undefined) {
            fidelity.push({
                level: 'approximated',
                domain: 'connections',
                severity: 'info',
                fieldPath: `connections.${c.fromZoneId}->${c.toZoneId}.kind`,
                message: `Connection ${c.fromZoneId} → ${c.toZoneId} defaulted kind to "passage".`,
                reason: 'No kind authored; using safe default.',
            });
        }

        // Compute edge midpoints for navigation link placement.
        const startPosition = computeEdgeMidpoint(fromZone, toZone, tileSize);
        const endPosition = computeEdgeMidpoint(toZone, fromZone, tileSize);

        links.push({
            fromZoneId: c.fromZoneId,
            toZoneId: c.toZoneId,
            kind,
            bidirectional: c.bidirectional,
            label: c.label,
            condition: c.condition,
            transitionMode: KIND_TO_TRANSITION[kind] ?? 'walk',
            startPosition,
            endPosition,
        });
    }

    return { links, fidelity };
}

/**
 * Compute a point on the edge of `from` closest to `to`.
 * Uses center-to-center direction to pick the nearest edge midpoint.
 */
function computeEdgeMidpoint(from: Zone, to: Zone, tileSize: number): GodotVec2 {
    const fromCenterX = (from.gridX + from.gridWidth / 2) * tileSize;
    const fromCenterY = (from.gridY + from.gridHeight / 2) * tileSize;
    const toCenterX = (to.gridX + to.gridWidth / 2) * tileSize;
    const toCenterY = (to.gridY + to.gridHeight / 2) * tileSize;

    const dx = toCenterX - fromCenterX;
    const dy = toCenterY - fromCenterY;

    // Pick the dominant axis to determine which edge to use.
    if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal: use left or right edge of `from`.
        const edgeX = dx > 0
            ? (from.gridX + from.gridWidth) * tileSize  // right edge
            : from.gridX * tileSize;                     // left edge
        return { x: edgeX, y: fromCenterY };
    } else {
        // Vertical: use top or bottom edge of `from`.
        const edgeY = dy > 0
            ? (from.gridY + from.gridHeight) * tileSize  // bottom edge
            : from.gridY * tileSize;                      // top edge
        return { x: fromCenterX, y: edgeY };
    }
}
