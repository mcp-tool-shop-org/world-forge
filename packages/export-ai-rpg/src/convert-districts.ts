// convert-districts.ts — WorldProject districts → engine DistrictDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { DistrictDefinition } from '@ai-rpg-engine/modules';

/**
 * Convert project districts → engine `DistrictDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 */
export function convertDistricts(project: WorldProject): DistrictDefinition[] {
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
      // but those are runtime values. We map safety → surveillance as a baseline.
      surveillance: d.baseMetrics.safety,
    },
  }));
}
