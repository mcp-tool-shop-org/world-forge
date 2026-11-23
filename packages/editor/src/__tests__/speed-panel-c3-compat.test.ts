import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla');
  type AnyStateCreator = import('zustand/vanilla').StateCreator<unknown>;
  const identity = <T,>(x: T) => x;
  const createImpl = (createState: AnyStateCreator) => {
    const api = createStore<unknown>(createState);
    const useBoundStore = (selector: (s: unknown) => unknown = identity) => selector(api.getState());
    return Object.assign(useBoundStore, api);
  };
  const create = (createState?: AnyStateCreator) =>
    createState ? createImpl(createState) : createImpl;
  return { create };
});

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, String(v)); },
    removeItem: (k: string) => { storage.delete(k); },
    clear: () => { storage.clear(); },
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  },
  configurable: true,
});

import { COMMAND_REGISTRY } from '../command-registry.js';
import { SPEED_PANEL_ACTIONS, filterActions } from '../speed-panel-actions.js';
import { HOTKEY_BINDINGS, dispatchHotkey } from '../hotkeys.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import {
  DEFAULT_SPEED_PANEL_OPTIONS,
  SPEED_PANEL_OPTIONS_KEY,
  loadSpeedPanelOptions,
} from '../store/speed-panel-options-store.js';
import { emptySelection } from '../store/editor-store.js';
import type { HitResult } from '../hit-testing.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

describe('Speed Panel C3 compatibility contracts (unchanged)', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('unchanged: saved pre-C3 localStorage pins, recents, groups, macros, and v1 options load losslessly', async () => {
    storage.set('world-forge-speed-panel-pins', JSON.stringify(['edit-props', 'duplicate']));
    storage.set('world-forge-speed-panel-recents', JSON.stringify(['assign-district', 'delete']));
    storage.set('world-forge-speed-panel-groups', JSON.stringify([
      { id: 'g-legacy', name: 'Zone Ops', actionIds: ['edit-props', 'delete'] },
    ]));
    storage.set('world-forge-speed-panel-macros', JSON.stringify([
      { id: 'm-legacy', name: 'Inspect Zone', steps: [{ actionId: 'edit-props' }] },
    ]));
    storage.set(SPEED_PANEL_OPTIONS_KEY, JSON.stringify({
      ...DEFAULT_SPEED_PANEL_OPTIONS,
      triggerKey: 'KeyK',
      clickDriftPx: 9,
    }));

    vi.resetModules();
    const { useSpeedPanelPins } = await import('../store/speed-panel-store.js');
    const state = useSpeedPanelPins.getState();

    expect(state.pinnedIds).toEqual(['edit-props', 'duplicate']);
    expect(state.recentIds).toEqual(['assign-district', 'delete']);
    expect(state.groups).toEqual([{ id: 'g-legacy', name: 'Zone Ops', actionIds: ['edit-props', 'delete'] }]);
    expect(state.macros).toEqual([{ id: 'm-legacy', name: 'Inspect Zone', steps: [{ actionId: 'edit-props' }] }]);

    const opts = loadSpeedPanelOptions();
    expect(opts.triggerKey).toBe('KeyK');
    expect(opts.clickDriftPx).toBe(9);
    expect(opts.doubleClickRadiusPx).toBe(18);
    expect(opts.doubleClickWindowMs).toBe(320);
  });

  it('unchanged: command registry IDs, 18 Speed Panel action IDs, 29 hotkey bindings, and 10 tool-palette entries remain intact', () => {
    expect(COMMAND_REGISTRY).toHaveLength(43);
    expect(SPEED_PANEL_ACTIONS).toHaveLength(18);
    expect(HOTKEY_BINDINGS).toHaveLength(29);
    expect(TOOL_PALETTE_TOOLS).toHaveLength(10);

    const hit: HitResult = { type: 'zone', id: 'zone-entrance' };
    const filtered = filterActions(SPEED_PANEL_ACTIONS, hit, 'dup', []);
    expect(filtered.contextual.map((a) => a.id)).toEqual(['duplicate']);

    const setTool = vi.fn();
    const res = dispatchHotkey(
      {
        code: 'KeyZ',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        repeat: false,
        target: { tagName: 'DIV' },
        preventDefault: vi.fn(),
      } as unknown as KeyboardEvent,
      {
        selection: emptySelection(),
        selectedConnection: null,
        project: minimalProject,
        showEntities: true,
        showLandmarks: true,
        showSpawns: true,
        activeModal: null,
        showSearch: false,
        clearSelection: vi.fn(),
        selectAll: vi.fn(),
        moveSelected: vi.fn(),
        removeSelected: vi.fn(),
        removeConnection: vi.fn(),
        duplicateSelected: vi.fn(() => emptySelection()),
        setShowSearch: vi.fn(),
        setRightTab: vi.fn(),
        setTool,
        showSpeedPanel: false,
        closeSpeedPanel: vi.fn(),
      },
    );
    expect(res).toEqual({ handled: true, action: 'tool-zone' });
    expect(setTool).toHaveBeenCalledWith('zone-paint');
  });
});
