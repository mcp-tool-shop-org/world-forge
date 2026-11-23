import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const hookSlots: unknown[] = [];
let hookIdx = 0;
let pendingEffects: Array<() => void | (() => void)> = [];
const effectCleanups: Array<() => void> = [];

function cleanupEffects() {
  for (const cleanup of effectCleanups.splice(0)) {
    try {
      cleanup();
    } catch {
      /* ignore teardown errors */
    }
  }
  pendingEffects = [];
}

function flushEffects() {
  const toRun = pendingEffects.splice(0);
  for (const effect of toRun) {
    const cleanup = effect();
    if (typeof cleanup === 'function') {
      effectCleanups.push(cleanup);
    }
  }
}

function resetHooks() {
  cleanupEffects();
  hookSlots.length = 0;
  hookIdx = 0;
}

const mockCanvasElement = {
  parentElement: { clientWidth: 800, clientHeight: 600 },
  width: 800,
  height: 600,
  offsetWidth: 800,
  offsetHeight: 600,
  getContext: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  addEventListener: () => {},
  removeEventListener: () => {},
};

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const i = hookIdx++;
      if (!(i in hookSlots)) {
        hookSlots[i] = typeof initial === 'function' ? (initial as () => T)() : initial;
      }
      const setState = (next: T | ((prev: T) => T)) => {
        hookSlots[i] = typeof next === 'function' ? (next as (prev: T) => T)(hookSlots[i] as T) : next;
      };
      return [hookSlots[i] as T, setState] as const;
    },
    useRef: <T,>(initial: T) => {
      const i = hookIdx++;
      if (!(i in hookSlots)) {
        hookSlots[i] = { current: initial };
      }
      return hookSlots[i] as { current: T };
    },
    useMemo: <T,>(factory: () => T) => {
      hookIdx++;
      return factory();
    },
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => {
      hookIdx++;
      return fn;
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const i = hookIdx++;
      const prev = hookSlots[i] as { deps?: readonly unknown[] } | undefined;
      const changed =
        !prev ||
        !deps ||
        !prev.deps ||
        deps.length !== prev.deps.length ||
        deps.some((d, k) => !Object.is(d, prev.deps![k]));
      if (changed) {
        hookSlots[i] = { deps };
        pendingEffects.push(effect);
      }
    },
  };
});

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

import { createElement, Fragment, type ReactNode } from 'react';
import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { App } from '../App.js';
import { Canvas } from '../Canvas.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import { createCanvasRightPointerHandlers } from '../speed-panel-gesture.js';
import { findAllHitsAt, findHitAt, type HitResult } from '../hit-testing.js';
import {
  clampActiveIndex,
  dispatchSpeedPanelKeyAction,
} from '../speed-panel-ui.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { SPEED_PANEL_STATE_V2_KEY, useSpeedPanelPins } from '../store/speed-panel-store.js';
import { DEFAULT_SPEED_PANEL_OPTIONS } from '../store/speed-panel-options-store.js';
import { _getToastsForTest, _resetToastsForTest } from '../ui/Toast.js';

interface ElementNode {
  type: unknown;
  props: Record<string, unknown>;
}

function isElementNode(node: unknown): node is ElementNode {
  return Boolean(node && typeof node === 'object' && 'type' in node && 'props' in node);
}

function expandElement(node: ReactNode): unknown[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') {
    return [node];
  }
  if (Array.isArray(node)) {
    return node.flatMap(expandElement);
  }
  if (!isElementNode(node)) return [];
  if (node.type === Fragment) {
    return expandElement(node.props.children as ReactNode);
  }
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: Record<string, unknown>) => ReactNode)(node.props);
    return expandElement(rendered);
  }
  if (node.type === 'canvas' && node.props.ref && typeof node.props.ref === 'object' && 'current' in (node.props.ref as object)) {
    (node.props.ref as { current: unknown }).current = mockCanvasElement;
  }
  const expandedChildren = expandElement(node.props.children as ReactNode);
  return [{ type: node.type, props: { ...node.props, children: expandedChildren } }];
}

function renderRoot<P extends object>(Component: (props: P) => ReactNode, props: P): unknown[] {
  hookIdx = 0;
  return expandElement(createElement(Component, props));
}

function collectAll(nodes: unknown[], pred: (el: ElementNode) => boolean, out: ElementNode[] = []): ElementNode[] {
  for (const n of nodes) {
    if (Array.isArray(n)) {
      collectAll(n, pred, out);
      continue;
    }
    if (!isElementNode(n)) continue;
    if (pred(n)) out.push(n);
    if (n.props.children !== undefined) {
      collectAll(Array.isArray(n.props.children) ? n.props.children : [n.props.children], pred, out);
    }
  }
  return out;
}

function textContent(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isElementNode(node)) return textContent(node.props.children);
  return '';
}

function findByTestId(tree: unknown[], id: string): ElementNode | undefined {
  return collectAll(tree, (el) => el.props['data-testid'] === id)[0];
}

function installMockDomGlobals() {
  const win = ((globalThis as Record<string, unknown>).window ?? globalThis) as Record<string, unknown>;
  (globalThis as Record<string, unknown>).window = win;
  win.addEventListener = win.addEventListener ?? (() => {});
  win.removeEventListener = win.removeEventListener ?? (() => {});
  win.matchMedia = () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });
  const classListStub = () => ({ toggle: () => {}, add: () => {}, remove: () => {}, contains: () => false });
  (globalThis as Record<string, unknown>).document = {
    body: { classList: classListStub(), appendChild: () => {}, removeChild: () => {} },
    documentElement: { classList: classListStub() },
    hidden: false,
    activeElement: null,
    createElement: () => ({ href: '', download: '', click: () => {}, remove: () => {} }),
    getElementById: () => null,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function makeOverlapProject(): WorldProject {
  const p = structuredClone(minimalProject);
  const z0 = p.zones[0];
  p.entityPlacements = [
    { entityId: 'npc-innkeeper', name: 'Innkeeper', role: 'npc', zoneId: z0.id, gridX: z0.gridX + 2, gridY: z0.gridY + 2 },
  ];
  p.landmarks = [
    { id: 'lm-fountain', name: 'Town Fountain', zoneId: z0.id, gridX: z0.gridX + 2, gridY: z0.gridY + 2, tags: [], interactionType: 'inspect' },
  ];
  p.spawnPoints = [
    { id: 'sp-square', zoneId: z0.id, gridX: z0.gridX + 2, gridY: z0.gridY + 2, isDefault: true },
  ];
  p.propPlacements = [
    { id: 'prop-sign', propId: 'signpost', zoneId: z0.id, gridX: z0.gridX + 2, gridY: z0.gridY + 2 },
  ];
  p.tileLayers = [
    { id: 'layer-floor', name: 'Floor', zIndex: 0, tiles: [{ id: 'tile-stone', tileId: 'stone', gridX: z0.gridX + 2, gridY: z0.gridY + 2 }] },
  ];
  return p;
}

describe('Speed Panel Scope Chips, Target Highlight & Live Announcements', () => {
  beforeEach(() => {
    storage.clear();
    _resetToastsForTest();
    resetHooks();
    vi.restoreAllMocks();
    installMockDomGlobals();
    useProjectStore.getState().loadProject(makeOverlapProject());
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().closeSpeedPanel();
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [], loadWarnings: [] });
  });

  afterEach(() => {
    resetHooks();
    _resetToastsForTest();
  });

  it('orders scope chips from findAllHitsAt, omits hidden items/layers, places Canvas last, and omits chips for one hit', async () => {
    const { buildScopeChips } = await import('../speed-panel-scope.js');
    const project = useProjectStore.getState().project;
    const z0 = project.zones[0];
    const tileSize = project.map.tileSize;
    const vp = { panX: 0, panY: 0, zoom: 1 };
    const sx = (z0.gridX + 2) * tileSize;
    const sy = (z0.gridY + 2) * tileSize;

    // 1) Overlapping visible objects match findAllHitsAt order with Canvas last
    const visAll = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true, showProps: true, showTiles: true };
    const allHits = findAllHitsAt(sx, sy, vp, project, tileSize, visAll);
    expect(allHits.map((h) => h.type)).toEqual(['spawn', 'landmark', 'entity', 'prop', 'tile', 'zone']);
    const chips = buildScopeChips(allHits, project);
    expect(chips.map((c) => c.hit)).toEqual([...allHits, null]);
    expect(chips[0].label).toContain('Spawn:');
    expect(chips[1].label).toBe('Landmark: Town Fountain');
    expect(chips[2].label).toBe('NPC: Innkeeper');
    expect(chips[chips.length - 1].label).toBe('Canvas');

    // 2) Hidden layers & hidden object IDs are omitted before building chips
    const hiddenIds = new Set(['lm-fountain']);
    const visMasked = { showEntities: false, showLandmarks: true, showSpawns: false, showConnections: true, showProps: false, showTiles: false };
    const visibleOnly = findAllHitsAt(sx, sy, vp, project, tileSize, visMasked).filter((h) => !hiddenIds.has(h.id));
    expect(visibleOnly).toEqual([{ type: 'zone', id: z0.id }]);

    // 3) Single hit or zero hits produces no chip row
    expect(buildScopeChips(visibleOnly, project)).toEqual([]);
    expect(buildScopeChips([], project)).toEqual([]);
  });

  it('triggers default target unchanged on pointer open while supplying filtered hits for scope chips', () => {
    const project = structuredClone(useProjectStore.getState().project);
    const z0 = project.zones[0];
    // Move landmark off the entity spot so findHitAt returns entity while hidden spawn stays filtered
    project.landmarks = [{ id: 'lm-fountain', name: 'Town Fountain', zoneId: z0.id, gridX: z0.gridX + 4, gridY: z0.gridY + 4, tags: [], interactionType: 'inspect' }];
    const tileSize = project.map.tileSize;
    const vp = { panX: 0, panY: 0, zoom: 1 };
    const sx = (z0.gridX + 2) * tileSize;
    const sy = (z0.gridY + 2) * tileSize;
    const vis = { showEntities: true, showLandmarks: true, showSpawns: false, showConnections: true, showProps: false, showTiles: false };
    const hiddenIds = new Set(['lm-fountain']);
    const openSpy = vi.fn();

    const handlers = createCanvasRightPointerHandlers({
      isMacPlatform: () => false,
      getScreenXY: () => ({ sx, sy }),
      getViewport: () => vp,
      setViewport: () => {},
      getOptions: () => ({ ...DEFAULT_SPEED_PANEL_OPTIONS }),
      findFilteredHitAt: (x: number, y: number) => {
        const hit = findHitAt(x, y, vp, project, tileSize, vis);
        return hit && !hiddenIds.has(hit.id) ? hit : null;
      },
      findFilteredHitsAt: (x: number, y: number) => findAllHitsAt(x, y, vp, project, tileSize, vis).filter((h) => !hiddenIds.has(h.id)),
      getMenuActionsForHit: () => [],
      openSpeedPanel: openSpy,
      getContextMenu: () => null,
      setContextMenu: () => {},
      getGestureState: () => ({ rightButtonDown: false, rightPressStart: null, lastRightUp: null, dragging: false }),
      setGestureState: () => {},
      getRightPanStart: () => null,
      setRightPanStart: () => {},
      getLastRightMoveEvent: () => null,
      setLastRightMoveEvent: () => {},
      setSuppressNextLeftMouseUp: () => {},
      setSuppressNextCanvasContextMenu: () => {},
      getContextMenuHandledInPress: () => false,
      setContextMenuHandledInPress: () => {},
      setLastPointer: () => {},
      getLastPointer: () => ({ sx, sy }),
      setPointerOverCanvas: () => {},
      getPointerOverCanvas: () => true,
      setLastPointerRegion: () => {},
      getLastPointerRegion: () => 'canvas',
      setLastPointerStamp: () => {},
      getLastPointerStamp: () => 0,
      getLastCanvasFocusStamp: () => 0,
      getCanvasFocusedNow: () => false,
      getCanvasSize: () => ({ w: 800, h: 600 }),
      getEditorEnv: () => ({
        activeModal: null, showSearch: false, showSpeedPanel: false, activeElement: null,
        selection: useEditorStore.getState().selection, selectedConnection: null, project, tileSize,
      }),
    } as never);

    handlers.handleSpeedPanelKeyTrigger({
      key: 'q', code: 'KeyQ', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      repeat: false, isComposing: false, target: null, preventDefault: () => {}, stopPropagation: () => {},
    });

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][2]).toEqual({ type: 'entity', id: 'npc-innkeeper' });
    expect(openSpy.mock.calls[0][3]).toEqual([
      { type: 'entity', id: 'npc-innkeeper' },
      { type: 'zone', id: z0.id },
    ]);
  });

  it('switches target via chip click, Tab, and Shift+Tab on empty search and rebuilds deck, Quick Fix, search, and slot 1 highlight', () => {
    const project = structuredClone(minimalProject);
    const z0 = project.zones[0];
    project.zones[0] = { ...z0, backgroundId: 'missing-asset' };
    project.entityPlacements = [
      { entityId: 'npc-innkeeper', name: 'Innkeeper', role: 'npc', zoneId: z0.id, gridX: z0.gridX + 2, gridY: z0.gridY + 2 },
    ];
    useProjectStore.getState().loadProject(project);

    const hits: HitResult[] = [
      { type: 'entity', id: 'npc-innkeeper' },
      { type: 'zone', id: z0.id },
    ];
    useEditorStore.getState().openSpeedPanel(120, 120, hits[0], hits as never);

    let tree = renderRoot(SpeedPanel, {});
    flushEffects();

    // Chip bar renders Entity, Zone, Canvas with Entity active
    const chipBar = findByTestId(tree, 'wf-sp-scope-chips');
    expect(chipBar).toBeDefined();
    const chips = collectAll(tree, (el) => typeof el.props['data-testid'] === 'string' && (el.props['data-testid'] as string).startsWith('wf-sp-scope-chip-'));
    expect(chips.map((c) => textContent(c))).toEqual(['NPC: Innkeeper', `Zone: ${z0.name}`, 'Canvas']);
    expect(chips[0].props['aria-pressed']).toBe(true);
    expect(findByTestId(tree, 'wf-sp-quick-fix-row')).toBeUndefined();
    expect(findByTestId(tree, 'wf-sp-band-1')!.props.children).toBeDefined();

    // Press Tab with empty search -> switches to Zone, surfaces Quick Fix row, updates Band 1 deck & highlights slot 1
    const panelEl = findByTestId(tree, 'wf-speed-panel')!;
    const tabEvt = (shiftKey: boolean) => ({
      key: 'Tab', code: 'Tab', altKey: false, ctrlKey: false, metaKey: false, shiftKey,
      target: null, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    (panelEl.props.onKeyDown as (e: ReturnType<typeof tabEvt>) => void)(tabEvt(false));
    expect(useEditorStore.getState().speedPanelContext).toEqual({ type: 'zone', id: z0.id });

    tree = renderRoot(SpeedPanel, {});
    flushEffects();
    tree = renderRoot(SpeedPanel, {});
    expect(findByTestId(tree, 'wf-sp-quick-fix-row')).toBeDefined();
    const zoneSlot1 = collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-1-connect-from')[0];
    expect(zoneSlot1).toBeDefined();
    const slot0 = collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-0-edit-props')[0];
    expect(slot0.props['aria-selected']).toBe(true);

    // Tab again -> Canvas chip
    (findByTestId(tree, 'wf-speed-panel')!.props.onKeyDown as (e: ReturnType<typeof tabEvt>) => void)(tabEvt(false));
    expect(useEditorStore.getState().speedPanelContext).toBeNull();
    tree = renderRoot(SpeedPanel, {});
    expect(collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-0-new-zone')[0]).toBeDefined();

    // Shift+Tab -> wraps back to Zone chip
    (findByTestId(tree, 'wf-speed-panel')!.props.onKeyDown as (e: ReturnType<typeof tabEvt>) => void)(tabEvt(true));
    expect(useEditorStore.getState().speedPanelContext).toEqual({ type: 'zone', id: z0.id });

    // Non-empty search query + chip click rebuilds search results for new target
    resetHooks();
    useEditorStore.getState().openSpeedPanel(120, 120, hits[0], hits as never);
    let sTree = renderRoot(SpeedPanel, { initialQuery: 'assign' });
    flushEffects();
    expect(collectAll(sTree, (el) => el.props.id === 'wf-sp-opt-hit-0-assign-district')[0]).toBeUndefined();
    const zoneChipBtn = findByTestId(sTree, `wf-sp-scope-chip-zone:${z0.id}`)!;
    (zoneChipBtn.props.onClick as () => void)();
    sTree = renderRoot(SpeedPanel, { initialQuery: 'assign' });
    expect(collectAll(sTree, (el) => el.props.id === 'wf-sp-opt-hit-0-assign-district')[0]).toBeDefined();
  });

  it('preserves Tab for typed scalar input when scope chips are visible', () => {
    const project = useProjectStore.getState().project;
    const z0 = project.zones[0];
    const hits: HitResult[] = [
      { type: 'entity', id: 'npc-innkeeper' },
      { type: 'zone', id: z0.id },
    ];
    useEditorStore.getState().openSpeedPanel(120, 120, hits[1], hits as never);

    let tree = renderRoot(SpeedPanel, { initialQuery: 'elev' });
    flushEffects();
    expect(findByTestId(tree, 'wf-sp-scope-chips')).toBeDefined();

    // Press Tab with search 'elev' -> opens Set Elevation inline scalar pill, does NOT cycle scope chips
    const panelEl = findByTestId(tree, 'wf-speed-panel')!;
    (panelEl.props.onKeyDown as (e: Record<string, unknown>) => void)({
      key: 'Tab', code: 'Tab', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      target: null, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    expect(useEditorStore.getState().speedPanelContext).toEqual({ type: 'zone', id: z0.id });
    tree = renderRoot(SpeedPanel, { initialQuery: 'elev' });
    const pill = findByTestId(tree, 'wf-sp-scalar-pill');
    expect(pill).toBeDefined();
    (pill!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '2' } });
    tree = renderRoot(SpeedPanel, { initialQuery: 'elev' });
    (findByTestId(tree, 'wf-sp-scalar-pill')!.props.onKeyDown as (e: Record<string, unknown>) => void)({
      key: 'Enter', preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(2);
  });

  it('computes and draws temporary canvas target highlight without project/undo mutation and clears on close', async () => {
    const { computeScopeTargetHighlight, drawScopeTargetHighlight } = await import('../speed-panel-scope.js');
    const project = useProjectStore.getState().project;
    const z0 = project.zones[0];
    const tileSize = project.map.tileSize;

    expect(computeScopeTargetHighlight({ type: 'zone', id: z0.id }, project, tileSize)?.kind).toBe('rect');
    expect(computeScopeTargetHighlight({ type: 'entity', id: 'npc-innkeeper' }, project, tileSize)?.kind).toBe('circle');
    expect(computeScopeTargetHighlight({ type: 'landmark', id: 'lm-fountain' }, project, tileSize)?.kind).toBe('circle');
    expect(computeScopeTargetHighlight({ type: 'spawn', id: 'sp-square' }, project, tileSize)?.kind).toBe('circle');
    expect(computeScopeTargetHighlight({ type: 'prop', id: 'prop-sign' }, project, tileSize)?.kind).toBe('rect');
    expect(computeScopeTargetHighlight({ type: 'tile', id: 'layer-floor::2::2' }, project, tileSize)?.kind).toBe('rect');
    expect(computeScopeTargetHighlight({ type: 'connection', id: `${project.connections[0].fromZoneId}::${project.connections[0].toZoneId}` }, project, tileSize)?.kind).toBe('line');
    expect(computeScopeTargetHighlight(null, project, tileSize)).toBeNull();

    const drawCalls: string[] = [];
    const mockCtx = {
      save: () => drawCalls.push('save'),
      restore: () => drawCalls.push('restore'),
      setLineDash: () => {},
      beginPath: () => {},
      rect: () => drawCalls.push('rect'),
      arc: () => drawCalls.push('arc'),
      moveTo: () => {},
      lineTo: () => drawCalls.push('lineTo'),
      stroke: () => drawCalls.push('stroke'),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
    };
    drawScopeTargetHighlight(mockCtx, computeScopeTargetHighlight({ type: 'zone', id: z0.id }, project, tileSize)!, 1, '#38bdf8');
    expect(drawCalls).toContain('stroke');

    // Canvas renders screen-space highlight ring while Speed Panel is open, moves with context, and clears on close
    const snapshotBefore = structuredClone(useProjectStore.getState().project);
    const hits: HitResult[] = [
      { type: 'entity', id: 'npc-innkeeper' },
      { type: 'zone', id: z0.id },
    ];
    useEditorStore.getState().openSpeedPanel(120, 120, hits[0], hits as never);
    let cTree = renderRoot(Canvas, {});
    const hl1 = findByTestId(cTree, 'wf-sp-canvas-highlight');
    expect(hl1?.props['data-target-type']).toBe('entity');

    useEditorStore.getState().setSpeedPanelContext(hits[1]);
    cTree = renderRoot(Canvas, {});
    const hl2 = findByTestId(cTree, 'wf-sp-canvas-highlight');
    expect(hl2?.props['data-target-type']).toBe('zone');

    useEditorStore.getState().closeSpeedPanel();
    cTree = renderRoot(Canvas, {});
    expect(findByTestId(cTree, 'wf-sp-canvas-highlight')).toBeUndefined();
    expect(useProjectStore.getState().project).toEqual(snapshotBefore);
    expect(useProjectStore.getState().undoStack).toEqual([]);
  });

  it('announces active target kind and name on open and on each scope switch', () => {
    const project = useProjectStore.getState().project;
    const z0 = project.zones[0];
    const hits: HitResult[] = [
      { type: 'entity', id: 'npc-innkeeper' },
      { type: 'zone', id: z0.id },
    ];
    useEditorStore.getState().openSpeedPanel(100, 100, hits[0], hits as never);
    let tree = renderRoot(SpeedPanel, {});
    flushEffects();

    const live = findByTestId(tree, 'wf-sp-live-region');
    expect(live).toBeDefined();
    expect(live!.props['aria-live']).toBe('polite');
    expect(textContent(live)).toContain('NPC: Innkeeper');

    const zoneChip = findByTestId(tree, `wf-sp-scope-chip-zone:${z0.id}`)!;
    (zoneChip.props.onClick as () => void)();
    tree = renderRoot(SpeedPanel, {});
    expect(textContent(findByTestId(tree, 'wf-sp-live-region'))).toContain(`Zone: ${z0.name}`);

    const canvasChip = findByTestId(tree, 'wf-sp-scope-chip-canvas')!;
    (canvasChip.props.onClick as () => void)();
    tree = renderRoot(SpeedPanel, {});
    expect(textContent(findByTestId(tree, 'wf-sp-live-region'))).toContain('Canvas');
  });

  it('triggers startup load warnings notice inside mounted App without overwriting storage', () => {
    const rawV2 = JSON.stringify({
      version: 2,
      pins: ['fit-content'],
      recentIds: [],
      frecency: {},
      adaptiveHistory: {},
      groups: [],
      macros: [{ id: 'm-drop', name: 'Broken Startup', steps: [{ actionId: 'new-zone' }] }],
      showRecents: true,
    });
    storage.set(SPEED_PANEL_STATE_V2_KEY, rawV2);
    useSpeedPanelPins.setState({
      loadWarnings: [
        'Unsupported macro step command dropped from "Broken Startup": new-zone',
        'Dropped macro "Broken Startup" (removed): no valid executable steps remaining',
      ],
    });

    renderRoot(App, {});
    flushEffects();

    const toasts = _getToastsForTest();
    expect(toasts.some((t) => t.kind === 'warning' && t.message.includes('Broken Startup'))).toBe(true);
    expect(useSpeedPanelPins.getState().loadWarnings).toEqual([]);
    expect(storage.get(SPEED_PANEL_STATE_V2_KEY)).toBe(rawV2);
  });

  it('resets active row on position/context change, uses slot 1 clamp fallback with Quick Fix, and keeps highlight on same item when Quick Fix disappears', async () => {
    const { reconcileActiveIndexOnQuickFixChange } = await import('../speed-panel-ui.js');
    const broken = structuredClone(minimalProject);
    const z0 = broken.zones[0];
    broken.zones[0] = { ...z0, backgroundId: 'missing-bg' };
    useProjectStore.getState().loadProject(broken);

    // 1) Clamp fallback with Quick Fix lands on Band 1 slot 1 (index 1)
    expect(clampActiveIndex(99, 10, 1)).toBe(1);
    expect(reconcileActiveIndexOnQuickFixChange(3, true, false, 9)).toBe(2);

    // 2) Mounted SpeedPanel: navigate down to slot 3 (index 3 when Quick Fix present), then clear problem while panel stays open
    useEditorStore.getState().openSpeedPanel(100, 100, { type: 'zone', id: z0.id }, [{ type: 'zone', id: z0.id }] as never);
    let tree = renderRoot(SpeedPanel, {});
    flushEffects();
    const downEvt = {
      key: 'ArrowDown', code: 'ArrowDown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      target: null, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    };
    const panelEl = findByTestId(tree, 'wf-speed-panel')!;
    // Initial index is 1 (edit-props). Move down once -> index 2 (connect-from).
    (panelEl.props.onKeyDown as (e: typeof downEvt) => void)(downEvt);
    tree = renderRoot(SpeedPanel, {});
    expect(collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-1-connect-from')[0].props['aria-selected']).toBe(true);

    // Resolve the broken background while panel remains open -> Quick Fix disappears, highlight stays on connect-from!
    useProjectStore.getState().updateProject((p) => ({
      ...p,
      zones: p.zones.map((z) => (z.id === z0.id ? { ...z, backgroundId: undefined } : z)),
    }));
    tree = renderRoot(SpeedPanel, {});
    flushEffects();
    tree = renderRoot(SpeedPanel, {});
    expect(findByTestId(tree, 'wf-sp-quick-fix-row')).toBeUndefined();
    expect(collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-1-connect-from')[0].props['aria-selected']).toBe(true);

    // Changing position resets highlight back to Band 1 slot 1
    useEditorStore.getState().openSpeedPanel(220, 180, { type: 'zone', id: z0.id }, [{ type: 'zone', id: z0.id }] as never);
    tree = renderRoot(SpeedPanel, {});
    flushEffects();
    tree = renderRoot(SpeedPanel, {});
    expect(collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-0-edit-props')[0].props['aria-selected']).toBe(true);
  });

  it('formats labels, computes highlights, draws primitives, and reconciles Quick Fix across all target types and keyboard chip arrows', async () => {
    const scopeMod = await import('../speed-panel-scope.js');
    const { reconcileActiveIndexOnQuickFixChange } = await import('../speed-panel-ui.js');
    const project = structuredClone(useProjectStore.getState().project);
    const z0 = project.zones[0];
    const tileSize = project.map.tileSize;
    project.entityPlacements = [
      ...project.entityPlacements,
      { entityId: 'boss-warden', name: 'Iron Warden', role: 'boss', zoneId: z0.id, gridX: z0.gridX + 1, gridY: z0.gridY + 1 },
    ];
    project.itemPlacements = [
      { itemId: 'item-key', name: 'Brass Key', zoneId: z0.id, gridX: z0.gridX + 3, gridY: z0.gridY + 1, hidden: false, slot: 'trinket', rarity: 'common', statModifiers: {} },
    ];
    project.props = [
      { id: 'signpost', name: 'Old Sign', width: 2, height: 1, tags: [], walkable: true, interactable: true },
    ];
    project.marketNodes = [
      { id: 'mkt-1', zoneId: z0.id, merchantEntityId: 'npc-innkeeper', supplyCategories: ['food'], priceModifier: 1, contrabandAvailable: false },
      { id: 'mkt-bare', zoneId: z0.id, supplyCategories: [], priceModifier: 1, contrabandAvailable: false },
    ];
    project.buildings = [
      { id: 'bld-1', name: 'Red Fox Inn', buildingType: 'tavern', zoneId: z0.id, gridX: z0.gridX + 1, gridY: z0.gridY + 2, width: 2, height: 2, tags: [] },
    ];
    project.hubs = [
      { id: 'hub-1', name: 'Town Square', zoneId: z0.id, hubType: 'market-square', serviceTypes: ['inn'], connectedZoneIds: [], tags: [] },
    ];
    project.strongholds = [
      { id: 'sh-1', name: 'North Bastion', zoneId: z0.id, defenseLevel: 3, garrisonEntityIds: [], tags: [] },
    ];
    project.craftingStations = [
      { id: 'st-1', zoneId: z0.id, stationType: 'anvil', availableRecipes: [] },
    ];

    // Labels for all HitResult types
    expect(scopeMod.formatScopeTarget({ type: 'entity', id: 'boss-warden' }, project).label).toBe('Entity: Iron Warden');
    expect(scopeMod.formatScopeTarget({ type: 'encounter', id: project.encounterAnchors[0].id }, project).kindLabel).toBe('Encounter');
    expect(scopeMod.formatScopeTarget({ type: 'item', id: 'item-key' }, project).label).toBe('Item: Brass Key');
    expect(scopeMod.formatScopeTarget({ type: 'prop', id: 'prop-sign' }, project).label).toBe('Prop: Old Sign');
    expect(scopeMod.formatScopeTarget({ type: 'tile', id: 'layer-floor::2::2' }, project).label).toBe('Tile: (2, 2)');
    expect(scopeMod.formatScopeTarget({ type: 'connection', id: `${project.connections[0].fromZoneId}::${project.connections[0].toZoneId}` }, project).kindLabel).toBe('Connection');
    expect(scopeMod.formatScopeTarget({ type: 'market', id: 'mkt-1' }, project).label).toBe('Market: Innkeeper');
    expect(scopeMod.formatScopeTarget({ type: 'market', id: 'mkt-bare' }, project).label).toBe('Market: mkt-bare');
    expect(scopeMod.formatScopeTarget({ type: 'building', id: 'bld-1' }, project).label).toBe('Building: Red Fox Inn');
    expect(scopeMod.formatScopeTarget({ type: 'hub', id: 'hub-1' }, project).label).toBe('Hub: Town Square');
    expect(scopeMod.formatScopeTarget({ type: 'stronghold', id: 'sh-1' }, project).label).toBe('Stronghold: North Bastion');
    expect(scopeMod.formatScopeTarget({ type: 'station', id: 'st-1' }, project).label).toBe('Station: anvil');
    expect(scopeMod.formatScopeTarget(null, project).label).toBe('Canvas');

    // Highlights for remaining types & missing-ID null guards
    expect(scopeMod.computeScopeTargetHighlight({ type: 'encounter', id: project.encounterAnchors[0].id }, project, tileSize)?.kind).toBe('circle');
    expect(scopeMod.computeScopeTargetHighlight({ type: 'item', id: 'item-key' }, project, tileSize)?.kind).toBe('circle');
    expect(scopeMod.computeScopeTargetHighlight({ type: 'building', id: 'bld-1' }, project, tileSize)?.kind).toBe('rect');
    expect(scopeMod.computeScopeTargetHighlight({ type: 'market', id: 'mkt-1' }, project, tileSize)?.kind).toBe('circle');
    expect(scopeMod.computeScopeTargetHighlight({ type: 'zone', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'entity', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'landmark', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'spawn', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'encounter', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'item', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'prop', id: 'missing' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'tile', id: 'bad-id' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'connection', id: 'bad-conn' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'connection', id: 'a::b' }, project, tileSize)).toBeNull();
    expect(scopeMod.computeScopeTargetHighlight({ type: 'hub', id: 'missing' }, project, tileSize)).toBeNull();

    // Screen boxes & 2D draw primitives for rect, circle, and line
    const vp = { panX: 0, panY: 0, zoom: 1 };
    const circleHl = scopeMod.computeScopeTargetHighlight({ type: 'entity', id: 'boss-warden' }, project, tileSize)!;
    const lineHl = scopeMod.computeScopeTargetHighlight({ type: 'connection', id: `${project.connections[0].fromZoneId}::${project.connections[0].toZoneId}` }, project, tileSize)!;
    expect(scopeMod.scopeHighlightToScreenBox(circleHl, vp)).toMatchObject({ width: 28, height: 28 });
    expect(scopeMod.scopeHighlightToScreenBox(lineHl, vp).width).toBeGreaterThanOrEqual(8);

    const calls: string[] = [];
    const ctx2d = {
      save: () => calls.push('save'),
      restore: () => calls.push('restore'),
      setLineDash: () => calls.push('dash'),
      beginPath: () => {},
      rect: () => calls.push('rect'),
      arc: () => calls.push('arc'),
      moveTo: () => calls.push('moveTo'),
      lineTo: () => calls.push('lineTo'),
      stroke: () => calls.push('stroke'),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
    };
    scopeMod.drawScopeTargetHighlight(ctx2d, circleHl, 1, '#38bdf8');
    scopeMod.drawScopeTargetHighlight(ctx2d, lineHl, 1, '#38bdf8');
    expect(calls).toContain('arc');
    expect(calls).toContain('lineTo');

    // Scope chip index & Quick Fix reconciliation edge branches
    const hits: HitResult[] = [
      { type: 'entity', id: 'npc-innkeeper' },
      { type: 'zone', id: z0.id },
    ];
    const chips = scopeMod.buildScopeChips(hits, project);
    expect(scopeMod.findActiveScopeChipIndex([], null)).toBe(-1);
    expect(scopeMod.findActiveScopeChipIndex(chips, { type: 'zone', id: 'other' })).toBe(0);
    expect(scopeMod.findActiveScopeChipIndex(chips.slice(0, 1), null)).toBe(0);
    expect(scopeMod.cycleScopeChipIndex([], hits[0], 1)).toEqual(hits[0]);
    expect(reconcileActiveIndexOnQuickFixChange(0, true, false, 5)).toBe(0);
    expect(reconcileActiveIndexOnQuickFixChange(1, false, true, 6)).toBe(2);
    expect(reconcileActiveIndexOnQuickFixChange(1, true, false, 0)).toBe(0);

    // ArrowRight & ArrowLeft keyboard navigation directly on rendered chip buttons, plus Quick Fix appearing while open
    useProjectStore.getState().loadProject(project);
    useEditorStore.getState().openSpeedPanel(120, 120, hits[0], hits as never);
    let tree = renderRoot(SpeedPanel, {});
    flushEffects();
    const chip0 = findByTestId(tree, 'wf-sp-scope-chip-entity:npc-innkeeper')!;
    const stopProp = vi.fn();
    const prevDef = vi.fn();
    (chip0.props.onKeyDown as (e: Record<string, unknown>) => void)({
      key: 'ArrowRight', preventDefault: prevDef, stopPropagation: stopProp,
    });
    expect(useEditorStore.getState().speedPanelContext).toEqual({ type: 'zone', id: z0.id });
    expect(prevDef).toHaveBeenCalledTimes(1);
    expect(stopProp).toHaveBeenCalledTimes(1);

    tree = renderRoot(SpeedPanel, {});
    flushEffects();
    tree = renderRoot(SpeedPanel, {});
    const zoneChip = findByTestId(tree, `wf-sp-scope-chip-zone:${z0.id}`)!;
    (zoneChip.props.onKeyDown as (e: Record<string, unknown>) => void)({
      key: 'ArrowLeft', preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    expect(useEditorStore.getState().speedPanelContext).toEqual(hits[0]);

    // Introducing a zone problem while open shifts highlight index to keep the same item active
    useEditorStore.getState().openSpeedPanel(140, 140, hits[1], [hits[1]] as never);
    tree = renderRoot(SpeedPanel, {});
    flushEffects();
    (findByTestId(tree, 'wf-speed-panel')!.props.onKeyDown as (e: Record<string, unknown>) => void)({
      key: 'ArrowDown', code: 'ArrowDown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      target: null, preventDefault: vi.fn(), stopPropagation: vi.fn(),
    });
    tree = renderRoot(SpeedPanel, {});
    expect(collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-1-connect-from')[0].props['aria-selected']).toBe(true);
    useProjectStore.getState().updateProject((p) => ({
      ...p,
      zones: p.zones.map((zn) => (zn.id === z0.id ? { ...zn, backgroundId: 'missing-asset' } : zn)),
    }));
    tree = renderRoot(SpeedPanel, {});
    flushEffects();
    tree = renderRoot(SpeedPanel, {});
    expect(findByTestId(tree, 'wf-sp-quick-fix-row')).toBeDefined();
    expect(collectAll(tree, (el) => el.props.id === 'wf-sp-opt-b1-1-connect-from')[0].props['aria-selected']).toBe(true);
  });
});
