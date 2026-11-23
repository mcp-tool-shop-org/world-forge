// speed-panel-quick-fix.ts — pure per-object problem lookup, cached project snapshot, and Quick Fix step flow

import {
  presentationAdvisories,
  scanDependencies,
  validateProject,
  type DependencyEdge,
  type ScanDependenciesLookups,
  type ValidationError,
  type WorldProject,
} from '@world-forge/schema';
import type { HitResult } from './hit-testing.js';
import { repairsForEdge, type RepairAction } from './repairs.js';
import type { StepChoiceOption, StepStackState } from './speed-panel-steps.js';
import {
  emptySelection,
  type FocusTarget,
  type RightTab,
  type SelectionKind,
  type SelectionSet,
} from './store/editor-store.js';

export type QuickFixSource = 'validate' | 'dependencies' | 'presentation';

export type QuickFixTarget = HitResult | { type: 'district'; id: string };

export interface ObjectProblem {
  id: string;
  source: QuickFixSource;
  message: string;
  sidebarTab: 'issues' | 'deps' | 'review';
  showLabel: 'Show in Issues' | 'Show in Deps' | 'Show in Review';
  edge?: DependencyEdge;
  repairs: RepairAction[];
}

export interface QuickFixRowView {
  count: number;
  label: string;
  countLabel: string;
  problems: ObjectProblem[];
}

export interface QuickFixFlowState {
  target: QuickFixTarget;
  targetLabel: string;
  problems: ObjectProblem[];
  selectedProblemId: string | null;
  filter: string;
  activeIdx: number;
}

export interface ProjectProblemSnapshot {
  validationErrors: ValidationError[];
  depEdges: DependencyEdge[];
  presentationMessages: string[];
}

export interface QuickFixSelectStores {
  project: WorldProject;
  selectZone: (id: string, additive: boolean) => void;
  selectEntity: (id: string, additive: boolean) => void;
  selectLandmark: (id: string, additive: boolean) => void;
  selectSpawn: (id: string, additive: boolean) => void;
  selectEncounter: (id: string, additive: boolean) => void;
  selectConnection: (from: string, to: string) => void;
  selectKind?: (kind: SelectionKind, id: string, additive: boolean) => void;
  selectAll?: (sel: SelectionSet, additive: boolean) => void;
  setFocusTarget?: (target: FocusTarget | null) => void;
  setRightTab: (tab: RightTab) => void;
  setRightCollapsed?: (collapsed: boolean) => void;
}

const snapshotCache = new WeakMap<WorldProject, ProjectProblemSnapshot>();

function buildSharedDepLookups(project: WorldProject): ScanDependenciesLookups {
  return {
    assetMap: new Map((project.assets ?? []).map((a) => [a.id, { kind: a.kind, label: a.label }])),
    packIds: new Set((project.assetPacks ?? []).map((p) => p.id)),
    zoneIds: new Set((project.zones ?? []).map((z) => z.id)),
    dialogueIds: new Set((project.dialogues ?? []).map((d) => d.id)),
  };
}

/** Build a fresh snapshot of all three problem sources using shared dependency lookups. */
export function buildProjectProblemSnapshot(project: WorldProject): ProjectProblemSnapshot {
  const lookups = buildSharedDepLookups(project);
  return {
    validationErrors: validateProject(project).errors,
    depEdges: scanDependencies(project, lookups).edges,
    presentationMessages: presentationAdvisories(project),
  };
}

/** Return the cached problem snapshot for `project` (keyed by immutable store reference). */
export function getProjectProblemSnapshot(project: WorldProject): ProjectProblemSnapshot {
  const cached = snapshotCache.get(project);
  if (cached) return cached;
  const built = buildProjectProblemSnapshot(project);
  snapshotCache.set(project, built);
  return built;
}

const VALIDATE_PATH_PREFIX: Partial<Record<QuickFixTarget['type'], string>> = {
  zone: 'zones.',
  entity: 'entityPlacements.',
  landmark: 'landmarks.',
  encounter: 'encounterAnchors.',
  district: 'districts.',
  spawn: 'spawnPoints.',
  item: 'itemPlacements.',
  building: 'buildings.',
  hub: 'hubs.',
  stronghold: 'strongholds.',
  station: 'craftingStations.',
  market: 'marketNodes.',
  prop: 'propPlacements.',
};

const DEP_SOURCE_TYPE_MAP: Partial<Record<QuickFixTarget['type'], string>> = {
  zone: 'zone',
  entity: 'entityPlacement',
  landmark: 'landmark',
  encounter: 'encounterAnchor',
  district: 'district',
  connection: 'connection',
  spawn: 'spawnPoint',
  item: 'itemPlacement',
  building: 'building',
  hub: 'hub',
  stronghold: 'stronghold',
  station: 'craftingStation',
  market: 'marketNode',
  prop: 'propPlacement',
};

function matchesPathSegment(path: string, prefix: string, id: string): boolean {
  const full = `${prefix}${id}`;
  return path === full || path.startsWith(`${full}.`);
}

function parseConnTargetId(id: string): [string, string] | null {
  const sep = id.indexOf('::');
  if (sep <= 0) return null;
  const from = id.slice(0, sep);
  const to = id.slice(sep + 2);
  return to ? [from, to] : null;
}

function matchesValidationError(
  err: ValidationError,
  target: QuickFixTarget,
  project: WorldProject,
): boolean {
  if (target.type === 'connection') {
    const connMatch = /^connections\[(\d+)\](?:\.|$)/.exec(err.path);
    if (!connMatch) return false;
    const idx = Number(connMatch[1]);
    const conn = project.connections[idx];
    if (!conn) return false;
    return `${conn.fromZoneId}::${conn.toZoneId}` === target.id;
  }

  const prefix = VALIDATE_PATH_PREFIX[target.type];
  if (prefix && matchesPathSegment(err.path, prefix, target.id)) {
    return true;
  }

  if (target.type === 'zone' && err.path === `presentation.zoneCells.${target.id}`) {
    return true;
  }

  return false;
}

function matchesDependencyEdge(edge: DependencyEdge, target: QuickFixTarget): boolean {
  if (edge.status === 'ok' || edge.status === 'informational') return false;
  if (target.type === 'connection') {
    const parsed = parseConnTargetId(target.id);
    if (!parsed) return false;
    return edge.sourceType === 'connection' && edge.sourceId === `${parsed[0]}-${parsed[1]}`;
  }
  const sourceType = DEP_SOURCE_TYPE_MAP[target.type];
  return Boolean(sourceType && edge.sourceType === sourceType && edge.sourceId === target.id);
}

function matchesPresentationAdvisory(message: string, target: QuickFixTarget): boolean {
  // Rule 4 ("presentation: no player row in occupancy") and unknown-ID warnings
  // must not be attributed unless the target object's own ID appears explicitly.
  const actorMatch = /^presentation: (?:duplicate actor id|actor) '([^']+)'/.exec(message);
  if (actorMatch && target.type === 'entity') {
    const actorId = actorMatch[1];
    if (actorId !== 'player' && actorId === target.id) return true;
  }

  if (target.type === 'zone') {
    const zoneMatch = /zone '([^']+)'/.exec(message);
    if (zoneMatch && zoneMatch[1] === target.id) return true;

    const driftMatch = /is drawn in '([^']+)' but the sim places it in '([^']+)'/.exec(message);
    if (driftMatch && (driftMatch[1] === target.id || driftMatch[2] === target.id)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve all existing validation, dependency, and presentation problems belonging to `target`,
 * preserving each source's verbatim message text. Problems naming no matching ID are excluded.
 */
export function getProblemsForObject(
  project: WorldProject,
  target: QuickFixTarget | null,
  snapshot?: ProjectProblemSnapshot,
): ObjectProblem[] {
  if (!target) return [];
  const snap = snapshot ?? getProjectProblemSnapshot(project);
  const problems: ObjectProblem[] = [];

  for (let i = 0; i < snap.validationErrors.length; i++) {
    const err = snap.validationErrors[i];
    if (!matchesValidationError(err, target, project)) continue;
    problems.push({
      id: `val:${i}:${err.path}`,
      source: 'validate',
      message: err.message,
      sidebarTab: 'issues',
      showLabel: 'Show in Issues',
      repairs: [],
    });
  }

  for (let i = 0; i < snap.depEdges.length; i++) {
    const edge = snap.depEdges[i];
    if (!matchesDependencyEdge(edge, target)) continue;
    problems.push({
      id: `dep:${i}:${edge.domain}:${edge.fieldName ?? ''}`,
      source: 'dependencies',
      message: edge.message,
      sidebarTab: 'deps',
      showLabel: 'Show in Deps',
      edge,
      repairs: repairsForEdge(edge, project),
    });
  }

  for (let i = 0; i < snap.presentationMessages.length; i++) {
    const msg = snap.presentationMessages[i];
    if (!matchesPresentationAdvisory(msg, target)) continue;
    problems.push({
      id: `pres:${i}`,
      source: 'presentation',
      message: msg,
      sidebarTab: 'review',
      showLabel: 'Show in Review',
      repairs: [],
    });
  }

  return problems;
}

/** Build the optional Band 1 Quick Fix row summary when at least one object problem exists. */
export function buildQuickFixRowView(problems: readonly ObjectProblem[]): QuickFixRowView | null {
  if (problems.length === 0) return null;
  const count = problems.length;
  return {
    count,
    label: 'Quick Fix',
    countLabel: `${count} problem${count === 1 ? '' : 's'}`,
    problems: [...problems],
  };
}

export function formatQuickFixTargetLabel(target: QuickFixTarget, project?: WorldProject): string {
  if (target.type === 'zone') return project?.zones.find((z) => z.id === target.id)?.name ?? target.id;
  if (target.type === 'entity') return project?.entityPlacements.find((e) => e.entityId === target.id)?.name ?? target.id;
  if (target.type === 'landmark') return project?.landmarks.find((l) => l.id === target.id)?.name ?? target.id;
  if (target.type === 'district') return project?.districts.find((d) => d.id === target.id)?.name ?? target.id;
  return target.id;
}

/** Open Step 1 of the Quick Fix step stack for `target`. */
export function openQuickFixFlow(
  target: QuickFixTarget,
  problems: readonly ObjectProblem[],
  project?: WorldProject,
): QuickFixFlowState {
  return {
    target,
    targetLabel: formatQuickFixTargetLabel(target, project),
    problems: [...problems],
    selectedProblemId: null,
    filter: '',
    activeIdx: 0,
  };
}

const SOURCE_BADGE_LABEL: Record<QuickFixSource, string> = {
  validate: 'Issues',
  dependencies: 'Deps',
  presentation: 'Review',
};

/** Project the active Quick Fix step into a `StepStackState` for `SpeedPanelStepView`. */
export function buildQuickFixStepView(flow: QuickFixFlowState): {
  stepStack: StepStackState;
  selectedProblem: ObjectProblem | null;
} {
  const selectedProblem = flow.selectedProblemId
    ? flow.problems.find((p) => p.id === flow.selectedProblemId) ?? null
    : null;

  if (!selectedProblem) {
    const options: StepChoiceOption[] = flow.problems.map((p) => ({
      id: p.id,
      label: p.message,
      description: p.repairs.length > 0
        ? `${p.repairs.length} repair${p.repairs.length === 1 ? '' : 's'} available`
        : p.showLabel,
      kind: 'option',
      badge: {
        text: SOURCE_BADGE_LABEL[p.source],
        tone: p.source === 'presentation' ? 'mapped' : 'neutral',
      },
    }));
    return {
      selectedProblem: null,
      stepStack: {
        commandId: 'quick-fix',
        commandLabel: `Quick Fix (${flow.targetLabel})`,
        context: flow.target.type === 'district' ? null : flow.target,
        targetZoneIds: flow.target.type === 'zone' ? [flow.target.id] : [],
        steps: [
          {
            kind: 'choice',
            stepId: 'quick-fix-list',
            title: `Problems for ${flow.targetLabel}`,
            placeholder: 'Filter problems\u2026',
            options,
          },
        ],
        error: null,
      },
    };
  }

  const actionOptions: StepChoiceOption[] = selectedProblem.repairs.map((repair, idx) => ({
    id: `repair:${idx}`,
    label: repair.label,
    description: 'Apply automatic repair',
    kind: 'option',
  }));
  actionOptions.push({
    id: 'show-in-panel',
    label: selectedProblem.showLabel,
    description: `Open ${SOURCE_BADGE_LABEL[selectedProblem.source]} tab with item selected`,
    kind: 'option',
  });

  return {
    selectedProblem,
    stepStack: {
      commandId: 'quick-fix',
      commandLabel: 'Quick Fix',
      context: flow.target.type === 'district' ? null : flow.target,
      targetZoneIds: flow.target.type === 'zone' ? [flow.target.id] : [],
      steps: [
        {
          kind: 'choice',
          stepId: 'quick-fix-list',
          title: `Problems for ${flow.targetLabel}`,
          placeholder: 'Filter problems\u2026',
          options: [],
        },
        {
          kind: 'choice',
          stepId: 'quick-fix-actions',
          title: selectedProblem.message,
          placeholder: 'Choose repair or inspection\u2026',
          options: actionOptions,
        },
      ],
      error: null,
    },
  };
}

/** Select the hit object in the editor store and ensure the right sidebar is visible. */
export function selectQuickFixTarget(
  target: QuickFixTarget,
  stores: QuickFixSelectStores,
): void {
  if (target.type === 'zone') {
    stores.selectZone(target.id, false);
  } else if (target.type === 'entity') {
    stores.selectEntity(target.id, false);
    stores.setFocusTarget?.({ domain: 'entities', subPath: `entityPlacements.${target.id}`, timestamp: Date.now() });
  } else if (target.type === 'landmark') {
    stores.selectLandmark(target.id, false);
  } else if (target.type === 'spawn') {
    stores.selectSpawn(target.id, false);
  } else if (target.type === 'encounter') {
    stores.selectEncounter(target.id, false);
  } else if (target.type === 'connection') {
    const parsed = parseConnTargetId(target.id);
    if (parsed) stores.selectConnection(parsed[0], parsed[1]);
  } else if (target.type === 'district') {
    const dist = stores.project.districts.find((d) => d.id === target.id);
    if (dist && dist.zoneIds.length > 0 && stores.selectAll) {
      stores.selectAll({ ...emptySelection(), zones: [...dist.zoneIds] }, false);
    } else if (dist && dist.zoneIds[0]) {
      stores.selectZone(dist.zoneIds[0], false);
    }
    stores.setFocusTarget?.({ domain: 'world', subPath: `districts.${target.id}`, timestamp: Date.now() });
  } else {
    stores.selectKind?.(target.type, target.id, false);
  }
  stores.setRightCollapsed?.(false);
}

/** Advance Step 1 (pick problem) or execute Step 2 (apply repair via Deps undo label or open sidebar tab). */
export function selectQuickFixOption(
  flow: QuickFixFlowState,
  option: StepChoiceOption,
  deps: {
    stores: QuickFixSelectStores & {
      updateProject: (updater: (p: WorldProject) => WorldProject, label?: string) => void;
    };
    setQuickFixFlow: (next: QuickFixFlowState | null) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  if (flow.selectedProblemId === null) {
    deps.setQuickFixFlow({
      ...flow,
      selectedProblemId: option.id,
      filter: '',
      activeIdx: 0,
    });
    return false;
  }

  const problem = flow.problems.find((p) => p.id === flow.selectedProblemId);
  if (!problem) {
    deps.setQuickFixFlow(null);
    return false;
  }

  if (option.id.startsWith('repair:')) {
    const idx = Number(option.id.slice('repair:'.length));
    const repair = problem.repairs[idx];
    if (!repair) return false;
    deps.stores.updateProject(repair.apply, `Repair: ${repair.label}`);
    deps.setQuickFixFlow(null);
    deps.closeSpeedPanel();
    return true;
  }

  if (option.id === 'show-in-panel') {
    selectQuickFixTarget(flow.target, deps.stores);
    deps.stores.setRightTab(problem.sidebarTab);
    deps.setQuickFixFlow(null);
    deps.closeSpeedPanel();
    return true;
  }

  return false;
}

/** Pop back from Step 2 to Step 1, or from Step 1 back to the root palette search box. */
export function stepBackQuickFixFlow(
  flow: QuickFixFlowState,
  deps: {
    setQuickFixFlow: (next: QuickFixFlowState | null) => void;
    refocusSearch?: () => void;
  },
): void {
  if (flow.selectedProblemId !== null) {
    deps.setQuickFixFlow({
      ...flow,
      selectedProblemId: null,
      filter: '',
      activeIdx: 0,
    });
    return;
  }
  deps.setQuickFixFlow(null);
  deps.refocusSearch?.();
}
