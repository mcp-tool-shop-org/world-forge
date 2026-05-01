// undo-labels.test.ts — verify all project store operations produce descriptive undo labels
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { Zone, District, EntityPlacement, AssetEntry, DialogueDefinition } from '@world-forge/schema';

function reset() {
  useProjectStore.setState({
    project: createEmptyProject(),
    dirty: false,
    undoStack: [],
    redoStack: [],
  });
}

function lastLabel(): string | null {
  return useProjectStore.getState().getUndoLabel();
}

const zone: Zone = {
  id: 'z1', name: 'Test', description: '', tags: [], gridX: 0, gridY: 0,
  gridWidth: 2, gridHeight: 2, neighbors: [], exits: [], light: 50, noise: 50,
  hazards: [], interactables: [],
};

const entity: EntityPlacement = {
  entityId: 'e1', zoneId: 'z1', role: 'npc', name: 'NPC',
  tags: [], gridX: 0, gridY: 0,
};

const asset: AssetEntry = {
  id: 'a1', kind: 'portrait', label: 'Test Portrait', path: '/test.png', tags: [],
};

const dialogue: DialogueDefinition = {
  id: 'd1', speakers: [], nodes: {}, entryNodeId: 'n1',
};

beforeEach(reset);

describe('undo labels — no generic "Edit" labels', () => {
  // Zone CRUD
  it('addZone → "Add zone"', () => {
    useProjectStore.getState().addZone(zone);
    expect(lastLabel()).toBe('Add zone');
  });

  it('updateZone → "Update zone"', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().updateZone('z1', { name: 'Renamed' });
    expect(lastLabel()).toBe('Update zone');
  });

  it('removeZone → "Delete zone"', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().removeZone('z1');
    expect(lastLabel()).toBe('Delete zone');
  });

  // Entity CRUD
  it('addEntity → "Add entity"', () => {
    useProjectStore.getState().addEntity(entity);
    expect(lastLabel()).toBe('Add entity');
  });

  // Asset CRUD
  it('addAsset has label', () => {
    useProjectStore.getState().addAsset(asset);
    expect(lastLabel()).toBe('Add asset');
  });

  it('updateAsset has label', () => {
    useProjectStore.getState().addAsset(asset);
    useProjectStore.getState().updateAsset('a1', { label: 'Renamed' });
    expect(lastLabel()).toBe('Update asset');
  });

  it('removeAsset has label', () => {
    useProjectStore.getState().addAsset(asset);
    useProjectStore.getState().removeAsset('a1');
    expect(lastLabel()).toBe('Delete asset');
  });

  // Dialogue CRUD
  it('addDialogue has label', () => {
    useProjectStore.getState().addDialogue(dialogue);
    expect(lastLabel()).toBe('Add dialogue');
  });

  // District CRUD
  it('addDistrict has label', () => {
    const d: District = { id: 'd1', name: 'D1', tags: [], zoneIds: [], controllingFaction: '', baseMetrics: { commerce: 0, morale: 0, safety: 0, stability: 0 }, economyProfile: { supplyCategories: [], scarcityDefaults: {} } };
    useProjectStore.getState().addDistrict(d);
    expect(lastLabel()).toBe('Add district');
  });

  // Faction CRUD
  it('addFaction has label', () => {
    useProjectStore.getState().addFaction({ factionId: 'f1', districtIds: [], influence: 50, alertLevel: 0, patrolRoutes: [] });
    expect(lastLabel()).toBe('Add faction');
  });

  // Build catalog
  it('addArchetype has label', () => {
    useProjectStore.getState().addArchetype({ id: 'arch1', name: 'Warrior', description: '', statPriorities: {}, startingTags: [], progressionTreeId: 'tree1' });
    expect(lastLabel()).toBe('Add archetype');
  });

  // Progression tree
  it('addProgressionTree has label', () => {
    useProjectStore.getState().addProgressionTree({ id: 'tree1', name: 'Tree', currency: 'xp', nodes: [] });
    expect(lastLabel()).toBe('Add progression tree');
  });

  // Multi-select batch ops
  it('moveSelected has descriptive label', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().moveSelected({ zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] }, 1, 0);
    expect(lastLabel()).toBe('Move 1 object');
  });

  it('removeSelected has descriptive label', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().removeSelected({ zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] });
    expect(lastLabel()).toBe('Delete 1 object');
  });

  // Player template
  it('setPlayerTemplate has label', () => {
    useProjectStore.getState().setPlayerTemplate({ name: 'Hero', spawnPointId: 'z1', baseStats: {}, baseResources: {}, startingInventory: [], startingEquipment: {}, tags: [], custom: {} });
    expect(lastLabel()).toBe('Set player template');
  });

  // No label should ever be the default "Edit"
  it('all operations produce non-default labels', () => {
    const ops: Array<() => void> = [
      () => useProjectStore.getState().addZone(zone),
      () => useProjectStore.getState().addEntity(entity),
      () => useProjectStore.getState().addAsset(asset),
      () => useProjectStore.getState().addDialogue(dialogue),
      () => useProjectStore.getState().addFaction({ factionId: 'f1', districtIds: [], influence: 50, alertLevel: 0, patrolRoutes: [] }),
      () => useProjectStore.getState().addPressureHotspot({ id: 'h1', zoneId: 'z1', pressureType: 'crime', baseProbability: 0.5, tags: [] }),
      () => useProjectStore.getState().setPlayerTemplate({ name: 'Hero', spawnPointId: 'z1', baseStats: {}, baseResources: {}, startingInventory: [], startingEquipment: {}, tags: [], custom: {} }),
      () => useProjectStore.getState().addArchetype({ id: 'arch1', name: 'W', description: '', statPriorities: {}, startingTags: [], progressionTreeId: 'tree1' }),
      () => useProjectStore.getState().addProgressionTree({ id: 'tree1', name: 'T', currency: 'xp', nodes: [] }),
    ];

    for (const op of ops) {
      reset();
      op();
      const label = lastLabel();
      expect(label).not.toBe('Edit');
      expect(label).toBeTruthy();
    }
  });
});

describe('undo/redo core mechanics', () => {
  it('undo restores previous state', () => {
    useProjectStore.getState().addZone(zone);
    expect(useProjectStore.getState().project.zones.length).toBe(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.zones.length).toBe(0);
  });

  it('redo re-applies undone change', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().undo();
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.zones.length).toBe(1);
  });

  it('new edit clears redo stack', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().getRedoCount()).toBe(1);
    useProjectStore.getState().addEntity(entity);
    expect(useProjectStore.getState().getRedoCount()).toBe(0);
  });

  it('loadProject resets undo and redo stacks', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().addEntity(entity);
    expect(useProjectStore.getState().getUndoCount()).toBe(2);
    useProjectStore.getState().loadProject(createEmptyProject());
    expect(useProjectStore.getState().getUndoCount()).toBe(0);
    expect(useProjectStore.getState().getRedoCount()).toBe(0);
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('newProject resets undo and redo stacks', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().newProject();
    expect(useProjectStore.getState().getUndoCount()).toBe(0);
    expect(useProjectStore.getState().getRedoCount()).toBe(0);
  });

  it('markClean preserves undo stack', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().addEntity(entity);
    expect(useProjectStore.getState().getUndoCount()).toBe(2);
    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().getUndoCount()).toBe(2);
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('undo after markClean sets dirty back to true', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().dirty).toBe(false);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().dirty).toBe(true);
  });

  it('batch operations produce single undo entry', () => {
    useProjectStore.getState().addZone(zone);
    useProjectStore.getState().addZone({ ...zone, id: 'z2', name: 'Z2', gridX: 5 });
    const before = useProjectStore.getState().getUndoCount();
    useProjectStore.getState().moveSelected(
      { zones: ['z1', 'z2'], entities: [], landmarks: [], spawns: [], encounters: [] }, 1, 0,
    );
    expect(useProjectStore.getState().getUndoCount()).toBe(before + 1);
    expect(lastLabel()).toBe('Move 2 objects');
  });
});
