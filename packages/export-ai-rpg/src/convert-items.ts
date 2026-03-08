// convert-items.ts — WorldProject item placements → engine ItemDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';

export function convertItems(project: WorldProject): ItemDefinition[] {
  return project.itemPlacements.map((ip) => {
    const item: ItemDefinition = {
      id: ip.itemId,
      name: ip.name || ip.itemId,
      description: ip.description || (ip.container ? `Found in ${ip.container}` : 'An item.'),
      slot: (ip.slot || 'trinket') as ItemDefinition['slot'],
      rarity: (ip.rarity || 'common') as ItemDefinition['rarity'],
    };

    // Pass through stat modifiers if authored
    if (ip.statModifiers && Object.keys(ip.statModifiers).length > 0) {
      item.statModifiers = { ...ip.statModifiers };
    }

    // Pass through resource modifiers if authored
    if (ip.resourceModifiers && Object.keys(ip.resourceModifiers).length > 0) {
      item.resourceModifiers = { ...ip.resourceModifiers };
    }

    // Pass through granted tags
    if (ip.grantedTags && ip.grantedTags.length > 0) {
      item.grantedTags = [...ip.grantedTags];
    }

    // Pass through granted verbs
    if (ip.grantedVerbs && ip.grantedVerbs.length > 0) {
      item.grantedVerbs = [...ip.grantedVerbs];
    }

    // Provenance for hidden/contraband items
    if (ip.hidden) {
      item.provenance = { flags: ['contraband' as const] };
    }

    return item;
  });
}
