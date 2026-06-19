import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { Building, Hub, Stronghold, WorldProject } from '@world-forge/schema';

const store = () => useProjectStore.getState();
const building = (id: string, over: Partial<Building> = {}): Building =>
  ({ id, name: id, buildingType: 'house', gridX: 0, gridY: 0, width: 2, height: 2, tags: [], ...over });
const hub = (id: string, over: Partial<Hub> = {}): Hub =>
  ({ id, name: id, zoneId: 'z1', hubType: 'town-center', serviceTypes: [], connectedZoneIds: [], tags: [], ...over });
const stronghold = (id: string, over: Partial<Stronghold> = {}): Stronghold =>
  ({ id, name: id, zoneId: 'z1', defenseLevel: 1, garrisonEntityIds: [], tags: [], ...over });

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('town structures store — buildings', () => {
  it('adds, updates, and removes a building', () => {
    store().addBuilding(building('b1'));
    expect(store().project.buildings).toHaveLength(1);
    store().updateBuilding('b1', { buildingType: 'shop', interiorZoneId: 'z-interior', width: 3 });
    expect(store().project.buildings![0]).toMatchObject({ buildingType: 'shop', interiorZoneId: 'z-interior', width: 3 });
    store().removeBuilding('b1');
    expect(store().project.buildings).toHaveLength(0);
  });

  it('uses the documented undo labels', () => {
    store().addBuilding(building('b1'));
    expect(store().getUndoLabel()).toBe('Add building');
    store().updateBuilding('b1', { name: 'Smithy' });
    expect(store().getUndoLabel()).toBe('Update building');
    store().removeBuilding('b1');
    expect(store().getUndoLabel()).toBe('Delete building');
  });
});

describe('town structures store — hubs', () => {
  it('adds, updates, and removes a hub', () => {
    store().addHub(hub('h1'));
    expect(store().project.hubs).toHaveLength(1);
    store().updateHub('h1', { hubType: 'market-square', serviceTypes: ['market', 'inn'] });
    expect(store().project.hubs![0]).toMatchObject({ hubType: 'market-square', serviceTypes: ['market', 'inn'] });
    store().removeHub('h1');
    expect(store().project.hubs).toHaveLength(0);
  });

  it('uses the documented undo labels', () => {
    store().addHub(hub('h1'));
    expect(store().getUndoLabel()).toBe('Add hub');
    store().updateHub('h1', { connectedZoneIds: ['z2'] });
    expect(store().getUndoLabel()).toBe('Update hub');
    store().removeHub('h1');
    expect(store().getUndoLabel()).toBe('Delete hub');
  });
});

describe('town structures store — strongholds', () => {
  it('adds, updates, and removes a stronghold', () => {
    store().addStronghold(stronghold('s1'));
    expect(store().project.strongholds).toHaveLength(1);
    store().updateStronghold('s1', { defenseLevel: 5, factionId: 'iron-legion', garrisonEntityIds: ['npc-guard'] });
    expect(store().project.strongholds![0]).toMatchObject({ defenseLevel: 5, factionId: 'iron-legion', garrisonEntityIds: ['npc-guard'] });
    store().removeStronghold('s1');
    expect(store().project.strongholds).toHaveLength(0);
  });

  it('uses the documented undo labels', () => {
    store().addStronghold(stronghold('s1'));
    expect(store().getUndoLabel()).toBe('Add stronghold');
    store().updateStronghold('s1', { defenseLevel: 3 });
    expect(store().getUndoLabel()).toBe('Update stronghold');
    store().removeStronghold('s1');
    expect(store().getUndoLabel()).toBe('Delete stronghold');
  });
});

describe('town structures store — legacy projects', () => {
  it('tolerates a project missing the structure arrays', () => {
    const legacy = {
      ...createEmptyProject(), buildings: undefined, hubs: undefined, strongholds: undefined,
    } as unknown as WorldProject;
    useProjectStore.setState({ project: legacy, undoStack: [], redoStack: [], dirty: false });
    expect(() => {
      store().addBuilding(building('b1'));
      store().addHub(hub('h1'));
      store().addStronghold(stronghold('s1'));
    }).not.toThrow();
    expect(store().project.buildings).toHaveLength(1);
    expect(store().project.hubs).toHaveLength(1);
    expect(store().project.strongholds).toHaveLength(1);
  });
});
