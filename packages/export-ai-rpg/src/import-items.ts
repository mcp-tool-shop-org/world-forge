// import-items.ts — engine ItemDefinition[] → schema ItemPlacement[]

import type { ItemPlacement } from '@world-forge/schema';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';
import type { FidelityEntry } from './fidelity.js';
import type { ExportedItemPlacement } from './convert-item-placements.js';

export function importItems(
  engineItems: ItemDefinition[],
  zoneIds: string[],
  // F-42772fc9: ContentPack.itemPlacements carries the real authored zoneId /
  // container / lootTableId / grid / hidden. OPTIONAL so a legacy pack without
  // this channel still falls back to first-zone placement.
  itemPlacements?: ExportedItemPlacement[],
): { placements: ItemPlacement[]; warnings: string[]; fidelity: FidelityEntry[] } {
  const warnings: string[] = [];
  const fidelity: FidelityEntry[] = [];

  // EB-014: Early return with empty result when no items to import.
  // F-1d5f2ce5: a hand-authored pack may omit `items` entirely (detectImportFormat
  // only requires entities+zones), so treat missing/non-array as empty rather
  // than throwing on `.length`.
  if (!Array.isArray(engineItems) || engineItems.length === 0) {
    return { placements: [], warnings, fidelity };
  }

  const defaultZone = zoneIds.length > 0 ? zoneIds[0] : 'unplaced';
  const placementsById = new Map((itemPlacements ?? []).map((p) => [p.itemId, p]));
  let fallbackCount = 0;

  const placements = engineItems.map((ei) => {
    const flags = ei.provenance?.flags;
    const hiddenFromContraband = Array.isArray(flags) && flags.includes('contraband');
    const placementRecord = placementsById.get(ei.id);

    let zoneId: string;
    let hidden: boolean;
    if (placementRecord) {
      zoneId = placementRecord.zoneId;
      hidden = placementRecord.hidden ?? hiddenFromContraband;
      fidelity.push({
        level: 'lossless', domain: 'items', severity: 'info',
        entityId: ei.id, fieldPath: 'zoneId',
        message: `Item '${ei.name}' zone restored from pack itemPlacements[] data: '${zoneId}'`,
        reason: 'item-zone-from-pack',
      });
    } else {
      fallbackCount += 1;
      zoneId = defaultZone;
      hidden = hiddenFromContraband;
      fidelity.push({
        level: 'approximated', domain: 'items', severity: 'warning',
        entityId: ei.id, fieldPath: 'zoneId',
        message: `Item '${ei.name}' placed in first zone '${defaultZone}' (original zone unknown)`,
        reason: 'zone-placement-first-zone',
      });
    }

    if (!placementRecord && hiddenFromContraband) {
      fidelity.push({
        level: 'approximated', domain: 'items', severity: 'info',
        entityId: ei.id, fieldPath: 'hidden',
        message: `Item '${ei.name}' hidden flag derived from contraband provenance`,
        reason: 'hidden-from-contraband',
      });
    }

    const item: ItemPlacement = {
      itemId: ei.id,
      name: ei.name,
      description: ei.description,
      zoneId,
      hidden,
      slot: ei.slot,
      rarity: ei.rarity,
    };
    if (placementRecord?.container) item.container = placementRecord.container;
    if (placementRecord?.lootTableId) item.lootTableId = placementRecord.lootTableId;
    if (placementRecord?.gridX !== undefined) item.gridX = placementRecord.gridX;
    if (placementRecord?.gridY !== undefined) item.gridY = placementRecord.gridY;

    if (ei.statModifiers && Object.keys(ei.statModifiers).length > 0) {
      item.statModifiers = { ...ei.statModifiers };
    }
    if (ei.resourceModifiers && Object.keys(ei.resourceModifiers).length > 0) {
      item.resourceModifiers = { ...ei.resourceModifiers };
    }
    if (ei.grantedTags && ei.grantedTags.length > 0) {
      item.grantedTags = [...ei.grantedTags];
    }
    if (ei.grantedVerbs && ei.grantedVerbs.length > 0) {
      item.grantedVerbs = [...ei.grantedVerbs];
    }

    return item;
  });

  if (fallbackCount > 0 && fallbackCount === engineItems.length) {
    warnings.push(`All ${engineItems.length} item(s) placed in zone '${defaultZone}' (original zones unknown)`);
  }

  return { placements, warnings, fidelity };
}
