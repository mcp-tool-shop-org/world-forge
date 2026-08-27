// convert-districts.ts — WorldProject districts → engine DistrictDefinition[]
//
// F-229409a8: convertDistricts mapped id/name/zoneIds/tags/controllingFaction/
// baseMetrics and dropped District.economyProfile. Authored supply/scarcity
// never seeded economy-core; runtime economy was genre/tag-seeded instead.

import type { WorldProject } from '@world-forge/schema';
import type { DistrictDefinition, SupplyCategory } from '@ai-rpg-engine/modules';
import type { FidelityEntry } from './fidelity.js';

/** The eight engine SupplyCategory values economy-core actually keys on. */
export const ENGINE_SUPPLY_CATEGORIES: readonly SupplyCategory[] = [
  'medicine', 'weapons', 'ammunition', 'food', 'fuel', 'luxuries', 'components', 'contraband',
];

const ENGINE_SUPPLY_SET = new Set<string>(ENGINE_SUPPLY_CATEGORIES);

/**
 * Authored economy plus the engine baseline mapping.
 *
 * `supplyCategories` / `scarcityDefaults` copy the schema shape so import can
 * restore it losslessly. `baseline` is the engine-facing projection onto the
 * eight SupplyCategory keys (DistrictEconomy.baseline).
 */
export interface ExportedDistrictEconomy {
  supplyCategories: string[];
  scarcityDefaults: Record<string, number>;
  baseline: Partial<Record<SupplyCategory, number>>;
}

/** Engine DistrictDefinition plus the unpublished economyProfile channel. */
export type ExportedDistrict = DistrictDefinition & {
  economyProfile?: ExportedDistrictEconomy;
};

function isSupplyCategory(value: string): value is SupplyCategory {
  return ENGINE_SUPPLY_SET.has(value);
}

/**
 * Convert project districts → engine `DistrictDefinition[]` plus economyProfile.
 *
 * **Precondition:** `validateProject(project).valid === true`.
 *
 * F-6cd32f2d: `safety → surveillance` is a known-unverified approximation,
 * reported via `warnings`. F-229409a8: unrecognized supply/scarcity category
 * strings warn; recognized scarcityDefaults keys land on `baseline`.
 */
export function convertDistricts(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ExportedDistrict[] {
  if (warnings && project.districts.length > 0) {
    warnings.push(
      `${project.districts.length} district(s) map authored 'safety' directly onto the engine's ` +
        `'surveillance' metric (convert-districts.ts) — these are NOT synonyms: a heavily-surveilled ` +
        `district is not a safe one, and high surveillance drives heat/pursuit in the engine's own ` +
        `doctrine, which is the OPPOSITE of what a high 'safety' score is meant to convey. This mapping ` +
        `is unverified against the engine's actual district-metrics consumer; treat exported ` +
        `'surveillance' values with caution until confirmed.`,
    );
  }
  return project.districts.map((d) => {
    const supplyCategories = [...(d.economyProfile?.supplyCategories ?? [])];
    const scarcityDefaults = { ...(d.economyProfile?.scarcityDefaults ?? {}) };
    const baseline: Partial<Record<SupplyCategory, number>> = {};
    const unknownSupply: string[] = [];
    const unknownScarcity: string[] = [];

    for (const cat of supplyCategories) {
      if (!isSupplyCategory(cat)) unknownSupply.push(cat);
    }
    for (const [cat, value] of Object.entries(scarcityDefaults)) {
      if (isSupplyCategory(cat)) {
        baseline[cat] = value;
      } else {
        unknownScarcity.push(cat);
      }
    }

    if (unknownSupply.length > 0) {
      const msg =
        `District '${d.id}' (${d.name}) has supplyCategories not in the engine SupplyCategory set ` +
        `(${ENGINE_SUPPLY_CATEGORIES.join(', ')}): ${unknownSupply.map((c) => `'${c}'`).join(', ')} — ` +
        `copied onto economyProfile.supplyCategories for round-trip but omitted from DistrictEconomy.baseline.`;
      warnings?.push(msg);
      fidelity?.push({
        domain: 'districts',
        level: 'approximated',
        severity: 'warning',
        entityId: d.id,
        fieldPath: 'economyProfile.supplyCategories',
        message: msg,
        reason: 'economy-supply-category-unrecognized',
      });
    }
    if (unknownScarcity.length > 0) {
      const msg =
        `District '${d.id}' (${d.name}) has scarcityDefaults keys not in the engine SupplyCategory set: ` +
        `${unknownScarcity.map((c) => `'${c}'`).join(', ')} — copied onto economyProfile.scarcityDefaults ` +
        `for round-trip but omitted from DistrictEconomy.baseline.`;
      warnings?.push(msg);
      fidelity?.push({
        domain: 'districts',
        level: 'approximated',
        severity: 'warning',
        entityId: d.id,
        fieldPath: 'economyProfile.scarcityDefaults',
        message: msg,
        reason: 'economy-scarcity-category-unrecognized',
      });
    }

    return {
      id: d.id,
      name: d.name,
      zoneIds: d.zoneIds,
      tags: d.tags,
      controllingFaction: d.controllingFaction,
      baseMetrics: {
        commerce: d.baseMetrics.commerce,
        morale: d.baseMetrics.morale,
        stability: d.baseMetrics.stability,
        // Engine uses alertPressure/rumorDensity/intruderLikelihood/surveillance too,
        // but those are runtime values. We map safety → surveillance as a baseline —
        // see the function docstring above; this is a KNOWN-UNVERIFIED approximation,
        // now reported via `warnings` rather than silent.
        surveillance: d.baseMetrics.safety,
      },
      economyProfile: {
        supplyCategories,
        scarcityDefaults,
        baseline,
      },
    };
  });
}
