// zone-2d5-helpers.ts — pure helpers for the ED-FT-001 Zone 2.5D editor.
//
// Keeping the parallax-layer algebra and validation out of the React component
// means the swarm's feature tests can exercise them without a DOM. The actual
// UI (ZoneProperties.tsx) imports these and wires them to zustand.

import type { ParallaxLayer, Zone, AssetEntry } from '@world-forge/schema';

export interface ElevationRangeError {
  kind: 'floor-not-less-than-ceiling' | 'not-finite';
  message: string;
}

/**
 * Validate an elevation range. Returns `null` when the range is either unset
 * or valid; returns a structured error otherwise so the UI can show the
 * exact cause inline without clearing the user's input.
 */
export function validateElevationRange(
  floor: number | undefined,
  ceiling: number | undefined,
): ElevationRangeError | null {
  // Both empty = unset, valid.
  if (floor == null && ceiling == null) return null;
  if (floor == null || ceiling == null) return null; // allow partial edit
  if (!Number.isFinite(floor) || !Number.isFinite(ceiling)) {
    return { kind: 'not-finite', message: 'floor and ceiling must be finite numbers' };
  }
  if (floor >= ceiling) {
    return { kind: 'floor-not-less-than-ceiling', message: 'floor must be less than ceiling' };
  }
  return null;
}

/** Parse user input into a number, returning `undefined` for empty/invalid. */
export function parseElevation(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

/**
 * Given existing layers, compute the next auto id (`layer-N` with the lowest
 * positive N that isn't already taken). Gap-filling so the user sees stable
 * numbering after deletions.
 */
export function nextLayerId(existing: ParallaxLayer[]): string {
  const taken = new Set(existing.map((l) => l.id));
  let n = 1;
  while (taken.has(`layer-${n}`)) n++;
  return `layer-${n}`;
}

/** Next default depth: max existing + 10, or 0 when empty. */
export function nextLayerDepth(existing: ParallaxLayer[]): number {
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((l) => l.depth)) + 10;
}

/** Produce a fresh default layer for the "Add layer" button. */
export function createDefaultLayer(existing: ParallaxLayer[]): ParallaxLayer {
  return {
    id: nextLayerId(existing),
    depth: nextLayerDepth(existing),
    assetRef: '',
    scrollFactor: 0.5,
  };
}

/** Filter the project asset list to the kinds a parallax layer may reference. */
export function filterParallaxAssets(assets: AssetEntry[]): AssetEntry[] {
  return assets.filter((a) => a.kind === 'background' || a.kind === 'sprite');
}

/** Filter to background-only for the skyline picker. */
export function filterSkylineAssets(assets: AssetEntry[]): AssetEntry[] {
  return assets.filter((a) => a.kind === 'background');
}

/** Sort layers by depth descending (furthest first) for the preview stack. */
export function sortLayersForPreview(layers: ParallaxLayer[]): ParallaxLayer[] {
  return [...layers].sort((a, b) => b.depth - a.depth);
}

/** True when the given id is unique within the layer list (excluding the row at skipIndex). */
export function isLayerIdUnique(
  layers: ParallaxLayer[],
  id: string,
  skipIndex: number,
): boolean {
  if (id.trim() === '') return false;
  for (let i = 0; i < layers.length; i++) {
    if (i === skipIndex) continue;
    if (layers[i].id === id) return false;
  }
  return true;
}

/**
 * ED-FT-003 helper: the default "Show Elevation" toggle state is ON for modes
 * that typically author elevation (space, wilderness) and OFF otherwise.
 */
export function defaultShowElevation(mode: Zone['parentDistrictId'] | string | undefined): boolean {
  return mode === 'space' || mode === 'wilderness';
}
