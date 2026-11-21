// ai-rpg-encounter-types.ts — Browser-safe AI RPG Engine encounter anchor type allowlist.
//
// Pinned in `@world-forge/export-ai-rpg` (`__tests__/engine-deps-3x.test.ts`)
// to `ENCOUNTER_ANCHOR_TYPES` from `@ai-rpg-engine/content-schema`, which
// imports `node:crypto` via its barrel and therefore cannot be imported by
// browser-safe `@world-forge/schema` or `@world-forge/editor`.

/** Encounter anchor types accepted at runtime by AI RPG Engine. */
// A type joins this list only when the engine carries it: engine first, then this mirror, in the same cycle.
export const AI_RPG_ENCOUNTER_ANCHOR_TYPES = ['ambush', 'patrol', 'horde', 'duel'] as const;

export type AiRpgEncounterAnchorType = (typeof AI_RPG_ENCOUNTER_ANCHOR_TYPES)[number];

const AI_RPG_ENCOUNTER_TYPE_SET = new Set<string>(AI_RPG_ENCOUNTER_ANCHOR_TYPES);

/** Return true iff `value` is one of the encounter types AI RPG Engine loads. */
export function isAiRpgEncounterAnchorType(value: string): value is AiRpgEncounterAnchorType {
  return AI_RPG_ENCOUNTER_TYPE_SET.has(value);
}
