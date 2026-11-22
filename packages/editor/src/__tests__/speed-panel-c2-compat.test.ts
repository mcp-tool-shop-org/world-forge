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
  },
  configurable: true,
});

import { HOTKEY_BINDINGS } from '../hotkeys.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';

describe('Speed Panel C2 base compatibility (unchanged)', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('unchanged: saved pre-C2 localStorage state loads pins, recents, groups, and macros through the store', async () => {
    storage.set('world-forge-speed-panel-pins', JSON.stringify(['edit-props', 'delete']));
    storage.set('world-forge-speed-panel-recents', JSON.stringify(['fit-content']));
    storage.set('world-forge-speed-panel-groups', JSON.stringify([{ id: 'g1', name: 'Core', actionIds: ['edit-props'] }]));
    storage.set('world-forge-speed-panel-macros', JSON.stringify([{ id: 'm1', name: 'Quick', steps: [{ actionId: 'edit-props' }] }]));

    vi.resetModules();
    const { useSpeedPanelPins } = await import('../store/speed-panel-store.js');
    const pins = useSpeedPanelPins.getState();
    expect(pins.pinnedIds).toEqual(['edit-props', 'delete']);
    expect(pins.recentIds).toEqual(['fit-content']);
    expect(pins.groups).toEqual([{ id: 'g1', name: 'Core', actionIds: ['edit-props'] }]);
    expect(pins.macros).toEqual([{ id: 'm1', name: 'Quick', steps: [{ actionId: 'edit-props' }] }]);
  });

  it('unchanged: existing hotkeys, tool palette entries, and speed panel actions match base snapshots in value and order', () => {
    expect(
      HOTKEY_BINDINGS.map((b) => ({
        key: b.key,
        ctrl: Boolean(b.ctrl),
        shift: Boolean(b.shift),
        action: b.action,
        label: b.label,
        description: b.description,
      })),
    ).toEqual([
      { key: 'KeyK', ctrl: true, shift: false, action: 'search', label: 'Ctrl+K', description: 'Open search overlay' },
      { key: 'KeyS', ctrl: true, shift: false, action: 'save', label: 'Ctrl+S', description: 'Save project' },
      { key: 'KeyC', ctrl: true, shift: false, action: 'copy', label: 'Ctrl+C', description: 'Copy selected objects' },
      { key: 'KeyV', ctrl: true, shift: false, action: 'paste', label: 'Ctrl+V', description: 'Paste from clipboard' },
      { key: 'KeyD', ctrl: true, shift: false, action: 'duplicate', label: 'Ctrl+D', description: 'Duplicate selected objects' },
      { key: 'KeyZ', ctrl: true, shift: false, action: 'undo', label: 'Ctrl+Z', description: 'Undo last action' },
      { key: 'KeyZ', ctrl: true, shift: true, action: 'redo', label: 'Ctrl+Shift+Z', description: 'Redo last undone action' },
      { key: 'KeyY', ctrl: true, shift: false, action: 'redo', label: 'Ctrl+Y', description: 'Redo last undone action' },
      { key: 'KeyA', ctrl: true, shift: false, action: 'select-all', label: 'Ctrl+A', description: 'Select all visible objects' },
      { key: 'Delete', ctrl: false, shift: false, action: 'delete', label: 'Del', description: 'Delete selected objects' },
      { key: 'Backspace', ctrl: false, shift: false, action: 'delete', label: 'Backspace', description: 'Delete selected objects' },
      { key: 'Escape', ctrl: false, shift: false, action: 'escape', label: 'Esc', description: 'Clear selection and cancel drag' },
      { key: 'ArrowUp', ctrl: false, shift: false, action: 'nudge-up', label: 'Up', description: 'Nudge selected up (Shift for 5x)' },
      { key: 'ArrowDown', ctrl: false, shift: false, action: 'nudge-down', label: 'Down', description: 'Nudge selected down (Shift for 5x)' },
      { key: 'ArrowLeft', ctrl: false, shift: false, action: 'nudge-left', label: 'Left', description: 'Nudge selected left (Shift for 5x)' },
      { key: 'ArrowRight', ctrl: false, shift: false, action: 'nudge-right', label: 'Right', description: 'Nudge selected right (Shift for 5x)' },
      { key: 'Enter', ctrl: false, shift: false, action: 'open-details', label: 'Enter', description: 'Open details for selected object' },
      { key: 'KeyP', ctrl: false, shift: false, action: 'apply-preset', label: 'P', description: 'Apply preset to selected district or zone' },
      { key: 'KeyP', ctrl: false, shift: true, action: 'save-preset', label: 'Shift+P', description: 'Save current selection as preset' },
      { key: 'KeyV', ctrl: false, shift: false, action: 'tool-select', label: 'V', description: 'Switch to Select tool' },
      { key: 'KeyZ', ctrl: false, shift: false, action: 'tool-zone', label: 'Z', description: 'Switch to Zone tool' },
      { key: 'KeyC', ctrl: false, shift: false, action: 'tool-connection', label: 'C', description: 'Switch to Connection tool' },
      { key: 'KeyE', ctrl: false, shift: false, action: 'tool-entity', label: 'E', description: 'Switch to Entity tool' },
      { key: 'KeyL', ctrl: false, shift: false, action: 'tool-landmark', label: 'L', description: 'Switch to Landmark tool' },
      { key: 'KeyS', ctrl: false, shift: false, action: 'tool-spawn', label: 'S', description: 'Switch to Spawn tool' },
      { key: 'KeyT', ctrl: false, shift: false, action: 'tool-tile', label: 'T', description: 'Switch to Tile Paint tool' },
      { key: 'KeyO', ctrl: false, shift: false, action: 'tool-prop', label: 'O', description: 'Switch to Prop Place tool' },
      { key: 'KeyN', ctrl: false, shift: false, action: 'tool-encounter', label: 'N', description: 'Switch to Encounter Place tool' },
      { key: 'KeyI', ctrl: false, shift: false, action: 'tool-item', label: 'I', description: 'Switch to Item Place tool' },
    ]);

    expect(TOOL_PALETTE_TOOLS).toEqual([
      { id: 'select', label: 'Select', key: 'V', icon: '◇' },
      { id: 'zone-paint', label: 'Zone', key: 'Z', icon: '▦' },
      { id: 'connection', label: 'Connect', key: 'C', icon: '↔' },
      { id: 'entity-place', label: 'Entity', key: 'E', icon: '◉' },
      { id: 'landmark', label: 'Landmark', key: 'L', icon: '▲' },
      { id: 'spawn', label: 'Spawn', key: 'S', icon: '★' },
      { id: 'tile-paint', label: 'Tiles', key: 'T', icon: '▣' },
      { id: 'prop-place', label: 'Prop', key: 'O', icon: '▢' },
      { id: 'encounter-place', label: 'Encounter', key: 'N', icon: '⚔' },
      { id: 'item-place', label: 'Item', key: 'I', icon: '✦' },
    ]);

    expect(
      SPEED_PANEL_ACTIONS.map((a) => ({
        id: a.id,
        label: a.label,
        icon: a.icon,
        category: a.category,
        macroSafe: a.macroSafe,
      })),
    ).toEqual([
      { id: 'new-zone', label: 'New Zone', icon: '+', category: 'global', macroSafe: false },
      { id: 'fit-content', label: 'Fit to Content', icon: '◱', category: 'global', macroSafe: true },
      { id: 'edit-props', label: 'Edit Properties', icon: '✎', category: 'context', macroSafe: true },
      { id: 'delete', label: 'Delete', icon: '✕', category: 'context', macroSafe: true },
      { id: 'duplicate', label: 'Duplicate', icon: '⧉', category: 'context', macroSafe: true },
      { id: 'assign-district', label: 'Assign District', icon: '▦', category: 'context', macroSafe: true },
      { id: 'place-entity', label: 'Place Entity Here', icon: '◉', category: 'context', macroSafe: false },
      { id: 'place-encounter', label: 'Place Encounter Here', icon: '◇', category: 'context', macroSafe: false },
      { id: 'connect-from', label: 'Connect From Here', icon: '→', category: 'context', macroSafe: false },
      { id: 'swap-direction', label: 'Swap Direction', icon: '⇄', category: 'context', macroSafe: true },
      { id: 'add-secret-conn', label: 'Draw Secret Connection', icon: '✦', category: 'context', macroSafe: false },
      { id: 'add-channel-conn', label: 'Draw Channel Connection', icon: '≈', category: 'context', macroSafe: false },
      { id: 'add-warp-conn', label: 'Draw Warp Connection', icon: '⧁', category: 'context', macroSafe: false },
      { id: 'add-trail-conn', label: 'Draw Trail Connection', icon: '↘', category: 'context', macroSafe: false },
      { id: 'merge-zones', label: 'Merge Zones', icon: '⋈', category: 'context', macroSafe: true },
      { id: 'set-elevation', label: 'Set Elevation', icon: '▲', category: 'context', macroSafe: false },
      { id: 'open-review', label: 'Open Review', icon: '☑', category: 'global', macroSafe: true },
      { id: 'export-summary', label: 'Export Summary', icon: '▤', category: 'global', macroSafe: true },
    ]);
  });
});
