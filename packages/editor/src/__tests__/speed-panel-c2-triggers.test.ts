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
  loadSpeedPanelOptions,
  resolveGestureThresholds,
  useSpeedPanelOptions,
  validateTriggerKey,
} from '../store/speed-panel-options-store.js';
import {
  beginRightPointer,
  createInitialRightClickGestureState,
  endRightPointer,
  getKeyboardSpeedPanelAnchor,
  isMacPlatform,
  isRightClickPointer,
  moveRightPointer,
  shouldTriggerSpeedPanelKey,
} from '../speed-panel-gesture.js';
import { OptionsModal } from '../panels/OptionsModal.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
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
});

describe('Speed Panel C2 backward compatibility (unchanged)', () => {
  it('unchanged: saved pre-C2 localStorage state loads alongside versioned options', async () => {
    storage.clear();
    storage.set('world-forge-speed-panel-pins', JSON.stringify(['edit-props', 'delete']));
    storage.set('world-forge-speed-panel-recents', JSON.stringify(['fit-content']));
    storage.set('world-forge-speed-panel-groups', JSON.stringify([{ id: 'g1', name: 'Core', actionIds: ['edit-props'] }]));
    storage.set('world-forge-speed-panel-macros', JSON.stringify([{ id: 'm1', name: 'Quick', steps: [{ actionId: 'edit-props' }] }]));

    vi.resetModules();
    const { useSpeedPanelPins } = await import('../store/speed-panel-store.js');
    const pins = useSpeedPanelPins.getState();
    expect(pins.pinnedIds).toEqual(['edit-props', 'delete']);
    expect(pins.recentIds).toEqual(['fit-content']);
    expect(pins.groups).toHaveLength(1);
    expect(pins.macros).toHaveLength(1);

    const opts = loadSpeedPanelOptions();
    expect(opts).toEqual(DEFAULT_SPEED_PANEL_OPTIONS);
  });

  it('unchanged: existing hotkeys, tool palette tools, and speed panel actions stay unchanged', () => {
    expect(HOTKEY_BINDINGS).toHaveLength(29);
    expect(TOOL_PALETTE_TOOLS).toHaveLength(10);
    expect(SPEED_PANEL_ACTIONS).toHaveLength(18);
  });
});
