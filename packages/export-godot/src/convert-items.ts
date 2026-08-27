/**
 * convert-items.ts — ItemPlacement → Godot item resource entries.
 *
 * Items become either:
 * - Pickup nodes in zone scenes (visible items on the map)
 * - Inventory data resources (when container-bound or hidden)
 */

import type { WorldProject, ItemPlacement, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, resolveTileSize, type GodotVec2 } from './coordinate-transform.js';
import { sanitizeNodeName } from './node-naming.js';

export interface GodotItemResource {
    /** Resource path: res://world_data/items/<itemId>.tres */
    resourcePath: string;
    itemId: string;
    displayName?: string;
    description?: string;
    zoneId: string;
    /** Local position within zone (pixels, Y-down). */
    localPosition: GodotVec2;
    /** Whether this item is hidden (not visible until interaction/discovery). */
    hidden: boolean;
    container?: string;
    slot?: string;
    rarity?: string;
    statModifiers?: Record<string, number>;
    resourceModifiers?: Record<string, number>;
    grantedTags?: string[];
    grantedVerbs?: string[];
    iconAssetId?: string;
    lootTableId?: string;
    /** Godot node name for scene placement. */
    nodeName: string;
}

export interface ConvertItemsResult {
    items: GodotItemResource[];
    fidelity: FidelityEntry[];
}

export function convertItems(project: WorldProject): ConvertItemsResult {
    const tileSize = resolveTileSize(project);
    const fidelity: FidelityEntry[] = [];
    const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));
    const items: GodotItemResource[] = [];

    // Sibling node names are only unique within their own zone's "Items"
    // container, so de-dup is scoped per zone (mirrors convert-props.ts /
    // convert-hazards.ts / convert-economy.ts / convert-structures.ts /
    // convert-strata.ts; items and entities were the two converters that did
    // not de-dup, even though duplicate display names — two "Health Potion"
    // placements in one zone — are ordinary content).
    const seenNamesByZone = new Map<string, Map<string, number>>();
    const uniqueNodeName = (zoneId: string, base: string): string => {
        let seen = seenNamesByZone.get(zoneId);
        if (!seen) {
            seen = new Map<string, number>();
            seenNamesByZone.set(zoneId, seen);
        }
        const safe = sanitizeNodeName(base) || 'Item';
        const n = seen.get(safe) ?? 0;
        seen.set(safe, n + 1);
        return n === 0 ? safe : `${safe}_${n + 1}`;
    };

    for (const item of project.itemPlacements) {
        const zone = zonesById.get(item.zoneId);
        if (!zone) {
            fidelity.push({
                level: 'dropped',
                domain: 'items',
                severity: 'error',
                entityId: item.itemId,
                fieldPath: `itemPlacements.${item.itemId}.zoneId`,
                message: `Item "${item.itemId}" dropped — zone "${item.zoneId}" not found.`,
                reason: 'Orphan zone reference.',
            });
            continue;
        }

        const gridX = item.gridX ?? zone.gridX;
        const gridY = item.gridY ?? zone.gridY;

        if (item.gridX === undefined || item.gridY === undefined) {
            fidelity.push({
                level: 'approximated',
                domain: 'items',
                severity: 'warning',
                entityId: item.itemId,
                fieldPath: `itemPlacements.${item.itemId}.position`,
                message: `Item "${item.itemId}" position defaulted to zone "${zone.id}" origin — set gridX/gridY to place it precisely.`,
                reason: 'No gridX/gridY authored; zone origin is rarely the intended item position.',
            });
        }

        const localPosition = gridToGodot2D(gridX - zone.gridX, gridY - zone.gridY, tileSize);

        items.push({
            resourcePath: `res://world_data/items/${item.itemId}.tres`,
            itemId: item.itemId,
            displayName: item.name,
            description: item.description,
            zoneId: item.zoneId,
            localPosition,
            hidden: item.hidden,
            container: item.container,
            slot: item.slot,
            rarity: item.rarity,
            statModifiers: item.statModifiers ? { ...item.statModifiers } : undefined,
            resourceModifiers: item.resourceModifiers ? { ...item.resourceModifiers } : undefined,
            grantedTags: item.grantedTags?.slice(),
            grantedVerbs: item.grantedVerbs?.slice(),
            iconAssetId: item.iconId,
            lootTableId: item.lootTableId,
            nodeName: uniqueNodeName(item.zoneId, item.name ?? item.itemId),
        });
    }

    return { items, fidelity };
}
