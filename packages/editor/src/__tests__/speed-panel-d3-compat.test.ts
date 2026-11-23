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

import {
  presentationAdvisories,
  scanDependencies,
  validateProject,
} from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import {
  COMMAND_REGISTRY,
  getContextDeckCommands,
  getHotkeyBindingsFromRegistry,
} from '../command-registry.js';
import { buildSpeedPanelView } from '../speed-panel-layout.js';
import { productionHotkeyContext } from '../panels/speed-panel-stores.js';
import { repairsForEdge } from '../repairs.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';
import type { HitResult } from '../hit-testing.js';

const CONTEXT_SAMPLES: Array<HitResult | null> = [
  null,
  { type: 'zone', id: 'zone-entrance' },
  { type: 'entity', id: 'npc-1' },
  { type: 'landmark', id: 'lm-1' },
  { type: 'encounter', id: 'enc-1' },
  { type: 'connection', id: 'zone-a::zone-b' },
];

describe('Speed Panel Band 1 Deck & Analysis Compatibility', () => {
  beforeEach(() => {
    storage.clear();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [] });
  });

  it('keeps unsearched Band 1 deck slot order and Alt+1..Alt+5 shortcuts intact across hit contexts', () => {
    const project = useProjectStore.getState().project;
    const ctx = productionHotkeyContext();
    const expectedBindings = getHotkeyBindingsFromRegistry();
    expect(expectedBindings.length).toBeGreaterThan(0);

    for (const hit of CONTEXT_SAMPLES) {
      const expectedDeck = getContextDeckCommands(hit);

      const view = buildSpeedPanelView(
        COMMAND_REGISTRY,
        { ...ctx, hit },
        '',
        {
          pinnedIds: [],
          macros: [],
          groups: [],
          adaptiveHistory: {},
          showRecents: true,
          mode: project.mode ?? 'dungeon',
          hotkeyBindings: expectedBindings,
        },
      );

      expect(view.kind).toBe('unsearched');
      if (view.kind !== 'unsearched') continue;
      expect(view.band1Deck.map((r) => r.command.id)).toEqual(expectedDeck.map((c) => c.id));
      expect(view.band1Deck.map((r) => r.deckShortcut)).toEqual(
        expectedDeck.map((_, i) => `Alt+${i + 1}`),
      );
    }
  });

  it('preserves validateProject, scanDependencies, presentationAdvisories, and DependencyPanel repair undo convention', () => {
    const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold');
    expect(chapel).toBeDefined();
    if (!chapel) return;

    const cleanProject = structuredClone(chapel.project);
    expect(validateProject(cleanProject).valid).toBe(true);
    expect(scanDependencies(cleanProject).summary.broken).toBe(0);
    expect(presentationAdvisories(cleanProject)).toEqual([]);

    // Introduce a broken zone asset ref alongside a presentation mismatch and broken exit
    const brokenProject = structuredClone(minimalProject);
    const baseZoneId = brokenProject.zones[0].id;
    brokenProject.zones[0] = {
      ...brokenProject.zones[0],
      backgroundId: 'missing-bg-asset',
      exits: [{ targetZoneId: 'ghost-zone', label: 'Bad Exit' }],
    };
    brokenProject.presentation = {
      view: 'dimetric-2:1',
      tile: [256, 128],
      span: 3,
      zoneCells: { [baseZoneId]: [2, 2] },
      occupancy: [
        { id: 'ghost-actor', character: 'ghost', zone: baseZoneId, cell: [2, 2], facing: 'front' },
      ],
    };

    const valResult = validateProject(brokenProject);
    expect(valResult.valid).toBe(false);
    expect(valResult.errors.some((e) => e.path === `zones.${baseZoneId}.exits`)).toBe(true);

    const depSummary = scanDependencies(brokenProject);
    const brokenBgEdge = depSummary.edges.find(
      (e) => e.sourceType === 'zone' && e.sourceId === baseZoneId && e.targetId === 'missing-bg-asset',
    );
    expect(brokenBgEdge).toBeDefined();

    const presMessages = presentationAdvisories(brokenProject);
    expect(presMessages).toContain('presentation: no player row in occupancy');

    const repairs = brokenBgEdge ? repairsForEdge(brokenBgEdge, brokenProject) : [];
    expect(repairs.length).toBeGreaterThan(0);

    useProjectStore.getState().loadProject(structuredClone(brokenProject));
    const repair = repairs[0];
    useProjectStore.getState().updateProject(repair.apply, `Repair: ${repair.label}`);

    const afterState = useProjectStore.getState();
    expect(afterState.project.zones[0].backgroundId).toBeUndefined();
    expect(afterState.undoStack.at(-1)?.label).toBe(`Repair: ${repair.label}`);
  });
});
