// encounter-types.ts — Browser-safe AI RPG Engine encounter anchor blocker checker.
//
// The canonical browser-safe list (`AI_RPG_ENCOUNTER_ANCHOR_TYPES` and
// `isAiRpgEncounterAnchorType`) lives in `@world-forge/schema`, re-exported
// here for compatibility, and pinned in `__tests__/engine-deps-3x.test.ts` to
// `ENCOUNTER_ANCHOR_TYPES` from `@ai-rpg-engine/content-schema` (whose barrel
// pulls `node:crypto`).

import {
  AI_RPG_ENCOUNTER_ANCHOR_TYPES,
  isAiRpgEncounterAnchorType,
  type AiRpgEncounterAnchorType,
  type WorldProject,
} from '@world-forge/schema';

export { AI_RPG_ENCOUNTER_ANCHOR_TYPES, isAiRpgEncounterAnchorType };
export type { AiRpgEncounterAnchorType };

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
