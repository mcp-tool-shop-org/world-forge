import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { Stratum, StratumLink, Zone, WorldProject } from '@world-forge/schema';

const store = () => useProjectStore.getState();
const stratum = (id: string, over: Partial<Stratum> = {}): Stratum =>
  ({ id, name: id, order: 0, tags: [], ...over });
const link = (id: string, over: Partial<StratumLink> = {}): StratumLink =>
  ({ id, fromStratumId: 'surface', toStratumId: 'under', bidirectional: true, linkType: 'stairs', ...over });
const zone = (id: string, over: Partial<Zone> = {}): Zone =>
  ({ id, name: id, tags: [], description: '', gridX: 0, gridY: 0, gridWidth: 2, gridHeight: 2, neighbors: [], exits: [], light: 1, noise: 0, hazards: [], interactables: [], ...over });

function projectWithZones(zones: Zone[]): WorldProject {
  return { ...createEmptyProject(), zones };
}

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('world-modeling store — strata', () => {
  it('adds, updates, and removes a stratum', () => {
    store().addStratum(stratum('surface', { order: 0 }));
    expect(store().project.strata).toHaveLength(1);
    store().updateStratum('surface', { order: 1, zRange: { floor: 0, ceiling: 10 } });
    expect(store().project.strata![0]).toMatchObject({ order: 1, zRange: { floor: 0, ceiling: 10 } });
    store().removeStratum('surface');
    expect(store().project.strata).toHaveLength(0);
  });

  it('uses the documented undo labels', () => {
    store().addStratum(stratum('surface'));
    expect(store().getUndoLabel()).toBe('Add stratum');
    store().updateStratum('surface', { name: 'Surface' });
    expect(store().getUndoLabel()).toBe('Update stratum');
    store().removeStratum('surface');
    expect(store().getUndoLabel()).toBe('Delete stratum');
  });
});

describe('world-modeling store — stratum links', () => {
  it('adds, updates, and removes a stratum link', () => {
    store().addStratumLink(link('l1'));
    expect(store().project.stratumLinks).toHaveLength(1);
    store().updateStratumLink('l1', { linkType: 'elevator', bidirectional: false });
    expect(store().project.stratumLinks![0]).toMatchObject({ linkType: 'elevator', bidirectional: false });
    store().removeStratumLink('l1');
    expect(store().project.stratumLinks).toHaveLength(0);
  });
});

describe('world-modeling store — zone assignment + cascade', () => {
  it('assigns and clears a zone stratum', () => {
    useProjectStore.setState({ project: projectWithZones([zone('z1')]), undoStack: [], redoStack: [], dirty: false });
    store().addStratum(stratum('surface'));
    store().setZoneStratum('z1', 'surface');
    expect(store().project.zones[0].stratumId).toBe('surface');
    expect(store().getUndoLabel()).toBe('Assign zone stratum');
    store().setZoneStratum('z1', undefined);
    expect(store().project.zones[0].stratumId).toBeUndefined();
    expect(store().getUndoLabel()).toBe('Clear zone stratum');
  });

  it('removeStratum cascades: drops links touching it + clears zone stratumId', () => {
    useProjectStore.setState({
      project: { ...projectWithZones([zone('z1', { stratumId: 'under' }), zone('z2', { stratumId: 'surface' })]),
        strata: [stratum('surface'), stratum('under', { order: -1 })],
        stratumLinks: [link('l1', { fromStratumId: 'surface', toStratumId: 'under' })] },
      undoStack: [], redoStack: [], dirty: false,
    });
    store().removeStratum('under');
    expect(store().project.strata!.map((s) => s.id)).toEqual(['surface']);
    // The link touched 'under' → dropped.
    expect(store().project.stratumLinks).toHaveLength(0);
    // z1 was in 'under' → cleared; z2 in 'surface' → untouched.
    expect(store().project.zones.find((z) => z.id === 'z1')!.stratumId).toBeUndefined();
    expect(store().project.zones.find((z) => z.id === 'z2')!.stratumId).toBe('surface');
  });
});

describe('world-modeling store — legacy projects', () => {
  it('tolerates a project missing the strata arrays', () => {
    const legacy = { ...createEmptyProject(), strata: undefined, stratumLinks: undefined } as unknown as WorldProject;
    useProjectStore.setState({ project: legacy, undoStack: [], redoStack: [], dirty: false });
    expect(() => {
      store().addStratum(stratum('surface'));
      store().addStratumLink(link('l1'));
    }).not.toThrow();
    expect(store().project.strata).toHaveLength(1);
    expect(store().project.stratumLinks).toHaveLength(1);
  });
});
