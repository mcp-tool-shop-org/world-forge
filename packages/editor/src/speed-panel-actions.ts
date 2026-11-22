// speed-panel-actions.ts — action registry for the Speed Panel command palette

import type { HitResult } from './hit-testing.js';
import type { AuthoringMode, WorldProject } from '@world-forge/schema';
import {
  SPEED_PANEL_ICON_GLYPH,
  getContextMenuCommands,
  getSpeedPanelCommands,
  type EditorCommand,
  type SpeedPanelIconId,
} from './command-registry.js';

export { SPEED_PANEL_ICON_GLYPH, type SpeedPanelIconId };

export interface SpeedPanelAction {
  id: string;
  label: string;
  /** 16px geometric glyph (SPEED_PANEL_ICON_GLYPH[iconId]). */
  icon: string;
  iconId?: SpeedPanelIconId;
  /** One-line blurb for the command palette / context menu. */
  description?: string;
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

function toSpeedPanelAction(cmd: EditorCommand): SpeedPanelAction {
  return {
    id: cmd.id,
    label: cmd.label ?? cmd.title,
    icon: cmd.icon ?? '',
    ...(cmd.iconId ? { iconId: cmd.iconId } : {}),
    ...(cmd.description !== undefined ? { description: cmd.description } : {}),
    category: cmd.speedPanelCategory ?? 'context',
    contextFilter: (h) => cmd.when({ hit: h }),
    macroSafe: cmd.macroSafe ?? false,
    ...(cmd.modeSuggested ? { modeSuggested: cmd.modeSuggested } : {}),
  };
}

export const SPEED_PANEL_ACTIONS: SpeedPanelAction[] = getSpeedPanelCommands().map(toSpeedPanelAction);

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

/**
 * Return the top context-menu actions for a right-click hit result.
 * Context-sensitive: zone hit shows zone actions, entity hit shows entity actions,
 * empty canvas (null hit) shows create/global actions. Returns at most 7 actions.
 */
export function getContextMenuActions(
  hitResult: HitResult | null,
  _project: WorldProject,
): SpeedPanelAction[] {
  return getContextMenuCommands(hitResult).map(toSpeedPanelAction);
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
