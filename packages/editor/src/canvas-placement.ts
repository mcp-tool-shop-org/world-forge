// canvas-placement.ts — zone-required click placement for canvas tools.
// Extracted so gesture tests can drive landmark / item placement without
// mounting Canvas (this package's vitest setup has no jsdom).

import type { ItemPlacement, Landmark, WorldProject, Zone } from '@world-forge/schema';
import { nextId } from './ids.js';
import type { EditorTool } from './store/editor-store.js';

export function findZoneAtGrid(zones: Zone[], gx: number, gy: number): Zone | undefined {
  return zones.find((z) =>
    gx >= z.gridX && gx < z.gridX + z.gridWidth &&
    gy >= z.gridY && gy < z.gridY + z.gridHeight,
  );
}

export function makeDefaultLandmark(zoneId: string, gx: number, gy: number, name = 'Landmark'): Landmark {
  return {
    id: nextId('lm'),
    name,
    zoneId,
    gridX: gx,
    gridY: gy,
    tags: [],
    interactionType: 'inspect',
  };
}

export function makeDefaultItemPlacement(zoneId: string, gx: number, gy: number): ItemPlacement {
  return {
    itemId: nextId('item'),
    zoneId,
    gridX: gx,
    gridY: gy,
    hidden: false,
  };
}

export type PlacementResult = 'placed' | 'need-zone' | 'unhandled';

export interface PlacementStores {
  addLandmark: (l: Landmark) => void;
  addItemPlacement: (i: ItemPlacement) => void;
}

/**
 * Apply a click at grid (gx, gy) for placement tools that require a zone.
 * Returns 'need-zone' when the click missed every zone so the canvas can toast.
 */
export function applyPlacementClick(
  tool: EditorTool,
  gx: number,
  gy: number,
  project: WorldProject,
  stores: PlacementStores,
): PlacementResult {
  if (tool !== 'landmark' && tool !== 'item-place') return 'unhandled';
  const zone = findZoneAtGrid(project.zones, gx, gy);
  if (!zone) return 'need-zone';
  if (tool === 'landmark') {
    stores.addLandmark(makeDefaultLandmark(zone.id, gx, gy));
  } else {
    stores.addItemPlacement(makeDefaultItemPlacement(zone.id, gx, gy));
  }
  return 'placed';
}
