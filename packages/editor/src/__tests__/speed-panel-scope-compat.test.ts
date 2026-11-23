import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const hookSlots: unknown[] = [];
let hookIdx = 0;
let pendingEffects: Array<() => void | (() => void)> = [];
const effectCleanups: Array<() => void> = [];

function resetHooks() {
  for (const cleanup of effectCleanups.splice(0)) {
    try { cleanup(); } catch { /* ignore */ }
  }
  pendingEffects = [];
  hookSlots.length = 0;
  hookIdx = 0;
}

function flushEffects() {
  for (const effect of pendingEffects.splice(0)) {
    const cleanup = effect();
    if (typeof cleanup === 'function') effectCleanups.push(cleanup);
  }
}

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
      if (!(i in hookSlots)) hookSlots[i] = { current: initial };
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
        !prev || !deps || !prev.deps || deps.length !== prev.deps.length || deps.some((d, k) => !Object.is(d, prev.deps![k]));
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
import {
  COMMAND_REGISTRY,
  getContextDeckCommands,
  getHotkeyBindingsFromRegistry,
} from '../command-registry.js';
import { buildSpeedPanelView } from '../speed-panel-layout.js';
import {
  buildNavigableEntries,
  dispatchSpeedPanelKeyAction,
  handleScalarPillKeyDown,
  resolveSpeedPanelKeyAction,
} from '../speed-panel-ui.js';
import { createCanvasSpatialPickHandlers, dispatchPickOverlayInputKeyDown } from '../speed-panel-steps.js';
import { productionHotkeyContext, productionStepStores } from '../panels/speed-panel-stores.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import { createCanvasRightPointerHandlers } from '../speed-panel-gesture.js';
import { DEFAULT_SPEED_PANEL_OPTIONS } from '../store/speed-panel-options-store.js';
import { collectTownMarkers } from '../town-markers.js';
import { findAllHitsAt, findHitAt, type HitResult } from '../hit-testing.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';

interface CompatNode {
  type: unknown;
  props: Record<string, unknown>;
}

function expandNodes(node: ReactNode): unknown[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return [node];
  if (Array.isArray(node)) return node.flatMap(expandNodes);
  if (typeof node !== 'object' || !('type' in node) || !('props' in node)) return [];
  const el = node as CompatNode;
  if (el.type === Fragment) return expandNodes(el.props.children as ReactNode);
  if (typeof el.type === 'function') return expandNodes((el.type as (p: Record<string, unknown>) => ReactNode)(el.props));
  return [{ type: el.type, props: { ...el.props, children: expandNodes(el.props.children as ReactNode) } }];
}

function collectCompatNodes(nodes: unknown[], pred: (el: CompatNode) => boolean, out: CompatNode[] = []): CompatNode[] {
  for (const n of nodes) {
    if (Array.isArray(n)) { collectCompatNodes(n, pred, out); continue; }
    if (!n || typeof n !== 'object' || !('type' in n) || !('props' in n)) continue;
    const el = n as CompatNode;
    if (pred(el)) out.push(el);
    if (el.props.children !== undefined) collectCompatNodes(Array.isArray(el.props.children) ? el.props.children : [el.props.children], pred, out);
  }
  return out;
}

function makeMultiKindProject(): WorldProject {
  const p = structuredClone(minimalProject);
  const z0 = p.zones[0];
  p.entityPlacements = [
    ...p.entityPlacements,
    { entityId: 'npc-market', name: 'Innkeeper', role: 'npc', zoneId: z0.id, gridX: z0.gridX + 3, gridY: z0.gridY + 2 },
  ];
  p.landmarks = [
    { id: 'lm-well', zoneId: z0.id, name: 'Old Well', gridX: z0.gridX + 4, gridY: z0.gridY + 4, tags: [], interactionType: 'inspect' },
  ];
  p.itemPlacements = [
    { itemId: 'item-potion', name: 'Potion', zoneId: z0.id, gridX: z0.gridX + 5, gridY: z0.gridY + 5, hidden: false, slot: 'trinket', rarity: 'common', statModifiers: {} },
  ];
  p.propPlacements = [
    { id: 'prop-crate', propId: 'crate', zoneId: z0.id, gridX: z0.gridX + 6, gridY: z0.gridY + 2 },
  ];
  p.buildings = [
    { id: 'bld-tavern', name: 'Red Fox Inn', buildingType: 'tavern', zoneId: z0.id, gridX: z0.gridX + 1, gridY: z0.gridY + 6, width: 2, height: 2, tags: [] },
  ];
  return p;
}

const ALL_KINDS: Array<HitResult | null> = [
  null,
  { type: 'zone', id: 'zone-entrance' },
  { type: 'entity', id: 'npc-market' },
  { type: 'landmark', id: 'lm-well' },
  { type: 'spawn', id: minimalProject.spawnPoints[0].id },
  { type: 'encounter', id: minimalProject.encounterAnchors[0].id },
  { type: 'connection', id: `${minimalProject.connections[0].fromZoneId}::${minimalProject.connections[0].toZoneId}` },
  { type: 'item', id: 'item-potion' },
  { type: 'prop', id: 'prop-crate' },
  { type: 'building', id: 'bld-tavern' },
];

describe('Speed Panel Default Target, Deck & Tab Baseline Compatibility', () => {
  beforeEach(() => {
    storage.clear();
    resetHooks();
    useProjectStore.getState().loadProject(makeMultiKindProject());
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().clearHiddenIds();
    useEditorStore.getState().closeSpeedPanel();
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [] });
  });

  afterEach(() => {
    resetHooks();
  });

  it('preserves default findHitAt target selection across overlapping and solo object kinds', () => {
    const project = useProjectStore.getState().project;
    const tileSize = project.map.tileSize;
    const viewport = { panX: 0, panY: 0, zoom: 1 };
    const visibility = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true };
    const z0 = project.zones[0];

    // Overlapping entity + zone still selects entity as findHitAt default
    const entityHit = findHitAt((z0.gridX + 3) * tileSize, (z0.gridY + 2) * tileSize, viewport, project, tileSize, visibility);
    expect(entityHit).toEqual({ type: 'entity', id: 'npc-market' });

    // Non-overlapping zone point still selects zone
    const zoneHit = findHitAt((z0.gridX + 0.5) * tileSize, (z0.gridY + 0.5) * tileSize, viewport, project, tileSize, visibility);
    expect(zoneHit).toEqual({ type: 'zone', id: z0.id });

    // Landmark point still selects landmark first
    const lmHit = findHitAt((z0.gridX + 4) * tileSize, (z0.gridY + 4) * tileSize, viewport, project, tileSize, visibility);
    expect(lmHit).toEqual({ type: 'landmark', id: 'lm-well' });

    // Empty coordinates outside all bounds still return null
    const emptyHit = findHitAt(-20, -20, viewport, project, tileSize, visibility);
    expect(emptyHit).toBeNull();
  });

  it('keeps Band 1 context deck order and Alt+1..Alt+5 shortcuts unchanged for every hit kind', () => {
    const project = useProjectStore.getState().project;
    const ctx = productionHotkeyContext();
    const bindings = getHotkeyBindingsFromRegistry();

    for (const hit of ALL_KINDS) {
      const expected = getContextDeckCommands(hit);
      const view = buildSpeedPanelView(
        COMMAND_REGISTRY,
        { ...ctx, hit },
        '',
        { pinnedIds: [], macros: [], groups: [], adaptiveHistory: {}, showRecents: true, mode: project.mode ?? 'dungeon', hotkeyBindings: bindings },
      );
      if (view.kind !== 'unsearched') throw new Error('Expected unsearched view');
      expect(view.band1Deck.map((r) => r.command.id)).toEqual(expected.map((c) => c.id));
      expect(view.band1Deck.map((r) => r.deckShortcut)).toEqual(expected.map((_, i) => `Alt+${i + 1}`));
    }
  });

  it('preserves existing Tab behavior for scalar pill open/dismiss and spatial connect kind cycling', () => {
    const project = useProjectStore.getState().project;
    const z0 = project.zones[0];
    const ctx = productionHotkeyContext();
    const view = buildSpeedPanelView(COMMAND_REGISTRY, { ...ctx, hit: { type: 'zone', id: z0.id } }, 'elev', {
      pinnedIds: [], macros: [], groups: [], adaptiveHistory: {}, showRecents: true, mode: project.mode ?? 'dungeon',
    });
    const entries = buildNavigableEntries(view, new Set());
    const elevIdx = entries.findIndex((e) => e.kind === 'row' && e.row.command.id === 'set-elevation');
    expect(elevIdx).toBeGreaterThanOrEqual(0);

    // Tab over Set Elevation opens inline scalar pill
    const opened: string[] = [];
    const dispatched = dispatchSpeedPanelKeyAction(
      { key: 'Tab', code: 'Tab', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null, preventDefault: vi.fn(), stopPropagation: vi.fn() },
      {
        view, allNavigable: entries, activeIdx: elevIdx, closeSpeedPanel: vi.fn(), reorderPin: vi.fn(), setActiveIdx: vi.fn(),
        execute: vi.fn(), runMacro: vi.fn(), openScalarPill: (id) => opened.push(id),
      },
    );
    expect(dispatched).toBe('open-scalar-pill');
    expect(opened).toEqual(['set-elevation']);

    // Tab inside scalar pill dismisses and refocuses search
    const setScalar = vi.fn();
    const refocus = vi.fn();
    expect(
      handleScalarPillKeyDown(
        { key: 'Tab', preventDefault: vi.fn(), stopPropagation: vi.fn() },
        { commandId: 'set-elevation', targetZoneIds: [z0.id], value: '2', error: null },
        { query: 'elev', stepStores: productionStepStores(), setScalarPill: setScalar, recordCommandUsage: vi.fn(), closeSpeedPanel: vi.fn(), refocusSearch: refocus },
      ),
    ).toBe('dismiss');
    expect(setScalar).toHaveBeenCalledWith(null);
    expect(refocus).toHaveBeenCalledTimes(1);

    // Tab inside spatial connect pick mode still cycles connection kind
    const nextPicks: unknown[] = [];
    const spatialHandlers = createCanvasSpatialPickHandlers({
      getPick: () => ({
        commandId: 'connect-from',
        mode: 'connect',
        sourceZoneId: z0.id,
        pickedZoneIds: [],
        connectionKind: 'passage',
        cursorSX: 0,
        cursorSY: 0,
        hoveredZoneId: null,
        invalidReason: null,
        previousTool: 'select',
      }),
      getProject: () => useProjectStore.getState().project,
      findZoneIdAtGrid: () => null,
      setPick: (p) => nextPicks.push(p),
      getStores: productionStepStores,
    });
    expect(spatialHandlers.handleKeyDown({ key: 'Tab', preventDefault: vi.fn(), stopPropagation: vi.fn() })).toBe(true);
    expect(nextPicks.length).toBe(1);

    const onCycle = vi.fn();
    expect(
      dispatchPickOverlayInputKeyDown(
        { key: 'Tab', shiftKey: false, preventDefault: vi.fn(), stopPropagation: vi.fn() },
        { pickMode: 'connect', candidates: [], onCancel: vi.fn(), onCycleKind: onCycle, onPickZone: vi.fn(), clearQuery: vi.fn() },
      ),
    ).toBe('cycle');
    expect(onCycle).toHaveBeenCalledTimes(1);

    // Verify resolveSpeedPanelKeyAction helper still treats Tab cleanly on normal command
    expect(
      resolveSpeedPanelKeyAction(
        { key: 'Tab', code: 'Tab', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null },
        view,
        entries,
        elevIdx,
      ),
    ).toMatchObject({ type: 'open-scalar-pill', commandId: 'set-elevation' });
  });

  it('preserves base findFilteredHitAt context and mounts SpeedPanel without promoting chip 0 across pointer Q, upgrade, and double-right-click', () => {
    const project = makeMultiKindProject();
    const z0 = project.zones[0];
    const z1 = project.zones[1] ?? {
      ...z0,
      id: 'zone-far',
      name: 'Far Zone',
      gridX: 25,
      gridY: 25,
      gridWidth: 8,
      gridHeight: 8,
    };
    if (!project.zones[1]) project.zones.push(z1);
    project.encounterAnchors = [
      { id: 'enc-far', zoneId: z1.id, encounterType: 'combat', enemyIds: [], probability: 1, cooldownTurns: 0, tags: [] },
    ];
    project.connections = [{ fromZoneId: z0.id, toZoneId: z1.id, bidirectional: true }];
    project.marketNodes = [
      { id: 'mkt-1', zoneId: z0.id, supplyCategories: [], priceModifier: 1, contrabandAvailable: false },
    ];
    project.craftingStations = [
      { id: 'st-1', zoneId: z0.id, stationType: 'anvil', availableRecipes: [] },
    ];
    project.hubs = [
      { id: 'hub-1', name: 'Central Hub', zoneId: z0.id, hubType: 'town-center', serviceTypes: [], connectedZoneIds: [], tags: [] },
    ];
    project.strongholds = [
      { id: 'sh-1', name: 'Bastion', zoneId: z0.id, defenseLevel: 2, garrisonEntityIds: [], tags: [] },
    ];
    // Add an overlapping spot where landmark, entity, painted tile, and zone sit under the same cell alongside spawn
    const overlapGridX = z0.gridX + 2;
    const overlapGridY = z0.gridY + 2;
    for (const ep of project.entityPlacements) {
      const ex = ep.gridX ?? (ep.zoneId === z0.id ? z0.gridX + 2 : -1);
      const ey = ep.gridY ?? (ep.zoneId === z0.id ? z0.gridY + 2 : -1);
      if (ep.zoneId === z0.id && ex === overlapGridX && ey === overlapGridY) {
        ep.gridX = z0.gridX + 1;
        ep.gridY = z0.gridY + 1;
      }
    }
    project.entityPlacements.push({ entityId: 'npc-overlap', name: 'Guard', role: 'npc', zoneId: z0.id, gridX: overlapGridX, gridY: overlapGridY });
    project.landmarks.push({ id: 'lm-overlap', zoneId: z0.id, name: 'Shrine', gridX: overlapGridX, gridY: overlapGridY, tags: [], interactionType: 'inspect' });
    useProjectStore.getState().loadProject(project);
    useProjectStore.getState().addTileLayer({ id: 'layer-floor', name: 'Floor', zIndex: 0, tiles: [] });
    useProjectStore.getState().addTilePlacement('layer-floor', { tileId: 'stone', gridX: overlapGridX, gridY: overlapGridY });
    useProjectStore.getState().addTilePlacement('layer-floor', { tileId: 'stone', gridX: z0.gridX + 1, gridY: z0.gridY + 8 });

    const curProject = useProjectStore.getState().project;
    const paintedTileNear = curProject.tileLayers![0].tiles.find((t) => t.gridX === z0.gridX + 1 && t.gridY === z0.gridY + 8)!;
    const tileSize = curProject.map.tileSize;
    const viewport = { panX: 0, panY: 0, zoom: 1 };
    const visibility = {
      showEntities: true,
      showLandmarks: true,
      showSpawns: true,
      showConnections: true,
      showTown: true,
      showProps: true,
      showTiles: true,
      showItems: true,
    };
    const markers = collectTownMarkers(curProject, tileSize);
    const ptOf = (t: string) => {
      const m = markers.find((mk) => mk.type === t)!;
      return m.w != null && m.h != null ? { sx: m.x + m.w / 2, sy: m.y + m.h / 2 } : { sx: m.x, sy: m.y };
    };
    const z0Center = { sx: (z0.gridX + z0.gridWidth / 2) * tileSize, sy: (z0.gridY + z0.gridHeight / 2) * tileSize };
    const z1Center = { sx: (z1.gridX + z1.gridWidth / 2) * tileSize, sy: (z1.gridY + z1.gridHeight / 2) * tileSize };

    const makeHandlersFor = (getPt: () => { sx: number; sy: number }) => {
      let gestureState = { rightButtonDown: false, rightPressStart: null as null | { sx: number; sy: number; pointerId: number; t: number }, lastRightUp: null as null | { sx: number; sy: number; t: number }, dragging: false };
      let menuState: { x: number; y: number; hit: HitResult | null; actions: Array<{ id: string; label: string; icon: string }> } | null = null;
      let now = 1000;
      const filterSingle = (hit: HitResult | null): HitResult | null =>
        hit && !useEditorStore.getState().hiddenIds.has(hit.id) ? hit : null;
      const filterList = (hits: HitResult[]): HitResult[] =>
        hits.filter((h) => !useEditorStore.getState().hiddenIds.has(h.id));
      return {
        advanceTime: (ms: number) => { now += ms; },
        handlers: createCanvasRightPointerHandlers({
          isMacPlatform: () => false,
          nowFn: () => now,
          getScreenXY: getPt,
          getViewport: () => viewport,
          setViewport: () => {},
          getOptions: () => ({ ...DEFAULT_SPEED_PANEL_OPTIONS }),
          findFilteredHitAt: (x: number, y: number) => filterSingle(findHitAt(x, y, viewport, curProject, tileSize, visibility)),
          findFilteredHitsAt: (x: number, y: number) => filterList(findAllHitsAt(x, y, viewport, curProject, tileSize, visibility)),
          getMenuActionsForHit: () => [{ id: 'edit-props', label: 'Edit Properties', icon: '\u270E' }],
          openSpeedPanel: useEditorStore.getState().openSpeedPanel,
          getContextMenu: () => menuState,
          setContextMenu: (m: typeof menuState) => { menuState = m; },
          getGestureState: () => gestureState,
          setGestureState: (s: typeof gestureState) => { gestureState = s; },
          getRightPanStart: () => null,
          setRightPanStart: () => {},
          getLastRightMoveEvent: () => null,
          setLastRightMoveEvent: () => {},
          setSuppressNextLeftMouseUp: () => {},
          setSuppressNextCanvasContextMenu: () => {},
          getContextMenuHandledInPress: () => false,
          setContextMenuHandledInPress: () => {},
          setLastPointer: () => {},
          getLastPointer: getPt,
          setPointerOverCanvas: () => {},
          getPointerOverCanvas: () => true,
          setLastPointerRegion: () => {},
          getLastPointerRegion: () => 'canvas',
          setLastPointerStamp: () => {},
          getLastPointerStamp: () => now,
          getLastCanvasFocusStamp: () => 0,
          getCanvasFocusedNow: () => false,
          getCanvasSize: () => ({ w: 800, h: 600 }),
          getEditorEnv: () => ({
            activeModal: null, showSearch: false, showSpeedPanel: false, activeElement: null,
            selection: useEditorStore.getState().selection, selectedConnection: null, project: curProject, tileSize,
          }),
        } as never),
      };
    };

    // 1) All 14 hit kinds + empty canvas match base filterSingle(findHitAt(...)) through pointer Q open
    const targets: Array<{ expected: HitResult | null; sx: number; sy: number }> = [
      { expected: { type: 'spawn', id: curProject.spawnPoints[0].id }, sx: curProject.spawnPoints[0].gridX * tileSize, sy: curProject.spawnPoints[0].gridY * tileSize },
      { expected: { type: 'encounter', id: 'enc-far' }, sx: z1Center.sx, sy: z1Center.sy },
      { expected: { type: 'landmark', id: 'lm-well' }, sx: (z0.gridX + 4) * tileSize, sy: (z0.gridY + 4) * tileSize },
      { expected: { type: 'item', id: 'item-potion' }, sx: (z0.gridX + 5) * tileSize, sy: (z0.gridY + 5) * tileSize },
      { expected: { type: 'market', id: 'mkt-1' }, ...ptOf('market') },
      { expected: { type: 'station', id: 'st-1' }, ...ptOf('station') },
      { expected: { type: 'building', id: 'bld-tavern' }, ...ptOf('building') },
      { expected: { type: 'hub', id: 'hub-1' }, ...ptOf('hub') },
      { expected: { type: 'stronghold', id: 'sh-1' }, ...ptOf('stronghold') },
      { expected: { type: 'entity', id: 'npc-market' }, sx: (z0.gridX + 3) * tileSize, sy: (z0.gridY + 2) * tileSize },
      { expected: { type: 'connection', id: `${z0.id}::${z1.id}` }, sx: (z0Center.sx + z1Center.sx) / 2, sy: (z0Center.sy + z1Center.sy) / 2 },
      { expected: { type: 'prop', id: 'prop-crate' }, sx: (z0.gridX + 6) * tileSize, sy: (z0.gridY + 2) * tileSize },
      { expected: { type: 'tile', id: paintedTileNear.id! }, sx: (z0.gridX + 1.5) * tileSize, sy: (z0.gridY + 8.5) * tileSize },
      { expected: { type: 'zone', id: z0.id }, sx: (z0.gridX + 0.5) * tileSize, sy: (z0.gridY + 0.5) * tileSize },
      { expected: null, sx: -50, sy: -50 },
    ];

    for (const tc of targets) {
      useEditorStore.getState().closeSpeedPanel();
      const { handlers } = makeHandlersFor(() => ({ sx: tc.sx, sy: tc.sy }));
      const triggered = handlers.handleSpeedPanelKeyTrigger({
        key: 'q', code: 'KeyQ', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
        repeat: false, isComposing: false, target: null, preventDefault: () => {}, stopPropagation: () => {},
      });
      expect(triggered).toBe(true);
      expect(useEditorStore.getState().speedPanelContext).toEqual(tc.expected);
    }

    // 2) Overlapping point with hidden top hit (`sp-default`) across pointer Q, right-click upgrade, and double-right-click:
    //    real findAllHitsAt returns [lm-overlap, npc-overlap, paintedTile, zone], so chip 0 is lm-overlap while base findFilteredHitAt is null (Canvas).
    useEditorStore.getState().toggleHidden(curProject.spawnPoints[0].id);
    const ox = overlapGridX * tileSize;
    const oy = overlapGridY * tileSize;
    const openWays: Array<() => void> = [
      () => {
        const { handlers } = makeHandlersFor(() => ({ sx: ox, sy: oy }));
        handlers.handleSpeedPanelKeyTrigger({
          key: 'q', code: 'KeyQ', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
          repeat: false, isComposing: false, target: null, preventDefault: () => {}, stopPropagation: () => {},
        });
      },
      () => {
        const { handlers } = makeHandlersFor(() => ({ sx: ox, sy: oy }));
        handlers.openObjectContextMenu(ox, oy);
        handlers.upgradeContextMenuToSpeedPanel();
      },
      () => {
        const { handlers, advanceTime } = makeHandlersFor(() => ({ sx: ox, sy: oy }));
        const rightEvt = { button: 2, clientX: ox, clientY: oy, pointerId: 1, pointerType: 'mouse', preventDefault: () => {}, stopPropagation: () => {} };
        handlers.startRightPointer(rightEvt);
        advanceTime(30);
        handlers.finishRightPointer(rightEvt);
        advanceTime(60);
        handlers.startRightPointer(rightEvt);
        advanceTime(30);
        handlers.finishRightPointer(rightEvt);
      },
    ];

    for (const triggerOpen of openWays) {
      resetHooks();
      useEditorStore.getState().closeSpeedPanel();
      triggerOpen();
      expect(useEditorStore.getState().showSpeedPanel).toBe(true);
      expect(useEditorStore.getState().speedPanelHits.map((h) => h.type)).toEqual(['landmark', 'entity', 'tile', 'zone']);
      expect(useEditorStore.getState().speedPanelContext).toBeNull();

      hookIdx = 0;
      const tree = expandNodes(createElement(SpeedPanel, {}));
      flushEffects();
      const chips = collectCompatNodes(tree, (el) => typeof el.props['data-testid'] === 'string' && (el.props['data-testid'] as string).startsWith('wf-sp-scope-chip-'));
      expect(chips.length).toBe(5);
      expect(chips[0].props['data-testid']).toBe('wf-sp-scope-chip-landmark:lm-overlap');
      expect(chips[0].props['aria-pressed']).toBe(false);
      expect(chips[4].props['data-testid']).toBe('wf-sp-scope-chip-canvas');
      expect(chips[4].props['aria-pressed']).toBe(true);
    }
  });
});
