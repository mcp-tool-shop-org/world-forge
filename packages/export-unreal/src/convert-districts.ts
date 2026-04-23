// convert-districts.ts — WorldProject districts → Unreal DistrictDataAsset JSON

import type { WorldProject, District } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export interface UnrealDistrictDataAsset {
  Id: string;
  DisplayName: string;
  ZoneIds: string[];
  Tags: string[];
  ControllingFaction?: string;
  BaseMetrics: {
    Commerce: number;
    Morale: number;
    Safety: number;
    Stability: number;
  };
  EconomyProfile: {
    SupplyCategories: string[];
    ScarcityDefaults: Record<string, number>;
  };
}

export interface ConvertDistrictsResult {
  districts: UnrealDistrictDataAsset[];
  fidelity: FidelityEntry[];
}

export function convertDistricts(project: WorldProject): ConvertDistrictsResult {
  const fidelity: FidelityEntry[] = [];
  const districts = project.districts.map((d) => convertDistrict(d, fidelity));
  return { districts, fidelity };
}

function convertDistrict(d: District, _fidelity: FidelityEntry[]): UnrealDistrictDataAsset {
  return {
    Id: d.id,
    DisplayName: d.name,
    ZoneIds: d.zoneIds.slice(),
    Tags: d.tags.slice(),
    ControllingFaction: d.controllingFaction,
    BaseMetrics: {
      Commerce: d.baseMetrics.commerce,
      Morale: d.baseMetrics.morale,
      Safety: d.baseMetrics.safety,
      Stability: d.baseMetrics.stability,
    },
    EconomyProfile: {
      SupplyCategories: d.economyProfile.supplyCategories.slice(),
      ScarcityDefaults: { ...d.economyProfile.scarcityDefaults },
    },
  };
}
