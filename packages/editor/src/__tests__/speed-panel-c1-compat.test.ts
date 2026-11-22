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

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  SPEED_PANEL_ACTIONS,
  filterActions,
  getContextMenuActions,
} from '../speed-panel-actions.js';
import {
  executeAction,
  executeContextMenuAction,
  executeMacro,
  buildExecuteStores,
} from '../speed-panel-execute.js';
import { HOTKEY_BINDINGS, getHotkeyList, dispatchHotkey, type HotkeyContext } from '../hotkeys.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import { useEditorStore, emptySelection } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { App } from '../App.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { HitResult } from '../hit-testing.js';

const storage = new Map<string, string>();
const localStorageMock: Storage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => { storage.clear(); },
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() { return storage.size; },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

function baseHotkeyContext(): HotkeyContext {
  const editor = useEditorStore.getState();
  const project = useProjectStore.getState();
  return {
    selection: editor.selection,
    selectedConnection: editor.selectedConnection,
    project: project.project,
    showEntities: editor.showEntities,
    showLandmarks: editor.showLandmarks,
    showSpawns: editor.showSpawns,
    showTown: editor.showTown,
    activeModal: null,
    showSearch: false,
    clearSelection: editor.clearSelection,
    selectAll: editor.selectAll,
    moveSelected: project.moveSelected,
    removeSelected: project.removeSelected,
    removeConnection: project.removeConnection,
    duplicateSelected: project.duplicateSelected,
    setShowSearch: editor.setShowSearch,
    setRightTab: editor.setRightTab,
    ...('setRightCollapsed' in editor
      ? { setRightCollapsed: (editor as { setRightCollapsed: (c: boolean) => void }).setRightCollapsed }
      : {}),
    setTool: editor.setTool,
    showSpeedPanel: editor.showSpeedPanel,
    closeSpeedPanel: editor.closeSpeedPanel,
  };
}

describe('Speed Panel C1 snapshots and state compatibility (unchanged)', () => {
  beforeEach(() => {
    storage.clear();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
  });

  it('unchanged: Speed Panel sections match base snapshot for zone, entity, connection, and empty canvas', () => {
    const project = structuredClone(minimalProject);
    const hits: Record<'zone' | 'entity' | 'connection' | 'empty', HitResult | null> = {
      zone: { type: 'zone', id: project.zones[0].id },
      entity: { type: 'entity', id: project.entityPlacements[0].entityId },
      connection: { type: 'connection', id: 'zone-entrance::zone-cellar' },
      empty: null,
    };

    const actual = Object.fromEntries(
      Object.entries(hits).map(([key, hit]) => {
        const res = filterActions(SPEED_PANEL_ACTIONS, hit, '', [], [], [], [], 'dungeon');
        return [
          key,
          {
            pinned: res.pinned.map((a) => a.id),
            recents: res.recents.map((a) => a.id),
            groups: res.groups.map((g) => g.group.id),
            macros: res.macros.map((m) => m.id),
            modeSuggested: res.modeSuggested.map((a) => ({ id: a.id, label: a.label, icon: a.icon })),
            contextual: res.contextual.map((a) => ({ id: a.id, label: a.label, icon: a.icon })),
          },
        ];
      }),
    );

    expect(actual).toEqual({
      zone: {
        pinned: [],
        recents: [],
        groups: [],
        macros: [],
        modeSuggested: [{ id: 'add-secret-conn', label: 'Draw Secret Connection', icon: '✦' }],
        contextual: [
          { id: 'edit-props', label: 'Edit Properties', icon: '✎' },
          { id: 'delete', label: 'Delete', icon: '✕' },
          { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
          { id: 'assign-district', label: 'Assign District', icon: '▦' },
          { id: 'place-entity', label: 'Place Entity Here', icon: '◉' },
          { id: 'place-encounter', label: 'Place Encounter Here', icon: '◇' },
          { id: 'connect-from', label: 'Connect From Here', icon: '→' },
          { id: 'add-channel-conn', label: 'Draw Channel Connection', icon: '≈' },
          { id: 'add-warp-conn', label: 'Draw Warp Connection', icon: '⧁' },
          { id: 'add-trail-conn', label: 'Draw Trail Connection', icon: '↘' },
          { id: 'merge-zones', label: 'Merge Zones', icon: '⋈' },
          { id: 'set-elevation', label: 'Set Elevation', icon: '▲' },
        ],
      },
      entity: {
        pinned: [],
        recents: [],
        groups: [],
        macros: [],
        modeSuggested: [],
        contextual: [
          { id: 'edit-props', label: 'Edit Properties', icon: '✎' },
          { id: 'delete', label: 'Delete', icon: '✕' },
          { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
        ],
      },
      connection: {
        pinned: [],
        recents: [],
        groups: [],
        macros: [],
        modeSuggested: [],
        contextual: [
          { id: 'edit-props', label: 'Edit Properties', icon: '✎' },
          { id: 'delete', label: 'Delete', icon: '✕' },
          { id: 'swap-direction', label: 'Swap Direction', icon: '⇄' },
        ],
      },
      empty: {
        pinned: [],
        recents: [],
        groups: [],
        macros: [],
        modeSuggested: [],
        contextual: [
          { id: 'new-zone', label: 'New Zone', icon: '+' },
          { id: 'fit-content', label: 'Fit to Content', icon: '◱' },
          { id: 'open-review', label: 'Open Review', icon: '☑' },
          { id: 'export-summary', label: 'Export Summary', icon: '▤' },
        ],
      },
    });
  });

  it('unchanged: right-click context menu items match base snapshot for zone, entity, connection, and empty canvas', () => {
    const project = structuredClone(minimalProject);
    const hits: Record<'zone' | 'entity' | 'connection' | 'empty', HitResult | null> = {
      zone: { type: 'zone', id: project.zones[0].id },
      entity: { type: 'entity', id: project.entityPlacements[0].entityId },
      connection: { type: 'connection', id: 'zone-entrance::zone-cellar' },
      empty: null,
    };

    const menus = Object.fromEntries(
      Object.entries(hits).map(([key, hit]) => [
        key,
        getContextMenuActions(hit, project).map((a) => ({ id: a.id, label: a.label, icon: a.icon })),
      ]),
    );

    expect(menus).toEqual({
      zone: [
        { id: 'edit-props', label: 'Edit Properties', icon: '✎' },
        { id: 'delete', label: 'Delete', icon: '✕' },
        { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
        { id: 'assign-district', label: 'Assign District', icon: '▦' },
        { id: 'place-entity', label: 'Place Entity Here', icon: '◉' },
        { id: 'place-encounter', label: 'Place Encounter Here', icon: '◇' },
        { id: 'connect-from', label: 'Connect From Here', icon: '→' },
      ],
      entity: [
        { id: 'edit-props', label: 'Edit Properties', icon: '✎' },
        { id: 'delete', label: 'Delete', icon: '✕' },
        { id: 'duplicate', label: 'Duplicate', icon: '⧉' },
      ],
      connection: [
        { id: 'edit-props', label: 'Edit Properties', icon: '✎' },
        { id: 'delete', label: 'Delete', icon: '✕' },
        { id: 'swap-direction', label: 'Swap Direction', icon: '⇄' },
      ],
      empty: [
        { id: 'new-zone', label: 'New Zone', icon: '+' },
        { id: 'fit-content', label: 'Fit to Content', icon: '◱' },
        { id: 'open-review', label: 'Open Review', icon: '☑' },
        { id: 'export-summary', label: 'Export Summary', icon: '▤' },
      ],
    });
  });

  it('unchanged: hotkey table and Tool Palette tools match base snapshots exactly', () => {
    expect(HOTKEY_BINDINGS).toEqual([
      { key: 'KeyK', ctrl: true, action: 'search', label: 'Ctrl+K', description: 'Open search overlay' },
      { key: 'KeyS', ctrl: true, action: 'save', label: 'Ctrl+S', description: 'Save project' },
      { key: 'KeyC', ctrl: true, action: 'copy', label: 'Ctrl+C', description: 'Copy selected objects' },
      { key: 'KeyV', ctrl: true, action: 'paste', label: 'Ctrl+V', description: 'Paste from clipboard' },
      { key: 'KeyD', ctrl: true, action: 'duplicate', label: 'Ctrl+D', description: 'Duplicate selected objects' },
      { key: 'KeyZ', ctrl: true, action: 'undo', label: 'Ctrl+Z', description: 'Undo last action' },
      { key: 'KeyZ', ctrl: true, shift: true, action: 'redo', label: 'Ctrl+Shift+Z', description: 'Redo last undone action' },
      { key: 'KeyY', ctrl: true, action: 'redo', label: 'Ctrl+Y', description: 'Redo last undone action' },
      { key: 'KeyA', ctrl: true, action: 'select-all', label: 'Ctrl+A', description: 'Select all visible objects' },
      { key: 'Delete', action: 'delete', label: 'Del', description: 'Delete selected objects' },
      { key: 'Backspace', action: 'delete', label: 'Backspace', description: 'Delete selected objects' },
      { key: 'Escape', action: 'escape', label: 'Esc', description: 'Clear selection and cancel drag' },
      { key: 'ArrowUp', action: 'nudge-up', label: 'Up', description: 'Nudge selected up (Shift for 5x)' },
      { key: 'ArrowDown', action: 'nudge-down', label: 'Down', description: 'Nudge selected down (Shift for 5x)' },
      { key: 'ArrowLeft', action: 'nudge-left', label: 'Left', description: 'Nudge selected left (Shift for 5x)' },
      { key: 'ArrowRight', action: 'nudge-right', label: 'Right', description: 'Nudge selected right (Shift for 5x)' },
      { key: 'Enter', action: 'open-details', label: 'Enter', description: 'Open details for selected object' },
      { key: 'KeyP', action: 'apply-preset', label: 'P', description: 'Apply preset to selected district or zone' },
      { key: 'KeyP', shift: true, action: 'save-preset', label: 'Shift+P', description: 'Save current selection as preset' },
      { key: 'KeyV', action: 'tool-select', label: 'V', description: 'Switch to Select tool' },
      { key: 'KeyZ', action: 'tool-zone', label: 'Z', description: 'Switch to Zone tool' },
      { key: 'KeyC', action: 'tool-connection', label: 'C', description: 'Switch to Connection tool' },
      { key: 'KeyE', action: 'tool-entity', label: 'E', description: 'Switch to Entity tool' },
      { key: 'KeyL', action: 'tool-landmark', label: 'L', description: 'Switch to Landmark tool' },
      { key: 'KeyS', action: 'tool-spawn', label: 'S', description: 'Switch to Spawn tool' },
      { key: 'KeyT', action: 'tool-tile', label: 'T', description: 'Switch to Tile Paint tool' },
      { key: 'KeyO', action: 'tool-prop', label: 'O', description: 'Switch to Prop Place tool' },
      { key: 'KeyN', action: 'tool-encounter', label: 'N', description: 'Switch to Encounter Place tool' },
      { key: 'KeyI', action: 'tool-item', label: 'I', description: 'Switch to Item Place tool' },
    ]);

    expect(getHotkeyList()).toHaveLength(29);
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
  });
});

describe('Edit Properties / Enter opens properties (Part 3 — changed)', () => {
  beforeEach(() => {
    storage.clear();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().setTool('select');
    useEditorStore.getState().resetChecklist(); // Forces rightTab = 'guide', matching template load
  });

  it('changed: Edit Properties from Speed Panel on an entity opens EntityProperties even while Guide tab is active', () => {
    expect(useEditorStore.getState().rightTab).toBe('guide');
    const res = executeAction('edit-props', { type: 'entity', id: 'npc-keeper' }, buildExecuteStores());
    expect(res.executed).toBe(true);
    expect(useEditorStore.getState().rightTab).toBe('map');

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('data-testid="wf-entity-inspector"');
    expect(html).not.toContain('Select a zone or use a tool to see properties.');
  });

  it('changed: Edit Properties from the right-click context menu on an entity opens EntityProperties while Guide tab is active', () => {
    const project = useProjectStore.getState().project;
    const menuItems = getContextMenuActions({ type: 'entity', id: 'npc-keeper' }, project);
    expect(menuItems[0].id).toBe('edit-props');

    const res = executeContextMenuAction('edit-props', { type: 'entity', id: 'npc-keeper' });
    expect(res.executed).toBe(true);
    expect(useEditorStore.getState().rightTab).toBe('map');

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('data-testid="wf-entity-inspector"');
  });

  it('changed: pressing Enter on a selected entity opens EntityProperties while Guide tab is active', () => {
    useEditorStore.getState().selectEntity('npc-keeper', false);
    expect(useEditorStore.getState().rightTab).toBe('guide');

    const enterEvent = {
      code: 'Enter',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    const result = dispatchHotkey(enterEvent, baseHotkeyContext());
    expect(result).toEqual({ handled: true, action: 'open-details' });
    expect(useEditorStore.getState().rightTab).toBe('map');

    const html = renderToStaticMarkup(createElement(App));
    expect(html).toContain('data-testid="wf-entity-inspector"');
  });

  it('changed: Edit Properties and Enter expand a collapsed right sidebar when Guide tab is showing', () => {
    const editorWithCollapse = useEditorStore.getState() as unknown as {
      rightCollapsed?: boolean;
      setRightCollapsed?: (collapsed: boolean) => void;
    };
    editorWithCollapse.setRightCollapsed?.(true);

    const res = executeAction('edit-props', { type: 'zone', id: 'zone-entrance' }, buildExecuteStores());
    expect(res.executed).toBe(true);
    expect((useEditorStore.getState() as { rightCollapsed?: boolean }).rightCollapsed).toBe(false);
    expect(useEditorStore.getState().rightTab).toBe('map');
    expect(renderToStaticMarkup(createElement(App))).toContain('Zone Properties');

    useEditorStore.getState().resetChecklist();
    useEditorStore.getState().selectEntity('npc-keeper', false);
    editorWithCollapse.setRightCollapsed?.(true);

    const enterEvent = {
      code: 'Enter',
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: { tagName: 'CANVAS' },
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    const hotkeyRes = dispatchHotkey(enterEvent, baseHotkeyContext());
    expect(hotkeyRes).toEqual({ handled: true, action: 'open-details' });
    expect((useEditorStore.getState() as { rightCollapsed?: boolean }).rightCollapsed).toBe(false);
    expect(renderToStaticMarkup(createElement(App))).toContain('data-testid="wf-entity-inspector"');
  });
});

describe('Speed Panel saved localStorage state compatibility (unchanged)', () => {
  it('unchanged: saved Speed Panel localStorage state written by base commit loads and executes cleanly', async () => {
    storage.clear();
    storage.set('world-forge-speed-panel-pins', JSON.stringify(['edit-props', 'duplicate']));
    storage.set('world-forge-speed-panel-recents', JSON.stringify(['assign-district', 'delete']));
    storage.set('world-forge-speed-panel-groups', JSON.stringify([
      { id: 'g-saved', name: 'Inspect & Move', actionIds: ['edit-props', 'assign-district'] },
    ]));
    storage.set('world-forge-speed-panel-macros', JSON.stringify([
      { id: 'm-saved', name: 'Inspect Zone', steps: [{ actionId: 'edit-props' }, { actionId: 'assign-district' }] },
    ]));

    vi.resetModules();
    const { useSpeedPanelPins: reloadedPinsStore } = await import('../store/speed-panel-store.js');
    const state = reloadedPinsStore.getState();

    expect(state.pinnedIds).toEqual(['edit-props', 'duplicate']);
    expect(state.recentIds).toEqual(['assign-district', 'delete']);
    expect(state.groups).toEqual([
      { id: 'g-saved', name: 'Inspect & Move', actionIds: ['edit-props', 'assign-district'] },
    ]);
    expect(state.macros).toEqual([
      { id: 'm-saved', name: 'Inspect Zone', steps: [{ actionId: 'edit-props' }, { actionId: 'assign-district' }] },
    ]);

    const filtered = filterActions(
      SPEED_PANEL_ACTIONS,
      { type: 'zone', id: 'zone-entrance' },
      '',
      state.pinnedIds,
      state.recentIds,
      state.groups,
      state.macros,
    );
    expect(filtered.pinned.map((a) => a.id)).toEqual(['edit-props', 'duplicate']);
    expect(filtered.recents.map((a) => a.id)).toEqual(['assign-district', 'delete']);
    expect(filtered.macros.map((m) => m.id)).toEqual(['m-saved']);

    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    const macroRes = executeMacro(state.macros[0], { type: 'zone', id: 'zone-entrance' }, buildExecuteStores());
    expect(macroRes.completed).toBe(2);
    expect(macroRes.total).toBe(2);
  });
});

void emptySelection;
