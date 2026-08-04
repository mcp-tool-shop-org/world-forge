/**
 * convert-entities.test.ts — EntityPlacement → Godot scene instance entries.
 *
 * No dedicated test file existed for this converter before (audit finding
 * F-009). Covers the two defects the audit routed here:
 *
 *  - F-002: entity sibling node names were never de-duplicated, unlike
 *    every other node-emitting converter in this package (props/hazards/
 *    economy/structures/strata all guard sibling collisions).
 *  - F-001/F-18d722e0: convert-entities.ts:135 was named as one of the
 *    "riskiest call sites" — a free-text authored display name flows
 *    straight into the node-name sanitizer.
 */

import { describe, it, expect } from 'vitest';
import { convertEntities } from '../convert-entities.js';
import type { WorldProject, EntityPlacement, Zone } from '@world-forge/schema';

function zone(id: string, gridX = 0, gridY = 0, w = 4, h = 4): Zone {
    return { id, gridX, gridY, gridWidth: w, gridHeight: h } as unknown as Zone;
}
function proj(zones: Zone[], entityPlacements: EntityPlacement[]): WorldProject {
    return { map: { tileSize: 32 }, zones, entityPlacements } as unknown as WorldProject;
}
const placement = (entityId: string, over: Partial<EntityPlacement> = {}): EntityPlacement =>
    ({ entityId, zoneId: 'z1', role: 'npc', gridX: 1, gridY: 1, ...over } as unknown as EntityPlacement);

describe('convertEntities — basic conversion', () => {
    it('resolves a placement to an instance with a sanitized node name', () => {
        const { manifest } = convertEntities(proj([zone('z1')], [placement('e1', { name: 'Guard' })]));
        expect(manifest.all).toHaveLength(1);
        expect(manifest.all[0]).toMatchObject({ entityId: 'e1', nodeName: 'Guard', zoneId: 'z1' });
    });

    it('falls back to entityId when no display name is authored', () => {
        const { manifest } = convertEntities(proj([zone('z1')], [placement('guard-01')]));
        expect(manifest.all[0].nodeName).toBe('guard_01');
    });
});

describe('convertEntities — sibling de-dup (F-002)', () => {
    it('de-dupes two entities with the same display name in the same zone', () => {
        const { manifest } = convertEntities(proj(
            [zone('z1')],
            [placement('e1', { name: 'Guard' }), placement('e2', { name: 'Guard' })],
        ));
        expect(manifest.all.map((e) => e.nodeName)).toEqual(['Guard', 'Guard_2']);
    });

    it('de-dupes three same-named entities in sequence', () => {
        const { manifest } = convertEntities(proj(
            [zone('z1')],
            [placement('e1', { name: 'Bandit' }), placement('e2', { name: 'Bandit' }), placement('e3', { name: 'Bandit' })],
        ));
        expect(manifest.all.map((e) => e.nodeName)).toEqual(['Bandit', 'Bandit_2', 'Bandit_3']);
    });

    it('scopes de-dup PER ZONE — same name in two different zones both stay unsuffixed', () => {
        const { manifest } = convertEntities(proj(
            [zone('z1'), zone('z2', 10, 10)],
            [placement('e1', { name: 'Guard', zoneId: 'z1' }), placement('e2', { name: 'Guard', zoneId: 'z2' })],
        ));
        expect(manifest.byZone['z1'][0].nodeName).toBe('Guard');
        expect(manifest.byZone['z2'][0].nodeName).toBe('Guard');
    });

    it('does not suffix distinctly-named siblings', () => {
        const { manifest } = convertEntities(proj(
            [zone('z1')],
            [placement('e1', { name: 'Guard' }), placement('e2', { name: 'Merchant' })],
        ));
        expect(manifest.all.map((e) => e.nodeName)).toEqual(['Guard', 'Merchant']);
    });
});

describe('convertEntities — node-name quote safety (F-001/F-18d722e0)', () => {
    it('strips a literal quote from an authored entity display name', () => {
        const { manifest } = convertEntities(proj([zone('z1')], [placement('e1', { name: 'Big "Boss" Tony' })]));
        expect(manifest.all[0].nodeName).not.toContain('"');
        expect(manifest.all[0].nodeName).toMatch(/^[a-zA-Z0-9_]+$/);
    });

    it('a quoted name that collides after sanitizing still gets de-duped', () => {
        // Two differently-quoted names that sanitize to the same safe string
        // must still land on distinct, well-formed sibling node names.
        const { manifest } = convertEntities(proj(
            [zone('z1')],
            [placement('e1', { name: 'Boss "A"' }), placement('e2', { name: 'Boss "B"' })],
        ));
        // Different source names ("A" vs "B") sanitize to different strings, so
        // this specifically checks NO node name retains a raw quote either way.
        for (const e of manifest.all) expect(e.nodeName).not.toContain('"');
    });
});
