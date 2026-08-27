/**
 * convert-spawn-points.ts — SpawnPoint → Godot marker nodes.
 *
 * Extra spawn points become Marker2D gizmos in the zone scene. The default
 * spawn's coordinates are consumed by the player CharacterBody2D pawn
 * (scene-builder); extras stay as Marker2D with metadata/is_default.
 */

import type { WorldProject, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, resolveTileSize, type GodotVec2 } from './coordinate-transform.js';
import { uniqueSiblingName } from './node-naming.js';

export interface GodotSpawnMarker {
    /** Godot node name: Marker2D. */
    nodeName: string;
    id: string;
    zoneId: string;
    /** Position relative to zone origin (pixels). */
    localPosition: GodotVec2;
    /** Global position (pixels). */
    globalPosition: GodotVec2;
    isDefault: boolean;
}

export interface ConvertSpawnPointsResult {
    spawnMarkers: GodotSpawnMarker[];
    fidelity: FidelityEntry[];
}

export function convertSpawnPoints(project: WorldProject): ConvertSpawnPointsResult {
    const tileSize = resolveTileSize(project);
    const fidelity: FidelityEntry[] = [];
    const spawnMarkers: GodotSpawnMarker[] = [];
    const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));

    const seenByZone = new Map<string, Map<string, number>>();
    const uniqueNodeName = (zoneId: string, id: string): string => {
        let seen = seenByZone.get(zoneId);
        if (!seen) {
            seen = new Map<string, number>();
            seenByZone.set(zoneId, seen);
        }
        return uniqueSiblingName(seen, `Spawn_${id}`, 'Spawn');
    };

    for (const sp of project.spawnPoints) {
        const zone = zonesById.get(sp.zoneId);
        if (!zone) {
            fidelity.push({
                level: 'dropped',
                domain: 'spawn-points',
                severity: 'error',
                entityId: sp.id,
                fieldPath: `spawnPoints.${sp.id}.zoneId`,
                message: `Spawn point "${sp.id}" dropped — zone "${sp.zoneId}" not found.`,
                reason: 'Orphan zone reference.',
            });
            continue;
        }

        const globalPosition = gridToGodot2D(sp.gridX, sp.gridY, tileSize);
        const localPosition = gridToGodot2D(sp.gridX - zone.gridX, sp.gridY - zone.gridY, tileSize);

        spawnMarkers.push({
            nodeName: uniqueNodeName(sp.zoneId, sp.id),
            id: sp.id,
            zoneId: sp.zoneId,
            localPosition,
            globalPosition,
            isDefault: sp.isDefault,
        });

        fidelity.push({
            level: 'lossless',
            domain: 'spawn-points',
            severity: 'info',
            entityId: sp.id,
            fieldPath: `spawnPoints.${sp.id}`,
            message: `Spawn point "${sp.id}" mapped to Marker2D at (${globalPosition.x}, ${globalPosition.y})px.`,
            reason: 'Direct coordinate mapping — Y-down preserved.',
        });
    }

    return { spawnMarkers, fidelity };
}
