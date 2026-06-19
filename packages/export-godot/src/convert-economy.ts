/**
 * convert-economy.ts — WorldProject town economy → Godot scene nodes.
 *
 * Market nodes and crafting stations are zone-attached (no grid position of
 * their own), so each is placed at its zone's center and emitted as a Node2D
 * (under a root "Markets" / "CraftingStations" container) carrying its economic
 * data as metadata. Textureless, like the entity/prop scaffold. Nodes whose
 * zoneId resolves to no zone are dropped with a fidelity warning.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

export interface GodotMarketNode {
    nodeName: string;
    id: string;
    zoneId: string;
    position: GodotVec2;
    supplyCategories: string[];
    priceModifier: number;
    contrabandAvailable: boolean;
    merchantEntityId?: string;
}

export interface GodotCraftingStation {
    nodeName: string;
    id: string;
    zoneId: string;
    position: GodotVec2;
    stationType: string;
    availableRecipes: string[];
}

export interface ConvertEconomyResult {
    markets: GodotMarketNode[];
    craftingStations: GodotCraftingStation[];
    fidelity: FidelityEntry[];
}

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

export function convertEconomy(project: WorldProject): ConvertEconomyResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];

    // Zone-center lookup (pixels) for positioning zone-attached economy nodes.
    const zoneCenter = new Map<string, GodotVec2>();
    for (const z of project.zones) {
        zoneCenter.set(z.id, {
            x: (z.gridX + z.gridWidth / 2) * tileSize,
            y: (z.gridY + z.gridHeight / 2) * tileSize,
        });
    }

    const markets: GodotMarketNode[] = [];
    const craftingStations: GodotCraftingStation[] = [];
    const seen = new Map<string, number>();
    let droppedMarkets = 0;
    let droppedStations = 0;

    const uniqueName = (base: string): string => {
        const safe = sanitizeNodeName(base) || 'Node';
        const n = seen.get(safe) ?? 0;
        seen.set(safe, n + 1);
        return n === 0 ? safe : `${safe}_${n + 1}`;
    };

    for (const m of project.marketNodes ?? []) {
        const center = zoneCenter.get(m.zoneId);
        if (!center) {
            droppedMarkets++;
            continue;
        }
        markets.push({
            nodeName: uniqueName(`Market_${m.id}`),
            id: m.id,
            zoneId: m.zoneId,
            position: center,
            supplyCategories: m.supplyCategories.slice(),
            priceModifier: m.priceModifier,
            contrabandAvailable: m.contrabandAvailable,
            merchantEntityId: m.merchantEntityId,
        });
    }

    for (const c of project.craftingStations ?? []) {
        const center = zoneCenter.get(c.zoneId);
        if (!center) {
            droppedStations++;
            continue;
        }
        craftingStations.push({
            nodeName: uniqueName(`Crafting_${c.id}`),
            id: c.id,
            zoneId: c.zoneId,
            position: center,
            stationType: c.stationType,
            availableRecipes: c.availableRecipes.slice(),
        });
    }

    const dropped = droppedMarkets + droppedStations;
    if (dropped > 0) {
        fidelity.push({
            level: 'dropped',
            domain: 'economy',
            severity: 'warning',
            fieldPath: 'marketNodes/craftingStations',
            message: `${dropped} economy node(s) (${droppedMarkets} market, ${droppedStations} crafting) reference a zoneId with no matching zone — dropped.`,
            reason: 'A zone-attached economy node could not be positioned because its zone was not found.',
        });
    }
    if (markets.length + craftingStations.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'economy',
            severity: 'info',
            fieldPath: 'marketNodes/craftingStations',
            message: `${markets.length} market(s) + ${craftingStations.length} crafting station(s) exported as Node2D placeholders at zone centers, with economy data as metadata.`,
            reason: 'Economy nodes have no authored position; they are placed at their zone center and the runtime drives shop/crafting behavior from the metadata + content pack.',
        });
    }

    return { markets, craftingStations, fidelity };
}
