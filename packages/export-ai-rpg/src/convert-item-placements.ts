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
 * One item placed on an exported entity container. Catalog identity stays on
 * ItemDefinition; the engine's intake gives `itemId` to `entityId`
 * (see @ai-rpg-engine/content-schema validate.ts:574-580, gate.ts:91-110).
 */
export interface ExportedItemPlacement {
  itemId: string;
  entityId: string;
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
 * Writes a record ONLY when `ip.container` names an entity that the same export
 * writes, setting `entityId` to that entity's exported id. Zone-loose items
 * and containers naming no exported entity are omitted from `itemPlacements`
 * and reported in `fidelity` as dropped with reason `engine-has-no-zone-items`,
 * citing `gate.ts:91-110`.
 */
export function convertItemPlacements(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
  exportedEntityIds?: ReadonlySet<string>,
): ExportedItemPlacement[] {
  const lootTableIds = new Set((project.lootTables ?? []).map((t) => t.id));
  const entityIds = exportedEntityIds ?? new Set(project.entityPlacements.map((ep) => ep.entityId));
  const out: ExportedItemPlacement[] = [];

  for (const ip of project.itemPlacements) {
    const containerEntityId = typeof ip.container === 'string' && ip.container.length > 0 && entityIds.has(ip.container)
      ? ip.container
      : undefined;

    if (!containerEntityId) {
      const label = ip.name || ip.itemId;
      fidelity?.push({
        domain: 'items',
        level: 'dropped',
        severity: 'warning',
        entityId: ip.itemId,
        fieldPath: 'zoneId',
        message: ip.container
          ? `Item "${ip.itemId}" (${label}) in zone "${ip.zoneId}" has container "${ip.container}" naming no exported entity — omitted from ContentPack.itemPlacements because the engine has no zone-item vocabulary (gate.ts:91-110).`
          : `Zone-loose item "${ip.itemId}" (${label}) in zone "${ip.zoneId}" omitted from ContentPack.itemPlacements because the engine has no zone-item vocabulary (gate.ts:91-110).`,
        reason: 'engine-has-no-zone-items',
      });
      continue;
    }

    const record: ExportedItemPlacement = {
      itemId: ip.itemId,
      entityId: containerEntityId,
      zoneId: ip.zoneId,
      hidden: ip.hidden,
      container: ip.container,
    };
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
      const label = ip.name || ip.itemId;
      fidelity?.push({
        domain: 'items',
        level: 'approximated',
        severity: 'warning',
        entityId: ip.itemId,
        fieldPath: 'hidden',
        message: `Hidden item "${ip.itemId}" (${label}) placed on entity "${containerEntityId}": the engine gives the item at boot and does not read spawnCondition.`,
        reason: 'hidden-item-placement-given-at-boot',
      });
    }

    out.push(record);
  }

  return out;
}
