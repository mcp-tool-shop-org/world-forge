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
import {
  presentationAdvisories,
  scanDependencies,
  validateProject,
  type WorldProject,
} from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import {
  buildProjectProblemSnapshot,
  buildQuickFixRowView,
  buildQuickFixStepView,
  formatQuickFixTargetLabel,
  getProblemsForObject,
  getProjectProblemSnapshot,
  openQuickFixFlow,
  selectQuickFixOption,
  selectQuickFixTarget,
  stepBackQuickFixFlow,
  type QuickFixTarget,
} from '../speed-panel-quick-fix.js';
import { buildSpeedPanelView } from '../speed-panel-layout.js';
import {
  buildNavigableEntries,
  clampActiveIndex,
  createSpeedPanelCallbacks,
  dispatchSpeedPanelKeyAction,
  getInitialActiveIndex,
  resolveSpeedPanelKeyAction,
} from '../speed-panel-ui.js';
import { COMMAND_REGISTRY, getCommandById } from '../command-registry.js';
import type { SpeedPanelMacro } from '../speed-panel-actions.js';
import { executeMacro, executeRegistryCommand, buildExecuteStores } from '../speed-panel-execute.js';
import {
  productionExecuteStores,
  productionHotkeyContext,
  productionStepStores,
} from '../panels/speed-panel-stores.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import { repairsForEdge } from '../repairs.js';
import { parseKitBundle } from '../kits/bundle.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import {
  formatSpeedPanelLoadNotice,
  loadSpeedPanelStateV2,
  notifySpeedPanelLoadWarnings,
  sanitizeMacros,
  SPEED_PANEL_STATE_V2_KEY,
  useSpeedPanelPins,
} from '../store/speed-panel-store.js';

function makeComplexProblemProject(): WorldProject {
  const p = structuredClone(minimalProject);
  const templateZone = {
    ...p.zones[0],
    neighbors: [],
    exits: [],
    parentDistrictId: 'd1',
  };
  const z1 = {
    ...templateZone,
    id: 'z1',
    name: 'Entry Hall',
    exits: [{ targetZoneId: 'missing-exit-zone', label: 'Broken Exit' }],
  }; // validateProject error on zones.z1.exits
  const z2 = { ...templateZone, id: 'z2', name: 'Side Vault', backgroundId: 'missing-zone-bg' };
  const zClean = { ...templateZone, id: 'z-clean', name: 'Quiet Shrine' };
  p.zones = [z1, z2, zClean];
  p.districts = [
    {
      ...p.districts[0],
      id: 'd1',
      name: 'Broken District',
      zoneIds: ['z1', 'missing-zone-in-dist'],
    },
  ];
  p.entityPlacements = [
    {
      entityId: 'npc-broken',
      name: 'Keeper',
      zoneId: 'z1',
      role: 'npc',
      portraitId: 'missing-portrait',
    },
    {
      entityId: 'npc-dup',
      name: 'Guard',
      zoneId: 'z1',
      role: 'npc',
    },
  ];
  p.landmarks = [
    {
      id: 'lm-broken',
      name: 'Altar',
      zoneId: 'missing-lm-zone',
      gridX: 2,
      gridY: 2,
      tags: [],
      interactionType: 'inspect',
    },
  ];
  p.encounterAnchors = [
    {
      id: 'enc-broken',
      zoneId: 'missing-enc-zone',
      encounterType: 'ambush',
      enemyIds: ['slime'],
      probability: 0.5,
      cooldownTurns: 2,
      tags: [],
    },
  ];
  p.connections = [
    {
      fromZoneId: 'z1',
      toZoneId: 'missing-conn-target',
      bidirectional: true,
      kind: 'passage',
    },
  ];
  p.spawnPoints = [{ id: 'sp-1', zoneId: 'z1', gridX: 2, gridY: 2, isDefault: true }];
  p.presentation = {
    view: 'dimetric-2:1',
    tile: [256, 128],
    span: 3,
    zoneCells: { z1: [1, 1], 'orphan-zone-cell': [9, 9] },
    floor: { 'orphan-floor-key': 'stone' },
    occupancy: [
      { id: 'npc-dup', character: 'guard', zone: 'z2', cell: [99, 99], facing: 'front' },
      { id: 'npc-dup', character: 'guard', zone: 'z1', cell: [1, 1], facing: 'front' },
    ],
  };
  return p;
}

describe('Speed Panel Quick Fix Row & Problem Attribution', () => {
  beforeEach(() => {
    storage.clear();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().setRightTab('issues');
    useEditorStore.getState().setRightCollapsed(false);
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [] });
  });

  it('collects verbatim problems from validateProject, scanDependencies, and presentationAdvisories per object and omits ID-less messages', () => {
    const project = makeComplexProblemProject();
    const rawValErrors = validateProject(project).errors;
    const rawDeps = scanDependencies(project).edges.filter((e) => e.status !== 'ok' && e.status !== 'informational');
    const rawPres = presentationAdvisories(project);

    // Zone z1: validation (light) + presentation advisory ('z1')
    const z1Problems = getProblemsForObject(project, { type: 'zone', id: 'z1' });
    expect(z1Problems.some((p) => p.source === 'validate' && rawValErrors.some((e) => e.message === p.message))).toBe(true);
    expect(z1Problems.some((p) => p.source === 'presentation' && rawPres.includes(p.message))).toBe(true);

    // Zone z2: broken background dependency with clear repair + presentation ('z2' missing anchor / drawn-in drift)
    const z2Problems = getProblemsForObject(project, { type: 'zone', id: 'z2' });
    const z2Dep = z2Problems.find((p) => p.source === 'dependencies');
    expect(z2Dep?.message).toBe(rawDeps.find((e) => e.sourceId === 'z2')?.message);
    expect(z2Dep?.repairs.length).toBeGreaterThan(0);
    expect(z2Problems.some((p) => p.source === 'presentation' && p.message.includes(`zone 'z2'`))).toBe(true);

    // Entity npc-broken: dependency broken portrait
    const entProblems = getProblemsForObject(project, { type: 'entity', id: 'npc-broken' });
    expect(entProblems.map((p) => p.source)).toContain('dependencies');

    // Entity npc-dup: presentation duplicate actor id + no anchor + outside span + sim placement drift
    const dupProblems = getProblemsForObject(project, { type: 'entity', id: 'npc-dup' });
    expect(dupProblems.some((p) => p.source === 'presentation' && p.message === `presentation: duplicate actor id 'npc-dup'`)).toBe(true);
    expect(dupProblems.some((p) => p.source === 'presentation' && p.message.includes(`drawn in 'z2' but the sim places it in 'z1'`))).toBe(true);

    // Landmark, Encounter, Connection, District
    const lmProblems = getProblemsForObject(project, { type: 'landmark', id: 'lm-broken' });
    expect(lmProblems.some((p) => p.source === 'validate')).toBe(true);

    const encProblems = getProblemsForObject(project, { type: 'encounter', id: 'enc-broken' });
    expect(encProblems.some((p) => p.source === 'validate')).toBe(true);

    const connProblems = getProblemsForObject(project, { type: 'connection', id: 'z1::missing-conn-target' });
    expect(connProblems.some((p) => p.source === 'validate')).toBe(true);
    expect(connProblems.some((p) => p.source === 'dependencies')).toBe(true);

    const distProblems = getProblemsForObject(project, { type: 'district', id: 'd1' });
    expect(distProblems.some((p) => p.source === 'validate')).toBe(true);

    // ID-less messages (Rule 4 missing player, unknown zone key in zoneCells/floor, map dims) must not attribute to z-clean or z1
    const cleanProblems = getProblemsForObject(project, { type: 'zone', id: 'z-clean' });
    expect(cleanProblems).toEqual([]);
    expect(getProblemsForObject(project, null)).toEqual([]);

    const noPlayerMsg = 'presentation: no player row in occupancy';
    expect(rawPres).toContain(noPlayerMsg);
    expect(z1Problems.some((p) => p.message === noPlayerMsg)).toBe(false);
    expect(cleanProblems.some((p) => p.message === noPlayerMsg)).toBe(false);

    const mapBrokenProject = structuredClone(minimalProject);
    mapBrokenProject.map = { ...mapBrokenProject.map, gridWidth: 0 };
    mapBrokenProject.spawnPoints = [];
    const zoneOnBrokenMap = getProblemsForObject(mapBrokenProject, { type: 'zone', id: mapBrokenProject.zones[0].id });
    expect(zoneOnBrokenMap).toEqual([]);
  });

  it('shows Quick Fix row only when >= 1 problem exists without shifting Band 1 deck or Alt+1..Alt+5 shortcuts', () => {
    const project = makeComplexProblemProject();
    useProjectStore.getState().loadProject(project);
    const ctx = productionHotkeyContext();

    const hitBroken: QuickFixTarget = { type: 'zone', id: 'z2' };
    const hitClean: QuickFixTarget = { type: 'zone', id: 'z-clean' };
    const brokenProblems = getProblemsForObject(project, hitBroken);
    const cleanProblems = getProblemsForObject(project, hitClean);

    expect(buildQuickFixRowView(cleanProblems)).toBeNull();
    const singleRow = buildQuickFixRowView([brokenProblems[0]]);
    expect(singleRow).toEqual({
      count: 1,
      label: 'Quick Fix',
      countLabel: '1 problem',
      problems: [brokenProblems[0]],
    });
    const multiRow = buildQuickFixRowView(brokenProblems);
    expect(multiRow?.count).toBe(brokenProblems.length);
    expect(multiRow?.countLabel).toBe(`${brokenProblems.length} problems`);

    const viewWithFix = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...ctx, hit: { type: 'zone', id: 'z2' } },
      '',
      {
        pinnedIds: [],
        macros: [],
        groups: [],
        adaptiveHistory: {},
        showRecents: true,
        mode: project.mode ?? 'dungeon',
        quickFixProblems: brokenProblems,
      },
    );
    const viewWithoutFix = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...ctx, hit: { type: 'zone', id: 'z-clean' } },
      '',
      {
        pinnedIds: [],
        macros: [],
        groups: [],
        adaptiveHistory: {},
        showRecents: true,
        mode: project.mode ?? 'dungeon',
        quickFixProblems: cleanProblems,
      },
    );

    expect(viewWithFix.kind).toBe('unsearched');
    expect(viewWithoutFix.kind).toBe('unsearched');
    if (viewWithFix.kind !== 'unsearched' || viewWithoutFix.kind !== 'unsearched') {
      throw new Error('Expected unsearched views');
    }

    expect(viewWithFix.quickFix?.label).toBe('Quick Fix');
    expect(viewWithoutFix.quickFix).toBeUndefined();
    expect(viewWithFix.band1Deck.map((r) => r.command.id)).toEqual(viewWithoutFix.band1Deck.map((r) => r.command.id));
    expect(viewWithFix.band1Deck.map((r) => r.deckShortcut)).toEqual(viewWithoutFix.band1Deck.map((r) => r.deckShortcut));

    const entriesWithFix = buildNavigableEntries(viewWithFix, new Set());
    expect(entriesWithFix[0]).toMatchObject({ kind: 'quick-fix', domId: 'wf-sp-opt-quick-fix' });
    expect(entriesWithFix[1]).toMatchObject({ kind: 'row', domId: expect.stringContaining('wf-sp-opt-b1-0-') });
    const enterKey = { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null };
    expect(resolveSpeedPanelKeyAction(enterKey, viewWithFix, entriesWithFix, 0)).toEqual({
      type: 'open-quick-fix',
      quickFix: viewWithFix.quickFix!,
    });
    const openedQuickFix = vi.fn();
    expect(
      dispatchSpeedPanelKeyAction(
        { ...enterKey, preventDefault: vi.fn(), stopPropagation: vi.fn() },
        {
          view: viewWithFix,
          allNavigable: entriesWithFix,
          activeIdx: 0,
          closeSpeedPanel: vi.fn(),
          reorderPin: vi.fn(),
          setActiveIdx: vi.fn(),
          execute: vi.fn(),
          runMacro: vi.fn(),
          openQuickFix: openedQuickFix,
        },
      ),
    ).toBe('open-quick-fix');
    expect(openedQuickFix).toHaveBeenCalledWith(viewWithFix.quickFix);

    // SSR check of Quick Fix row presence vs absence
    useEditorStore.setState({
      speedPanelPosition: { x: 100, y: 100 },
      speedPanelContext: { type: 'zone', id: 'z2' },
    });
    const htmlWithFix = renderToStaticMarkup(createElement(SpeedPanel));
    expect(htmlWithFix).toContain('data-testid="wf-sp-quick-fix-row"');
    expect(htmlWithFix).toContain('data-testid="wf-sp-quick-fix-count"');

    useEditorStore.setState({
      speedPanelPosition: { x: 100, y: 100 },
      speedPanelContext: { type: 'zone', id: 'z-clean' },
    });
    const htmlClean = renderToStaticMarkup(createElement(SpeedPanel));
    expect(htmlClean).not.toContain('data-testid="wf-sp-quick-fix-row"');
  });

  it('applies repairs with exact DependencyPanel project and undo parity, navigates Show in tabs cleanly, and cancels on Esc', () => {
    const baseProject = makeComplexProblemProject();
    const target: QuickFixTarget = { type: 'zone', id: 'z2' };
    const problems = getProblemsForObject(baseProject, target);
    const depProblem = problems.find((p) => p.source === 'dependencies' && p.repairs.length > 0);
    expect(depProblem).toBeDefined();
    if (!depProblem || !depProblem.edge) {
      throw new Error('Expected a repairable dependency problem on zone z2');
    }

    // 1) Reference result via DependencyPanel's direct pattern
    useProjectStore.getState().loadProject(structuredClone(baseProject));
    const directRepair = repairsForEdge(depProblem.edge, baseProject)[0];
    useProjectStore.getState().updateProject(directRepair.apply, `Repair: ${directRepair.label}`);
    const handProject = structuredClone(useProjectStore.getState().project);
    const handUndoLabel = useProjectStore.getState().undoStack.at(-1)?.label;

    // 2) Same operation via Quick Fix flow
    useProjectStore.getState().loadProject(structuredClone(baseProject));
    let flow = openQuickFixFlow(target, problems, baseProject);
    const step1 = buildQuickFixStepView(flow);
    expect(step1.stepStack.steps[0].stepId).toBe('quick-fix-list');

    // Test SSR Step 1 and Step 2 views
    useEditorStore.setState({ speedPanelPosition: { x: 80, y: 80 }, speedPanelContext: { type: 'zone', id: 'z2' } });
    const step1Html = renderToStaticMarkup(createElement(SpeedPanel, { initialQuickFixFlow: flow }));
    expect(step1Html).toContain('data-testid="wf-sp-step-view"');

    const closeMock = vi.fn();
    selectQuickFixOption(
      flow,
      { id: depProblem.id, label: depProblem.message, kind: 'option' },
      {
        stores: {
          ...useEditorStore.getState(),
          project: useProjectStore.getState().project,
          updateProject: useProjectStore.getState().updateProject,
        },
        setQuickFixFlow: (next) => { if (next) flow = next; },
        closeSpeedPanel: closeMock,
      },
    );
    expect(flow.selectedProblemId).toBe(depProblem.id);
    const step2 = buildQuickFixStepView(flow);
    expect(step2.stepStack.steps.map((s) => s.stepId)).toEqual(['quick-fix-list', 'quick-fix-actions']);
    const actionStep = step2.stepStack.steps[1];
    expect(actionStep.kind).toBe('choice');
    if (actionStep.kind === 'choice') {
      expect(actionStep.options.map((o) => o.label)).toContain(depProblem.repairs[0].label);
      expect(actionStep.options.map((o) => o.label)).toContain('Show in Deps');
    }

    const step2Html = renderToStaticMarkup(createElement(SpeedPanel, { initialQuickFixFlow: flow }));
    expect(step2Html).toContain(depProblem.repairs[0].label);

    // Step back from Step 2 -> Step 1 leaves project untouched
    const refocusSpy = vi.fn();
    stepBackQuickFixFlow(flow, {
      setQuickFixFlow: (next) => { flow = next ?? flow; },
      refocusSearch: refocusSpy,
    });
    expect(flow.selectedProblemId).toBeNull();
    stepBackQuickFixFlow(flow, {
      setQuickFixFlow: (next) => { if (next === null) flow = { ...flow }; },
      refocusSearch: refocusSpy,
    });
    expect(refocusSpy).toHaveBeenCalledTimes(1);

    // Select repair option on Step 2
    flow = { ...openQuickFixFlow(target, problems, baseProject), selectedProblemId: depProblem.id };
    const applied = selectQuickFixOption(
      flow,
      { id: 'repair:0', label: depProblem.repairs[0].label, kind: 'option' },
      {
        stores: {
          ...useEditorStore.getState(),
          project: useProjectStore.getState().project,
          updateProject: useProjectStore.getState().updateProject,
        },
        setQuickFixFlow: () => {},
        closeSpeedPanel: closeMock,
      },
    );
    expect(applied).toBe(true);
    expect(closeMock).toHaveBeenCalled();
    expect(useProjectStore.getState().project).toEqual(handProject);
    expect(useProjectStore.getState().undoStack.at(-1)?.label).toBe(handUndoLabel);

    // 3) Show in Issues / Deps / Review opens right tab, uncollapses sidebar, and selects object
    const z1Val = getProblemsForObject(baseProject, { type: 'zone', id: 'z1' }).find((p) => p.source === 'validate')!;
    const z1Pres = getProblemsForObject(baseProject, { type: 'zone', id: 'z1' }).find((p) => p.source === 'presentation')!;
    const lmProblems = getProblemsForObject(baseProject, { type: 'landmark', id: 'lm-broken' });
    const encProblems = getProblemsForObject(baseProject, { type: 'encounter', id: 'enc-broken' });
    const connProblems = getProblemsForObject(baseProject, { type: 'connection', id: 'z1::missing-conn-target' });
    const distProblems = getProblemsForObject(baseProject, { type: 'district', id: 'd1' });

    const navCases: Array<{ t: QuickFixTarget; p: typeof z1Val; expectedTab: 'issues' | 'deps' | 'review'; checkSel: () => boolean }> = [
      { t: { type: 'zone', id: 'z1' }, p: z1Val, expectedTab: 'issues', checkSel: () => useEditorStore.getState().selection.zones.includes('z1') },
      { t: { type: 'zone', id: 'z1' }, p: z1Pres, expectedTab: 'review', checkSel: () => useEditorStore.getState().selection.zones.includes('z1') },
      { t: { type: 'entity', id: 'npc-broken' }, p: getProblemsForObject(baseProject, { type: 'entity', id: 'npc-broken' }).find((p) => p.source === 'dependencies')!, expectedTab: 'deps', checkSel: () => useEditorStore.getState().selection.entities.includes('npc-broken') },
      { t: { type: 'landmark', id: 'lm-broken' }, p: lmProblems[0], expectedTab: 'issues', checkSel: () => useEditorStore.getState().selection.landmarks.includes('lm-broken') },
      { t: { type: 'encounter', id: 'enc-broken' }, p: encProblems[0], expectedTab: 'issues', checkSel: () => useEditorStore.getState().selection.encounters.includes('enc-broken') },
      { t: { type: 'connection', id: 'z1::missing-conn-target' }, p: connProblems.find((c) => c.source === 'dependencies')!, expectedTab: 'deps', checkSel: () => useEditorStore.getState().selectedConnection?.from === 'z1' },
      { t: { type: 'district', id: 'd1' }, p: distProblems[0], expectedTab: 'issues', checkSel: () => useEditorStore.getState().selection.zones.includes('z1') },
    ];

    useProjectStore.getState().loadProject(structuredClone(baseProject));
    for (const nc of navCases) {
      useEditorStore.getState().clearSelection();
      useEditorStore.getState().setRightCollapsed(true);
      const navFlow = { ...openQuickFixFlow(nc.t, [nc.p], baseProject), selectedProblemId: nc.p.id };
      selectQuickFixOption(
        navFlow,
        { id: 'show-in-panel', label: nc.p.showLabel, kind: 'option' },
        {
          stores: { ...useEditorStore.getState(), project: useProjectStore.getState().project, updateProject: useProjectStore.getState().updateProject },
          setQuickFixFlow: () => {},
          closeSpeedPanel: () => {},
        },
      );
      expect(useEditorStore.getState().rightTab).toBe(nc.expectedTab);
      expect(useEditorStore.getState().rightCollapsed).toBe(false);
      expect(nc.checkSel()).toBe(true);
    }

    // Extended hit targets (spawn & item) + label formatter
    const spSelect = vi.fn();
    const kindSelect = vi.fn();
    selectQuickFixTarget(
      { type: 'spawn', id: 'sp-1' },
      { ...useEditorStore.getState(), project: baseProject, selectSpawn: spSelect, selectKind: kindSelect },
    );
    expect(spSelect).toHaveBeenCalledWith('sp-1', false);
    selectQuickFixTarget(
      { type: 'item', id: 'itm-1' } as QuickFixTarget,
      { ...useEditorStore.getState(), project: baseProject, selectKind: kindSelect },
    );
    expect(kindSelect).toHaveBeenCalledWith('item', 'itm-1', false);
    expect(formatQuickFixTargetLabel({ type: 'entity', id: 'npc-broken' }, baseProject)).toBe('Keeper');
    expect(formatQuickFixTargetLabel({ type: 'landmark', id: 'lm-broken' }, baseProject)).toBe('Altar');
    expect(formatQuickFixTargetLabel({ type: 'district', id: 'd1' }, baseProject)).toBe('Broken District');

    // District fallback without selectAll selects first district zone, plus defensive option guards
    const fallbackZoneSpy = vi.fn();
    selectQuickFixTarget(
      { type: 'district', id: 'd1' },
      { ...useEditorStore.getState(), project: baseProject, selectAll: undefined, selectZone: fallbackZoneSpy },
    );
    expect(fallbackZoneSpy).toHaveBeenCalledWith('z1', false);

    const guardFlowSetter = vi.fn();
    expect(
      selectQuickFixOption(
        { ...flow, selectedProblemId: 'missing-problem-id' },
        { id: 'repair:0', label: 'missing', kind: 'option' },
        {
          stores: { ...useEditorStore.getState(), project: baseProject, updateProject: useProjectStore.getState().updateProject },
          setQuickFixFlow: guardFlowSetter,
          closeSpeedPanel: () => {},
        },
      ),
    ).toBe(false);
    expect(guardFlowSetter).toHaveBeenCalledWith(null);
    expect(
      selectQuickFixOption(
        { ...flow, selectedProblemId: depProblem.id },
        { id: 'repair:99', label: 'bad idx', kind: 'option' },
        {
          stores: { ...useEditorStore.getState(), project: baseProject, updateProject: useProjectStore.getState().updateProject },
          setQuickFixFlow: () => {},
          closeSpeedPanel: () => {},
        },
      ),
    ).toBe(false);
    expect(
      selectQuickFixOption(
        { ...flow, selectedProblemId: depProblem.id },
        { id: 'unrecognized-option', label: 'other', kind: 'option' },
        {
          stores: { ...useEditorStore.getState(), project: baseProject, updateProject: useProjectStore.getState().updateProject },
          setQuickFixFlow: () => {},
          closeSpeedPanel: () => {},
        },
      ),
    ).toBe(false);

    // Quick Fix keyboard lifecycle via createSpeedPanelCallbacks (open, move, select, back, Esc cancel)
    useProjectStore.getState().loadProject(structuredClone(baseProject));
    useEditorStore.getState().clearSelection();
    const cbView = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...productionHotkeyContext(), hit: target },
      '',
      { quickFixProblems: problems },
    );
    const cbEntries = buildNavigableEntries(cbView, new Set());
    let cbQuickFixFlow: ReturnType<typeof openQuickFixFlow> | null = null;
    const cbCloseSpy = vi.fn();
    const mkCallbacks = (activeFlowState: ReturnType<typeof openQuickFixFlow> | null) =>
      createSpeedPanelCallbacks({
        context: target,
        selection: useEditorStore.getState().selection,
        zones: baseProject.zones,
        query: '',
        view: cbView,
        allNavigable: cbEntries,
        activeIdx: 0,
        lastPanelAction: null,
        stepFlow: null,
        filteredStepOptions: [],
        stepActiveIdx: 0,
        stepFilter: '',
        stepInputDraft: '',
        scalarPill: null,
        scalarPillRef: { current: null },
        quickFixFlow: activeFlowState,
        setQuickFixFlow: (next) => { cbQuickFixFlow = next; },
        executeCommand: executeRegistryCommand,
        runMacroSteps: executeMacro,
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: cbCloseSpy,
        setActiveIdx: () => {},
        reorderPin: () => {},
        setStepFlow: () => {},
        setStepFilter: () => {},
        setStepActiveIdx: () => {},
        setScalarPill: () => {},
        setMacroStatus: () => {},
        recordCommandUsage: () => {},
        pushToast: () => {},
        refocusSearch: refocusSpy,
      });
    const mkKey = (key: string, opts: { altKey?: boolean } = {}) => ({
      key,
      code: key,
      altKey: opts.altKey ?? false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    mkCallbacks(null).handleKeyDown(mkKey('Enter'));
    expect(cbQuickFixFlow).not.toBeNull();
    mkCallbacks(cbQuickFixFlow).handleKeyDown(mkKey('ArrowDown'));
    expect(cbQuickFixFlow!.activeIdx).toBe(1);
    mkCallbacks(cbQuickFixFlow).handleKeyDown(mkKey('Enter'));
    expect(cbQuickFixFlow!.selectedProblemId).not.toBeNull();
    mkCallbacks(cbQuickFixFlow).handleKeyDown(mkKey('ArrowLeft', { altKey: true }));
    expect(cbQuickFixFlow!.selectedProblemId).toBeNull();
    mkCallbacks(cbQuickFixFlow).handleKeyDown(mkKey('Escape'));
    expect(cbQuickFixFlow).toBeNull();
    expect(cbCloseSpy).toHaveBeenCalled();

    // Esc leaves project, undo stack, and selection unchanged
    useProjectStore.getState().loadProject(structuredClone(baseProject));
    useEditorStore.getState().selectZone('z1', false);
    const snapBeforeEsc = structuredClone(useProjectStore.getState().project);
    const undoBeforeEsc = useProjectStore.getState().undoStack.length;
    const selBeforeEsc = structuredClone(useEditorStore.getState().selection);
    const closeSpy = vi.fn();
    let activeFlow: ReturnType<typeof openQuickFixFlow> | null = openQuickFixFlow(target, problems, baseProject);
    const escKey = { key: 'Escape', code: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null };
    const escAction = resolveSpeedPanelKeyAction(escKey, { kind: 'searched', query: '', enabled: [], macros: [], unavailable: [] }, [], 0);
    expect(escAction).toEqual({ type: 'close' });
    activeFlow = null;
    closeSpy();
    expect(activeFlow).toBeNull();
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().project).toEqual(snapBeforeEsc);
    expect(useProjectStore.getState().undoStack.length).toBe(undoBeforeEsc);
    expect(useEditorStore.getState().selection).toEqual(selBeforeEsc);
  });

  it('reuses WeakMap problem snapshot across repeat opens and stays fast on the largest built-in sample world', () => {
    const ranked = [...SAMPLE_WORLDS].sort((a, b) => {
      const size = (p: WorldProject) =>
        p.zones.length + p.connections.length + p.districts.length + p.landmarks.length
        + p.entityPlacements.length + p.encounterAnchors.length + p.itemPlacements.length + p.dialogues.length;
      return size(b.project) - size(a.project);
    });
    const largest = ranked[0];
    expect(largest.id).toBe('chapel-threshold');

    const sampleProject = structuredClone(largest.project);
    const zId = sampleProject.zones[0].id;
    sampleProject.zones[0] = { ...sampleProject.zones[0], backgroundId: 'missing-bench-bg' };
    useProjectStore.getState().loadProject(sampleProject);
    const ctx = productionHotkeyContext();

    const tCold0 = performance.now();
    const coldSnapshot = getProjectProblemSnapshot(sampleProject);
    const coldProblems = getProblemsForObject(sampleProject, { type: 'zone', id: zId }, coldSnapshot);
    const coldView = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...ctx, hit: { type: 'zone', id: zId } },
      '',
      {
        pinnedIds: [],
        macros: [],
        groups: [],
        adaptiveHistory: {},
        showRecents: true,
        mode: sampleProject.mode ?? 'dungeon',
        quickFixProblems: coldProblems,
      },
    );
    const tCold1 = performance.now();

    const tWarm0 = performance.now();
    const warmSnapshot = getProjectProblemSnapshot(sampleProject);
    const warmProblems = getProblemsForObject(sampleProject, { type: 'zone', id: zId }, warmSnapshot);
    const warmView = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...ctx, hit: { type: 'zone', id: zId } },
      '',
      {
        pinnedIds: [],
        macros: [],
        groups: [],
        adaptiveHistory: {},
        showRecents: true,
        mode: sampleProject.mode ?? 'dungeon',
        quickFixProblems: warmProblems,
      },
    );
    const tWarm1 = performance.now();

    expect(warmSnapshot).toBe(coldSnapshot);
    expect(coldProblems.length).toBeGreaterThanOrEqual(1);
    expect(coldProblems.some((p) => p.source === 'dependencies')).toBe(true);
    expect(coldView.kind === 'unsearched' && coldView.quickFix?.count).toBe(coldProblems.length);
    expect(warmView.kind === 'unsearched' && warmView.quickFix?.count).toBe(coldProblems.length);
    expect(tCold1 - tCold0).toBeLessThan(200);
    expect(tWarm1 - tWarm0).toBeLessThan(100);

    // Mutated copy produces a new WeakMap snapshot
    const nextProject = { ...sampleProject, name: `${sampleProject.name} (edited)` };
    const nextSnapshot = getProjectProblemSnapshot(nextProject);
    expect(nextSnapshot).not.toBe(coldSnapshot);
    expect(buildProjectProblemSnapshot(sampleProject).depEdges.length).toBeGreaterThan(0);
  });

  it('drops unsupported and invalidly parameterized macro steps at kit import and store load and reports command disabledReason on argless macro aborts', () => {
    // 1) sanitizeMacros drops commands outside ATOMIC_MACRO_SUPPORTED_COMMANDS and argless ARG_REQUIRED_MACRO_COMMANDS
    const warnings: string[] = [];
    const cleaned = sanitizeMacros([
      {
        id: 'm-unsupported',
        name: 'Contains Unsupported',
        steps: [
          { actionId: 'no-such-command' },
          { actionId: 'new-zone' },
          { actionId: 'set-elevation' }, // missing required args
          { actionId: 'assign-district', args: { kind: 'assign-district', districtId: 123 } }, // bad args
          { actionId: 'fit-content', commandId: 'fit-content' },
        ],
      },
      {
        id: 'm-only-bad',
        name: 'Only Bad',
        steps: [{ actionId: 'new-zone' }, { actionId: 'assign-district', args: { kind: 'assign-district', districtId: '' } }],
      },
      {
        id: 'm-legacy-ok',
        name: 'Legacy Assign',
        steps: [{ actionId: 'assign-district' }], // argless assign-district allowed for backwards compat
      },
    ], warnings);

    expect(cleaned.map((m) => m.id)).toEqual(['m-unsupported', 'm-legacy-ok']);
    expect(cleaned[0].steps).toEqual([{ actionId: 'fit-content', commandId: 'fit-content' }]);
    expect(warnings.some((w) => w.includes('Unknown macro step command dropped') && w.includes('no-such-command'))).toBe(true);
    expect(warnings.some((w) => w.includes('Unsupported macro step command dropped') && w.includes('new-zone'))).toBe(true);
    expect(warnings.some((w) => w.includes('Dropped macro step "set-elevation"') && w.includes('missing required parameters'))).toBe(true);
    expect(warnings.some((w) => w.includes('Dropped macro step "assign-district"') && w.includes('invalid args'))).toBe(true);
    expect(warnings.some((w) => w.includes('Dropped macro "Only Bad"'))).toBe(true);

    // 2) parseKitBundle applies the same sanitization and warnings at import time
    const rawBundle = {
      bundleVersion: 1,
      exportedAt: new Date().toISOString(),
      name: 'Sanitize Kit',
      description: 'Kit with invalid macro steps',
      icon: '!',
      modes: ['dungeon'],
      tags: [],
      project: structuredClone(minimalProject),
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
      speedPanelPresets: {
        pins: ['fit-content'],
        macros: [
          { id: 'km-bad', name: 'Bad Kit Macro', steps: [{ actionId: 'new-zone' }] },
          { id: 'km-mix', name: 'Mixed Kit Macro', steps: [{ actionId: 'set-elevation' }, { actionId: 'fit-content' }] },
        ],
      },
    };
    const parsed = parseKitBundle(rawBundle);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.warnings.some((w) => w.includes('new-zone'))).toBe(true);
      expect(parsed.warnings.some((w) => w.includes('set-elevation'))).toBe(true);
      expect(parsed.bundle.speedPanelPresets?.macros.map((m) => m.id)).toEqual(['km-mix']);
      expect(parsed.bundle.speedPanelPresets?.macros[0].steps).toEqual([{ actionId: 'fit-content' }]);
    }

    // 3) Store load applies sanitizeMacros as well
    storage.set(SPEED_PANEL_STATE_V2_KEY, JSON.stringify({
      pinnedIds: ['fit-content'],
      macros: [{ id: 'stored-bad', name: 'Stored Bad', steps: [{ actionId: 'new-zone' }] }],
    }));
    const loadedState = loadSpeedPanelStateV2();
    expect(loadedState.macros).toEqual([]);

    // 4) macroContentKey ignores pinned so re-applying a kit with changed pinned status skips duplicate
    useSpeedPanelPins.setState({
      pinnedIds: [],
      macros: [{ id: 'existing', name: 'Quick Elev', pinned: true, steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 4 } }] }],
    });
    const mergeRes = useSpeedPanelPins.getState().mergeKitPresets(
      {
        pins: [],
        macros: [{ id: 'from-kit', name: 'Quick Elev', pinned: false, steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 4 } }] }],
      },
      'Test Kit',
    );
    expect(mergeRes.addedMacros).toEqual([]);

    // 5) Empty-canvas argless abort reason uses command disabledReason wording
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    const emptyMacro: SpeedPanelMacro = { id: 'empty-ad', name: 'Empty Assign', steps: [{ actionId: 'assign-district' }] };
    const execRes = executeMacro(emptyMacro, null, buildExecuteStores());
    expect(execRes.abortedAt).toBe(0);
    const assignCmd = getCommandById('assign-district')!;
    const expectedMsg = assignCmd.disabledReason(productionHotkeyContext())
      ?? 'Not available in this context';
    expect(execRes.reason).toContain(expectedMsg);
  });

  it('collects warnings at persisted state load naming dropped commands and removed empty macros and notifies once without overwriting localStorage', () => {
    const legacyMacrosKey = 'world-forge-speed-panel-macros';
    const rawV2 = JSON.stringify({
      version: 2,
      pinnedIds: ['fit-content'],
      recentIds: [],
      frecency: {},
      adaptiveHistory: {},
      groups: [],
      macros: [
        {
          id: 'm-keep-one',
          name: 'Partial Stored Macro',
          steps: [{ actionId: 'new-zone' }, { actionId: 'fit-content' }],
        },
        {
          id: 'm-drop-all',
          name: 'Dead End Stored Macro',
          steps: [{ actionId: 'new-zone' }],
        },
      ],
      showRecents: true,
    });
    storage.set(SPEED_PANEL_STATE_V2_KEY, rawV2);

    const loadWarnings: string[] = [];
    const loadedV2 = loadSpeedPanelStateV2(Date.now(), loadWarnings);
    expect(loadedV2.macros.map((m) => m.id)).toEqual(['m-keep-one']);
    expect(loadedV2.macros[0].steps).toEqual([{ actionId: 'fit-content' }]);
    expect(loadWarnings.some((w) => w.includes('new-zone') && w.includes('Partial Stored Macro'))).toBe(true);
    expect(loadWarnings.some((w) => w.includes('new-zone') && w.includes('Dead End Stored Macro'))).toBe(true);
    expect(loadWarnings.some((w) => w.includes('Dead End Stored Macro') && w.includes('removed'))).toBe(true);
    // Original persisted value stays intact at load before notice is shown or user saves
    expect(storage.get(SPEED_PANEL_STATE_V2_KEY)).toBe(rawV2);

    // Notice shows once and leaves localStorage untouched until a deliberate write
    expect(formatSpeedPanelLoadNotice([])).toBeNull();
    useSpeedPanelPins.setState({ loadWarnings: [...loadWarnings] });
    const toastSpy = vi.fn();
    notifySpeedPanelLoadWarnings(toastSpy);
    expect(toastSpy).toHaveBeenCalledTimes(1);
    const noticeMsg = toastSpy.mock.calls[0][0] as string;
    expect(noticeMsg).toContain('new-zone');
    expect(noticeMsg).toContain('Partial Stored Macro');
    expect(noticeMsg).toContain('Dead End Stored Macro');
    expect(noticeMsg).toContain('removed');
    expect(toastSpy.mock.calls[0][1]).toBe('warning');
    expect(storage.get(SPEED_PANEL_STATE_V2_KEY)).toBe(rawV2);

    // Repeat notification call does not fire twice
    notifySpeedPanelLoadWarnings(toastSpy);
    expect(toastSpy).toHaveBeenCalledTimes(1);

    // Deliberate user write then updates localStorage cleanly
    useSpeedPanelPins.getState().addMacro({
      id: 'user-saved',
      name: 'User Saved',
      steps: [{ actionId: 'fit-content' }],
    });
    expect(storage.get(SPEED_PANEL_STATE_V2_KEY)).not.toBe(rawV2);

    // Legacy macro migration path also collects load warnings
    storage.clear();
    const rawLegacy = JSON.stringify([{ id: 'leg-bad', name: 'Legacy Bad', steps: [{ actionId: 'new-zone' }] }]);
    storage.set(legacyMacrosKey, rawLegacy);
    const legacyWarnings: string[] = [];
    const loadedLegacy = loadSpeedPanelStateV2(Date.now(), legacyWarnings);
    expect(loadedLegacy.macros).toEqual([]);
    expect(legacyWarnings.some((w) => w.includes('new-zone') && w.includes('Legacy Bad'))).toBe(true);
    expect(legacyWarnings.some((w) => w.includes('Legacy Bad') && w.includes('removed'))).toBe(true);
    expect(storage.get(legacyMacrosKey)).toBe(rawLegacy);
  });

  it('starts highlight on Band 1 slot 1 with ArrowDown matching base order and ArrowUp reaching Quick Fix', () => {
    const project = makeComplexProblemProject();
    const brokenTarget: QuickFixTarget = { type: 'zone', id: 'z2' };
    const cleanTarget: QuickFixTarget = { type: 'zone', id: 'z-clean' };
    const brokenProblems = getProblemsForObject(project, brokenTarget);
    const cleanProblems = getProblemsForObject(project, cleanTarget);
    expect(brokenProblems.length).toBeGreaterThan(0);
    expect(cleanProblems).toEqual([]);

    const ctxBase = {
      selection: { zones: [] as string[], entities: [] as string[], landmarks: [] as string[], spawns: [] as string[], encounters: [] as string[] },
      selectedConnection: null,
      project,
      supportsSpatialPick: true,
    };

    const viewWithFix = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...ctxBase, hit: brokenTarget },
      '',
      {
        pinnedIds: [],
        macros: [],
        groups: [],
        adaptiveHistory: {},
        showRecents: true,
        mode: 'dungeon',
        quickFixProblems: brokenProblems,
      },
    );
    const viewClean = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { ...ctxBase, hit: cleanTarget },
      '',
      {
        pinnedIds: [],
        macros: [],
        groups: [],
        adaptiveHistory: {},
        showRecents: true,
        mode: 'dungeon',
        quickFixProblems: cleanProblems,
      },
    );

    const entriesWithFix = buildNavigableEntries(viewWithFix, new Set());
    const entriesClean = buildNavigableEntries(viewClean, new Set());
    if (viewWithFix.kind !== 'unsearched' || viewClean.kind !== 'unsearched') {
      throw new Error('Expected unsearched views');
    }

    // Quick Fix sits at index 0 above slot 1, so initial active index is 1 on broken and 0 on clean
    expect(entriesWithFix[0]).toMatchObject({ kind: 'quick-fix', domId: 'wf-sp-opt-quick-fix' });
    const startWithFix = getInitialActiveIndex(entriesWithFix);
    const startClean = getInitialActiveIndex(entriesClean);
    expect(startWithFix).toBe(1);
    expect(startClean).toBe(0);
    expect(entriesWithFix[startWithFix]?.domId).toBe('wf-sp-opt-b1-0-edit-props');
    expect(clampActiveIndex(99, entriesWithFix.length, startWithFix)).toBe(1);

    // Enter at initial index runs Band 1 slot 1 (`edit-props`) identically with and without Quick Fix
    const enterKey = { key: 'Enter', code: 'Enter', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null };
    const enterWithFix = resolveSpeedPanelKeyAction(enterKey, viewWithFix, entriesWithFix, startWithFix);
    const enterClean = resolveSpeedPanelKeyAction(enterKey, viewClean, entriesClean, startClean);
    expect(enterWithFix.type).toBe('exec-row');
    expect(enterClean.type).toBe('exec-row');
    if (enterWithFix.type !== 'exec-row' || enterClean.type !== 'exec-row') {
      throw new Error('Expected Enter on open to dispatch exec-row for Band 1 slot 1');
    }
    expect(enterWithFix.row.command.id).toBe('edit-props');
    expect(enterClean.row.command.id).toBe('edit-props');

    // ArrowUp from slot 1 reaches Quick Fix at index 0, stays clamped at 0, and Enter there opens Quick Fix
    const arrowUpKey = { key: 'ArrowUp', code: 'ArrowUp', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null };
    const upAction = resolveSpeedPanelKeyAction(arrowUpKey, viewWithFix, entriesWithFix, startWithFix);
    expect(upAction).toEqual({ type: 'set-active', nextActiveIdx: 0 });
    const stayTop = resolveSpeedPanelKeyAction(arrowUpKey, viewWithFix, entriesWithFix, 0);
    expect(stayTop).toEqual({ type: 'set-active', nextActiveIdx: 0 });
    expect(resolveSpeedPanelKeyAction(enterKey, viewWithFix, entriesWithFix, 0)).toEqual({
      type: 'open-quick-fix',
      quickFix: viewWithFix.quickFix!,
    });

    // Hard-coded base (36dcd246) ArrowDown row sequence starting from Band 1 slot 1 in dungeon mode with empty pins/recents
    const BASE_ZONE_ARROW_DOWN_DOM_IDS = [
      'wf-sp-opt-b1-0-edit-props',
      'wf-sp-opt-b1-1-connect-from',
      'wf-sp-opt-b1-2-place-entity',
      'wf-sp-opt-b1-3-place-encounter',
      'wf-sp-opt-b1-4-duplicate',
      'wf-sp-opt-ms-0-add-secret-conn',
      'wf-sp-opt-cat-Author-0-delete',
      'wf-sp-opt-cat-Author-1-assign-district',
      'wf-sp-opt-cat-Author-2-merge-zones',
      'wf-sp-opt-cat-Author-3-set-elevation',
      'wf-sp-opt-cat-Author-4-paste',
      'wf-sp-opt-cat-Author-5-undo',
      'wf-sp-opt-cat-Author-6-redo',
      'wf-sp-opt-cat-Author-7-apply-preset',
      'wf-sp-opt-cat-Author-8-save-preset',
      'wf-sp-opt-cat-Author-9-create-macro-from-recent',
      'wf-sp-opt-cat-Connect-0-add-channel-conn',
      'wf-sp-opt-cat-Connect-1-add-warp-conn',
      'wf-sp-opt-cat-Connect-2-add-trail-conn',
      'wf-sp-opt-cat-Inspect-0-select-all',
      'wf-sp-opt-cat-Inspect-1-escape',
      'wf-sp-opt-cat-Inspect-2-open-details',
      'wf-sp-opt-cat-View-0-search',
      'wf-sp-opt-cat-View-1-tool-select',
      'wf-sp-opt-cat-View-2-tool-zone',
      'wf-sp-opt-cat-View-3-tool-connection',
      'wf-sp-opt-cat-View-4-tool-entity',
      'wf-sp-opt-cat-View-5-tool-landmark',
      'wf-sp-opt-cat-View-6-tool-spawn',
      'wf-sp-opt-cat-View-7-tool-tile',
      'wf-sp-opt-cat-View-8-tool-prop',
      'wf-sp-opt-cat-View-9-tool-encounter',
      'wf-sp-opt-cat-View-10-tool-item',
      'wf-sp-opt-cat-Export-0-save',
    ];

    const arrowDownKey = { key: 'ArrowDown', code: 'ArrowDown', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null };
    const visitedDomIds: string[] = [entriesWithFix[startWithFix].domId];
    let cursor = startWithFix;
    for (let step = 0; step < entriesWithFix.length + 2; step++) {
      const next = resolveSpeedPanelKeyAction(arrowDownKey, viewWithFix, entriesWithFix, cursor);
      expect(next.type).toBe('set-active');
      if (next.type !== 'set-active' || next.nextActiveIdx === cursor) break;
      cursor = next.nextActiveIdx;
      visitedDomIds.push(entriesWithFix[cursor].domId);
    }
    expect(visitedDomIds).toEqual(BASE_ZONE_ARROW_DOWN_DOM_IDS);

    // SSR initial render highlights Band 1 slot 1 rather than Quick Fix when problems are present
    useProjectStore.getState().loadProject(project);
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [], recentIds: [], frecency: {}, adaptiveHistory: {} });
    useEditorStore.setState({
      speedPanelPosition: { x: 100, y: 100 },
      speedPanelContext: brokenTarget,
      speedPanelEditMode: false,
    });
    const ssrHtml = renderToStaticMarkup(createElement(SpeedPanel));
    expect(ssrHtml).toMatch(/id="wf-sp-opt-quick-fix"[^>]*aria-selected="false"/);
    expect(ssrHtml).toMatch(/id="wf-sp-opt-b1-0-edit-props"[^>]*aria-selected="true"/);
  });
});
