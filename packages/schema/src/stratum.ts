// stratum.ts — vertical world layers (strata) + inter-layer connectors.
//
// A Stratum is a discrete vertical layer that groups zones into a level —
// surface, underground, sky, or building floors over a cellar. This is the macro
// vertical structure; per-zone/per-tile `elevation` (meters) remains the fine
// intra-stratum offset. The discrete-integer-order model (not continuous meters)
// is the shipped consensus: Dwarf Fortress z-levels, FFT stacked terrain levels,
// and the cell-and-portal / layered-navmesh pattern in engines all order vertical
// space by integer index and connect levels with explicit links. See
// docs/world-modeling-design.md for the full research grounding.
//
// All additive — projects authored before strata existed open and validate
// normally (the arrays default to undefined / []).

/**
 * A discrete vertical layer grouping zones into a level. `order` is a SIGNED
 * integer (surface = 0, underground = -1, sky = +1) that drives draw order and
 * the Godot z_index band; it is NOT a metric height.
 */
export interface Stratum {
  id: string;
  name: string;
  /** Signed vertical order: surface = 0, underground = -1, sky = +1. */
  order: number;
  /** Optional metric span of the layer (continuity with Zone.elevationRange). floor < ceiling. */
  zRange?: { floor: number; ceiling: number };
  /**
   * Ids of strata visible from this one (cell-and-portal / PVS). When empty or
   * undefined the engine falls back to its default (adjacent by order).
   */
  visibleStrata?: string[];
  tags: string[];
}

/**
 * An explicit connector between two strata — a stairwell, ladder, elevator, or
 * shaft. Cross-level traversal is an authored edge, not implied by height
 * (mirrors Godot NavigationLink2D, which connects separate navmeshes).
 */
export interface StratumLink {
  id: string;
  fromStratumId: string;
  toStratumId: string;
  /** Optional anchor zones the link physically connects (a stairwell ↔ a cellar). */
  fromZoneId?: string;
  toZoneId?: string;
  bidirectional: boolean;
  /** Free-form kind: 'stairs' | 'ladder' | 'elevator' | 'shaft' | 'ramp' | ... */
  linkType: string;
}
