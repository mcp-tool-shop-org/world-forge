/**
 * convert-items.test.ts — ItemPlacement → Godot item resource entries.
 *
 * No dedicated test file existed for this converter before (audit finding
 * F-009). Covers the two defects the audit routed here:
 *
 *  - F-002: item sibling node names were never de-duplicated, unlike every
 *    other node-emitting converter in this package (props/hazards/economy/
 *    structures/strata all guard sibling collisions).
 *  - F-001/F-18d722e0: convert-items.ts:97 was named as one of the
 *    "riskiest call sites" — a free-text authored display name flows
 *    straight into the node-name sanitizer.
 */

import { describe, it, expect } from 'vitest';
import { convertItems } from '../convert-items.js';
import type { WorldProject, ItemPlacement, Zone } from '@world-forge/schema';

function zone(id: string, gridX = 0, gridY = 0, w = 4, h = 4): Zone {
    return { id, gridX, gridY, gridWidth: w, gridHeight: h } as unknown as Zone;
}
function proj(zones: Zone[], itemPlacements: ItemPlacement[]): WorldProject {
    return { map: { tileSize: 32 }, zones, itemPlacements } as unknown as WorldProject;
}
const placement = (itemId: string, over: Partial<ItemPlacement> = {}): ItemPlacement =>
    ({ itemId, zoneId: 'z1', gridX: 1, gridY: 1, hidden: false, ...over } as unknown as ItemPlacement);

describe('convertItems — basic conversion', () => {
    it('resolves a placement to a resource with a sanitized node name', () => {
        const { items } = convertItems(proj([zone('z1')], [placement('i1', { name: 'Health Potion' })]));
        expect(items).toHaveLength(1);
        expect(items[0]).toMatchObject({ itemId: 'i1', nodeName: 'Health_Potion', zoneId: 'z1' });
    });

    it('falls back to itemId when no display name is authored', () => {
        const { items } = convertItems(proj([zone('z1')], [placement('potion-01')]));
        expect(items[0].nodeName).toBe('potion_01');
    });
});

describe('convertItems — sibling de-dup (F-002)', () => {
    it('de-dupes two items with the same display name in the same zone', () => {
        const { items } = convertItems(proj(
            [zone('z1')],
            [placement('i1', { name: 'Health Potion' }), placement('i2', { name: 'Health Potion' })],
        ));
        expect(items.map((i) => i.nodeName)).toEqual(['Health_Potion', 'Health_Potion_2']);
    });

    it('de-dupes three same-named items in sequence', () => {
        const { items } = convertItems(proj(
            [zone('z1')],
            [placement('i1', { name: 'Gold' }), placement('i2', { name: 'Gold' }), placement('i3', { name: 'Gold' })],
        ));
        expect(items.map((i) => i.nodeName)).toEqual(['Gold', 'Gold_2', 'Gold_3']);
    });

    it('scopes de-dup PER ZONE — same name in two different zones both stay unsuffixed', () => {
        const { items } = convertItems(proj(
            [zone('z1'), zone('z2', 10, 10)],
            [placement('i1', { name: 'Gold', zoneId: 'z1' }), placement('i2', { name: 'Gold', zoneId: 'z2' })],
        ));
        expect(items.find((i) => i.zoneId === 'z1')!.nodeName).toBe('Gold');
        expect(items.find((i) => i.zoneId === 'z2')!.nodeName).toBe('Gold');
    });

    it('does not suffix distinctly-named siblings', () => {
        const { items } = convertItems(proj(
            [zone('z1')],
            [placement('i1', { name: 'Gold' }), placement('i2', { name: 'Silver' })],
        ));
        expect(items.map((i) => i.nodeName)).toEqual(['Gold', 'Silver']);
    });
});

describe('convertItems — node-name quote safety (F-001/F-18d722e0)', () => {
    it('strips a literal quote from an authored item display name', () => {
        const { items } = convertItems(proj([zone('z1')], [placement('i1', { name: '18" Cutlass' })]));
        expect(items[0].nodeName).not.toContain('"');
        expect(items[0].nodeName).toMatch(/^[a-zA-Z0-9_]+$/);
    });
});
