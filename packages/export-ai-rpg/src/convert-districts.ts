// convert-districts.ts — WorldProject districts → engine DistrictDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { DistrictDefinition } from '@ai-rpg-engine/modules';

/**
 * Convert project districts → engine `DistrictDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 *
 * F-6cd32f2d (swarm wave-2): `safety → surveillance` (below) is NOT a
 * synonym mapping — per this package's own C0 audit table
 * (export-table-data.ts:292), "a heavily-surveilled district is not a safe
 * one; in the engine's own doctrine high surveillance drives heat and
 * pursuit." An author who scores a district `safety: 90` (a low-danger area)
 * gets it exported as `surveillance: 90`, which increases heat/pursuit — the
 * OPPOSITE of the authored intent. This is not confirmed against the
 * engine's actual district-metrics consumer (that verification is outside
 * this package's scope), so rather than silently guessing at a fix (e.g.
 * inverting the value, which could just as easily be wrong), this converter
 * now escalates the approximation from a silent code comment to a reported
 * warning — the same discipline convertPackMeta already applies to its own
 * approximated fields (GENRE_MAP/TONE_MAP/DIFFICULTY_MAP fallbacks). `value`
 * is UNCHANGED; only the reporting channel is new.
 */
export function convertDistricts(project: WorldProject, warnings?: string[]): DistrictDefinition[] {
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
  return project.districts.map((d) => ({
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
  }));
}
