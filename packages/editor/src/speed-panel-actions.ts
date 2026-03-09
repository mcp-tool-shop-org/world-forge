// speed-panel-actions.ts — action registry for the Speed Panel command palette

import type { HitResult } from './hit-testing.js';
import type { AuthoringMode } from '@world-forge/schema';

export interface SpeedPanelAction {
  id: string;
  label: string;
  icon: string;
  category: 'context' | 'global';
  /** Return true if this action should appear for the given hit context */
  contextFilter: (hit: HitResult | null) => boolean;
  /** Whether this action can be used as a macro step (no interactive picking) */
  macroSafe: boolean;
  /** If set, this action appears in the MODE SUGGESTIONS section for matching modes. */
  modeSuggested?: AuthoringMode[];
}

// -- Group & Macro types --

export interface SpeedPanelGroup {
  id: string;
  name: string;
  actionIds: string[];
}

export interface MacroStep {
  actionId: string;
}

export interface SpeedPanelMacro {
  id: string;
  name: string;
  steps: MacroStep[];
}

export interface MacroExecutionResult {
  completed: number;
  total: number;
  abortedAt?: number;
  reason?: string;
}

export interface GroupedActions {
  group: SpeedPanelGroup;
  actions: SpeedPanelAction[];
}

export interface FilteredActions {
  pinned: SpeedPanelAction[];
  recents: SpeedPanelAction[];
  groups: GroupedActions[];
  macros: SpeedPanelMacro[];
  modeSuggested: SpeedPanelAction[];
  contextual: SpeedPanelAction[];
}

const hasDuplicate = (h: HitResult | null) =>
  h?.type === 'zone' || h?.type === 'entity' || h?.type === 'landmark';

export const SPEED_PANEL_ACTIONS: SpeedPanelAction[] = [
  // -- Global (empty canvas) --
  { id: 'new-zone',        label: 'New Zone',           icon: '+',  category: 'global',  contextFilter: (h) => h === null,            macroSafe: false },
  { id: 'fit-content',     label: 'Fit to Content',     icon: '[]', category: 'global',  contextFilter: (h) => h === null,            macroSafe: true },

  // -- Any object --
  { id: 'edit-props',      label: 'Edit Properties',    icon: 'E',  category: 'context', contextFilter: (h) => h !== null,            macroSafe: true },
  { id: 'delete',          label: 'Delete',             icon: 'X',  category: 'context', contextFilter: (h) => h !== null,            macroSafe: true },
  { id: 'duplicate',       label: 'Duplicate',          icon: 'D',  category: 'context', contextFilter: hasDuplicate,                 macroSafe: true },

  // -- Zone-only --
  { id: 'assign-district',  label: 'Assign District',    icon: 'Dsc', category: 'context', contextFilter: (h) => h?.type === 'zone',   macroSafe: true },
  { id: 'place-entity',     label: 'Place Entity Here',  icon: 'Ent', category: 'context', contextFilter: (h) => h?.type === 'zone',   macroSafe: false },
  { id: 'connect-from',     label: 'Connect From Here',  icon: '->', category: 'context', contextFilter: (h) => h?.type === 'zone',    macroSafe: false },

  // -- Connection-only --
  { id: 'swap-direction',   label: 'Swap Direction',     icon: '<>', category: 'context', contextFilter: (h) => h?.type === 'connection', macroSafe: true },

  // -- Mode-suggested (global, appear in MODE section for matching modes) --
  { id: 'add-secret-conn',  label: 'Add Secret Connection', icon: '?',  category: 'global', contextFilter: (h) => h === null, macroSafe: false, modeSuggested: ['dungeon', 'interior'] },
  { id: 'add-channel-conn', label: 'Add Channel',           icon: '~',  category: 'global', contextFilter: (h) => h === null, macroSafe: false, modeSuggested: ['ocean'] },
  { id: 'add-warp-conn',    label: 'Add Warp Route',        icon: '*',  category: 'global', contextFilter: (h) => h === null, macroSafe: false, modeSuggested: ['space'] },
  { id: 'add-trail-conn',   label: 'Add Trail',             icon: '^',  category: 'global', contextFilter: (h) => h === null, macroSafe: false, modeSuggested: ['wilderness'] },
];

/** Look up an action by id */
export function getActionById(id: string): SpeedPanelAction | undefined {
  return SPEED_PANEL_ACTIONS.find((a) => a.id === id);
}

/**
 * Filter actions by context hit and search query, splitting into pinned, recents,
 * groups, macros, mode-suggested, and contextual sections.
 */
export function filterActions(
  actions: readonly SpeedPanelAction[],
  context: HitResult | null,
  query: string,
  pinnedIds: readonly string[],
  recentIds?: readonly string[],
  groups?: readonly SpeedPanelGroup[],
  macros?: readonly SpeedPanelMacro[],
  mode?: AuthoringMode,
): FilteredActions {
  const matching = actions.filter((a) => a.contextFilter(context));
  const q = query.trim().toLowerCase();
  const filtered = q ? matching.filter((a) => a.label.toLowerCase().includes(q)) : matching;

  const pinnedSet = new Set(pinnedIds);
  const recentSet = new Set(recentIds ?? []);
  // Actions in groups (de-duped from contextual)
  const inGroup = new Set<string>();

  // Build groups — filter each group's actions through context
  const groupResults: GroupedActions[] = [];
  if (groups && groups.length > 0) {
    for (const g of groups) {
      const ga = g.actionIds
        .map((id) => filtered.find((a) => a.id === id))
        .filter((a): a is SpeedPanelAction => a !== undefined);
      if (ga.length > 0) {
        groupResults.push({ group: g, actions: ga });
        for (const a of ga) inGroup.add(a.id);
      }
    }
  }

  // Filter macros by query
  const macroResults = (macros ?? []).filter(
    (m) => !q || m.name.toLowerCase().includes(q),
  );

  // Build pinned — preserve order from pinnedIds
  const pinned: SpeedPanelAction[] = [];
  for (const id of pinnedIds) {
    const a = filtered.find((x) => x.id === id);
    if (a) pinned.push(a);
  }

  // Build recents — preserve order from recentIds, exclude already-pinned
  const recents: SpeedPanelAction[] = [];
  for (const id of (recentIds ?? [])) {
    if (pinnedSet.has(id)) continue;
    const a = filtered.find((x) => x.id === id);
    if (a) recents.push(a);
  }

  // Mode-suggested — actions that match the current mode, excluding pinned/recent/grouped
  const modeSuggestedSet = new Set<string>();
  const modeSuggested: SpeedPanelAction[] = [];
  if (mode) {
    for (const a of filtered) {
      if (a.modeSuggested?.includes(mode) && !pinnedSet.has(a.id) && !recentSet.has(a.id) && !inGroup.has(a.id)) {
        modeSuggested.push(a);
        modeSuggestedSet.add(a.id);
      }
    }
  }

  // Contextual — everything not pinned, not in recents, not in a group, not mode-suggested
  const contextual: SpeedPanelAction[] = [];
  for (const a of filtered) {
    if (!pinnedSet.has(a.id) && !recentSet.has(a.id) && !inGroup.has(a.id) && !modeSuggestedSet.has(a.id)) {
      contextual.push(a);
    }
  }

  return { pinned, recents, groups: groupResults, macros: macroResults, modeSuggested, contextual };
}
