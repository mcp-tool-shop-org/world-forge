// import-build-catalog.ts — engine ExportedBuildCatalog → schema BuildCatalogDefinition

import type { BuildCatalogDefinition } from '@world-forge/schema';
import type { ExportedBuildCatalog } from './convert-build-catalog.js';

export function importBuildCatalog(
  exported: ExportedBuildCatalog | undefined,
): BuildCatalogDefinition | undefined {
  if (!exported) return undefined;

  return {
    statBudget: exported.statBudget,
    maxTraits: exported.maxTraits,
    requiredFlaws: exported.requiredFlaws,
    archetypes: exported.archetypes.map((a) => ({ ...a, statPriorities: { ...a.statPriorities }, startingTags: [...a.startingTags] })),
    backgrounds: exported.backgrounds.map((b) => ({ ...b, statModifiers: { ...b.statModifiers }, startingTags: [...b.startingTags] })),
    traits: exported.traits.map((t) => ({ ...t, effects: t.effects.map((e) => ({ ...e })) })),
    disciplines: exported.disciplines.map((d) => ({ ...d, passive: { ...d.passive }, drawback: { ...d.drawback } })),
    crossTitles: exported.crossTitles.map((ct) => ({ ...ct, tags: [...ct.tags] })),
    entanglements: exported.entanglements.map((e) => ({ ...e, effects: e.effects.map((ef) => ({ ...ef })) })),
  };
}
