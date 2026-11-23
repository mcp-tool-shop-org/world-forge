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

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { COMMAND_REGISTRY, getCommandById } from '../command-registry.js';
import { buildSpeedPanelView, buildUnsearchedSpeedPanel } from '../speed-panel-layout.js';
import {
  SP_HEADING_IDS,
  buildNavigableEntries,
  buildPinRowHandlers,
  catalogueGroupHeadingId,
  clampActiveIndex,
  commandGlyph,
  computeEdgeClampedOffset,
  customGroupHeadingId,
  dispatchSpeedPanelKeyAction,
  executeSpeedPanelMacro,
  executeSpeedPanelRow,
  isNonSearchTextInput,
  resolvePinDropSourceIndex,
  resolveSpeedPanelKeyAction,
  splitHighlightSegments,
} from '../speed-panel-ui.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import { buildExecuteStores } from '../speed-panel-execute.js';
import { productionHotkeyContext } from '../panels/speed-panel-stores.js';
import { useEditorStore, emptySelection } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

function resetStores() {
  storage.clear();
  useProjectStore.getState().loadProject(structuredClone(minimalProject));
  useEditorStore.getState().clearSelection();
  useEditorStore.getState().closeSpeedPanel();
  if (useEditorStore.getState().speedPanelEditMode) {
    useEditorStore.getState().toggleSpeedPanelEditMode();
  }
  useSpeedPanelPins.setState({
    pinnedIds: [],
    recentIds: [],
    frecency: {},
    adaptiveHistory: {},
    groups: [],
    macros: [],
    showRecents: true,
  });
}

describe('Speed Panel C3 UI helpers, ARIA band semantics, and key guards (changed)', () => {
  beforeEach(resetStores);

  it('changed: buildNavigableEntries, clamping, glyph lookup, highlight split, and drop helpers cover all branches', () => {
    const macros = [{ id: 'm1', name: 'Inspect Macro', steps: [{ actionId: 'duplicate' }] }];
    const groups = [{ id: 'g1', name: 'Zone Tools', actionIds: ['set-elevation'] }];
    const ctx = { hit: { type: 'zone' as const, id: 'zone-entrance' }, selection: emptySelection() };

    const unsearched = buildSpeedPanelView(COMMAND_REGISTRY, ctx, '', {
      pinnedIds: ['edit-props', 'duplicate'],
      macros,
      groups,
      recentIds: ['fit-content'],
      mode: 'dungeon',
      showRecents: true,
    });
    const openEntries = buildNavigableEntries(unsearched, new Set());
    expect(openEntries.some((e) => e.domId.includes('wf-sp-opt-cg-g1-0-set-elevation'))).toBe(true);
    const collapsedEntries = buildNavigableEntries(unsearched, new Set(['g1']));
    expect(collapsedEntries.some((e) => e.domId.includes('wf-sp-opt-cg-'))).toBe(false);

    const searched = buildSpeedPanelView(COMMAND_REGISTRY, ctx, 'dup', { macros });
    const searchEntries = buildNavigableEntries(searched, new Set());
    expect(searchEntries.some((e) => e.domId.startsWith('wf-sp-opt-hit-'))).toBe(true);

    const searchedUnavail = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: null, selection: emptySelection() },
      'swap',
      { macros: [{ id: 'm-swap', name: 'Swap Quick', steps: [] }] },
    );
    const unavailEntries = buildNavigableEntries(searchedUnavail, new Set());
    expect(unavailEntries.some((e) => e.domId.startsWith('wf-sp-opt-unavail-'))).toBe(true);

    const searchedMacro = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: null, selection: emptySelection() },
      'Quick',
      { macros: [{ id: 'm-q', name: 'Quick Macro', steps: [] }] },
    );
    const macroEntries = buildNavigableEntries(searchedMacro, new Set());
    expect(macroEntries.map((e) => e.domId)).toEqual(['wf-sp-opt-macro-m-q']);

    expect(clampActiveIndex(3, 0)).toBe(0);
    expect(clampActiveIndex(5, 3)).toBe(0);
    expect(clampActiveIndex(1, 3)).toBe(1);

    expect(computeEdgeClampedOffset({ x: 700, y: 500 }, 260, 420, 800, 600)).toEqual({ left: 536, top: 176 });
    expect(computeEdgeClampedOffset({ x: -10, y: -5 }, 260, 420, 800, 600)).toEqual({ left: 4, top: 4 });
    expect(computeEdgeClampedOffset({ x: 100, y: 120 }, 260, 420, 800, 600)).toEqual({ left: 100, top: 120 });

    expect(commandGlyph(getCommandById('new-zone')!)).toBe('+');
    expect(commandGlyph(getCommandById('add-warp-conn')!)).toBeTruthy();
    expect(commandGlyph({ ...getCommandById('new-zone')!, id: 'unknown-cmd', icon: undefined, toolIcon: '\u25C7' })).toBe('\u25C7');
    expect(commandGlyph({ ...getCommandById('new-zone')!, id: 'unknown-cmd-2', icon: undefined, toolIcon: undefined })).toBe('\u25CB');

    expect(splitHighlightSegments('Draw Secret Connection')).toEqual([{ str: 'Draw Secret Connection', matched: false }]);
    expect(splitHighlightSegments('Draw Secret', [[5, 11]])).toEqual([
      { str: 'Draw ', matched: false },
      { str: 'Secret', matched: true },
    ]);
    expect(splitHighlightSegments('Secret Zone', [[0, 6]])).toEqual([
      { str: 'Secret', matched: true },
      { str: ' Zone', matched: false },
    ]);

    expect(resolvePinDropSourceIndex(1, undefined, 0)).toBe(1);
    expect(resolvePinDropSourceIndex(null, '2', 0)).toBe(2);
    expect(resolvePinDropSourceIndex(1, undefined, 1)).toBeNull();
    expect(resolvePinDropSourceIndex(null, '', 1)).toBeNull();
  });

  it('changed: Alt+1..5 and Alt+Arrow keys execute from panel search box but stay dead inside secondary text inputs', () => {
    const view = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: { type: 'zone', id: 'zone-entrance' }, selection: emptySelection() },
      '',
      {
        pinnedIds: ['edit-props', 'duplicate'],
        macros: [{ id: 'm1', name: 'Test Macro', steps: [] }],
      },
    );
    const nav = buildNavigableEntries(view, new Set());
    const searchEl = { tagName: 'INPUT', getAttribute: (n: string) => (n === 'data-testid' ? 'wf-speed-panel-search' : null) };
    const groupInputEl = { tagName: 'INPUT', getAttribute: () => null };
    const textareaEl = { tagName: 'TEXTAREA' };
    const selectEl = { tagName: 'SELECT' };
    const ceEl = { tagName: 'DIV', isContentEditable: true };
    const buttonEl = { tagName: 'BUTTON' };

    expect(isNonSearchTextInput(null)).toBe(false);
    expect(isNonSearchTextInput(searchEl)).toBe(false);
    expect(isNonSearchTextInput({ tagName: 'INPUT', dataset: { testid: 'wf-speed-panel-search' } })).toBe(false);
    expect(isNonSearchTextInput(groupInputEl)).toBe(true);
    expect(isNonSearchTextInput(textareaEl)).toBe(true);
    expect(isNonSearchTextInput(selectEl)).toBe(true);
    expect(isNonSearchTextInput(ceEl)).toBe(true);

    // Alt+1 inside group/macro input, textarea, select, or contentEditable -> ignored
    for (const target of [groupInputEl, textareaEl, selectEl, ceEl]) {
      expect(
        resolveSpeedPanelKeyAction(
          { key: '1', code: 'Digit1', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, target },
          view,
          nav,
          0,
        ),
      ).toEqual({ type: 'none' });
    }

    // Alt+1 from search input -> executes Band 1 slot 1
    const quick = resolveSpeedPanelKeyAction(
      { key: '1', code: 'Digit1', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
      view,
      nav,
      0,
    );
    expect(quick.type).toBe('exec-row');
    if (quick.type === 'exec-row') expect(quick.row.command.id).toBe('edit-props');

    // Alt+1 by key fallback when code is non-Digit
    const quickByKey = resolveSpeedPanelKeyAction(
      { key: '2', code: '', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
      view,
      nav,
      0,
    );
    expect(quickByKey.type).toBe('exec-row');
    if (quickByKey.type === 'exec-row') expect(quickByKey.row.command.id).toBe('connect-from');

    // Alt+Ctrl+1 is ignored
    expect(
      resolveSpeedPanelKeyAction(
        { key: '1', code: 'Digit1', altKey: true, ctrlKey: true, metaKey: false, shiftKey: false, target: searchEl },
        view,
        nav,
        0,
      ),
    ).toEqual({ type: 'none' });

    // Escape closes regardless of focus
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'Escape', code: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: groupInputEl },
        view,
        nav,
        0,
      ),
    ).toEqual({ type: 'close' });

    // Band 2 starts right after 5 Band 1 items (index 5 = edit-props pin, index 6 = duplicate pin)
    const moveDown = resolveSpeedPanelKeyAction(
      { key: 'ArrowDown', code: 'ArrowDown', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
      view,
      nav,
      5,
    );
    expect(moveDown).toEqual({ type: 'reorder-pin', fromPinIndex: 0, toPinIndex: 1, nextActiveIdx: 6 });

    const moveUp = resolveSpeedPanelKeyAction(
      { key: 'ArrowUp', code: 'ArrowUp', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
      view,
      nav,
      6,
    );
    expect(moveUp).toEqual({ type: 'reorder-pin', fromPinIndex: 1, toPinIndex: 0, nextActiveIdx: 5 });

    // Top pin cannot move further up; still consumes key
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'ArrowUp', code: 'ArrowUp', altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
        view,
        nav,
        5,
      ),
    ).toEqual({ type: 'consumed' });

    // ArrowDown / ArrowUp navigation and Enter on row vs macro vs button
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'ArrowDown', code: 'ArrowDown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
        view,
        nav,
        0,
      ),
    ).toEqual({ type: 'set-active', nextActiveIdx: 1 });
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'ArrowUp', code: 'ArrowUp', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
        view,
        nav,
        2,
      ),
    ).toEqual({ type: 'set-active', nextActiveIdx: 1 });
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'ArrowDown', code: 'ArrowDown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
        view,
        [],
        0,
      ),
    ).toEqual({ type: 'set-active', nextActiveIdx: 0 });
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'ArrowUp', code: 'ArrowUp', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
        view,
        [],
        0,
      ),
    ).toEqual({ type: 'set-active', nextActiveIdx: 0 });

    const enterMacro = resolveSpeedPanelKeyAction(
      { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
      view,
      nav,
      7,
    );
    expect(enterMacro.type).toBe('exec-macro');
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: searchEl },
        view,
        nav,
        0,
      ).type,
    ).toBe('exec-row');
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: buttonEl },
        view,
        nav,
        0,
      ),
    ).toEqual({ type: 'none' });
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: groupInputEl },
        view,
        nav,
        0,
      ),
    ).toEqual({ type: 'none' });
  });

  it('changed: executeSpeedPanelRow and executeSpeedPanelMacro handle success, blocked reason, error throw, and abort', () => {
    const view = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: null, selection: emptySelection() },
    );
    const stores = buildExecuteStores();
    const hctx = productionHotkeyContext();
    const closeSpeedPanel = vi.fn();
    const recordCommandUsage = vi.fn();
    const pushToast = vi.fn();

    // Blocked row returns 'blocked' and toasts warning
    const blockedRow = {
      ...view.band1Deck[0],
      disabledReason: 'Not allowed right now',
    };
    expect(
      executeSpeedPanelRow(blockedRow, {
        context: null,
        query: 'x',
        executeCommand: vi.fn(),
        stores,
        hotkeyCtx: hctx,
        closeSpeedPanel,
        recordCommandUsage,
        pushToast,
      }),
    ).toBe('blocked');
    expect(pushToast).toHaveBeenCalledTimes(1);
    expect(closeSpeedPanel).not.toHaveBeenCalled();

    // Throwing executeCommand catches cleanly and toasts error
    expect(
      executeSpeedPanelRow(view.band1Deck[0], {
        context: null,
        query: 'fit',
        executeCommand: () => { throw new Error('boom'); },
        stores,
        hotkeyCtx: hctx,
        closeSpeedPanel,
        recordCommandUsage,
        pushToast,
      }),
    ).toBe('error');
    expect(pushToast).toHaveBeenCalledWith(expect.stringContaining('boom'), 'error');

    // Successful row execution closes and records query
    expect(
      executeSpeedPanelRow(view.band1Deck[0], {
        context: null,
        query: 'new',
        executeCommand: () => ({ executed: true }),
        stores,
        hotkeyCtx: hctx,
        closeSpeedPanel,
        recordCommandUsage,
        pushToast,
      }),
    ).toBe('closed');
    expect(recordCommandUsage).toHaveBeenCalledWith(view.band1Deck[0].command.id, 'new');
    expect(closeSpeedPanel).toHaveBeenCalledTimes(1);

    // Macro abort sets status, success closes and records macro id
    const setMacroStatus = vi.fn();
    const aborted = executeSpeedPanelMacro(
      { id: 'm1', name: 'Bad Macro', steps: [{ actionId: 'duplicate' }] },
      {
        context: null,
        runMacroSteps: () => ({ completed: 0, total: 1, abortedAt: 0, reason: 'context mismatch', steps: [], totalSteps: 1, completedSteps: 0 }),
        stores,
        setMacroStatus,
        recordCommandUsage,
        closeSpeedPanel,
      },
    );
    expect(aborted).toBe(false);
    expect(setMacroStatus).toHaveBeenCalledWith(expect.stringContaining('aborted at step 1'));

    const ok = executeSpeedPanelMacro(
      { id: 'm1', name: 'Good Macro', steps: [{ actionId: 'fit-content' }] },
      {
        context: null,
        runMacroSteps: () => ({ completed: 1, total: 1, steps: [{ action: 'fit-content', success: true }], totalSteps: 1, completedSteps: 1 }),
        stores,
        setMacroStatus,
        recordCommandUsage,
        closeSpeedPanel,
      },
    );
    expect(ok).toBe(true);
    expect(recordCommandUsage).toHaveBeenCalledWith('macro:m1', '');
  });

  it('changed: SpeedPanel renders ARIA group/labelledby/presentation semantics, adaptiveHistory Tier 0, and all searched/macro states', () => {
    // Closed renders empty string
    expect(renderToStaticMarkup(createElement(SpeedPanel))).toBe('');

    useEditorStore.getState().openSpeedPanel(80, 90, { type: 'zone', id: 'zone-entrance' });
    useSpeedPanelPins.setState({
      pinnedIds: ['edit-props', 'delete'],
      recentIds: ['assign-district'],
      frecency: { 'assign-district': { score: 2, lastUsedAt: Date.now(), count: 1 } },
      adaptiveHistory: { place: { commandId: 'place-encounter', score: 5, lastUsedAt: Date.now() } },
      groups: [
        { id: 'g-open', name: 'Open Group', actionIds: ['set-elevation'] },
        { id: 'g-closed', name: 'Closed Group', actionIds: ['assign-district'] },
      ],
      macros: [{ id: 'm1', name: 'Zone Macro', steps: [{ actionId: 'duplicate' }] }],
      showRecents: true,
    });

    // Unsearched non-edit mode with collapsed group
    const normalHtml = renderToStaticMarkup(
      createElement(SpeedPanel, { initialCollapsedGroups: ['g-closed'] }),
    );
    expect(normalHtml).toContain(`data-testid="wf-sp-band-1" role="group" aria-labelledby="${SP_HEADING_IDS.band1}"`);
    expect(normalHtml).toContain(`id="${SP_HEADING_IDS.band1}" role="presentation"`);
    expect(normalHtml).toContain(`data-testid="wf-sp-band-2" role="group" aria-labelledby="${SP_HEADING_IDS.band2}"`);
    expect(normalHtml).toContain(`id="${SP_HEADING_IDS.band2}" role="presentation"`);
    expect(normalHtml).toContain(`data-testid="wf-sp-band-3" role="group" aria-labelledby="${SP_HEADING_IDS.band3}"`);
    expect(normalHtml).toContain('data-testid="wf-sp-band-4" role="presentation"');
    expect(normalHtml).toContain(`role="group" aria-labelledby="${customGroupHeadingId('g-open')}"`);
    expect(normalHtml).toContain(`id="${customGroupHeadingId('g-open')}" role="presentation"`);
    expect(normalHtml).toContain(`data-testid="wf-sp-cat-Author" role="group" aria-labelledby="${catalogueGroupHeadingId('Author')}"`);

    // Unsearched edit mode with expanded macro steps and status banner
    useEditorStore.getState().toggleSpeedPanelEditMode();
    const editHtml = renderToStaticMarkup(
      createElement(SpeedPanel, {
        initialExpandedMacro: 'm1',
        initialMacroStatus: 'Macro test alert',
      }),
    );
    expect(editHtml).toContain('+ Add step...');
    expect(editHtml).toContain('Macro test alert');
    expect(editHtml).toContain('+ New Macro');
    expect(editHtml).toContain('+ New Group');
    useEditorStore.getState().toggleSpeedPanelEditMode();

    // Searched state: adaptiveHistory Tier 0 promotes `place-encounter` ahead of shorter `place-entity` for `place`
    const adaptiveHtml = renderToStaticMarkup(createElement(SpeedPanel, { initialQuery: 'place' }));
    const encounterPos = adaptiveHtml.indexOf('data-testid="wf-sp-row-place-encounter"');
    const entityPos = adaptiveHtml.indexOf('data-testid="wf-sp-row-place-entity"');
    expect(encounterPos).toBeGreaterThan(-1);
    expect(encounterPos).toBeLessThan(entityPos);

    // Searched state: macro + unavailable group with ARIA semantics
    const macroSearchHtml = renderToStaticMarkup(createElement(SpeedPanel, { initialQuery: 'Zone Macro' }));
    expect(macroSearchHtml).toContain(`role="group" aria-labelledby="${SP_HEADING_IDS.searchMacros}"`);
    expect(macroSearchHtml).toContain(`id="${SP_HEADING_IDS.searchMacros}" role="presentation"`);

    const unavailHtml = renderToStaticMarkup(createElement(SpeedPanel, { initialQuery: 'swap' }));
    expect(unavailHtml).toContain(`data-testid="wf-sp-unavailable-group" role="group" aria-labelledby="${SP_HEADING_IDS.unavailable}"`);
    expect(unavailHtml).toContain(`id="${SP_HEADING_IDS.unavailable}" role="presentation"`);

    // Empty search state wrapped in role="presentation"
    const emptySearchHtml = renderToStaticMarkup(createElement(SpeedPanel, { initialQuery: 'zzzz-no-match' }));
    expect(emptySearchHtml).toContain('role="presentation"');
    expect(emptySearchHtml).toContain('No actions');
  });

  it('changed: dispatchSpeedPanelKeyAction and buildPinRowHandlers execute all callback paths cleanly', () => {
    const view = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: { type: 'zone', id: 'zone-entrance' }, selection: emptySelection() },
      {
        pinnedIds: ['edit-props', 'duplicate'],
        macros: [{ id: 'm1', name: 'Test Macro', steps: [] }],
      },
    );
    const nav = buildNavigableEntries(view, new Set());
    const searchEl = { tagName: 'INPUT', getAttribute: (n: string) => (n === 'data-testid' ? 'wf-speed-panel-search' : null) };
    const mkEvt = (key: string, extra: Partial<{ code: string; altKey: boolean; ctrlKey: boolean }> = {}) => ({
      key,
      code: extra.code ?? key,
      altKey: extra.altKey ?? false,
      ctrlKey: extra.ctrlKey ?? false,
      metaKey: false,
      shiftKey: false,
      target: searchEl,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });

    const closeSpeedPanel = vi.fn();
    const reorderPin = vi.fn();
    const setActiveIdx = vi.fn();
    const execute = vi.fn();
    const runMacro = vi.fn();
    const deps = { view, allNavigable: nav, activeIdx: 0, closeSpeedPanel, reorderPin, setActiveIdx, execute, runMacro };

    expect(dispatchSpeedPanelKeyAction(mkEvt('Escape'), deps)).toBe('close');
    expect(closeSpeedPanel).toHaveBeenCalledTimes(1);

    expect(dispatchSpeedPanelKeyAction(mkEvt('ArrowDown'), deps)).toBe('set-active');
    expect(setActiveIdx).toHaveBeenCalledWith(1);

    expect(dispatchSpeedPanelKeyAction(mkEvt('ArrowDown', { altKey: true }), { ...deps, activeIdx: 5 })).toBe('reorder-pin');
    expect(reorderPin).toHaveBeenCalledWith(0, 1);

    expect(dispatchSpeedPanelKeyAction(mkEvt('ArrowUp', { altKey: true }), { ...deps, activeIdx: 5 })).toBe('consumed');

    expect(dispatchSpeedPanelKeyAction(mkEvt('Enter'), deps)).toBe('exec-row');
    expect(execute).toHaveBeenCalledTimes(1);

    expect(dispatchSpeedPanelKeyAction(mkEvt('Enter'), { ...deps, activeIdx: 7 })).toBe('exec-macro');
    expect(runMacro).toHaveBeenCalledTimes(1);

    expect(dispatchSpeedPanelKeyAction(mkEvt('KeyX', { code: 'KeyX' }), deps)).toBe('none');

    // Pin row drag/drop and move up/down handlers
    const setDragPinIndex = vi.fn();
    const reorderPin2 = vi.fn();
    const handlers = buildPinRowHandlers({
      storeIdx: 1,
      prevStoreIdx: 0,
      nextStoreIdx: 2,
      dragPinIndex: 0,
      setDragPinIndex,
      reorderPin: reorderPin2,
    });
    const transferSet = vi.fn();
    handlers.onDragStart?.({ preventDefault: vi.fn(), dataTransfer: { setData: transferSet } });
    expect(setDragPinIndex).toHaveBeenCalledWith(1);
    expect(transferSet).toHaveBeenCalledWith('text/plain', '1');
    const dragOverEvt = { preventDefault: vi.fn() };
    handlers.onDragOver?.(dragOverEvt);
    expect(dragOverEvt.preventDefault).toHaveBeenCalled();
    handlers.onDrop?.({ preventDefault: vi.fn(), dataTransfer: { getData: () => '0' } });
    expect(reorderPin2).toHaveBeenCalledWith(0, 1);
    handlers.onDragEnd();
    handlers.onMoveUp?.();
    handlers.onMoveDown?.();
    expect(reorderPin2).toHaveBeenCalledWith(1, 0);
    expect(reorderPin2).toHaveBeenCalledWith(1, 2);

    const undefHandlers = buildPinRowHandlers({
      storeIdx: undefined,
      prevStoreIdx: undefined,
      nextStoreIdx: undefined,
      dragPinIndex: null,
      setDragPinIndex,
      reorderPin: reorderPin2,
    });
    expect(undefHandlers.onDragStart).toBeUndefined();
    expect(undefHandlers.onDrop).toBeUndefined();
  });
});
