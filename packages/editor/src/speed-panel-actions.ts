// speed-panel-actions.ts — action registry for the Speed Panel command palette

import type { HitResult } from './hit-testing.js';

export interface SpeedPanelAction {
  id: string;
  label: string;
  icon: string;
  category: 'context' | 'global';
  /** Return true if this action should appear for the given hit context */
  contextFilter: (hit: HitResult | null) => boolean;
}

const hasDuplicate = (h: HitResult | null) =>
  h?.type === 'zone' || h?.type === 'entity' || h?.type === 'landmark';

export const SPEED_PANEL_ACTIONS: SpeedPanelAction[] = [
  // -- Global (empty canvas) --
  { id: 'new-zone',        label: 'New Zone',           icon: '+',  category: 'global',  contextFilter: (h) => h === null },
  { id: 'fit-content',     label: 'Fit to Content',     icon: '[]', category: 'global',  contextFilter: (h) => h === null },

  // -- Any object --
  { id: 'edit-props',      label: 'Edit Properties',    icon: 'E',  category: 'context', contextFilter: (h) => h !== null },
  { id: 'delete',          label: 'Delete',             icon: 'X',  category: 'context', contextFilter: (h) => h !== null },
  { id: 'duplicate',       label: 'Duplicate',          icon: 'D',  category: 'context', contextFilter: hasDuplicate },

  // -- Zone-only --
  { id: 'assign-district',  label: 'Assign District',    icon: 'Dsc', category: 'context', contextFilter: (h) => h?.type === 'zone' },
  { id: 'place-entity',     label: 'Place Entity Here',  icon: 'Ent', category: 'context', contextFilter: (h) => h?.type === 'zone' },
  { id: 'connect-from',     label: 'Connect From Here',  icon: '->', category: 'context', contextFilter: (h) => h?.type === 'zone' },

  // -- Connection-only --
  { id: 'swap-direction',   label: 'Swap Direction',     icon: '<>', category: 'context', contextFilter: (h) => h?.type === 'connection' },
];

/**
 * Filter actions by context hit and search query, splitting into pinned vs contextual.
 */
export function filterActions(
  actions: readonly SpeedPanelAction[],
  context: HitResult | null,
  query: string,
  pinnedIds: ReadonlySet<string>,
): { pinned: SpeedPanelAction[]; contextual: SpeedPanelAction[] } {
  const matching = actions.filter((a) => a.contextFilter(context));
  const q = query.trim().toLowerCase();
  const filtered = q ? matching.filter((a) => a.label.toLowerCase().includes(q)) : matching;

  const pinned: SpeedPanelAction[] = [];
  const contextual: SpeedPanelAction[] = [];
  for (const a of filtered) {
    (pinnedIds.has(a.id) ? pinned : contextual).push(a);
  }
  return { pinned, contextual };
}
