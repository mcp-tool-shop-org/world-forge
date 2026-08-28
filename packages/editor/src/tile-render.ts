// tile-render.ts — shared helpers for the canvas tile render pass.

/**
 * Colored-rect fallback used when a tile's tileset has no loadable image
 * (no `imagePath`, or the image failed to decode). Mirrors renderer-2d's
 * TileLayerRenderer scheme so the editor and the PixiJS renderer agree on the
 * placeholder palette. Returns a CSS hex color string.
 *
 * Precedence when a tile carries multiple tags: wall > water > door > floor.
 */
export function fallbackTileColor(tags: readonly string[]): string {
  if (tags.includes('wall')) return '#555555';
  if (tags.includes('water')) return '#2244aa';
  if (tags.includes('door')) return '#886622';
  return '#333333'; // default floor
}

/** Matches renderer-2d EntityRenderer / TileLayerRenderer elevation y-offset. */
export function elevationDrawOffset(elevation: number | undefined): number {
  const elev = elevation ?? 0;
  return -Math.min(Math.max(elev, -10), 10) * 0.8;
}

export function zoneElevationAt(
  zones: Array<{ gridX: number; gridY: number; gridWidth: number; gridHeight: number; elevation?: number }>,
  gx: number,
  gy: number,
): number {
  for (const z of zones) {
    if (gx >= z.gridX && gx < z.gridX + z.gridWidth && gy >= z.gridY && gy < z.gridY + z.gridHeight) {
      return z.elevation ?? 0;
    }
  }
  return 0;
}
