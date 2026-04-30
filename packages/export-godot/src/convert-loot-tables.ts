/**
 * convert-loot-tables.ts — LootTable → Godot loot resource.
 *
 * Godot doesn't have a native loot table system, so we export structured
 * resources that a GDScript/C# loot manager can consume.
 */

import type { WorldProject, LootTable } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export interface GodotLootEntry {
    itemId: string;
    weight: number;
    quantity?: { min: number; max: number };
}

export interface GodotLootTableResource {
    /** Resource path: res://world_data/loot/<id>.tres */
    resourcePath: string;
    id: string;
    rolls: number;
    entries: GodotLootEntry[];
    /** Total weight for quick normalization. */
    totalWeight: number;
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
            })),
            totalWeight,
        });

        fidelity.push({
            level: 'lossless',
            domain: 'loot',
            severity: 'info',
            entityId: table.id,
            fieldPath: `lootTables.${table.id}`,
            message: `Loot table "${table.id}" (${table.entries.length} entries, ${table.rolls} rolls) preserved.`,
            reason: 'Direct structural mapping to Godot resource.',
        });
    }

    return { lootTables, fidelity };
}
