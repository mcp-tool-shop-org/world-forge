// convert-entities.ts — WorldProject entity placements → engine EntityBlueprint[]

import type { WorldProject, EntityRole } from '@world-forge/schema';
import type { EntityBlueprint } from '@ai-rpg-engine/content-schema';

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

export function convertEntities(project: WorldProject): EntityBlueprint[] {
  return project.entityPlacements.map((ep) => {
    // Merge role-based tags with author-provided tags
    const tags = [...ROLE_TAGS[ep.role]];
    if (ep.tags) {
      for (const t of ep.tags) {
        if (!tags.includes(t)) tags.push(t);
      }
    }
    if (ep.factionId) tags.push(`faction:${ep.factionId}`);

    const blueprint: EntityBlueprint = {
      id: ep.entityId,
      type: ROLE_TO_TYPE[ep.role],
      name: ep.name || ep.entityId,
      tags,
      aiProfile: ep.ai?.profileId || ROLE_AI_PROFILE[ep.role],
    };

    // Pass through stats if authored
    if (ep.stats && Object.keys(ep.stats).length > 0) {
      blueprint.baseStats = { ...ep.stats } as Record<string, number>;
    }

    // Pass through resources if authored
    if (ep.resources && Object.keys(ep.resources).length > 0) {
      blueprint.baseResources = { ...ep.resources } as Record<string, number>;
    }

    // Pass through custom fields
    if (ep.custom && Object.keys(ep.custom).length > 0) {
      (blueprint as Record<string, unknown>).custom = { ...ep.custom };
    }

    return blueprint;
  });
}
