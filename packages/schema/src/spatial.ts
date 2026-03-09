// spatial.ts — core map, zone, and connection types

/** Top-level map container. Defines the grid dimensions for the authored world. */
export interface WorldMap {
  id: string;
  name: string;
  description: string;
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
}

/** A named area on the map occupying a rectangular tile region. */
export interface Zone {
  id: string;
  name: string;
  tags: string[];
  description: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  neighbors: string[];
  exits: ZoneExit[];
  light: number;
  noise: number;
  hazards: string[];
  interactables: Interactable[];
  parentDistrictId?: string;
  backgroundId?: string;
  tilesetId?: string;
}

/** A labeled exit from one zone to another. */
export interface ZoneExit {
  targetZoneId: string;
  label: string;
  condition?: string;
}

/** A named interactive object within a zone. */
export interface Interactable {
  name: string;
  type: 'inspect' | 'use' | 'enter' | 'talk' | 'none';
  description?: string;
}

/** Semantic path type for a connection. */
export type ConnectionKind = 'passage' | 'door' | 'stairs' | 'road' | 'portal' | 'secret' | 'hazard';

/** An explicit link between two zones. */
export interface ZoneConnection {
  fromZoneId: string;
  toZoneId: string;
  label?: string;
  kind?: ConnectionKind;
  bidirectional: boolean;
  condition?: string;
}

/** A named point of interest within a zone. */
export interface Landmark {
  id: string;
  name: string;
  zoneId: string;
  gridX: number;
  gridY: number;
  tags: string[];
  description?: string;
  interactionType: 'inspect' | 'use' | 'enter' | 'talk' | 'none';
  iconId?: string;
}
