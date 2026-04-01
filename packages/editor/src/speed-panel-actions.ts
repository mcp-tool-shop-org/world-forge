// speed-panel-actions.ts — action registry for the Speed Panel command palette

import type { HitResult } from './hit-testing.js';
import type { AuthoringMode, WorldProject } from '@world-forge/schema';

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

/** Result of a single macro step execution. */
export interface MacroStepResult {
  action: string;
  success: boolean;
}

export interface MacroExecutionResult {
  completed: number;
  total: number;
  abortedAt?: number;
  reason?: string;
  /** Step-by-step breakdown of execution. */
  steps: MacroStepResult[];
  totalSteps: number;
  completedSteps: number;
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

  // -- Multi-zone --
  { id: 'merge-zones',      label: 'Merge Zones',           icon: 'M',  category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: true },

  // -- Review --
  { id: 'open-review',      label: 'Open Review',           icon: '\uD83D\uDCCB', category: 'global', contextFilter: (h) => h === null, macroSafe: true },
  { id: 'export-summary',   label: 'Export Summary',        icon: '\uD83D\uDCC4', category: 'global', contextFilter: (h) => h === null, macroSafe: true },
];

/**
 * Fuzzy-match: returns true when all characters in `query` appear in `text`
 * in order (case-insensitive). Score rewards consecutive runs, word-start
 * hits, and shorter targets.
 */
export function fuzzyMatch(query: string, text: string): { match: boolean; score: number } {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (q.length === 0) return { match: true, score: 0 };

  let qi = 0;
  let score = 0;
  let consecutive = 0;

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Consecutive-match bonus: each additional consecutive char doubles value
      consecutive++;
      score += consecutive;

      // Word-start bonus: first char of text or preceded by space / hyphen / underscore
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') {
        score += 5;
      }

      qi++;
    } else {
      consecutive = 0;
    }
  }

  if (qi < q.length) return { match: false, score: 0 };

  // Shorter text bonus — prefer tighter matches
  score += Math.max(0, 50 - t.length);

  return { match: true, score };
}

/** Look up an action by id */
export function getActionById(id: string): SpeedPanelAction | undefined {
  return SPEED_PANEL_ACTIONS.find((a) => a.id === id);
}

/** Maximum number of actions returned by getContextMenuActions. */
const CONTEXT_MENU_LIMIT = 7;

/**
 * Return the top context-menu actions for a right-click hit result.
 * Context-sensitive: zone hit shows zone actions, entity hit shows entity actions,
 * empty canvas (null hit) shows create/global actions. Returns at most 7 actions.
 */
export function getContextMenuActions(
  hitResult: HitResult | null,
  _project: WorldProject,
): SpeedPanelAction[] {
  const matching = SPEED_PANEL_ACTIONS.filter((a) => a.contextFilter(hitResult));
  // Prioritize: context actions first (more specific), then global
  const sorted = [...matching].sort((a, b) => {
    if (a.category === 'context' && b.category !== 'context') return -1;
    if (a.category !== 'context' && b.category === 'context') return 1;
    return 0;
  });
  return sorted.slice(0, CONTEXT_MENU_LIMIT);
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
  const q = query.trim();
  let filtered: SpeedPanelAction[];
  if (q) {
    const scored = matching
      .map((a) => ({ action: a, ...fuzzyMatch(q, a.label) }))
      .filter((r) => r.match);
    scored.sort((a, b) => b.score - a.score);
    filtered = scored.map((r) => r.action);
  } else {
    filtered = matching;
  }

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

  // Filter macros by query (fuzzy)
  const macroResults = (macros ?? []).filter(
    (m) => !q || fuzzyMatch(q, m.name).match,
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
