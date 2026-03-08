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
    const tags = [...ROLE_TAGS[ep.role]];
    if (ep.factionId) tags.push(`faction:${ep.factionId}`);

    return {
      id: ep.entityId,
      type: ROLE_TO_TYPE[ep.role],
      name: ep.entityId, // placeholder — editor should provide display names
      tags,
      aiProfile: ROLE_AI_PROFILE[ep.role],
    };
  });
}
