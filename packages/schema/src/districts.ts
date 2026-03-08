// districts.ts — district grouping and faction presence types

/** Aggregates zones into a named region with economy and faction metadata. */
export interface District {
  id: string;
  name: string;
  zoneIds: string[];
  tags: string[];
  controllingFaction?: string;
  baseMetrics: DistrictMetrics;
  economyProfile: EconomyProfile;
}

/** Numeric district health indicators (0-100). */
export interface DistrictMetrics {
  commerce: number;
  morale: number;
  safety: number;
  stability: number;
}

/** District economic configuration. */
export interface EconomyProfile {
  supplyCategories: string[];
  scarcityDefaults: Record<string, number>;
}

/** A faction's footprint on the map. */
export interface FactionPresence {
  factionId: string;
  districtIds: string[];
  influence: number;
  alertLevel: number;
  patrolRoutes?: PatrolRoute[];
}

/** A patrol route through connected zones. */
export interface PatrolRoute {
  zoneIds: string[];
}

/** A zone where world pressures are more likely to spawn. */
export interface PressureHotspot {
  id: string;
  zoneId: string;
  pressureType: string;
  baseProbability: number;
  tags: string[];
}
