// convert-build-catalog.ts — WorldProject build catalog → engine BuildCatalog

import type { WorldProject } from '@world-forge/schema';
import type { BuildCatalogDefinition, TraitEffect } from '@world-forge/schema';

/** Engine-compatible BuildCatalog with packId. */
export type ExportedBuildCatalog = {
  packId: string;
  statBudget: number;
  maxTraits: number;
  requiredFlaws: number;
  archetypes: Array<{
    id: string; name: string; description: string;
    statPriorities: Record<string, number>;
    resourceOverrides?: Record<string, number>;
    startingTags: string[];
    startingInventory?: string[];
    progressionTreeId: string;
    grantedVerbs?: string[];
  }>;
  backgrounds: Array<{
    id: string; name: string; description: string;
    statModifiers: Record<string, number>;
    startingTags: string[];
    startingInventory?: string[];
    factionModifiers?: Record<string, number>;
  }>;
  traits: Array<{
    id: string; name: string; description: string;
    category: 'perk' | 'flaw';
    effects: TraitEffect[];
    incompatibleWith?: string[];
  }>;
  disciplines: Array<{
    id: string; name: string; description: string;
    grantedVerb: string;
    passive: TraitEffect;
    drawback: TraitEffect;
    requiredTags?: string[];
  }>;
  crossTitles: Array<{
    archetypeId: string; disciplineId: string; title: string; tags: string[];
  }>;
  entanglements: Array<{
    id: string; archetypeId: string; disciplineId: string;
    description: string; effects: TraitEffect[];
  }>;
};

export function convertBuildCatalog(project: WorldProject): ExportedBuildCatalog | undefined {
  if (!project.buildCatalog) return undefined;

  const bc = project.buildCatalog;
  return {
    packId: project.id,
    statBudget: bc.statBudget,
    maxTraits: bc.maxTraits,
    requiredFlaws: bc.requiredFlaws,
    archetypes: bc.archetypes.map((a) => ({ ...a })),
    backgrounds: bc.backgrounds.map((b) => ({ ...b })),
    traits: bc.traits.map((t) => ({ ...t })),
    disciplines: bc.disciplines.map((d) => ({ ...d })),
    crossTitles: bc.crossTitles.map((ct) => ({ ...ct })),
    entanglements: bc.entanglements.map((e) => ({ ...e })),
  };
}
