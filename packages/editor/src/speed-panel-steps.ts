// speed-panel-steps.ts — C4 multi-step panel flows, inline scalar validation,
// AI RPG export advisories, canvas spatial picking, async validation guard, and action replay.

import {
  AI_RPG_ENCOUNTER_TYPE_MAP,
  AI_RPG_DROPPED_ENCOUNTER_TYPES,
  isAiRpgEncounterAnchorType,
} from '@world-forge/export-ai-rpg';
import type {
  AuthoringMode,
  ConnectionKind,
  District,
  EncounterAnchor,
  WorldProject,
  ZoneConnection,
} from '@world-forge/schema';
import {
  getCommandById,
  type CommandContext,
  type EditorCommand,
  type ExecuteResult,
  type ExecuteStores,
  type HotkeyContext,
} from './command-registry.js';
import type { HitResult } from './hit-testing.js';
import { nextId } from './ids.js';
import { getModeProfile } from './mode-profiles.js';
import { getOrderedKinds, KIND_LABELS } from './panels/ConnectionProperties.js';
import { appendConnectionToProject } from './zone-attached.js';
import {
  districtForSelection,
  filterPresetsByMode,
  rememberAppliedEncounterPreset,
  rememberAppliedRegionPreset,
} from './preset-actions.js';
import type { EncounterPreset, RegionPreset } from './presets/types.js';
import {
  emptySelection,
  getSelectedZoneId,
  type EditorTool,
  type LastPanelAction,
  type LastPanelActionParams,
  type SelectionSet,
  type SessionActionLogEntry,
  type SpeedPanelPickSession,
} from './store/editor-store.js';

export type ExportCompatibilityStatus = 'native' | 'mapped' | 'dropped' | 'blocked';

export interface ExportCompatibilityBadge {
  status: ExportCompatibilityStatus;
  badgeText: string;
  targetType?: string;
  title: string;
}

/**
 * Classify an encounter type using live tables imported from `@world-forge/export-ai-rpg`.
 * Keeps Speed Panel badges synchronized with the exporter without duplicating tables.
 */
export function classifyEncounterTypeForExport(encounterType: string): ExportCompatibilityBadge {
  if (isAiRpgEncounterAnchorType(encounterType)) {
    return {
      status: 'native',
      badgeText: 'Native AI RPG',
      targetType: encounterType,
      title: `Exports directly to AI RPG Engine as "${encounterType}".`,
    };
  }
  if (Object.hasOwn(AI_RPG_ENCOUNTER_TYPE_MAP, encounterType)) {
    const targetType = AI_RPG_ENCOUNTER_TYPE_MAP[encounterType];
    return {
      status: 'mapped',
      badgeText: `Maps \u2192 ${targetType}`,
      targetType,
      title: `Exports to AI RPG Engine mapped as "${targetType}".`,
    };
  }
  if (AI_RPG_DROPPED_ENCOUNTER_TYPES.has(encounterType)) {
    return {
      status: 'dropped',
      badgeText: 'Dropped on AI RPG export',
      title: 'Allowed in World Forge, but intentionally omitted during AI RPG export.',
    };
  }
  return {
    status: 'blocked',
    badgeText: 'Blocked on AI RPG export',
    title: 'Allowed in World Forge, but blocks AI RPG export until mapped or replaced.',
  };
}

export interface StepChoiceOption {
  id: string;
  label: string;
  description?: string;
  kind: 'option' | 'create';
  badge?: {
    text: string;
    tone: ExportCompatibilityStatus | 'neutral';
    title?: string;
  };
}

export type StepId =
  | 'pick-district'
  | 'create-district'
  | 'pick-target-zone'
  | 'pick-region-preset'
  | 'pick-apply-mode'
  | 'pick-encounter-preset'
  | 'pick-encounter-type'
  | 'custom-encounter-type'
  | 'set-elevation'
  | 'macro-replace-ref'
  | 'quick-fix-list'
  | 'quick-fix-actions';

export interface ChoicePanelStep {
  kind: 'choice';
  stepId: StepId;
  title: string;
  placeholder: string;
  options: StepChoiceOption[];
}

export interface InputPanelStep {
  kind: 'input';
  stepId: StepId;
  title: string;
  label: string;
  placeholder: string;
  value: string;
  allowEmpty?: boolean;
}

export type PanelStep = ChoicePanelStep | InputPanelStep;

export interface StepStackState {
  commandId: string;
  commandLabel: string;
  context: HitResult | null;
  targetZoneIds: string[];
  targetDistrictId?: string;
  selectedPresetId?: string;
  steps: PanelStep[];
  error: string | null;
}

export interface StepExecutionStores {
  project: WorldProject;
  selection: SelectionSet;
  selectedConnection: { from: string; to: string } | null;
  activeTool: EditorTool;
  regionPresets: RegionPreset[];
  encounterPresets: EncounterPreset[];
  updateProject: (updater: (p: WorldProject) => WorldProject, label?: string) => void;
  updateZone: (zoneId: string, updates: Partial<WorldProject['zones'][number]>) => void;
  addConnection: (conn: ZoneConnection) => void;
  mergeZones: (zoneIds: string[], undoLabel?: string) => string | null;
  applyRegionPreset: (
    districtId: string,
    preset: RegionPreset,
    mode: 'merge' | 'overwrite',
    undoLabel?: string,
  ) => void;
  createEncounterFromPreset: (zoneId: string, preset: EncounterPreset, undoLabel?: string) => string;
  selectZone: (id: string, additive: boolean) => void;
  selectEncounter: (id: string, additive: boolean) => void;
  selectAll: (sel: SelectionSet, additive: boolean) => void;
  selectConnection: (from: string, to: string) => void;
  clearSelection: () => void;
  setTool: (tool: EditorTool) => void;
  setConnectionStart: (id: string | null) => void;
  setPendingConnectionKind: (kind: ConnectionKind | null) => void;
  setSpeedPanelPick: (pick: SpeedPanelPickSession | null) => void;
  clearSpeedPanelPick: () => void;
  setLastPanelAction: (action: LastPanelAction | null) => void;
  recordSessionAction?: (entry: Omit<SessionActionLogEntry, 'id'>) => void;
}

/** Build descriptive panel-side undo label for merging zones (`Merge <Zone A> + <Zone B>...`). */
export function formatMergeZonesUndoLabel(
  zoneIds: readonly string[],
  project: WorldProject,
): string {
  const names = zoneIds.map((zid) => project.zones.find((z) => z.id === zid)?.name ?? zid);
  return `Merge ${names.join(' + ')}`;
}

function recordFinishedPanelAction(
  stores: StepExecutionStores,
  action: LastPanelAction,
): LastPanelAction {
  stores.recordSessionAction?.({
    commandId: action.commandId,
    label: action.label,
    timestamp: action.timestamp,
    ...(action.params ? { args: action.params } : {}),
  });
  return action;
}

const TYPED_CONNECTION_KINDS: Readonly<Record<string, ConnectionKind>> = {
  'add-secret-conn': 'secret',
  'add-channel-conn': 'channel',
  'add-warp-conn': 'warp',
  'add-trail-conn': 'trail',
};

const MULTI_STEP_COMMAND_IDS = new Set([
  'assign-district',
  'apply-preset',
  'place-encounter',
  'set-elevation',
]);

const SPATIAL_PICK_COMMAND_IDS = new Set([
  'connect-from',
  'add-secret-conn',
  'add-channel-conn',
  'add-warp-conn',
  'add-trail-conn',
  'merge-zones',
]);

export function isMultiStepCommand(commandId: string): boolean {
  return MULTI_STEP_COMMAND_IDS.has(commandId);
}

export function isSpatialPickCommand(commandId: string): boolean {
  return SPATIAL_PICK_COMMAND_IDS.has(commandId);
}

/** Resolve all target zone IDs when hitting a zone (respects active multi-zone selection). */
export function resolveTargetZoneIds(hit: HitResult | null, selection: SelectionSet): string[] {
  if (hit?.type === 'zone') {
    if (selection.zones.length > 0 && selection.zones.includes(hit.id)) {
      return [...selection.zones];
    }
    return [hit.id];
  }
  if (selection.zones.length > 0) {
    return [...selection.zones];
  }
  return [];
}

/** Validate inline elevation text: empty clears (`undefined`), finite number sets, non-numeric fails closed. */
export function validateElevationInput(
  raw: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: true, value: undefined };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { ok: false, error: 'Enter a finite number in meters, or leave blank to clear.' };
  }
  return { ok: true, value: n };
}

/** Validate inline district creation name (non-empty and not duplicating an existing district name). */
export function validateDistrictNameInput(
  raw: string,
  existingDistricts: readonly District[],
): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (!name) {
    return { ok: false, error: 'District name is required.' };
  }
  const lower = name.toLowerCase();
  if (existingDistricts.some((d) => d.name.trim().toLowerCase() === lower)) {
    return { ok: false, error: `District "${name}" already exists.` };
  }
  return { ok: true, name };
}

/** Validate encounter type string input. */
export function validateEncounterTypeInput(
  raw: string,
): { ok: true; encounterType: string } | { ok: false; error: string } {
  const encounterType = raw.trim();
  if (!encounterType) {
    return { ok: false, error: 'Encounter type is required.' };
  }
  return { ok: true, encounterType };
}

function buildDistrictChoiceStep(project: WorldProject, targetZoneIds: readonly string[]): ChoicePanelStep {
  const targetSet = new Set(targetZoneIds);
  const options: StepChoiceOption[] = project.districts.map((d) => {
    const allAssigned = targetZoneIds.length > 0 && targetZoneIds.every((zid) => d.zoneIds.includes(zid));
    return {
      id: d.id,
      label: d.name,
      description: allAssigned
        ? 'Current district'
        : `${d.zoneIds.length} zone${d.zoneIds.length === 1 ? '' : 's'}`,
      kind: 'option',
    };
  });
  options.push({
    id: '__create_district__',
    label: '+ Create District',
    description: targetSet.size > 1 ? `Create and assign ${targetSet.size} zones` : 'Create and assign zone',
    kind: 'create',
  });
  return {
    kind: 'choice',
    stepId: 'pick-district',
    title: 'Assign District',
    placeholder: 'Filter districts...',
    options,
  };
}

function buildEncounterTypeOptions(
  mode: AuthoringMode | undefined,
  encounterPresets: readonly EncounterPreset[],
): StepChoiceOption[] {
  const profile = getModeProfile(mode);
  const orderedTypes: string[] = [];
  const seen = new Set<string>();
  const appendType = (t: string) => {
    if (!t || seen.has(t)) return;
    seen.add(t);
    orderedTypes.push(t);
  };
  for (const t of profile.encounterTypes) appendType(t);
  for (const p of filterPresetsByMode(encounterPresets as EncounterPreset[], mode)) appendType(p.encounterType);
  for (const d of AI_RPG_DROPPED_ENCOUNTER_TYPES) appendType(d);

  const options: StepChoiceOption[] = orderedTypes.map((typeName) => {
    const compat = classifyEncounterTypeForExport(typeName);
    return {
      id: typeName,
      label: typeName,
      description: compat.title,
      kind: 'option',
      badge: {
        text: compat.badgeText,
        tone: compat.status,
        title: compat.title,
      },
    };
  });
  options.push({
    id: '__custom_encounter__',
    label: '+ Custom Type',
    description: 'Enter a custom encounter type identifier',
    kind: 'create',
  });
  return options;
}

function buildRegionPresetStep(mode: AuthoringMode | undefined, regionPresets: readonly RegionPreset[]): ChoicePanelStep {
  const filtered = filterPresetsByMode([...regionPresets], mode);
  const list = filtered.length > 0 ? filtered : [...regionPresets];
  return {
    kind: 'choice',
    stepId: 'pick-region-preset',
    title: 'Choose Region Preset',
    placeholder: 'Filter region presets...',
    options: list.map((p) => ({
      id: p.id,
      label: p.name,
      description: p.description,
      kind: 'option',
      badge: {
        text: p.regionTags.slice(0, 2).join(', ') || 'Region',
        tone: 'neutral',
      },
    })),
  };
}

function buildApplyModeStep(presetName: string): ChoicePanelStep {
  return {
    kind: 'choice',
    stepId: 'pick-apply-mode',
    title: `Apply "${presetName}"`,
    placeholder: 'Choose apply mode...',
    options: [
      {
        id: 'merge',
        label: 'Merge (keep existing fields)',
        description: 'Appends tags/factions and fills empty metrics',
        kind: 'option',
      },
      {
        id: 'overwrite',
        label: 'Overwrite (replace existing)',
        description: 'Replaces tags, controlling faction, and metrics',
        kind: 'option',
      },
    ],
  };
}

function buildEncounterPresetStep(
  mode: AuthoringMode | undefined,
  encounterPresets: readonly EncounterPreset[],
): ChoicePanelStep {
  const filtered = filterPresetsByMode([...encounterPresets], mode);
  const list = filtered.length > 0 ? filtered : [...encounterPresets];
  return {
    kind: 'choice',
    stepId: 'pick-encounter-preset',
    title: 'Choose Encounter Preset',
    placeholder: 'Filter encounter presets...',
    options: list.map((p) => {
      const compat = classifyEncounterTypeForExport(p.encounterType);
      return {
        id: p.id,
        label: p.name,
        description: `${p.encounterType} — ${p.description}`,
        kind: 'option',
        badge: {
          text: compat.badgeText,
          tone: compat.status,
          title: compat.title,
        },
      };
    }),
  };
}

export type StepFlowOpenResult =
  | { kind: 'steps'; flow: StepStackState }
  | { kind: 'pick'; pick: SpeedPanelPickSession }
  | { kind: 'direct' }
  | { kind: 'blocked'; reason: string };

/** Open an inline multi-step panel flow or canvas-delegated spatial pick session for a command. */
export function openCommandStepFlow(
  commandId: string,
  context: HitResult | null,
  stores: StepExecutionStores,
): StepFlowOpenResult {
  const targetZoneIds = resolveTargetZoneIds(context, stores.selection);
  const primaryZoneId = context?.type === 'zone' ? context.id : getSelectedZoneId(stores.selection);

  if (commandId === 'assign-district') {
    if (targetZoneIds.length === 0) {
      return { kind: 'blocked', reason: 'Target a zone to assign a district' };
    }
    return {
      kind: 'steps',
      flow: {
        commandId,
        commandLabel: 'Assign District',
        context,
        targetZoneIds,
        steps: [buildDistrictChoiceStep(stores.project, targetZoneIds)],
        error: null,
      },
    };
  }

  if (commandId === 'place-encounter') {
    if (!primaryZoneId) {
      return { kind: 'blocked', reason: 'Target a zone to place an encounter' };
    }
    return {
      kind: 'steps',
      flow: {
        commandId,
        commandLabel: 'Place Encounter Here',
        context,
        targetZoneIds: [primaryZoneId],
        steps: [
          {
            kind: 'choice',
            stepId: 'pick-encounter-type',
            title: 'Place Encounter',
            placeholder: 'Filter encounter types...',
            options: buildEncounterTypeOptions(stores.project.mode, stores.encounterPresets),
          },
        ],
        error: null,
      },
    };
  }

  if (commandId === 'apply-preset') {
    if (!primaryZoneId) {
      if (stores.project.zones.length === 0) {
        return { kind: 'direct' };
      }
      return {
        kind: 'steps',
        flow: {
          commandId,
          commandLabel: 'Apply Preset',
          context,
          targetZoneIds: [],
          steps: [
            {
              kind: 'choice',
              stepId: 'pick-target-zone',
              title: 'Choose Zone or District',
              placeholder: 'Filter zones...',
              options: stores.project.zones.map((z) => {
                const dist = stores.project.districts.find((d) => d.zoneIds.includes(z.id));
                return {
                  id: z.id,
                  label: z.name,
                  description: dist ? `District: ${dist.name} (Region preset)` : 'Standalone zone (Encounter preset)',
                  kind: 'option',
                };
              }),
            },
          ],
          error: null,
        },
      };
    }

    const district = stores.project.districts.find((d) => d.zoneIds.includes(primaryZoneId))
      ?? districtForSelection(stores.project, stores.selection);
    if (district) {
      return {
        kind: 'steps',
        flow: {
          commandId,
          commandLabel: 'Apply Preset',
          context,
          targetZoneIds: [primaryZoneId],
          targetDistrictId: district.id,
          steps: [buildRegionPresetStep(stores.project.mode, stores.regionPresets)],
          error: null,
        },
      };
    }
    return {
      kind: 'steps',
      flow: {
        commandId,
        commandLabel: 'Apply Preset',
        context,
        targetZoneIds: [primaryZoneId],
        steps: [buildEncounterPresetStep(stores.project.mode, stores.encounterPresets)],
        error: null,
      },
    };
  }

  if (commandId === 'set-elevation') {
    if (targetZoneIds.length === 0) {
      return { kind: 'blocked', reason: 'Target a zone to set elevation' };
    }
    const zone = stores.project.zones.find((z) => z.id === targetZoneIds[0]);
    const initial = zone?.elevation !== undefined ? String(zone.elevation) : '';
    return {
      kind: 'steps',
      flow: {
        commandId,
        commandLabel: 'Set Elevation',
        context,
        targetZoneIds,
        steps: [
          {
            kind: 'input',
            stepId: 'set-elevation',
            title: 'Set Elevation (m)',
            label: targetZoneIds.length > 1
              ? `Elevation for ${targetZoneIds.length} zones (blank clears)`
              : `Elevation for ${zone?.name ?? targetZoneIds[0]} (blank clears)`,
            placeholder: 'e.g. -5 or 12 (blank clears)',
            value: initial,
            allowEmpty: true,
          },
        ],
        error: null,
      },
    };
  }

  if (commandId === 'connect-from' || Object.hasOwn(TYPED_CONNECTION_KINDS, commandId)) {
    if (!primaryZoneId) {
      return { kind: 'blocked', reason: 'Target a zone to start a connection' };
    }
    const initialKind = TYPED_CONNECTION_KINDS[commandId]
      ?? getOrderedKinds(stores.project.mode).preferred[0]
      ?? 'passage';
    return {
      kind: 'pick',
      pick: {
        commandId,
        mode: 'connect',
        sourceZoneId: primaryZoneId,
        pickedZoneIds: [primaryZoneId],
        connectionKind: initialKind,
        cursorSX: 0,
        cursorSY: 0,
        hoveredZoneId: null,
        invalidReason: null,
        previousTool: stores.activeTool,
      },
    };
  }

  if (commandId === 'merge-zones') {
    if (stores.selection.zones.length >= 2) {
      return { kind: 'direct' };
    }
    if (!primaryZoneId) {
      return { kind: 'blocked', reason: 'Target a zone' };
    }
    if (stores.project.zones.length < 2) {
      return { kind: 'blocked', reason: 'Select at least 2 zones to merge' };
    }
    return {
      kind: 'pick',
      pick: {
        commandId,
        mode: 'merge',
        sourceZoneId: primaryZoneId,
        pickedZoneIds: [primaryZoneId],
        cursorSX: 0,
        cursorSY: 0,
        hoveredZoneId: null,
        invalidReason: null,
        previousTool: stores.activeTool,
      },
    };
  }

  return { kind: 'direct' };
}

/** Pop one step off the panel step stack, returning `null` to return to the palette root. */
export function popPanelStep(flow: StepStackState): StepStackState | null {
  if (flow.steps.length <= 1) return null;
  return {
    ...flow,
    steps: flow.steps.slice(0, -1),
    error: null,
  };
}

/** Build an encounter anchor matching the canvas encounter-place tool defaults. */
export function buildEncounterAnchor(
  zoneId: string,
  encounterType: string,
  id = nextId('enc'),
): EncounterAnchor {
  return {
    id,
    zoneId,
    encounterType,
    enemyIds: [],
    probability: 0.5,
    cooldownTurns: 3,
    tags: [],
  };
}

/** Commit assigning one or more zones to an existing district in one atomic `updateProject`. */
export function commitDistrictAssignment(
  stores: StepExecutionStores,
  targetZoneIds: readonly string[],
  districtId: string,
): { ok: true } | { ok: false; error: string } {
  const district = stores.project.districts.find((d) => d.id === districtId);
  if (!district) {
    return { ok: false, error: 'Selected district no longer exists.' };
  }
  const targetSet = new Set(targetZoneIds);
  const scope =
    targetZoneIds.length === 1
      ? (stores.project.zones.find((z) => z.id === targetZoneIds[0])?.name ?? targetZoneIds[0])
      : `${targetZoneIds.length} zones`;
  stores.updateProject((p) => ({
    ...p,
    zones: p.zones.map((z) => (targetSet.has(z.id) ? { ...z, parentDistrictId: districtId } : z)),
    districts: p.districts.map((d) => {
      if (d.id === districtId) {
        return { ...d, zoneIds: [...new Set([...d.zoneIds, ...targetZoneIds])] };
      }
      const nextIds = d.zoneIds.filter((zid) => !targetSet.has(zid));
      return nextIds.length !== d.zoneIds.length ? { ...d, zoneIds: nextIds } : d;
    }),
  }), `Assign ${scope} to ${district.name}`);
  return { ok: true };
}

/** Atomically create a new district and assign target zone(s) inside a single undo entry. */
export function commitCreateAndAssignDistrict(
  stores: StepExecutionStores,
  targetZoneIds: readonly string[],
  districtName: string,
): { ok: true; districtId: string } | { ok: false; error: string } {
  const checked = validateDistrictNameInput(districtName, stores.project.districts);
  if (!checked.ok) return checked;
  const newId = nextId('district');
  const targetSet = new Set(targetZoneIds);
  const newDistrict: District = {
    id: newId,
    name: checked.name,
    zoneIds: [...targetZoneIds],
    tags: [],
    baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
  };
  stores.updateProject((p) => ({
    ...p,
    zones: p.zones.map((z) => (targetSet.has(z.id) ? { ...z, parentDistrictId: newId } : z)),
    districts: [
      ...p.districts.map((d) => {
        const nextIds = d.zoneIds.filter((zid) => !targetSet.has(zid));
        return nextIds.length !== d.zoneIds.length ? { ...d, zoneIds: nextIds } : d;
      }),
      newDistrict,
    ],
  }), `Create district "${checked.name}" and assign`);
  return { ok: true, districtId: newId };
}

/** Commit placing an encounter anchor inside `zoneId` with one atomic `updateProject` call. */
export function commitPlaceEncounter(
  stores: StepExecutionStores,
  zoneId: string,
  encounterType: string,
): { ok: true; encounterId: string } | { ok: false; error: string } {
  const zone = stores.project.zones.find((z) => z.id === zoneId);
  if (!zone) {
    return { ok: false, error: 'Target zone no longer exists.' };
  }
  const checked = validateEncounterTypeInput(encounterType);
  if (!checked.ok) return checked;
  const id = nextId('enc');
  const anchor = buildEncounterAnchor(zoneId, checked.encounterType, id);
  stores.updateProject((p) => ({
    ...p,
    encounterAnchors: [...p.encounterAnchors, anchor],
  }), `Place ${checked.encounterType} encounter in ${zone.name}`);
  stores.selectEncounter(id, false);
  return { ok: true, encounterId: id };
}

/** Commit setting or clearing elevation across one or more zones in a single atomic undo entry. */
export function commitSetElevation(
  stores: StepExecutionStores,
  targetZoneIds: readonly string[],
  rawValue: string,
): { ok: true; elevation: number | undefined } | { ok: false; error: string } {
  const checked = validateElevationInput(rawValue);
  if (!checked.ok) return checked;
  const elevation = checked.value;
  const targetSet = new Set(targetZoneIds);
  const scope =
    targetZoneIds.length === 1
      ? (stores.project.zones.find((z) => z.id === targetZoneIds[0])?.name ?? targetZoneIds[0])
      : `${targetZoneIds.length} zones`;
  const label =
    elevation === undefined
      ? `Clear elevation (${scope})`
      : `Set elevation to ${elevation} (${scope})`;
  stores.updateProject((p) => ({
    ...p,
    zones: p.zones.map((z) => (targetSet.has(z.id) ? { ...z, elevation } : z)),
  }), label);
  return { ok: true, elevation };
}

export type StepAdvanceResult =
  | { done: false; flow: StepStackState }
  | { done: true; commandId: string; lastAction: LastPanelAction; summary?: string };

/** Advance a choice step by option selection (either pushes next step or commits atomically). */
export function advanceStepChoice(
  flow: StepStackState,
  option: StepChoiceOption,
  stores: StepExecutionStores,
  initialFilter?: string,
): StepAdvanceResult {
  const current = flow.steps[flow.steps.length - 1];
  if (!current || current.kind !== 'choice') {
    return { done: false, flow };
  }

  if (current.stepId === 'pick-district') {
    if (option.kind === 'create') {
      return {
        done: false,
        flow: {
          ...flow,
          error: null,
          steps: [
            ...flow.steps,
            {
              kind: 'input',
              stepId: 'create-district',
              title: 'Create District',
              label: 'New district name',
              placeholder: 'e.g. Old Quarter',
              value: initialFilter?.trim() ?? '',
            },
          ],
        },
      };
    }
    const res = commitDistrictAssignment(stores, flow.targetZoneIds, option.id);
    if (!res.ok) {
      return { done: false, flow: { ...flow, error: res.error } };
    }
    return {
      done: true,
      commandId: flow.commandId,
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'assign-district',
        label: `Assign District: ${option.label}`,
        timestamp: Date.now(),
        params: { kind: 'assign-district', districtId: option.id },
      }),
    };
  }

  if (current.stepId === 'pick-target-zone') {
    const zoneId = option.id;
    const district = stores.project.districts.find((d) => d.zoneIds.includes(zoneId));
    const nextStep = district
      ? buildRegionPresetStep(stores.project.mode, stores.regionPresets)
      : buildEncounterPresetStep(stores.project.mode, stores.encounterPresets);
    return {
      done: false,
      flow: {
        ...flow,
        targetZoneIds: [zoneId],
        targetDistrictId: district?.id,
        error: null,
        steps: [...flow.steps, nextStep],
      },
    };
  }

  if (current.stepId === 'pick-region-preset') {
    const preset = stores.regionPresets.find((p) => p.id === option.id);
    if (!preset) {
      return { done: false, flow: { ...flow, error: 'Preset no longer exists.' } };
    }
    return {
      done: false,
      flow: {
        ...flow,
        selectedPresetId: preset.id,
        error: null,
        steps: [...flow.steps, buildApplyModeStep(preset.name)],
      },
    };
  }

  if (current.stepId === 'pick-apply-mode') {
    const preset = stores.regionPresets.find((p) => p.id === flow.selectedPresetId);
    const districtId = flow.targetDistrictId;
    if (!preset || !districtId) {
      return { done: false, flow: { ...flow, error: 'District or preset unavailable.' } };
    }
    const district = stores.project.districts.find((d) => d.id === districtId);
    const applyMode: 'merge' | 'overwrite' = option.id === 'overwrite' ? 'overwrite' : 'merge';
    stores.applyRegionPreset(
      districtId,
      preset,
      applyMode,
      `Apply preset "${preset.name}" to ${district?.name ?? districtId} (${applyMode})`,
    );
    rememberAppliedRegionPreset(preset.id);
    return {
      done: true,
      commandId: flow.commandId,
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'apply-preset',
        label: `Apply Preset: ${preset.name} (${applyMode})`,
        timestamp: Date.now(),
        params: { kind: 'apply-region-preset', presetId: preset.id, applyMode },
      }),
    };
  }

  if (current.stepId === 'pick-encounter-preset') {
    const preset = stores.encounterPresets.find((p) => p.id === option.id);
    const zoneId = flow.targetZoneIds[0];
    if (!preset || !zoneId) {
      return { done: false, flow: { ...flow, error: 'Zone or encounter preset unavailable.' } };
    }
    const zone = stores.project.zones.find((z) => z.id === zoneId);
    const id = stores.createEncounterFromPreset(
      zoneId,
      preset,
      `Apply encounter preset "${preset.name}" in ${zone?.name ?? zoneId}`,
    );
    stores.selectEncounter(id, false);
    rememberAppliedEncounterPreset(preset.id);
    return {
      done: true,
      commandId: flow.commandId,
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'apply-preset',
        label: `Apply Preset: ${preset.name}`,
        timestamp: Date.now(),
        params: { kind: 'apply-encounter-preset', presetId: preset.id },
      }),
    };
  }

  if (current.stepId === 'pick-encounter-type') {
    if (option.kind === 'create') {
      return {
        done: false,
        flow: {
          ...flow,
          error: null,
          steps: [
            ...flow.steps,
            {
              kind: 'input',
              stepId: 'custom-encounter-type',
              title: 'Custom Encounter Type',
              label: 'Encounter type',
              placeholder: 'e.g. ambush, boss, trap',
              value: '',
            },
          ],
        },
      };
    }
    const zoneId = flow.targetZoneIds[0];
    const res = commitPlaceEncounter(stores, zoneId, option.id);
    if (!res.ok) {
      return { done: false, flow: { ...flow, error: res.error } };
    }
    return {
      done: true,
      commandId: flow.commandId,
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'place-encounter',
        label: `Place Encounter: ${option.id}`,
        timestamp: Date.now(),
        params: { kind: 'place-encounter', encounterType: option.id },
      }),
    };
  }

  return { done: false, flow };
}

/** Submit an inline scalar/text step inside the active panel step stack. */
export function submitStepInput(
  flow: StepStackState,
  rawValue: string,
  stores: StepExecutionStores,
): StepAdvanceResult {
  const current = flow.steps[flow.steps.length - 1];
  if (!current || current.kind !== 'input') {
    return { done: false, flow };
  }

  if (current.stepId === 'create-district') {
    const res = commitCreateAndAssignDistrict(stores, flow.targetZoneIds, rawValue);
    if (!res.ok) {
      return {
        done: false,
        flow: {
          ...flow,
          steps: flow.steps.map((s, idx) => (idx === flow.steps.length - 1 && s.kind === 'input' ? { ...s, value: rawValue } : s)),
          error: res.error,
        },
      };
    }
    return {
      done: true,
      commandId: flow.commandId,
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'assign-district',
        label: `Assign District: ${rawValue.trim()}`,
        timestamp: Date.now(),
        params: { kind: 'assign-district', districtId: res.districtId },
      }),
    };
  }

  if (current.stepId === 'custom-encounter-type') {
    const zoneId = flow.targetZoneIds[0];
    const res = commitPlaceEncounter(stores, zoneId, rawValue);
    if (!res.ok) {
      return {
        done: false,
        flow: {
          ...flow,
          steps: flow.steps.map((s, idx) => (idx === flow.steps.length - 1 && s.kind === 'input' ? { ...s, value: rawValue } : s)),
          error: res.error,
        },
      };
    }
    return {
      done: true,
      commandId: flow.commandId,
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'place-encounter',
        label: `Place Encounter: ${rawValue.trim()}`,
        timestamp: Date.now(),
        params: { kind: 'place-encounter', encounterType: rawValue.trim() },
      }),
    };
  }

  if (current.stepId === 'set-elevation') {
    const res = commitSetElevation(stores, flow.targetZoneIds, rawValue);
    if (!res.ok) {
      return {
        done: false,
        flow: {
          ...flow,
          steps: flow.steps.map((s, idx) => (idx === flow.steps.length - 1 && s.kind === 'input' ? { ...s, value: rawValue } : s)),
          error: res.error,
        },
      };
    }
    return {
      done: true,
      commandId: 'set-elevation',
      lastAction: recordFinishedPanelAction(stores, {
        commandId: 'set-elevation',
        label: res.elevation === undefined ? 'Clear Elevation' : `Set Elevation: ${res.elevation}m`,
        timestamp: Date.now(),
        params: { kind: 'set-elevation', elevation: res.elevation },
      }),
    };
  }

  return { done: false, flow };
}

// === Mechanism 3: Canvas-delegated spatial picking ===

/** Verify that the pick session's source zone (and any already-picked merge zones) still exist. */
export function isPickSourceMissing(
  pick: SpeedPanelPickSession,
  project: WorldProject,
): string | null {
  if (!project.zones.some((z) => z.id === pick.sourceZoneId)) {
    return 'Source zone no longer exists';
  }
  if (
    pick.mode === 'merge' &&
    pick.pickedZoneIds.some((zid) => !project.zones.some((z) => z.id === zid))
  ) {
    return 'Picked zone no longer exists';
  }
  return null;
}

/** Validate whether `targetZoneId` is a valid pick for the active pick session. */
export function validatePickTarget(
  pick: SpeedPanelPickSession,
  targetZoneId: string | null,
  project: WorldProject,
): string | null {
  const missing = isPickSourceMissing(pick, project);
  if (missing) return missing;
  if (!targetZoneId) return null;
  if (!project.zones.some((z) => z.id === targetZoneId)) {
    return 'Target zone not found';
  }
  if (pick.mode === 'connect') {
    if (targetZoneId === pick.sourceZoneId) {
      return 'Pick a different zone to connect';
    }
    return null;
  }
  if (pick.pickedZoneIds.includes(targetZoneId)) {
    return 'Already selected — pick a different zone';
  }
  return null;
}

/** Return ordered list of ConnectionKind values starting with active mode preferences. */
export function getPickOrderedKinds(mode: AuthoringMode | undefined): ConnectionKind[] {
  const { preferred, other } = getOrderedKinds(mode);
  return [...preferred, ...other];
}

/** Cycle connection kind on the active spatial pick session when `Tab` is pressed. */
export function cyclePickConnectionKind(
  pick: SpeedPanelPickSession,
  mode: AuthoringMode | undefined,
): SpeedPanelPickSession {
  if (pick.mode !== 'connect') return pick;
  const all = getPickOrderedKinds(mode);
  const current = pick.connectionKind ?? all[0] ?? 'passage';
  const idx = all.indexOf(current);
  const next = all[(idx + 1) % all.length] ?? current;
  return { ...pick, connectionKind: next };
}

/** Format compact cursor badge label for canvas picking feedback. */
export function formatPickCursorBadge(
  pick: SpeedPanelPickSession,
  project: WorldProject,
): { text: string; isError: boolean } {
  if (pick.invalidReason) {
    return { text: pick.invalidReason, isError: true };
  }
  const hoveredZone = pick.hoveredZoneId
    ? project.zones.find((z) => z.id === pick.hoveredZoneId)
    : null;
  if (pick.mode === 'connect') {
    const kindLabel = KIND_LABELS[pick.connectionKind ?? 'passage'] ?? pick.connectionKind ?? 'Passage';
    return {
      text: hoveredZone ? `Connect (${kindLabel}) \u2192 ${hoveredZone.name}` : `Pick target (${kindLabel}) — Tab cycles`,
      isError: false,
    };
  }
  return {
    text: hoveredZone
      ? `Add ${hoveredZone.name} to merge (${pick.pickedZoneIds.length})`
      : `Pick zone to merge (${pick.pickedZoneIds.length} selected) — Shift+Click for multi`,
    isError: false,
  };
}

/** Return eligible off-screen / canvas zones matching a type-ahead pick query. */
export function searchPickZones(
  project: WorldProject,
  pick: SpeedPanelPickSession,
  query: string,
): Array<{ id: string; name: string; disabledReason: string | null }> {
  const norm = query.trim().toLowerCase();
  return project.zones
    .filter((z) => !norm || z.name.toLowerCase().includes(norm) || z.id.toLowerCase().includes(norm))
    .map((z) => ({
      id: z.id,
      name: z.name,
      disabledReason: validatePickTarget(pick, z.id, project),
    }));
}

function endSpatialPickSession(pick: SpeedPanelPickSession, stores: StepExecutionStores): void {
  stores.setConnectionStart(null);
  stores.setPendingConnectionKind(null);
  stores.setTool(pick.previousTool);
  stores.clearSpeedPanelPick();
}

/** Cancel spatial picking without modifying the project or altering the user's selection. */
export function cancelSpatialPick(
  pick: SpeedPanelPickSession | null,
  stores: StepExecutionStores,
): void {
  if (!pick) return;
  endSpatialPickSession(pick, stores);
}

/** Commit a clicked/selected destination zone during spatial picking. */
export function commitSpatialPickTarget(
  pick: SpeedPanelPickSession,
  targetZoneId: string,
  shiftKey: boolean,
  stores: StepExecutionStores,
): { committed: boolean; finished: boolean; pick: SpeedPanelPickSession | null; error: string | null } {
  const missing = isPickSourceMissing(pick, stores.project);
  if (missing) {
    endSpatialPickSession(pick, stores);
    return { committed: false, finished: true, pick: null, error: missing };
  }

  const invalid = validatePickTarget(pick, targetZoneId, stores.project);
  if (invalid) {
    const nextPick: SpeedPanelPickSession = {
      ...pick,
      hoveredZoneId: targetZoneId,
      invalidReason: invalid,
    };
    stores.setSpeedPanelPick(nextPick);
    return { committed: false, finished: false, pick: nextPick, error: invalid };
  }

  if (pick.mode === 'connect') {
    const kind = pick.connectionKind ?? getOrderedKinds(stores.project.mode).preferred[0] ?? 'passage';
    const sourceZone = stores.project.zones.find((z) => z.id === pick.sourceZoneId);
    const targetZone = stores.project.zones.find((z) => z.id === targetZoneId);
    const sourceName = sourceZone?.name ?? pick.sourceZoneId;
    const targetName = targetZone?.name ?? targetZoneId;
    stores.updateProject(
      (p) =>
        appendConnectionToProject(p, {
          fromZoneId: pick.sourceZoneId,
          toZoneId: targetZoneId,
          bidirectional: true,
          kind,
        }),
      `Connect ${sourceName} \u2192 ${targetName} (${kind})`,
    );
    stores.setLastPanelAction({
      commandId: pick.commandId,
      label: `Connect (${KIND_LABELS[kind] ?? kind})`,
      timestamp: Date.now(),
    });
    if (shiftKey) {
      const kept: SpeedPanelPickSession = {
        ...pick,
        hoveredZoneId: null,
        invalidReason: null,
      };
      stores.setSpeedPanelPick(kept);
      return { committed: true, finished: false, pick: kept, error: null };
    }
    endSpatialPickSession(pick, stores);
    return { committed: true, finished: true, pick: null, error: null };
  }

  const nextPicked = [...pick.pickedZoneIds, targetZoneId];
  if (shiftKey || nextPicked.length < 2) {
    const updated: SpeedPanelPickSession = {
      ...pick,
      pickedZoneIds: nextPicked,
      invalidReason: null,
    };
    stores.setSpeedPanelPick(updated);
    return { committed: false, finished: false, pick: updated, error: null };
  }

  const mergeUndoLabel = formatMergeZonesUndoLabel(nextPicked, stores.project);
  const mergedId = stores.mergeZones(nextPicked, mergeUndoLabel);
  if (mergedId) {
    stores.selectZone(mergedId, false);
    stores.setLastPanelAction(recordFinishedPanelAction(stores, {
      commandId: 'merge-zones',
      label: mergeUndoLabel,
      timestamp: Date.now(),
    }));
  }
  stores.setTool(pick.previousTool);
  stores.clearSpeedPanelPick();
  return { committed: Boolean(mergedId), finished: true, pick: null, error: mergedId ? null : 'Could not merge zones' };
}

/** Finalize an accumulated Shift+Click multi-zone merge pick session. */
export function finalizeMergePick(
  pick: SpeedPanelPickSession,
  stores: StepExecutionStores,
): { committed: boolean; mergedId: string | null } {
  if (isPickSourceMissing(pick, stores.project)) {
    endSpatialPickSession(pick, stores);
    return { committed: false, mergedId: null };
  }
  if (pick.mode !== 'merge' || pick.pickedZoneIds.length < 2) {
    return { committed: false, mergedId: null };
  }
  const mergeUndoLabel = formatMergeZonesUndoLabel(pick.pickedZoneIds, stores.project);
  const mergedId = stores.mergeZones(pick.pickedZoneIds, mergeUndoLabel);
  if (mergedId) {
    stores.selectZone(mergedId, false);
    stores.setLastPanelAction(recordFinishedPanelAction(stores, {
      commandId: 'merge-zones',
      label: mergeUndoLabel,
      timestamp: Date.now(),
    }));
  }
  stores.setTool(pick.previousTool);
  stores.clearSpeedPanelPick();
  return { committed: Boolean(mergedId), mergedId };
}

// === Repeat Last Action Here ===

const REPEAT_LAST_ZONE_COMMANDS = new Set([
  'assign-district',
  'place-encounter',
  'set-elevation',
  'connect-from',
  'add-secret-conn',
  'add-channel-conn',
  'add-warp-conn',
  'add-trail-conn',
  'merge-zones',
]);

/** Build the transient `Repeat Last Action Here` palette command without modifying `COMMAND_REGISTRY`. */
export function createRepeatLastCommand(lastAction: LastPanelAction): EditorCommand {
  const sourceCmd = getCommandById(lastAction.commandId);
  return {
    id: 'repeat-last',
    title: `Repeat Last Action Here: ${lastAction.label}`,
    label: `Repeat: ${lastAction.label}`,
    category: sourceCmd?.category ?? 'author',
    surfaces: ['speed-panel'],
    keywords: ['repeat', 'last', 'again', 'replay', lastAction.label.toLowerCase()],
    icon: '\u21BB',
    description: 'Re-run last Speed Panel action at this target',
    speedPanelCategory: 'context',
    macroSafe: false,
    when: (ctx) => {
      if (REPEAT_LAST_ZONE_COMMANDS.has(lastAction.commandId)) {
        return (ctx.hit?.type === 'zone') || (ctx.selection?.zones.length ?? 0) > 0;
      }
      if (lastAction.commandId === 'apply-preset') {
        return true;
      }
      return sourceCmd ? sourceCmd.when(ctx) : true;
    },
    disabledReason: (ctx) => {
      if (REPEAT_LAST_ZONE_COMMANDS.has(lastAction.commandId)) {
        const hasZone = ctx.hit?.type === 'zone' || (ctx.selection?.zones.length ?? 0) > 0;
        return hasZone ? null : `Target a zone to repeat ${lastAction.label}`;
      }
      if (lastAction.commandId === 'apply-preset') {
        const hasZone = ctx.hit?.type === 'zone' || (ctx.selection?.zones.length ?? 0) > 0;
        return hasZone ? null : 'Target a zone to repeat Apply Preset';
      }
      return sourceCmd ? sourceCmd.disabledReason(ctx) : null;
    },
    run: () => ({ executed: true }),
  };
}

/** Deep-clone replay parameters so repeating an action never mutates `lastPanelAction`. */
export function cloneLastPanelActionParams(
  params: LastPanelActionParams | undefined,
): LastPanelActionParams | undefined {
  if (!params) return undefined;
  return { ...params };
}

/** Replay a recorded panel action cleanly on a new target context without opening menus when parameterized. */
export function replayLastPanelAction(
  lastAction: LastPanelAction,
  context: HitResult | null,
  stores: StepExecutionStores,
  deps: {
    executeStores: ExecuteStores;
    hotkeyCtx: HotkeyContext;
    executeDirect: (
      commandId: string,
      context: HitResult | null,
      executeStores: ExecuteStores,
      hotkeyCtx?: HotkeyContext,
    ) => ExecuteResult;
  },
):
  | { status: 'done' }
  | { status: 'pick'; pick: SpeedPanelPickSession }
  | { status: 'error'; message: string } {
  const params = cloneLastPanelActionParams(lastAction.params);
  const targetZoneIds = resolveTargetZoneIds(context, stores.selection);
  const primaryZoneId = context?.type === 'zone' ? context.id : getSelectedZoneId(stores.selection);

  if (params) {
    if (params.kind === 'assign-district') {
      if (targetZoneIds.length === 0) {
        return { status: 'error', message: 'Target a zone to assign district.' };
      }
      const res = commitDistrictAssignment(stores, targetZoneIds, params.districtId);
      return res.ok ? { status: 'done' } : { status: 'error', message: res.error };
    }
    if (params.kind === 'apply-region-preset') {
      const district = primaryZoneId
        ? stores.project.districts.find((d) => d.zoneIds.includes(primaryZoneId))
        : null;
      const preset = stores.regionPresets.find((p) => p.id === params.presetId);
      if (!district) {
        return { status: 'error', message: 'Target zone must belong to a district to repeat region preset.' };
      }
      if (!preset) {
        return { status: 'error', message: 'Previously applied region preset no longer exists.' };
      }
      stores.applyRegionPreset(
        district.id,
        preset,
        params.applyMode,
        `Apply preset "${preset.name}" to ${district.name} (${params.applyMode})`,
      );
      rememberAppliedRegionPreset(preset.id);
      return { status: 'done' };
    }
    if (params.kind === 'apply-encounter-preset') {
      if (!primaryZoneId) {
        return { status: 'error', message: 'Target a zone to repeat encounter preset.' };
      }
      const preset = stores.encounterPresets.find((p) => p.id === params.presetId);
      if (!preset) {
        return { status: 'error', message: 'Previously applied encounter preset no longer exists.' };
      }
      const zone = stores.project.zones.find((z) => z.id === primaryZoneId);
      const id = stores.createEncounterFromPreset(
        primaryZoneId,
        preset,
        `Apply encounter preset "${preset.name}" in ${zone?.name ?? primaryZoneId}`,
      );
      stores.selectEncounter(id, false);
      rememberAppliedEncounterPreset(preset.id);
      return { status: 'done' };
    }
    if (params.kind === 'place-encounter') {
      if (!primaryZoneId) {
        return { status: 'error', message: 'Target a zone to place encounter.' };
      }
      const res = commitPlaceEncounter(stores, primaryZoneId, params.encounterType);
      return res.ok ? { status: 'done' } : { status: 'error', message: res.error };
    }
    if (params.kind === 'set-elevation') {
      if (targetZoneIds.length === 0) {
        return { status: 'error', message: 'Target a zone to set elevation.' };
      }
      const raw = params.elevation === undefined ? '' : String(params.elevation);
      const res = commitSetElevation(stores, targetZoneIds, raw);
      return res.ok ? { status: 'done' } : { status: 'error', message: res.error };
    }
  }

  if (isSpatialPickCommand(lastAction.commandId)) {
    const opened = openCommandStepFlow(lastAction.commandId, context, stores);
    if (opened.kind === 'pick') {
      return { status: 'pick', pick: opened.pick };
    }
    if (opened.kind === 'blocked') {
      return { status: 'error', message: opened.reason };
    }
  }

  const direct = deps.executeDirect(lastAction.commandId, context, deps.executeStores, deps.hotkeyCtx);
  if (!direct.executed) {
    return { status: 'error', message: direct.reason ?? 'Could not repeat action.' };
  }
  return { status: 'done' };
}

/** Compute world-space endpoints for the canvas dashed preview line during `connect` picking. */
export function computePickPreviewLine(
  pick: SpeedPanelPickSession | null,
  project: WorldProject,
  tileSize: number,
  viewport: { panX: number; panY: number; zoom: number },
): { x1: number; y1: number; x2: number; y2: number; isError: boolean } | null {
  if (!pick || pick.mode !== 'connect' || (pick.cursorSX === 0 && pick.cursorSY === 0)) {
    return null;
  }
  const source = project.zones.find((z) => z.id === pick.sourceZoneId);
  if (!source) return null;
  return {
    x1: (source.gridX + source.gridWidth / 2) * tileSize,
    y1: (source.gridY + source.gridHeight / 2) * tileSize,
    x2: pick.cursorSX / viewport.zoom + viewport.panX,
    y2: pick.cursorSY / viewport.zoom + viewport.panY,
    isError: Boolean(pick.invalidReason),
  };
}

export interface CanvasSpatialPickDeps {
  getPick: () => SpeedPanelPickSession | null;
  getProject: () => WorldProject;
  findZoneIdAtGrid: (gx: number, gy: number) => string | null;
  setPick: (pick: SpeedPanelPickSession | null) => void;
  getStores: () => StepExecutionStores;
  onErrorToast?: (msg: string) => void;
}

/** Check whether an event target is an editable field where global canvas pick keys must not steal focus. */
function isEditableEventTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  if (typeof el.tagName !== 'string') return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
}

/** Create Canvas spatial-picking handlers shared by `<Canvas>` and real-handler unit tests. */
export function createCanvasSpatialPickHandlers(deps: CanvasSpatialPickDeps) {
  const handlePointerMove = (sx: number, sy: number, gx: number, gy: number): boolean => {
    const pick = deps.getPick();
    if (!pick) return false;
    const hoverZoneId = deps.findZoneIdAtGrid(gx, gy);
    const missing = isPickSourceMissing(pick, deps.getProject());
    const invalidReason = missing ?? (hoverZoneId ? validatePickTarget(pick, hoverZoneId, deps.getProject()) : null);
    if (
      pick.cursorSX === sx &&
      pick.cursorSY === sy &&
      pick.hoveredZoneId === hoverZoneId &&
      pick.invalidReason === invalidReason
    ) {
      return true;
    }
    deps.setPick({
      ...pick,
      cursorSX: sx,
      cursorSY: sy,
      hoveredZoneId: hoverZoneId,
      invalidReason,
    });
    return true;
  };

  const handleMouseDown = (gx: number, gy: number, shiftKey: boolean): boolean => {
    const pick = deps.getPick();
    if (!pick) return false;
    const missing = isPickSourceMissing(pick, deps.getProject());
    if (missing) {
      endSpatialPickSession(pick, deps.getStores());
      deps.onErrorToast?.(missing);
      return true;
    }
    const zoneId = deps.findZoneIdAtGrid(gx, gy);
    if (!zoneId) {
      deps.onErrorToast?.('Click a zone on canvas, or press Esc to cancel.');
      return true;
    }
    const res = commitSpatialPickTarget(pick, zoneId, shiftKey, deps.getStores());
    if (res.finished && res.error) {
      deps.onErrorToast?.(res.error);
    }
    return true;
  };

  const handleKeyDown = (e: {
    key: string;
    target?: unknown;
    preventDefault: () => void;
    stopPropagation?: () => void;
  }): boolean => {
    const pick = deps.getPick();
    if (!pick) return false;
    if (isEditableEventTarget(e.target)) {
      return false;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation?.();
      cancelSpatialPick(pick, deps.getStores());
      return true;
    }
    if (e.key === 'Tab' && pick.mode === 'connect') {
      e.preventDefault();
      e.stopPropagation?.();
      deps.setPick(cyclePickConnectionKind(pick, deps.getProject().mode));
      return true;
    }
    if (e.key === 'Enter' && pick.mode === 'merge' && pick.pickedZoneIds.length >= 2) {
      e.preventDefault();
      e.stopPropagation?.();
      finalizeMergePick(pick, deps.getStores());
      return true;
    }
    return false;
  };

  return {
    handlePointerMove,
    handleMouseDown,
    handleKeyDown,
  };
}

/** Draw the dashed preview line onto a 2D canvas context during `connect` spatial picking. */
export function drawPickPreviewLine(
  ctx: {
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    setLineDash: (segments: number[]) => void;
    beginPath: () => void;
    moveTo: (x: number, y: number) => void;
    lineTo: (x: number, y: number) => void;
    stroke: () => void;
  },
  preview: { x1: number; y1: number; x2: number; y2: number; isError: boolean },
  zoom: number,
  colors: { valid: string; error: string },
): void {
  ctx.strokeStyle = preview.isError ? colors.error : colors.valid;
  ctx.lineWidth = 2 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.beginPath();
  ctx.moveTo(preview.x1, preview.y1);
  ctx.lineTo(preview.x2, preview.y2);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Route Escape, Tab kind cycle, and Enter zone confirmation inside `wf-sp-pick-search`. */
export function dispatchPickOverlayInputKeyDown(
  e: { key: string; shiftKey: boolean; preventDefault: () => void; stopPropagation: () => void },
  deps: {
    pickMode: 'connect' | 'merge';
    candidates: ReadonlyArray<{ id: string; disabledReason: string | null }>;
    onCancel: () => void;
    onCycleKind: () => void;
    onPickZone: (zoneId: string, shiftKey: boolean) => void;
    clearQuery: () => void;
  },
): 'cancel' | 'cycle' | 'pick' | 'none' {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    deps.onCancel();
    return 'cancel';
  }
  if (e.key === 'Tab' && deps.pickMode === 'connect') {
    e.preventDefault();
    e.stopPropagation();
    deps.onCycleKind();
    return 'cycle';
  }
  if (e.key === 'Enter') {
    const firstEligible = deps.candidates.find((c) => c.disabledReason === null);
    if (firstEligible) {
      e.preventDefault();
      e.stopPropagation();
      deps.onPickZone(firstEligible.id, e.shiftKey);
      deps.clearQuery();
      return 'pick';
    }
  }
  return 'none';
}
