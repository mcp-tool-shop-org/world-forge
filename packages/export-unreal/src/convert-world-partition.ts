// convert-world-partition.ts — authoring-mode grid → UE5 World Partition cell hints

import type { WorldProject, AuthoringMode } from '@world-forge/schema';
import { DEFAULT_TILE_SIZE_CM } from './coordinate-transform.js';

/**
 * Suggested World Partition cell size (edge length in cm) per authoring mode.
 * These are hints — the UE5 project can override, but picking sensible defaults
 * per scale keeps the generated pack usable out of the box.
 *
 *   - dungeon / interior: small cells (tight spaces, lots of streaming)
 *   - district / wilderness / ocean: mid
 *   - world / space: large cells
 */
const MODE_TO_CELL_SIZE_CM: Record<AuthoringMode, number> = {
  dungeon: 12800, // 128 m
  interior: 6400, // 64 m
  district: 25600, // 256 m
  world: 51200, // 512 m
  ocean: 51200, // 512 m
  space: 102400, // 1024 m
  wilderness: 25600, // 256 m
};

export interface UnrealWorldPartitionHint {
  /** Derived from authoring mode; UE5 project can override. */
  CellSizeCm: number;
  /** Total cells on each axis, ceiling(gridSize * tileSizeCm / cellSizeCm). */
  CellsX: number;
  CellsY: number;
  /** Grid extent in cm (origin 0,0 → positive). */
  ExtentCm: { WidthCm: number; DepthCm: number };
  /** Authoring mode that produced these hints. */
  SourceMode: AuthoringMode;
  /** Tile size from the WorldMap, in cm. */
  TileSizeCm: number;
}

export function convertWorldPartition(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): UnrealWorldPartitionHint {
  const mode: AuthoringMode = project.mode ?? 'dungeon';
  const cellSizeCm = MODE_TO_CELL_SIZE_CM[mode];
  const widthCm = project.map.gridWidth * tileSizeCm;
  const depthCm = project.map.gridHeight * tileSizeCm;

  return {
    CellSizeCm: cellSizeCm,
    CellsX: Math.max(1, Math.ceil(widthCm / cellSizeCm)),
    CellsY: Math.max(1, Math.ceil(depthCm / cellSizeCm)),
    ExtentCm: { WidthCm: widthCm, DepthCm: depthCm },
    SourceMode: mode,
    TileSizeCm: tileSizeCm,
  };
}
