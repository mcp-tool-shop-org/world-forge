// import-districts.ts — engine DistrictDefinition[] → schema District[]

import type { District } from '@world-forge/schema';
import type { DistrictDefinition } from '@ai-rpg-engine/modules';
import type { FidelityEntry } from './fidelity.js';

export function importDistricts(engineDistricts: DistrictDefinition[]): { districts: District[]; fidelity: FidelityEntry[] } {
  const fidelity: FidelityEntry[] = [];

  const districts = engineDistricts.map((ed) => {
    fidelity.push({
      level: 'approximated', domain: 'districts', severity: 'info',
      entityId: ed.id, fieldPath: 'baseMetrics.safety',
      message: `District '${ed.name}' safety reverse-mapped from surveillance`,
      reason: 'surveillance-to-safety',
    });
    fidelity.push({
      level: 'dropped', domain: 'districts', severity: 'warning',
      entityId: ed.id, fieldPath: 'economyProfile',
      message: `District '${ed.name}' economy profile data lost (defaulted to empty)`,
      reason: 'economy-data-lost',
    });

    return {
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
    };
  });

  return { districts, fidelity };
}
