// convert-entities.ts — WorldProject entity placements → engine EntityBlueprint[]

import type { WorldProject, EntityRole } from '@world-forge/schema';
import type { EntityBlueprint } from '@ai-rpg-engine/content-schema';
import type { FidelityEntry } from './fidelity.js';
import { safeLookup } from './safe-lookup.js';

const ROLE_TO_TYPE: Record<EntityRole, string> = {
  'npc': 'npc',
  'enemy': 'enemy',
  'merchant': 'npc',
  'quest-giver': 'npc',
  'companion': 'npc',
  'boss': 'enemy',
};

const ROLE_TAGS: Record<EntityRole, string[]> = {
  'npc': [],
  'enemy': ['hostile'],
  'merchant': ['merchant', 'trader'],
  'quest-giver': ['quest-giver'],
  'companion': ['recruitable', 'companion'],
  'boss': ['hostile', 'boss', 'elite'],
};

const ROLE_AI_PROFILE: Record<EntityRole, string> = {
  'npc': 'passive',
  'enemy': 'aggressive',
  'merchant': 'passive',
  'quest-giver': 'passive',
  'companion': 'follower',
  'boss': 'territorial',
};

/**
 * Convert project entity placements → engine `EntityBlueprint[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 *
 * **AIR-B-004 / F-cd05e76f:** Pass a `fidelity` array to collect structured
 * entries when a `custom` field value cannot be JSON-serialized (e.g. circular
 * reference). The same loss is pushed onto `warnings` so the CLI `Warnings:`
 * block (and `Fidelity:` dump) can print it — `console.warn` alone is not a
 * diagnostic channel when the consumer is not a TTY. The console.warn is still
 * emitted for legacy consumers.
 */
export function convertEntities(
  project: WorldProject,
  fidelity?: FidelityEntry[],
  warnings?: string[],
): EntityBlueprint[] {
  // AIR-B-003: Collect known faction ids so we can flag dangling references.
  // Factions in WorldProject are identified by `factionPresences[].factionId`.
  const knownFactionIds = new Set(project.factionPresences.map((fp) => fp.factionId));
  const knownDialogueIds = new Set(project.dialogues.map((d) => d.id));

  return project.entityPlacements.map((ep) => {
    // ep.role is typed as the closed EntityRole union, but at runtime it is
    // UNVALIDATED authored input — zero validation rules for `role` in
    // packages/schema/src/validate.ts, so a foreign or hand-edited project can
    // carry any string. A raw `ROLE_TAGS[ep.role]` bracket-lookup on an
    // unrecognized key returns `undefined`, and `[...undefined]` throws a
    // TypeError — crashing the whole export on one bad entity. A
    // prototype-name key ('__proto__', 'constructor', ...) is the same root
    // cause as GENRE_MAP/TONE_MAP/DIFFICULTY_MAP in convert-pack.ts: it
    // resolves to an INHERITED member instead of missing. `safeLookup` closes
    // both failure modes at once (F-3dab95a4 / swarm wave-2).
    const roleTags = safeLookup(ROLE_TAGS, ep.role);
    const roleType = safeLookup(ROLE_TO_TYPE, ep.role);
    const roleAiProfile = safeLookup(ROLE_AI_PROFILE, ep.role);
    if (roleTags === undefined) {
      const entityLabel = ep.name || ep.entityId;
      const msg = `Entity "${ep.entityId}" (${entityLabel}) has an unrecognized role "${String(ep.role)}" — falling back to 'npc'-shaped defaults (type 'npc', no role-derived tags, aiProfile 'passive'). Valid roles: ${Object.keys(ROLE_TO_TYPE).join(', ')}.`;
      console.warn(`[convert-entities] ${msg}`);
      warnings?.push(msg);
      fidelity?.push({
        domain: 'entities',
        level: 'approximated',
        severity: 'warning',
        entityId: ep.entityId,
        fieldPath: 'role',
        message: msg,
        reason: 'unrecognized-role-fallback',
      });
    }

    // Merge role-based tags with author-provided tags
    const tags = [...(roleTags ?? [])];
    if (ep.tags) {
      for (const t of ep.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (ep.factionId) {
      if (warnings && !knownFactionIds.has(ep.factionId)) {
        const entityLabel = ep.name || ep.entityId;
        warnings.push(
          `Entity "${ep.entityId}" (${entityLabel}) references factionId "${ep.factionId}" which is not declared in factionPresences — tagged as faction:UNKNOWN so downstream behavior stays safe. Either add a factionPresence for "${ep.factionId}" or clear this entity's factionId.`,
        );
        tags.push(`faction:UNKNOWN`);
      } else {
        tags.push(`faction:${ep.factionId}`);
      }
    }

    // F-c2cdc36d: EntityBlueprint has no dialogue field, so the binding is
    // encoded as a `dialogue:<id>` tag (same pattern as factionId) AND carried
    // on ExportedPlacement.dialogueId. Warn when the id does not resolve.
    if (ep.dialogueId) {
      tags.push(`dialogue:${ep.dialogueId}`);
      if (!knownDialogueIds.has(ep.dialogueId)) {
        const entityLabel = ep.name || ep.entityId;
        const msg = `Entity "${ep.entityId}" (${entityLabel}) references dialogueId "${ep.dialogueId}" which is not in project.dialogues[] — tagged as dialogue:${ep.dialogueId} anyway so a pack consumer can still start the tree if the dialogue is supplied later.`;
        warnings?.push(msg);
        fidelity?.push({
          domain: 'entities',
          level: 'approximated',
          severity: 'warning',
          entityId: ep.entityId,
          fieldPath: 'dialogueId',
          message: msg,
          reason: 'dialogue-id-unresolved',
        });
      } else {
        fidelity?.push({
          domain: 'entities',
          level: 'lossless',
          severity: 'info',
          entityId: ep.entityId,
          fieldPath: 'dialogueId',
          message: `Entity '${ep.entityId}' dialogueId '${ep.dialogueId}' encoded as tag dialogue:${ep.dialogueId} and on placements[].dialogueId.`,
          reason: 'dialogue-id-as-tag',
        });
      }
    }

    const blueprint: EntityBlueprint = {
      id: ep.entityId,
      type: roleType ?? 'npc',
      name: ep.name || ep.entityId,
      tags,
      aiProfile: ep.ai?.profileId || (roleAiProfile ?? 'passive'),
    };

    // Pass through stats if authored
    if (ep.stats && Object.keys(ep.stats).length > 0) {
      blueprint.baseStats = { ...ep.stats } as Record<string, number>;
    }

    // Pass through resources if authored
    if (ep.resources && Object.keys(ep.resources).length > 0) {
      blueprint.baseResources = { ...ep.resources } as Record<string, number>;
    }

    // Pass through custom fields (validate object type + JSON-serializable values)
    if (ep.custom && typeof ep.custom === 'object' && !Array.isArray(ep.custom) && Object.keys(ep.custom).length > 0) {
      const sanitized: Record<string, string> = {};
      for (const [k, v] of Object.entries(ep.custom)) {
        try {
          JSON.stringify(v);
          sanitized[k] = v;
        } catch {
          const entityLabel = ep.name || ep.entityId;
          const msg = `Entity '${entityLabel}' custom field '${k}' has a non-JSON-serializable value (likely circular reference) and was dropped from the export.`;
          console.warn(`[convert-entities] ${msg}`);
          warnings?.push(msg);
          fidelity?.push({
            domain: 'entities',
            level: 'approximated',
            severity: 'warning',
            entityId: ep.entityId,
            fieldPath: `custom.${k}`,
            message: msg,
            reason: 'custom-field-not-json-serializable',
          });
        }
      }
      if (Object.keys(sanitized).length > 0) {
        (blueprint as Record<string, unknown>).custom = sanitized;
      }
    }

    return blueprint;
  });
}
