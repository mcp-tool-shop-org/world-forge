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
import { createCanvasRightPointerHandlers } from '../speed-panel-gesture.js';
import { DEFAULT_SPEED_PANEL_OPTIONS } from '../store/speed-panel-options-store.js';
import { collectTownMarkers } from '../town-markers.js';
import { findHitAt, type HitResult } from '../hit-testing.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';

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
    useProjectStore.getState().loadProject(makeMultiKindProject());
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().closeSpeedPanel();
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [] });
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

  it('opens through the pointer-key open path matching findFilteredHitAt across every hit kind and empty canvas', () => {
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
    project.tileLayers = [
      { id: 'layer-floor', name: 'Floor', zIndex: 0, tiles: [{ id: 'tile-floor', tileId: 'stone', gridX: z0.gridX + 1, gridY: z0.gridY + 8 }] },
    ];
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
    useProjectStore.getState().loadProject(project);

    const tileSize = project.map.tileSize;
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
    const markers = collectTownMarkers(project, tileSize);
    const ptOf = (t: string) => {
      const m = markers.find((mk) => mk.type === t)!;
      return m.w != null && m.h != null ? { sx: m.x + m.w / 2, sy: m.y + m.h / 2 } : { sx: m.x, sy: m.y };
    };
    const z0Center = { sx: (z0.gridX + z0.gridWidth / 2) * tileSize, sy: (z0.gridY + z0.gridHeight / 2) * tileSize };
    const z1Center = { sx: (z1.gridX + z1.gridWidth / 2) * tileSize, sy: (z1.gridY + z1.gridHeight / 2) * tileSize };

    const targets: Array<{ expected: HitResult | null; sx: number; sy: number }> = [
      { expected: { type: 'spawn', id: project.spawnPoints[0].id }, sx: project.spawnPoints[0].gridX * tileSize, sy: project.spawnPoints[0].gridY * tileSize },
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
      { expected: { type: 'tile', id: 'tile-floor' }, sx: (z0.gridX + 1.5) * tileSize, sy: (z0.gridY + 8.5) * tileSize },
      { expected: { type: 'zone', id: z0.id }, sx: (z0.gridX + 0.5) * tileSize, sy: (z0.gridY + 0.5) * tileSize },
      { expected: null, sx: -50, sy: -50 },
    ];

    for (const tc of targets) {
      let curPt = { sx: tc.sx, sy: tc.sy };
      const findFilteredHitAt = (x: number, y: number) => findHitAt(x, y, viewport, project, tileSize, visibility);
      const expectedFiltered = findFilteredHitAt(tc.sx, tc.sy);
      expect(expectedFiltered).toEqual(tc.expected);

      useEditorStore.getState().closeSpeedPanel();
      const handlers = createCanvasRightPointerHandlers({
        isMacPlatform: () => false,
        getScreenXY: () => curPt,
        getViewport: () => viewport,
        setViewport: () => {},
        getOptions: () => ({ ...DEFAULT_SPEED_PANEL_OPTIONS }),
        findFilteredHitAt,
        findFilteredHitsAt: () => (expectedFiltered ? [expectedFiltered] : []),
        getMenuActionsForHit: () => [],
        openSpeedPanel: useEditorStore.getState().openSpeedPanel,
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
        setLastPointer: (pt: { sx: number; sy: number }) => { curPt = pt; },
        getLastPointer: () => curPt,
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

      const triggered = handlers.handleSpeedPanelKeyTrigger({
        key: 'q', code: 'KeyQ', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
        repeat: false, isComposing: false, target: null, preventDefault: () => {}, stopPropagation: () => {},
      });
      expect(triggered).toBe(true);
      expect(useEditorStore.getState().speedPanelContext).toEqual(expectedFiltered);
    }
  });
});
