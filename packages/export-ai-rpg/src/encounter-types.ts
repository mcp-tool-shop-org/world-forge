// encounter-types.ts — Browser-safe AI RPG Engine encounter anchor translation & validation.
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
  type EncounterAnchor,
  type WorldProject,
} from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export { AI_RPG_ENCOUNTER_ANCHOR_TYPES, isAiRpgEncounterAnchorType };
export type { AiRpgEncounterAnchorType };

/** World Forge encounter types translated to one of the four engine anchor types on AI RPG export. */
export const AI_RPG_ENCOUNTER_TYPE_MAP: Readonly<Record<string, AiRpgEncounterAnchorType>> = {
  boss: 'duel',
  beast: 'ambush',
  haunt: 'ambush',
  'caravan-raid': 'ambush',
  pirate: 'patrol',
  boarding: 'horde',
  brawl: 'horde',
};

/** World Forge encounter types intentionally omitted from exported AI RPG ContentPacks. */
export const AI_RPG_DROPPED_ENCOUNTER_TYPES: ReadonlySet<string> = new Set([
  'hazard',
  'discovery',
]);

export interface AiRpgEncounterBlocker {
  anchorId: string;
  zoneId: string;
  encounterType: string;
  validTypes: readonly AiRpgEncounterAnchorType[];
  message: string;
}

export interface AiRpgEncounterAdjustment {
  anchorId: string;
  zoneId: string;
  encounterType: string;
  level: 'approximated' | 'dropped';
  targetType?: AiRpgEncounterAnchorType;
  reason: 'encounter-type-translated' | 'encounter-type-dropped';
  message: string;
}

type AnchorClassification =
  | { kind: 'native'; anchorId: string; zoneId: string; encounterType: AiRpgEncounterAnchorType }
  | { kind: 'mapped'; anchorId: string; zoneId: string; encounterType: string; targetType: AiRpgEncounterAnchorType }
  | { kind: 'dropped'; anchorId: string; zoneId: string; encounterType: string }
  | { kind: 'blocked'; anchorId: string; zoneId: string; encounterType: string };

function classifyAnchor(ea: EncounterAnchor | null | undefined): AnchorClassification {
  const anchorId = ea?.id ?? '(unknown)';
  const zoneId = ea?.zoneId ?? '';
  const rawType = typeof ea?.encounterType === 'string' ? ea.encounterType : String(ea?.encounterType ?? '');
  if (!ea || typeof ea.encounterType !== 'string') {
    return { kind: 'blocked', anchorId, zoneId, encounterType: rawType };
  }
  if (isAiRpgEncounterAnchorType(rawType)) {
    return { kind: 'native', anchorId, zoneId, encounterType: rawType };
  }
  const mapped = AI_RPG_ENCOUNTER_TYPE_MAP[rawType];
  if (mapped) {
    return { kind: 'mapped', anchorId, zoneId, encounterType: rawType, targetType: mapped };
  }
  if (AI_RPG_DROPPED_ENCOUNTER_TYPES.has(rawType)) {
    return { kind: 'dropped', anchorId, zoneId, encounterType: rawType };
  }
  return { kind: 'blocked', anchorId, zoneId, encounterType: rawType };
}

function buildAdjustment(c: Extract<AnchorClassification, { kind: 'mapped' | 'dropped' }>): AiRpgEncounterAdjustment {
  if (c.kind === 'mapped') {
    return {
      anchorId: c.anchorId,
      zoneId: c.zoneId,
      encounterType: c.encounterType,
      level: 'approximated',
      targetType: c.targetType,
      reason: 'encounter-type-translated',
      message: `Encounter anchor "${c.anchorId}" translates "${c.encounterType}" to "${c.targetType}" (tagged worldforge-type:${c.encounterType}).`,
    };
  }
  return {
    anchorId: c.anchorId,
    zoneId: c.zoneId,
    encounterType: c.encounterType,
    level: 'dropped',
    reason: 'encounter-type-dropped',
    message: `Encounter anchor "${c.anchorId}" has type "${c.encounterType}" — left out of the AI RPG pack.`,
  };
}

/**
 * List encounter anchors whose `encounterType` is translated or dropped on AI RPG export.
 */
export function listAiRpgEncounterAdjustments(
  project: Pick<WorldProject, 'encounterAnchors'>,
): AiRpgEncounterAdjustment[] {
  const anchors = Array.isArray(project.encounterAnchors) ? project.encounterAnchors : [];
  const adjustments: AiRpgEncounterAdjustment[] = [];
  for (const ea of anchors) {
    const c = classifyAnchor(ea);
    if (c.kind === 'mapped' || c.kind === 'dropped') {
      adjustments.push(buildAdjustment(c));
    }
  }
  return adjustments;
}

/**
 * List encounter anchors whose `encounterType` is neither one of the engine's four
 * native types nor a recognized translated/dropped World Forge encounter type.
 */
export function listAiRpgEncounterBlockers(
  project: Pick<WorldProject, 'encounterAnchors'>,
): AiRpgEncounterBlocker[] {
  const anchors = Array.isArray(project.encounterAnchors) ? project.encounterAnchors : [];
  const validLabel = AI_RPG_ENCOUNTER_ANCHOR_TYPES.join(', ');
  const blockers: AiRpgEncounterBlocker[] = [];
  for (const ea of anchors) {
    const c = classifyAnchor(ea);
    if (c.kind === 'blocked') {
      blockers.push({
        anchorId: c.anchorId,
        zoneId: c.zoneId,
        encounterType: c.encounterType,
        validTypes: AI_RPG_ENCOUNTER_ANCHOR_TYPES,
        message: `Encounter anchor "${c.anchorId}" has encounterType "${c.encounterType}" — not loadable by AI RPG Engine (valid types: ${validLabel}).`,
      });
    }
  }
  return blockers;
}

/**
 * Convert project encounter anchors for the AI RPG ContentPack:
 * - native 4 pass through unchanged
 * - mapped types rewrite `encounterType`, add `worldforge-type:<original>` tag, and record `approximated` fidelity
 * - `hazard` and `discovery` are omitted and record `dropped` fidelity
 */
export function convertEncounterAnchors(
  project: WorldProject,
  _warnings?: string[],
  fidelity?: FidelityEntry[],
): EncounterAnchor[] {
  const out: EncounterAnchor[] = [];
  for (const ea of project.encounterAnchors) {
    const c = classifyAnchor(ea);
    if (c.kind === 'mapped') {
      const adj = buildAdjustment(c);
      const originTag = `worldforge-type:${c.encounterType}`;
      const tags = ea.tags.includes(originTag) ? [...ea.tags] : [...ea.tags, originTag];
      out.push({
        ...ea,
        encounterType: c.targetType,
        enemyIds: [...ea.enemyIds],
        tags,
      });
      fidelity?.push({
        domain: 'world',
        level: 'approximated',
        severity: 'warning',
        entityId: ea.id,
        fieldPath: `encounterAnchors.${ea.id}.encounterType`,
        message: adj.message,
        reason: adj.reason,
      });
      continue;
    }
    if (c.kind === 'dropped') {
      const adj = buildAdjustment(c);
      fidelity?.push({
        domain: 'world',
        level: 'dropped',
        severity: 'warning',
        entityId: ea.id,
        fieldPath: `encounterAnchors.${ea.id}.encounterType`,
        message: adj.message,
        reason: adj.reason,
      });
      continue;
    }
    out.push({
      ...ea,
      enemyIds: [...ea.enemyIds],
      tags: [...ea.tags],
    });
  }
  return out;
}
