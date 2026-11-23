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
import {
  ADAPTIVE_DAILY_DECAY,
  MS_PER_DAY,
  computeDecayedAdaptiveScore,
  matchCommand,
  searchCommands,
} from '../speed-panel-search.js';
import { executeRegistryCommand } from '../speed-panel-execute.js';
import { productionExecuteStores, productionHotkeyContext, productionStepStores } from '../panels/speed-panel-stores.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import {
  advanceStepChoice,
  buildEncounterAnchor,
  cancelSpatialPick,
  classifyEncounterTypeForExport,
  commitDistrictAssignment,
  commitPlaceEncounter,
  commitSetElevation,
  commitSpatialPickTarget,
  createCanvasSpatialPickHandlers,
  createRepeatLastCommand,
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
import {
  createSpeedPanelCallbacks,
  customGroupHeadingId,
  handleScalarPillKeyDown,
  handleStepChoiceSelect,
  resolveStepKeyAction,
} from '../speed-panel-ui.js';

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
    expect(useProjectStore.getState().getUndoLabel()).toBe('Create district "Sunken Crypt" and assign');
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
    expect(useProjectStore.getState().getUndoLabel()).toBe(
      `Apply preset "${firstPreset!.label}" to ${proj.districts[0].name} (overwrite)`,
    );

    // 2) Standalone zone -> encounter preset with AI RPG badge
    const standaloneZone = useProjectStore.getState().project.zones.find((z) => !z.parentDistrictId)!;
    const standaloneZoneId = standaloneZone.id;
    const openStandalone = openCommandStepFlow('apply-preset', { type: 'zone', id: standaloneZoneId }, productionStepStores());
    expect(openStandalone.kind).toBe('steps');
    if (openStandalone.kind !== 'steps') return;
    expect(openStandalone.flow.steps[0].stepId).toBe('pick-encounter-preset');
    const encOpt = openStandalone.flow.steps[0].kind === 'choice' ? openStandalone.flow.steps[0].options[0] : null;
    const encApplied = advanceStepChoice(openStandalone.flow, encOpt!, productionStepStores());
    expect(encApplied.done).toBe(true);
    expect(useProjectStore.getState().getUndoLabel()).toBe(
      `Apply encounter preset "${encOpt!.label}" in ${standaloneZone.name}`,
    );

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

    // Committing valid target creates exact connection matching outside-panel behavior (non-Shift ends pick)
    const connUndoBefore = useProjectStore.getState().getUndoCount();
    const connDone = commitSpatialPickTarget(cycled, zones[1].id, false, productionStepStores());
    expect(connDone.committed).toBe(true);
    expect(connDone.finished).toBe(true);
    expect(useProjectStore.getState().getUndoCount()).toBe(connUndoBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe(
      `Connect ${zones[0].name} \u2192 ${zones[1].name} (${cycled.connectionKind})`,
    );
    expect(useProjectStore.getState().project.connections.some(
      (c) => c.fromZoneId === zones[0].id && c.toZoneId === zones[1].id && c.kind === cycled.connectionKind,
    )).toBe(true);

    // Shift+Click in Connect mode chains multiple targets from the same source, each with 1 descriptive undo entry
    const openedChain = openCommandStepFlow('connect-from', { type: 'zone', id: zones[0].id }, productionStepStores());
    expect(openedChain.kind).toBe('pick');
    if (openedChain.kind !== 'pick') return;
    const chainUndo0 = useProjectStore.getState().getUndoCount();
    const firstChain = commitSpatialPickTarget(openedChain.pick, zones[1].id, true, productionStepStores());
    expect(firstChain.committed).toBe(true);
    expect(firstChain.finished).toBe(false);
    expect(firstChain.pick?.sourceZoneId).toBe(zones[0].id);
    expect(useEditorStore.getState().speedPanelPick?.sourceZoneId).toBe(zones[0].id);
    expect(useProjectStore.getState().getUndoCount()).toBe(chainUndo0 + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe(
      `Connect ${zones[0].name} \u2192 ${zones[1].name} (${openedChain.pick.connectionKind})`,
    );

    const secondChain = commitSpatialPickTarget(firstChain.pick!, zones[2].id, false, productionStepStores());
    expect(secondChain.committed).toBe(true);
    expect(secondChain.finished).toBe(true);
    expect(useEditorStore.getState().speedPanelPick).toBeNull();
    expect(useProjectStore.getState().getUndoCount()).toBe(chainUndo0 + 2);
    expect(useProjectStore.getState().getUndoLabel()).toBe(
      `Connect ${zones[0].name} \u2192 ${zones[2].name} (${openedChain.pick.connectionKind})`,
    );
    // Undoing each chained connection individually reverts target 2 then target 1
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().getUndoLabel()).toBe(
      `Connect ${zones[0].name} \u2192 ${zones[1].name} (${openedChain.pick.connectionKind})`,
    );
    useProjectStore.getState().undo();

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

  it('changed: enforces panel-vs-outside parity, descriptive undo labels and Esc invariants across all 5 mechanisms, pick safety, props/tiles Esc selection, and input-step Back + filter carryover', () => {
    const zones = useProjectStore.getState().project.zones;
    const z0 = zones[0];
    const z1 = zones[1];
    const z2 = zones[2];

    // 1) Encounter parity: outside-panel buildEncounterAnchor + addEncounter vs panel commitPlaceEncounter (ignoring id)
    useProjectStore.getState().addEncounter(buildEncounterAnchor(z0.id, 'patrol'));
    const toolAnchor = useProjectStore.getState().project.encounterAnchors.at(-1)!;
    expect(toolAnchor).toMatchObject({
      zoneId: z0.id,
      encounterType: 'patrol',
      enemyIds: [],
      probability: 0.5,
      cooldownTurns: 3,
      tags: [],
    });
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add encounter');

    const panelEncRes = commitPlaceEncounter(productionStepStores(), z0.id, 'patrol');
    expect(panelEncRes.ok).toBe(true);
    const panelAnchor = useProjectStore.getState().project.encounterAnchors.at(-1)!;
    expect(panelAnchor).toMatchObject({
      zoneId: z0.id,
      encounterType: 'patrol',
      enemyIds: [],
      probability: 0.5,
      cooldownTurns: 3,
      tags: [],
    });
    expect({ ...panelAnchor, id: 'ignored' }).toEqual({ ...toolAnchor, id: 'ignored' });
    expect(useProjectStore.getState().getUndoLabel()).toBe(`Place patrol encounter in ${z0.name}`);

    // Parity & outside-panel label checks for connection and single-zone update
    const outsideConnBefore = useProjectStore.getState().project.connections.length;
    useProjectStore.getState().addConnection({ fromZoneId: z0.id, toZoneId: z2.id, bidirectional: true, kind: 'trail' });
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add connection');
    const outsideConn = useProjectStore.getState().project.connections[outsideConnBefore];

    useProjectStore.getState().undo();
    const pickConnOpen = openCommandStepFlow('add-trail-conn', { type: 'zone', id: z0.id }, productionStepStores());
    expect(pickConnOpen.kind).toBe('pick');
    if (pickConnOpen.kind !== 'pick') return;
    commitSpatialPickTarget(pickConnOpen.pick, z2.id, false, productionStepStores());
    expect(useProjectStore.getState().project.connections.at(-1)).toEqual(outsideConn);
    expect(useProjectStore.getState().getUndoLabel()).toBe(`Connect ${z0.name} \u2192 ${z2.name} (trail)`);

    // 2) Undo-label + single-undo verification for Assign District, + Create District, Set Elevation, Merge, Repeat Last
    const dist = useProjectStore.getState().project.districts[0];
    const undoAssignBefore = useProjectStore.getState().getUndoCount();
    expect(commitDistrictAssignment(productionStepStores(), [z1.id], dist.id)).toEqual({ ok: true });
    expect(useProjectStore.getState().getUndoCount()).toBe(undoAssignBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe(`Assign ${z1.name} to ${dist.name}`);

    const undoElevMultiBefore = useProjectStore.getState().getUndoCount();
    commitSetElevation(productionStepStores(), [z0.id, z1.id, z2.id], '2');
    expect(useProjectStore.getState().getUndoCount()).toBe(undoElevMultiBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Set elevation to 2 (3 zones)');

    const undoElevSingleBefore = useProjectStore.getState().getUndoCount();
    commitSetElevation(productionStepStores(), [z0.id], '');
    expect(useProjectStore.getState().getUndoCount()).toBe(undoElevSingleBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe(`Clear elevation (${z0.name})`);
    // Outside-panel updateZone label remains untouched
    useProjectStore.getState().updateZone(z0.id, { elevation: 4 });
    expect(useProjectStore.getState().getUndoLabel()).toBe('Update zone');

    // Descriptive Repeat Last undo label + single undo entry
    const undoRepeatBefore = useProjectStore.getState().getUndoCount();
    const repeatRes = replayLastPanelAction(
      { commandId: 'set-elevation', label: 'Set Elevation: 2m', timestamp: 1, params: { kind: 'set-elevation', elevation: 7 } },
      { type: 'zone', id: z1.id },
      productionStepStores(),
      { executeStores: productionExecuteStores(), hotkeyCtx: productionHotkeyContext(), executeDirect: executeRegistryCommand },
    );
    expect(repeatRes).toEqual({ status: 'done' });
    expect(useProjectStore.getState().getUndoCount()).toBe(undoRepeatBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe(`Set elevation to 7 (${z1.name})`);

    // Descriptive Merge pick undo label + single undo entry (and outside-panel default labels remain unchanged)
    const mergeStart = openCommandStepFlow('merge-zones', { type: 'zone', id: z0.id }, productionStepStores());
    expect(mergeStart.kind).toBe('pick');
    if (mergeStart.kind !== 'pick') return;
    const undoMergeBefore = useProjectStore.getState().getUndoCount();
    commitSpatialPickTarget(mergeStart.pick, z2.id, false, productionStepStores());
    expect(useProjectStore.getState().getUndoCount()).toBe(undoMergeBefore + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe(`Merge ${z0.name} + ${z2.name}`);
    useProjectStore.getState().undo();

    const outsideRegPreset = usePresetStore.getState().regionPresets[0];
    const outsideEncPreset = usePresetStore.getState().encounterPresets[0];
    useProjectStore.getState().applyRegionPreset(dist.id, outsideRegPreset, 'merge');
    expect(useProjectStore.getState().getUndoLabel()).toBe('Apply region preset');
    useProjectStore.getState().undo();
    useProjectStore.getState().createEncounterFromPreset(z0.id, outsideEncPreset);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add encounter from preset');
    useProjectStore.getState().undo();
    useProjectStore.getState().mergeZones([z0.id, z1.id]);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Merge 2 zones');
    useProjectStore.getState().undo();

    // 3) Esc at every step against real stores leaves project, undo stack, and selection untouched
    useEditorStore.getState().selectEntity('npc-keeper', false);
    const snapProject = structuredClone(useProjectStore.getState().project);
    const snapUndo = useProjectStore.getState().getUndoCount();
    const snapSel = structuredClone(useEditorStore.getState().selection);

    const mkKey = (key: string) => ({
      key,
      code: key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
    });

    // Step-stack choice Esc + input Esc (both pure key resolution AND real-store createSpeedPanelCallbacks dispatch)
    const escStep = openCommandStepFlow('assign-district', { type: 'zone', id: z0.id }, productionStepStores());
    expect(escStep.kind).toBe('steps');
    if (escStep.kind === 'steps') {
      expect(resolveStepKeyAction(mkKey('Escape'), escStep.flow, [], 0, '')).toEqual({ type: 'cancel' });
      useEditorStore.getState().openSpeedPanel(40, 40, { type: 'zone', id: z0.id });
      const choiceCbs = createSpeedPanelCallbacks({
        context: { type: 'zone', id: z0.id },
        selection: useEditorStore.getState().selection,
        zones: useProjectStore.getState().project.zones,
        query: '',
        view: buildSpeedPanelView(COMMAND_REGISTRY, { hit: { type: 'zone', id: z0.id }, selection: useEditorStore.getState().selection }, ''),
        allNavigable: [],
        activeIdx: 0,
        lastPanelAction: null,
        stepFlow: escStep.flow,
        filteredStepOptions: escStep.flow.steps[0].kind === 'choice' ? escStep.flow.steps[0].options : [],
        stepActiveIdx: 0,
        stepFilter: '',
        stepInputDraft: '',
        scalarPill: null,
        scalarPillRef: { current: null },
        executeCommand: executeRegistryCommand,
        runMacroSteps: vi.fn(() => ({ completed: 0, total: 0, steps: [], totalSteps: 0, completedSteps: 0 })),
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
      });
      choiceCbs.handleKeyDown({ ...mkKey('Escape'), preventDefault: vi.fn(), stopPropagation: vi.fn() });
      expect(useEditorStore.getState().showSpeedPanel).toBe(false);

      expect(escStep.flow.steps[0].kind).toBe('choice');
      const createOpt = escStep.flow.steps[0].kind === 'choice'
        ? escStep.flow.steps[0].options.find((o) => o.kind === 'create')!
        : null;
      const inStep = advanceStepChoice(escStep.flow, createOpt!, productionStepStores(), 'Cliff Quarter');
      expect(inStep.done).toBe(false);
      // 7) "+ Create District" carries current filter text AND Backspace on empty input goes Back
      if (!inStep.done && inStep.flow.steps[1].kind === 'input') {
        expect(inStep.flow.steps[1].value).toBe('Cliff Quarter');
        expect(resolveStepKeyAction(mkKey('Backspace'), inStep.flow, [], 0, 'Cliff Quarter')).toEqual({ type: 'none' });
        expect(resolveStepKeyAction(mkKey('Backspace'), inStep.flow, [], 0, '')).toEqual({ type: 'back' });
        expect(resolveStepKeyAction(mkKey('Escape'), inStep.flow, [], 0, 'Cliff Quarter')).toEqual({ type: 'cancel' });
        useEditorStore.getState().openSpeedPanel(40, 40, { type: 'zone', id: z0.id });
        const inputCbs = createSpeedPanelCallbacks({
          context: { type: 'zone', id: z0.id },
          selection: useEditorStore.getState().selection,
          zones: useProjectStore.getState().project.zones,
          query: '',
          view: buildSpeedPanelView(COMMAND_REGISTRY, { hit: { type: 'zone', id: z0.id }, selection: useEditorStore.getState().selection }, ''),
          allNavigable: [],
          activeIdx: 0,
          lastPanelAction: null,
          stepFlow: inStep.flow,
          filteredStepOptions: [],
          stepActiveIdx: 0,
          stepFilter: '',
          stepInputDraft: 'Cliff Quarter',
          scalarPill: null,
          scalarPillRef: { current: null },
          executeCommand: executeRegistryCommand,
          runMacroSteps: vi.fn(() => ({ completed: 0, total: 0, steps: [], totalSteps: 0, completedSteps: 0 })),
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
        });
        inputCbs.handleKeyDown({ ...mkKey('Escape'), preventDefault: vi.fn(), stopPropagation: vi.fn() });
        expect(useEditorStore.getState().showSpeedPanel).toBe(false);
      }
      // handleStepChoiceSelect forwards stepFilter into advanceStepChoice
      let pushedFlow: StepStackState | null = null;
      handleStepChoiceSelect(escStep.flow, createOpt!, {
        query: '',
        stepFilter: 'Docks Ward',
        stepStores: productionStepStores(),
        setStepFlow: (f) => { pushedFlow = f; },
        setStepFilter: vi.fn(),
        setStepActiveIdx: vi.fn(),
        recordCommandUsage: vi.fn(),
        closeSpeedPanel: vi.fn(),
      });
      const pushed = pushedFlow as StepStackState | null;
      expect(pushed?.steps[1]?.kind === 'input' ? pushed.steps[1].value : null).toBe('Docks Ward');
    }

    // Backspace on empty custom-encounter-type input step also goes Back
    const encStep = openCommandStepFlow('place-encounter', { type: 'zone', id: z0.id }, productionStepStores());
    expect(encStep.kind).toBe('steps');
    if (encStep.kind === 'steps') {
      expect(encStep.flow.steps[0].kind).toBe('choice');
      if (encStep.flow.steps[0].kind === 'choice') {
        const customOpt = encStep.flow.steps[0].options.find((o) => o.kind === 'create')!;
        const customInput = advanceStepChoice(encStep.flow, customOpt, productionStepStores());
        expect(customInput.done).toBe(false);
        if (!customInput.done) {
          expect(resolveStepKeyAction(mkKey('Backspace'), customInput.flow, [], 0, '')).toEqual({ type: 'back' });
        }
      }
    }

    // Typed scalar pill Esc leaves project, undo stack, and selection unchanged
    handleScalarPillKeyDown(
      { key: 'Escape', preventDefault: vi.fn(), stopPropagation: vi.fn() },
      { commandId: 'set-elevation', targetZoneIds: [z0.id], value: '999', error: null },
      { query: 'elev', stepStores: productionStepStores(), setScalarPill: vi.fn(), recordCommandUsage: vi.fn(), closeSpeedPanel: vi.fn(), refocusSearch: vi.fn() },
    );

    // Connect & Merge & Repeat picks Esc leaves project, undo stack, and selection unchanged
    const escConn = openCommandStepFlow('connect-from', { type: 'zone', id: z0.id }, productionStepStores());
    expect(escConn.kind).toBe('pick');
    if (escConn.kind === 'pick') cancelSpatialPick(escConn.pick, productionStepStores());
    const escMerge = openCommandStepFlow('merge-zones', { type: 'zone', id: z0.id }, productionStepStores());
    expect(escMerge.kind).toBe('pick');
    if (escMerge.kind === 'pick') cancelSpatialPick(escMerge.pick, productionStepStores());
    const escRepeat = replayLastPanelAction(
      { commandId: 'connect-from', label: 'Connect', timestamp: 1 },
      { type: 'zone', id: z0.id },
      productionStepStores(),
      { executeStores: productionExecuteStores(), hotkeyCtx: productionHotkeyContext(), executeDirect: executeRegistryCommand },
    );
    expect(escRepeat.status).toBe('pick');
    if (escRepeat.status === 'pick') cancelSpatialPick(escRepeat.pick, productionStepStores());

    expect(useProjectStore.getState().project).toEqual(snapProject);
    expect(useProjectStore.getState().getUndoCount()).toBe(snapUndo);
    expect(useEditorStore.getState().selection).toEqual(snapSel);

    // 4) Pick session safety: deleted source zone during Connect refuses and ends pick; load/undo/redo/reopen clear pick
    const startConnectA = openCommandStepFlow('connect-from', { type: 'zone', id: z0.id }, productionStepStores());
    expect(startConnectA.kind).toBe('pick');
    if (startConnectA.kind === 'pick') {
      useEditorStore.getState().setSpeedPanelPick(startConnectA.pick);
      useProjectStore.getState().removeZone(z0.id);
      const toastSpy = vi.fn();
      const handlers = createCanvasSpatialPickHandlers({
        getPick: () => useEditorStore.getState().speedPanelPick,
        getProject: () => useProjectStore.getState().project,
        findZoneIdAtGrid: () => z1.id,
        setPick: (p) => useEditorStore.getState().setSpeedPanelPick(p),
        getStores: productionStepStores,
        onErrorToast: toastSpy,
      });
      const connsBefore = useProjectStore.getState().project.connections.length;
      expect(validatePickTarget(startConnectA.pick, z1.id, useProjectStore.getState().project)).toBe('Source zone no longer exists');
      expect(handlers.handleMouseDown(z1.gridX + 1, z1.gridY + 1, false)).toBe(true);
      expect(useProjectStore.getState().project.connections.length).toBe(connsBefore);
      expect(useEditorStore.getState().speedPanelPick).toBeNull();
      expect(toastSpy).toHaveBeenCalledWith('Source zone no longer exists');
    }

    // Undo/Redo/loadProject/newProject/openSpeedPanel all clear an active pick
    const dummyPickOpen = openCommandStepFlow('connect-from', { type: 'zone', id: z1.id }, productionStepStores());
    expect(dummyPickOpen.kind).toBe('pick');
    if (dummyPickOpen.kind === 'pick') {
      useEditorStore.getState().setSpeedPanelPick(dummyPickOpen.pick);
      useProjectStore.getState().undo();
      expect(useEditorStore.getState().speedPanelPick).toBeNull();

      useEditorStore.getState().setSpeedPanelPick(dummyPickOpen.pick);
      useProjectStore.getState().redo();
      expect(useEditorStore.getState().speedPanelPick).toBeNull();

      useEditorStore.getState().setSpeedPanelPick(dummyPickOpen.pick);
      useEditorStore.getState().openSpeedPanel(10, 10, null);
      expect(useEditorStore.getState().speedPanelPick).toBeNull();

      useEditorStore.getState().setSpeedPanelPick(dummyPickOpen.pick);
      useProjectStore.getState().newProject();
      expect(useEditorStore.getState().speedPanelPick).toBeNull();

      useProjectStore.getState().loadProject(makeTwoZoneProject());
      const mergePick = openCommandStepFlow('merge-zones', { type: 'zone', id: z0.id }, productionStepStores());
      expect(mergePick.kind).toBe('pick');
      if (mergePick.kind === 'pick') {
        const twoPicked = commitSpatialPickTarget(mergePick.pick, z1.id, true, productionStepStores()).pick!;
        useProjectStore.getState().removeZone(z1.id);
        expect(validatePickTarget(twoPicked, z2.id, useProjectStore.getState().project)).toBe('Picked zone no longer exists');
        const mergeErr = commitSpatialPickTarget(twoPicked, z2.id, false, productionStepStores());
        expect(mergeErr).toEqual({ committed: false, finished: true, pick: null, error: 'Picked zone no longer exists' });
        expect(finalizeMergePick(twoPicked, productionStepStores())).toEqual({ committed: false, mergedId: null });
      }
      useEditorStore.getState().setSpeedPanelPick(dummyPickOpen.pick);
      useProjectStore.getState().loadProject(makeTwoZoneProject());
      expect(useEditorStore.getState().speedPanelPick).toBeNull();
    }

    // 6) Esc keeps props-only and tiles-only selections intact
    const propsSel = { ...emptySelection(), props: ['prop-barrel'] };
    useEditorStore.getState().setSelection(propsSel);
    const propsPick = openCommandStepFlow('connect-from', { type: 'zone', id: 'zone-cellar' }, productionStepStores());
    expect(propsPick.kind).toBe('pick');
    if (propsPick.kind === 'pick') cancelSpatialPick(propsPick.pick, productionStepStores());
    expect(useEditorStore.getState().selection).toEqual(propsSel);

    const tilesSel = { ...emptySelection(), tiles: ['layer-1:2:3'] };
    useEditorStore.getState().setSelection(tilesSel);
    const tilesPick = openCommandStepFlow('connect-from', { type: 'zone', id: 'zone-cellar' }, productionStepStores());
    expect(tilesPick.kind).toBe('pick');
    if (tilesPick.kind === 'pick') cancelSpatialPick(tilesPick.pick, productionStepStores());
    expect(useEditorStore.getState().selection).toEqual(tilesSel);
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

    // Real equal-decayed-score tie test: older entry has compensated score so both decay to exactly 1.0 at baseNow + MS_PER_DAY
    const evalNow = baseNow + MS_PER_DAY;
    const tieHistory = {
      older: { commandId: 'new-zone', score: 1 / ADAPTIVE_DAILY_DECAY, lastUsedAt: baseNow },
      newer: { commandId: 'fit-content', score: 1, lastUsedAt: evalNow },
    };
    expect(computeDecayedAdaptiveScore(tieHistory.older, evalNow)).toBeCloseTo(
      computeDecayedAdaptiveScore(tieHistory.newer, evalNow),
      12,
    );
    const prunedTie = pruneAdaptiveHistory(tieHistory, evalNow, 1);
    expect(Object.keys(prunedTie)).toEqual(['newer']);

    // Tier 2 ordering check: 2.0 word-0 contiguous -> 2.1 non-first-word prefix -> 2.2 contiguous later-word initials -> 2.3 skipped word-start
    const sub20Match = matchCommand(getCommandById('add-secret-conn')!, 'dsc', { nowMs: baseNow });
    const sub21Match = matchCommand(getCommandById('add-warp-conn')!, 'warp', { nowMs: baseNow });
    const sub22Match = matchCommand(getCommandById('add-secret-conn')!, 'sc', { nowMs: baseNow });
    const sub23Match = matchCommand(getCommandById('save-preset')!, 'ssp', { nowMs: baseNow });
    expect(sub20Match).toMatchObject({ tier: 2, subRank: 0 });
    expect(sub21Match).toMatchObject({ tier: 2, subRank: 1 });
    expect(sub22Match).toMatchObject({ tier: 2, subRank: 2 });
    expect(sub23Match).toMatchObject({ tier: 2, subRank: 3 });
    expect(sub20Match!.subRank).toBeLessThan(sub21Match!.subRank);
    expect(sub21Match!.subRank).toBeLessThan(sub22Match!.subRank);
    expect(sub22Match!.subRank).toBeLessThan(sub23Match!.subRank);

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
    expect(encOpen.kind).toBe('steps');
    if (encOpen.kind === 'steps') {
      expect(encOpen.flow.steps[0].kind).toBe('choice');
      if (encOpen.flow.steps[0].kind === 'choice') {
        const customOpt = encOpen.flow.steps[0].options.find((o) => o.kind === 'create')!;
        const pushedCustom = advanceStepChoice(encOpen.flow, customOpt, productionStepStores());
        expect(pushedCustom.done).toBe(false);
        if (!pushedCustom.done) {
          const bad = submitStepInput(pushedCustom.flow, '   ', productionStepStores());
          expect(bad.done).toBe(false);
          const good = submitStepInput(pushedCustom.flow, 'my-custom-enc', productionStepStores());
          expect(good.done).toBe(true);
        }
      }
    }

    // 3) Apply Preset empty-canvas target-zone selection -> branch into region/encounter
    const emptyPresetOpen = openCommandStepFlow('apply-preset', null, productionStepStores());
    expect(emptyPresetOpen.kind).toBe('steps');
    if (emptyPresetOpen.kind === 'steps') {
      expect(emptyPresetOpen.flow.steps[0].kind).toBe('choice');
      if (emptyPresetOpen.flow.steps[0].kind === 'choice') {
        const standaloneOpt = emptyPresetOpen.flow.steps[0].options.find((o) => o.id === z2)!;
        const pickedZone = advanceStepChoice(emptyPresetOpen.flow, standaloneOpt, productionStepStores());
        expect(pickedZone.done).toBe(false);
      }
    }

    // 4) Typed connection starts, merge >=2 selected returns direct, single-zone non-shift merge commits immediately
    expect(openCommandStepFlow('add-warp-conn', { type: 'zone', id: z0 }, productionStepStores())).toMatchObject({
      kind: 'pick',
    });
    useEditorStore.getState().selectAll({ ...emptySelection(), zones: [z0, z1] }, false);
    expect(openCommandStepFlow('merge-zones', { type: 'zone', id: z0 }, productionStepStores())).toEqual({ kind: 'direct' });

    useEditorStore.getState().clearSelection();
    const mergeOpen = openCommandStepFlow('merge-zones', { type: 'zone', id: z0 }, productionStepStores());
    expect(mergeOpen.kind).toBe('pick');
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
    expect(pickWithConn.kind).toBe('pick');
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

    // Cancel preserves existing selection holding items + spawn + landmark
    useEditorStore.getState().selectAll({
      ...emptySelection(),
      landmarks: ['lm-1'],
      spawns: ['sp-1'],
      items: ['it-1'],
      markets: ['mk-1'],
    }, false);
    const pickRestoreItem = openCommandStepFlow('connect-from', { type: 'zone', id: z0 }, productionStepStores());
    expect(pickRestoreItem.kind).toBe('pick');
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
