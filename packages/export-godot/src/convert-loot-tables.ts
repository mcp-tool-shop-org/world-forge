/**
 * convert-loot-tables.ts — LootTable → Godot loot resource.
 *
 * Godot doesn't have a native loot table system, so we export structured
 * resources that a GDScript/C# loot manager can consume.
 */

import type { WorldProject, ItemRarity } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export interface GodotLootEntry {
    itemId: string;
    weight: number;
    quantity?: { min: number; max: number };
    /** Spawn-condition grammar that gates eligibility (same as EntityPlacement.spawnCondition). */
    condition?: string;
    rarity?: ItemRarity;
}

export interface GodotLootTableResource {
    /** Resource path: res://world_data/loot/<id>.tres */
    resourcePath: string;
    id: string;
    rolls: number;
    entries: GodotLootEntry[];
    /** Total weight for quick normalization. */
    totalWeight: number;
    /** Tags for filtering / discovery. */
    tags: string[];
}

export interface ConvertLootTablesResult {
    lootTables: GodotLootTableResource[];
    fidelity: FidelityEntry[];
}

export function convertLootTables(project: WorldProject): ConvertLootTablesResult {
    const fidelity: FidelityEntry[] = [];
    const lootTables: GodotLootTableResource[] = [];
    const tables = project.lootTables ?? [];

    for (const table of tables) {
        const totalWeight = table.entries.reduce((sum, e) => sum + e.weight, 0);

        lootTables.push({
            resourcePath: `res://world_data/loot/${table.id}.tres`,
            id: table.id,
            rolls: table.rolls ?? 1,
            entries: table.entries.map((e) => ({
                itemId: e.itemId,
                weight: e.weight,
                quantity: e.quantity ? { min: e.quantity.min, max: e.quantity.max } : undefined,
                condition: e.condition,
                rarity: e.rarity,
            })),
            totalWeight,
            tags: table.tags?.slice() ?? [],
        });

        fidelity.push({
            level: 'lossless',
            domain: 'loot',
            severity: 'info',
            entityId: table.id,
            fieldPath: `lootTables.${table.id}`,
            message: `Loot table "${table.id}" (${table.entries.length} entries, ${table.rolls ?? 1} rolls) preserved.`,
            reason: 'Direct structural mapping to Godot resource — entries keep condition/rarity; table keeps tags.',
        });
    }

    return { lootTables, fidelity };
}
