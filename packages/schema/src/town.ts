// town.ts — placed town-structure types: buildings, hubs, strongholds.
//
// These sit a layer above the town economy (market nodes + crafting stations,
// see entities.ts). A Building is an enterable footprint on the town map; a Hub
// is a service/connectivity node attached to a zone; a Stronghold is a fortified
// faction seat. All three are additive — projects authored before they existed
// open and validate normally (the arrays default to undefined / []).

/**
 * A placed, enterable structure on the town map — a house, shop, temple, etc.
 * Occupies a footprint of tiles and can link to an interior zone you enter.
 */
export interface Building {
  id: string;
  name: string;
  /** Free-form kind: 'house' | 'shop' | 'temple' | 'tavern' | 'warehouse' | ... */
  buildingType: string;
  /** Footprint origin (top-left) in tile coordinates. */
  gridX: number;
  gridY: number;
  /** Footprint size in tiles. */
  width: number;
  height: number;
  /** The town zone/area this building sits in. */
  zoneId?: string;
  /** The interior zone you ENTER — links the town map to the interiors layer. */
  interiorZoneId?: string;
  tags: string[];
}

/**
 * A town center / service + connectivity node attached to a zone — a
 * market square, crossroads, or town center that serves nearby zones.
 */
export interface Hub {
  id: string;
  name: string;
  /** The central zone this hub anchors to. */
  zoneId: string;
  /** Free-form kind: 'market-square' | 'crossroads' | 'town-center' | ... */
  hubType: string;
  /** Services offered here: 'market' | 'tavern' | 'temple' | 'inn' | ... */
  serviceTypes: string[];
  /** Zones this hub serves / links to. */
  connectedZoneIds: string[];
  tags: string[];
}

/**
 * A fortified faction seat — a keep, fort, or citadel a faction controls and
 * defends. Defense strength and garrison drive siege/encounter behavior.
 */
export interface Stronghold {
  id: string;
  name: string;
  /** The zone this stronghold occupies. */
  zoneId: string;
  /** The controlling faction, if any. */
  factionId?: string;
  /** Fortification strength (0-N). Higher = harder to take. */
  defenseLevel: number;
  /** Entities garrisoned here as defenders. */
  garrisonEntityIds: string[];
  tags: string[];
}
