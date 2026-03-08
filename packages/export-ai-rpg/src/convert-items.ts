// convert-items.ts — WorldProject item placements → engine ItemDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';

export function convertItems(project: WorldProject): ItemDefinition[] {
  return project.itemPlacements.map((ip) => ({
    id: ip.itemId,
    name: ip.itemId,  // placeholder — editor should provide display names
    description: ip.container ? `Found in ${ip.container}` : 'An item.',
    slot: 'trinket' as const,   // default — editor should set actual slot
    rarity: 'common' as const,  // default — editor should set actual rarity
    provenance: ip.hidden ? { flags: ['contraband' as const] } : undefined,
  }));
}
