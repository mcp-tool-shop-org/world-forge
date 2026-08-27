// convert-world-partition.ts — authoring-mode grid → UE5 World Partition cell hints

import type { WorldProject, AuthoringMode } from '@world-forge/schema';
import { isValidMode, DEFAULT_MODE } from '@world-forge/schema';
import { DEFAULT_TILE_SIZE_CM } from './coordinate-transform.js';
import type { FidelityEntry } from './fidelity.js';

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

export interface ConvertWorldPartitionResult {
  hint: UnrealWorldPartitionHint;
  fidelity: FidelityEntry[];
}

export function convertWorldPartition(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertWorldPartitionResult {
  const fidelity: FidelityEntry[] = [];
  // F-8360c1fb: MODE_TO_CELL_SIZE_CM is compile-time complete but the lookup
  // is unguarded at runtime. An unknown mode yields undefined → NaN cells,
  // and JSON.stringify turns those NaNs into null. Fall back to DEFAULT_MODE
  // and never emit non-finite CellSizeCm/CellsX/CellsY.
  const rawMode = project.mode ?? DEFAULT_MODE;
  let mode: AuthoringMode = DEFAULT_MODE;
  if (typeof rawMode === 'string' && isValidMode(rawMode)) {
    mode = rawMode;
  } else {
    fidelity.push({
      level: 'approximated',
      domain: 'world-partition',
      severity: 'warning',
      fieldPath: 'mode',
      message: `Unrecognized authoring mode "${String(rawMode)}" — falling back to "${DEFAULT_MODE}" cell size.`,
      reason: 'AuthoringMode is not one of the known modes; CellSizeCm/CellsX/CellsY would be NaN without a fallback.',
    });
  }
  const cellSizeCm = MODE_TO_CELL_SIZE_CM[mode];

  const rawWidth = project.map.gridWidth;
  const rawHeight = project.map.gridHeight;

  if (rawWidth < 1 || rawHeight < 1) {
    fidelity.push({
      level: 'dropped',
      domain: 'world-partition',
      severity: 'warning',
      fieldPath: 'map.gridWidth/gridHeight',
      message: `WorldPartition extent clamped — map.gridWidth=${rawWidth}, map.gridHeight=${rawHeight} below minimum of 1.`,
      reason: 'Grid dimensions must be >= 1; clamped to 1 so the pack remains structurally valid.',
    });
  }

  const gridWidth = Math.max(1, rawWidth);
  const gridHeight = Math.max(1, rawHeight);
  const widthCm = gridWidth * tileSizeCm;
  const depthCm = gridHeight * tileSizeCm;

  const cellsX = Math.max(1, Math.ceil(widthCm / cellSizeCm));
  const cellsY = Math.max(1, Math.ceil(depthCm / cellSizeCm));
  const hint: UnrealWorldPartitionHint = {
    CellSizeCm: cellSizeCm,
    CellsX: Number.isFinite(cellsX) ? cellsX : 1,
    CellsY: Number.isFinite(cellsY) ? cellsY : 1,
    ExtentCm: { WidthCm: widthCm, DepthCm: depthCm },
    SourceMode: mode,
    TileSizeCm: tileSizeCm,
  };

  return { hint, fidelity };
}
