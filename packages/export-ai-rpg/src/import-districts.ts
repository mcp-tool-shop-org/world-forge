// import-districts.ts — engine DistrictDefinition[] → schema District[]

import type { District } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import type { ExportedDistrict, ExportedDistrictEconomy } from './convert-districts.js';

export function importDistricts(engineDistricts: ExportedDistrict[]): { districts: District[]; fidelity: FidelityEntry[] } {
  const fidelity: FidelityEntry[] = [];

  // F-1d5f2ce5: a hand-authored pack may omit `districts` entirely
  // (detectImportFormat only requires entities+zones), so treat missing/non-array
  // as empty rather than throwing on `.map`.
  if (!Array.isArray(engineDistricts) || engineDistricts.length === 0) {
    return { districts: [], fidelity };
  }

  const districts = engineDistricts.map((ed) => {
    fidelity.push({
      level: 'approximated', domain: 'districts', severity: 'info',
      entityId: ed.id, fieldPath: 'baseMetrics.safety',
      message: `District '${ed.name}' safety reverse-mapped from surveillance`,
      reason: 'surveillance-to-safety',
    });

    const economy = restoreEconomy(ed.economyProfile);
    if (economy.fromPack) {
      fidelity.push({
        level: 'lossless', domain: 'districts', severity: 'info',
        entityId: ed.id, fieldPath: 'economyProfile',
        message: `District '${ed.name}' economy profile restored from pack`,
        reason: 'economy-from-pack',
      });
    } else {
      fidelity.push({
        level: 'dropped', domain: 'districts', severity: 'warning',
        entityId: ed.id, fieldPath: 'economyProfile',
        message: `District '${ed.name}' economy profile data lost (defaulted to empty)`,
        reason: 'economy-data-lost',
      });
    }

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
      economyProfile: economy.profile,
    };
  });

  return { districts, fidelity };
}

function restoreEconomy(
  exported: ExportedDistrictEconomy | undefined,
): { profile: District['economyProfile']; fromPack: boolean } {
  if (!exported || typeof exported !== 'object') {
    return { profile: { supplyCategories: [], scarcityDefaults: {} }, fromPack: false };
  }
  const supplyCategories = Array.isArray(exported.supplyCategories)
    ? [...exported.supplyCategories]
    : [];
  let scarcityDefaults: Record<string, number> = {};
  if (exported.scarcityDefaults && typeof exported.scarcityDefaults === 'object') {
    scarcityDefaults = { ...exported.scarcityDefaults };
  } else if (exported.baseline && typeof exported.baseline === 'object') {
    for (const [k, v] of Object.entries(exported.baseline)) {
      if (typeof v === 'number') scarcityDefaults[k] = v;
    }
  }
  return { profile: { supplyCategories, scarcityDefaults }, fromPack: true };
}
