import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the store
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
});

// Dynamic import so mock is in place
const { useSpeedPanelPins } = await import('../store/speed-panel-store.js');

describe('useSpeedPanelPins', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelPins.setState({ pinnedIds: [], recentIds: [], groups: [], macros: [] });
  });

  it('togglePin adds and removes', () => {
    useSpeedPanelPins.getState().togglePin('edit-props');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['edit-props']);

    useSpeedPanelPins.getState().togglePin('edit-props');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual([]);
  });

  it('persists to localStorage', () => {
    useSpeedPanelPins.getState().togglePin('delete');
    const raw = storage.get('world-forge-speed-panel-pins');
    expect(raw).toBe(JSON.stringify(['delete']));
  });

  it('pinnedIds reflects current state', () => {
    useSpeedPanelPins.getState().togglePin('a');
    useSpeedPanelPins.getState().togglePin('b');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['a', 'b']);
    useSpeedPanelPins.getState().togglePin('a');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['b']);
  });
});

describe('reorderPin', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelPins.setState({ pinnedIds: ['a', 'b', 'c'], recentIds: [], groups: [], macros: [] });
  });

  it('swaps pin positions correctly', () => {
    useSpeedPanelPins.getState().reorderPin(0, 2);
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['b', 'c', 'a']);
  });

  it('persists reorder to localStorage', () => {
    useSpeedPanelPins.getState().reorderPin(2, 0);
    const raw = storage.get('world-forge-speed-panel-pins');
    expect(JSON.parse(raw!)).toEqual(['c', 'a', 'b']);
  });

  it('ignores out-of-bounds indices', () => {
    useSpeedPanelPins.getState().reorderPin(-1, 0);
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['a', 'b', 'c']);
  });
});

describe('recents', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelPins.setState({ pinnedIds: [], recentIds: [], groups: [], macros: [] });
  });

  it('addRecent dedupes and caps at 5', () => {
    const { addRecent } = useSpeedPanelPins.getState();
    addRecent('a');
    addRecent('b');
    addRecent('c');
    addRecent('d');
    addRecent('e');
    addRecent('f'); // pushes 'a' out
    expect(useSpeedPanelPins.getState().recentIds).toEqual(['f', 'e', 'd', 'c', 'b']);
  });

  it('addRecent moves duplicate to front', () => {
    const s = useSpeedPanelPins.getState();
    s.addRecent('a');
    s.addRecent('b');
    s.addRecent('a'); // should move to front
    expect(useSpeedPanelPins.getState().recentIds).toEqual(['a', 'b']);
  });

  it('persists recents to localStorage', () => {
    useSpeedPanelPins.getState().addRecent('x');
    const raw = storage.get('world-forge-speed-panel-recents');
    expect(JSON.parse(raw!)).toEqual(['x']);
  });
});

describe('groups CRUD', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelPins.setState({ pinnedIds: [], recentIds: [], groups: [], macros: [] });
  });

  it('addGroup + updateGroup + removeGroup', () => {
    const s = useSpeedPanelPins.getState();
    s.addGroup({ id: 'g1', name: 'Zone Ops', actionIds: ['delete'] });
    expect(useSpeedPanelPins.getState().groups).toEqual([{ id: 'g1', name: 'Zone Ops', actionIds: ['delete'] }]);

    useSpeedPanelPins.getState().updateGroup('g1', { name: 'Zone Actions' });
    expect(useSpeedPanelPins.getState().groups[0].name).toBe('Zone Actions');

    useSpeedPanelPins.getState().removeGroup('g1');
    expect(useSpeedPanelPins.getState().groups).toEqual([]);
  });

  it('addActionToGroup and removeActionFromGroup', () => {
    useSpeedPanelPins.getState().addGroup({ id: 'g1', name: 'Ops', actionIds: ['delete'] });
    useSpeedPanelPins.getState().addActionToGroup('g1', 'duplicate');
    expect(useSpeedPanelPins.getState().groups[0].actionIds).toEqual(['delete', 'duplicate']);

    // Adding duplicate actionId is idempotent
    useSpeedPanelPins.getState().addActionToGroup('g1', 'duplicate');
    expect(useSpeedPanelPins.getState().groups[0].actionIds).toEqual(['delete', 'duplicate']);

    useSpeedPanelPins.getState().removeActionFromGroup('g1', 'delete');
    expect(useSpeedPanelPins.getState().groups[0].actionIds).toEqual(['duplicate']);
  });

  it('persists groups to localStorage', () => {
    useSpeedPanelPins.getState().addGroup({ id: 'g1', name: 'Test', actionIds: [] });
    const raw = storage.get('world-forge-speed-panel-groups');
    expect(JSON.parse(raw!)).toEqual([{ id: 'g1', name: 'Test', actionIds: [] }]);
  });
});

describe('macros CRUD', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelPins.setState({ pinnedIds: [], recentIds: [], groups: [], macros: [] });
  });

  it('addMacro + updateMacro + removeMacro', () => {
    const s = useSpeedPanelPins.getState();
    s.addMacro({ id: 'm1', name: 'Quick Delete', steps: [{ actionId: 'delete' }] });
    expect(useSpeedPanelPins.getState().macros.length).toBe(1);

    useSpeedPanelPins.getState().updateMacro('m1', { name: 'Fast Delete' });
    expect(useSpeedPanelPins.getState().macros[0].name).toBe('Fast Delete');

    useSpeedPanelPins.getState().removeMacro('m1');
    expect(useSpeedPanelPins.getState().macros).toEqual([]);
  });

  it('addStepToMacro appends step', () => {
    useSpeedPanelPins.getState().addMacro({ id: 'm1', name: 'Test', steps: [{ actionId: 'delete' }] });
    useSpeedPanelPins.getState().addStepToMacro('m1', 'duplicate');
    expect(useSpeedPanelPins.getState().macros[0].steps).toEqual([{ actionId: 'delete' }, { actionId: 'duplicate' }]);
  });

  it('removeStepFromMacro removes correct step', () => {
    useSpeedPanelPins.getState().addMacro({ id: 'm1', name: 'Test', steps: [{ actionId: 'a' }, { actionId: 'b' }, { actionId: 'c' }] });
    useSpeedPanelPins.getState().removeStepFromMacro('m1', 1);
    expect(useSpeedPanelPins.getState().macros[0].steps).toEqual([{ actionId: 'a' }, { actionId: 'c' }]);
  });

  it('reorderMacroStep swaps correctly', () => {
    useSpeedPanelPins.getState().addMacro({ id: 'm1', name: 'Test', steps: [{ actionId: 'a' }, { actionId: 'b' }, { actionId: 'c' }] });
    useSpeedPanelPins.getState().reorderMacroStep('m1', 0, 2);
    expect(useSpeedPanelPins.getState().macros[0].steps.map((s) => s.actionId)).toEqual(['b', 'c', 'a']);
  });

  it('persists macros to localStorage', () => {
    useSpeedPanelPins.getState().addMacro({ id: 'm1', name: 'Test', steps: [] });
    const raw = storage.get('world-forge-speed-panel-macros');
    expect(JSON.parse(raw!)).toEqual([{ id: 'm1', name: 'Test', steps: [] }]);
  });
});
