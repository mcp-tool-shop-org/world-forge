/**
 * convert-connections.test.ts — ZoneConnection → NavigationLink2D + scene metadata.
 *
 * F-c8fc01b1: connection.condition was copied onto the JSON link but never
 * emitted on the NavigationLink2D node, so a locked door became walkable.
 */

import { describe, it, expect } from 'vitest';
import { convertConnections } from '../convert-connections.js';
import { buildWorldScene, type SceneBuildInput } from '../scene-builder.js';
import type { WorldProject, Zone, ZoneConnection } from '@world-forge/schema';
import type { GodotEntityManifest } from '../convert-entities.js';
import type { GodotZoneResource } from '../convert-zones.js';

function zone(id: string, gridX = 0, gridY = 0): Zone {
    return { id, gridX, gridY, gridWidth: 4, gridHeight: 4 } as unknown as Zone;
}

function proj(zones: Zone[], connections: ZoneConnection[]): WorldProject {
    return { map: { tileSize: 32 }, zones, connections } as unknown as WorldProject;
}

const EMPTY_ENTITIES: GodotEntityManifest = { byZone: {}, all: [], dropped: [], incomplete: false };

describe('convertConnections', () => {
    it('copies condition item:iron-key onto the Godot navigation link', () => {
        const { links } = convertConnections(proj(
            [zone('z1'), zone('z2', 4, 0)],
            [{ fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true, kind: 'door', condition: 'item:iron-key', label: 'Locked door' }],
        ));
        expect(links).toHaveLength(1);
        expect(links[0].condition).toBe('item:iron-key');
        expect(links[0].kind).toBe('door');
        expect(links[0].transitionMode).toBe('door');
    });

    it('drops a connection whose zone is missing', () => {
        const { links, fidelity } = convertConnections(proj(
            [zone('z1')],
            [{ fromZoneId: 'z1', toZoneId: 'ghost', bidirectional: true }],
        ));
        expect(links).toHaveLength(0);
        expect(fidelity.some((f) => f.level === 'dropped' && f.message.includes('ghost'))).toBe(true);
    });

    it('emits metadata/condition on the NavigationLink2D node in the scene', () => {
        const { links } = convertConnections(proj(
            [zone('zone-a'), zone('z2', 4, 0)],
            [{ fromZoneId: 'zone-a', toZoneId: 'z2', bidirectional: true, condition: 'item:iron-key' }],
        ));
        const zoneRes: GodotZoneResource = {
            resourcePath: 'res://world_data/zones/z.tres',
            id: 'zone-a', displayName: 'A', description: '', tags: [],
            position: { x: 0, y: 0 }, size: { x: 128, y: 128 },
            gridWidth: 4, gridHeight: 4, light: 1, noise: 0,
            hazards: [], neighbors: [], exits: [], interactables: [],
            nodeName: 'ZoneA',
        };
        const input: SceneBuildInput = {
            projectName: 'Links',
            zones: [zoneRes],
            entities: EMPTY_ENTITIES,
            items: [],
            navigationLinks: links,
            spawnMarkers: [],
            transitions: [],
        };
        const tscn = buildWorldScene(input);
        expect(tscn).toContain('type="NavigationLink2D"');
        expect(tscn).toContain('metadata/condition = "item:iron-key"');
    });
});
