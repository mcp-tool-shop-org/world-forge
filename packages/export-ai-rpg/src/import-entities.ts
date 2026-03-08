// import-entities.ts — engine EntityBlueprint[] → schema EntityPlacement[]

import type { EntityPlacement, EntityRole } from '@world-forge/schema';
import type { EntityBlueprint } from '@ai-rpg-engine/content-schema';

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
): { placements: EntityPlacement[]; warnings: string[] } {
  const warnings: string[] = [];
  const placements: EntityPlacement[] = [];

  for (let i = 0; i < engineEntities.length; i++) {
    const eb = engineEntities[i];
    const role = reverseRole(eb.type, eb.tags ?? []);

    // Strip role-injected tags and faction:* tags to recover author tags
    let factionId: string | undefined;
    const authorTags: string[] = [];
    for (const tag of eb.tags ?? []) {
      if (tag.startsWith('faction:')) {
        factionId = tag.slice(8);
      } else if (!ROLE_INJECTED_TAGS.has(tag)) {
        authorTags.push(tag);
      }
    }

    // Round-robin zone assignment
    const zoneId = zoneIds.length > 0 ? zoneIds[i % zoneIds.length] : 'unplaced';
    warnings.push(`Entity '${eb.name}' placed in zone '${zoneId}' (original zone unknown)`);

    const placement: EntityPlacement = {
      entityId: eb.id,
      name: eb.name,
      zoneId,
      role,
      tags: authorTags.length > 0 ? authorTags : undefined,
      factionId,
    };

    if (eb.baseStats && typeof eb.baseStats === 'object' && Object.keys(eb.baseStats).length > 0) {
      placement.stats = { ...(eb.baseStats as Record<string, number>) };
    }
    if (eb.baseResources && typeof eb.baseResources === 'object' && Object.keys(eb.baseResources).length > 0) {
      placement.resources = { ...(eb.baseResources as Record<string, number>) };
    }
    const customField = (eb as Record<string, unknown>).custom;
    if (customField && typeof customField === 'object') {
      placement.custom = Object.assign({}, customField) as Record<string, string>;
    }
    if (eb.aiProfile) {
      placement.ai = { profileId: eb.aiProfile };
    }

    placements.push(placement);
  }

  return { placements, warnings };
}
