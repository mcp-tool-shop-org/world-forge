// types.ts — preset type definitions for region and encounter templates

import type { DistrictMetrics, EconomyProfile, FactionPresence, PressureHotspot, AuthoringMode } from '@world-forge/schema';

/** A reusable template for district/region configuration. */
export interface RegionPreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  genre?: string;
  /** Authoring modes this preset is relevant to. Undefined = all modes. */
  modes?: AuthoringMode[];
  builtIn: boolean;
  /** Tags applied to the district. */
  regionTags: string[];
  /** Controlling faction name. */
  controllingFaction?: string;
  /** Partial metrics — merge fills only missing/default values. */
  baseMetrics: Partial<DistrictMetrics>;
  /** Partial economy profile. */
  economyProfile?: Partial<EconomyProfile>;
  /** Faction presences to create (districtIds filled on apply). */
  factionPresences: Array<Omit<FactionPresence, 'districtIds'>>;
  /** Pressure hotspot templates (id and zoneId filled on apply). */
  pressureHotspots: Array<Omit<PressureHotspot, 'id' | 'zoneId'>>;
}

/** A reusable template for encounter creation. */
export interface EncounterPreset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  genre?: string;
  /** Authoring modes this preset is relevant to. Undefined = all modes. */
  modes?: AuthoringMode[];
  builtIn: boolean;
  /** Encounter type (boss, ambush, patrol, hazard, discovery, etc.). */
  encounterType: string;
  /** Default enemy placeholder IDs. */
  enemyIds: string[];
  /** Spawn probability (0-1). */
  probability: number;
  /** Turns before encounter can re-trigger. */
  cooldownTurns: number;
  /** Tags applied to the encounter. */
  encounterTags: string[];
}
