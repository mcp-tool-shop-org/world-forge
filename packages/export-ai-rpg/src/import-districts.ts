// import-districts.ts — engine DistrictDefinition[] → schema District[]

import type { District } from '@world-forge/schema';
import type { DistrictDefinition } from '@ai-rpg-engine/modules';

export function importDistricts(engineDistricts: DistrictDefinition[]): District[] {
  return engineDistricts.map((ed) => ({
    id: ed.id,
    name: ed.name,
    zoneIds: [...ed.zoneIds],
    tags: [...(ed.tags ?? [])],
    controllingFaction: ed.controllingFaction,
    baseMetrics: {
      commerce: ed.baseMetrics?.commerce ?? 50,
      morale: ed.baseMetrics?.morale ?? 50,
      safety: ed.baseMetrics?.surveillance ?? 50,
      stability: ed.baseMetrics?.stability ?? 50,
    },
    economyProfile: {
      supplyCategories: [],
      scarcityDefaults: {},
    },
  }));
}
