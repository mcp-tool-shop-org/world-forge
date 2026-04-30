/**
 * convert-districts.ts — WorldProject districts → Godot district resources.
 *
 * Districts map to custom Resource (.tres) files that group zone IDs and carry
 * economy/faction metadata for runtime systems.
 */

import type { WorldProject, District } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export interface GodotDistrictResource {
  /** Resource path: res://world_data/districts/<id>.tres */
  resourcePath: string;
  id: string;
  displayName: string;
  zoneIds: string[];
  tags: string[];
  controllingFaction?: string;
  baseMetrics: {
    commerce: number;
    morale: number;
    safety: number;
    stability: number;
  };
  economyProfile: {
    supplyCategories: string[];
    scarcityDefaults: Record<string, number>;
  };
}

export interface ConvertDistrictsResult {
  districts: GodotDistrictResource[];
  fidelity: FidelityEntry[];
}

export function convertDistricts(project: WorldProject): ConvertDistrictsResult {
  const fidelity: FidelityEntry[] = [];
  const districts = project.districts.map((d) => convertDistrict(d, fidelity));
  return { districts, fidelity };
}

function convertDistrict(d: District, _fidelity: FidelityEntry[]): GodotDistrictResource {
  return {
    resourcePath: `res://world_data/districts/${d.id}.tres`,
    id: d.id,
    displayName: d.name,
    zoneIds: d.zoneIds.slice(),
    tags: d.tags.slice(),
    controllingFaction: d.controllingFaction,
    baseMetrics: {
      commerce: d.baseMetrics.commerce,
      morale: d.baseMetrics.morale,
      safety: d.baseMetrics.safety,
      stability: d.baseMetrics.stability,
    },
    economyProfile: {
      supplyCategories: d.economyProfile.supplyCategories.slice(),
      scarcityDefaults: { ...d.economyProfile.scarcityDefaults },
    },
  };
}
