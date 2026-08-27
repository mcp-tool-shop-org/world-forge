// player-template-helpers.ts — pure helpers for PlayerTemplatePanel.
//
// F-2430a6b2: a new player template used spawnPointId: ''. validateProject
// rejects any spawnPointId not in project.spawnPoints (including ''), so the
// onboarding "+ Create Player Template" action immediately blocked Export
// while ChecklistPanel still marked the player step complete.

import type { PlayerTemplate } from '@world-forge/schema';

export interface SpawnPointLike {
  id: string;
  isDefault?: boolean;
}

/** Default spawn if one is marked, otherwise the first spawn, else undefined. */
export function pickDefaultSpawnPointId(spawnPoints: SpawnPointLike[]): string | undefined {
  if (spawnPoints.length === 0) return undefined;
  return spawnPoints.find((sp) => sp.isDefault)?.id ?? spawnPoints[0]?.id;
}

/** True when spawnPointId is missing, empty, or not in the project's spawn list. */
export function isMissingSpawnPoint(
  spawnPointId: string | undefined,
  spawnPoints: SpawnPointLike[],
): boolean {
  if (!spawnPointId || spawnPointId.trim() === '') return true;
  return !spawnPoints.some((sp) => sp.id === spawnPointId);
}

export interface ItemLike {
  itemId: string;
  name?: string;
}

/** Add or remove an item id from starting inventory. */
export function inventoryWithItem(inventory: string[], itemId: string, on: boolean): string[] {
  if (on) return inventory.includes(itemId) ? inventory : [...inventory, itemId];
  return inventory.filter((id) => id !== itemId);
}

/** Inventory ids that are not present in itemPlacements (fail validation). */
export function missingInventoryIds(inventory: string[], items: ItemLike[]): string[] {
  const known = new Set(items.map((i) => i.itemId));
  return inventory.filter((id) => !known.has(id));
}

export function createDefaultPlayerTemplate(spawnPointId: string): PlayerTemplate {
  return {
    name: 'Wanderer',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: [],
    startingEquipment: {},
    spawnPointId,
    tags: [],
    custom: {},
  };
}
