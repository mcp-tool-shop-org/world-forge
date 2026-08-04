// convert-items.ts — WorldProject item placements → engine ItemDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';
import type { FidelityEntry } from './fidelity.js';

/**
 * AIR-A-004: Explicit allowlists for item slot and rarity values.
 * Mirrors the VALID_CONNECTION_KINDS pattern used in @world-forge/schema validate.ts.
 *
 * F-1c1a6e56 (swarm wave-2): the schema's `ItemSlot` union has SIX members
 * ('weapon'|'armor'|'trinket'|'tool'|'accessory'|'consumable' —
 * schema/src/entities.ts:49); this allowlist only recognizes five. That is
 * NOT a bug to patch by adding 'consumable' here — the engine's own
 * `EquipmentSlot` (@ai-rpg-engine/equipment types.d.ts) is the same five
 * values and has no consumable-equivalent slot at all, so there is nowhere
 * legitimate for an authored 'consumable' to land. The real gap this finding
 * closes is the SILENCE: narrowSlot/narrowRarity had no warnings/fidelity
 * channel at all, so the fallback to 'trinket' was unreported. See
 * narrowSlot below for the reporting fix.
 */
const VALID_ITEM_SLOTS = new Set<ItemDefinition['slot']>([
  'weapon', 'armor', 'accessory', 'tool', 'trinket',
]);

const VALID_ITEM_RARITIES = new Set<ItemDefinition['rarity']>([
  'common', 'uncommon', 'rare', 'legendary',
]);

/**
 * Narrow an authored slot string to the engine's closed `EquipmentSlot` set,
 * reporting the fallback instead of applying it silently (F-1c1a6e56).
 *
 * `warnings`/`fidelity` are optional so this stays backward-compatible with
 * any caller that does not care to observe the loss.
 */
function narrowSlot(
  itemId: string,
  label: string,
  value: string | undefined,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ItemDefinition['slot'] {
  if (value && VALID_ITEM_SLOTS.has(value as ItemDefinition['slot'])) {
    return value as ItemDefinition['slot'];
  }
  if (value === undefined) {
    // Unset slot is the common/expected case (slot is optional on
    // ItemPlacement) — nothing was authored to lose, so this mirrors
    // narrowRarity's silent default rather than warning on every item that
    // simply didn't set one.
    return 'trinket';
  }
  // A NON-undefined value that still isn't in VALID_ITEM_SLOTS is either the
  // 'consumable' gap this finding names, or a genuine typo/unrecognized
  // string — either way, something was authored and then lost, which is
  // exactly the silence this finding closes.
  const isConsumable = value === 'consumable';
  const msg = isConsumable
    ? `Item "${itemId}" (${label}) has slot 'consumable', which is schema-legal but has NO equivalent in the engine's EquipmentSlot set (weapon/armor/accessory/tool/trinket) — narrowed to 'trinket'. The item will not function as a consumable at runtime.`
    : `Item "${itemId}" (${label}) has an unrecognized slot '${value}' — narrowed to 'trinket'. Valid slots: ${[...VALID_ITEM_SLOTS].join(', ')}.`;
  console.warn(`[convert-items] ${msg}`);
  warnings?.push(msg);
  fidelity?.push({
    domain: 'items',
    level: 'approximated',
    severity: 'warning',
    entityId: itemId,
    fieldPath: 'slot',
    message: msg,
    reason: isConsumable ? 'item-slot-no-engine-target' : 'item-slot-unrecognized-fallback',
  });
  return 'trinket';
}

function narrowRarity(
  itemId: string,
  label: string,
  value: string | undefined,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ItemDefinition['rarity'] {
  if (value && VALID_ITEM_RARITIES.has(value as ItemDefinition['rarity'])) {
    return value as ItemDefinition['rarity'];
  }
  if (value === undefined) {
    // Unset rarity is the common/expected case (rarity is optional on
    // ItemPlacement) — not worth a warning, just the documented default.
    return 'common';
  }
  const msg = `Item "${itemId}" (${label}) has an unrecognized rarity '${value}' — narrowed to 'common'. Valid rarities: ${[...VALID_ITEM_RARITIES].join(', ')}.`;
  console.warn(`[convert-items] ${msg}`);
  warnings?.push(msg);
  fidelity?.push({
    domain: 'items',
    level: 'approximated',
    severity: 'warning',
    entityId: itemId,
    fieldPath: 'rarity',
    message: msg,
    reason: 'item-rarity-unrecognized-fallback',
  });
  return 'common';
}

/**
 * Convert project item placements → engine `ItemDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 *
 * F-1c1a6e56 (swarm wave-2): `warnings`/`fidelity` give this converter the
 * same reporting channel every sibling converter already has
 * (convertEntities, convertPlacements, convertZones, convertPlayerTemplate).
 * Both optional — omitting them behaves exactly like the pre-fix signature.
 */
export function convertItems(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ItemDefinition[] {
  return project.itemPlacements.map((ip) => {
    const label = ip.name || ip.itemId;
    const item: ItemDefinition = {
      id: ip.itemId,
      name: ip.name || ip.itemId,
      description: ip.description || (ip.container ? `Found in ${ip.container}` : 'An item.'),
      slot: narrowSlot(ip.itemId, label, ip.slot, warnings, fidelity),
      rarity: narrowRarity(ip.itemId, label, ip.rarity, warnings, fidelity),
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
