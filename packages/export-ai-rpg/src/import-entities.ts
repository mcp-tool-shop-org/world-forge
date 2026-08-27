// import-entities.ts — engine EntityBlueprint[] → schema EntityPlacement[]

import type { EntityPlacement, EntityRole } from '@world-forge/schema';
import { formatConditionSpec } from '@world-forge/schema';
import type { EntityBlueprint } from '@ai-rpg-engine/content-schema';
import type { FidelityEntry } from './fidelity.js';
import type { ExportedPlacement } from './convert-placements.js';

/** Tags injected by role during export — must be stripped on import to avoid accumulation. */
const ROLE_INJECTED_TAGS: ReadonlySet<string> = new Set([
  'hostile', 'boss', 'elite', 'merchant', 'trader',
  'quest-giver', 'recruitable', 'companion',
]);

/**
 * Reverse-map engine type + tags → author EntityRole.
 * Priority: boss > companion > merchant > quest-giver > npc > enemy
 */
function reverseRole(type: string, tags: string[]): EntityRole {
  const tagSet = new Set(tags);
  if (type === 'enemy' && tagSet.has('boss')) return 'boss';
  if (tagSet.has('companion') || tagSet.has('recruitable')) return 'companion';
  if (tagSet.has('merchant') || tagSet.has('trader')) return 'merchant';
  if (tagSet.has('quest-giver')) return 'quest-giver';
  if (type === 'enemy') return 'enemy';
  return 'npc';
}

export function importEntities(
  engineEntities: EntityBlueprint[],
  zoneIds: string[],
  // F-5a257bc8 (swarm wave-2, headline fix): the C3/P1 export channel
  // `ContentPack.placements[]` carries the REAL authored zoneId (and compiled
  // spawnCondition) for every entity — populated correctly on export
  // (export.ts, convert-placements.ts) but never read here, so every import
  // fell back to round-robin and then claimed "original zones unknown" even
  // when they were sitting right there in the pack. `placements` is OPTIONAL
  // so a legacy/hand-built pack lacking this channel still round-robins
  // exactly as before — that is the only case round-robin is still correct.
  placements?: ExportedPlacement[],
): { placements: EntityPlacement[]; warnings: string[]; fidelity: FidelityEntry[] } {
  const warnings: string[] = [];
  const fidelity: FidelityEntry[] = [];
  const placementResults: EntityPlacement[] = [];
  const placementsById = new Map((placements ?? []).map((p) => [p.entityId, p]));

  // EB-008: Informational fidelity entry when no entities to import
  if (engineEntities.length === 0) {
    fidelity.push({
      level: 'lossless', domain: 'entities', severity: 'info',
      message: 'No entities in content pack — imported world will have no NPCs or encounters.',
      reason: 'no-entities-in-source',
    });
  }

  for (let i = 0; i < engineEntities.length; i++) {
    const eb = engineEntities[i];
    const role = reverseRole(eb.type, eb.tags ?? []);

    // Strip role-injected tags and faction:* / dialogue:* tags to recover author tags
    let factionId: string | undefined;
    let dialogueIdFromTag: string | undefined;
    const authorTags: string[] = [];
    for (const tag of eb.tags ?? []) {
      if (tag.startsWith('faction:')) {
        factionId = tag.slice(8);
      } else if (tag.startsWith('dialogue:')) {
        dialogueIdFromTag = tag.slice(9);
      } else if (!ROLE_INJECTED_TAGS.has(tag)) {
        authorTags.push(tag);
      }
    }

    // Per-entity: use the pack's own placement record when this SPECIFIC
    // entity has one, falling back to round-robin only for entities the
    // record does not cover (an empty/absent `placements` array falls back
    // for every entity, which is the legacy-pack case).
    const placementRecord = placementsById.get(eb.id);
    let zoneId: string;
    if (placementRecord) {
      zoneId = placementRecord.zoneId;
      fidelity.push({
        level: 'lossless', domain: 'entities', severity: 'info',
        entityId: eb.id, fieldPath: 'zoneId',
        message: `Entity '${eb.name}' zone restored from pack placements[] data: '${zoneId}'`,
        reason: 'zone-placement-from-pack',
      });
    } else {
      // Round-robin zone assignment — only warn when zoneIds is empty (a real problem),
      // not for every entity placement (EB-004: reduce warning noise)
      zoneId = zoneIds.length > 0 ? zoneIds[i % zoneIds.length] : 'unplaced';
      if (zoneIds.length === 0) {
        warnings.push(`Entity '${eb.name}' has no zones available for placement — assigned to 'unplaced'. Import zones first or create at least one zone.`);
      }
      fidelity.push({
        level: 'approximated', domain: 'entities', severity: 'warning',
        entityId: eb.id, fieldPath: 'zoneId',
        message: `Entity '${eb.name}' zone round-robin assigned to '${zoneId}' (no placement data available for this entity)`,
        reason: 'zone-placement-round-robin',
      });
    }

    fidelity.push({
      level: 'approximated', domain: 'entities', severity: 'info',
      entityId: eb.id, fieldPath: 'role',
      message: `Entity '${eb.name}' role '${role}' reverse-mapped from type '${eb.type}'`,
      reason: 'role-reverse-mapped',
    });

    const dialogueId = placementRecord?.dialogueId || dialogueIdFromTag;
    const placement: EntityPlacement = {
      entityId: eb.id,
      name: eb.name,
      zoneId,
      role,
      tags: authorTags.length > 0 ? authorTags : undefined,
      factionId,
    };
    if (dialogueId) placement.dialogueId = dialogueId;

    // Decompile the placement's compiled spawnCondition back into
    // SpawnCondition-grammar, the same codec `import-zones.ts` uses for exits
    // and entry gates. A spec the grammar cannot express is dropped with a
    // fidelity entry rather than passed through malformed.
    if (placementRecord?.spawnCondition) {
      const decompiled = formatConditionSpec(placementRecord.spawnCondition);
      if (decompiled !== null) {
        placement.spawnCondition = decompiled;
      } else {
        const label = eb.name || eb.id;
        fidelity.push({
          level: 'approximated', domain: 'entities', severity: 'warning',
          entityId: eb.id, fieldPath: 'spawnCondition',
          message: `Entity '${label}' placements[] spawnCondition (type '${String(placementRecord.spawnCondition.type)}') could not be decompiled back into SpawnCondition grammar — dropped on import.`,
          reason: 'spawn-condition-not-expressible-in-grammar',
        });
      }
    }

    if (eb.baseStats && typeof eb.baseStats === 'object' && Object.keys(eb.baseStats).length > 0) {
      placement.stats = { ...(eb.baseStats as Record<string, number>) };
    }
    if (eb.baseResources && typeof eb.baseResources === 'object' && Object.keys(eb.baseResources).length > 0) {
      placement.resources = { ...(eb.baseResources as Record<string, number>) };
    }
    const customField = (eb as Record<string, unknown>).custom;
    if (customField && typeof customField === 'object' && !Array.isArray(customField)) {
      const validated: Record<string, string> = {};
      for (const [k, v] of Object.entries(customField as Record<string, unknown>)) {
        validated[k] = typeof v === 'string' ? v : String(v);
      }
      placement.custom = validated;
    }
    if (eb.aiProfile) {
      placement.ai = { profileId: eb.aiProfile };
    }

    placementResults.push(placement);
  }

  return { placements: placementResults, warnings, fidelity };
}
