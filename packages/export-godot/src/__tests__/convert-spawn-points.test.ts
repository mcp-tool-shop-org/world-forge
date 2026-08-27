/**
 * convert-spawn-points.test.ts — SpawnPoint → Marker2D.
 *
 * F-7a98b80b: hyphen/underscore ids sanitized to the same node name without
 * de-dup, so the second Marker2D was silently unaddressable.
 */

import { describe, it, expect } from 'vitest';
import { convertSpawnPoints } from '../convert-spawn-points.js';
import type { WorldProject, SpawnPoint, Zone } from '@world-forge/schema';

function zone(id: string): Zone {
    return { id, gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4 } as unknown as Zone;
}
function proj(zones: Zone[], spawnPoints: SpawnPoint[]): WorldProject {
    return { map: { tileSize: 32 }, zones, spawnPoints } as unknown as WorldProject;
}

describe('convertSpawnPoints', () => {
    it('drops an orphan zoneId with a dropped fidelity error', () => {
        const { spawnMarkers, fidelity } = convertSpawnPoints(proj(
            [zone('z1')],
            [{ id: 'sp1', zoneId: 'ghost', gridX: 1, gridY: 1, isDefault: true }],
        ));
        expect(spawnMarkers).toHaveLength(0);
        expect(fidelity.some((f) => f.level === 'dropped' && f.fieldPath === 'spawnPoints.sp1.zoneId')).toBe(true);
    });

    it('uniquifies hyphen/underscore ids that sanitize to the same node name', () => {
        const { spawnMarkers } = convertSpawnPoints(proj(
            [zone('z1')],
            [
                { id: 'a-b', zoneId: 'z1', gridX: 1, gridY: 1, isDefault: true },
                { id: 'a_b', zoneId: 'z1', gridX: 2, gridY: 2, isDefault: false },
            ],
        ));
        expect(spawnMarkers.map((s) => s.nodeName)).toEqual(['Spawn_a_b', 'Spawn_a_b_2']);
        expect(new Set(spawnMarkers.map((s) => s.nodeName)).size).toBe(2);
    });

    it('maps a valid spawn to Marker2D coordinates', () => {
        const { spawnMarkers } = convertSpawnPoints(proj(
            [zone('z1')],
            [{ id: 'sp-default', zoneId: 'z1', gridX: 2, gridY: 1, isDefault: true }],
        ));
        expect(spawnMarkers[0].globalPosition).toEqual({ x: 64, y: 32 });
        expect(spawnMarkers[0].nodeName).toBe('Spawn_sp_default');
    });
});
