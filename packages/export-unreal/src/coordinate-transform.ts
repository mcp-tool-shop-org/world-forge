/**
 * coordinate-transform.ts — World Forge (pixel, Y-down) → Unreal Engine 5 (cm, Z-up).
 *
 * Pure functions. No side effects. These are the single source of truth for
 * the axis flip and unit scale used by every Unreal converter in this package.
 *
 * ## Conventions
 *
 * - World Forge stores positions in **pixels** (2D canvas, Y-down).
 * - Unreal Engine stores positions in **centimetres** (left-handed Z-up, Y-right).
 * - Default world scale: `1 tile = 100 cm (1 metre)`. Override by passing `tileSize`.
 * - Elevation is authored in **metres** on `Zone.elevation` / `elevationRange`,
 *   converted to cm on export.
 *
 * ## Axis mapping
 *
 *   WorldForge { x, y } → Unreal { X: x, Y: -y, Z: elevation * 100 }
 *
 * The Y flip mirrors the WF Y-down canvas convention onto Unreal's left-handed
 * Z-up space (Unreal Y points "right" when looking down +X).
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
  return {
    X: gridX * tileSizeCm,
    Y: -gridY * tileSizeCm,
    Z: elevationToZ(elevationMeters),
  };
}
