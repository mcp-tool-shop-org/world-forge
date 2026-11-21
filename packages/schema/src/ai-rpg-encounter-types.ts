// ai-rpg-encounter-types.ts — Browser-safe AI RPG Engine encounter anchor type allowlist.
//
// Sourced from `./generated/engine-lists.js` (generated from installed
// `@ai-rpg-engine/content-schema`, which imports `node:crypto` via its barrel
// and therefore cannot be imported directly by browser-safe packages).

import { ENCOUNTER_ANCHOR_TYPES } from './generated/engine-lists.js';

/** Encounter anchor types accepted at runtime by AI RPG Engine. */
export const AI_RPG_ENCOUNTER_ANCHOR_TYPES = ENCOUNTER_ANCHOR_TYPES;

export type AiRpgEncounterAnchorType = (typeof AI_RPG_ENCOUNTER_ANCHOR_TYPES)[number];

const AI_RPG_ENCOUNTER_TYPE_SET = new Set<string>(AI_RPG_ENCOUNTER_ANCHOR_TYPES);

/** Return true iff `value` is one of the encounter types AI RPG Engine loads. */
export function isAiRpgEncounterAnchorType(value: string): value is AiRpgEncounterAnchorType {
  return AI_RPG_ENCOUNTER_TYPE_SET.has(value);
}
