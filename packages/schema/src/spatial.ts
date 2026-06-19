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

/**
 * A party-state gate on ENTERING a zone. Every condition must pass (AND); each
 * condition is a SpawnCondition-grammar string (see spawn-condition.ts), reusing
 * the party-* / item / flag / member / class operands. `mode` is 'hard' (block
 * entry) or 'soft' (advisory only); `reason` is the authored "show the lock"
 * message shown when the gate is unmet. Additive since v4.5.
 */
export interface ZoneEntryGate {
  /** SpawnCondition-grammar strings; ALL must pass to enter (AND). */
  conditions: string[];
  /** 'hard' blocks entry; 'soft' warns but allows. */
  mode: 'hard' | 'soft';
  /** Authored message surfaced when the gate is unmet. */
  reason?: string;
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
  /**
   * The discrete vertical layer (Stratum) this zone belongs to. Additive since
   * v4.5 — groups zones into surface/underground/sky levels. See stratum.ts.
   */
  stratumId?: string;
  /**
   * Ids of typed HazardDefinitions active in this zone (additive since v4.5).
   * The legacy free-text `hazards: string[]` field above is untouched.
   */
  hazardRefs?: string[];
  /**
   * Party-state gate on entering this zone (additive since v4.5). See
   * ZoneEntryGate above.
   */
  entryGate?: ZoneEntryGate;
  /** Ordered parallax layers rendered behind/in-front-of gameplay for 2.5D depth. */
  parallaxLayers?: ParallaxLayer[];
  /** Asset id of a sky / skyline backdrop for 2.5D vertical framing. */
  skylineRef?: string;

  // ── Physics overrides (SCH-FT-006) ──────────────────────────
  /** Gravity magnitude override (m/s²). Leave undefined to inherit project/engine default. */
  gravityOverride?: number;
  /** Gravity direction. Default is 'down' (negative Z). */
  gravityDirection?: 'down' | 'up' | 'none';
  /** Physics mode that the engine should apply in this zone. */
  physicsMode?: 'normal' | 'platformer' | 'zero-g' | 'aquatic';

  // ── Sky + lighting (UE-FT-002 schema half) ──────────────────
  // Hints for exporters (UE5 Sky Atmosphere / Godot WorldEnvironment). The
  // 2D editor may not have UI for these yet — they flow through the schema
  // so downstream exporters in Wave 2 can consume them.
  /** Asset id for UE5 Sky Atmosphere preset / Godot equivalent. */
  skyAtmosphereRef?: string;
  /** Directional light yaw in degrees (sun direction). */
  directionalLightYaw?: number;
  /** Directional light pitch in degrees. */
  directionalLightPitch?: number;
  /** Sky light intensity multiplier. */
  skyLightIntensity?: number;
  /** Time-of-day key for engine presets ('dawn' | 'day' | 'dusk' | 'night' | ...). */
  timeOfDay?: string;

  // ── Collision hint (UE-FT-003 schema half) ──────────────────
  /** Collision channel hint for engine runtime. */
  collisionType?: 'walkable' | 'water' | 'hazard' | 'void' | 'custom';
}

/** Kind of vertical/spatial transition a TransitionEntity represents. */
export type TransitionEntityType = 'elevator' | 'warp' | 'transporter' | 'cargo-lift' | 'stairwell';

/**
 * A placed transition — elevator, warp gate, transporter pad, cargo lift, or stairwell —
 * that moves the player between two zones. Richer than a ZoneConnection because it
 * carries presentation metadata (animation key, travel duration, grid anchor).
 */
export interface TransitionEntity {
  id: string;
  zoneId: string;
  targetZoneId: string;
  type: TransitionEntityType;
  gridX?: number;
  gridY?: number;
  /** Display label (e.g. "Deck 3 → Deck 5 Lift"). */
  label?: string;
  /** Optional animation key for UE5 Sequencer / Godot AnimationPlayer. */
  animation?: string;
  /** Travel duration hint, in seconds. Must be finite and >= 0 when present. */
  durationSeconds?: number;
  /** Free-form tags. */
  tags?: string[];
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
