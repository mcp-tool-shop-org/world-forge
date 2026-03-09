// import-build-catalog.ts — engine ExportedBuildCatalog → schema BuildCatalogDefinition

import type { BuildCatalogDefinition } from '@world-forge/schema';
import type { ExportedBuildCatalog } from './convert-build-catalog.js';
import type { FidelityEntry } from './fidelity.js';

export function importBuildCatalog(
  exported: ExportedBuildCatalog | undefined,
): { catalog: BuildCatalogDefinition | undefined; fidelity: FidelityEntry[] } {
  const fidelity: FidelityEntry[] = [];
  if (!exported) return { catalog: undefined, fidelity };

  if ((exported as Record<string, unknown>).packId) {
    fidelity.push({
      level: 'dropped', domain: 'builds', severity: 'info',
      fieldPath: 'packId',
      message: 'Build catalog packId stripped (editor-only field)',
      reason: 'pack-id-stripped',
    });
  }

  return {
    catalog: {
      statBudget: exported.statBudget,
      maxTraits: exported.maxTraits,
      requiredFlaws: exported.requiredFlaws,
      archetypes: exported.archetypes.map((a) => ({ ...a, statPriorities: { ...a.statPriorities }, startingTags: [...a.startingTags] })),
      backgrounds: exported.backgrounds.map((b) => ({ ...b, statModifiers: { ...b.statModifiers }, startingTags: [...b.startingTags] })),
      traits: exported.traits.map((t) => ({ ...t, effects: t.effects.map((e) => ({ ...e })) })),
      disciplines: exported.disciplines.map((d) => ({ ...d, passive: { ...d.passive }, drawback: { ...d.drawback } })),
      crossTitles: exported.crossTitles.map((ct) => ({ ...ct, tags: [...ct.tags] })),
      entanglements: exported.entanglements.map((e) => ({ ...e, effects: e.effects.map((ef) => ({ ...ef })) })),
    },
    fidelity,
  };
}
