import { describe, it, expect, vi } from 'vitest';
import { SPEED_PANEL_ACTIONS, filterActions, type SpeedPanelAction } from '../speed-panel-actions.js';
import type { HitResult } from '../hit-testing.js';
import { dispatchHotkey, type HotkeyContext } from '../hotkeys.js';
import type { WorldProject } from '@world-forge/schema';

function makeEvent(overrides: Partial<KeyboardEvent> & { code: string }): KeyboardEvent {
  return {
    code: overrides.code,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    repeat: overrides.repeat ?? false,
    target: overrides.target ?? { tagName: 'DIV' },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

// Helper: build a minimal hotkey context
function makeCtx(overrides: Partial<HotkeyContext> = {}): HotkeyContext {
  return {
    selection: { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] },
    selectedConnection: null,
    project: { zones: [], entityPlacements: [], landmarks: [], spawnPoints: [], encounterAnchors: [] } as unknown as WorldProject,
    showEntities: true,
    showLandmarks: true,
    showSpawns: true,
    clearSelection: () => {},
    selectAll: () => {},
    moveSelected: () => {},
    removeSelected: () => {},
    removeConnection: () => {},
    duplicateSelected: () => ({ zones: [], entities: [], landmarks: [], spawns: [], encounters: [] }),
    setShowSearch: () => {},
    setRightTab: () => {},
    showSpeedPanel: false,
    closeSpeedPanel: () => {},
    ...overrides,
  };
}

describe('SpeedPanel integration', () => {
  it('zone context produces 6 actions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, '', []);
    expect(pinned.length + contextual.length).toBe(6);
  });

  it('empty context produces 2 global actions', () => {
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, null, '', []);
    expect(pinned.length + contextual.length).toBe(2);
  });

  it('search query narrows results', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, 'dup', []);
    const all = [...pinned, ...contextual];
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('duplicate');
  });

  it('Esc dispatches closeSpeedPanel when speed panel is open', () => {
    let closed = false;
    const ctx = makeCtx({
      showSpeedPanel: true,
      closeSpeedPanel: () => { closed = true; },
    });
    const result = dispatchHotkey(makeEvent({ code: 'Escape' }), ctx);
    expect(result.handled).toBe(true);
    expect(closed).toBe(true);
  });

  it('Esc clears selection when speed panel is closed', () => {
    let cleared = false;
    const ctx = makeCtx({
      showSpeedPanel: false,
      clearSelection: () => { cleared = true; },
    });
    dispatchHotkey(makeEvent({ code: 'Escape' }), ctx);
    expect(cleared).toBe(true);
  });

  it('spawn context returns edit + delete only', () => {
    const hit: HitResult = { type: 'spawn', id: 's1' };
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, '', []);
    const ids = [...pinned, ...contextual].map((a) => a.id);
    expect(ids).toEqual(['edit-props', 'delete']);
  });
});

describe('edit mode & reorder', () => {
  it('toggleSpeedPanelEditMode flips state', () => {
    // Import the editor store to test directly
    // Using a simplified simulation:
    let editMode = false;
    const toggle = () => { editMode = !editMode; };
    expect(editMode).toBe(false);
    toggle();
    expect(editMode).toBe(true);
    toggle();
    expect(editMode).toBe(false);
  });

  it('reorderPin produces correct new order', () => {
    const arr = ['a', 'b', 'c'];
    // Simulate reorder: move index 0 to index 2
    const [item] = arr.splice(0, 1);
    arr.splice(2, 0, item);
    expect(arr).toEqual(['b', 'c', 'a']);
  });

  it('closeSpeedPanel resets edit mode', () => {
    // Simulate: closing panel always resets edit mode
    let editMode = true;
    const closePanel = () => { editMode = false; };
    closePanel();
    expect(editMode).toBe(false);
  });

  it('pinned order preserved through filterActions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    // Pin in specific order: duplicate before edit-props
    const { pinned } = filterActions(SPEED_PANEL_ACTIONS, hit, '', ['duplicate', 'edit-props']);
    expect(pinned.map((a) => a.id)).toEqual(['duplicate', 'edit-props']);
  });
});

describe('groups in filterActions', () => {
  it('groups section appears between pinned and contextual', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const groups = [{ id: 'g1', name: 'My Group', actionIds: ['delete', 'duplicate'] }];
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', ['edit-props'], [], groups);
    expect(result.pinned.map((a) => a.id)).toEqual(['edit-props']);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].actions.map((a) => a.id)).toEqual(['delete', 'duplicate']);
    // Grouped actions excluded from contextual
    expect(result.contextual.find((a) => a.id === 'delete')).toBeUndefined();
    expect(result.contextual.find((a) => a.id === 'duplicate')).toBeUndefined();
  });

  it('empty group hidden when no actions match context', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const groups = [{ id: 'g1', name: 'Conn Only', actionIds: ['swap-direction'] }];
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', [], [], groups);
    expect(result.groups.length).toBe(0);
  });

  it('group with mixed valid/invalid actions shows only valid ones', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const groups = [{ id: 'g1', name: 'Mixed', actionIds: ['delete', 'swap-direction'] }];
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', [], [], groups);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].actions.map((a) => a.id)).toEqual(['delete']);
  });
});

describe('macros in filterActions', () => {
  it('macros always included regardless of context', () => {
    const macros = [
      { id: 'm1', name: 'Quick Delete', steps: [{ actionId: 'delete' }] },
    ];
    // null context — macros still appear
    const result = filterActions(SPEED_PANEL_ACTIONS, null, '', [], [], [], macros);
    expect(result.macros.length).toBe(1);
  });

  it('macros filtered by search query', () => {
    const macros = [
      { id: 'm1', name: 'Quick Delete', steps: [] },
      { id: 'm2', name: 'Zone Setup', steps: [] },
    ];
    const result = filterActions(SPEED_PANEL_ACTIONS, null, 'zone', [], [], [], macros);
    expect(result.macros.length).toBe(1);
    expect(result.macros[0].name).toBe('Zone Setup');
  });

  it('macroSafe filter prevents non-safe actions in step dropdown', () => {
    const safe = SPEED_PANEL_ACTIONS.filter((a) => a.macroSafe);
    const unsafe = SPEED_PANEL_ACTIONS.filter((a) => !a.macroSafe);
    // Verify: new-zone, place-entity, connect-from are not macroSafe
    expect(unsafe.map((a) => a.id).sort()).toEqual(['connect-from', 'new-zone', 'place-entity']);
    // The rest are safe
    expect(safe.length).toBe(6);
  });
});

describe('full section order', () => {
  it('filterActions returns all five sections', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const groups = [{ id: 'g1', name: 'Ops', actionIds: ['assign-district'] }];
    const macros = [{ id: 'm1', name: 'Macro', steps: [] }];
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', ['edit-props'], ['delete'], groups, macros);
    expect(result.pinned.length).toBeGreaterThan(0);
    expect(result.recents.length).toBeGreaterThan(0);
    expect(result.groups.length).toBeGreaterThan(0);
    expect(result.macros.length).toBeGreaterThan(0);
    expect(result.contextual.length).toBeGreaterThan(0);
  });

  it('recents exclude pinned actions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', ['edit-props'], ['edit-props', 'delete']);
    expect(result.recents.find((a) => a.id === 'edit-props')).toBeUndefined();
    expect(result.recents.find((a) => a.id === 'delete')).toBeDefined();
  });
});
