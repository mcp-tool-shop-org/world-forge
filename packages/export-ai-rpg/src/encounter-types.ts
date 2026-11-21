// encounter-types.ts — Browser-safe AI RPG Engine encounter anchor type allowlist and blocker checker.
//
// Why this list lives here rather than importing ENCOUNTER_ANCHOR_TYPES from
// `@ai-rpg-engine/content-schema`: the content-schema barrel re-exports
// `gate.ts`, which imports `node:crypto` at module load, and `@world-forge/editor`
// bundles `@world-forge/export-ai-rpg` for the browser.
// A Node test (`__tests__/engine-deps-3x.test.ts`) pins this list to
// `ENCOUNTER_ANCHOR_TYPES` from `@ai-rpg-engine/content-schema`.

import type { WorldProject } from '@world-forge/schema';

// A type joins the ai-rpg list only when the engine carries it: engine first, then this mirror, in the same cycle.
export const AI_RPG_ENCOUNTER_ANCHOR_TYPES = ['ambush', 'patrol', 'horde', 'duel'] as const;

export type AiRpgEncounterAnchorType = (typeof AI_RPG_ENCOUNTER_ANCHOR_TYPES)[number];

const AI_RPG_ENCOUNTER_TYPE_SET = new Set<string>(AI_RPG_ENCOUNTER_ANCHOR_TYPES);

/** Return true iff `value` is one of the four encounter types AI RPG Engine loads. */
export function isAiRpgEncounterAnchorType(value: string): value is AiRpgEncounterAnchorType {
  return AI_RPG_ENCOUNTER_TYPE_SET.has(value);
}

export interface AiRpgEncounterBlocker {
  anchorId: string;
  zoneId: string;
  encounterType: string;
  validTypes: readonly AiRpgEncounterAnchorType[];
  message: string;
}

/**
 * List encounter anchors whose `encounterType` is not loadable by AI RPG Engine
 * (`ambush`, `patrol`, `horde`, or `duel`). Does not map or rewrite any type.
 */
export function listAiRpgEncounterBlockers(
  project: Pick<WorldProject, 'encounterAnchors'>,
): AiRpgEncounterBlocker[] {
  const anchors = Array.isArray(project.encounterAnchors) ? project.encounterAnchors : [];
  const validLabel = AI_RPG_ENCOUNTER_ANCHOR_TYPES.join(', ');
  const blockers: AiRpgEncounterBlocker[] = [];
  for (const ea of anchors) {
    if (!ea || typeof ea.encounterType !== 'string' || !isAiRpgEncounterAnchorType(ea.encounterType)) {
      const anchorId = ea?.id ?? '(unknown)';
      const rawType = typeof ea?.encounterType === 'string' ? ea.encounterType : String(ea?.encounterType ?? '');
      blockers.push({
        anchorId,
        zoneId: ea?.zoneId ?? '',
        encounterType: rawType,
        validTypes: AI_RPG_ENCOUNTER_ANCHOR_TYPES,
        message: `Encounter anchor "${anchorId}" has encounterType "${rawType}" — not loadable by AI RPG Engine (valid types: ${validLabel}).`,
      });
    }
  }
  return blockers;
}
