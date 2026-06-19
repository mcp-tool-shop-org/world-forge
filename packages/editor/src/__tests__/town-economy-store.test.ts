import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { MarketNode, CraftingStation, WorldProject } from '@world-forge/schema';

const store = () => useProjectStore.getState();
const market = (id: string, over: Partial<MarketNode> = {}): MarketNode =>
  ({ id, zoneId: 'z1', supplyCategories: ['food'], priceModifier: 1, contrabandAvailable: false, ...over });
const station = (id: string, over: Partial<CraftingStation> = {}): CraftingStation =>
  ({ id, zoneId: 'z1', stationType: 'forge', availableRecipes: [], ...over });

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('town economy store — market nodes', () => {
  it('adds, updates, and removes a market node', () => {
    store().addMarketNode(market('m1'));
    expect(store().project.marketNodes).toHaveLength(1);
    store().updateMarketNode('m1', { priceModifier: 1.5, contrabandAvailable: true });
    expect(store().project.marketNodes[0]).toMatchObject({ priceModifier: 1.5, contrabandAvailable: true });
    store().removeMarketNode('m1');
    expect(store().project.marketNodes).toHaveLength(0);
  });

  it('uses the documented undo labels', () => {
    store().addMarketNode(market('m1'));
    expect(store().getUndoLabel()).toBe('Add market node');
    store().updateMarketNode('m1', { priceModifier: 2 });
    expect(store().getUndoLabel()).toBe('Update market node');
    store().removeMarketNode('m1');
    expect(store().getUndoLabel()).toBe('Delete market node');
  });
});

describe('town economy store — crafting stations', () => {
  it('adds, updates, and removes a crafting station', () => {
    store().addCraftingStation(station('c1'));
    expect(store().project.craftingStations).toHaveLength(1);
    store().updateCraftingStation('c1', { stationType: 'alchemy', availableRecipes: ['potion'] });
    expect(store().project.craftingStations[0]).toMatchObject({ stationType: 'alchemy', availableRecipes: ['potion'] });
    store().removeCraftingStation('c1');
    expect(store().project.craftingStations).toHaveLength(0);
  });

  it('tolerates a project missing the economy arrays', () => {
    const legacy = { ...createEmptyProject(), marketNodes: undefined, craftingStations: undefined } as unknown as WorldProject;
    useProjectStore.setState({ project: legacy, undoStack: [], redoStack: [], dirty: false });
    expect(() => {
      store().addMarketNode(market('m1'));
      store().addCraftingStation(station('c1'));
    }).not.toThrow();
    expect(store().project.marketNodes).toHaveLength(1);
    expect(store().project.craftingStations).toHaveLength(1);
  });
});
