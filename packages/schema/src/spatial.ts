// spatial.ts — core map, zone, and connection types

import type { ParallaxLayer } from './visual.js';

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
  /** Z-plane position in meters (2.5D). 0 = gameplay plane; positive = up. UE5 exporters multiply by 100 for cm. */
  elevation?: number;
  /** Vertical span for multi-level zones. `floor < ceiling`, both in meters. */
  elevationRange?: ZoneElevationRange;
  /** Ordered parallax layers rendered behind/in-front-of gameplay for 2.5D depth. */
  parallaxLayers?: ParallaxLayer[];
  /** Asset id of a sky / skyline backdrop for 2.5D vertical framing. */
  skylineRef?: string;
}

/**
 * Vertical span for a multi-level zone, in meters.
 * Both floor and ceiling must be finite numbers; NaN and Infinity are rejected by validateProject.
 */
export interface ZoneElevationRange {
  floor: number;
  ceiling: number;
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
export type ConnectionKind =
  | 'passage' | 'door' | 'stairs' | 'road' | 'portal' | 'secret' | 'hazard'
  | 'channel' | 'route' | 'docking' | 'warp' | 'trail';

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
