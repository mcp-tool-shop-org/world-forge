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

import {
  AI_RPG_ENCOUNTER_ANCHOR_TYPES,
  AI_RPG_ENCOUNTER_TYPE_MAP,
  AI_RPG_DROPPED_ENCOUNTER_TYPES,
  isAiRpgEncounterAnchorType,
} from '@world-forge/export-ai-rpg';
import { COMMAND_REGISTRY, getCommandById } from '../command-registry.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import { executeAction, type ExecuteStores } from '../speed-panel-execute.js';
import { SPEED_PANEL_STATE_V2_KEY } from '../store/speed-panel-store.js';
import {
  SPEED_PANEL_OPTIONS_KEY,
  loadSpeedPanelOptions,
} from '../store/speed-panel-options-store.js';
import { emptySelection } from '../store/editor-store.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

function makeExecuteStores(overrides: Partial<ExecuteStores> = {}): ExecuteStores {
  return {
    selectZone: vi.fn(),
    selectEntity: vi.fn(),
    selectLandmark: vi.fn(),
    selectSpawn: vi.fn(),
    selectEncounter: vi.fn(),
    selectConnection: vi.fn(),
    selectKind: vi.fn(),
    clearSelection: vi.fn(),
    setRightTab: vi.fn(),
    setRightCollapsed: vi.fn(),
    setTool: vi.fn(),
    setConnectionStart: vi.fn(),
    setPendingConnectionKind: vi.fn(),
    setViewport: vi.fn(),
    removeSelected: vi.fn(),
    duplicateSelected: vi.fn(() => emptySelection()),
    removeConnection: vi.fn(),
    addConnection: vi.fn(),
    swapConnection: vi.fn(),
    updateZone: vi.fn(),
    mergeZones: vi.fn(() => 'zone-merged'),
    selection: emptySelection(),
    project: structuredClone(minimalProject),
    ...overrides,
  };
}

describe('Speed Panel C4 compatibility contracts (unchanged)', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('unchanged: command IDs (43), Speed Panel actions (18), hotkeys (29), and Tool Palette entries (10) preserve exact IDs and order', () => {
    expect(COMMAND_REGISTRY.map((c) => c.id)).toEqual([
      'new-zone',
      'fit-content',
      'edit-props',
      'delete',
      'duplicate',
      'assign-district',
      'place-entity',
      'place-encounter',
      'connect-from',
      'swap-direction',
      'add-secret-conn',
      'add-channel-conn',
      'add-warp-conn',
      'add-trail-conn',
      'merge-zones',
      'set-elevation',
      'open-review',
      'export-summary',
      'search',
      'save',
      'copy',
      'paste',
      'undo',
      'redo',
      'select-all',
      'escape',
      'nudge-up',
      'nudge-down',
      'nudge-left',
      'nudge-right',
      'open-details',
      'apply-preset',
      'save-preset',
      'tool-select',
      'tool-zone',
      'tool-connection',
      'tool-entity',
      'tool-landmark',
      'tool-spawn',
      'tool-tile',
      'tool-prop',
      'tool-encounter',
      'tool-item',
    ]);
    expect(COMMAND_REGISTRY.some((c) => c.id === 'repeat-last')).toBe(false);

    expect(SPEED_PANEL_ACTIONS.map((a) => [a.id, a.label])).toEqual([
      ['new-zone', 'New Zone'],
      ['fit-content', 'Fit to Content'],
      ['edit-props', 'Edit Properties'],
      ['delete', 'Delete'],
      ['duplicate', 'Duplicate'],
      ['assign-district', 'Assign District'],
      ['place-entity', 'Place Entity Here'],
      ['place-encounter', 'Place Encounter Here'],
      ['connect-from', 'Connect From Here'],
      ['swap-direction', 'Swap Direction'],
      ['add-secret-conn', 'Draw Secret Connection'],
      ['add-channel-conn', 'Draw Channel Connection'],
      ['add-warp-conn', 'Draw Warp Connection'],
      ['add-trail-conn', 'Draw Trail Connection'],
      ['merge-zones', 'Merge Zones'],
      ['set-elevation', 'Set Elevation'],
      ['open-review', 'Open Review'],
      ['export-summary', 'Export Summary'],
    ]);

    expect(HOTKEY_BINDINGS).toHaveLength(29);
    expect(TOOL_PALETTE_TOOLS.map((t) => t.id)).toEqual([
      'select',
      'zone-paint',
      'connection',
      'entity-place',
      'landmark',
      'spawn',
      'tile-paint',
      'prop-place',
      'encounter-place',
      'item-place',
    ]);
  });

  it('unchanged: saved-state keys and default trigger options match base', () => {
    expect(SPEED_PANEL_STATE_V2_KEY).toBe('wf.speedPanel.v2');
    expect(SPEED_PANEL_OPTIONS_KEY).toBe('wf.speedPanel.options.v1');
    expect(loadSpeedPanelOptions()).toEqual({
      version: 1,
      keyTriggerEnabled: true,
      triggerKey: 'KeyQ',
      doubleRightClickEnabled: true,
      clickDriftPx: 6,
      doubleClickRadiusPx: 18,
      doubleClickWindowMs: 320,
    });
  });

  it('unchanged: non-panel command execution and registry preconditions remain intact', () => {
    const stores = makeExecuteStores();
    expect(executeAction('assign-district', { type: 'zone', id: 'zone-entrance' }, stores)).toEqual({ executed: true });
    expect(stores.selectZone).toHaveBeenCalledWith('zone-entrance', false);
    expect(stores.setRightTab).toHaveBeenCalledWith('map');

    expect(executeAction('place-encounter', { type: 'zone', id: 'zone-entrance' }, stores)).toEqual({ executed: true });
    expect(stores.setTool).toHaveBeenCalledWith('encounter-place');

    expect(executeAction('add-secret-conn', { type: 'zone', id: 'zone-entrance' }, stores)).toEqual({ executed: true });
    expect(stores.setPendingConnectionKind).toHaveBeenCalledWith('secret');
    expect(stores.setConnectionStart).toHaveBeenCalledWith('zone-entrance');

    expect(executeAction('merge-zones', { type: 'zone', id: 'zone-entrance' }, stores)).toEqual({
      executed: false,
      reason: 'need at least 2 zones',
    });
    expect(getCommandById('merge-zones')!.disabledReason({
      hit: { type: 'zone', id: 'zone-entrance' },
      selection: { ...emptySelection(), zones: ['zone-entrance'] },
    })).toBe('Select at least 2 zones to merge');

    const elevStores = makeExecuteStores({ promptFn: () => '-7' });
    expect(executeAction('set-elevation', { type: 'zone', id: 'zone-entrance' }, elevStores)).toEqual({ executed: true });
    expect(elevStores.updateZone).toHaveBeenCalledWith('zone-entrance', { elevation: -7 });
  });

  it('unchanged: @world-forge/export-ai-rpg encounter mappings remain intact', () => {
    expect([...AI_RPG_ENCOUNTER_ANCHOR_TYPES]).toEqual(['ambush', 'patrol', 'horde', 'duel']);
    expect(isAiRpgEncounterAnchorType('patrol')).toBe(true);
    expect(isAiRpgEncounterAnchorType('boss')).toBe(false);
    expect(AI_RPG_ENCOUNTER_TYPE_MAP.boss).toBe('duel');
    expect(AI_RPG_ENCOUNTER_TYPE_MAP['caravan-raid']).toBe('ambush');
    expect(AI_RPG_DROPPED_ENCOUNTER_TYPES.has('hazard')).toBe(true);
    expect(AI_RPG_DROPPED_ENCOUNTER_TYPES.has('discovery')).toBe(true);
  });
});
