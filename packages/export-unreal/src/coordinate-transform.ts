/**
 * coordinate-transform.ts — World Forge (pixel canvas, Y-down) → Unreal Engine 5 (cm, Z-up).
 *
 * Pure functions. No side effects. These are the single source of truth for
 * the axis flip and unit scale used by every Unreal converter in this package.
 *
 * ## Source frame: World Forge 2D canvas
 *
 * - Positions are stored in **pixels** on a 2D canvas.
 * - The canvas uses the standard screen-pixel convention: **+x goes right, +y goes DOWN**.
 *   (This is Y-down — identical to HTML canvas, image buffers, most 2D engines.)
 * - Elevation is authored separately in **metres** on `Zone.elevation` /
 *   `Zone.elevationRange`. It is not part of the 2D canvas coordinate.
 *
 * ## Destination frame: Unreal Engine 5
 *
 * - UE5 uses a **left-handed** coordinate system with **Z-up**:
 *   **+X is forward, +Y is right, +Z is up**.
 * - Units are **unreal units (uu)**, and at default gameplay scale **1 uu = 1 cm**.
 *   (1 metre = 100 uu = 100 cm.)
 *
 * ## Axis mapping
 *
 *   WorldForge (pixels, Y-down)            →  Unreal (cm, Z-up, Y-right)
 *   --------------------------------------   ---------------------------
 *   x  (right, in pixels)                  →  X  (forward, in cm)
 *   y  (DOWN, in pixels)                   →  Y  (right, in cm)   ← negated
 *   elevation (metres, separate channel)   →  Z  (up, in cm)      ← ×100
 *
 * The `Y: -y` negation is the axis flip: Unreal's +Y points "right" when
 * looking along +X, so a canvas pixel that is *below* another (larger `y`)
 * must end up on the *left* in Unreal (smaller `Y`). Flipping the sign is
 * what mirrors the Y-down pixel convention onto Unreal's Y-right world axis.
 *
 * ## Scale
 *
 * Default world scale is `1 tile = 100 cm (1 metre)`, i.e. `DEFAULT_TILE_SIZE_CM = 100`.
 * Override per export by passing `tileSizeCm`. At default scale **1 UE unit = 1 cm**.
 */

/** Default world scale: 1 tile = 1 metre = 100 UE cm. */
export const DEFAULT_TILE_SIZE_CM = 100;

/** Unreal-space coordinate triple. Always in centimetres. */
export interface UnrealVec3 {
  X: number;
  Y: number;
  Z: number;
}

/** A 2D point on the World Forge canvas (pixels, Y-down). */
export interface WorldForgePoint {
  x: number;
  y: number;
  /** Optional elevation in metres. Defaults to 0 when absent. */
  elevation?: number;
}

/**
 * Convert a pixel length into Unreal cm given a `tileSize` in pixels.
 *
 * With the default `DEFAULT_TILE_SIZE_CM` (1 tile = 100 cm), the pixel→cm ratio
 * is `100 / tileSize`. A 32px tile produces `100/32 = 3.125 cm per pixel`.
 */
export function pixelsToUnrealCm(pixels: number, tileSize: number, tileSizeCm: number = DEFAULT_TILE_SIZE_CM): number {
  if (tileSize <= 0) {
    throw new RangeError(`pixelsToUnrealCm: tileSize must be > 0 (got ${tileSize})`);
  }
  // UE-B-002: guard tileSizeCm the same way. Non-finite or non-positive scale
  // would silently produce NaN / flipped coords and contaminate every transform
  // downstream. Fail loud here so the stack trace points at the source.
  if (!Number.isFinite(tileSizeCm) || tileSizeCm <= 0) {
    throw new RangeError(`pixelsToUnrealCm: tileSizeCm must be a positive finite number (got ${tileSizeCm})`);
  }
  return (pixels * tileSizeCm) / tileSize;
}

/**
 * Convert an elevation in metres to an Unreal Z coordinate in cm.
 *
 * Unreal uses 1 uu = 1 cm for gameplay scale, so 1 m = 100 cm = 100 uu.
 */
export function elevationToZ(elevationMeters: number): number {
  return elevationMeters * 100;
}

/**
 * Transform a World Forge point into Unreal space.
 *
 * @param point   Canvas point in pixels. `elevation` is optional, metres.
 * @param tileSize Canvas tile size in pixels (from `WorldMap.tileSize`).
 * @param tileSizeCm Unreal cm per tile. Defaults to `DEFAULT_TILE_SIZE_CM` (100).
 * @returns `{ X, Y, Z }` in Unreal centimetres, with Y flipped from Y-down to Z-up.
 */
export function worldForgeToUnrealAxis(
  point: WorldForgePoint,
  tileSize: number,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): UnrealVec3 {
  const X = pixelsToUnrealCm(point.x, tileSize, tileSizeCm);
  const Y = -pixelsToUnrealCm(point.y, tileSize, tileSizeCm);
  const Z = elevationToZ(point.elevation ?? 0);
  return { X, Y, Z };
}

/**
 * Transform a grid coordinate (tile units, not pixels) to Unreal cm.
 * Useful for zone grid positions where coordinates are authored in whole tiles.
 */
export function gridToUnrealAxis(
  gridX: number,
  gridY: number,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
  elevationMeters: number = 0,
): UnrealVec3 {
  // UE-B-002: guard tileSizeCm. Same reasoning as pixelsToUnrealCm — a bad
  // scale here quietly corrupts every grid-placed actor in the output pack.
  if (!Number.isFinite(tileSizeCm) || tileSizeCm <= 0) {
    throw new RangeError(`gridToUnrealAxis: tileSizeCm must be a positive finite number (got ${tileSizeCm})`);
  }
  return {
    X: gridX * tileSizeCm,
    Y: -gridY * tileSizeCm,
    Z: elevationToZ(elevationMeters),
  };
}
