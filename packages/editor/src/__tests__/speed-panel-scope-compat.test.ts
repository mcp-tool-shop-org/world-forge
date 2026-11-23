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
});
