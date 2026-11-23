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
import { useEditorStore, emptySelection } from '../store/editor-store.js';
import { usePresetStore } from '../presets/preset-store.js';
import {
  MAX_ADAPTIVE_HISTORY,
  pruneAdaptiveHistory,
  useSpeedPanelPins,
} from '../store/speed-panel-store.js';
import { COMMAND_REGISTRY, getCommandById } from '../command-registry.js';
import { buildSpeedPanelView } from '../speed-panel-layout.js';
import { matchCommand, searchCommands } from '../speed-panel-search.js';
import { executeRegistryCommand } from '../speed-panel-execute.js';
import { productionExecuteStores, productionHotkeyContext, productionStepStores } from '../panels/speed-panel-stores.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import {
  advanceStepChoice,
  cancelSpatialPick,
  classifyEncounterTypeForExport,
  commitSpatialPickTarget,
  createRepeatLastCommand,
  createValidationGuard,
  cyclePickConnectionKind,
  finalizeMergePick,
  formatPickCursorBadge,
  isMultiStepCommand,
  isSpatialPickCommand,
  openCommandStepFlow,
  popPanelStep,
  replayLastPanelAction,
  searchPickZones,
  submitStepInput,
  validateDistrictNameInput,
  validateElevationInput,
  validateEncounterTypeInput,
  validatePickTarget,
  type StepStackState,
} from '../speed-panel-steps.js';
import { customGroupHeadingId } from '../speed-panel-ui.js';

function makeTwoZoneProject() {
  const proj = structuredClone(minimalProject);
  if (proj.zones.length < 2) {
    proj.zones.push({
      id: 'zone-cellar',
      name: 'Wine Cellar',
      description: 'Cold stone vault.',
      tags: ['cellar'],
      gridX: 25,
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
  if (!proj.zones.some((z) => z.id === 'zone-tower')) {
    proj.zones.push({
      id: 'zone-tower',
      name: 'Watchtower',
      description: 'High spire.',
      tags: ['tower'],
      gridX: 40,
      gridY: 20,
      gridWidth: 6,
      gridHeight: 6,
      neighbors: [],
      exits: [],
      light: 7,
      noise: 2,
      hazards: [],
      interactables: [],
    });
  }
  if (proj.districts.length === 0) {
    proj.districts.push({
      id: 'dist-chapel',
      name: 'Chapel Ward',
      zoneIds: ['zone-entrance'],
      tags: ['sacred'],
      baseMetrics: { commerce: 40, morale: 60, safety: 55, stability: 70 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    });
  } else {
    const first = proj.districts[0];
    if (!first.zoneIds.includes(proj.zones[0].id)) {
      first.zoneIds.push(proj.zones[0].id);
    }
    proj.zones[0].parentDistrictId = first.id;
  }
  return proj;
}

function resetStores() {
  storage.clear();
  useProjectStore.getState().loadProject(makeTwoZoneProject());
  useEditorStore.getState().clearSelection();
  useEditorStore.getState().closeSpeedPanel();
  useEditorStore.getState().clearSpeedPanelPick();
  useEditorStore.getState().setLastPanelAction(null);
  useEditorStore.getState().setTool('select');
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

describe('Speed Panel C4 multi-step flows, validation, picking, export badges, and replay (changed)', () => {
  beforeEach(resetStores);

  it('changed: Mechanism 1 Assign District assigns existing district and + Create District commits in a single atomic undo entry', () => {
    const stores = productionStepStores();
    const targetZone = stores.project.zones[1].id;
    const origParentDistrictId = stores.project.zones[1].parentDistrictId;
    const hit = { type: 'zone' as const, id: targetZone };

    expect(isMultiStepCommand('assign-district')).toBe(true);
    const opened = openCommandStepFlow('assign-district', hit, stores);
    expect(opened.kind).toBe('steps');
    if (opened.kind !== 'steps') return;

    const createOpt = opened.flow.steps[0].kind === 'choice'
      ? opened.flow.steps[0].options.find((o) => o.kind === 'create')!
      : null;
    expect(createOpt).toBeTruthy();

    // Advance into + Create District text input step
    const pushed = advanceStepChoice(opened.flow, createOpt!, productionStepStores());
    expect(pushed.done).toBe(false);
    if (pushed.done) return;
    expect(pushed.flow.steps).toHaveLength(2);

    // Inline validation rejects blank and duplicate district names without mutating store
    const undoBefore = useProjectStore.getState().getUndoCount();
    const blankRes = submitStepInput(pushed.flow, '   ', productionStepStores());
    expect(blankRes.done).toBe(false);
    if (!blankRes.done) expect(blankRes.flow.error).toContain('required');
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);

    const existingName = useProjectStore.getState().project.districts[0].name;
    const dupRes = submitStepInput(pushed.flow, existingName.toLowerCase(), productionStepStores());
    expect(dupRes.done).toBe(false);
    if (!dupRes.done) expect(dupRes.flow.error).toContain('already exists');
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);

    // Valid name commits district creation + zone assignment atomically in ONE undo step
    const okRes = submitStepInput(pushed.flow, 'Sunken Crypt', productionStepStores());
    expect(okRes.done).toBe(true);
    if (!okRes.done) return;
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    const createdDistrict = useProjectStore.getState().project.districts.find((d) => d.name === 'Sunken Crypt');
    expect(createdDistrict).toBeDefined();
    expect(createdDistrict!.zoneIds).toContain(targetZone);
    expect(useProjectStore.getState().project.zones.find((z) => z.id === targetZone)?.parentDistrictId).toBe(createdDistrict!.id);

    // Single Undo removes both the district and restores the zone's prior assignment
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.districts.some((d) => d.name === 'Sunken Crypt')).toBe(false);
    expect(useProjectStore.getState().project.zones.find((z) => z.id === targetZone)?.parentDistrictId).toBe(origParentDistrictId);

    // Pop Back works cleanly between sub-step and palette root
    expect(popPanelStep(pushed.flow)?.steps).toHaveLength(1);
    expect(popPanelStep(opened.flow)).toBeNull();
  });

  it('changed: Mechanism 1 Apply Preset handles region (merge/overwrite), encounter preset, and target-zone prompt', () => {
    // 1) Zone inside a district -> region preset -> merge vs overwrite -> 1 undo
    const proj = useProjectStore.getState().project;
    const districtZoneId = proj.districts[0].zoneIds[0];
    const openDist = openCommandStepFlow('apply-preset', { type: 'zone', id: districtZoneId }, productionStepStores());
    expect(openDist.kind).toBe('steps');
    if (openDist.kind !== 'steps') return;
    const firstPreset = openDist.flow.steps[0].kind === 'choice' ? openDist.flow.steps[0].options[0] : null;
    expect(firstPreset).toBeTruthy();

    const modeStep = advanceStepChoice(openDist.flow, firstPreset!, productionStepStores());
    expect(modeStep.done).toBe(false);
    if (modeStep.done) return;
    expect(modeStep.flow.steps[1].stepId).toBe('pick-apply-mode');

    const overwriteOpt = modeStep.flow.steps[1].kind === 'choice'
      ? modeStep.flow.steps[1].options.find((o) => o.id === 'overwrite')!
      : null;
    const undoBefore = useProjectStore.getState().getUndoCount();
    const applied = advanceStepChoice(modeStep.flow, overwriteOpt!, productionStepStores());
    expect(applied.done).toBe(true);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);

    // 2) Standalone zone -> encounter preset with AI RPG badge
    const standaloneZoneId = useProjectStore.getState().project.zones.find((z) => !z.parentDistrictId)!.id;
    const openStandalone = openCommandStepFlow('apply-preset', { type: 'zone', id: standaloneZoneId }, productionStepStores());
    expect(openStandalone.kind).toBe('steps');
    if (openStandalone.kind !== 'steps') return;
    expect(openStandalone.flow.steps[0].stepId).toBe('pick-encounter-preset');
    const encOpt = openStandalone.flow.steps[0].kind === 'choice' ? openStandalone.flow.steps[0].options[0] : null;
    const encApplied = advanceStepChoice(openStandalone.flow, encOpt!, productionStepStores());
    expect(encApplied.done).toBe(true);

    // 3) Empty canvas -> target-zone step
    const openEmpty = openCommandStepFlow('apply-preset', null, productionStepStores());
    expect(openEmpty.kind).toBe('steps');
    if (openEmpty.kind === 'steps') {
      expect(openEmpty.flow.steps[0].stepId).toBe('pick-target-zone');
    }
  });

  it('changed: Mechanism 1 Place Encounter surfaces live @world-forge/export-ai-rpg badges without blocking hazard or trap types', () => {
    expect(classifyEncounterTypeForExport('patrol').status).toBe('native');
    expect(classifyEncounterTypeForExport('boss')).toMatchObject({ status: 'mapped', badgeText: 'Maps → duel' });
    expect(classifyEncounterTypeForExport('hazard').status).toBe('dropped');
    expect(classifyEncounterTypeForExport('trap').status).toBe('blocked');

    const zoneId = useProjectStore.getState().project.zones[0].id;
    const opened = openCommandStepFlow('place-encounter', { type: 'zone', id: zoneId }, productionStepStores());
    expect(opened.kind).toBe('steps');
    if (opened.kind !== 'steps') return;
    const opts = opened.flow.steps[0].kind === 'choice' ? opened.flow.steps[0].options : [];

    expect(opts.find((o) => o.id === 'patrol')?.badge?.tone).toBe('native');
    expect(opts.find((o) => o.id === 'boss')?.badge?.tone).toBe('mapped');
    expect(opts.find((o) => o.id === 'hazard')?.badge?.tone).toBe('dropped');
    expect(opts.find((o) => o.id === 'trap')?.badge?.tone).toBe('blocked');

    // Selecting 'trap' (blocked on export) or 'hazard' (dropped on export) still creates anchor cleanly!
    const undoBefore = useProjectStore.getState().getUndoCount();
    const resTrap = advanceStepChoice(opened.flow, opts.find((o) => o.id === 'trap')!, productionStepStores());
    expect(resTrap.done).toBe(true);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    expect(useProjectStore.getState().project.encounterAnchors.some((e) => e.zoneId === zoneId && e.encounterType === 'trap')).toBe(true);
  });

  it('changed: Mechanism 2 Set Elevation validates finite/blank values inline, mutates atomically across multi-zone selection, and preserves clean undo', () => {
    const zones = useProjectStore.getState().project.zones;
    useEditorStore.getState().selectAll({ ...emptySelection(), zones: [zones[0].id, zones[1].id] }, false);

    expect(validateElevationInput('not-a-number')).toEqual({
      ok: false,
      error: 'Enter a finite number in meters, or leave blank to clear.',
    });
    expect(validateElevationInput('')).toEqual({ ok: true, value: undefined });
    expect(validateElevationInput('-5.5')).toEqual({ ok: true, value: -5.5 });

    const opened = openCommandStepFlow('set-elevation', { type: 'zone', id: zones[0].id }, productionStepStores());
    expect(opened.kind).toBe('steps');
    if (opened.kind !== 'steps') return;

    const undoBefore = useProjectStore.getState().getUndoCount();
    const invalid = submitStepInput(opened.flow, 'NaN', productionStepStores());
    expect(invalid.done).toBe(false);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);

    const committed = submitStepInput(opened.flow, '-12', productionStepStores());
    expect(committed.done).toBe(true);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(-12);
    expect(useProjectStore.getState().project.zones[1].elevation).toBe(-12);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.zones[0].elevation).toBeUndefined();
    expect(useProjectStore.getState().project.zones[1].elevation).toBeUndefined();
  });

  it('changed: Mechanism 3 spatial picking handles connect Tab cycling, self-target validation, merge Shift multi-pick, off-screen search, and Esc cancel restore', () => {
    const zones = useProjectStore.getState().project.zones;
    expect(isSpatialPickCommand('connect-from')).toBe(true);
    expect(isSpatialPickCommand('merge-zones')).toBe(true);

    // Pre-existing selection & connection preserved cleanly if cancelled
    useEditorStore.getState().selectZone(zones[0].id, false);
    const openedConn = openCommandStepFlow('connect-from', { type: 'zone', id: zones[0].id }, productionStepStores());
    expect(openedConn.kind).toBe('pick');
    if (openedConn.kind !== 'pick') return;

    // Tab cycles connection kind
    const cycled = cyclePickConnectionKind(openedConn.pick, 'dungeon');
    expect(cycled.connectionKind).not.toBe(openedConn.pick.connectionKind);

    // Hover/click on self fails closed with error message
    expect(validatePickTarget(cycled, zones[0].id, useProjectStore.getState().project)).toBe('Pick a different zone to connect');
    const selfClick = commitSpatialPickTarget(cycled, zones[0].id, false, productionStepStores());
    expect(selfClick.committed).toBe(false);
    expect(selfClick.finished).toBe(false);
    expect(selfClick.error).toBe('Pick a different zone to connect');
    expect(formatPickCursorBadge(selfClick.pick!, useProjectStore.getState().project)).toEqual({
      text: 'Pick a different zone to connect',
      isError: true,
    });

    // Escape cancel restores selection without mutating project or pushing undo
    const connsBefore = useProjectStore.getState().project.connections.length;
    const undoBefore = useProjectStore.getState().getUndoCount();
    cancelSpatialPick(selfClick.pick, productionStepStores());
    expect(useEditorStore.getState().speedPanelPick).toBeNull();
    expect(useEditorStore.getState().selection.zones).toEqual([zones[0].id]);
    expect(useProjectStore.getState().project.connections.length).toBe(connsBefore);
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore);

    // Off-screen zone type-ahead finds third zone and disables self
    const matches = searchPickZones(useProjectStore.getState().project, cycled, 'watch');
    expect(matches).toEqual([{ id: 'zone-tower', name: 'Watchtower', disabledReason: null }]);

    // Committing valid target creates exact connection matching outside-panel behavior
    const connDone = commitSpatialPickTarget(cycled, zones[1].id, false, productionStepStores());
    expect(connDone.committed).toBe(true);
    expect(connDone.finished).toBe(true);
    expect(useProjectStore.getState().project.connections.some(
      (c) => c.fromZoneId === zones[0].id && c.toZoneId === zones[1].id && c.kind === cycled.connectionKind,
    )).toBe(true);

    // Single-zone Merge Zones initiates spatial pick, accumulates with Shift, commits atomically in 1 undo
    useEditorStore.getState().clearSelection();
    const openedMerge = openCommandStepFlow('merge-zones', { type: 'zone', id: zones[0].id }, productionStepStores());
    expect(openedMerge.kind).toBe('pick');
    if (openedMerge.kind !== 'pick') return;

    const shiftAdd = commitSpatialPickTarget(openedMerge.pick, zones[1].id, true, productionStepStores());
    expect(shiftAdd.finished).toBe(false);
    expect(shiftAdd.pick?.pickedZoneIds).toEqual([zones[0].id, zones[1].id]);

    const undoMergeBefore = useProjectStore.getState().getUndoCount();
    const mergedRes = finalizeMergePick(shiftAdd.pick!, productionStepStores());
    expect(mergedRes.committed).toBe(true);
    expect(mergedRes.mergedId).toBeTruthy();
    expect(useProjectStore.getState().getUndoCount()).toBe(undoMergeBefore + 1);

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.zones.some((z) => z.id === zones[0].id)).toBe(true);
    expect(useProjectStore.getState().project.zones.some((z) => z.id === zones[1].id)).toBe(true);
  });

  it('changed: async ValidationGuard drops stale completions when invalidated before resolution', async () => {
    const guard = createValidationGuard();
    let resolveFirst!: (v: string) => void;
    const firstPromise = guard.run(() => new Promise<string>((r) => { resolveFirst = r; }));

    // User switches step / cancels before async validator settles
    guard.invalidate();
    resolveFirst('late error');
    expect(await firstPromise).toEqual({ stale: true });

    const second = await guard.run(async () => 'ok');
    expect(second).toEqual({ stale: false, value: 'ok' });
  });

  it('changed: Repeat Last Action Here replays parameterized actions with deep-cloned parameters and fresh encounter IDs', () => {
    const lastAction = {
      commandId: 'place-encounter',
      label: 'Place Encounter: boss',
      timestamp: Date.now(),
      params: { kind: 'place-encounter' as const, encounterType: 'boss' },
    };
    const zones = useProjectStore.getState().project.zones;
    const repeatCmd = createRepeatLastCommand(lastAction);
    expect(repeatCmd.id).toBe('repeat-last');

    // View injects Repeat row cleanly on zone and exposes `repeat` search
    const view = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: { type: 'zone', id: zones[1].id }, selection: emptySelection(), project: useProjectStore.getState().project, supportsSpatialPick: true },
      '',
      { repeatCommand: repeatCmd },
    );
    expect(view.kind).toBe('unsearched');
    if (view.kind === 'unsearched') {
      expect(view.repeatLastRow?.command.id).toBe('repeat-last');
    }

    const r1 = replayLastPanelAction(lastAction, { type: 'zone', id: zones[0].id }, productionStepStores(), {
      executeStores: productionExecuteStores(),
      hotkeyCtx: productionHotkeyContext(),
      executeDirect: executeRegistryCommand,
    });
    const r2 = replayLastPanelAction(lastAction, { type: 'zone', id: zones[1].id }, productionStepStores(), {
      executeStores: productionExecuteStores(),
      hotkeyCtx: productionHotkeyContext(),
      executeDirect: executeRegistryCommand,
    });
    expect(r1).toEqual({ status: 'done' });
    expect(r2).toEqual({ status: 'done' });

    const bossEncounters = useProjectStore.getState().project.encounterAnchors.filter((e) => e.encounterType === 'boss');
    expect(bossEncounters.length).toBeGreaterThanOrEqual(2);
    expect(new Set(bossEncounters.map((e) => e.id)).size).toBe(bossEncounters.length);
  });

  it('changed: Part 8 adaptiveHistory preserves newly used low-score query at 200 cap, Tier 2 ranks contiguous later-word initials before skipped word-start, and custom group heading omits aria-label', () => {
    const baseNow = 1_700_000_000_000;
    const fullHistory: Record<string, { commandId: string; score: number; lastUsedAt: number }> = {};
    for (let i = 0; i < MAX_ADAPTIVE_HISTORY; i++) {
      fullHistory[`q-${i}`] = { commandId: 'new-zone', score: 10, lastUsedAt: baseNow + i };
    }
    useSpeedPanelPins.setState({ adaptiveHistory: fullHistory });
    useSpeedPanelPins.getState().recordCommandUsage('fit-content', 'fitnew', baseNow + 999);
    const after = useSpeedPanelPins.getState().adaptiveHistory;
    expect(Object.keys(after)).toHaveLength(MAX_ADAPTIVE_HISTORY);
    expect(after.fitnew?.commandId).toBe('fit-content');
    expect(after['q-0']).toBeUndefined(); // lowest recency evicted cleanly

    const prunedEqual = pruneAdaptiveHistory(fullHistory, baseNow + 1000, 2);
    expect(Object.keys(prunedEqual)).toEqual(['q-199', 'q-198']);

    // Tier 2 ordering check against Report §4 ("Contiguous word-boundary or uppercase initials (pe, sc, DM)")
    const scMatch = matchCommand(getCommandById('add-secret-conn')!, 'sc', { nowMs: baseNow });
    const sspMatch = matchCommand(getCommandById('save-preset')!, 'ssp', { nowMs: baseNow });
    expect(scMatch!.tier).toBe(2);
    expect(sspMatch!.tier).toBe(2);
    expect(scMatch!.subRank).toBeLessThan(sspMatch!.subRank);

    // Search comparing contiguous word-0 `dsc` vs later-word contiguous `sc`
    const dscRes = searchCommands(COMMAND_REGISTRY, { hit: { type: 'zone', id: 'zone-entrance' }, selection: emptySelection() }, 'dsc');
    expect(dscRes.enabled[0].command.id).toBe('add-secret-conn');
    expect(dscRes.enabled[0].tier).toBe(2);

    // Custom group heading does not emit aria-label on role="presentation"
    useSpeedPanelPins.getState().addGroup({ id: 'grp-clean', name: 'Zone Ops', actionIds: ['set-elevation'] });
    useEditorStore.getState().openSpeedPanel(40, 40, { type: 'zone', id: 'zone-entrance' });
    const html = renderToStaticMarkup(createElement(SpeedPanel));
    const headingId = customGroupHeadingId('grp-clean');
    expect(html).toContain(`id="${headingId}" role="presentation"`);
    expect(html).not.toContain(`id="${headingId}" role="presentation" aria-label=`);

    // Validation helper checks
    expect(validateDistrictNameInput('', []).ok).toBe(false);
    expect(validateEncounterTypeInput('   ').ok).toBe(false);
  });

  it('changed: covers all multi-step fallbacks, custom encounter type, existing district assignment, non-shift merge, and all Repeat Last Action replay paths', () => {
    const proj = useProjectStore.getState().project;
    const z0 = proj.zones[0].id;
    const z1 = proj.zones[1].id;
    const z2 = proj.zones[2].id;
    const d0 = proj.districts[0].id;

    // 1) Assign to existing district cleanly
    const assignOpen = openCommandStepFlow('assign-district', { type: 'zone', id: z1 }, productionStepStores());
    expect(assignOpen.kind).toBe('steps');
    if (assignOpen.kind === 'steps' && assignOpen.flow.steps[0].kind === 'choice') {
      const distOpt = assignOpen.flow.steps[0].options.find((o) => o.id === d0)!;
      const doneAssign = advanceStepChoice(assignOpen.flow, distOpt, productionStepStores());
      expect(doneAssign.done).toBe(true);
    }

    // Blocked calls when no zone targeted
    expect(openCommandStepFlow('assign-district', null, productionStepStores())).toMatchObject({ kind: 'blocked' });
    expect(openCommandStepFlow('place-encounter', null, productionStepStores())).toMatchObject({ kind: 'blocked' });
    expect(openCommandStepFlow('set-elevation', null, productionStepStores())).toMatchObject({ kind: 'blocked' });
    expect(openCommandStepFlow('connect-from', null, productionStepStores())).toMatchObject({ kind: 'blocked' });
    expect(openCommandStepFlow('merge-zones', null, productionStepStores())).toMatchObject({ kind: 'blocked' });
    expect(openCommandStepFlow('duplicate', { type: 'zone', id: z0 }, productionStepStores())).toEqual({ kind: 'direct' });

    // 2) Custom encounter type path (blank error then commit)
    const encOpen = openCommandStepFlow('place-encounter', { type: 'zone', id: z0 }, productionStepStores());
    if (encOpen.kind === 'steps' && encOpen.flow.steps[0].kind === 'choice') {
      const customOpt = encOpen.flow.steps[0].options.find((o) => o.kind === 'create')!;
      const pushedCustom = advanceStepChoice(encOpen.flow, customOpt, productionStepStores());
      if (!pushedCustom.done) {
        const bad = submitStepInput(pushedCustom.flow, '   ', productionStepStores());
        expect(bad.done).toBe(false);
        const good = submitStepInput(pushedCustom.flow, 'my-custom-enc', productionStepStores());
        expect(good.done).toBe(true);
      }
    }

    // 3) Apply Preset empty-canvas target-zone selection -> branch into region/encounter
    const emptyPresetOpen = openCommandStepFlow('apply-preset', null, productionStepStores());
    if (emptyPresetOpen.kind === 'steps' && emptyPresetOpen.flow.steps[0].kind === 'choice') {
      const standaloneOpt = emptyPresetOpen.flow.steps[0].options.find((o) => o.id === z2)!;
      const pickedZone = advanceStepChoice(emptyPresetOpen.flow, standaloneOpt, productionStepStores());
      expect(pickedZone.done).toBe(false);
    }

    // 4) Typed connection starts, merge >=2 selected returns direct, single-zone non-shift merge commits immediately
    expect(openCommandStepFlow('add-warp-conn', { type: 'zone', id: z0 }, productionStepStores())).toMatchObject({
      kind: 'pick',
    });
    useEditorStore.getState().selectAll({ ...emptySelection(), zones: [z0, z1] }, false);
    expect(openCommandStepFlow('merge-zones', { type: 'zone', id: z0 }, productionStepStores())).toEqual({ kind: 'direct' });

    useEditorStore.getState().clearSelection();
    const mergeOpen = openCommandStepFlow('merge-zones', { type: 'zone', id: z0 }, productionStepStores());
    if (mergeOpen.kind === 'pick') {
      // Clicking self returns error
      expect(commitSpatialPickTarget(mergeOpen.pick, z0, false, productionStepStores()).error).toContain('Already selected');
      // Non-shift click on z2 merges immediately
      const immediateMerge = commitSpatialPickTarget(mergeOpen.pick, z2, false, productionStepStores());
      expect(immediateMerge.committed).toBe(true);
      expect(immediateMerge.finished).toBe(true);
      useProjectStore.getState().undo();
      expect(finalizeMergePick(mergeOpen.pick, productionStepStores())).toEqual({ committed: false, mergedId: null });
    }

    // Cancel restore with non-empty entities & selectedConnection
    useEditorStore.getState().selectEntity('npc-keeper', false);
    useEditorStore.getState().selectConnection(z0, z1);
    cancelSpatialPick(null, productionStepStores());
    const pickWithConn = openCommandStepFlow('add-secret-conn', { type: 'zone', id: z0 }, productionStepStores());
    if (pickWithConn.kind === 'pick') {
      cancelSpatialPick(pickWithConn.pick, productionStepStores());
      expect(useEditorStore.getState().selectedConnection).toEqual({ from: z0, to: z1 });
    }

    // 5) Repeat Last Action Here replay paths (assign-district, region/encounter preset, set-elevation, connect-from, direct, errors)
    const runDeps = {
      executeStores: productionExecuteStores(),
      hotkeyCtx: productionHotkeyContext(),
      executeDirect: executeRegistryCommand,
    };
    const regionPresetId = usePresetStore.getState().regionPresets[0].id;
    const encPresetId = usePresetStore.getState().encounterPresets[0].id;

    expect(replayLastPanelAction(
      { commandId: 'assign-district', label: 'Assign', timestamp: 1, params: { kind: 'assign-district', districtId: d0 } },
      { type: 'zone', id: z2 },
      productionStepStores(),
      runDeps,
    )).toEqual({ status: 'done' });
    expect(replayLastPanelAction(
      { commandId: 'assign-district', label: 'Assign', timestamp: 1, params: { kind: 'assign-district', districtId: 'missing-d' } },
      { type: 'zone', id: z2 },
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'error' });

    expect(replayLastPanelAction(
      { commandId: 'apply-preset', label: 'Preset', timestamp: 1, params: { kind: 'apply-region-preset', presetId: regionPresetId, applyMode: 'merge' } },
      { type: 'zone', id: z0 },
      productionStepStores(),
      runDeps,
    )).toEqual({ status: 'done' });
    expect(replayLastPanelAction(
      { commandId: 'apply-preset', label: 'Preset', timestamp: 1, params: { kind: 'apply-region-preset', presetId: 'missing', applyMode: 'merge' } },
      { type: 'zone', id: z0 },
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'error' });

    expect(replayLastPanelAction(
      { commandId: 'apply-preset', label: 'Preset', timestamp: 1, params: { kind: 'apply-encounter-preset', presetId: encPresetId } },
      { type: 'zone', id: z1 },
      productionStepStores(),
      runDeps,
    )).toEqual({ status: 'done' });
    expect(replayLastPanelAction(
      { commandId: 'apply-preset', label: 'Preset', timestamp: 1, params: { kind: 'apply-encounter-preset', presetId: 'missing' } },
      { type: 'zone', id: z1 },
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'error' });

    expect(replayLastPanelAction(
      { commandId: 'set-elevation', label: 'Elev', timestamp: 1, params: { kind: 'set-elevation', elevation: undefined } },
      { type: 'zone', id: z1 },
      productionStepStores(),
      runDeps,
    )).toEqual({ status: 'done' });
    expect(replayLastPanelAction(
      { commandId: 'set-elevation', label: 'Elev', timestamp: 1, params: { kind: 'set-elevation', elevation: 5 } },
      null,
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'error' });

    expect(replayLastPanelAction(
      { commandId: 'connect-from', label: 'Connect', timestamp: 1 },
      { type: 'zone', id: z0 },
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'pick' });
    expect(replayLastPanelAction(
      { commandId: 'connect-from', label: 'Connect', timestamp: 1 },
      null,
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'error' });

    expect(replayLastPanelAction(
      { commandId: 'duplicate', label: 'Duplicate', timestamp: 1 },
      { type: 'zone', id: z0 },
      productionStepStores(),
      runDeps,
    )).toEqual({ status: 'done' });
    expect(replayLastPanelAction(
      { commandId: 'does-not-exist', label: 'Nope', timestamp: 1 },
      null,
      productionStepStores(),
      runDeps,
    )).toMatchObject({ status: 'error' });

    // CreateRepeatLastCommand preconditions across action types
    const repeatConnCmd = createRepeatLastCommand({ commandId: 'connect-from', label: 'Connect', timestamp: 1 });
    expect(repeatConnCmd.when({ hit: null, selection: emptySelection() })).toBe(false);
    expect(repeatConnCmd.disabledReason({ hit: null, selection: emptySelection() })).toContain('Target a zone');
    const repeatPresetCmd = createRepeatLastCommand({ commandId: 'apply-preset', label: 'Preset', timestamp: 1 });
    expect(repeatPresetCmd.when({ hit: null, selection: emptySelection() })).toBe(true);
    expect(repeatPresetCmd.disabledReason({ hit: null, selection: emptySelection() })).toContain('Target a zone');
    const repeatDupCmd = createRepeatLastCommand({ commandId: 'duplicate', label: 'Dup', timestamp: 1 });
    expect(repeatDupCmd.when({ hit: { type: 'zone', id: z0 }, selection: emptySelection() })).toBe(true);
    expect(repeatDupCmd.disabledReason({ hit: { type: 'zone', id: z0 }, selection: emptySelection() })).toBeNull();

    // Cancel restore when previousSelection holds items + spawn + landmark
    useEditorStore.getState().selectAll({
      ...emptySelection(),
      landmarks: ['lm-1'],
      spawns: ['sp-1'],
      items: ['it-1'],
      markets: ['mk-1'],
    }, false);
    const pickRestoreItem = openCommandStepFlow('connect-from', { type: 'zone', id: z0 }, productionStepStores());
    if (pickRestoreItem.kind === 'pick') {
      cancelSpatialPick(pickRestoreItem.pick, productionStepStores());
      expect(useEditorStore.getState().selection.items).toEqual(['it-1']);
    }

    // AdvanceStepChoice & commit error guards (missing zone/preset/district)
    const missingApplyMode: StepStackState = {
      commandId: 'apply-preset',
      commandLabel: 'Apply Preset',
      context: { type: 'zone', id: z0 },
      targetZoneIds: ['missing-zone'],
      targetDistrictId: 'missing-dist',
      selectedPresetId: 'missing-preset',
      steps: [{ kind: 'choice', stepId: 'pick-apply-mode', title: 'Apply', placeholder: '', options: [{ id: 'merge', label: 'Merge', kind: 'option' }] }],
      error: null,
    };
    expect(advanceStepChoice(missingApplyMode, { id: 'merge', label: 'Merge', kind: 'option' }, productionStepStores()).done).toBe(false);
    expect(advanceStepChoice({
      ...missingApplyMode,
      steps: [{ kind: 'choice', stepId: 'pick-encounter-preset', title: 'Enc', placeholder: '', options: [] }],
    }, { id: 'missing-enc', label: 'M', kind: 'option' }, productionStepStores()).done).toBe(false);
    expect(advanceStepChoice({
      ...missingApplyMode,
      steps: [{ kind: 'choice', stepId: 'pick-region-preset', title: 'Reg', placeholder: '', options: [] }],
    }, { id: 'missing-reg', label: 'M', kind: 'option' }, productionStepStores()).done).toBe(false);
    expect(advanceStepChoice({
      ...missingApplyMode,
      steps: [{ kind: 'choice', stepId: 'pick-district', title: 'Dist', placeholder: '', options: [] }],
    }, { id: 'missing-dist', label: 'M', kind: 'option' }, productionStepStores()).done).toBe(false);
    expect(advanceStepChoice({
      ...missingApplyMode,
      steps: [{ kind: 'choice', stepId: 'pick-encounter-type', title: 'Type', placeholder: '', options: [] }],
    }, { id: 'patrol', label: 'patrol', kind: 'option' }, productionStepStores()).done).toBe(false);

    // Missing district/zone/preset & empty project branches cleanly return non-mutating errors
    const s = productionStepStores();
    expect(validatePickTarget({
      commandId: 'connect-from',
      mode: 'connect',
      sourceZoneId: z0,
      pickedZoneIds: [z0],
      connectionKind: 'passage',
      cursorSX: 0,
      cursorSY: 0,
      hoveredZoneId: null,
      invalidReason: null,
      previousSelection: emptySelection(),
      previousSelectedConnection: null,
      previousTool: 'select',
    }, 'nonexistent-zone', s.project)).toBe('Target zone not found');

    expect(commitSpatialPickTarget({
      commandId: 'connect-from',
      mode: 'connect',
      sourceZoneId: z0,
      pickedZoneIds: [z0],
      connectionKind: 'passage',
      cursorSX: 0,
      cursorSY: 0,
      hoveredZoneId: null,
      invalidReason: null,
      previousSelection: emptySelection(),
      previousSelectedConnection: null,
      previousTool: 'select',
    }, 'nonexistent-zone', false, s).committed).toBe(false);

    useEditorStore.getState().clearSelection();
    const emptyS = productionStepStores();
    expect(replayLastPanelAction(
      { commandId: 'assign-district', label: 'A', timestamp: 1, params: { kind: 'assign-district', districtId: d0 } },
      null,
      emptyS,
      runDeps,
    )).toMatchObject({ status: 'error' });
    expect(replayLastPanelAction(
      { commandId: 'apply-preset', label: 'P', timestamp: 1, params: { kind: 'apply-region-preset', presetId: regionPresetId, applyMode: 'merge' } },
      null,
      emptyS,
      runDeps,
    )).toMatchObject({ status: 'error' });
    expect(replayLastPanelAction(
      { commandId: 'apply-preset', label: 'P', timestamp: 1, params: { kind: 'apply-encounter-preset', presetId: encPresetId } },
      null,
      emptyS,
      runDeps,
    )).toMatchObject({ status: 'error' });
    expect(replayLastPanelAction(
      { commandId: 'place-encounter', label: 'E', timestamp: 1, params: { kind: 'place-encounter', encounterType: 'patrol' } },
      null,
      emptyS,
      runDeps,
    )).toMatchObject({ status: 'error' });

    // Single-zone & 0-zone project edge cases
    useProjectStore.getState().loadProject({ ...structuredClone(minimalProject), zones: minimalProject.zones.slice(0, 1) });
    expect(openCommandStepFlow('merge-zones', { type: 'zone', id: minimalProject.zones[0].id }, productionStepStores())).toMatchObject({
      kind: 'blocked',
    });
    useProjectStore.getState().loadProject({ ...structuredClone(minimalProject), zones: [] });
    expect(openCommandStepFlow('apply-preset', null, productionStepStores())).toEqual({ kind: 'direct' });
  });
});
