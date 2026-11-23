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
import { COMMAND_REGISTRY, getCommandById } from '../command-registry.js';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import {
  BUNDLE_VERSION,
  buildExportBundleForKit,
  buildKitWithSpeedPanelPresets,
  mergeKitSpeedPanelPresetsIfEnabled,
  parseKitBundle,
  prepareKitImport,
  sanitizeKitSpeedPanelPresets,
  serializeKit,
} from '../kits/bundle.js';
import { useKitStore } from '../kits/kit-store.js';
import type { StarterKit } from '../kits/types.js';
import { validateKit } from '../kits/validate-kit.js';
import { ImportKitModal } from '../panels/ImportKitModal.js';
import { SaveKitModal } from '../panels/SaveKitModal.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import {
  productionExecuteStores,
  productionHotkeyContext,
  productionStepStores,
} from '../panels/speed-panel-stores.js';
import { TemplateManager, requestTemplateManagerTab } from '../panels/TemplateManager.js';
import { BUILTIN_ENCOUNTER_PRESETS, BUILTIN_REGION_PRESETS } from '../presets/built-ins.js';
import { usePresetStore } from '../presets/preset-store.js';
import {
  applyRegionPresetToProject,
  createEncounterFromPresetInProject,
  mergeZonesInProject,
  removeSelectedFromProject,
} from '../project-ops.js';
import { getMacroStepCommandId, type SpeedPanelMacro } from '../speed-panel-actions.js';
import { buildExecuteStores, executeContextMenuAction, executeMacro } from '../speed-panel-execute.js';
import { buildSpeedPanelView } from '../speed-panel-layout.js';
import {
  createMacroFromRecentEntries,
  executeMacroAtomic,
  validateMacroExecution,
} from '../speed-panel-macros.js';
import {
  advanceStepChoice,
  commitDistrictAssignment,
  commitPlaceEncounter,
  commitSetElevation,
  openCommandStepFlow,
  submitStepInput,
} from '../speed-panel-steps.js';
import {
  SPEED_GLYPH,
  buildMacroReplaceStepView,
  buildNavigableEntries,
  createSpeedPanelCallbacks,
  executeSpeedPanelMacro,
  executeSpeedPanelRowOrStep,
  openCreateMacroState,
  selectMacroReplacementOption,
  stepBackMacroReplaceFlow,
  submitCreateMacroState,
  submitScalarPill,
  toggleCreateMacroSelection,
  type CreateMacroViewState,
  type MacroReplaceFlowState,
} from '../speed-panel-ui.js';
import {
  MAX_RECENT_PANEL_ACTIONS,
  emptySelection,
  isReplayableSessionAction,
  useEditorStore,
  type SelectionSet,
} from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import {
  KNOWN_ACTION_IDS,
  MAX_IMPORTED_MACROS,
  MAX_IMPORTED_PINS,
  MAX_MACRO_STEPS,
  SPEED_PANEL_STATE_V2_KEY,
  loadSpeedPanelStateV2,
  sanitizeMacroStepArgs,
  sanitizeMacros,
  sanitizePins,
  useSpeedPanelPins,
} from '../store/speed-panel-store.js';

function makeRichProject() {
  const proj = structuredClone(minimalProject);
  if (!proj.zones.some((z) => z.id === 'zone-tower')) {
    proj.zones.push({
      id: 'zone-tower',
      name: 'Watchtower',
      description: 'High spire.',
      tags: ['tower'],
      parentDistrictId: undefined,
      gridX: 40,
      gridY: 40,
      gridWidth: 8,
      gridHeight: 8,
      neighbors: [],
      exits: [],
      light: 6,
      noise: 2,
      hazards: [],
      interactables: [],
    });
  }
  if (proj.districts.length === 0) {
    proj.districts.push({
      id: 'dist-chapel',
      name: 'Chapel Ward',
      zoneIds: [proj.zones[0].id],
      tags: ['sacred'],
      baseMetrics: { commerce: 40, morale: 60, safety: 55, stability: 70 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    });
    proj.zones[0].parentDistrictId = 'dist-chapel';
  }
  if (!proj.districts.some((d) => d.id === 'dist-dock')) {
    proj.districts.push({
      id: 'dist-dock',
      name: 'Harbor Ward',
      zoneIds: [],
      tags: ['harbor'],
      baseMetrics: { commerce: 70, morale: 50, safety: 40, stability: 50 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    });
  }
  return proj;
}

function makeCallbacksHarness(overrides: Record<string, unknown> = {}) {
  const editor = useEditorStore.getState();
  const project = useProjectStore.getState().project;
  const hit = { type: 'zone' as const, id: project.zones[0].id };
  const view = buildSpeedPanelView(
    COMMAND_REGISTRY,
    { hit, selection: editor.selection },
    '',
    { macros: useSpeedPanelPins.getState().macros },
  );
  return createSpeedPanelCallbacks({
    context: hit,
    selection: editor.selection,
    zones: project.zones,
    query: '',
    view,
    allNavigable: buildNavigableEntries(view, new Set()),
    activeIdx: 0,
    lastPanelAction: editor.lastPanelAction,
    stepFlow: null,
    filteredStepOptions: [],
    stepActiveIdx: 0,
    stepFilter: '',
    stepInputDraft: '',
    scalarPill: null,
    scalarPillRef: { current: null },
    recentPanelActions: editor.recentPanelActions,
    executeCommand: (_id, _ctx, _s) => ({ executed: true }),
    runMacroSteps: executeMacro,
    stores: productionExecuteStores(),
    stepStores: productionStepStores(),
    hotkeyCtx: productionHotkeyContext(),
    closeSpeedPanel: () => useEditorStore.getState().closeSpeedPanel(),
    setActiveIdx: vi.fn(),
    reorderPin: vi.fn(),
    setStepFlow: vi.fn(),
    setStepFilter: vi.fn(),
    setStepActiveIdx: vi.fn(),
    setScalarPill: vi.fn(),
    setMacroStatus: vi.fn(),
    recordCommandUsage: vi.fn(),
    pushToast: vi.fn(),
    refocusSearch: vi.fn(),
    ...overrides,
  });
}

describe('Speed Panel D2: Parameterized Macros, Session Action Log & Starter Kit Presets', () => {
  beforeEach(() => {
    storage.clear();
    useProjectStore.getState().loadProject(makeRichProject());
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().clearRecentPanelActions();
    useEditorStore.setState({ lastPanelAction: null, showSpeedPanel: false });
    useSpeedPanelPins.setState({
      pinnedIds: ['edit-props', 'duplicate'],
      macros: [],
      recentIds: [],
      frecency: {},
      adaptiveHistory: {},
      groups: [],
    });
    usePresetStore.setState({
      regionPresets: structuredClone(BUILTIN_REGION_PRESETS),
      encounterPresets: structuredClone(BUILTIN_ENCOUNTER_PRESETS),
    });
    useKitStore.setState({ kits: [...BUILTIN_KITS] });
  });

  // === Part 1: MacroStep args persistence & sanitization ===

  it('changed: MacroStep extends cleanly with commandId + LastPanelActionParams args and sanitizes malformed args', () => {
    expect(sanitizeMacroStepArgs('not-obj')).toBeUndefined();
    expect(sanitizeMacroStepArgs({ kind: 'assign-district', districtId: '' })).toBeUndefined();
    expect(sanitizeMacroStepArgs({ kind: 'assign-district', districtId: 'dist-1' })).toEqual({
      kind: 'assign-district',
      districtId: 'dist-1',
    });
    expect(sanitizeMacroStepArgs({ kind: 'apply-region-preset', presetId: 'p1', applyMode: 'bad' })).toBeUndefined();
    expect(sanitizeMacroStepArgs({ kind: 'apply-region-preset', presetId: 'p1', applyMode: 'overwrite' })).toEqual({
      kind: 'apply-region-preset',
      presetId: 'p1',
      applyMode: 'overwrite',
    });
    expect(sanitizeMacroStepArgs({ kind: 'apply-encounter-preset', presetId: '' })).toBeUndefined();
    expect(sanitizeMacroStepArgs({ kind: 'place-encounter', encounterType: 'ambush' })).toEqual({
      kind: 'place-encounter',
      encounterType: 'ambush',
    });
    expect(sanitizeMacroStepArgs({ kind: 'set-elevation', elevation: undefined })).toEqual({
      kind: 'set-elevation',
      elevation: undefined,
    });
    expect(sanitizeMacroStepArgs({ kind: 'set-elevation', elevation: Number.NaN })).toBeUndefined();
    expect(sanitizeMacroStepArgs({ kind: 'set-elevation', elevation: -12 })).toEqual({
      kind: 'set-elevation',
      elevation: -12,
    });
    expect(sanitizeMacroStepArgs({ kind: 'unknown-kind' })).toBeUndefined();

    const warnings: string[] = [];
    const macroWithArgs: SpeedPanelMacro = {
      id: 'm-args',
      name: 'Build Zone',
      pinned: false,
      steps: [
        {
          actionId: 'assign-district',
          commandId: 'assign-district',
          args: { kind: 'assign-district', districtId: 'dist-chapel' },
        },
        {
          actionId: 'bad-action-id',
        },
      ],
    };
    const sanitized = sanitizeMacros([macroWithArgs, { id: 'bad' }], warnings);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].pinned).toBe(false);
    expect(sanitized[0].steps).toEqual([
      {
        actionId: 'assign-district',
        commandId: 'assign-district',
        args: { kind: 'assign-district', districtId: 'dist-chapel' },
      },
    ]);
    expect(warnings.some((w) => w.includes('bad-action-id'))).toBe(true);

    useSpeedPanelPins.getState().addMacro(sanitized[0]);
    const reloaded = loadSpeedPanelStateV2();
    expect(reloaded.macros).toEqual(sanitized);
    expect(getMacroStepCommandId({ actionId: 'a', commandId: 'duplicate' })).toBe('duplicate');
  });

  // === Part 2: Create Macro from Recent Actions & bounded session log ===

  it('changed: registers "Create Macro from Recent Actions…" and records <= 8 newest-first replayable actions without persisting', () => {
    const cmd = getCommandById('create-macro-from-recent');
    expect(cmd).toBeDefined();
    expect(cmd!.label).toBe('Create Macro from Recent Actions…');
    expect(cmd!.surfaces).toEqual(['speed-panel']);
    expect(cmd!.when({ hit: null, selection: emptySelection(), project: useProjectStore.getState().project })).toBe(true);
    expect(SPEED_GLYPH['create-macro-from-recent']).toBeDefined();

    expect(isReplayableSessionAction('assign-district', { kind: 'assign-district', districtId: 'd1' })).toBe(true);
    expect(isReplayableSessionAction('assign-district', { kind: 'place-encounter', encounterType: 'trap' })).toBe(false);
    expect(isReplayableSessionAction('create-macro-from-recent')).toBe(false);

    // Recording > MAX_RECENT_PANEL_ACTIONS caps at 8, newest first, and ignores unreplayable commands
    useEditorStore.getState().recordSessionAction({ commandId: 'new-zone', label: 'New Zone', timestamp: 1 });
    for (let i = 1; i <= MAX_RECENT_PANEL_ACTIONS + 2; i++) {
      useEditorStore.getState().recordSessionAction({
        commandId: 'set-elevation',
        label: `Set Elevation: ${i}m`,
        timestamp: 100 + i,
        args: { kind: 'set-elevation', elevation: i },
      });
    }
    const recent = useEditorStore.getState().recentPanelActions;
    expect(recent).toHaveLength(MAX_RECENT_PANEL_ACTIONS);
    expect(recent[0].label).toBe(`Set Elevation: ${MAX_RECENT_PANEL_ACTIONS + 2}m`);
    expect(recent[MAX_RECENT_PANEL_ACTIONS - 1].label).toBe('Set Elevation: 3m');

    // Never persisted into WorldProject JSON or localStorage
    expect('recentPanelActions' in useProjectStore.getState().project).toBe(false);
    for (const [k, v] of storage.entries()) {
      expect(v).not.toContain('Set Elevation: 10m');
      expect(k).not.toContain('recentPanelActions');
    }
  });

  it('changed: panel step flows, scalar pill, context menu, and direct execution record structured args directly without parsing undo labels', () => {
    const proj = useProjectStore.getState().project;
    const zTower = proj.zones.find((z) => z.id === 'zone-tower')!;
    const hitTower = { type: 'zone' as const, id: zTower.id };
    const hitFirst = { type: 'zone' as const, id: proj.zones[0].id };

    // 1) Assign district step flow records args directly
    const distOpen = openCommandStepFlow('assign-district', hitTower, productionStepStores());
    expect(distOpen.kind).toBe('steps');
    if (distOpen.kind !== 'steps' || distOpen.flow.steps[0].kind !== 'choice') return;
    const distOpt = distOpen.flow.steps[0].options.find((o) => o.id === 'dist-dock')!;
    const distDone = advanceStepChoice(distOpen.flow, distOpt, productionStepStores());
    expect(distDone.done).toBe(true);

    // 2) Scalar pill set-elevation records args
    const pillRes = submitScalarPill(
      { commandId: 'set-elevation', targetZoneIds: [zTower.id], value: '-6', error: null },
      {
        query: 'elev',
        stepStores: productionStepStores(),
        setScalarPill: vi.fn(),
        recordCommandUsage: vi.fn(),
        closeSpeedPanel: vi.fn(),
      },
    );
    expect(pillRes).toBe(true);

    // 3) Context menu replayable action records entry
    useProjectStore.getState().loadProject(makeRichProject());
    const ctxRes = executeContextMenuAction('duplicate', hitFirst);
    expect(ctxRes.executed).toBe(true);

    // 4) Direct row execution in panel records & repeat-last re-records
    const fitCmd = getCommandById('fit-content')!;
    executeSpeedPanelRowOrStep(
      { command: fitCmd, badge: null, disabledReason: null },
      {
        context: null,
        query: '',
        lastPanelAction: null,
        executeCommand: (_id) => ({ executed: true }),
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow: vi.fn(),
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast: vi.fn(),
      },
    );

    const log = useEditorStore.getState().recentPanelActions;
    expect(log[0].commandId).toBe('fit-content');
    expect(log.some((e) => e.commandId === 'duplicate')).toBe(true);
    expect(log.find((e) => e.commandId === 'set-elevation')?.args).toEqual({
      kind: 'set-elevation',
      elevation: -6,
    });
    expect(log.find((e) => e.commandId === 'assign-district')?.args).toEqual({
      kind: 'assign-district',
      districtId: 'dist-dock',
    });
  });

  it('changed: Create Macro UI state creates pinned (Band 2) or unpinned (Band 4 + search) macros in chronological step order and Esc cancels without saving', () => {
    useEditorStore.getState().recordSessionAction({
      commandId: 'assign-district',
      label: 'Assign District: Harbor Ward',
      timestamp: 10,
      args: { kind: 'assign-district', districtId: 'dist-dock' },
    });
    useEditorStore.getState().recordSessionAction({
      commandId: 'set-elevation',
      label: 'Set Elevation: 9m',
      timestamp: 20,
      args: { kind: 'set-elevation', elevation: 9 },
    });

    const initialState = openCreateMacroState(useEditorStore.getState().recentPanelActions);
    expect(initialState.entries).toHaveLength(2);
    expect(initialState.selectedIds).toHaveLength(2);

    // Unchecking all shows validation error and does not add macro
    let state: CreateMacroViewState | null = initialState;
    for (const id of initialState.selectedIds) {
      state = toggleCreateMacroSelection(state!, id);
    }
    expect(state!.selectedIds).toHaveLength(0);
    const failedEmpty = submitCreateMacroState({ ...state!, name: 'My Macro' }, {
      addMacro: (m) => useSpeedPanelPins.getState().addMacro(m),
      setCreateMacroState: (s) => { state = s; },
      setMacroStatus: vi.fn(),
    });
    expect(failedEmpty).toBeNull();
    expect(state?.error).toContain('Select at least one');

    // Blank name also fails cleanly
    expect(createMacroFromRecentEntries('   ', initialState.entries, new Set(initialState.selectedIds)).ok).toBe(false);

    // Valid creation pinned=false places macro in band4Macros + search, NOT band2Macros
    const statusSpy = vi.fn();
    const unpinnedCreated = submitCreateMacroState(
      { ...initialState, name: 'Dock Setup', pinToPanel: false },
      {
        addMacro: (m) => useSpeedPanelPins.getState().addMacro(m),
        setCreateMacroState: (s) => { state = s; },
        setMacroStatus: statusSpy,
        refocusSearch: vi.fn(),
      },
    );
    expect(unpinnedCreated).toBeTruthy();
    expect(state).toBeNull();
    expect(statusSpy).toHaveBeenCalledWith('Saved macro "Dock Setup"');
    // Chronological order: oldest (assign-district) first, newest (set-elevation) second
    expect(unpinnedCreated!.steps.map((s) => getMacroStepCommandId(s))).toEqual(['assign-district', 'set-elevation']);

    const viewUnsearched = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: { type: 'zone', id: 'zone-tower' }, selection: emptySelection() },
      '',
      { macros: useSpeedPanelPins.getState().macros },
    );
    expect(viewUnsearched.kind).toBe('unsearched');
    if (viewUnsearched.kind === 'unsearched') {
      expect(viewUnsearched.band2Macros).toEqual([]);
      expect(viewUnsearched.band4Macros?.map((m) => m.name)).toEqual(['Dock Setup']);
      expect(buildNavigableEntries(viewUnsearched, new Set()).some((n) => n.kind === 'macro' && n.macro.name === 'Dock Setup')).toBe(true);
    }
    const searched = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: { type: 'zone', id: 'zone-tower' }, selection: emptySelection() },
      'dock',
      { macros: useSpeedPanelPins.getState().macros },
    );
    expect(searched.kind).toBe('searched');
    if (searched.kind === 'searched') {
      expect(searched.macros.map((m) => m.name)).toEqual(['Dock Setup']);
    }

    // Esc inside createMacroState via createSpeedPanelCallbacks cancels without saving
    useEditorStore.getState().openSpeedPanel(10, 10, null);
    let activeCreateState: CreateMacroViewState | null = openCreateMacroState(useEditorStore.getState().recentPanelActions);
    const cb = makeCallbacksHarness({
      createMacroState: activeCreateState,
      setCreateMacroState: (next: CreateMacroViewState | null) => { activeCreateState = next; },
    });
    const prevCount = useSpeedPanelPins.getState().macros.length;
    cb.handleKeyDown({
      key: 'Escape',
      code: 'Escape',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(activeCreateState).toBeNull();
    expect(useEditorStore.getState().showSpeedPanel).toBe(false);
    expect(useSpeedPanelPins.getState().macros).toHaveLength(prevCount);
  });

  // === Part 3: Atomic single-undo execution, parity, validation, replacement & Esc ===

  it('changed: parameterized macro executes atomically in ONE undo entry matching macro.name and equals hand execution', () => {
    const regPreset = BUILTIN_REGION_PRESETS[0];
    const encPreset = BUILTIN_ENCOUNTER_PRESETS[0];
    const macro: SpeedPanelMacro = {
      id: 'macro-prep',
      name: 'Prep District Zone',
      steps: [
        { actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'dist-dock' } },
        { actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: regPreset.id, applyMode: 'overwrite' } },
        { actionId: 'apply-preset', args: { kind: 'apply-encounter-preset', presetId: encPreset.id } },
        { actionId: 'place-encounter', args: { kind: 'place-encounter', encounterType: 'ambush' } },
        { actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 14 } },
        { actionId: 'edit-props' },
      ],
    };

    useEditorStore.getState().setRightTab('review');
    const hitTower = { type: 'zone' as const, id: 'zone-tower' };
    const undoBefore = useProjectStore.getState().getUndoCount();
    const res = executeMacro(macro, hitTower, buildExecuteStores());
    expect(res.completed).toBe(6);
    expect(res.abortedAt).toBeUndefined();
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Prep District Zone');
    expect(useEditorStore.getState().rightTab).toBe('map');

    const macroProj = structuredClone(useProjectStore.getState().project);

    // Single undo reverts ALL mutations at once
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.zones.find((z) => z.id === 'zone-tower')?.elevation).toBeUndefined();
    expect(useProjectStore.getState().project.zones.find((z) => z.id === 'zone-tower')?.parentDistrictId).toBeUndefined();
    expect(useProjectStore.getState().project.encounterAnchors).toHaveLength(minimalProject.encounterAnchors.length);

    // Compare against running same steps by hand on fresh copy
    useProjectStore.getState().loadProject(makeRichProject());
    commitDistrictAssignment(productionStepStores(), ['zone-tower'], 'dist-dock');
    useProjectStore.getState().applyRegionPreset('dist-dock', regPreset, 'overwrite');
    useProjectStore.getState().createEncounterFromPreset('zone-tower', encPreset);
    commitPlaceEncounter(productionStepStores(), 'zone-tower', 'ambush');
    useProjectStore.getState().updateZone('zone-tower', { elevation: 14 });
    const handProj = useProjectStore.getState().project;

    const normalizeGeneratedIds = (p: typeof handProj) => ({
      ...p,
      encounterAnchors: p.encounterAnchors.map((e) => ({ ...e, id: 'normalized' })),
      pressureHotspots: p.pressureHotspots.map((h) => ({ ...h, id: 'normalized' })),
    });
    expect(normalizeGeneratedIds(macroProj)).toEqual(normalizeGeneratedIds(handProj));
  });

  it('changed: failure mid-macro aborts with zero partial mutations and zero undo entries', () => {
    const badMacro: SpeedPanelMacro = {
      id: 'macro-fail-mid',
      name: 'Should Abort',
      steps: [
        { actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 25 } },
        { actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: 'missing-reg-preset', applyMode: 'merge' } },
      ],
    };
    const snap = structuredClone(useProjectStore.getState().project);
    const undoBefore = useProjectStore.getState().getUndoCount();
    const res = executeMacro(badMacro, { type: 'zone', id: 'zone-tower' }, buildExecuteStores());
    expect(res.abortedAt).toBe(1);
    expect(res.completed).toBe(0);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);
    expect(useProjectStore.getState().project).toEqual(snap);
  });

  it('changed: missing district/preset/zone prompts inline replacements and commits on confirm or cancels on Esc with zero mutation', () => {
    const encPreset = BUILTIN_ENCOUNTER_PRESETS[0];
    const regPreset = BUILTIN_REGION_PRESETS[0];
    const macroWithMissingIds: SpeedPanelMacro = {
      id: 'macro-missing',
      name: 'Migrate Preset Macro',
      steps: [
        { actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'deleted-dist' } },
        { actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: 'deleted-reg', applyMode: 'merge' } },
        { actionId: 'apply-preset', args: { kind: 'apply-encounter-preset', presetId: 'deleted-enc' } },
      ],
    };

    const project = useProjectStore.getState().project;
    useEditorStore.getState().selectEntity('npc-keeper', false);
    const snapProj = structuredClone(project);
    const snapSel = structuredClone(useEditorStore.getState().selection);
    const undoBefore = useProjectStore.getState().getUndoCount();

    // Deleted target zone + missing district/reg/enc triggers ordered missingRefs
    const validation = validateMacroExecution(
      macroWithMissingIds,
      project,
      BUILTIN_REGION_PRESETS,
      BUILTIN_ENCOUNTER_PRESETS,
      { type: 'zone', id: 'deleted-zone' },
      emptySelection(),
    );
    expect(validation.ok).toBe(false);
    expect(validation.missingRefs.map((r) => r.refKind)).toEqual([
      'zone',
      'district',
      'region-preset',
      'encounter-preset',
    ]);

    // Executing through UI helper opens replaceFlow WITHOUT mutating project/undo/selection
    let replaceFlow: MacroReplaceFlowState | null = null;
    const statusSpy = vi.fn();
    const executedImmediate = executeSpeedPanelMacro(macroWithMissingIds, {
      context: { type: 'zone', id: 'deleted-zone' },
      runMacroSteps: executeMacro,
      stores: productionExecuteStores(),
      setMacroStatus: statusSpy,
      setMacroReplaceFlow: (f) => { replaceFlow = f; },
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    });
    expect(executedImmediate).toBe(false);
    expect(replaceFlow).not.toBeNull();
    expect(useProjectStore.getState().project).toEqual(snapProj);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);
    expect(useEditorStore.getState().selection).toEqual(snapSel);

    // Esc inside replace flow cancels cleanly with zero project mutation, zero undo entry, unchanged selection
    useEditorStore.getState().openSpeedPanel(10, 10, null);
    let escFlow: MacroReplaceFlowState | null = replaceFlow;
    const escCbs = makeCallbacksHarness({
      macroReplaceFlow: escFlow,
      setMacroReplaceFlow: (f: MacroReplaceFlowState | null) => { escFlow = f; },
    });
    escCbs.handleKeyDown({
      key: 'Escape',
      code: 'Escape',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(escFlow).toBeNull();
    expect(useEditorStore.getState().showSpeedPanel).toBe(false);
    expect(useProjectStore.getState().project).toEqual(snapProj);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);
    expect(useEditorStore.getState().selection).toEqual(snapSel);

    // Walking forward + backing up one step + finishing all 4 replacements commits atomically in 1 undo entry
    let flow = replaceFlow!;
    expect(buildMacroReplaceStepView(flow).currentPrompt.refKind).toBe('zone');
    selectMacroReplacementOption(flow, { id: 'zone-tower', label: 'Watchtower', kind: 'option' }, {
      stores: productionExecuteStores(),
      runMacroSteps: executeMacro,
      setMacroReplaceFlow: (f) => { if (f) flow = f; },
      setMacroStatus: statusSpy,
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    });
    expect(flow.currentIndex).toBe(1);
    stepBackMacroReplaceFlow(flow, { setMacroReplaceFlow: (f) => { if (f) flow = f; } });
    expect(flow.currentIndex).toBe(0);
    // Complete all 4 steps
    const choices = ['zone-tower', 'dist-dock', regPreset.id, encPreset.id];
    const closeSpy = vi.fn();
    let finalFlow: MacroReplaceFlowState | null = replaceFlow;
    for (const choiceId of choices) {
      selectMacroReplacementOption(finalFlow!, { id: choiceId, label: choiceId, kind: 'option' }, {
        stores: productionExecuteStores(),
        runMacroSteps: executeMacro,
        setMacroReplaceFlow: (f) => { finalFlow = f; },
        setMacroStatus: statusSpy,
        recordCommandUsage: vi.fn(),
        closeSpeedPanel: closeSpy,
      });
    }
    expect(finalFlow).toBeNull();
    expect(closeSpy).toHaveBeenCalled();
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Migrate Preset Macro');
    expect(useProjectStore.getState().project.zones.find((z) => z.id === 'zone-tower')?.parentDistrictId).toBe('dist-dock');
  });

  // === Part 4: Starter Kits speedPanelPresets & non-overwriting merge ===

  it('changed: Starter Kit speedPanelPresets export, parse, drop unknown IDs with warnings, and merge without overwriting user macros/pins', () => {
    const kitMacro: SpeedPanelMacro = {
      id: 'kit-m1',
      name: 'Shared Macro',
      steps: [
        { actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 3 } },
        { actionId: 'fit-content' },
      ],
    };
    const userExistingMacro: SpeedPanelMacro = {
      id: 'user-m1',
      name: 'Shared Macro',
      steps: [{ actionId: 'open-review' }],
    };
    useSpeedPanelPins.getState().addMacro(userExistingMacro);
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['edit-props', 'duplicate']);

    const kitWithPresets: StarterKit = buildKitWithSpeedPanelPresets(
      { ...BUILTIN_KITS[0], id: 'custom-sp-kit', name: 'Harbor Kit', builtIn: false },
      { pins: ['fit-content', 'edit-props'], macros: [kitMacro] },
    );
    const serialized = serializeKit(kitWithPresets);
    expect(serialized.bundleVersion).toBe(1);
    expect(serialized.speedPanelPresets?.pins).toEqual(['fit-content', 'edit-props']);
    expect(serialized.speedPanelPresets?.macros).toEqual([kitMacro]);

    // Inject unknown pin ID + unknown macro step command ID and confirm warnings + clean drops
    const corruptedBundle = {
      ...JSON.parse(JSON.stringify(serialized)),
      speedPanelPresets: {
        pins: ['fit-content', 'nonexistent-pin-cmd'],
        macros: [
          kitMacro,
          { id: 'bad-step-m', name: 'Has Unknown', steps: [{ actionId: 'unknown-cmd' }, { actionId: 'fit-content' }] },
        ],
      },
    };
    const parsed = parseKitBundle(corruptedBundle);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.bundle.speedPanelPresets?.pins).toEqual(['fit-content']);
      expect(parsed.warnings.some((w) => w.includes('nonexistent-pin-cmd'))).toBe(true);
      expect(parsed.warnings.some((w) => w.includes('unknown-cmd'))).toBe(true);
    }

    const prep = prepareKitImport(corruptedBundle);
    expect(prep.ok).toBe(true);
    if (prep.ok) {
      expect(prep.kit.speedPanelPresets?.pins).toEqual(['fit-content']);
    }

    // Direct validateKit check warns cleanly on unknown pin/macro command IDs
    const kitVal = validateKit({
      ...kitWithPresets,
      speedPanelPresets: {
        pins: ['ghost-pin'],
        macros: [{ id: 'm-ghost', name: 'Ghost', steps: [{ actionId: 'ghost-step' }] }],
      },
    });
    expect(kitVal.valid).toBe(true);
    expect(kitVal.warnings.some((w) => w.includes('ghost-pin'))).toBe(true);
    expect(kitVal.warnings.some((w) => w.includes('ghost-step'))).toBe(true);
    expect(sanitizeKitSpeedPanelPresets(['not-a-record']).warnings[0]).toContain('malformed');

    // Merge into existing user store: preserves existing pins & existing macro name clash renames incoming cleanly
    const merge1 = useSpeedPanelPins.getState().mergeKitPresets(
      { pins: ['duplicate', 'fit-content', 'unknown-id'], macros: [kitMacro] },
      'Harbor Kit',
    );
    expect(merge1.addedPins).toEqual(['fit-content']);
    expect(merge1.warnings.some((w) => w.includes('unknown-id'))).toBe(true);
    expect(merge1.renamedMacros).toEqual([{ from: 'Shared Macro', to: 'Shared Macro (Harbor Kit)' }]);
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['edit-props', 'duplicate', 'fit-content']);
    expect(useSpeedPanelPins.getState().macros.map((m) => m.name)).toEqual([
      'Shared Macro',
      'Shared Macro (Harbor Kit)',
    ]);

    // Re-applying same kit macro content is idempotent; distinct content still disambiguates without clobbering
    const mergeRepeat = useSpeedPanelPins.getState().mergeKitPresets({ pins: [], macros: [kitMacro] }, 'Harbor Kit');
    expect(mergeRepeat.addedMacros).toEqual([]);
    expect(useSpeedPanelPins.getState().macros).toHaveLength(2);

    const updatedKitMacro: SpeedPanelMacro = {
      ...kitMacro,
      steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 8 } }],
    };
    const merge2 = useSpeedPanelPins.getState().mergeKitPresets({ pins: [], macros: [updatedKitMacro] }, 'Harbor Kit');
    expect(merge2.renamedMacros).toEqual([{ from: 'Shared Macro', to: 'Shared Macro (Harbor Kit 2)' }]);
  });

  // === Additional Coverage: project-ops, argless atomic steps, sanitizePins, & SSR ===

  it('changed: covers pure project-ops, atomic argless macro ops, SSR views, and sanitizePins', () => {
    const base = makeRichProject();
    const regRes = applyRegionPresetToProject(base, base.districts[0].id, BUILTIN_REGION_PRESETS[0], 'merge');
    expect(regRes.applied).toBe(true);
    expect(applyRegionPresetToProject(base, 'no-such-dist', BUILTIN_REGION_PRESETS[0], 'merge').applied).toBe(false);

    const encCreated = createEncounterFromPresetInProject(regRes.project, 'zone-tower', BUILTIN_ENCOUNTER_PRESETS[0]);
    expect(encCreated.project.encounterAnchors.some((e) => e.id === encCreated.id)).toBe(true);

    const merged = mergeZonesInProject(encCreated.project, [base.zones[0].id, 'zone-tower']);
    expect(merged.mergedId).toBeTruthy();
    expect(mergeZonesInProject(base, [base.zones[0].id]).mergedId).toBeNull();
    expect(mergeZonesInProject(base, ['missing-a', 'missing-b']).mergedId).toBeNull();

    const sel: SelectionSet = { ...emptySelection(), zones: ['zone-tower'] };
    const afterRemove = removeSelectedFromProject(base, sel);
    expect(afterRemove.zones.some((z) => z.id === 'zone-tower')).toBe(false);

    // Argless atomic macro execution covering delete connection, swap-direction, duplicate, merge-zones, fit-content, export-summary
    const dlSpy = vi.fn();
    const atomicStores = {
      ...productionExecuteStores(),
      updateProject: useProjectStore.getState().updateProject,
    };
    const cId = `${base.zones[0].id}::${base.zones[1].id}`;
    const swapRes = executeMacroAtomic(
      {
        id: 'm-conn',
        name: 'Swap Conn',
        steps: [{ actionId: 'swap-direction' }, { actionId: 'delete' }],
      },
      { type: 'connection', id: cId },
      { ...atomicStores, project: makeRichProject() },
    );
    expect(swapRes.completed).toBe(2);

    const dupRes = executeMacroAtomic(
      {
        id: 'm-dup',
        name: 'Dup + Props',
        steps: [{ actionId: 'duplicate' }, { actionId: 'edit-props' }],
      },
      { type: 'zone', id: base.zones[0].id },
      atomicStores,
    );
    expect(dupRes.completed).toBe(2);

    const utilRes = executeMacroAtomic(
      {
        id: 'm-util',
        name: 'Fit + Export',
        steps: [{ actionId: 'fit-content' }, { actionId: 'export-summary' }],
      },
      null,
      {
        ...atomicStores,
        downloadFile: dlSpy,
      },
    );
    expect(utilRes.completed).toBe(2);
    expect(dlSpy).toHaveBeenCalled();

    const mergeMacroRes = executeMacroAtomic(
      { id: 'm-merge', name: 'Merge Two', steps: [{ actionId: 'merge-zones' }] },
      { type: 'zone', id: base.zones[0].id },
      {
        ...atomicStores,
        selection: { ...emptySelection(), zones: [base.zones[0].id, base.zones[1].id] },
      },
    );
    expect(mergeMacroRes.reason).toBeUndefined();
    expect(mergeMacroRes.completed).toBe(1);

    // Sanitize pins drops invalid / duplicates with warning
    const pinWarns: string[] = [];
    expect(sanitizePins(['fit-content', 'fit-content', 'bad-id', 123], pinWarns)).toEqual(['fit-content']);
    expect(pinWarns).toHaveLength(1);
    expect(KNOWN_ACTION_IDS.has('create-macro-from-recent')).toBe(true);

    // SSR smoke check for unpinned Band 4 macro & modals with Speed Panel preset UI
    useEditorStore.getState().openSpeedPanel(40, 40, { type: 'zone', id: 'zone-tower' });
    useSpeedPanelPins.getState().addMacro({
      id: 'ssr-m',
      name: 'Unpinned SSR Macro',
      pinned: false,
      steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 5 } }],
    });
    const spHtml = renderToStaticMarkup(createElement(SpeedPanel));
    expect(spHtml).toContain('Unpinned SSR Macro');
    expect(spHtml).toContain('wf-sp-band-4-macros');
    expect(renderToStaticMarkup(createElement(SaveKitModal, { onClose: () => {} }))).toContain('wf-save-kit-include-speed-panel');
    expect(renderToStaticMarkup(createElement(ImportKitModal, { onClose: () => {} }))).toContain('Import Starter Kit');
    useKitStore.setState({
      kits: [
        {
          ...BUILTIN_KITS[0],
          id: 'kit-ssr-sp',
          builtIn: false,
          speedPanelPresets: { pins: ['fit-content'], macros: [{ id: 'km', name: 'KM', steps: [{ actionId: 'fit-content' }] }] },
        },
      ],
    });
    requestTemplateManagerTab('starters');
    const tmHtml = renderToStaticMarkup(createElement(TemplateManager, { onClose: () => {} }));
    expect(tmHtml).toContain('wf-kit-export-include-speed-panel');
    expect(tmHtml).toContain('wf-kit-apply-speed-panel-kit-ssr-sp');

    // Merge current Speed Panel presets onto a kit that ALREADY has existing presets (kits/bundle.ts lines 228-234)
    const kitExisting: StarterKit = {
      ...BUILTIN_KITS[0],
      id: 'k-existing',
      builtIn: false,
      speedPanelPresets: {
        pins: ['edit-props'],
        macros: [{ id: 'm1', name: 'Existing', steps: [{ actionId: 'edit-props' }] }],
      },
    };
    const mergedKit = buildKitWithSpeedPanelPresets(kitExisting, {
      pins: ['fit-content', 'edit-props'],
      macros: [
        { id: 'm1', name: 'Duplicate ID Skipped', steps: [{ actionId: 'fit-content' }] },
        { id: 'm2', name: 'Added', steps: [{ actionId: 'fit-content' }] },
      ],
    });
    expect(mergedKit.speedPanelPresets?.pins).toEqual(['edit-props', 'fit-content']);
    expect(mergedKit.speedPanelPresets?.macros.map((m) => m.id)).toEqual(['m1', 'm2']);

    // Callback & panel branch coverage: create-macro row trigger, 2-zone direct merge, macroReplaceFlow nav/back, fatal macro validation
    useProjectStore.getState().loadProject(makeRichProject());
    const pState = useProjectStore.getState().project;
    useEditorStore.getState().selectAll({ ...emptySelection(), zones: [pState.zones[0].id, pState.zones[1].id] }, false);
    const mergeRowRes = executeSpeedPanelRowOrStep(
      { command: getCommandById('merge-zones')!, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: pState.zones[0].id },
        query: '',
        lastPanelAction: null,
        executeCommand: () => ({ executed: true }),
        stores: productionExecuteStores(),
        stepStores: productionStepStores(),
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow: vi.fn(),
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast: vi.fn(),
      },
    );
    expect(mergeRowRes).toBe('closed');
    useProjectStore.getState().undo();

    const createCmdRow = { command: getCommandById('create-macro-from-recent')!, badge: null, disabledReason: null };
    const openCreateSpy = vi.fn();
    const cbCreate = makeCallbacksHarness({ setCreateMacroState: openCreateSpy });
    expect(cbCreate.execute(createCmdRow)).toBe('kept-open');
    expect(openCreateSpy).toHaveBeenCalled();

    let navReplace: MacroReplaceFlowState | null = {
      macro: { id: 'm', name: 'M', steps: [{ actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'missing' } }] },
      context: { type: 'zone', id: pState.zones[0].id },
      missingRefs: [{
        key: '0:district',
        stepIndex: 0,
        refKind: 'district',
        missingId: 'missing',
        stepLabel: 'Assign District',
        title: 'Replace missing district',
        options: pState.districts.map((d) => ({ id: d.id, label: d.name, kind: 'option' as const })),
      }],
      currentIndex: 0,
      replacements: {},
      filter: '',
      activeIdx: 0,
    };
    const replaceFixture: MacroReplaceFlowState = { ...navReplace! };
    const refocusSpy = vi.fn();
    const cbReplace = makeCallbacksHarness({
      macroReplaceFlow: navReplace,
      setMacroReplaceFlow: (next: MacroReplaceFlowState | null) => { navReplace = next; },
      refocusSearch: refocusSpy,
    });
    cbReplace.handleKeyDown({
      key: 'ArrowDown',
      code: 'ArrowDown',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(navReplace?.activeIdx).toBe(1);
    cbReplace.onStepBackReplace();
    expect(navReplace).toBeNull();
    expect(refocusSpy).toHaveBeenCalled();

    // Fatal validation paths (0 districts / 0 zones / unknown command / 0 presets)
    const statusFatal = vi.fn();
    expect(executeSpeedPanelMacro(
      { id: 'unk', name: 'Unknown', steps: [{ actionId: 'nonexistent-cmd' }] },
      {
        context: null,
        runMacroSteps: executeMacro,
        stores: productionExecuteStores(),
        setMacroStatus: statusFatal,
        recordCommandUsage: vi.fn(),
        closeSpeedPanel: vi.fn(),
      },
    )).toBe(false);
    expect(statusFatal).toHaveBeenCalled();

    const emptyZonesProj = { ...makeRichProject(), zones: [], districts: [], connections: [] };
    expect(validateMacroExecution(
      { id: 'mv', name: 'V', steps: [{ actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'x' } }] },
      emptyZonesProj,
      [],
      [],
      { type: 'zone', id: 'missing-z' },
      emptySelection(),
    ).ok).toBe(false);
    expect(validateMacroExecution(
      { id: 'mv-nozone', name: 'V0', steps: [{ actionId: 'place-encounter', args: { kind: 'place-encounter', encounterType: 'trap' } }] },
      emptyZonesProj,
      [],
      [],
      null,
      emptySelection(),
    ).ok).toBe(false);
    expect(validateMacroExecution(
      { id: 'mv-pickz', name: 'Vp', steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 2 } }] },
      makeRichProject(),
      [],
      [],
      null,
      emptySelection(),
    ).missingRefs[0]?.key).toBe('target-zone');
    expect(validateMacroExecution(
      { id: 'mv-nodist', name: 'Vnd', steps: [{ actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'x' } }] },
      { ...makeRichProject(), districts: [] },
      [],
      [],
      { type: 'zone', id: 'zone-tower' },
      emptySelection(),
    ).ok).toBe(false);
    expect(validateMacroExecution(
      { id: 'mv2', name: 'V2', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: 'x', applyMode: 'merge' } }] },
      { ...makeRichProject(), districts: [] },
      [],
      [],
      { type: 'zone', id: 'zone-tower' },
      emptySelection(),
    ).ok).toBe(false);
    const regId = BUILTIN_REGION_PRESETS[0].id;
    expect(validateMacroExecution(
      { id: 'mv2b', name: 'V2b', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: regId, applyMode: 'merge' } }] },
      { ...makeRichProject(), districts: [] },
      BUILTIN_REGION_PRESETS,
      [],
      { type: 'zone', id: 'zone-tower' },
      emptySelection(),
    ).ok).toBe(false);
    expect(validateMacroExecution(
      { id: 'mv2c', name: 'V2c', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: regId, applyMode: 'merge' } }] },
      makeRichProject(),
      BUILTIN_REGION_PRESETS,
      [],
      { type: 'zone', id: 'zone-tower' },
      emptySelection(),
    ).missingRefs[0]?.refKind).toBe('district');
    expect(validateMacroExecution(
      { id: 'mv3', name: 'V3', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-encounter-preset', presetId: 'x' } }] },
      makeRichProject(),
      BUILTIN_REGION_PRESETS,
      [],
      { type: 'zone', id: 'zone-tower' },
      emptySelection(),
    ).ok).toBe(false);

    // Atomic macro edge & error abort paths for high coverage on speed-panel-macros.ts
    expect(executeMacroAtomic({ id: 'e', name: 'Empty', steps: [] }, null, atomicStores).completed).toBe(0);
    expect(executeMacroAtomic(
      { id: 'unk2', name: 'U2', steps: [{ actionId: 'unknown-action-id' }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-dist', name: 'BD', steps: [{ actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'missing' } }] },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-z-dist', name: 'BZD', steps: [{ actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'dist-dock' } }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-rp', name: 'BRP', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: regId, applyMode: 'merge' } }] },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-ep-id', name: 'BEP', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-encounter-preset', presetId: 'missing-ep' } }] },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-ep-z', name: 'BEPZ', steps: [{ actionId: 'apply-preset', args: { kind: 'apply-encounter-preset', presetId: BUILTIN_ENCOUNTER_PRESETS[0].id } }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-pe-z', name: 'BPEZ', steps: [{ actionId: 'place-encounter', args: { kind: 'place-encounter', encounterType: 'trap' } }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-pe-v', name: 'BPEV', steps: [{ actionId: 'place-encounter', args: { kind: 'place-encounter', encounterType: '   ' } }] },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-el-z', name: 'BELZ', steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 1 } }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-el-v', name: 'BELV', steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: Number.NaN } }] },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-dup', name: 'BDUP', steps: [{ actionId: 'duplicate' }] },
      null,
      { ...atomicStores, selection: emptySelection() },
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'dup-sel', name: 'DSEL', steps: [{ actionId: 'duplicate' }] },
      { type: 'entity', id: pState.entityPlacements[0].entityId },
      atomicStores,
    ).completed).toBe(1);
    expect(executeMacroAtomic(
      { id: 'bad-del', name: 'BDEL', steps: [{ actionId: 'delete' }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-conn', name: 'BCONN', steps: [{ actionId: 'swap-direction' }] },
      { type: 'connection', id: 'bad-conn-format' },
      {
        ...atomicStores,
        project: {
          ...atomicStores.project,
          connections: [...atomicStores.project.connections],
        },
      },
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-mz', name: 'BMZ', steps: [{ actionId: 'merge-zones' }] },
      { type: 'zone', id: pState.zones[0].id },
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'bad-exp', name: 'BEXP', steps: [{ actionId: 'export-summary' }] },
      null,
      { ...atomicStores, downloadFile: undefined },
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'open-rev', name: 'OR', steps: [{ actionId: 'open-review' }] },
      null,
      atomicStores,
    ).completed).toBe(1);
    expect(executeMacroAtomic(
      { id: 'nz-fallback', name: 'NZ', steps: [{ actionId: 'new-zone' }] },
      null,
      atomicStores,
    ).abortedAt).toBe(0);
    expect(executeMacroAtomic(
      { id: 'del-z', name: 'Del Tower', steps: [{ actionId: 'delete' }] },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
    ).completed).toBe(1);
    const propsRes = executeMacroAtomic(
      { id: 'ep', name: 'Edit Props', steps: [{ actionId: 'edit-props' }, { actionId: 'assign-district' }] },
      { type: 'zone', id: pState.zones[0].id },
      atomicStores,
    );
    expect(propsRes.completed).toBe(2);
    expect(pState.entityPlacements[0]).toBeDefined();
    if (pState.entityPlacements[0]) {
      expect(executeMacroAtomic(
        { id: 'ee', name: 'Ent', steps: [{ actionId: 'edit-props' }] },
        { type: 'entity', id: pState.entityPlacements[0].entityId },
        atomicStores,
      ).completed).toBe(1);
    }
    expect(pState.landmarks[0]).toBeDefined();
    if (pState.landmarks[0]) {
      expect(executeMacroAtomic(
        { id: 'el', name: 'Lm', steps: [{ actionId: 'edit-props' }] },
        { type: 'landmark', id: pState.landmarks[0].id },
        atomicStores,
      ).completed).toBe(1);
    }
    expect(pState.spawnPoints[0]).toBeDefined();
    if (pState.spawnPoints[0]) {
      expect(executeMacroAtomic(
        { id: 'es', name: 'Sp', steps: [{ actionId: 'edit-props' }] },
        { type: 'spawn', id: pState.spawnPoints[0].id },
        atomicStores,
      ).completed).toBe(1);
    }
    expect(executeMacroAtomic(
      { id: 'cprops', name: 'CP', steps: [{ actionId: 'edit-props' }] },
      { type: 'connection', id: `${pState.zones[0].id}::${pState.zones[1].id}` },
      atomicStores,
    ).completed).toBe(1);

    // SSR smoke check for CreateMacroView (populated + error + empty) and MacroReplaceFlow views inside SpeedPanel
    useEditorStore.getState().openSpeedPanel(40, 40, { type: 'zone', id: 'zone-tower' });
    const createHtmlPopulated = renderToStaticMarkup(createElement(SpeedPanel, {
      initialCreateMacroState: {
        entries: [
          {
            id: 'act-ssr',
            commandId: 'set-elevation',
            label: 'Set Elevation: 10m',
            timestamp: 1,
            args: { kind: 'set-elevation', elevation: 10 },
          },
        ],
        selectedIds: ['act-ssr'],
        name: 'My SSR Macro',
        pinToPanel: true,
        error: 'Sample error',
      },
    }));
    expect(createHtmlPopulated).toContain('wf-sp-create-macro-view');
    expect(createHtmlPopulated).toContain('wf-sp-create-macro-error');
    const createHtmlEmpty = renderToStaticMarkup(createElement(SpeedPanel, {
      initialCreateMacroState: { entries: [], selectedIds: [], name: '', pinToPanel: false, error: null },
    }));
    expect(createHtmlEmpty).toContain('No recent replayable actions');
    const replaceHtml = renderToStaticMarkup(createElement(SpeedPanel, {
      initialMacroReplaceFlow: replaceFixture,
    }));
    expect(replaceHtml).toContain('wf-sp-step-view');

    // Final branch polish: command run, parameterized macro without updateProject, project-store removeSelected/mergeZones null, sanitize edge inputs, kit export/merge helpers
    const crCmd = getCommandById('create-macro-from-recent')!;
    expect(crCmd.run({ hit: null, stores: productionExecuteStores(), selection: emptySelection(), project: useProjectStore.getState().project }).executed).toBe(true);
    expect(executeMacro(
      { id: 'args-no-up', name: 'No Up', steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 4 } }] },
      { type: 'zone', id: pState.zones[0].id },
      { ...productionExecuteStores(), updateProject: undefined },
    ).abortedAt).toBe(0);
    useProjectStore.getState().loadProject(makeRichProject());
    useProjectStore.getState().removeSelected({ ...emptySelection(), zones: ['zone-tower'] });
    expect(useProjectStore.getState().mergeZones(['only-one'])).toBeNull();
    expect(sanitizePins('not-an-array')).toEqual([]);
    expect(sanitizeMacros([{ id: 'm-nonstep', name: 'N', steps: ['not-an-obj', { actionId: 'fit-content' }] }])).toHaveLength(1);
    const exportNoSp = buildExportBundleForKit(BUILTIN_KITS[0], { includeSpeedPanel: false });
    expect('speedPanelPresets' in exportNoSp.bundle).toBe(false);
    const exportWithSp = buildExportBundleForKit(BUILTIN_KITS[0], {
      includeSpeedPanel: true,
      currentPresets: { pins: ['fit-content'], macros: [] },
    });
    expect(exportWithSp.bundle.speedPanelPresets?.pins).toEqual(['fit-content']);
    const warnNotice = mergeKitSpeedPanelPresetsIfEnabled(
      { ...BUILTIN_KITS[0], speedPanelPresets: { pins: ['bad-pin-id'], macros: [] } },
      true,
      (p, n) => useSpeedPanelPins.getState().mergeKitPresets(p, n),
    );
    expect(warnNotice?.level).toBe('warning');
    const infoNotice = mergeKitSpeedPanelPresetsIfEnabled(
      { ...BUILTIN_KITS[0], speedPanelPresets: { pins: ['open-review'], macros: [] } },
      true,
      (p, n) => useSpeedPanelPins.getState().mergeKitPresets(p, n),
    );
    expect(infoNotice?.level).toBe('info');
    expect(mergeKitSpeedPanelPresetsIfEnabled(BUILTIN_KITS[0], false, () => ({ addedPins: [], addedMacros: [], warnings: [] }))).toBeNull();

    // Additional speed-panel-ui & speed-panel-macros branches
    expect(cbReplace.onSelectReplaceOption({ id: 'opt', label: 'Opt', kind: 'option' })).toBeUndefined();
    const failMergeRow = executeSpeedPanelRowOrStep(
      { command: getCommandById('merge-zones')!, badge: null, disabledReason: null },
      {
        context: { type: 'zone', id: pState.zones[0].id },
        query: '',
        lastPanelAction: null,
        executeCommand: () => ({ executed: true }),
        stores: productionExecuteStores(),
        stepStores: { ...productionStepStores(), selection: { ...emptySelection(), zones: [pState.zones[0].id, pState.zones[1].id] }, mergeZones: () => null },
        hotkeyCtx: productionHotkeyContext(),
        closeSpeedPanel: vi.fn(),
        setStepFlow: vi.fn(),
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        pushToast: vi.fn(),
      },
    );
    expect(failMergeRow).toBe('blocked');
    expect(selectMacroReplacementOption(replaceFixture, { id: pState.districts[0].id, label: 'D', kind: 'option' }, {
      stores: { ...productionExecuteStores(), updateProject: undefined },
      runMacroSteps: () => ({ completed: 0, total: 1, abortedAt: 0, reason: 'mock abort', steps: [], totalSteps: 1, completedSteps: 0 }),
      setMacroReplaceFlow: vi.fn(),
      setMacroStatus: vi.fn(),
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(false);
    expect(selectMacroReplacementOption({ ...replaceFixture, missingRefs: [] }, { id: 'x', label: 'X', kind: 'option' }, {
      stores: productionExecuteStores(),
      runMacroSteps: executeMacro,
      setMacroReplaceFlow: vi.fn(),
      setMacroStatus: vi.fn(),
      recordCommandUsage: vi.fn(),
      closeSpeedPanel: vi.fn(),
    })).toBe(false);
    const validMacroProj = makeRichProject();
    expect(validateMacroExecution(
      {
        id: 'ok-m',
        name: 'Valid M',
        steps: [
          { actionId: 'assign-district', args: { kind: 'assign-district', districtId: validMacroProj.districts[0].id } },
          { actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: BUILTIN_REGION_PRESETS[0].id, applyMode: 'merge' } },
        ],
      },
      validMacroProj,
      BUILTIN_REGION_PRESETS,
      BUILTIN_ENCOUNTER_PRESETS,
      { type: 'zone', id: validMacroProj.zones[0].id },
      emptySelection(),
    ).ok).toBe(true);
    // overrideDistrictId via byStepKey without prior assign-district + applyRegionPreset failure check
    expect(executeMacroAtomic(
      {
        id: 'override-dist',
        name: 'Override Dist',
        steps: [{ actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: BUILTIN_REGION_PRESETS[0].id, applyMode: 'merge' } }],
      },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
      { byStepKey: { '0:district': atomicStores.project.districts[0].id } },
    ).completed).toBe(1);
    expect(executeMacroAtomic(
      {
        id: 'override-bad-dist',
        name: 'Override Bad Dist',
        steps: [{ actionId: 'apply-preset', args: { kind: 'apply-region-preset', presetId: BUILTIN_REGION_PRESETS[0].id, applyMode: 'merge' } }],
      },
      { type: 'zone', id: 'zone-tower' },
      atomicStores,
      { byStepKey: { '0:district': 'no-such-dist' } },
    ).abortedAt).toBe(0);
    // Also exercise connection + swap-direction on missing conn
    expect(executeMacroAtomic(
      { id: 'swap-miss', name: 'SM', steps: [{ actionId: 'swap-direction' }] },
      { type: 'connection', id: 'z1::z999' },
      atomicStores,
    ).completed).toBe(1);
    expect(executeMacroAtomic(
      { id: 'del-conn-bad', name: 'DCB', steps: [{ actionId: 'delete' }] },
      { type: 'connection', id: 'malformed-id' },
      atomicStores,
    ).abortedAt).toBe(0);

    // Hit applySelectionForHit encounter branch, connection delete, & all removeSelectedFromProject entity collections (project-ops 100%)
    const encProj = makeRichProject();
    expect(encProj.encounterAnchors[0]).toBeDefined();
    if (encProj.encounterAnchors[0]) {
      expect(executeMacroAtomic(
        { id: 'enc-ep', name: 'EP', steps: [{ actionId: 'edit-props' }] },
        { type: 'encounter', id: encProj.encounterAnchors[0].id },
        { ...atomicStores, project: encProj },
      ).completed).toBe(1);
    }
    const cleanMergeProj = {
      ...encProj,
      zones: [
        ...encProj.zones,
        {
          ...encProj.zones[0],
          id: 'zm-a',
          name: 'MA',
          neighbors: [],
          exits: [],
        },
        {
          ...encProj.zones[0],
          id: 'zm-b',
          name: 'MB',
          neighbors: [],
          exits: [],
        },
      ],
    };
    expect(executeMacroAtomic(
      { id: 'clean-merge', name: 'Clean Merge', steps: [{ actionId: 'merge-zones' }] },
      { type: 'zone', id: 'zm-a' },
      { ...atomicStores, project: cleanMergeProj, selection: { ...emptySelection(), zones: ['zm-a', 'zm-b'] } },
    ).completed).toBe(1);
    const fullPopProj = {
      ...encProj,
      itemPlacements: [{ itemId: 'it1', zoneId: 'zone-tower', name: 'I' }] as unknown as typeof encProj.itemPlacements,
      marketNodes: [{ id: 'mk1', zoneId: 'zone-tower', name: 'M' }] as unknown as typeof encProj.marketNodes,
      craftingStations: [{ id: 'st1', zoneId: 'zone-tower', name: 'S' }] as unknown as typeof encProj.craftingStations,
      buildings: [{ id: 'b1', zoneId: 'zone-tower', name: 'B' }] as unknown as typeof encProj.buildings,
      hubs: [{ id: 'h1', zoneId: 'zone-tower', name: 'H' }] as unknown as typeof encProj.hubs,
      strongholds: [{ id: 'sh1', zoneId: 'zone-tower', name: 'SH' }] as unknown as typeof encProj.strongholds,
      propPlacements: [{ id: 'pr1', zoneId: 'zone-tower', propType: 'crate', gridX: 0, gridY: 0 }] as unknown as typeof encProj.propPlacements,
      tileLayers: [{ id: 'tl1', name: 'L1', tiles: [{ x: 1, y: 1, tileId: 't1' }] }] as unknown as typeof encProj.tileLayers,
    };
    const cleaned = removeSelectedFromProject(fullPopProj, {
      ...emptySelection(),
      items: ['it1'],
      markets: ['mk1'],
      stations: ['st1'],
      buildings: ['b1'],
      hubs: ['h1'],
      strongholds: ['sh1'],
      props: ['pr1'],
      tiles: ['tl1:1:1'],
    });
    expect(cleaned.itemPlacements).toEqual([]);
    expect(cleaned.marketNodes).toEqual([]);
    expect(cleaned.craftingStations).toEqual([]);
    expect(cleaned.buildings).toEqual([]);
    expect(cleaned.hubs).toEqual([]);
    expect(cleaned.strongholds).toEqual([]);
    expect(cleaned.propPlacements).toEqual([]);
    const overwriteNullEco = applyRegionPresetToProject(
      fullPopProj,
      fullPopProj.districts[0].id,
      { ...BUILTIN_REGION_PRESETS[0], economyProfile: { supplyCategories: undefined as unknown as string[], scarcityDefaults: undefined as unknown as Record<string, number> } },
      'overwrite',
    );
    expect(overwriteNullEco.applied).toBe(true);
  });

  // === PR #66 Fix 1 Tests (Parts 1, 2, 4, 5, 6, 7) ===

  it('changed: Part 1 macro Delete on a zone with attached entity, landmark, and encounter equals Delete by hand', () => {
    const rich = makeRichProject();
    const targetZoneId = rich.zones[0].id;
    rich.entityPlacements.push({
      entityId: 'ent-orphan-check',
      name: 'Gate Guard',
      zoneId: targetZoneId,
      role: 'npc',
    });
    rich.landmarks.push({
      id: 'lm-orphan-check',
      name: 'Stone Arch',
      zoneId: targetZoneId,
      gridX: 1,
      gridY: 1,
      tags: [],
      interactionType: 'inspect',
    });
    rich.encounterAnchors.push({
      id: 'enc-orphan-check',
      zoneId: targetZoneId,
      encounterType: 'patrol',
      enemyIds: [],
      probability: 0.5,
      cooldownTurns: 3,
      tags: [],
    });

    useProjectStore.getState().loadProject(structuredClone(rich));
    const undoBefore = useProjectStore.getState().getUndoCount();
    const res = executeMacro(
      { id: 'm-del-zone', name: 'Delete Rich Zone', steps: [{ actionId: 'delete' }] },
      { type: 'zone', id: targetZoneId },
      buildExecuteStores(),
    );
    expect(res.completed).toBe(1);
    expect(res.abortedAt).toBeUndefined();
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Delete Rich Zone');
    const macroProj = structuredClone(useProjectStore.getState().project);

    useProjectStore.getState().loadProject(structuredClone(rich));
    const handCmd = getCommandById('delete')!;
    const handRes = handCmd.run({
      hit: { type: 'zone', id: targetZoneId },
      stores: productionExecuteStores(),
      selection: useEditorStore.getState().selection,
      project: useProjectStore.getState().project,
    });
    expect(handRes.executed).toBe(true);
    const handProj = structuredClone(useProjectStore.getState().project);

    expect(macroProj).toEqual(handProj);
    expect(macroProj.zones.some((z) => z.id === targetZoneId)).toBe(false);
    expect(macroProj.entityPlacements.some((e) => e.entityId === 'ent-orphan-check')).toBe(true);
    expect(macroProj.landmarks.some((l) => l.id === 'lm-orphan-check')).toBe(true);
    expect(macroProj.encounterAnchors.some((a) => a.id === 'enc-orphan-check')).toBe(true);
  });

  it('changed: Part 2 argless parameterized step never calls live stores and mid-run abort leaves project + undo unchanged', () => {
    const initialProj = structuredClone(useProjectStore.getState().project);
    const updateZoneSpy = vi.fn();
    const updateProjSpy = vi.fn((updater, label) => useProjectStore.getState().updateProject(updater, label));
    const storesWithSpies = {
      ...buildExecuteStores(),
      updateZone: updateZoneSpy,
      updateProject: updateProjSpy,
    };

    const arglessElevMacro: SpeedPanelMacro = {
      id: 'm-argless-elev',
      name: 'Assign Then Missing Elev',
      steps: [
        { actionId: 'assign-district', args: { kind: 'assign-district', districtId: 'dist-dock' } },
        { actionId: 'set-elevation' },
      ],
    };

    const valRes = validateMacroExecution(
      arglessElevMacro,
      useProjectStore.getState().project,
      BUILTIN_REGION_PRESETS,
      BUILTIN_ENCOUNTER_PRESETS,
      { type: 'zone', id: 'zone-tower' },
      emptySelection(),
    );
    expect(valRes.ok).toBe(false);
    if (!valRes.ok) {
      expect(valRes.error).toContain('requires saved parameters');
    }

    const undoBefore = useProjectStore.getState().getUndoCount();
    const execRes = executeMacro(arglessElevMacro, { type: 'zone', id: 'zone-tower' }, storesWithSpies);
    expect(execRes.abortedAt).toBe(1);
    expect(execRes.completed).toBe(0);
    expect(updateZoneSpy).not.toHaveBeenCalled();
    expect(updateProjSpy).not.toHaveBeenCalled();
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);
    expect(useProjectStore.getState().project).toEqual(initialProj);

    // Parameterized Set Elevation runs atomically in workingProject -> 1 undo entry -> equals hand commitSetElevation
    const elevMacro: SpeedPanelMacro = {
      id: 'm-param-elev',
      name: 'Elevate Tower',
      steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 22 } }],
    };
    const elevMacroRes = executeMacro(elevMacro, { type: 'zone', id: 'zone-tower' }, buildExecuteStores());
    expect(elevMacroRes.completed).toBe(1);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Elevate Tower');
    const macroElevProj = structuredClone(useProjectStore.getState().project);

    useProjectStore.getState().loadProject(structuredClone(initialProj));
    commitSetElevation(productionStepStores(), ['zone-tower'], '22');
    expect(macroElevProj).toEqual(useProjectStore.getState().project);
  });

  it('changed: Part 4 default kit export is opt-in and never mixes user macros into bare or pre-populated kits', () => {
    const userMacro: SpeedPanelMacro = { id: 'u-priv', name: 'Private User Macro', steps: [{ actionId: 'fit-content' }] };
    const currentPresets = { pins: ['fit-content', 'edit-props'], macros: [userMacro] };

    // Built-in kit without presets: default export has no speedPanelPresets
    const defaultBuiltin = buildExportBundleForKit(BUILTIN_KITS[0], {
      includeSpeedPanel: false,
      currentPresets,
    });
    expect('speedPanelPresets' in defaultBuiltin.bundle).toBe(false);

    // Kit with its own presets: default export exports ONLY kit's own presets
    const kitOwnMacro: SpeedPanelMacro = { id: 'k-own', name: 'Kit Own', steps: [{ actionId: 'open-review' }] };
    const kitWithOwn: StarterKit = {
      ...BUILTIN_KITS[0],
      id: 'kit-own',
      builtIn: false,
      speedPanelPresets: { pins: ['open-review'], macros: [kitOwnMacro] },
    };
    const defaultOwn = buildExportBundleForKit(kitWithOwn, {
      includeSpeedPanel: false,
      currentPresets,
    });
    expect(defaultOwn.bundle.speedPanelPresets).toEqual({ pins: ['open-review'], macros: [kitOwnMacro] });

    // Starter Kits UI starts export checkbox unchecked AND renders Import preview + SaveKitModal
    useKitStore.setState({ kits: [...BUILTIN_KITS, kitWithOwn] });
    const tmHtml = renderToStaticMarkup(createElement(TemplateManager, { onClose: () => {}, initialTab: 'starters' }));
    expect(tmHtml).toContain('wf-kit-export-include-speed-panel');
    expect(tmHtml).toContain('wf-kit-apply-speed-panel-kit-own');
    expect(tmHtml).not.toContain('data-testid="wf-kit-export-include-speed-panel" checked=""');

    const importPreviewHtml = renderToStaticMarkup(createElement(ImportKitModal, {
      onClose: () => {},
      initialResult: {
        ok: true,
        kit: kitWithOwn,
        parseWarnings: [],
        validationWarnings: [],
        validationErrors: [],
        isValid: true,
      },
    }));
    expect(importPreviewHtml).toContain('Speed Panel pins');
  });

  it('changed: Part 5 applying the same kit twice is idempotent for pins and macros', () => {
    const kitMacro: SpeedPanelMacro = {
      id: 'dup-check',
      name: 'Zone Setup',
      steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 6 } }],
    };
    useSpeedPanelPins.setState({
      pinnedIds: ['edit-props'],
      macros: [{ id: 'existing-diff', name: 'Zone Setup', steps: [{ actionId: 'fit-content' }] }],
    });

    const first = useSpeedPanelPins.getState().mergeKitPresets({ pins: ['fit-content'], macros: [kitMacro] }, 'Harbor Kit');
    expect(first.addedPins).toEqual(['fit-content']);
    expect(first.addedMacros.map((m) => m.name)).toEqual(['Zone Setup (Harbor Kit)']);
    const afterFirstCount = useSpeedPanelPins.getState().macros.length;

    const second = useSpeedPanelPins.getState().mergeKitPresets({ pins: ['fit-content'], macros: [kitMacro] }, 'Harbor Kit');
    expect(second.addedPins).toEqual([]);
    expect(second.addedMacros).toEqual([]);
    expect(useSpeedPanelPins.getState().macros).toHaveLength(afterFirstCount);
    expect(useSpeedPanelPins.getState().macros.map((m) => m.name)).toEqual(['Zone Setup', 'Zone Setup (Harbor Kit)']);
  });

  it('changed: Part 6 caps pins/macros/steps with warnings, keeps argless empty-canvas behavior, and matches hand merge selection rule', () => {
    // 1) Caps + warnings
    const regIds = [...KNOWN_ACTION_IDS];
    expect(regIds.length).toBeGreaterThan(MAX_IMPORTED_PINS);
    const pinWarnings: string[] = [];
    const cappedPins = sanitizePins(regIds, pinWarnings);
    expect(cappedPins).toHaveLength(MAX_IMPORTED_PINS);
    expect(pinWarnings.some((w) => w.includes('Trimmed Speed Panel pins'))).toBe(true);

    const malformedStepMacroWarnings: string[] = [];
    const manyStepsMacro = {
      id: 'many-steps',
      name: 'Too Many Steps',
      steps: Array.from({ length: MAX_MACRO_STEPS + 4 }, () => ({ actionId: regIds[0] })),
    };
    const manyMacros = Array.from({ length: MAX_IMPORTED_MACROS + 3 }, (_, i) => ({
      id: `mm-${i}`,
      name: `Macro ${i}`,
      steps: [{ actionId: regIds[0] }],
    }));
    const trimmedSteps = sanitizeMacros([
      manyStepsMacro,
      { id: 'bad-args', name: 'Bad Args', steps: [{ actionId: 'set-elevation', args: { kind: 'set-elevation', elevation: 'oops' } }] },
    ], malformedStepMacroWarnings);
    expect(trimmedSteps[0].steps).toHaveLength(MAX_MACRO_STEPS);
    expect(malformedStepMacroWarnings.some((w) => w.includes('Trimmed steps'))).toBe(true);
    expect(malformedStepMacroWarnings.some((w) => w.includes('Dropped malformed macro step args'))).toBe(true);

    const macroCapWarnings: string[] = [];
    const cappedMacros = sanitizeMacros(manyMacros, macroCapWarnings);
    expect(cappedMacros).toHaveLength(MAX_IMPORTED_MACROS);
    expect(macroCapWarnings.some((w) => w.includes('Trimmed Speed Panel macros'))).toBe(true);

    // 2) Old argless macro on empty canvas: NO target-zone prompt, aborts with context mismatch
    const oldArgless: SpeedPanelMacro = { id: 'old-ad', name: 'Old Assign', steps: [{ actionId: 'assign-district' }] };
    const oldVal = validateMacroExecution(
      oldArgless,
      useProjectStore.getState().project,
      BUILTIN_REGION_PRESETS,
      BUILTIN_ENCOUNTER_PRESETS,
      null,
      emptySelection(),
    );
    expect(oldVal).toEqual({ ok: true, missingRefs: [] });
    const oldRes = executeMacro(oldArgless, null, buildExecuteStores());
    expect(oldRes.abortedAt).toBe(0);
    expect(oldRes.reason).toContain('context mismatch');

    // 3) merge-zones macro matches hand selection rule
    const mergeMacro: SpeedPanelMacro = { id: 'm-merge', name: 'Merge Macro', steps: [{ actionId: 'merge-zones' }] };
    const pClean = makeRichProject();
    pClean.zones.push(
      { ...pClean.zones[0], id: 'mz-1', name: 'Merge A', neighbors: [], exits: [] },
      { ...pClean.zones[0], id: 'mz-2', name: 'Merge B', neighbors: [], exits: [] },
    );
    useProjectStore.getState().loadProject(structuredClone(pClean));
    useEditorStore.getState().selectZone('mz-1', false); // only 1 zone selected -> hand-run fails
    const singleSelMerge = executeMacro(mergeMacro, { type: 'zone', id: 'mz-2' }, buildExecuteStores());
    expect(singleSelMerge.abortedAt).toBe(0);
    expect(singleSelMerge.reason).toContain('need at least 2 zones');

    useEditorStore.getState().selectZone('mz-1', false);
    useEditorStore.getState().selectZone('mz-2', true);
    const twoSelRes = executeMacro(mergeMacro, { type: 'zone', id: 'mz-1' }, buildExecuteStores());
    expect(twoSelRes.completed).toBe(1);
    const macroMergedZones = structuredClone(useProjectStore.getState().project.zones);

    useProjectStore.getState().loadProject(structuredClone(pClean));
    useEditorStore.getState().selectZone('mz-1', false);
    useEditorStore.getState().selectZone('mz-2', true);
    const handMergeCmd = getCommandById('merge-zones')!;
    expect(handMergeCmd.run({
      hit: { type: 'zone', id: 'mz-1' },
      stores: productionExecuteStores(),
      selection: useEditorStore.getState().selection,
      project: useProjectStore.getState().project,
    }).executed).toBe(true);
    const handMergedZones = structuredClone(useProjectStore.getState().project.zones);
    expect(macroMergedZones.map((z) => ({ ...z, id: z.id.startsWith('zone-') ? 'merged' : z.id })))
      .toEqual(handMergedZones.map((z) => ({ ...z, id: z.id.startsWith('zone-') ? 'merged' : z.id })));
  });
});
