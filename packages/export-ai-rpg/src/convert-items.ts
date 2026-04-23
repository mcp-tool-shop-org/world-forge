// convert-items.ts — WorldProject item placements → engine ItemDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';

/**
 * AIR-A-004: Explicit allowlists for item slot and rarity values.
 * Mirrors the VALID_CONNECTION_KINDS pattern used in @world-forge/schema validate.ts.
 * Values outside these sets fall back to the defaults ('trinket' / 'common') silently
 * with a comment — convertItems returns ItemDefinition[] and has no warning channel.
 */
const VALID_ITEM_SLOTS = new Set<ItemDefinition['slot']>([
  'weapon', 'armor', 'accessory', 'tool', 'trinket',
]);

const VALID_ITEM_RARITIES = new Set<ItemDefinition['rarity']>([
  'common', 'uncommon', 'rare', 'legendary',
]);

function narrowSlot(value: string | undefined): ItemDefinition['slot'] {
  if (value && VALID_ITEM_SLOTS.has(value as ItemDefinition['slot'])) {
    return value as ItemDefinition['slot'];
  }
  // Fallback default — unknown/unset slot becomes 'trinket'.
  return 'trinket';
}

function narrowRarity(value: string | undefined): ItemDefinition['rarity'] {
  if (value && VALID_ITEM_RARITIES.has(value as ItemDefinition['rarity'])) {
    return value as ItemDefinition['rarity'];
  }
  // Fallback default — unknown/unset rarity becomes 'common'.
  return 'common';
}

/**
 * Convert project item placements → engine `ItemDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 */
export function convertItems(project: WorldProject): ItemDefinition[] {
  return project.itemPlacements.map((ip) => {
    const item: ItemDefinition = {
      id: ip.itemId,
      name: ip.name || ip.itemId,
      description: ip.description || (ip.container ? `Found in ${ip.container}` : 'An item.'),
      slot: narrowSlot(ip.slot),
      rarity: narrowRarity(ip.rarity),
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
