// convert-loot-tables.ts — F-ef6779cc: compile loot entry conditions.

import type { LootTable, WorldProject } from '@world-forge/schema';
import { parseSpawnCondition } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export type ExportedLootCondition = {
  type: string;
  params: Record<string, string | number | boolean>;
};

export type ExportedLootEntry = {
  itemId: string;
  weight: number;
  quantity?: { min: number; max: number };
  condition?: ExportedLootCondition;
  rarity?: LootTable['entries'][number]['rarity'];
};

export type ExportedLootTable = {
  id: string;
  rolls?: number;
  entries: ExportedLootEntry[];
  tags?: string[];
};

export function convertLootTables(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ExportedLootTable[] {
  const tables = project.lootTables ?? [];
  return tables.map((table) => ({
    id: table.id,
    ...(table.rolls !== undefined ? { rolls: table.rolls } : {}),
    entries: table.entries.map((entry, i) => {
      let condition: ExportedLootCondition | undefined;
      if (entry.condition) {
        const parsed = parseSpawnCondition(entry.condition);
        if (!parsed) {
          const msg =
            `Loot table "${table.id}" entry ${i} (item "${entry.itemId}") condition ` +
            `"${entry.condition}" is not valid SpawnCondition grammar — the entry is exported without a condition.`;
          warnings?.push(msg);
          fidelity?.push({
            level: 'approximated',
            domain: 'world',
            severity: 'warning',
            entityId: table.id,
            fieldPath: `lootTables.${table.id}.entries[${i}].condition`,
            message: msg,
            reason: 'loot-entry-condition-dropped',
          });
        } else {
          condition = { type: parsed.type, params: parsed.params ?? {} };
        }
      }
      return {
        itemId: entry.itemId,
        weight: entry.weight,
        ...(entry.quantity ? { quantity: { min: entry.quantity.min, max: entry.quantity.max } } : {}),
        ...(condition ? { condition } : {}),
        ...(entry.rarity ? { rarity: entry.rarity } : {}),
      };
    }),
    ...(table.tags ? { tags: [...table.tags] } : {}),
  }));
}
