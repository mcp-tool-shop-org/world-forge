// import-items.ts — engine ItemDefinition[] → schema ItemPlacement[]

import type { ItemPlacement } from '@world-forge/schema';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';

export function importItems(
  engineItems: ItemDefinition[],
  zoneIds: string[],
): { placements: ItemPlacement[]; warnings: string[] } {
  const warnings: string[] = [];
  const defaultZone = zoneIds.length > 0 ? zoneIds[0] : 'unplaced';
  if (engineItems.length > 0) {
    warnings.push(`All ${engineItems.length} item(s) placed in zone '${defaultZone}' (original zones unknown)`);
  }

  const placements = engineItems.map((ei) => {
    const hidden = !!(ei.provenance?.flags as string[] | undefined)?.includes('contraband');

    const item: ItemPlacement = {
      itemId: ei.id,
      name: ei.name,
      description: ei.description,
      zoneId: defaultZone,
      hidden,
      slot: ei.slot,
      rarity: ei.rarity,
    };

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

  return { placements, warnings };
}
