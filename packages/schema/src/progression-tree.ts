// progression-tree.ts — progression/skill tree for authored worlds
// Matches ai-rpg-engine/content-schema ProgressionTreeDefinition shape.

import type { ScalarValue } from './dialogue.js';

/** What happens when a progression node is unlocked. */
export interface ProgressionEffect {
  type: string;
  target?: 'actor' | 'target' | 'zone';
  params: Record<string, ScalarValue>;
}

/** Single node in a progression tree. */
export interface ProgressionNode {
  id: string;
  name: string;
  description?: string;
  /** Currency cost to unlock this node. */
  cost: number;
  /** Node IDs that must be unlocked before this one. */
  requires?: string[];
  /** Effects applied when unlocked. */
  effects: ProgressionEffect[];
}

/** A complete progression tree (skill tree / ability tree). */
export interface ProgressionTreeDefinition {
  id: string;
  name: string;
  /** Currency used (e.g., "xp", "ability-points", "perks"). */
  currency: string;
  nodes: ProgressionNode[];
}
