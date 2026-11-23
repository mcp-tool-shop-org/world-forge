// speed-panel-macros.ts — recent-action macro creation, pre-execution validation, replacement prompts, and atomic execution

import { type District, type EncounterAnchor, type WorldProject } from '@world-forge/schema';
import { getCommandById, type ExecuteStores } from './command-registry.js';
import { duplicateSelected as doDuplicate } from './duplicate.js';
import type { HitResult } from './hit-testing.js';
import { nextId } from './ids.js';
import { rememberAppliedEncounterPreset, rememberAppliedRegionPreset } from './preset-actions.js';
import type { EncounterPreset, RegionPreset } from './presets/types.js';
import {
  applyRegionPresetToProject,
  createEncounterFromPresetInProject,
  mergeZonesInProject,
  removeSelectedFromProject,
} from './project-ops.js';
import { reviewSnapshotToMarkdown, summaryFilename } from './review/export-summary.js';
import {
  getMacroStepCommandId,
  type MacroExecutionResult,
  type MacroStep,
  type MacroStepResult,
  type SpeedPanelMacro,
} from './speed-panel-actions.js';
import {
  buildEncounterAnchor,
  resolveTargetZoneIds,
  validateElevationInput,
  validateEncounterTypeInput,
  type StepChoiceOption,
} from './speed-panel-steps.js';
import {
  emptySelection,
  getSelectedZoneId,
  isReplayableSessionAction,
  SELECTION_KIND_KEY,
  type SelectionKind,
  type SelectionSet,
  type SessionActionLogEntry,
} from './store/editor-store.js';
import { frameBounds } from './viewport.js';
import { buildReviewSnapshot } from '@world-forge/schema';

export type MacroRefKind = 'district' | 'region-preset' | 'encounter-preset' | 'zone';

export interface MacroMissingRefPrompt {
  key: string;
  stepIndex: number;
  refKind: MacroRefKind;
  missingId: string;
  stepLabel: string;
  title: string;
  options: StepChoiceOption[];
}

export type MacroValidationResult =
  | { ok: true; missingRefs: [] }
  | { ok: false; missingRefs: MacroMissingRefPrompt[]; error?: string };

export interface MacroReplacementMap {
  targetZoneId?: string;
  byStepKey?: Readonly<Record<string, string>>;
}

export interface MacroExecutionStores extends ExecuteStores {
  updateProject: (updater: (p: WorldProject) => WorldProject, label?: string) => void;
  regionPresets?: readonly RegionPreset[];
  encounterPresets?: readonly EncounterPreset[];
}

const ZONE_TARGETED_ARG_KINDS = new Set([
  'assign-district',
  'apply-region-preset',
  'apply-encounter-preset',
  'place-encounter',
  'set-elevation',
]);

const ARG_REQUIRED_MACRO_COMMANDS = new Set([
  'set-elevation',
  'place-encounter',
  'apply-preset',
]);

/** Build a new `SpeedPanelMacro` from checked session log entries (preserving chronological step order). */
export function createMacroFromRecentEntries(
  name: string,
  entries: readonly SessionActionLogEntry[],
  selectedIds: ReadonlySet<string>,
  options?: { pinned?: boolean; id?: string },
): { ok: true; macro: SpeedPanelMacro } | { ok: false; error: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, error: 'Macro name is required.' };
  }
  const selected = entries.filter(
    (entry) => selectedIds.has(entry.id) && isReplayableSessionAction(entry.commandId, entry.args),
  );
  if (selected.length === 0) {
    return { ok: false, error: 'Select at least one replayable recent action.' };
  }
  // Session log is stored newest-first; replay steps chronologically oldest-to-newest.
  const ordered = [...selected].reverse();
  const steps: MacroStep[] = ordered.map((entry) => ({
    actionId: entry.commandId,
    commandId: entry.commandId,
    ...(entry.args ? { args: { ...entry.args } } : {}),
  }));
  const macro: SpeedPanelMacro = {
    id: options?.id ?? nextId('macro'),
    name: trimmedName,
    steps,
    ...(options?.pinned !== undefined ? { pinned: options.pinned } : {}),
  };
  return { ok: true, macro };
}

function stepNeedsZoneTarget(step: MacroStep): boolean {
  return Boolean(step.args && ZONE_TARGETED_ARG_KINDS.has(step.args.kind));
}

/** Validate all macro steps and ID references against live project and preset stores before applying anything. */
export function validateMacroExecution(
  macro: SpeedPanelMacro,
  project: WorldProject,
  regionPresets: readonly RegionPreset[],
  encounterPresets: readonly EncounterPreset[],
  context: HitResult | null,
  selection: SelectionSet,
): MacroValidationResult {
  for (let i = 0; i < macro.steps.length; i++) {
    const step = macro.steps[i];
    const cmdId = getMacroStepCommandId(step);
    const cmd = getCommandById(cmdId);
    if (!cmd) {
      return {
        ok: false,
        missingRefs: [],
        error: `Step ${i + 1} (${cmdId}) is unknown and cannot execute.`,
      };
    }
    if (ARG_REQUIRED_MACRO_COMMANDS.has(cmdId) && !step.args) {
      const stepLabel = cmd.label ?? cmd.title;
      return {
        ok: false,
        missingRefs: [],
        error: `Step ${i + 1} (${stepLabel}) requires saved parameters and cannot run without them.`,
      };
    }
  }

  const missingRefs: MacroMissingRefPrompt[] = [];
  const rawTargets = resolveTargetZoneIds(context, selection);
  const needsZone = macro.steps.some(stepNeedsZoneTarget);

  let targetZoneValid = true;
  let simulatedDistrictId: string | undefined;

  if (context?.type === 'zone' && !project.zones.some((z) => z.id === context.id)) {
    targetZoneValid = false;
    if (project.zones.length === 0) {
      return { ok: false, missingRefs: [], error: `Zone "${context.id}" does not exist in this project.` };
    }
    missingRefs.push({
      key: 'target-zone',
      stepIndex: 0,
      refKind: 'zone',
      missingId: context.id,
      stepLabel: macro.name,
      title: `Replace missing zone "${context.id}"`,
      options: project.zones.map((z) => ({
        id: z.id,
        label: z.name,
        description: z.id,
        kind: 'option',
      })),
    });
  } else if (needsZone) {
    const validTargets = rawTargets.filter((zid) => project.zones.some((z) => z.id === zid));
    if (validTargets.length === 0) {
      targetZoneValid = false;
      if (project.zones.length === 0) {
        return { ok: false, missingRefs: [], error: 'Create or select a zone before running this macro.' };
      }
      missingRefs.push({
        key: 'target-zone',
        stepIndex: 0,
        refKind: 'zone',
        missingId: rawTargets[0] ?? 'none',
        stepLabel: macro.name,
        title: 'Choose target zone',
        options: project.zones.map((z) => ({
          id: z.id,
          label: z.name,
          description: z.id,
          kind: 'option',
        })),
      });
    } else {
      const primaryId = context?.type === 'zone' ? context.id : validTargets[0];
      simulatedDistrictId = project.districts.find((d) => d.zoneIds.includes(primaryId))?.id;
    }
  }

  for (let i = 0; i < macro.steps.length; i++) {
    const step = macro.steps[i];
    const cmdId = getMacroStepCommandId(step);
    const cmd = getCommandById(cmdId)!;
    const stepLabel = cmd.label ?? cmd.title;

    if (step.args?.kind === 'assign-district') {
      const wantedId = step.args.districtId;
      const found = project.districts.find((d) => d.id === wantedId);
      if (!found) {
        if (project.districts.length === 0) {
          return {
            ok: false,
            missingRefs: [],
            error: `District "${wantedId}" does not exist and this project has no districts.`,
          };
        }
        missingRefs.push({
          key: `${i}:district`,
          stepIndex: i,
          refKind: 'district',
          missingId: wantedId,
          stepLabel,
          title: `Replace missing district (${stepLabel})`,
          options: project.districts.map((d) => ({
            id: d.id,
            label: d.name,
            description: `${d.zoneIds.length} zone${d.zoneIds.length === 1 ? '' : 's'}`,
            kind: 'option',
          })),
        });
        // A replacement district will exist once chosen.
        simulatedDistrictId = project.districts[0].id;
      } else {
        simulatedDistrictId = found.id;
      }
    } else if (step.args?.kind === 'apply-region-preset') {
      const wantedPresetId = step.args.presetId;
      if (!regionPresets.some((p) => p.id === wantedPresetId)) {
        if (regionPresets.length === 0) {
          return {
            ok: false,
            missingRefs: [],
            error: `Region preset "${wantedPresetId}" is unavailable.`,
          };
        }
        missingRefs.push({
          key: `${i}:region-preset`,
          stepIndex: i,
          refKind: 'region-preset',
          missingId: wantedPresetId,
          stepLabel,
          title: `Replace missing region preset (${stepLabel})`,
          options: regionPresets.map((p) => ({
            id: p.id,
            label: p.name,
            description: p.description,
            kind: 'option',
          })),
        });
      }
      if (targetZoneValid && (!simulatedDistrictId || !project.districts.some((d) => d.id === simulatedDistrictId))) {
        if (project.districts.length === 0) {
          return {
            ok: false,
            missingRefs: [],
            error: 'Target zone has no district and this project has no districts for a region preset.',
          };
        }
        missingRefs.push({
          key: `${i}:district`,
          stepIndex: i,
          refKind: 'district',
          missingId: simulatedDistrictId ?? 'unassigned',
          stepLabel,
          title: `Choose district for "${stepLabel}"`,
          options: project.districts.map((d) => ({
            id: d.id,
            label: d.name,
            description: `${d.zoneIds.length} zone${d.zoneIds.length === 1 ? '' : 's'}`,
            kind: 'option',
          })),
        });
      }
    } else if (step.args?.kind === 'apply-encounter-preset') {
      const wantedPresetId = step.args.presetId;
      if (!encounterPresets.some((p) => p.id === wantedPresetId)) {
        if (encounterPresets.length === 0) {
          return {
            ok: false,
            missingRefs: [],
            error: `Encounter preset "${wantedPresetId}" is unavailable.`,
          };
        }
        missingRefs.push({
          key: `${i}:encounter-preset`,
          stepIndex: i,
          refKind: 'encounter-preset',
          missingId: wantedPresetId,
          stepLabel,
          title: `Replace missing encounter preset (${stepLabel})`,
          options: encounterPresets.map((p) => ({
            id: p.id,
            label: p.name,
            description: `${p.encounterType} — ${p.description}`,
            kind: 'option',
          })),
        });
      }
    }
  }

  return missingRefs.length > 0
    ? { ok: false, missingRefs }
    : { ok: true, missingRefs: [] };
}

function parseConnectionId(id: string): [string, string] | null {
  const parts = id.split('::');
  return parts.length === 2 ? [parts[0], parts[1]] : null;
}

function applySelectionForHit(hit: HitResult, stores: MacroExecutionStores): boolean {
  if (hit.type === 'connection') {
    const parsed = parseConnectionId(hit.id);
    if (!parsed) return false;
    stores.selectConnection(parsed[0], parsed[1]);
    return true;
  }
  if (hit.type === 'zone') stores.selectZone(hit.id, false);
  else if (hit.type === 'entity') stores.selectEntity(hit.id, false);
  else if (hit.type === 'landmark') stores.selectLandmark(hit.id, false);
  else if (hit.type === 'spawn') stores.selectSpawn(hit.id, false);
  else if (hit.type === 'encounter') stores.selectEncounter(hit.id, false);
  else if (stores.selectKind) stores.selectKind(hit.type as SelectionKind, hit.id, false);
  else return false;
  return true;
}

/**
 * Execute all steps of `macro` atomically: either every step succeeds on a cloned working
 * project and commits **one** undo entry labelled `macro.name`, or the run aborts cleanly
 * with zero project mutation and zero undo entries.
 */
export function executeMacroAtomic(
  macro: SpeedPanelMacro,
  context: HitResult | null,
  stores: MacroExecutionStores,
  replacements?: MacroReplacementMap,
): MacroExecutionResult {
  const total = macro.steps.length;
  const steps: MacroStepResult[] = [];
  if (total === 0) {
    return { completed: 0, total: 0, steps: [], totalSteps: 0, completedSteps: 0 };
  }

  let workingProject: WorldProject = structuredClone(stores.project);

  const effectiveContext: HitResult | null = replacements?.targetZoneId
    ? { type: 'zone', id: replacements.targetZoneId }
    : context;
  let workingSelection: SelectionSet = stores.selection
    ? structuredClone(stores.selection)
    : emptySelection();
  let targetZoneIds = replacements?.targetZoneId
    ? [replacements.targetZoneId]
    : resolveTargetZoneIds(effectiveContext, workingSelection);
  let primaryZoneId = replacements?.targetZoneId
    ?? (effectiveContext?.type === 'zone' ? effectiveContext.id : getSelectedZoneId(workingSelection));

  const regionPresets = stores.regionPresets ?? [];
  const encounterPresets = stores.encounterPresets ?? [];
  const postEffects: Array<() => void> = [];
  let projectMutated = false;

  const abort = (stepIndex: number, cmdId: string, reason: string): MacroExecutionResult => ({
    completed: 0,
    total,
    abortedAt: stepIndex,
    reason: `Step ${stepIndex + 1} (${cmdId}) failed — ${reason}`,
    steps: steps.map((s) => ({ ...s })),
    totalSteps: total,
    completedSteps: 0,
  });

  for (let i = 0; i < total; i++) {
    const step = macro.steps[i];
    const cmdId = getMacroStepCommandId(step);
    const cmd = getCommandById(cmdId);
    if (!cmd) {
      steps.push({ action: cmdId, success: false });
      return abort(i, cmdId, 'unknown action');
    }

    if (step.args?.kind === 'assign-district') {
      const districtId = replacements?.byStepKey?.[`${i}:district`] ?? step.args.districtId;
      const district = workingProject.districts.find((d: District) => d.id === districtId);
      if (!district) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, `district "${districtId}" not found`);
      }
      if (targetZoneIds.length === 0 || targetZoneIds.some((zid) => !workingProject.zones.some((z) => z.id === zid))) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'target zone not found');
      }
      const targetSet = new Set(targetZoneIds);
      workingProject = {
        ...workingProject,
        zones: workingProject.zones.map((z) => (targetSet.has(z.id) ? { ...z, parentDistrictId: districtId } : z)),
        districts: workingProject.districts.map((d) => {
          if (d.id === districtId) {
            return { ...d, zoneIds: [...new Set([...d.zoneIds, ...targetZoneIds])] };
          }
          const nextIds = d.zoneIds.filter((zid) => !targetSet.has(zid));
          return nextIds.length !== d.zoneIds.length ? { ...d, zoneIds: nextIds } : d;
        }),
      };
      projectMutated = true;
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (step.args?.kind === 'apply-region-preset') {
      const presetId = replacements?.byStepKey?.[`${i}:region-preset`] ?? step.args.presetId;
      const preset = regionPresets.find((p) => p.id === presetId);
      if (!preset) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, `region preset "${presetId}" not found`);
      }
      const overrideDistrictId = replacements?.byStepKey?.[`${i}:district`];
      const district = overrideDistrictId
        ? workingProject.districts.find((d) => d.id === overrideDistrictId)
        : primaryZoneId
          ? workingProject.districts.find((d) => d.zoneIds.includes(primaryZoneId!))
          : undefined;
      if (!district) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'target zone must belong to a district');
      }
      const applied = applyRegionPresetToProject(workingProject, district.id, preset, step.args.applyMode);
      if (!applied.applied) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'failed to apply region preset');
      }
      workingProject = applied.project;
      projectMutated = true;
      postEffects.push(() => rememberAppliedRegionPreset(preset.id));
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (step.args?.kind === 'apply-encounter-preset') {
      const presetId = replacements?.byStepKey?.[`${i}:encounter-preset`] ?? step.args.presetId;
      const preset = encounterPresets.find((p) => p.id === presetId);
      if (!preset) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, `encounter preset "${presetId}" not found`);
      }
      if (!primaryZoneId || !workingProject.zones.some((z) => z.id === primaryZoneId)) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'target zone not found');
      }
      const created = createEncounterFromPresetInProject(workingProject, primaryZoneId, preset);
      workingProject = created.project;
      projectMutated = true;
      postEffects.push(() => {
        stores.selectEncounter(created.id, false);
        rememberAppliedEncounterPreset(preset.id);
      });
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (step.args?.kind === 'place-encounter') {
      if (!primaryZoneId || !workingProject.zones.some((z) => z.id === primaryZoneId)) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'target zone not found');
      }
      const checked = validateEncounterTypeInput(step.args.encounterType);
      if (!checked.ok) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, checked.error);
      }
      const encId = nextId('enc');
      const anchor: EncounterAnchor = buildEncounterAnchor(primaryZoneId, checked.encounterType, encId);
      workingProject = {
        ...workingProject,
        encounterAnchors: [...workingProject.encounterAnchors, anchor],
      };
      projectMutated = true;
      postEffects.push(() => stores.selectEncounter(encId, false));
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (step.args?.kind === 'set-elevation') {
      if (targetZoneIds.length === 0 || targetZoneIds.some((zid) => !workingProject.zones.some((z) => z.id === zid))) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'target zone not found');
      }
      const checked = validateElevationInput(
        step.args.elevation === undefined ? '' : String(step.args.elevation),
      );
      if (!checked.ok) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, checked.error);
      }
      const targetSet = new Set(targetZoneIds);
      workingProject = {
        ...workingProject,
        zones: workingProject.zones.map((z) => (targetSet.has(z.id) ? { ...z, elevation: checked.value } : z)),
      };
      projectMutated = true;
      steps.push({ action: cmdId, success: true });
      continue;
    }

    // Argless steps — preserve context preconditions identically to hand execution
    const cmdCtx = {
      hit: effectiveContext,
      selection: workingSelection,
      project: workingProject,
    };
    if (!cmd.when(cmdCtx)) {
      steps.push({ action: cmdId, success: false });
      return abort(i, cmdId, 'context mismatch');
    }

    if (cmdId === 'duplicate') {
      const hit = effectiveContext;
      const sel = { zones: [] as string[], entities: [] as string[], landmarks: [] as string[], spawns: [] as string[], encounters: [] as string[] };
      if (hit && (hit.type === 'zone' || hit.type === 'entity' || hit.type === 'landmark')) {
        const key = hit.type === 'zone' ? 'zones' : hit.type === 'entity' ? 'entities' : 'landmarks';
        sel[key] = [hit.id];
      } else if (
        workingSelection.zones.length + workingSelection.entities.length + workingSelection.landmarks.length > 0
      ) {
        sel.zones = [...workingSelection.zones];
        sel.entities = [...workingSelection.entities];
        sel.landmarks = [...workingSelection.landmarks];
      } else {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'context mismatch');
      }
      const duped = doDuplicate(workingProject, sel);
      workingProject = duped.project;
      projectMutated = true;
      if (hit) {
        postEffects.push(() => applySelectionForHit(hit, stores));
      }
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'delete') {
      const hit = effectiveContext;
      if (!hit) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'context mismatch');
      }
      if (hit.type === 'connection') {
        const parsed = parseConnectionId(hit.id);
        if (!parsed) {
          steps.push({ action: cmdId, success: false });
          return abort(i, cmdId, 'context mismatch');
        }
        workingProject = {
          ...workingProject,
          connections: workingProject.connections.filter(
            (c) => !(c.fromZoneId === parsed[0] && c.toZoneId === parsed[1]),
          ),
        };
      } else {
        const key = SELECTION_KIND_KEY[hit.type as SelectionKind];
        if (!key) {
          steps.push({ action: cmdId, success: false });
          return abort(i, cmdId, 'context mismatch');
        }
        const delSel = emptySelection();
        delSel[key] = [hit.id];
        workingProject = removeSelectedFromProject(workingProject, delSel);
        if (hit.type === 'zone') {
          targetZoneIds = targetZoneIds.filter((zid) => zid !== hit.id);
          if (primaryZoneId === hit.id) primaryZoneId = null;
        }
      }
      workingSelection = emptySelection();
      projectMutated = true;
      postEffects.push(() => stores.clearSelection());
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'swap-direction') {
      if (effectiveContext?.type !== 'connection') {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'context mismatch');
      }
      const parsed = parseConnectionId(effectiveContext.id);
      if (!parsed) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'context mismatch');
      }
      const [from, to] = parsed;
      const existing = workingProject.connections.find((c) => c.fromZoneId === from && c.toZoneId === to);
      if (existing) {
        workingProject = {
          ...workingProject,
          connections: workingProject.connections.map((c) =>
            c.fromZoneId === from && c.toZoneId === to
              ? { ...c, fromZoneId: to, toZoneId: from }
              : c,
          ),
        };
        projectMutated = true;
      }
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'merge-zones') {
      const zoneIds = stores.selection
        ? workingSelection.zones
        : (effectiveContext?.type === 'zone' ? [effectiveContext.id] : []);
      if (zoneIds.length < 2) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'need at least 2 zones');
      }
      const merged = mergeZonesInProject(workingProject, zoneIds);
      if (!merged.mergedId) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'merge failed');
      }
      workingProject = merged.project;
      const mergedId = merged.mergedId;
      targetZoneIds = [mergedId];
      primaryZoneId = mergedId;
      workingSelection = { ...emptySelection(), zones: [mergedId] };
      projectMutated = true;
      postEffects.push(() => stores.selectZone(mergedId, false));
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'edit-props') {
      const hit = effectiveContext;
      if (!hit) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'context mismatch');
      }
      postEffects.push(() => {
        applySelectionForHit(hit, stores);
        stores.setRightTab('map');
        stores.setRightCollapsed?.(false);
      });
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'assign-district') {
      const hit = effectiveContext;
      if (!hit || hit.type !== 'zone') {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'context mismatch');
      }
      postEffects.push(() => {
        stores.selectZone(hit.id, false);
        stores.setRightTab('map');
      });
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'fit-content') {
      postEffects.push(() => {
        const items = workingProject.zones.map((z) => ({
          gridX: z.gridX, gridY: z.gridY, gridWidth: z.gridWidth, gridHeight: z.gridHeight,
        }));
        const cw = stores.canvasSize?.w ?? 800;
        const ch = stores.canvasSize?.h ?? 600;
        const vp = frameBounds(items, workingProject.map.tileSize, cw, ch);
        if (vp) stores.setViewport(vp);
      });
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'open-review') {
      postEffects.push(() => stores.setRightTab('review'));
      steps.push({ action: cmdId, success: true });
      continue;
    }

    if (cmdId === 'export-summary') {
      if (!stores.downloadFile) {
        steps.push({ action: cmdId, success: false });
        return abort(i, cmdId, 'downloadFile unavailable');
      }
      const dl = stores.downloadFile;
      postEffects.push(() => {
        const snapshot = { ...buildReviewSnapshot(workingProject), hasExported: false };
        const markdown = reviewSnapshotToMarkdown(snapshot);
        dl(summaryFilename(workingProject.name, 'md'), markdown, 'text/markdown');
      });
      steps.push({ action: cmdId, success: true });
      continue;
    }

    // Atomic path must never invoke live `stores` via fallback cmd.run().
    if (ARG_REQUIRED_MACRO_COMMANDS.has(cmdId)) {
      steps.push({ action: cmdId, success: false });
      return abort(i, cmdId, 'requires saved parameters');
    }
    steps.push({ action: cmdId, success: false });
    return abort(i, cmdId, 'unsupported in atomic macro execution');
  }

  if (projectMutated) {
    stores.updateProject(() => workingProject, macro.name);
  }

  for (const fx of postEffects) {
    fx();
  }

  return {
    completed: total,
    total,
    steps,
    totalSteps: total,
    completedSteps: total,
  };
}
