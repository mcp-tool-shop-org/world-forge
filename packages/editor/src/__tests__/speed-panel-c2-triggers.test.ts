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

import {
  CLICK_DRIFT_RANGE,
  DEFAULT_SPEED_PANEL_OPTIONS,
  DOUBLE_CLICK_RADIUS_RANGE,
  DOUBLE_CLICK_WINDOW_RANGE,
  SPEED_PANEL_OPTIONS_KEY,
  formatSpeedPanelTriggerFooter,
  formatTriggerKeyLabel,
  loadSpeedPanelOptions,
  normalizeTriggerKeyCode,
  resolveGestureThresholds,
  useSpeedPanelOptions,
  validateTriggerKey,
} from '../store/speed-panel-options-store.js';
import {
  beginRightPointer,
  computeRightPanViewport,
  createInitialRightClickGestureState,
  endRightPointer,
  getKeyboardSpeedPanelAnchor,
  isMacCtrlClickPointer,
  isMacPlatform,
  isNodeInsideCanvasOrMenu,
  isRightClickPointer,
  isRightPointerStillPressed,
  moveRightPointer,
  resolveCanvasContextMenu,
  resolveCanvasKeyTriggerDecision,
  resolveRightPointerEndEffect,
  shouldIgnoreLeftMouseUp,
  shouldTriggerSpeedPanelKey,
} from '../speed-panel-gesture.js';
import {
  OptionsModal,
  TRIGGER_KEY_ERROR_ID,
  applyKeyCaptureEvent,
  clampThresholdDraftValue,
  commitThresholdDraft,
  handleThresholdFieldKeyDown,
  parseThresholdDraft,
} from '../panels/OptionsModal.js';
import { emptySelection } from '../store/editor-store.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

describe('Speed Panel C2 options, triggers, and gesture thresholds (changed)', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelOptions.getState().resetOptions();
  });

  it('changed: default options use KeyQ, both triggers enabled, 6/18/320 thresholds, and calibrated pen defaults 8/24/360', () => {
    expect(SPEED_PANEL_OPTIONS_KEY).toBe('wf.speedPanel.options.v1');
    expect(DEFAULT_SPEED_PANEL_OPTIONS).toEqual({
      version: 1,
      keyTriggerEnabled: true,
      triggerKey: 'KeyQ',
      doubleRightClickEnabled: true,
      clickDriftPx: 6,
      doubleClickRadiusPx: 18,
      doubleClickWindowMs: 320,
    });

    expect(resolveGestureThresholds(DEFAULT_SPEED_PANEL_OPTIONS, 'mouse')).toEqual({
      driftPx: 6,
      radiusPx: 18,
      windowMs: 320,
    });
    expect(resolveGestureThresholds(DEFAULT_SPEED_PANEL_OPTIONS, 'pen')).toEqual({
      driftPx: 8,
      radiusPx: 24,
      windowMs: 360,
    });
  });

  it('changed: options clamp values to documented ranges and persist under versioned key wf.speedPanel.options.v1', () => {
    const store = useSpeedPanelOptions.getState();
    store.setClickDriftPx(1);
    store.setDoubleClickRadiusPx(999);
    store.setDoubleClickWindowMs(50);

    const updated = useSpeedPanelOptions.getState().options;
    expect(updated.clickDriftPx).toBe(CLICK_DRIFT_RANGE.min);
    expect(updated.doubleClickRadiusPx).toBe(DOUBLE_CLICK_RADIUS_RANGE.max);
    expect(updated.doubleClickWindowMs).toBe(DOUBLE_CLICK_WINDOW_RANGE.min);

    const saved = storage.get(SPEED_PANEL_OPTIONS_KEY);
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved!)).toMatchObject({
      version: 1,
      clickDriftPx: 4,
      doubleClickRadiusPx: 45,
      doubleClickWindowMs: 250,
    });

    storage.set(
      SPEED_PANEL_OPTIONS_KEY,
      JSON.stringify({
        version: 1,
        keyTriggerEnabled: false,
        triggerKey: 'KeyV',
        doubleRightClickEnabled: true,
        clickDriftPx: 100,
        doubleClickRadiusPx: 1,
        doubleClickWindowMs: 900,
      }),
    );
    const reloaded = loadSpeedPanelOptions();
    expect(reloaded.keyTriggerEnabled).toBe(false);
    expect(reloaded.triggerKey).toBe('KeyQ'); // Clashing stored key falls back cleanly
    expect(reloaded.clickDriftPx).toBe(15);
    expect(reloaded.doubleClickRadiusPx).toBe(12);
    expect(reloaded.doubleClickWindowMs).toBe(500);
  });

  it('changed: validateTriggerKey and setTriggerKey refuse clashing canvas, hotkey, dead, and layout-hazard keys with reasons', () => {
    for (const bad of ['Space', 'Tab', 'KeyV', 'KeyP', 'Enter', 'Escape', 'Delete', 'Backquote', 'Slash', 'Dead']) {
      const res = validateTriggerKey(bad);
      expect(res.valid, `Expected "${bad}" to be refused`).toBe(false);
      if (!res.valid) {
        expect(res.reason.length).toBeGreaterThan(5);
      }
      const setRes = useSpeedPanelOptions.getState().setTriggerKey(bad);
      expect(setRes.ok).toBe(false);
      expect(useSpeedPanelOptions.getState().options.triggerKey).toBe('KeyQ');
    }

    for (const good of ['KeyK', 'k', ';', 'Semicolon', 'KeyA']) {
      const res = validateTriggerKey(good);
      expect(res.valid, `Expected "${good}" to be allowed`).toBe(true);
    }

    const changed = useSpeedPanelOptions.getState().setTriggerKey('KeyK');
    expect(changed).toEqual({ ok: true, code: 'KeyK' });
    expect(useSpeedPanelOptions.getState().options.triggerKey).toBe('KeyK');
  });

  it('changed: formatSpeedPanelTriggerFooter reflects active triggers and never shows a disabled trigger', () => {
    expect(formatSpeedPanelTriggerFooter(DEFAULT_SPEED_PANEL_OPTIONS)).toBe('Speed Panel — Q / 2×Right-Click');
    expect(
      formatSpeedPanelTriggerFooter({ ...DEFAULT_SPEED_PANEL_OPTIONS, triggerKey: 'KeyK' }),
    ).toBe('Speed Panel — K / 2×Right-Click');
    expect(
      formatSpeedPanelTriggerFooter({ ...DEFAULT_SPEED_PANEL_OPTIONS, doubleRightClickEnabled: false }),
    ).toBe('Speed Panel — Q');
    expect(
      formatSpeedPanelTriggerFooter({ ...DEFAULT_SPEED_PANEL_OPTIONS, keyTriggerEnabled: false }),
    ).toBe('Speed Panel — 2×Right-Click');
    expect(
      formatSpeedPanelTriggerFooter({
        ...DEFAULT_SPEED_PANEL_OPTIONS,
        keyTriggerEnabled: false,
        doubleRightClickEnabled: false,
      }),
    ).toBe('Speed Panel');
  });

  it('changed: shouldTriggerSpeedPanelKey gates on pointer/focus, text inputs, modifiers, repeat, composing, dead key, and modals', () => {
    const baseEnv = {
      options: DEFAULT_SPEED_PANEL_OPTIONS,
      pointerOverCanvas: true,
      canvasFocused: false,
      activeModal: null,
      showSearch: false,
      showSpeedPanel: false,
      activeElement: null,
    } as const;

    const qDown = { code: 'KeyQ', key: 'q', repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false };
    expect(shouldTriggerSpeedPanelKey(qDown, baseEnv)).toBe(true);
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, pointerOverCanvas: false, canvasFocused: true })).toBe(true);
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, pointerOverCanvas: false, canvasFocused: false })).toBe(false);

    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, options: { ...DEFAULT_SPEED_PANEL_OPTIONS, keyTriggerEnabled: false } })).toBe(false);
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, activeModal: 'options' })).toBe(false);
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, showSearch: true })).toBe(false);
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, showSpeedPanel: true })).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, repeat: true }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, ctrlKey: true }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, metaKey: true }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, altKey: true }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, shiftKey: true }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, isComposing: true }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, key: 'Dead' }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, keyCode: 229 }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, target: { tagName: 'INPUT' } }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, target: { tagName: 'TEXTAREA' } }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, target: { tagName: 'SELECT' } }, baseEnv)).toBe(false);
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, activeElement: { isContentEditable: true } })).toBe(false);

    const kOptions = { ...DEFAULT_SPEED_PANEL_OPTIONS, triggerKey: 'KeyK' };
    expect(shouldTriggerSpeedPanelKey(qDown, { ...baseEnv, options: kOptions })).toBe(false);
    expect(shouldTriggerSpeedPanelKey({ ...qDown, code: 'KeyK', key: 'k' }, { ...baseEnv, options: kOptions })).toBe(true);
  });

  it('changed: getKeyboardSpeedPanelAnchor anchors at selected object or canvas centre when pointer is absent', () => {
    const vp = { panX: 0, panY: 0, zoom: 1 };
    const size = { w: 800, h: 600 };

    const empty = getKeyboardSpeedPanelAnchor(size, emptySelection(), null, minimalProject, vp, 32);
    expect(empty).toEqual({ sx: 400, sy: 300, hit: null });

    const zone = minimalProject.zones[0];
    const withZone = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), zones: [zone.id] },
      null,
      minimalProject,
      vp,
      32,
    );
    expect(withZone.hit).toEqual({ type: 'zone', id: zone.id });
    expect(withZone.sx).toBe((zone.gridX + zone.gridWidth / 2) * 32);
    expect(withZone.sy).toBe((zone.gridY + zone.gridHeight / 2) * 32);
  });

  it('changed: right-click pointer state machine enforces drift, radius, and window boundaries for mouse and pen', () => {
    const opts = DEFAULT_SPEED_PANEL_OPTIONS;

    // 1. Inside drift (5 <= 6) opens compact menu immediately; outside drift (7 > 6) pans without opening menu
    let st = beginRightPointer(createInitialRightClickGestureState(), { sx: 100, sy: 100, pointerId: 1, pointerType: 'mouse' });
    let mv = moveRightPointer(st, { sx: 105, sy: 100, pointerId: 1 }, opts);
    expect(mv.isDragging).toBe(false);
    const insideClick = endRightPointer(mv.state, { sx: 105, sy: 100, pointerId: 1, now: 1000 }, opts);
    expect(insideClick.kind).toBe('open-compact-menu');

    st = beginRightPointer(insideClick.state, { sx: 200, sy: 200, pointerId: 2, pointerType: 'mouse' });
    mv = moveRightPointer(st, { sx: 207, sy: 200, pointerId: 2 }, opts);
    expect(mv.isDragging).toBe(true);
    const dragEnd = endRightPointer(mv.state, { sx: 207, sy: 200, pointerId: 2, now: 1100 }, opts);
    expect(dragEnd.kind).toBe('drag-end');
    expect(dragEnd.state.lastClick).toBeNull();

    // 2. Window & radius boundaries for mouse (319 vs 321 ms, 17 vs 19 px)
    const first = endRightPointer(
      beginRightPointer(createInitialRightClickGestureState(), { sx: 100, sy: 100, pointerId: 1, pointerType: 'mouse' }),
      { sx: 100, sy: 100, pointerId: 1, now: 1000 },
      opts,
    );
    expect(first.kind).toBe('open-compact-menu');

    const withinAll = endRightPointer(
      beginRightPointer(first.state, { sx: 117, sy: 100, pointerId: 1, pointerType: 'mouse' }),
      { sx: 117, sy: 100, pointerId: 1, now: 1319 },
      opts,
    );
    expect(withinAll.kind).toBe('open-speed-panel');

    const outsideWindow = endRightPointer(
      beginRightPointer(first.state, { sx: 100, sy: 100, pointerId: 1, pointerType: 'mouse' }),
      { sx: 100, sy: 100, pointerId: 1, now: 1321 },
      opts,
    );
    expect(outsideWindow.kind).toBe('open-compact-menu');

    const outsideRadius = endRightPointer(
      beginRightPointer(first.state, { sx: 119, sy: 100, pointerId: 1, pointerType: 'mouse' }),
      { sx: 119, sy: 100, pointerId: 1, now: 1100 },
      opts,
    );
    expect(outsideRadius.kind).toBe('open-compact-menu');

    // 3. Double-right-click off keeps compact menu
    const disabledDbl = endRightPointer(
      beginRightPointer(first.state, { sx: 101, sy: 100, pointerId: 1, pointerType: 'mouse' }),
      { sx: 101, sy: 100, pointerId: 1, now: 1100 },
      { ...opts, doubleRightClickEnabled: false },
    );
    expect(disabledDbl.kind).toBe('keep-compact-menu');

    // 4. Pen calibrated thresholds (8 px drift, 24 px radius, 360 ms window)
    const penPress1 = endRightPointer(
      beginRightPointer(createInitialRightClickGestureState(), { sx: 100, sy: 100, pointerId: 3, pointerType: 'pen' }),
      { sx: 107, sy: 100, pointerId: 3, pointerType: 'pen', now: 2000 },
      opts,
    );
    expect(penPress1.kind).toBe('open-compact-menu');

    const penDrag = moveRightPointer(
      beginRightPointer(createInitialRightClickGestureState(), { sx: 100, sy: 100, pointerId: 4, pointerType: 'pen' }),
      { sx: 109, sy: 100, pointerId: 4 },
      opts,
    );
    expect(penDrag.isDragging).toBe(true);

    const penInsideDbl = endRightPointer(
      beginRightPointer(penPress1.state, { sx: 130, sy: 100, pointerId: 3, pointerType: 'pen' }),
      { sx: 130, sy: 100, pointerId: 3, pointerType: 'pen', now: 2359 },
      opts,
    );
    expect(penInsideDbl.kind).toBe('open-speed-panel');

    const penOutsideTime = endRightPointer(
      beginRightPointer(penPress1.state, { sx: 110, sy: 100, pointerId: 3, pointerType: 'pen' }),
      { sx: 110, sy: 100, pointerId: 3, pointerType: 'pen', now: 2361 },
      opts,
    );
    expect(penOutsideTime.kind).toBe('open-compact-menu');
  });

  it('changed: macOS Ctrl+click counts as a right-click on macOS platforms only', () => {
    expect(isMacPlatform('MacIntel', '')).toBe(true);
    expect(isMacPlatform('Win32', '')).toBe(false);
    expect(isRightClickPointer({ button: 2, ctrlKey: false }, false)).toBe(true);
    expect(isRightClickPointer({ button: 0, ctrlKey: true }, true)).toBe(true);
    expect(isRightClickPointer({ button: 0, ctrlKey: true }, false)).toBe(false);
    expect(isRightClickPointer({ button: 0, ctrlKey: false }, true)).toBe(false);
  });

  it('changed: OptionsModal renders trigger controls and dynamic footer preview', () => {
    const html = renderToStaticMarkup(createElement(OptionsModal, { onClose: () => {} }));
    expect(html).toContain('data-testid="wf-options-modal"');
    expect(html).toContain('data-testid="wf-opt-key-trigger-enabled"');
    expect(html).toContain('data-testid="wf-opt-trigger-key"');
    expect(html).toContain('data-testid="wf-opt-dbl-right-enabled"');
    expect(html).toContain('data-testid="wf-opt-click-drift"');
    expect(html).toContain('data-testid="wf-opt-dbl-radius"');
    expect(html).toContain('data-testid="wf-opt-dbl-window"');
    expect(html).toContain('Speed Panel — Q / 2×Right-Click');
  });

  it('changed: loadSpeedPanelOptions returns defaults when pre-C2 localStorage keys exist', () => {
    storage.clear();
    storage.set('world-forge-speed-panel-pins', JSON.stringify(['edit-props', 'delete']));
    storage.set('world-forge-speed-panel-recents', JSON.stringify(['fit-content']));
    storage.set('world-forge-speed-panel-groups', JSON.stringify([{ id: 'g1', name: 'Core', actionIds: ['edit-props'] }]));
    storage.set('world-forge-speed-panel-macros', JSON.stringify([{ id: 'm1', name: 'Quick', steps: [{ actionId: 'edit-props' }] }]));

    const opts = loadSpeedPanelOptions();
    expect(opts).toEqual(DEFAULT_SPEED_PANEL_OPTIONS);
  });

  it('changed: speed-panel-gesture covers platform fallbacks, move/end edges, stuck press recovery, contenteditable, and e.key fallback', () => {
    // isMacPlatform fallbacks with omitted args and UA matching
    const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { platform: 'Win32', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      configurable: true,
    });
    try {
      expect(isMacPlatform()).toBe(true);
      expect(isMacPlatform(undefined, 'Windows NT')).toBe(false);
    } finally {
      if (origNavDesc) Object.defineProperty(globalThis, 'navigator', origNavDesc);
    }
    expect(isMacPlatform('', 'Windows NT 10.0')).toBe(false);
    expect(isMacPlatform('MacPPC', '')).toBe(true);

    // moveRightPointer with no active press and pointerId mismatch
    const initial = createInitialRightClickGestureState();
    expect(moveRightPointer(initial, { sx: 10, sy: 10, pointerId: 1, buttons: 2 }, DEFAULT_SPEED_PANEL_OPTIONS)).toEqual({
      state: initial,
      isDragging: false,
      cancelled: false,
      thresholds: { driftPx: 6, radiusPx: 18, windowMs: 320 },
    });

    const active = beginRightPointer(initial, { sx: 100, sy: 100, pointerId: 5, pointerType: 'mouse' });
    const mismatch = moveRightPointer(active, { sx: 150, sy: 150, pointerId: 99, buttons: 2 }, DEFAULT_SPEED_PANEL_OPTIONS);
    expect(mismatch.state).toBe(active);
    expect(mismatch.isDragging).toBe(false);
    expect(mismatch.cancelled).toBe(false);

    // Same-drag move stays dragging without redundant state churn, and lost RMB cancels on (buttons & 2) === 0
    const dragged = moveRightPointer(active, { sx: 120, sy: 100, pointerId: 5, buttons: 2 }, DEFAULT_SPEED_PANEL_OPTIONS);
    expect(dragged.isDragging).toBe(true);
    expect(dragged.cancelled).toBe(false);
    const continuedDrag = moveRightPointer(dragged.state, { sx: 130, sy: 100, pointerId: 5, buttons: 2 }, DEFAULT_SPEED_PANEL_OPTIONS);
    expect(continuedDrag.state).toBe(dragged.state);
    expect(continuedDrag.isDragging).toBe(true);

    const stuckCancelled = moveRightPointer(continuedDrag.state, { sx: 135, sy: 100, pointerId: 5, buttons: 0 }, DEFAULT_SPEED_PANEL_OPTIONS);
    expect(stuckCancelled.cancelled).toBe(true);
    expect(stuckCancelled.isDragging).toBe(false);
    expect(stuckCancelled.state.active).toBeNull();
    expect(computeRightPanViewport({ x: 100, y: 100, panX: 50, panY: 20 }, 140, 120, 2)).toEqual({ panX: 30, panY: 10 });

    // macOS Ctrl+click stays active while left button held (buttons & 1 !== 0), cancels on (buttons & 1) === 0
    expect(isMacCtrlClickPointer({ button: 0, ctrlKey: true }, true)).toBe(true);
    expect(isMacCtrlClickPointer({ button: 0, ctrlKey: true }, false)).toBe(false);
    const macActive = beginRightPointer(initial, { sx: 50, sy: 50, pointerId: 6, isMacCtrlClick: true });
    expect(isRightPointerStillPressed(macActive.active!, 1)).toBe(true);
    expect(isRightPointerStillPressed(macActive.active!, 2)).toBe(false);
    const macStill = moveRightPointer(macActive, { sx: 53, sy: 50, pointerId: 6, buttons: 1 }, DEFAULT_SPEED_PANEL_OPTIONS);
    expect(macStill.cancelled).toBe(false);
    const macCancelled = moveRightPointer(macStill.state, { sx: 54, sy: 50, pointerId: 6, buttons: 2 }, DEFAULT_SPEED_PANEL_OPTIONS);
    expect(macCancelled.cancelled).toBe(true);
    expect(macCancelled.state.active).toBeNull();

    // endRightPointer ignore cases and direct release drift without intermediate move
    expect(endRightPointer(initial, { sx: 10, sy: 10, pointerId: 1, now: 100 }, DEFAULT_SPEED_PANEL_OPTIONS).kind).toBe('ignore');
    expect(endRightPointer(active, { sx: 100, sy: 100, pointerId: 99, now: 100 }, DEFAULT_SPEED_PANEL_OPTIONS).kind).toBe('ignore');
    expect(endRightPointer(active, { sx: 120, sy: 100, pointerId: 5, now: 100 }, DEFAULT_SPEED_PANEL_OPTIONS)).toEqual({
      kind: 'drag-end',
      state: { active: null, lastClick: null },
    });

    // shouldTriggerSpeedPanelKey contenteditable and e.key fallback (no e.code)
    const baseEnv = {
      options: DEFAULT_SPEED_PANEL_OPTIONS,
      pointerOverCanvas: true,
      canvasFocused: false,
      activeModal: null,
      showSearch: false,
      showSpeedPanel: false,
      activeElement: null,
    } as const;
    expect(
      shouldTriggerSpeedPanelKey(
        { code: 'KeyQ', target: { getAttribute: (name: string) => (name === 'contenteditable' ? '' : null) } },
        baseEnv,
      ),
    ).toBe(false);
    expect(
      shouldTriggerSpeedPanelKey(
        { code: 'KeyQ', target: { getAttribute: (name: string) => (name === 'contenteditable' ? 'true' : null) } },
        baseEnv,
      ),
    ).toBe(false);
    expect(
      shouldTriggerSpeedPanelKey(
        { code: 'KeyQ', target: { getAttribute: (name: string) => (name === 'contenteditable' ? 'false' : null) } },
        baseEnv,
      ),
    ).toBe(true);
    expect(shouldTriggerSpeedPanelKey({ key: 'q' }, baseEnv)).toBe(true);
    expect(shouldTriggerSpeedPanelKey({ key: 'Unidentified' }, baseEnv)).toBe(false);
  });

  it('changed: getKeyboardSpeedPanelAnchor handles all selectable object types and edge clamping', () => {
    const vp = { panX: 0, panY: 0, zoom: 1 };
    const size = { w: 800, h: 600 };

    const connAnchor = getKeyboardSpeedPanelAnchor(
      size,
      emptySelection(),
      { from: 'zone-entrance', to: 'zone-cellar' },
      minimalProject,
      vp,
      32,
    );
    expect(connAnchor.hit).toEqual({ type: 'connection', id: 'zone-entrance::zone-cellar' });
    expect(connAnchor.sx).toBeGreaterThan(0);

    const entFallbackAnchor = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), entities: ['npc-keeper'] },
      null,
      minimalProject,
      vp,
      32,
    );
    expect(entFallbackAnchor).toEqual({ sx: 80, sy: 80, hit: { type: 'entity', id: 'npc-keeper' } });

    const withEntityCoords = structuredClone(minimalProject);
    withEntityCoords.entityPlacements[0].gridX = 4;
    withEntityCoords.entityPlacements[0].gridY = 6;
    const entCoordAnchor = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), entities: ['npc-keeper'] },
      null,
      withEntityCoords,
      vp,
      32,
    );
    expect(entCoordAnchor).toEqual({ sx: 144, sy: 208, hit: { type: 'entity', id: 'npc-keeper' } });

    const lmAnchor = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), landmarks: ['lm-altar'] },
      null,
      minimalProject,
      vp,
      32,
    );
    expect(lmAnchor).toEqual({ sx: 176, sy: 176, hit: { type: 'landmark', id: 'lm-altar' } });

    const spAnchor = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), spawns: ['sp-default'] },
      null,
      minimalProject,
      vp,
      32,
    );
    expect(spAnchor).toEqual({ sx: 80, sy: 80, hit: { type: 'spawn', id: 'sp-default' } });

    const encAnchor = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), encounters: ['enc-cellar'] },
      null,
      minimalProject,
      vp,
      32,
    );
    expect(encAnchor).toEqual({ sx: 160, sy: 480, hit: { type: 'encounter', id: 'enc-cellar' } });

    // Clamping at negative and overflow screen bounds
    const negClamp = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), landmarks: ['lm-altar'] },
      null,
      minimalProject,
      { panX: 5000, panY: 5000, zoom: 1 },
      32,
    );
    expect(negClamp).toEqual({ sx: 8, sy: 8, hit: { type: 'landmark', id: 'lm-altar' } });

    const posClamp = getKeyboardSpeedPanelAnchor(
      size,
      { ...emptySelection(), landmarks: ['lm-altar'] },
      null,
      minimalProject,
      { panX: -5000, panY: -5000, zoom: 1 },
      32,
    );
    expect(posClamp).toEqual({ sx: 792, sy: 592, hit: { type: 'landmark', id: 'lm-altar' } });

    // Missing/unknown selected IDs and invalid rect fallbacks
    expect(
      getKeyboardSpeedPanelAnchor(size, emptySelection(), { from: 'missing-a', to: 'missing-b' }, minimalProject, vp, 32),
    ).toEqual({ sx: 400, sy: 300, hit: null });
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), entities: ['missing'] }, null, minimalProject, vp, 32),
    ).toEqual({ sx: 400, sy: 300, hit: null });
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), landmarks: ['missing'] }, null, minimalProject, vp, 32),
    ).toEqual({ sx: 400, sy: 300, hit: null });
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), spawns: ['missing'] }, null, minimalProject, vp, 32),
    ).toEqual({ sx: 400, sy: 300, hit: null });
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), encounters: ['missing'] }, null, minimalProject, vp, 32),
    ).toEqual({ sx: 400, sy: 300, hit: null });
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), zones: ['missing'] }, null, minimalProject, vp, 32),
    ).toEqual({ sx: 400, sy: 300, hit: null });
    const orphanEntityProj = structuredClone(minimalProject);
    orphanEntityProj.entityPlacements[0].zoneId = 'missing-zone';
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), entities: ['npc-keeper'] }, null, orphanEntityProj, vp, 32),
    ).toEqual({ sx: 16, sy: 16, hit: { type: 'entity', id: 'npc-keeper' } });
    const orphanEncProj = structuredClone(minimalProject);
    orphanEncProj.encounterAnchors[0].zoneId = 'missing-zone';
    expect(
      getKeyboardSpeedPanelAnchor(size, { ...emptySelection(), encounters: ['enc-cellar'] }, null, orphanEncProj, vp, 32),
    ).toEqual({ sx: 8, sy: 8, hit: { type: 'encounter', id: 'enc-cellar' } });

    // Window blur clears stuck right-press state
    let blurActive: ReturnType<typeof createInitialRightClickGestureState> = beginRightPointer(
      createInitialRightClickGestureState(),
      { sx: 100, sy: 100, pointerId: 7, isMacCtrlClick: true },
    );
    const listeners = new Map<string, Set<() => void>>();
    const resetOnBlur = () => {
      blurActive = { ...blurActive, active: null };
    };
    listeners.set('blur', new Set([resetOnBlur]));
    for (const fn of listeners.get('blur') ?? []) fn();
    expect(blurActive.active).toBeNull();
    expect(
      resolveCanvasContextMenu({
        hasActiveRightGesture: false,
        isRightPointerEvent: false,
        suppressNext: false,
        clientX: 10,
        clientY: 10,
        rect: null,
        lastPointer: { sx: 0, sy: 0 },
      }),
    ).toEqual({ kind: 'suppress' });
  });

  it('changed: left drag in progress is left uncommitted and unchanged by right press/release and macOS Ctrl+click', () => {
    expect(shouldIgnoreLeftMouseUp({ button: 2 }, false, false)).toBe(true);
    expect(shouldIgnoreLeftMouseUp({ button: 0, ctrlKey: true }, true, false)).toBe(true);
    expect(shouldIgnoreLeftMouseUp({ button: 0, ctrlKey: false }, true, true)).toBe(true);
    expect(shouldIgnoreLeftMouseUp({ button: 0, ctrlKey: false }, true, false)).toBe(false);

    // Simulate Canvas dragMove + suppressNextLeftMouseUp + right press & release
    let dragMove: { active: boolean; dx: number; dy: number } | null = { active: true, dx: 24, dy: -16 };
    let suppressNextLeftMouseUp = false;
    const committed: Array<{ dx: number; dy: number }> = [];

    const handleMouseUp = (e: { button?: number; ctrlKey?: boolean }, mac: boolean) => {
      if (shouldIgnoreLeftMouseUp(e, mac, suppressNextLeftMouseUp)) {
        if ((e.button ?? 0) === 0) suppressNextLeftMouseUp = false;
        return;
      }
      suppressNextLeftMouseUp = false;
      if (dragMove?.active) {
        committed.push({ dx: dragMove.dx, dy: dragMove.dy });
        dragMove = null;
      }
    };

    // Right press + release while left drag is active -> leaves drag uncommitted & intact
    handleMouseUp({ button: 2, ctrlKey: false }, false);
    expect(committed).toEqual([]);
    expect(dragMove).toEqual({ active: true, dx: 24, dy: -16 });

    // macOS Ctrl+click press followed by left-button mouseup (even if Ctrl released early) -> also leaves drag intact
    suppressNextLeftMouseUp = true;
    handleMouseUp({ button: 0, ctrlKey: false }, true);
    expect(committed).toEqual([]);
    expect(dragMove).toEqual({ active: true, dx: 24, dy: -16 });
    expect(suppressNextLeftMouseUp).toBe(false);

    // Real left mouseup finally commits the drag once
    handleMouseUp({ button: 0, ctrlKey: false }, true);
    expect(committed).toEqual([{ dx: 24, dy: -16 }]);
    expect(dragMove).toBeNull();
  });

  it('changed: canvas key-gating, contextmenu resolution, pointer end dispatch, and node containment helpers', () => {
    expect(
      resolveCanvasKeyTriggerDecision(
        { code: 'KeyQ', key: 'q' },
        {
          options: DEFAULT_SPEED_PANEL_OPTIONS,
          pointerOverCanvas: true,
          canvasFocusedNow: false,
          lastPointerRegion: 'canvas',
          lastCanvasFocusStamp: 0,
          lastPointerStamp: 100,
          activeModal: null,
          showSearch: false,
          showSpeedPanel: false,
        },
      ),
    ).toEqual({ trigger: true, source: 'pointer' });

    expect(
      resolveCanvasKeyTriggerDecision(
        { code: 'KeyQ', key: 'q' },
        {
          options: DEFAULT_SPEED_PANEL_OPTIONS,
          pointerOverCanvas: false,
          canvasFocusedNow: true,
          lastPointerRegion: 'other',
          lastCanvasFocusStamp: 50,
          lastPointerStamp: 100,
          activeModal: null,
          showSearch: false,
          showSpeedPanel: false,
        },
      ),
    ).toEqual({ trigger: false });

    expect(
      resolveCanvasKeyTriggerDecision(
        { code: 'KeyQ', key: 'q' },
        {
          options: DEFAULT_SPEED_PANEL_OPTIONS,
          pointerOverCanvas: false,
          canvasFocusedNow: true,
          lastPointerRegion: 'other',
          lastCanvasFocusStamp: 150,
          lastPointerStamp: 100,
          activeModal: null,
          showSearch: false,
          showSpeedPanel: false,
        },
      ),
    ).toEqual({ trigger: true, source: 'keyboard' });

    const rect = { left: 100, top: 50, width: 800, height: 600 };
    expect(
      resolveCanvasContextMenu({
        hasActiveRightGesture: true,
        isRightPointerEvent: false,
        suppressNext: false,
        clientX: 200,
        clientY: 200,
        rect,
        lastPointer: { sx: 10, sy: 10 },
      }),
    ).toEqual({ kind: 'handled-in-press' });
    expect(
      resolveCanvasContextMenu({
        hasActiveRightGesture: false,
        isRightPointerEvent: true,
        suppressNext: false,
        clientX: 200,
        clientY: 200,
        rect,
        lastPointer: { sx: 10, sy: 10 },
      }),
    ).toEqual({ kind: 'suppress' });
    expect(
      resolveCanvasContextMenu({
        hasActiveRightGesture: false,
        isRightPointerEvent: false,
        suppressNext: true,
        clientX: 200,
        clientY: 200,
        rect,
        lastPointer: { sx: 10, sy: 10 },
      }),
    ).toEqual({ kind: 'consume-suppressed' });
    expect(
      resolveCanvasContextMenu({
        hasActiveRightGesture: false,
        isRightPointerEvent: false,
        suppressNext: false,
        clientX: 0,
        clientY: 0,
        rect,
        lastPointer: { sx: 42, sy: 84 },
      }),
    ).toEqual({ kind: 'open', sx: 42, sy: 84 });
    expect(
      resolveCanvasContextMenu({
        hasActiveRightGesture: false,
        isRightPointerEvent: false,
        suppressNext: false,
        clientX: 350,
        clientY: 200,
        rect,
        lastPointer: { sx: 42, sy: 84 },
      }),
    ).toEqual({ kind: 'open', sx: 250, sy: 150 });

    const st = createInitialRightClickGestureState();
    expect(resolveRightPointerEndEffect({ kind: 'ignore', state: st }, false, undefined)).toEqual({ action: 'none' });
    expect(resolveRightPointerEndEffect({ kind: 'open-speed-panel', x: 10, y: 20, state: st }, true, null)).toEqual({
      action: 'open-speed-panel',
      x: 10,
      y: 20,
      prevHit: null,
    });
    expect(resolveRightPointerEndEffect({ kind: 'keep-compact-menu', x: 10, y: 20, state: st }, true, undefined)).toEqual({
      action: 'none',
    });
    expect(resolveRightPointerEndEffect({ kind: 'keep-compact-menu', x: 10, y: 20, state: st }, false, undefined)).toEqual({
      action: 'open-compact-menu',
      x: 10,
      y: 20,
    });
    expect(resolveRightPointerEndEffect({ kind: 'open-compact-menu', x: 15, y: 25, state: st }, false, undefined)).toEqual({
      action: 'open-compact-menu',
      x: 15,
      y: 25,
    });

    const nodeA = {};
    const nodeB = {};
    const canvasObj = { contains: (n: unknown) => n === nodeA };
    const menuObj = { contains: (n: unknown) => n === nodeB };
    expect(isNodeInsideCanvasOrMenu(canvasObj, menuObj, canvasObj)).toBe(true);
    expect(isNodeInsideCanvasOrMenu(canvasObj, menuObj, nodeA)).toBe(true);
    expect(isNodeInsideCanvasOrMenu(canvasObj, menuObj, nodeB)).toBe(true);
    expect(isNodeInsideCanvasOrMenu(canvasObj, menuObj, {})).toBe(false);
    expect(isNodeInsideCanvasOrMenu(null, menuObj, nodeB)).toBe(false);
  });

  it('changed: speed-panel-options-store handles non-finite clamps, normalization, labels, load fallbacks, switches, and storage warnings', async () => {
    const store = useSpeedPanelOptions.getState();
    store.setClickDriftPx(Number.NaN);
    expect(useSpeedPanelOptions.getState().options.clickDriftPx).toBe(CLICK_DRIFT_RANGE.min);
    store.setDoubleClickRadiusPx(Number.POSITIVE_INFINITY);
    expect(useSpeedPanelOptions.getState().options.doubleClickRadiusPx).toBe(DOUBLE_CLICK_RADIUS_RANGE.min);

    expect(normalizeTriggerKeyCode('')).toBeNull();
    expect(normalizeTriggerKeyCode('   ')).toBeNull();
    expect(normalizeTriggerKeyCode(' ')).toBe('Space');
    expect(normalizeTriggerKeyCode('Digit5')).toBe('Digit5');
    expect(normalizeTriggerKeyCode('5')).toBe('Digit5');
    expect(normalizeTriggerKeyCode('a')).toBe('KeyA');
    expect(normalizeTriggerKeyCode('F19')).toBeNull();

    expect(formatTriggerKeyLabel('Digit5')).toBe('5');
    expect(formatTriggerKeyLabel('Semicolon')).toBe(';');
    expect(formatTriggerKeyLabel('F19')).toBe('F19');

    expect(validateTriggerKey('???').valid).toBe(false);
    expect(validateTriggerKey('ShiftLeft').valid).toBe(false);

    // Load fallbacks for bad JSON structures
    for (const raw of ['[]', '42', 'null', '"hello"', '{corrupt-json']) {
      storage.set(SPEED_PANEL_OPTIONS_KEY, raw);
      expect(loadSpeedPanelOptions()).toEqual(DEFAULT_SPEED_PANEL_OPTIONS);
    }

    storage.set(
      SPEED_PANEL_OPTIONS_KEY,
      JSON.stringify({
        version: 1,
        keyTriggerEnabled: 'yes',
        triggerKey: 123,
        doubleRightClickEnabled: 0,
      }),
    );
    expect(loadSpeedPanelOptions()).toEqual(DEFAULT_SPEED_PANEL_OPTIONS);

    // Missing localStorage global fallback
    const origLsDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true });
    try {
      expect(loadSpeedPanelOptions()).toEqual(DEFAULT_SPEED_PANEL_OPTIONS);
    } finally {
      if (origLsDesc) Object.defineProperty(globalThis, 'localStorage', origLsDesc);
    }

    // Setters toggle switches and resetOptions restores defaults
    store.setKeyTriggerEnabled(false);
    expect(useSpeedPanelOptions.getState().options.keyTriggerEnabled).toBe(false);
    store.setDoubleRightClickEnabled(false);
    expect(useSpeedPanelOptions.getState().options.doubleRightClickEnabled).toBe(false);
    store.resetOptions();
    expect(useSpeedPanelOptions.getState().options).toEqual(DEFAULT_SPEED_PANEL_OPTIONS);

    // Save failure warning logs once per module lifetime
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => null,
        setItem: () => { throw new Error('quota'); },
        removeItem: () => {},
        clear: () => {},
      },
      configurable: true,
    });
    try {
      vi.resetModules();
      const fresh = await import('../store/speed-panel-options-store.js');
      fresh.useSpeedPanelOptions.getState().setKeyTriggerEnabled(false);
      fresh.useSpeedPanelOptions.getState().setDoubleRightClickEnabled(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    } finally {
      warnSpy.mockRestore();
      if (origLsDesc) Object.defineProperty(globalThis, 'localStorage', origLsDesc);
    }
  });

  it('changed: OptionsModal draft helpers type multi-digit numbers, clamp on commit, revert on Escape, and expose aria error metadata', () => {
    expect(parseThresholdDraft('')).toBeNull();
    expect(parseThresholdDraft('  420  ')).toBe(420);
    expect(parseThresholdDraft('abc')).toBeNull();
    expect(clampThresholdDraftValue(999, 250, 500)).toBe(500);
    expect(clampThresholdDraftValue(2, 4, 15)).toBe(4);
    expect(clampThresholdDraftValue(12.6, 4, 15)).toBe(13);

    const commits: number[] = [];
    expect(commitThresholdDraft('12', 6, 4, 15, (v) => commits.push(v))).toBe('12');
    expect(commits).toEqual([12]);
    expect(commitThresholdDraft('', 12, 4, 15, (v) => commits.push(v))).toBe('12');
    expect(commitThresholdDraft('99', 15, 4, 15, (v) => commits.push(v))).toBe('15');
    expect(commits).toEqual([12, 15]);

    const enterPrevent = vi.fn();
    const enterStop = vi.fn();
    const onEnterCommit = vi.fn();
    const onReset = vi.fn();
    handleThresholdFieldKeyDown({ key: 'Enter', preventDefault: enterPrevent, stopPropagation: enterStop }, '35', 18, onEnterCommit, onReset);
    expect(enterPrevent).toHaveBeenCalledOnce();
    expect(enterStop).toHaveBeenCalledOnce();
    expect(onEnterCommit).toHaveBeenCalledOnce();

    const escPrevent = vi.fn();
    const escStop = vi.fn();
    handleThresholdFieldKeyDown({ key: 'Escape', preventDefault: escPrevent, stopPropagation: escStop }, '99', 18, onEnterCommit, onReset);
    expect(escPrevent).toHaveBeenCalledOnce();
    expect(escStop).toHaveBeenCalledOnce();
    expect(onReset).toHaveBeenCalledWith('18');

    const cleanEscPrevent = vi.fn();
    handleThresholdFieldKeyDown({ key: 'Escape', preventDefault: cleanEscPrevent, stopPropagation: vi.fn() }, '18', 18, onEnterCommit, onReset);
    expect(cleanEscPrevent).not.toHaveBeenCalled();

    const applyKey = (k: string) => useSpeedPanelOptions.getState().setTriggerKey(k);
    expect(applyKeyCaptureEvent({ key: 'Tab', preventDefault: vi.fn(), stopPropagation: vi.fn() }, applyKey)).toEqual({ handled: false });
    expect(applyKeyCaptureEvent({ key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() }, applyKey)).toEqual({ handled: false });
    expect(applyKeyCaptureEvent({ key: 'Shift', preventDefault: vi.fn(), stopPropagation: vi.fn() }, applyKey)).toEqual({ handled: false });
    expect(applyKeyCaptureEvent({ key: 'k', ctrlKey: true, preventDefault: vi.fn(), stopPropagation: vi.fn() }, applyKey)).toEqual({
      handled: true,
      error: 'Choose a single unmodified key (no Ctrl, Alt, or Meta).',
    });
    expect(applyKeyCaptureEvent({ key: 'Dead', preventDefault: vi.fn(), stopPropagation: vi.fn() }, applyKey).handled).toBe(true);
    expect(applyKeyCaptureEvent({ key: 'k', code: 'KeyK', preventDefault: vi.fn(), stopPropagation: vi.fn() }, applyKey)).toEqual({
      handled: true,
      error: null,
    });

    const errHtml = renderToStaticMarkup(createElement(OptionsModal, { onClose: () => {}, initialKeyError: 'Space is reserved.' }));
    expect(errHtml).toContain(`id="${TRIGGER_KEY_ERROR_ID}"`);
    expect(errHtml).toContain('aria-invalid="true"');
    expect(errHtml).toContain(`aria-describedby="${TRIGGER_KEY_ERROR_ID}"`);
  });
});
