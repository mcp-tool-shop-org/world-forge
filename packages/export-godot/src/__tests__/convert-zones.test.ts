/**
 * convert-zones.test.ts — WorldProject zones → Godot Node2D scene entries.
 *
 * No dedicated test file existed for this converter before (Stage-A amend).
 * Covers the two defects the audit routed here — convert-zones.ts was the one
 * remaining converter in this package with neither the empty-name fallback
 * nor the sibling-collision guard every other converter (hazards/economy/
 * structures/strata/entities/items) already has:
 *
 *  - F-00cf78db: an authored zone name that sanitizes to '' produced an empty
 *    `nodeName`, which becomes a literal `parent=""` NodePath on the zone's
 *    own Collision/Navigation/Entities/Items/SpawnPoints/Transitions
 *    containers. Godot's own tag-header tokenizer accepts an empty quoted
 *    value as syntactically well-formed, so assertParseable() never caught
 *    it — but the real, installed Godot 4.7.stable engine segfaults (signal
 *    11) loading it, inside its own resource loader, before any script runs.
 *  - F-ea909411: Zone.name has no uniqueness constraint (only Zone.id is
 *    checked), so two zones sharing an authored display name is ordinary,
 *    schema-legal content. Godot scene deserialization does NOT auto-
 *    uniquify colliding sibling node names the way runtime add_child() does,
 *    so the second zone becomes unreachable via get_node()/$Path addressing,
 *    silently — the exact failure class the entities/items fix (F-1b6ef1b6)
 *    described, reproduced at the zone level.
 */

import { describe, it, expect } from 'vitest';
import { convertZones } from '../convert-zones.js';
import type { WorldProject, Zone } from '@world-forge/schema';

function zone(id: string, name: string, over: Partial<Zone> = {}): Zone {
    return {
        id,
        name,
        tags: [],
        description: 'A zone.',
        gridX: 0,
        gridY: 0,
        gridWidth: 4,
        gridHeight: 4,
        neighbors: [],
        exits: [],
        interactables: [],
        light: 5,
        noise: 0,
        hazards: [],
        ...over,
    } as unknown as Zone;
}

function proj(zones: Zone[]): WorldProject {
    return { map: { tileSize: 32 }, zones } as unknown as WorldProject;
}

describe('convertZones — basic conversion', () => {
    it('sanitizes a normal display name into a node name', () => {
        const { zones } = convertZones(proj([zone('zone-entrance', 'Entrance Hall')]));
        expect(zones[0].nodeName).toBe('Entrance_Hall');
    });

    it('passes collisionType through so the scene builder can honour void/hazard hulls', () => {
        const { zones } = convertZones(proj([zone('z1', 'Pit', { collisionType: 'void' })]));
        expect(zones[0].collisionType).toBe('void');
    });
});

describe('convertZones — empty-name fallback (F-00cf78db)', () => {
    it('falls back to "Zone" when the authored name sanitizes to the empty string', () => {
        const { zones } = convertZones(proj([zone('z1', '')]));
        expect(zones[0].nodeName).toBe('Zone');
    });

    it('CONTROL: an all-symbol name does NOT need the fallback — sanitizeNodeName substitutes char-for-char, never deletes', () => {
        // Only a truly empty *input* sanitizes to an empty result: sanitizeNodeName
        // substitutes each disallowed character with '_' (or collapses a whitespace
        // RUN to one '_'), it never deletes down to nothing. So '!!!' (three
        // symbols) lands on '___' — non-empty — and the 'Zone' fallback correctly
        // never fires for it. This exists to pin the boundary precisely: the
        // fallback's job is the '' case, not the "ugly but non-empty" case.
        const { zones } = convertZones(proj([zone('z1', '!!!')]));
        expect(zones[0].nodeName).toBe('___');
        expect(zones[0].nodeName).not.toBe('Zone');
    });

    it('never emits an empty nodeName, for any authored input', () => {
        for (const badName of ['', '   ', '"""', '///']) {
            const { zones } = convertZones(proj([zone('z1', badName)]));
            expect(zones[0].nodeName.length).toBeGreaterThan(0);
        }
    });

    it('CONTROL: a normally-authored zone name is unaffected by the fallback', () => {
        const { zones } = convertZones(proj([zone('z1', 'Cellar')]));
        expect(zones[0].nodeName).toBe('Cellar');
    });
});

describe('convertZones — sibling de-dup (F-ea909411)', () => {
    it('de-dupes two zones with the same authored display name', () => {
        const { zones } = convertZones(proj([
            zone('zone-entrance', 'Entrance Hall'),
            zone('zone-cellar', 'Entrance Hall'),
        ]));
        expect(zones.map((z) => z.nodeName)).toEqual(['Entrance_Hall', 'Entrance_Hall_2']);
    });

    it('de-dupes three same-named zones in sequence', () => {
        const { zones } = convertZones(proj([
            zone('a', 'Storage Room'),
            zone('b', 'Storage Room'),
            zone('c', 'Storage Room'),
        ]));
        expect(zones.map((z) => z.nodeName)).toEqual(['Storage_Room', 'Storage_Room_2', 'Storage_Room_3']);
    });

    it('CONTROL: does not suffix distinctly-named zones', () => {
        const { zones } = convertZones(proj([
            zone('zone-entrance', 'Entrance Hall'),
            zone('zone-cellar', 'Cellar'),
        ]));
        expect(zones.map((z) => z.nodeName)).toEqual(['Entrance_Hall', 'Cellar']);
    });

    it('de-dupes GLOBALLY across the whole project — zones are scene-root siblings, unlike per-zone-scoped entities/items', () => {
        const { zones } = convertZones(proj([
            zone('a', 'Room', { parentDistrictId: 'district-1' } as Partial<Zone>),
            zone('b', 'Room', { parentDistrictId: 'district-2' } as Partial<Zone>),
        ]));
        expect(zones.map((z) => z.nodeName)).toEqual(['Room', 'Room_2']);
    });

    it('a collision between two empty-named zones still de-dupes through the fallback', () => {
        const { zones } = convertZones(proj([zone('a', ''), zone('b', '')]));
        expect(zones.map((z) => z.nodeName)).toEqual(['Zone', 'Zone_2']);
    });

    it('pushes an approximated fidelity entry naming the de-duplicated zone when a collision happens', () => {
        const { fidelity } = convertZones(proj([
            zone('zone-entrance', 'Entrance Hall'),
            zone('zone-cellar', 'Entrance Hall'),
        ]));
        const collisionEntry = fidelity.find((f) => f.fieldPath === 'zones.zone-cellar.name');
        expect(collisionEntry).toBeDefined();
        expect(collisionEntry?.level).toBe('approximated');
        expect(collisionEntry?.domain).toBe('zones');
        expect(collisionEntry?.severity).toBe('warning');
        expect(collisionEntry?.entityId).toBe('zone-cellar');
        expect(collisionEntry?.message).toContain('Entrance_Hall');
    });

    it('CONTROL: distinctly-named zones push no name-collision fidelity entry', () => {
        const { fidelity } = convertZones(proj([
            zone('zone-entrance', 'Entrance Hall'),
            zone('zone-cellar', 'Cellar'),
        ]));
        expect(fidelity.some((f) => f.fieldPath?.endsWith('.name'))).toBe(false);
    });

    it('END TO END: reproduces the exact minimalProject-style duplicate (two zones both "Entrance Hall") with distinct ids', () => {
        // Mirrors the audit's own repro: @world-forge/schema's canonical
        // minimalProject fixture has zones 'zone-entrance'/'zone-cellar' —
        // this sets the second zone's name equal to the first's, which is
        // ordinary schema-legal content (only Zone.id is unique).
        const project = {
            map: { tileSize: 32, gridWidth: 20, gridHeight: 20 },
            zones: [
                zone('zone-entrance', 'Entrance Hall', { gridX: 0, gridY: 0 }),
                zone('zone-cellar', 'Entrance Hall', { gridX: 0, gridY: 10 }),
            ],
        } as unknown as WorldProject;

        const { zones } = convertZones(project);
        expect(zones).toHaveLength(2);
        expect(new Set(zones.map((z) => z.nodeName)).size).toBe(2); // no silent collision
        expect(zones.map((z) => z.nodeName)).toEqual(['Entrance_Hall', 'Entrance_Hall_2']);
    });
});
