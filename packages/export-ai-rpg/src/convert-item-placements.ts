// convert-item-placements.ts — WorldProject.itemPlacements → ContentPack.itemPlacements
//
// F-42772fc9: convertItems emits ItemDefinition catalog records and drops
// ItemPlacement.zoneId / grid / lootTableId / container. C3/P1 closed the
// identical hole for entities via convert-placements; items were left
// catalog-only. "an exported pack knows every item and where none of them are."

import type { WorldProject } from '@world-forge/schema';
import { parseSpawnCondition } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

/**
 * One item, placed in one zone. Catalog identity stays on ItemDefinition;
 * this channel is WHERE it stands (and which loot table / container owns it).
 */
export interface ExportedItemPlacement {
  itemId: string;
  zoneId: string;
  container?: string;
  lootTableId?: string;
  gridX?: number;
  gridY?: number;
  hidden?: boolean;
  spawnCondition?: { type: string; params: Record<string, string | number | boolean> };
}

/**
 * Convert project.itemPlacements → ContentPack.itemPlacements.
 *
 * One record per ItemPlacement, in authored order. Catalog fields (name,
 * slot, rarity, modifiers) stay on convertItems; this channel carries
 * location, container, lootTableId, and hidden/spawn semantics.
 *
 * ItemPlacement has no authored spawnCondition field today; `hidden` is the
 * spawn-adjacent flag. When hidden, we also compile a `never` ConditionSpec
 * so engine intake that only reads spawnCondition still sees a gate.
 */
export function convertItemPlacements(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ExportedItemPlacement[] {
  const lootTableIds = new Set((project.lootTables ?? []).map((t) => t.id));

  return project.itemPlacements.map((ip) => {
    const record: ExportedItemPlacement = {
      itemId: ip.itemId,
      zoneId: ip.zoneId,
      hidden: ip.hidden,
    };
    if (ip.container) record.container = ip.container;
    if (ip.lootTableId) {
      record.lootTableId = ip.lootTableId;
      if (!lootTableIds.has(ip.lootTableId)) {
        const label = ip.name || ip.itemId;
        const msg = `Item "${ip.itemId}" (${label}) references lootTableId "${ip.lootTableId}" which is not in project.lootTables — the reverse link is still exported.`;
        warnings?.push(msg);
        fidelity?.push({
          domain: 'items',
          level: 'approximated',
          severity: 'warning',
          entityId: ip.itemId,
          fieldPath: 'lootTableId',
          message: msg,
          reason: 'item-loot-table-unresolved',
        });
      }
    }
    if (ip.gridX !== undefined) record.gridX = ip.gridX;
    if (ip.gridY !== undefined) record.gridY = ip.gridY;

    if (ip.hidden) {
      const compiled = parseSpawnCondition('never');
      if (compiled) {
        record.spawnCondition = { type: compiled.type, params: compiled.params ?? {} };
      }
    }

    return record;
  });
}
