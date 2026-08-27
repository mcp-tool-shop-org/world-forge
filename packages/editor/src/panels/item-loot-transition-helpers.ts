// item-loot-transition-helpers.ts — pure factories + project transformers.
// Dedicated addItemPlacement / addLootTable / addTransition live in editor-core
// (project-store). Panels call updateProject with these transformers.

import type {
  ItemPlacement, ItemRarity, ItemSlot, LootTable, LootTableEntry,
  TransitionEntity, TransitionEntityType, WorldProject,
} from '@world-forge/schema';
import { parseCsv, parseNamedNumbers, formatNamedNumbers, emptyToUndef } from './entity-properties-helpers.js';

export const ITEM_SLOTS: ItemSlot[] = ['weapon', 'armor', 'trinket', 'tool', 'accessory', 'consumable'];
export const ITEM_RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];
export const TRANSITION_TYPES: TransitionEntityType[] = ['elevator', 'warp', 'transporter', 'cargo-lift', 'stairwell'];

export { parseCsv, formatNamedNumbers, emptyToUndef };

export function defaultItemPlacement(itemId: string, zoneId: string): ItemPlacement {
  return { itemId, zoneId, name: 'Item', hidden: false, slot: 'consumable', rarity: 'common' };
}

export function withAddedItem(p: WorldProject, item: ItemPlacement): WorldProject {
  return { ...p, itemPlacements: [...p.itemPlacements, item] };
}

export function withUpdatedItem(p: WorldProject, itemId: string, updates: Partial<ItemPlacement>): WorldProject {
  return {
    ...p,
    itemPlacements: p.itemPlacements.map((i) => i.itemId === itemId ? { ...i, ...updates } : i),
  };
}

export function withRemovedItem(p: WorldProject, itemId: string): WorldProject {
  return { ...p, itemPlacements: p.itemPlacements.filter((i) => i.itemId !== itemId) };
}

export function parseModifiers(s: string): Record<string, number> | undefined {
  const rec = parseNamedNumbers(s);
  return Object.keys(rec).length > 0 ? rec : undefined;
}

export function defaultLootEntry(): LootTableEntry {
  return { itemId: 'item', weight: 1 };
}

export function defaultLootTable(id: string): LootTable {
  return { id, rolls: 1, entries: [defaultLootEntry()] };
}

export function withAddedLootTable(p: WorldProject, table: LootTable): WorldProject {
  return { ...p, lootTables: [...(p.lootTables ?? []), table] };
}

export function withUpdatedLootTable(p: WorldProject, id: string, updates: Partial<LootTable>): WorldProject {
  return {
    ...p,
    lootTables: (p.lootTables ?? []).map((t) => t.id === id ? { ...t, ...updates } : t),
  };
}

export function withRemovedLootTable(p: WorldProject, id: string): WorldProject {
  return { ...p, lootTables: (p.lootTables ?? []).filter((t) => t.id !== id) };
}

export function withLootEntry(table: LootTable, index: number, updates: Partial<LootTableEntry>): LootTable {
  return {
    ...table,
    entries: table.entries.map((e, i) => i === index ? { ...e, ...updates } : e),
  };
}

export function withAddedLootEntry(table: LootTable): LootTable {
  return { ...table, entries: [...table.entries, defaultLootEntry()] };
}

export function withRemovedLootEntry(table: LootTable, index: number): LootTable {
  if (table.entries.length <= 1) return table;
  return { ...table, entries: table.entries.filter((_, i) => i !== index) };
}

export function parseQuantity(minRaw: string, maxRaw: string): LootTableEntry['quantity'] | undefined {
  if (minRaw.trim() === '' && maxRaw.trim() === '') return undefined;
  const min = Number(minRaw);
  const max = Number(maxRaw);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return undefined;
  return { min, max };
}

export function defaultTransition(id: string, zoneId: string, targetZoneId: string): TransitionEntity {
  return { id, zoneId, targetZoneId, type: 'elevator' };
}

export function withAddedTransition(p: WorldProject, t: TransitionEntity): WorldProject {
  return { ...p, transitions: [...(p.transitions ?? []), t] };
}

export function withUpdatedTransition(p: WorldProject, id: string, updates: Partial<TransitionEntity>): WorldProject {
  return {
    ...p,
    transitions: (p.transitions ?? []).map((t) => t.id === id ? { ...t, ...updates } : t),
  };
}

export function withRemovedTransition(p: WorldProject, id: string): WorldProject {
  return { ...p, transitions: (p.transitions ?? []).filter((t) => t.id !== id) };
}

export function pickDefaultTargetZoneId(zoneId: string, zoneIds: string[]): string {
  return zoneIds.find((id) => id !== zoneId) ?? zoneId;
}
