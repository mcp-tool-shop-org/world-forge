import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { HazardDefinition, Zone, WorldProject } from '@world-forge/schema';

const store = () => useProjectStore.getState();
const hazard = (id: string, over: Partial<HazardDefinition> = {}): HazardDefinition =>
  ({ id, name: id, effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-end' }], trigger: 'on-enter', tags: [], ...over });
const zone = (id: string, over: Partial<Zone> = {}): Zone =>
  ({ id, name: id, tags: [], description: '', gridX: 0, gridY: 0, gridWidth: 2, gridHeight: 2, neighbors: [], exits: [], light: 1, noise: 0, hazards: [], interactables: [], ...over });

function projectWithZones(zones: Zone[]): WorldProject {
  return { ...createEmptyProject(), zones };
}

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('world-modeling store — hazard definitions', () => {
  it('adds, updates, and removes a hazard definition', () => {
    store().addHazardDefinition(hazard('lava'));
    expect(store().project.hazardDefinitions).toHaveLength(1);
    store().updateHazardDefinition('lava', { passable: 'never', blocksVision: true, moveCostDelta: 2 });
    expect(store().project.hazardDefinitions![0]).toMatchObject({ passable: 'never', blocksVision: true, moveCostDelta: 2 });
    store().removeHazardDefinition('lava');
    expect(store().project.hazardDefinitions).toHaveLength(0);
  });

  it('uses the documented undo labels', () => {
    store().addHazardDefinition(hazard('lava'));
    expect(store().getUndoLabel()).toBe('Add hazard');
    store().updateHazardDefinition('lava', { name: 'Lava' });
    expect(store().getUndoLabel()).toBe('Update hazard');
    store().removeHazardDefinition('lava');
    expect(store().getUndoLabel()).toBe('Delete hazard');
  });
});

describe('world-modeling store — zone hazard refs + cascade', () => {
  it('sets a zone hazard refs list', () => {
    useProjectStore.setState({ project: projectWithZones([zone('z1')]), undoStack: [], redoStack: [], dirty: false });
    store().addHazardDefinition(hazard('poison'));
    store().setZoneHazardRefs('z1', ['poison']);
    expect(store().project.zones[0].hazardRefs).toEqual(['poison']);
    expect(store().getUndoLabel()).toBe('Update zone hazards');
  });

  it('removeHazardDefinition cascades: drops the id from every zone hazardRefs', () => {
    useProjectStore.setState({
      project: {
        ...projectWithZones([zone('z1', { hazardRefs: ['poison', 'lava'] }), zone('z2', { hazardRefs: ['lava'] })]),
        hazardDefinitions: [hazard('poison'), hazard('lava')],
      },
      undoStack: [], redoStack: [], dirty: false,
    });
    store().removeHazardDefinition('poison');
    expect(store().project.hazardDefinitions!.map((h) => h.id)).toEqual(['lava']);
    expect(store().project.zones.find((z) => z.id === 'z1')!.hazardRefs).toEqual(['lava']);
    expect(store().project.zones.find((z) => z.id === 'z2')!.hazardRefs).toEqual(['lava']);
  });
});

describe('world-modeling store — legacy projects', () => {
  it('tolerates a project missing the hazardDefinitions array', () => {
    const legacy = { ...createEmptyProject(), hazardDefinitions: undefined } as unknown as WorldProject;
    useProjectStore.setState({ project: legacy, undoStack: [], redoStack: [], dirty: false });
    expect(() => store().addHazardDefinition(hazard('lava'))).not.toThrow();
    expect(store().project.hazardDefinitions).toHaveLength(1);
  });
});
