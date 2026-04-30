/**
 * coordinate-transform.ts — World Forge (tile-grid, Y-down) → Godot 4 (pixels, Y-down).
 *
 * Godot 4's 2D coordinate system matches World Forge's canvas convention:
 *   +X is right, +Y is down.
 *
 * The only transformation is the scale: World Forge stores grid coordinates in
 * tile units. Godot needs pixel positions. The conversion factor is `tileSize`
 * (pixels per tile), which comes from `WorldMap.tileSize`.
 *
 * For 3D export (rare, but supported), Godot 4 uses:
 *   +X right, +Y up, -Z forward (right-handed, Y-up).
 * Elevation in metres maps directly to Y in Godot 3D space.
 */

/** Default tile size in pixels when WorldMap.tileSize is not available. */
export const DEFAULT_TILE_SIZE_PX = 32;

/** A 2D position in Godot pixel space. */
export interface GodotVec2 {
    x: number;
    y: number;
}

/** A 3D position in Godot world space (metres, Y-up). */
export interface GodotVec3 {
    x: number;
    y: number;
    z: number;
}

/**
 * Convert a grid coordinate (tile units) to Godot 2D pixel position.
 * This is a simple scale — no axis flip needed since both are Y-down.
 */
export function gridToGodot2D(gridX: number, gridY: number, tileSize: number = DEFAULT_TILE_SIZE_PX): GodotVec2 {
    if (tileSize <= 0) {
        throw new RangeError(`gridToGodot2D: tileSize must be > 0 (got ${tileSize})`);
    }
    return {
        x: gridX * tileSize,
        y: gridY * tileSize,
    };
}

/**
 * Convert a grid coordinate + elevation to Godot 3D position.
 * Godot 3D: X = right, Y = up, Z = forward (into screen when Y-up).
 * World Forge gridX → Godot X, World Forge gridY → Godot Z (depth), elevation → Godot Y.
 */
export function gridToGodot3D(
    gridX: number,
    gridY: number,
    tileSize: number = DEFAULT_TILE_SIZE_PX,
    elevationMeters: number = 0,
): GodotVec3 {
    if (tileSize <= 0) {
        throw new RangeError(`gridToGodot3D: tileSize must be > 0 (got ${tileSize})`);
    }
    return {
        x: gridX * tileSize,
        y: elevationMeters,
        z: gridY * tileSize,
    };
}

/**
 * Convert a pixel extent (width × height in tiles) to Godot 2D size.
 */
export function extentToGodot2D(gridWidth: number, gridHeight: number, tileSize: number = DEFAULT_TILE_SIZE_PX): GodotVec2 {
    return {
        x: gridWidth * tileSize,
        y: gridHeight * tileSize,
    };
}
