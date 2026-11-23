import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

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

import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, emptySelection, type SpeedPanelPickSession } from '../store/editor-store.js';
import { DEFAULT_SPEED_PANEL_OPTIONS, useSpeedPanelOptions } from '../store/speed-panel-options-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';
import {
  buildCanvasRightPointerHandlersFromRefs,
  createCanvasRightPointerHandlers,
  createInitialRightClickGestureState,
  type CanvasContextMenuState,
  type RightClickGestureState,
} from '../speed-panel-gesture.js';
import {
  computePickPreviewLine,
  createCanvasSpatialPickHandlers,
  dispatchPickOverlayInputKeyDown,
  drawPickPreviewLine,
  type StepStackState,
} from '../speed-panel-steps.js';
import {
  createSpeedPanelCallbacks,
  dispatchSpeedPanelKeyAction,
  dispatchStepKeyAction,
  executeSpeedPanelRowOrStep,
  filterStepOptions,
  handleScalarPillKeyDown,
  handleStepChoiceSelect,
  handleStepInputSubmit,
  resolveStepKeyAction,
  stepBackOrRoot,
  submitScalarPill,
} from '../speed-panel-ui.js';
import { COMMAND_REGISTRY, getCommandById } from '../command-registry.js';
import { buildSpeedPanelView } from '../speed-panel-layout.js';
import { executeRegistryCommand } from '../speed-panel-execute.js';
import { productionExecuteStores, productionHotkeyContext, productionStepStores } from '../panels/speed-panel-stores.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import { CanvasSpatialPickOverlay } from '../Canvas.js';
import {
  OptionsModal,
  applyKeyCaptureEvent,
  commitThresholdDraft,
  createOptionsModalHandlers,
  createThresholdFieldHandlers,
  handleThresholdFieldKeyDown,
  resetOptionsModalState,
} from '../panels/OptionsModal.js';

function makeMultiZoneProject() {
  const proj = structuredClone(minimalProject);
  if (proj.zones.length < 2) {
    proj.zones.push({
      id: 'zone-cellar',
      name: 'Cellar',
      description: 'Cold stone.',
      tags: ['cellar'],
      gridX: 22,
      gridY: 12,
      gridWidth: 8,
      gridHeight: 6,
      neighbors: [],
      exits: [],
      light: 2,
      noise: 1,
      hazards: [],
      interactables: [],
    });
  }
  return proj;
}

function resetStores() {
  storage.clear();
  useProjectStore.getState().loadProject(makeMultiZoneProject());
  useEditorStore.getState().clearSelection();
  useEditorStore.getState().closeSpeedPanel();
  useEditorStore.getState().clearSpeedPanelPick();
  useEditorStore.getState().setLastPanelAction(null);
  useEditorStore.getState().setTool('select');
  useSpeedPanelOptions.getState().resetOptions();
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

describe('Speed Panel C4 real handler coverage across Canvas gesture/pick, OptionsModal, and SpeedPanel UI (changed)', () => {
  beforeEach(resetStores);

  it('changed: createCanvasRightPointerHandlers drives single click menu, right-drag pan, double right-click upgrade, and key triggers', () => {
    let gesture: RightClickGestureState = createInitialRightClickGestureState();
    let contextMenu: CanvasContextMenuState | null = null;
    let panStart: { x: number; y: number; panX: number; panY: number } | null = null;
    let lastMoveEvt: unknown = null;
    let suppressLeft = false;
    let suppressCtx = false;
    let ctxHandledInPress = false;
    let pointerOverCanvas = false;
    let lastRegion: 'none' | 'canvas' | 'other' = 'none';
    let lastPointer = { sx: 50, sy: 60 };
    let lastPointerStamp = 0;
    let lastCanvasFocusStamp = 0;
    let canvasFocusedNow = false;
    let nowMs = 1000;
    const setViewport = vi.fn();
    const openSpeedPanel = vi.fn();
    let isMac = false;

    const handlers = createCanvasRightPointerHandlers({
      isMacPlatform: () => isMac,
      getScreenXY: (e) => ({ sx: e.clientX, sy: e.clientY }),
      getViewport: () => ({ panX: 10, panY: 20, zoom: 2 }),
      setViewport,
      getOptions: () => DEFAULT_SPEED_PANEL_OPTIONS,
      findFilteredHitAt: (sx) => (sx > 200 ? { type: 'zone', id: 'zone-entrance' } : null),
      getMenuActionsForHit: () => [{ id: 'new-zone', label: 'New Zone', icon: '+' }],
      getContextMenu: () => contextMenu,
      setContextMenu: (m) => { contextMenu = m; },
      openSpeedPanel,
      getGestureState: () => gesture,
      setGestureState: (s) => { gesture = s; },
      getRightPanStart: () => panStart,
      setRightPanStart: (p) => { panStart = p; },
      getLastRightMoveEvent: () => lastMoveEvt,
      setLastRightMoveEvent: (evt) => { lastMoveEvt = evt; },
      setSuppressNextLeftMouseUp: (v) => { suppressLeft = v; },
      setSuppressNextCanvasContextMenu: (v) => { suppressCtx = v; },
      getContextMenuHandledInPress: () => ctxHandledInPress,
      setContextMenuHandledInPress: (v) => { ctxHandledInPress = v; },
      setLastPointer: (pt) => { lastPointer = pt; },
      getLastPointer: () => lastPointer,
      setPointerOverCanvas: (v) => { pointerOverCanvas = v; },
      getPointerOverCanvas: () => pointerOverCanvas,
      setLastPointerRegion: (r) => { lastRegion = r; },
      getLastPointerRegion: () => lastRegion,
      setLastPointerStamp: (t) => { lastPointerStamp = t; },
      getLastPointerStamp: () => lastPointerStamp,
      getLastCanvasFocusStamp: () => lastCanvasFocusStamp,
      getCanvasFocusedNow: () => canvasFocusedNow,
      getCanvasSize: () => ({ w: 800, h: 600 }),
      getEditorEnv: () => ({
        activeModal: null,
        showSearch: false,
        showSpeedPanel: false,
        selection: { ...emptySelection(), zones: ['zone-entrance'] },
        selectedConnection: null,
        project: useProjectStore.getState().project,
        tileSize: 32,
      }),
      nowMs: () => nowMs,
      perfNowMs: () => 50,
    });

    // 1) Left-click ignored on Windows; Mac Ctrl+click accepted & arms suppressLeft
    expect(handlers.startRightPointer({ button: 0, clientX: 100, clientY: 100, pointerId: 1, preventDefault: vi.fn() })).toBe(false);
    isMac = true;
    expect(handlers.startRightPointer({ button: 0, ctrlKey: true, clientX: 250, clientY: 120, pointerId: 2, preventDefault: vi.fn() })).toBe(true);
    expect(suppressLeft).toBe(true);

    // Duplicate move event guard + wrong pointerId guard + pan movement clearing compact menu
    isMac = false;
    const moveEvt = { clientX: 251, clientY: 121, pointerId: 99, buttons: 2 };
    expect(handlers.moveRightPointerHandler(moveEvt)).toBe(false);
    expect(handlers.moveRightPointerHandler(moveEvt)).toBe(false); // same ref early return
    contextMenu = { x: 10, y: 10, actions: [], hit: null };
    // Pointer 2 was Mac Ctrl+click (left mouse button = buttons: 1)
    const dragMoveEvt = { clientX: 290, clientY: 150, pointerId: 2, buttons: 1 };
    expect(handlers.moveRightPointerHandler(dragMoveEvt)).toBe(true);
    expect(contextMenu).toBeNull();
    expect(setViewport).toHaveBeenCalled();

    // Cancelled pointer release (buttons === 0 on move) resets panStart
    expect(handlers.moveRightPointerHandler({ clientX: 295, clientY: 155, pointerId: 2, buttons: 0 })).toBe(false);
    expect(panStart).toBeNull();

    // 2) Single right-click opens compact menu, second right-click upgrades in place -> openSpeedPanel
    const pd = { button: 2, clientX: 260, clientY: 140, pointerId: 3, preventDefault: vi.fn() };
    expect(handlers.startRightPointer(pd)).toBe(true);
    expect(handlers.finishRightPointer({ clientX: 260, clientY: 140, pointerId: 3 })).toBe(true);
    expect(suppressCtx).toBe(true);
    expect(contextMenu?.hit).toEqual({ type: 'zone', id: 'zone-entrance' });

    nowMs += 120; // within double-click window
    expect(handlers.startRightPointer({ button: 2, clientX: 262, clientY: 141, pointerId: 4, preventDefault: vi.fn() })).toBe(true);
    ctxHandledInPress = true;
    expect(handlers.finishRightPointer({ clientX: 262, clientY: 141, pointerId: 4 })).toBe(true);
    expect(contextMenu).toBeNull();
    expect(openSpeedPanel).toHaveBeenCalledWith(260, 140, { type: 'zone', id: 'zone-entrance' });

    // Footer click upgradeContextMenuToSpeedPanel when open vs null
    handlers.upgradeContextMenuToSpeedPanel(); // no-op on null
    contextMenu = { x: 30, y: 40, actions: [], hit: null };
    handlers.upgradeContextMenuToSpeedPanel();
    expect(openSpeedPanel).toHaveBeenLastCalledWith(30, 40, null);

    // Unmatched pointerUp ignored
    expect(handlers.finishRightPointer({ clientX: 0, clientY: 0, pointerId: 999 })).toBe(false);

    // 3) Key trigger: pointer over canvas vs canvas focus fallback vs suppressed
    openSpeedPanel.mockClear();
    pointerOverCanvas = true;
    lastPointer = { sx: 250, sy: 100 };
    expect(handlers.handleSpeedPanelKeyTrigger({
      key: 'q', code: 'KeyQ', ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    })).toBe(true);
    expect(openSpeedPanel).toHaveBeenCalledWith(250, 100, { type: 'zone', id: 'zone-entrance' });

    pointerOverCanvas = false;
    canvasFocusedNow = true;
    lastRegion = 'other';
    lastPointerStamp = 10;
    lastCanvasFocusStamp = 20;
    expect(handlers.handleSpeedPanelKeyTrigger({
      key: 'q', code: 'KeyQ', ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    })).toBe(true);
    expect(openSpeedPanel).toHaveBeenCalledTimes(2);

    // Wrong key suppressed
    expect(handlers.handleSpeedPanelKeyTrigger({
      key: 'x', code: 'KeyX', ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    })).toBe(false);
  });

  it('changed: createCanvasSpatialPickHandlers and computePickPreviewLine cover move, empty-grid toast, Tab cycle, Enter merge, and Esc cancel', () => {
    const toastSpy = vi.fn();
    const zones = useProjectStore.getState().project.zones;
    let pick: SpeedPanelPickSession | null = {
      commandId: 'connect-from',
      mode: 'connect',
      sourceZoneId: zones[0].id,
      pickedZoneIds: [zones[0].id],
      connectionKind: 'passage',
      cursorSX: 0,
      cursorSY: 0,
      hoveredZoneId: null,
      invalidReason: null,
      previousTool: 'select',
    };
    useEditorStore.getState().selectZone(zones[0].id, false);
    useEditorStore.getState().setSpeedPanelPick(pick);

    const pickHandlers = createCanvasSpatialPickHandlers({
      getPick: () => useEditorStore.getState().speedPanelPick,
      getProject: () => useProjectStore.getState().project,
      findZoneIdAtGrid: (gx) => (gx < 10 ? zones[0].id : gx >= 20 ? zones[1].id : null),
      setPick: (p) => useEditorStore.getState().setSpeedPanelPick(p),
      getStores: productionStepStores,
      onErrorToast: toastSpy,
    });

    // At (0,0) preview is null
    expect(computePickPreviewLine(pick, useProjectStore.getState().project, 32, { panX: 0, panY: 0, zoom: 1 })).toBeNull();

    // Pointer move over self zone updates invalidReason; duplicate coordinates return true without churn
    expect(pickHandlers.handlePointerMove(120, 80, 2, 2)).toBe(true);
    expect(pickHandlers.handlePointerMove(120, 80, 2, 2)).toBe(true);
    const movedPick = useEditorStore.getState().speedPanelPick!;
    expect(movedPick.invalidReason).toBe('Pick a different zone to connect');
    const preview = computePickPreviewLine(movedPick, useProjectStore.getState().project, 32, { panX: 0, panY: 0, zoom: 1 });
    expect(preview?.isError).toBe(true);

    // Click empty canvas warns cleanly; Tab cycles kind; Escape cancels restoring selection
    expect(pickHandlers.handleMouseDown(15, 2, false)).toBe(true);
    expect(toastSpy).toHaveBeenCalled();

    const evt = { key: 'Tab', preventDefault: vi.fn(), stopPropagation: vi.fn() };
    expect(pickHandlers.handleKeyDown(evt)).toBe(true);
    expect(useEditorStore.getState().speedPanelPick?.connectionKind).not.toBe('passage');

    expect(pickHandlers.handleKeyDown({ key: 'a', preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(false);
    // Typing in INPUT / TEXTAREA / SELECT / contentEditable must NOT fire pick keys
    expect(pickHandlers.handleKeyDown({
      key: 'Tab',
      target: { tagName: 'INPUT' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })).toBe(false);
    expect(pickHandlers.handleKeyDown({
      key: 'Enter',
      target: { tagName: 'TEXTAREA' },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })).toBe(false);
    expect(pickHandlers.handleKeyDown({
      key: 'Escape',
      target: { isContentEditable: true },
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    })).toBe(false);
    expect(useEditorStore.getState().speedPanelPick).not.toBeNull();
    expect(pickHandlers.handleKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(true);
    expect(useEditorStore.getState().speedPanelPick).toBeNull();
    expect(useEditorStore.getState().selection.zones).toEqual([zones[0].id]);

    // Merge mode Enter commits when >= 2 picked
    useEditorStore.getState().setSpeedPanelPick({
      commandId: 'merge-zones',
      mode: 'merge',
      sourceZoneId: zones[0].id,
      pickedZoneIds: [zones[0].id, zones[1].id],
      cursorSX: 50,
      cursorSY: 50,
      hoveredZoneId: null,
      invalidReason: null,
      previousTool: 'select',
    });
    expect(pickHandlers.handleKeyDown({ key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(true);
    expect(useEditorStore.getState().speedPanelPick).toBeNull();

    // Undo merge so original two zones exist before testing valid connect pick click
    useProjectStore.getState().undo();
    useEditorStore.getState().setSpeedPanelPick({
      ...pick,
      cursorSX: 40,
      cursorSY: 40,
    });
    expect(pickHandlers.handleMouseDown(22, 2, false)).toBe(true);
    expect(useEditorStore.getState().speedPanelPick).toBeNull();
  });

  it('changed: OptionsModal real handlers, resetOptionsModalState, and SSR render with key error work cleanly', () => {
    const setTriggerKey = vi.fn((k: string) =>
      k === 'KeyG' ? ({ ok: true as const, code: 'KeyG' }) : ({ ok: false as const, reason: 'Already used' }),
    );
    expect(applyKeyCaptureEvent({ key: 'Tab', preventDefault: vi.fn(), stopPropagation: vi.fn() }, setTriggerKey)).toEqual({ handled: false });
    expect(applyKeyCaptureEvent({ key: 'Shift', preventDefault: vi.fn(), stopPropagation: vi.fn() }, setTriggerKey)).toEqual({ handled: false });
    expect(applyKeyCaptureEvent({ key: 'k', ctrlKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn() }, setTriggerKey)).toEqual({
      handled: true,
      error: 'Choose a single unmodified key (no Ctrl, Alt, or Meta).',
    });
    expect(applyKeyCaptureEvent({ key: 'g', code: 'KeyG', preventDefault: vi.fn(), stopPropagation: vi.fn() }, setTriggerKey)).toEqual({
      handled: true,
      error: null,
    });
    expect(applyKeyCaptureEvent({ key: 'Dead', code: 'BracketLeft', preventDefault: vi.fn(), stopPropagation: vi.fn() }, setTriggerKey)).toEqual({
      handled: true,
      error: 'Already used',
    });

    const onCommit = vi.fn();
    expect(commitThresholdDraft('', 6, 2, 20, onCommit)).toBe('6');
    expect(commitThresholdDraft('99', 6, 2, 20, onCommit)).toBe('20');
    expect(onCommit).toHaveBeenCalledWith(20);

    const onCommitDraft = vi.fn();
    const onResetDraft = vi.fn();
    handleThresholdFieldKeyDown({ key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() }, '8', 6, onCommitDraft, onResetDraft);
    expect(onCommitDraft).toHaveBeenCalled();
    handleThresholdFieldKeyDown({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() }, '8', 6, onCommitDraft, onResetDraft);
    expect(onResetDraft).toHaveBeenCalledWith('6');

    const resetDeps = {
      resetOptions: vi.fn(),
      setShowRecents: vi.fn(),
      setKeyError: vi.fn(),
      bumpResetToken: vi.fn(),
    };
    resetOptionsModalState(resetDeps);
    expect(resetDeps.resetOptions).toHaveBeenCalled();
    expect(resetDeps.setShowRecents).toHaveBeenCalledWith(true);
    expect(resetDeps.setKeyError).toHaveBeenCalledWith(null);
    expect(resetDeps.bumpResetToken).toHaveBeenCalled();

    let draftVal = '6';
    const commitSpy = vi.fn();
    const fieldHandlers = createThresholdFieldHandlers({
      getDraft: () => draftVal,
      setDraft: (v) => { draftVal = v; },
      storedValue: 6,
      min: 4,
      max: 15,
      onCommit: commitSpy,
    });
    fieldHandlers.onChange({ target: { value: '12' } });
    expect(draftVal).toBe('12');
    fieldHandlers.onKeyDown({ key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(commitSpy).toHaveBeenCalledWith(12);
    fieldHandlers.onChange({ target: { value: '99' } });
    fieldHandlers.commit();
    expect(draftVal).toBe('15');
    expect(commitSpy).toHaveBeenLastCalledWith(15);

    const modalSpies = {
      setKeyTriggerEnabled: vi.fn(),
      setTriggerKey: vi.fn((k: string) =>
        k === 'KeyH' ? ({ ok: true as const, code: 'KeyH' }) : ({ ok: false as const, reason: 'In use' }),
      ),
      setDoubleRightClickEnabled: vi.fn(),
      setShowRecents: vi.fn(),
      resetOptions: vi.fn(),
      setKeyError: vi.fn(),
      bumpResetToken: vi.fn(),
    };
    const modalHandlers = createOptionsModalHandlers(modalSpies);
    modalHandlers.handleKeyCapture({ key: 'h', code: 'KeyH', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(modalSpies.setKeyError).toHaveBeenLastCalledWith(null);
    modalHandlers.handleKeyCapture({ key: 'Tab', code: 'Tab', preventDefault: vi.fn(), stopPropagation: vi.fn() });
    modalHandlers.onToggleKeyTrigger({ target: { checked: false } });
    modalHandlers.onToggleDoubleRightClick({ target: { checked: false } });
    modalHandlers.onToggleShowRecents({ target: { checked: false } });
    modalHandlers.onReset();
    expect(modalSpies.setKeyTriggerEnabled).toHaveBeenCalledWith(false);
    expect(modalSpies.setDoubleRightClickEnabled).toHaveBeenCalledWith(false);
    expect(modalSpies.setShowRecents).toHaveBeenCalledWith(false);
    expect(modalSpies.resetOptions).toHaveBeenCalled();
    expect(modalSpies.bumpResetToken).toHaveBeenCalled();

    const optHtml = renderToStaticMarkup(createElement(OptionsModal, { onClose: () => {}, initialKeyError: 'Reserved' }));
    expect(optHtml).toContain('wf-opt-trigger-key-error');
    expect(optHtml).toContain('Reserved');
  });

  it('changed: SpeedPanel step dispatchers, scalar pill helpers, Repeat row SSR, and CanvasSpatialPickOverlay SSR cover all UI paths', () => {
    const zoneId = useProjectStore.getState().project.zones[0].id;
    const flow: StepStackState = {
      commandId: 'place-encounter',
      commandLabel: 'Place Encounter Here',
      context: { type: 'zone', id: zoneId },
      targetZoneIds: [zoneId],
      steps: [
        {
          kind: 'choice',
          stepId: 'pick-encounter-type',
          title: 'Place Encounter',
          placeholder: 'Filter encounter types...',
          options: [
            { id: 'patrol', label: 'patrol', description: 'Native', kind: 'option', badge: { text: 'Native AI RPG', tone: 'native' } },
            { id: 'boss', label: 'boss', description: 'Mapped', kind: 'option', badge: { text: 'Maps → duel', tone: 'mapped' } },
            { id: 'hazard', label: 'hazard', description: 'Dropped', kind: 'option', badge: { text: 'Dropped', tone: 'dropped' } },
            { id: 'trap', label: 'trap', description: 'Blocked', kind: 'option', badge: { text: 'Blocked', tone: 'blocked' } },
          ],
        },
      ],
      error: 'Test error',
    };

    expect(filterStepOptions(flow.steps[0].kind === 'choice' ? flow.steps[0].options : [], 'duel')).toHaveLength(1);

    const onCancel = vi.fn();
    const onBack = vi.fn();
    const onSetActiveIdx = vi.fn();
    const onSelectOption = vi.fn();
    const onSubmitInput = vi.fn();
    const filtered = flow.steps[0].kind === 'choice' ? flow.steps[0].options : [];
    const mkEvt = (key: string, altKey = false) => ({
      key, code: key, altKey, ctrlKey: false, metaKey: false, shiftKey: false,
      target: null, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    expect(dispatchStepKeyAction(mkEvt('ArrowDown'), { flow, filteredOptions: filtered, activeStepIdx: 0, stepFilter: '', onCancel, onBack, onSetActiveIdx, onSelectOption, onSubmitInput })).toBe('set-active');
    expect(dispatchStepKeyAction(mkEvt('ArrowUp'), { flow, filteredOptions: filtered, activeStepIdx: 0, stepFilter: '', onCancel, onBack, onSetActiveIdx, onSelectOption, onSubmitInput })).toBe('set-active');
    expect(dispatchStepKeyAction(mkEvt('Backspace'), { flow, filteredOptions: filtered, activeStepIdx: 0, stepFilter: '', onCancel, onBack, onSetActiveIdx, onSelectOption, onSubmitInput })).toBe('back');
    expect(dispatchStepKeyAction(mkEvt('ArrowLeft', true), { flow, filteredOptions: filtered, activeStepIdx: 0, stepFilter: 'ab', onCancel, onBack, onSetActiveIdx, onSelectOption, onSubmitInput })).toBe('back');
    expect(dispatchStepKeyAction(mkEvt('Enter'), { flow, filteredOptions: filtered, activeStepIdx: 0, stepFilter: '', onCancel, onBack, onSetActiveIdx, onSelectOption, onSubmitInput })).toBe('choose');
    expect(dispatchStepKeyAction(mkEvt('Escape'), { flow, filteredOptions: filtered, activeStepIdx: 0, stepFilter: '', onCancel, onBack, onSetActiveIdx, onSelectOption, onSubmitInput })).toBe('cancel');

    const inputFlow: StepStackState = {
      ...flow,
      steps: [{ kind: 'input', stepId: 'create-district', title: 'New', label: 'Name', placeholder: '', value: '' }],
    };
    expect(resolveStepKeyAction(mkEvt('Enter'), inputFlow, [], 0, '')).toEqual({ type: 'submit-input' });

    // Inline scalar pill helpers
    const pill = { commandId: 'set-elevation' as const, targetZoneIds: [zoneId], value: '-4', error: null };
    const setScalarPill = vi.fn();
    const closeSpeedPanel = vi.fn();
    const refocusSearch = vi.fn();
    expect(handleScalarPillKeyDown(mkEvt('Escape'), pill, {
      query: 'ele',
      stepStores: productionStepStores(),
      setScalarPill,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel,
      refocusSearch,
    })).toBe('dismiss');
    expect(refocusSearch).toHaveBeenCalled();

    expect(submitScalarPill(pill, {
      query: 'ele',
      stepStores: productionStepStores(),
      setScalarPill,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel,
    })).toBe(true);
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(-4);

    // Tab key triggers openScalarPill from dispatchSpeedPanelKeyAction
    const openScalarPill = vi.fn();
    const setElevCmd = getCommandById('set-elevation')!;
    const navView = buildSpeedPanelView(COMMAND_REGISTRY, { hit: { type: 'zone', id: zoneId }, selection: emptySelection() }, 'set ele');
    expect(dispatchSpeedPanelKeyAction(mkEvt('Tab'), {
      view: navView,
      allNavigable: [{ kind: 'row', domId: 'wf-sp-opt-hit-0-set-elevation', row: { command: setElevCmd, badge: null, disabledReason: null } }],
      activeIdx: 0,
      closeSpeedPanel: vi.fn(),
      reorderPin: vi.fn(),
      setActiveIdx: vi.fn(),
      execute: vi.fn(),
      runMacro: vi.fn(),
      openScalarPill,
    })).toBe('open-scalar-pill');
    expect(openScalarPill).toHaveBeenCalledWith('set-elevation', 'wf-sp-opt-hit-0-set-elevation');

    // Step UI handlers
    const setStepFlow = vi.fn();
    stepBackOrRoot(flow, { setStepFlow, setStepFilter: vi.fn(), setStepActiveIdx: vi.fn() });
    expect(setStepFlow).toHaveBeenCalledWith(null);

    expect(handleStepChoiceSelect(flow, filtered[0], {
      query: 'enc',
      stepStores: productionStepStores(),
      setStepFlow,
      setStepFilter: vi.fn(),
      setStepActiveIdx: vi.fn(),
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(true);

    expect(handleStepInputSubmit(inputFlow, 'Brand New Ward', {
      query: 'dist',
      stepStores: productionStepStores(),
      setStepFlow,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(true);

    // executeSpeedPanelRowOrStep handles repeat-last when null + step open
    const pushToast = vi.fn();
    expect(executeSpeedPanelRowOrStep(
      { command: { ...setElevCmd, id: 'repeat-last' }, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: zoneId },
        query: '',
        lastPanelAction: null,
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('blocked');

    // SSR renders for SpeedPanel (step choice + export badges + error, input step, scalar pill, repeat row)
    useEditorStore.getState().setLastPanelAction({
      commandId: 'set-elevation',
      label: 'Set Elevation: -4m',
      timestamp: Date.now(),
      params: { kind: 'set-elevation', elevation: -4 },
    });
    useEditorStore.getState().openSpeedPanel(80, 90, { type: 'zone', id: zoneId });
    const rootWithRepeatHtml = renderToStaticMarkup(createElement(SpeedPanel));
    expect(rootWithRepeatHtml).toContain('wf-sp-repeat-last');

    const stepChoiceHtml = renderToStaticMarkup(createElement(SpeedPanel, { initialStepFlow: flow }));
    expect(stepChoiceHtml).toContain('wf-sp-step-view');
    expect(stepChoiceHtml).toContain('wf-sp-export-badge');
    expect(stepChoiceHtml).toContain('wf-sp-step-error');

    const stepInputHtml = renderToStaticMarkup(createElement(SpeedPanel, { initialStepFlow: inputFlow }));
    expect(stepInputHtml).toContain('wf-sp-step-input');

    const scalarHtml = renderToStaticMarkup(createElement(SpeedPanel, {
      initialQuery: 'set ele',
      initialScalarPill: { ...pill, error: 'Bad number' },
    }));
    expect(scalarHtml).toContain('wf-sp-scalar-pill');
    expect(scalarHtml).toContain('wf-sp-scalar-error');

    // CanvasSpatialPickOverlay SSR in both connect & merge modes
    const overlayHtml = renderToStaticMarkup(createElement(CanvasSpatialPickOverlay, {
      pick: {
        commandId: 'connect-from',
        mode: 'connect',
        sourceZoneId: zoneId,
        pickedZoneIds: [zoneId],
        connectionKind: 'secret',
        cursorSX: 150,
        cursorSY: 160,
        hoveredZoneId: zoneId,
        invalidReason: 'Pick a different zone to connect',
        previousTool: 'select',
      },
      project: useProjectStore.getState().project,
      initialQuery: 'cellar',
      onCycleKind: () => {},
      onConfirmMerge: () => {},
      onPickZone: () => {},
      onCancel: () => {},
    }));
    expect(overlayHtml).toContain('wf-sp-pick-bar');
    expect(overlayHtml).toContain('wf-sp-cursor-badge');
    expect(overlayHtml).toContain('wf-sp-pick-kind-cycle');
    expect(overlayHtml).toContain('wf-sp-pick-results');

    // Merge mode + empty query + zero-match overlay SSR variants
    const mergeOverlayHtml = renderToStaticMarkup(createElement(CanvasSpatialPickOverlay, {
      pick: {
        commandId: 'merge-zones',
        mode: 'merge',
        sourceZoneId: zoneId,
        pickedZoneIds: [zoneId, useProjectStore.getState().project.zones[1].id],
        cursorSX: 80,
        cursorSY: 80,
        hoveredZoneId: null,
        invalidReason: null,
        previousTool: 'select',
      },
      project: useProjectStore.getState().project,
      initialQuery: 'nonexistent-zz',
      onCycleKind: () => {},
      onConfirmMerge: () => {},
      onPickZone: () => {},
      onCancel: () => {},
    }));
    expect(mergeOverlayHtml).toContain('wf-sp-pick-merge-confirm');
    expect(mergeOverlayHtml).toContain('No matching zones');

    // drawPickPreviewLine and dispatchPickOverlayInputKeyDown
    const ctxOps: string[] = [];
    const fakeCtx = {
      strokeStyle: '',
      lineWidth: 1,
      setLineDash: () => ctxOps.push('dash'),
      beginPath: () => ctxOps.push('begin'),
      moveTo: () => ctxOps.push('move'),
      lineTo: () => ctxOps.push('line'),
      stroke: () => ctxOps.push('stroke'),
    };
    drawPickPreviewLine(fakeCtx, { x1: 0, y1: 0, x2: 10, y2: 10, isError: false }, 1, { valid: '#0ff', error: '#f00' });
    drawPickPreviewLine(fakeCtx, { x1: 0, y1: 0, x2: 10, y2: 10, isError: true }, 1, { valid: '#0ff', error: '#f00' });
    expect(fakeCtx.strokeStyle).toBe('#f00');
    expect(ctxOps.length).toBe(12);

    const onOverlayCancel = vi.fn();
    const onOverlayCycle = vi.fn();
    const onOverlayPick = vi.fn();
    const onClearQ = vi.fn();
    expect(dispatchPickOverlayInputKeyDown(
      { key: 'Tab', shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() },
      { pickMode: 'connect', candidates: [], onCancel: onOverlayCancel, onCycleKind: onOverlayCycle, onPickZone: onOverlayPick, clearQuery: onClearQ },
    )).toBe('cycle');
    expect(dispatchPickOverlayInputKeyDown(
      { key: 'Enter', shiftKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn() },
      { pickMode: 'merge', candidates: [{ id: 'z1', disabledReason: 'dup' }, { id: 'z2', disabledReason: null }], onCancel: onOverlayCancel, onCycleKind: onOverlayCycle, onPickZone: onOverlayPick, clearQuery: onClearQ },
    )).toBe('pick');
    expect(onOverlayPick).toHaveBeenCalledWith('z2', true);
    expect(dispatchPickOverlayInputKeyDown(
      { key: 'Escape', shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() },
      { pickMode: 'merge', candidates: [], onCancel: onOverlayCancel, onCycleKind: onOverlayCycle, onPickZone: onOverlayPick, clearQuery: onClearQ },
    )).toBe('cancel');
    expect(dispatchPickOverlayInputKeyDown(
      { key: 'a', shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() },
      { pickMode: 'merge', candidates: [], onCancel: onOverlayCancel, onCycleKind: onOverlayCycle, onPickZone: onOverlayPick, clearQuery: onClearQ },
    )).toBe('none');

    // buildCanvasRightPointerHandlersFromRefs wraps mutable ref bags cleanly
    const refBag = {
      canvasEl: () => ({ clientWidth: 800, clientHeight: 600 }),
      rightClickGesture: { current: createInitialRightClickGestureState() },
      rightPanStart: { current: null },
      lastRightMoveEvent: { current: null },
      suppressNextLeftMouseUp: { current: false },
      suppressNextCanvasContextMenu: { current: false },
      contextMenuHandledInPress: { current: false },
      lastPointer: { current: { sx: 20, sy: 20 } },
      pointerOverCanvas: { current: true },
      lastPointerRegion: { current: 'canvas' as const },
      lastPointerStamp: { current: 10 },
      lastCanvasFocusStamp: { current: 5 },
      contextMenu: { current: null as CanvasContextMenuState | null },
      setContextMenu: (m: CanvasContextMenuState | null) => { refBag.contextMenu.current = m; },
      getViewport: () => ({ panX: 0, panY: 0, zoom: 1 }),
      setViewport: vi.fn(),
      getOptions: () => DEFAULT_SPEED_PANEL_OPTIONS,
      getScreenXY: (e: { clientX: number; clientY: number }) => ({ sx: e.clientX, sy: e.clientY }),
      findFilteredHitAt: () => null,
      getMenuActionsForHit: () => [{ id: 'new-zone', label: 'New Zone', icon: '+' }],
      openSpeedPanel: vi.fn(),
      getEditorEnv: () => ({
        activeModal: null,
        showSearch: false,
        showSpeedPanel: false,
        selection: emptySelection(),
        selectedConnection: null,
        project: useProjectStore.getState().project,
        tileSize: 32,
      }),
      isMacPlatformFn: () => false,
    };
    const wrapped = buildCanvasRightPointerHandlersFromRefs(refBag);
    expect(wrapped.startRightPointer({ button: 2, clientX: 50, clientY: 50, pointerId: 11, preventDefault: vi.fn() })).toBe(true);
    expect(wrapped.moveRightPointerHandler({ clientX: 51, clientY: 51, pointerId: 11, buttons: 2 })).toBe(true);
    expect(wrapped.finishRightPointer({ clientX: 51, clientY: 51, pointerId: 11 })).toBe(true);
    expect(refBag.contextMenu.current).not.toBeNull();
    wrapped.upgradeContextMenuToSpeedPanel();
    expect(refBag.openSpeedPanel).toHaveBeenCalled();

    // createSpeedPanelCallbacks + invalid scalar pill / step input / repeat-last branches
    const badScalarPill = { ...pill, value: 'bad-num', error: null };
    expect(handleScalarPillKeyDown(mkEvt('Enter'), badScalarPill, {
      query: 'ele',
      stepStores: productionStepStores(),
      setScalarPill,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel,
      refocusSearch,
    })).toBe('submit');
    expect(handleScalarPillKeyDown(mkEvt('x'), badScalarPill, {
      query: 'ele',
      stepStores: productionStepStores(),
      setScalarPill,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel,
      refocusSearch,
    })).toBe('none');
    expect(resolveStepKeyAction(mkEvt('Backspace'), flow, filtered, 0, 'non-empty')).toEqual({ type: 'none' });
    expect(handleStepInputSubmit(inputFlow, '   ', {
      query: '',
      stepStores: productionStepStores(),
      setStepFlow,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(false);

    // Non-done push branch inside handleStepChoiceSelect (Assign District -> + Create District)
    const assignFlow: StepStackState = {
      commandId: 'assign-district',
      commandLabel: 'Assign District',
      context: { type: 'zone', id: zoneId },
      targetZoneIds: [zoneId],
      steps: [
        {
          kind: 'choice',
          stepId: 'pick-district',
          title: 'Assign District',
          placeholder: 'Filter...',
          options: [{ id: '__create_district__', label: '+ Create District', kind: 'create' }],
        },
      ],
      error: null,
    };
    expect(handleStepChoiceSelect(assignFlow, assignFlow.steps[0].kind === 'choice' ? assignFlow.steps[0].options[0] : { id: 'x', label: 'x', kind: 'option' }, {
      query: '',
      stepStores: productionStepStores(),
      setStepFlow,
      setStepFilter: vi.fn(),
      setStepActiveIdx: vi.fn(),
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(false);

    // executeSpeedPanelRowOrStep covering steps, pick, blocked, direct, and repeat-last
    expect(executeSpeedPanelRowOrStep(
      { command: getCommandById('assign-district')!, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: zoneId },
        query: '',
        lastPanelAction: null,
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('steps');
    expect(executeSpeedPanelRowOrStep(
      { command: getCommandById('connect-from')!, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: zoneId },
        query: '',
        lastPanelAction: null,
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('pick');
    expect(executeSpeedPanelRowOrStep(
      { command: getCommandById('duplicate')!, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: zoneId },
        query: '',
        lastPanelAction: null,
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('closed');
    expect(executeSpeedPanelRowOrStep(
      { command: getCommandById('duplicate')!, badge: null, disabledReason: 'Select an object' },
      {
        context: null,
        query: '',
        lastPanelAction: null,
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('blocked');
    expect(executeSpeedPanelRowOrStep(
      { command: { ...setElevCmd, id: 'repeat-last' }, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: zoneId },
        query: '',
        lastPanelAction: { commandId: 'connect-from', label: 'Connect', timestamp: 1 },
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('pick');
    expect(executeSpeedPanelRowOrStep(
      { command: { ...setElevCmd, id: 'repeat-last' }, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: zoneId },
        query: '',
        lastPanelAction: { commandId: 'set-elevation', label: 'Elev', timestamp: 1, params: { kind: 'set-elevation', elevation: 8 } },
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('closed');

    // createSpeedPanelCallbacks exercises stepFlow + root callbacks + scalarPropsFor
    const spStepCallbacks = createSpeedPanelCallbacks({
      context: { type: 'zone', id: zoneId },
      selection: emptySelection(),
      zones: useProjectStore.getState().project.zones,
      query: '',
      view: navView,
      allNavigable: [{ kind: 'row', domId: 'wf-sp-opt-hit-0-set-elevation', row: { command: setElevCmd, badge: null, disabledReason: null } }],
      activeIdx: 0,
      lastPanelAction: null,
      stepFlow: flow,
      filteredStepOptions: filtered,
      stepActiveIdx: 0,
      stepFilter: '',
      stepInputDraft: 'Test Ward',
      scalarPill: pill,
      scalarPillRef: { current: null },
      executeCommand: executeRegistryCommand,
      runMacroSteps: () => ({ completed: 1, total: 1, steps: [], totalSteps: 1, completedSteps: 1 }),
      stores: productionExecuteStores(),
      stepStores: productionStepStores(),
      hotkeyCtx: productionHotkeyContext(),
      closeSpeedPanel: vi.fn(),
      setActiveIdx: vi.fn(),
      reorderPin: vi.fn(),
      setStepFlow: vi.fn(),
      setStepFilter: vi.fn(),
      setStepActiveIdx: vi.fn(),
      setScalarPill,
      setMacroStatus: vi.fn(),
      recordCommandUsage: vi.fn(),
      pushToast,
      refocusSearch,
    });
    spStepCallbacks.openScalarPill('set-elevation', 'wf-sp-opt-hit-0-set-elevation');
    spStepCallbacks.openScalarPill('other', 'x');
    spStepCallbacks.onSelectStepOption(filtered[0]);
    spStepCallbacks.onStepBack();
    spStepCallbacks.handleKeyDown(mkEvt('ArrowDown'));
    spStepCallbacks.runMacro({ id: 'm1', name: 'M', steps: [{ actionId: 'fit-content' }] });
    const rowScalarProps = spStepCallbacks.scalarPropsFor(
      { command: setElevCmd, badge: null, disabledReason: null },
      'wf-sp-opt-hit-0-set-elevation',
    );
    rowScalarProps.onScalarPillOpen?.();
    rowScalarProps.onScalarPillChange?.('9');
    rowScalarProps.onScalarPillKeyDown?.(mkEvt('Enter'));

    const spRootCallbacks = createSpeedPanelCallbacks({
      context: { type: 'zone', id: zoneId },
      selection: emptySelection(),
      zones: useProjectStore.getState().project.zones,
      query: '',
      view: navView,
      allNavigable: [{ kind: 'row', domId: 'wf-sp-opt-hit-0-set-elevation', row: { command: setElevCmd, badge: null, disabledReason: null } }],
      activeIdx: 0,
      lastPanelAction: null,
      stepFlow: inputFlow,
      filteredStepOptions: [],
      stepActiveIdx: 0,
      stepFilter: '',
      stepInputDraft: 'New Zone Ward',
      scalarPill: null,
      scalarPillRef: { current: null },
      executeCommand: executeRegistryCommand,
      runMacroSteps: () => ({ completed: 1, total: 1, steps: [], totalSteps: 1, completedSteps: 1 }),
      stores: productionExecuteStores(),
      stepStores: productionStepStores(),
      hotkeyCtx: productionHotkeyContext(),
      closeSpeedPanel: vi.fn(),
      setActiveIdx: vi.fn(),
      reorderPin: vi.fn(),
      setStepFlow: vi.fn(),
      setStepFilter: vi.fn(),
      setStepActiveIdx: vi.fn(),
      setScalarPill,
      setMacroStatus: vi.fn(),
      recordCommandUsage: vi.fn(),
      pushToast,
      refocusSearch,
    });
    spRootCallbacks.onSubmitStep();
    spRootCallbacks.scalarPropsFor(
      { command: setElevCmd, badge: null, disabledReason: null },
      'wf-sp-opt-hit-0-set-elevation',
    ).onScalarPillKeyDown?.(mkEvt('Escape'));

    // Cover empty stepFlow / null target / invalid repeat-last / wrapped keyboard trigger
    wrapped.handleSpeedPanelKeyTrigger({
      key: 'q', code: 'KeyQ', ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    expect(refBag.lastPointerStamp.current).toBeGreaterThanOrEqual(0);

    const noZoneCallbacks = createSpeedPanelCallbacks({
      context: null,
      selection: emptySelection(),
      zones: useProjectStore.getState().project.zones,
      query: '',
      view: navView,
      allNavigable: [],
      activeIdx: 0,
      lastPanelAction: null,
      stepFlow: null,
      filteredStepOptions: [],
      stepActiveIdx: 0,
      stepFilter: '',
      stepInputDraft: '',
      scalarPill: null,
      scalarPillRef: { current: null },
      executeCommand: executeRegistryCommand,
      runMacroSteps: () => ({ completed: 1, total: 1, steps: [], totalSteps: 1, completedSteps: 1 }),
      stores: productionExecuteStores(),
      stepStores: productionStepStores(),
      hotkeyCtx: productionHotkeyContext(),
      closeSpeedPanel: vi.fn(),
      setActiveIdx: vi.fn(),
      reorderPin: vi.fn(),
      setStepFlow: vi.fn(),
      setStepFilter: vi.fn(),
      setStepActiveIdx: vi.fn(),
      setScalarPill,
      setMacroStatus: vi.fn(),
      recordCommandUsage: vi.fn(),
      pushToast,
      refocusSearch,
    });
    noZoneCallbacks.openScalarPill('set-elevation', 'x');
    noZoneCallbacks.onSelectStepOption(filtered[0]);
    noZoneCallbacks.onSubmitStep();
    noZoneCallbacks.onStepBack();
    noZoneCallbacks.execute({ command: setElevCmd, badge: null, disabledReason: null });

    expect(executeSpeedPanelRowOrStep(
      { command: { ...setElevCmd, id: 'repeat-last' }, badge: null, disabledReason: null },
      {
        context: null,
        query: '',
        lastPanelAction: { commandId: 'set-elevation', label: 'Elev', timestamp: 1, params: { kind: 'set-elevation', elevation: 8 } },
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('kept-open');

    expect(executeSpeedPanelRowOrStep(
      { command: getCommandById('assign-district')!, badge: null, disabledReason: null },
      {
        context: null,
        query: '',
        lastPanelAction: null,
        executeCommand: executeRegistryCommand,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow,
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast,
      },
    )).toBe('blocked');

    expect(resolveStepKeyAction(mkEvt('a'), flow, filtered, 0, '')).toEqual({ type: 'none' });
    expect(resolveStepKeyAction(mkEvt('a'), inputFlow, [], 0, '')).toEqual({ type: 'none' });
    expect(resolveStepKeyAction(mkEvt('a'), { ...flow, steps: [] }, [], 0, '')).toEqual({ type: 'none' });
    expect(dispatchStepKeyAction(mkEvt('Enter'), {
      flow: inputFlow,
      filteredOptions: [],
      activeStepIdx: 0,
      stepFilter: '',
      onCancel,
      onBack,
      onSetActiveIdx,
      onSelectOption,
      onSubmitInput,
    })).toBe('submit-input');
    expect(dispatchStepKeyAction(mkEvt('x'), {
      flow: inputFlow,
      filteredOptions: [],
      activeStepIdx: 0,
      stepFilter: '',
      onCancel,
      onBack,
      onSetActiveIdx,
      onSelectOption,
      onSubmitInput,
    })).toBe('none');
    expect(submitScalarPill({ ...pill, value: 'not-num' }, {
      query: 'ele',
      stepStores: productionStepStores(),
      setScalarPill,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(false);

    // Trigger canvasEl === activeElement branch inside buildCanvasRightPointerHandlersFromRefs
    const fakeEl = { clientWidth: 640, clientHeight: 480 };
    const bagFocused = { ...refBag, canvasEl: () => fakeEl };
    Object.defineProperty(globalThis, 'document', {
      value: { activeElement: fakeEl },
      configurable: true,
    });
    const wrappedFocused = buildCanvasRightPointerHandlersFromRefs(bagFocused);
    wrappedFocused.handleSpeedPanelKeyTrigger({
      key: 'q', code: 'KeyQ', ctrlKey: false, metaKey: false, altKey: false, isComposing: false, repeat: false,
      preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    delete (globalThis as { document?: unknown }).document;

    // Null scalarPill keydown guard on scalarPropsFor
    spRootCallbacks.scalarPropsFor(
      { command: setElevCmd, badge: null, disabledReason: null },
      'wf-sp-opt-hit-0-set-elevation',
    ).onScalarPillKeyDown?.(mkEvt('Enter'));
    spRootCallbacks.scalarPropsFor(
      { command: getCommandById('duplicate')!, badge: null, disabledReason: null },
      'wf-sp-opt-hit-0-duplicate',
    );
  });
});
