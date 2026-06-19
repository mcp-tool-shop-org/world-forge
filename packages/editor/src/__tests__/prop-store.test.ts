import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { PropDefinition, PropPlacement, WorldProject } from '@world-forge/schema';

function makeProp(id: string, overrides: Partial<PropDefinition> = {}): PropDefinition {
  return { id, name: `Prop ${id}`, width: 1, height: 1, tags: ['decor'], walkable: false, interactable: false, ...overrides };
}
function makePlacement(id: string, propId: string, overrides: Partial<PropPlacement> = {}): PropPlacement {
  return { id, propId, gridX: 0, gridY: 0, ...overrides };
}

const store = () => useProjectStore.getState();

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
});

describe('prop store — definitions', () => {
  it('starts empty', () => {
    expect(store().project.props).toEqual([]);
    expect(store().project.propPlacements).toEqual([]);
  });

  it('adds a prop definition', () => {
    store().addProp(makeProp('barrel', { name: 'Barrel', interactable: true }));
    const { props } = store().project;
    expect(props).toHaveLength(1);
    expect(props[0]).toMatchObject({ id: 'barrel', name: 'Barrel', interactable: true });
  });

  it('updates a prop definition', () => {
    store().addProp(makeProp('crate'));
    store().updateProp('crate', { name: 'Wooden Crate', walkable: true });
    expect(store().project.props[0]).toMatchObject({ name: 'Wooden Crate', walkable: true });
  });

  it('update on a missing prop is a no-op', () => {
    store().addProp(makeProp('crate'));
    store().updateProp('nope', { name: 'X' });
    expect(store().project.props[0].name).toBe('Prop crate');
  });

  it('removes a prop definition', () => {
    store().addProp(makeProp('a'));
    store().addProp(makeProp('b'));
    store().removeProp('a');
    expect(store().project.props.map((p) => p.id)).toEqual(['b']);
  });
});

describe('prop store — placements', () => {
  beforeEach(() => { store().addProp(makeProp('barrel')); });

  it('places a prop instance', () => {
    store().addPropPlacement(makePlacement('pp1', 'barrel', { gridX: 3, gridY: 4, zoneId: 'z1' }));
    const { propPlacements } = store().project;
    expect(propPlacements).toHaveLength(1);
    expect(propPlacements[0]).toMatchObject({ id: 'pp1', propId: 'barrel', gridX: 3, gridY: 4, zoneId: 'z1' });
  });

  it('moves a placement via updatePropPlacement', () => {
    store().addPropPlacement(makePlacement('pp1', 'barrel'));
    store().updatePropPlacement('pp1', { gridX: 9, gridY: 9 });
    expect(store().project.propPlacements[0]).toMatchObject({ gridX: 9, gridY: 9 });
  });

  it('removes a placement by id', () => {
    store().addPropPlacement(makePlacement('pp1', 'barrel'));
    store().addPropPlacement(makePlacement('pp2', 'barrel', { gridX: 1 }));
    store().removePropPlacement('pp1');
    expect(store().project.propPlacements.map((p) => p.id)).toEqual(['pp2']);
  });
});

describe('prop store — removeProp cascades to placements', () => {
  it('drops the definition and ITS placements, leaving others', () => {
    store().addProp(makeProp('barrel'));
    store().addProp(makeProp('crate'));
    store().addPropPlacement(makePlacement('pp1', 'barrel'));
    store().addPropPlacement(makePlacement('pp2', 'barrel', { gridX: 2 }));
    store().addPropPlacement(makePlacement('pp3', 'crate'));
    store().removeProp('barrel');
    expect(store().project.props.map((p) => p.id)).toEqual(['crate']);
    // barrel's two placements are gone; crate's placement survives.
    expect(store().project.propPlacements.map((p) => p.id)).toEqual(['pp3']);
  });
});

describe('prop store — undo labels + robustness', () => {
  it('uses the documented undo labels', () => {
    store().addProp(makeProp('a'));
    expect(store().getUndoLabel()).toBe('Add prop');
    store().addPropPlacement(makePlacement('pp1', 'a'));
    expect(store().getUndoLabel()).toBe('Place prop');
    store().removePropPlacement('pp1');
    expect(store().getUndoLabel()).toBe('Remove prop placement');
    store().removeProp('a');
    expect(store().getUndoLabel()).toBe('Delete prop');
  });

  it('undo reverts a cascade delete atomically', () => {
    store().addProp(makeProp('a'));
    store().addPropPlacement(makePlacement('pp1', 'a'));
    store().removeProp('a');
    expect(store().project.props).toHaveLength(0);
    expect(store().project.propPlacements).toHaveLength(0);
    store().undo();
    expect(store().project.props).toHaveLength(1);
    expect(store().project.propPlacements).toHaveLength(1);
  });

  it('tolerates a project missing the prop arrays', () => {
    const legacy = { ...createEmptyProject(), props: undefined, propPlacements: undefined } as unknown as WorldProject;
    useProjectStore.setState({ project: legacy, undoStack: [], redoStack: [], dirty: false });
    expect(() => {
      store().addProp(makeProp('a'));
      store().addPropPlacement(makePlacement('pp1', 'a'));
    }).not.toThrow();
    expect(store().project.props).toHaveLength(1);
    expect(store().project.propPlacements).toHaveLength(1);
  });
});
