// speed-panel-actions.ts — action registry for the Speed Panel command palette

import type { HitResult } from './hit-testing.js';
import type { AuthoringMode, WorldProject } from '@world-forge/schema';

/** Closed icon enum so the palette/context menu can style a 16px glyph from tokens. */
export type SpeedPanelIconId =
  | 'plus'
  | 'fit'
  | 'edit'
  | 'delete'
  | 'duplicate'
  | 'district'
  | 'entity'
  | 'connect'
  | 'swap'
  | 'merge'
  | 'elevation'
  | 'review'
  | 'summary'
  | 'encounter'
  | 'connect-secret'
  | 'connect-channel'
  | 'connect-warp'
  | 'connect-trail';

/** Geometric glyphs — not emoji, not 1–3 letter codes. */
export const SPEED_PANEL_ICON_GLYPH: Record<SpeedPanelIconId, string> = {
  plus: '+',
  fit: '\u25F1',
  edit: '\u270E',
  delete: '\u2715',
  duplicate: '\u29C9',
  district: '\u25A6',
  entity: '\u25C9',
  connect: '\u2192',
  swap: '\u21C4',
  merge: '\u22C8',
  elevation: '\u25B2',
  review: '\u2611',
  summary: '\u25A4',
  encounter: '\u25C7',
  'connect-secret': '\u2726',
  'connect-channel': '\u2248',
  'connect-warp': '\u29C1',
  'connect-trail': '\u2198',
};

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

const hasDuplicate = (h: HitResult | null) =>
  h?.type === 'zone' || h?.type === 'entity' || h?.type === 'landmark';

export const SPEED_PANEL_ACTIONS: SpeedPanelAction[] = [
  // -- Global (empty canvas) --
  { id: 'new-zone',        label: 'New Zone',           icon: SPEED_PANEL_ICON_GLYPH.plus,       iconId: 'plus',       description: 'Paint a new zone on the canvas',                    category: 'global',  contextFilter: (h) => h === null,            macroSafe: false },
  { id: 'fit-content',     label: 'Fit to Content',     icon: SPEED_PANEL_ICON_GLYPH.fit,        iconId: 'fit',        description: 'Zoom the viewport to fit the whole map',            category: 'global',  contextFilter: (h) => h === null,            macroSafe: true },

  // -- Any object --
  { id: 'edit-props',      label: 'Edit Properties',    icon: SPEED_PANEL_ICON_GLYPH.edit,       iconId: 'edit',       description: 'Open properties for the selected object',           category: 'context', contextFilter: (h) => h !== null,            macroSafe: true },
  { id: 'delete',          label: 'Delete',             icon: SPEED_PANEL_ICON_GLYPH.delete,     iconId: 'delete',     description: 'Remove the selected object',                        category: 'context', contextFilter: (h) => h !== null,            macroSafe: true },
  { id: 'duplicate',       label: 'Duplicate',          icon: SPEED_PANEL_ICON_GLYPH.duplicate,  iconId: 'duplicate',  description: 'Copy the selected object nearby',                   category: 'context', contextFilter: hasDuplicate,                 macroSafe: true },

  // -- Zone-only --
  { id: 'assign-district',  label: 'Assign District',    icon: SPEED_PANEL_ICON_GLYPH.district,   iconId: 'district',   description: 'Set this zone’s parent district',                   category: 'context', contextFilter: (h) => h?.type === 'zone',   macroSafe: true },
  { id: 'place-entity',     label: 'Place Entity Here',  icon: SPEED_PANEL_ICON_GLYPH.entity,     iconId: 'entity',     description: 'Drop an entity inside this zone',                   category: 'context', contextFilter: (h) => h?.type === 'zone',   macroSafe: false },
  { id: 'place-encounter',  label: 'Place Encounter Here', icon: SPEED_PANEL_ICON_GLYPH.encounter, iconId: 'encounter', description: 'Drop an encounter anchor inside this zone',         category: 'context', contextFilter: (h) => h?.type === 'zone',   macroSafe: false },
  { id: 'connect-from',     label: 'Connect From Here',  icon: SPEED_PANEL_ICON_GLYPH.connect,    iconId: 'connect',    description: 'Start a connection from this zone',                 category: 'context', contextFilter: (h) => h?.type === 'zone',    macroSafe: false },

  // -- Connection-only --
  { id: 'swap-direction',   label: 'Swap Direction',     icon: SPEED_PANEL_ICON_GLYPH.swap,       iconId: 'swap',       description: 'Reverse this connection’s direction',               category: 'context', contextFilter: (h) => h?.type === 'connection', macroSafe: true },

  { id: 'add-secret-conn', label: 'Draw Secret Connection', icon: SPEED_PANEL_ICON_GLYPH['connect-secret'], iconId: 'connect-secret', description: 'Start a secret connection from this zone', category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: false, modeSuggested: ['dungeon', 'interior'] },
  { id: 'add-channel-conn', label: 'Draw Channel Connection', icon: SPEED_PANEL_ICON_GLYPH['connect-channel'], iconId: 'connect-channel', description: 'Start a channel connection from this zone', category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: false, modeSuggested: ['ocean'] },
  { id: 'add-warp-conn', label: 'Draw Warp Connection', icon: SPEED_PANEL_ICON_GLYPH['connect-warp'], iconId: 'connect-warp', description: 'Start a warp connection from this zone', category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: false, modeSuggested: ['space'] },
  { id: 'add-trail-conn', label: 'Draw Trail Connection', icon: SPEED_PANEL_ICON_GLYPH['connect-trail'], iconId: 'connect-trail', description: 'Start a trail connection from this zone', category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: false, modeSuggested: ['wilderness'] },

  // -- Multi-zone --
  { id: 'merge-zones',      label: 'Merge Zones',           icon: SPEED_PANEL_ICON_GLYPH.merge,      iconId: 'merge',      description: 'Combine this zone with another selected zone',     category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: true },

  // ED-FT-005: single-zone elevation action. Uses native prompt() for speed; the
  // full editor is in ZoneProperties.
  { id: 'set-elevation',    label: 'Set Elevation',         icon: SPEED_PANEL_ICON_GLYPH.elevation,  iconId: 'elevation',  description: 'Set this zone’s elevation',                        category: 'context', contextFilter: (h) => h?.type === 'zone', macroSafe: false },

  // -- Review --
  { id: 'open-review',      label: 'Open Review',           icon: SPEED_PANEL_ICON_GLYPH.review,     iconId: 'review',     description: 'Open the project review panel',                    category: 'global',  contextFilter: (h) => h === null, macroSafe: true },
  { id: 'export-summary',   label: 'Export Summary',        icon: SPEED_PANEL_ICON_GLYPH.summary,    iconId: 'summary',    description: 'Show a summary of the last export',                category: 'global',  contextFilter: (h) => h === null, macroSafe: true },
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
