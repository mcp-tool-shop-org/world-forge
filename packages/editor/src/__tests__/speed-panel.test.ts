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
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, '', new Set());
    expect(pinned.length + contextual.length).toBe(6);
  });

  it('empty context produces 2 global actions', () => {
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, null, '', new Set());
    expect(pinned.length + contextual.length).toBe(2);
  });

  it('search query narrows results', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, 'dup', new Set());
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
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, '', new Set());
    const ids = [...pinned, ...contextual].map((a) => a.id);
    expect(ids).toEqual(['edit-props', 'delete']);
  });
});
