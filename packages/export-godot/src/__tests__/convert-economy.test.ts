/**
 * convert-economy.test.ts — Wave B-3 town economy → Godot node conversion.
 */

import { describe, it, expect } from 'vitest';
import { convertEconomy } from '../convert-economy.js';
import type { WorldProject, MarketNode, CraftingStation, Zone } from '@world-forge/schema';

function zone(id: string, gridX: number, gridY: number, w: number, h: number): Zone {
  return { id, gridX, gridY, gridWidth: w, gridHeight: h } as unknown as Zone;
}
function proj(zones: Zone[], marketNodes: MarketNode[], craftingStations: CraftingStation[], tileSize = 32): WorldProject {
  return { map: { tileSize }, zones, marketNodes, craftingStations } as unknown as WorldProject;
}

describe('convertEconomy', () => {
  it('positions a market node at its zone center + carries economy metadata', () => {
    const { markets } = convertEconomy(proj(
      [zone('z1', 0, 0, 4, 2)],
      [{ id: 'm1', zoneId: 'z1', merchantEntityId: 'npc1', supplyCategories: ['food', 'tools'], priceModifier: 1.2, contrabandAvailable: true }],
      [],
    ));
    expect(markets).toHaveLength(1);
    // center = ((0 + 4/2) * 32, (0 + 2/2) * 32) = (64, 32)
    expect(markets[0]).toMatchObject({
      id: 'm1', position: { x: 64, y: 32 }, priceModifier: 1.2, contrabandAvailable: true,
      supplyCategories: ['food', 'tools'], merchantEntityId: 'npc1',
    });
  });

  it('positions a crafting station at its zone center', () => {
    const { craftingStations } = convertEconomy(proj(
      [zone('z1', 2, 2, 2, 2)],
      [],
      [{ id: 'c1', zoneId: 'z1', stationType: 'forge', availableRecipes: ['iron-blade'] }],
    ));
    // center = ((2 + 1) * 32, (2 + 1) * 32) = (96, 96)
    expect(craftingStations[0]).toMatchObject({ id: 'c1', stationType: 'forge', position: { x: 96, y: 96 } });
  });

  it('drops economy nodes whose zone is missing and warns', () => {
    const { markets, fidelity } = convertEconomy(proj(
      [],
      [{ id: 'm1', zoneId: 'ghost', supplyCategories: [], priceModifier: 1, contrabandAvailable: false }],
      [],
    ));
    expect(markets).toHaveLength(0);
    expect(fidelity.some((f) => f.domain === 'economy' && f.level === 'dropped')).toBe(true);
  });

  it('reports an approximated entry when economy nodes export', () => {
    const { fidelity } = convertEconomy(proj(
      [zone('z1', 0, 0, 1, 1)],
      [{ id: 'm1', zoneId: 'z1', supplyCategories: [], priceModifier: 1, contrabandAvailable: false }],
      [],
    ));
    expect(fidelity.some((f) => f.domain === 'economy' && f.level === 'approximated')).toBe(true);
  });

  it('returns nothing for an economy-free project', () => {
    const { markets, craftingStations, fidelity } = convertEconomy(proj([zone('z1', 0, 0, 1, 1)], [], []));
    expect(markets).toHaveLength(0);
    expect(craftingStations).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });
});
