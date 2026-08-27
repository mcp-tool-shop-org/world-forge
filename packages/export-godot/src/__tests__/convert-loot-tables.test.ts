/**
 * convert-loot-tables.test.ts — LootTable → Godot loot resource.
 *
 * F-99823dc8: LootTableEntry.condition / rarity and LootTable.tags were
 * stripped while fidelity claimed level:'lossless'. A table that only drops
 * when the party holds a key became always-eligible with no warning.
 */

import { describe, it, expect } from 'vitest';
import { convertLootTables } from '../convert-loot-tables.js';
import type { WorldProject, LootTable } from '@world-forge/schema';

function proj(lootTables: LootTable[]): WorldProject {
    return { lootTables } as unknown as WorldProject;
}

describe('convertLootTables — condition/rarity/tags (F-99823dc8)', () => {
    it('RED: keeps entry.condition item:iron-key instead of stripping it', () => {
        const { lootTables } = convertLootTables(proj([
            {
                id: 'chest-gated',
                rolls: 1,
                entries: [{ itemId: 'gold-coin', weight: 1, condition: 'item:iron-key' }],
            },
        ]));
        expect(lootTables).toHaveLength(1);
        expect(lootTables[0].entries).toHaveLength(1);
        expect(lootTables[0].entries[0].condition).toBe('item:iron-key');
    });

    it('keeps entry.rarity and table.tags on the Godot resource', () => {
        const { lootTables } = convertLootTables(proj([
            {
                id: 'rare-chest',
                rolls: 2,
                tags: ['dungeon', 'boss'],
                entries: [
                    { itemId: 'iron-key', weight: 3, rarity: 'rare', quantity: { min: 1, max: 1 } },
                    { itemId: 'gold-coin', weight: 1, rarity: 'common' },
                ],
            },
        ]));
        expect(lootTables[0].tags).toEqual(['dungeon', 'boss']);
        expect(lootTables[0].entries[0]).toMatchObject({
            itemId: 'iron-key', weight: 3, rarity: 'rare', quantity: { min: 1, max: 1 },
        });
        expect(lootTables[0].entries[1].rarity).toBe('common');
    });

    it('defaults missing tags to an empty array and still maps quantity', () => {
        const { lootTables } = convertLootTables(proj([
            { id: 'plain', entries: [{ itemId: 'torch', weight: 2, quantity: { min: 1, max: 3 } }] },
        ]));
        expect(lootTables[0].tags).toEqual([]);
        expect(lootTables[0].entries[0].quantity).toEqual({ min: 1, max: 3 });
        expect(lootTables[0].entries[0].condition).toBeUndefined();
    });

    it('claims lossless only because condition/rarity/tags actually survive', () => {
        const { lootTables, fidelity } = convertLootTables(proj([
            {
                id: 'key-gate',
                tags: ['locked'],
                entries: [{ itemId: 'treasure', weight: 1, condition: 'item:iron-key', rarity: 'legendary' }],
            },
        ]));
        expect(lootTables[0].entries[0].condition).toBe('item:iron-key');
        expect(lootTables[0].entries[0].rarity).toBe('legendary');
        expect(lootTables[0].tags).toEqual(['locked']);
        const entry = fidelity.find((f) => f.fieldPath === 'lootTables.key-gate');
        expect(entry?.level).toBe('lossless');
        expect(entry?.reason).toMatch(/condition\/rarity/);
    });
});
