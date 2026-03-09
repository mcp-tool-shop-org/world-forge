// viewport.ts — pure math utilities for 2D viewport transforms

import type { WorldProject } from '@world-forge/schema';

/** Camera state for the 2D viewport. */
export interface ViewportState {
  /** Pan offset in world pixels (how far the camera has moved). */
  panX: number;
  panY: number;
  /** Zoom level. 1.0 = 100%. Min 0.1, max 5.0. */
  zoom: number;
}

/** Axis-aligned bounding box in world coordinates. */
export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Default zoom bounds. */
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;
export const DEFAULT_VIEWPORT: ViewportState = { panX: 0, panY: 0, zoom: 1 };

/**
 * Convert screen pixel coordinates to world pixel coordinates.
 * Screen (0,0) is the canvas top-left corner.
 *
 * Transform: worldX = screenX / zoom + panX
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
): { worldX: number; worldY: number } {
  return {
    worldX: screenX / viewport.zoom + viewport.panX,
    worldY: screenY / viewport.zoom + viewport.panY,
  };
}

/**
 * Convert world pixel coordinates to screen pixel coordinates.
 *
 * Transform: screenX = (worldX - panX) * zoom
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  viewport: ViewportState,
): { screenX: number; screenY: number } {
  return {
    screenX: (worldX - viewport.panX) * viewport.zoom,
    screenY: (worldY - viewport.panY) * viewport.zoom,
  };
}

/**
 * Convert screen pixel coordinates to grid coordinates.
 * Uses Math.floor for snapping to grid cells.
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  tileSize: number,
): { gridX: number; gridY: number } {
  const { worldX, worldY } = screenToWorld(screenX, screenY, viewport);
  return {
    gridX: Math.floor(worldX / tileSize),
    gridY: Math.floor(worldY / tileSize),
  };
}

/**
 * Compute the world-pixel bounding box of all authored content.
 * Includes zones, entities (if they have gridX/gridY), landmarks, spawns.
 * Returns null for empty projects.
 * Adds `padding` world pixels around the content (default: 64).
 */
export function computeContentBounds(
  project: WorldProject,
  tileSize: number,
  padding: number = 64,
): WorldBounds | null {
  if (project.zones.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function includePoint(x: number, y: number) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // Zone rects
  for (const z of project.zones) {
    const x = z.gridX * tileSize;
    const y = z.gridY * tileSize;
    includePoint(x, y);
    includePoint(x + z.gridWidth * tileSize, y + z.gridHeight * tileSize);
  }

  // Entity positions
  for (const ep of project.entityPlacements) {
    if (ep.gridX != null && ep.gridY != null) {
      includePoint(ep.gridX * tileSize, ep.gridY * tileSize);
    }
  }

  // Landmark positions
  for (const lm of project.landmarks) {
    includePoint(lm.gridX * tileSize, lm.gridY * tileSize);
  }

  // Spawn positions
  for (const sp of project.spawnPoints) {
    includePoint(sp.gridX * tileSize, sp.gridY * tileSize);
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

/**
 * Compute viewport state that fits the given bounds into the given
 * canvas dimensions (screen pixels). Centers the content.
 * Clamps zoom to [minZoom, maxZoom] range.
 */
export function fitBoundsToViewport(
  bounds: WorldBounds,
  canvasWidth: number,
  canvasHeight: number,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM,
): ViewportState {
  const boundsWidth = bounds.maxX - bounds.minX;
  const boundsHeight = bounds.maxY - bounds.minY;

  let zoom = Math.min(canvasWidth / boundsWidth, canvasHeight / boundsHeight);
  zoom = Math.max(minZoom, Math.min(maxZoom, zoom));

  // Center the bounds in the canvas:
  // We want the center of the bounds to map to the center of the canvas.
  // screenX = (worldX - panX) * zoom  →  canvasWidth/2 = (centerX - panX) * zoom
  // panX = centerX - canvasWidth / (2 * zoom)
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  return {
    panX: centerX - canvasWidth / (2 * zoom),
    panY: centerY - canvasHeight / (2 * zoom),
    zoom,
  };
}

/**
 * Compute viewport state that centers on a specific world-pixel point
 * at the current zoom level.
 */
export function centerOnPoint(
  worldX: number,
  worldY: number,
  canvasWidth: number,
  canvasHeight: number,
  zoom: number,
): ViewportState {
  return {
    panX: worldX - canvasWidth / (2 * zoom),
    panY: worldY - canvasHeight / (2 * zoom),
    zoom,
  };
}

/**
 * Compute viewport state that centers on and frames a specific zone.
 * Fits the zone into the canvas with some padding.
 */
export function centerOnZone(
  zone: { gridX: number; gridY: number; gridWidth: number; gridHeight: number },
  tileSize: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 64,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM,
): ViewportState {
  const bounds: WorldBounds = {
    minX: zone.gridX * tileSize - padding,
    minY: zone.gridY * tileSize - padding,
    maxX: (zone.gridX + zone.gridWidth) * tileSize + padding,
    maxY: (zone.gridY + zone.gridHeight) * tileSize + padding,
  };
  return fitBoundsToViewport(bounds, canvasWidth, canvasHeight, minZoom, maxZoom);
}

/**
 * Apply a zoom delta centered on a screen-space point.
 * Returns new ViewportState. Clamps to [minZoom, maxZoom].
 * Keeps the world point under the cursor stationary.
 */
export function zoomAtPoint(
  current: ViewportState,
  screenX: number,
  screenY: number,
  zoomDelta: number,
  minZoom: number = MIN_ZOOM,
  maxZoom: number = MAX_ZOOM,
): ViewportState {
  // World point under cursor before zoom
  const { worldX, worldY } = screenToWorld(screenX, screenY, current);

  // New zoom clamped
  const newZoom = Math.max(minZoom, Math.min(maxZoom, current.zoom + zoomDelta));

  // Solve for new pan so worldX/worldY stays at screenX/screenY:
  // screenX = (worldX - newPanX) * newZoom  →  newPanX = worldX - screenX / newZoom
  return {
    panX: worldX - screenX / newZoom,
    panY: worldY - screenY / newZoom,
    zoom: newZoom,
  };
}

/**
 * Compute viewport state that frames a set of spatial items.
 * Items with gridWidth/gridHeight are treated as rectangles; others as points.
 */
export function frameBounds(
  items: Array<{ gridX: number; gridY: number; gridWidth?: number; gridHeight?: number }>,
  tileSize: number,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 64,
): ViewportState | null {
  if (items.length === 0) return null;

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const item of items) {
    const x = item.gridX * tileSize;
    const y = item.gridY * tileSize;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (item.gridWidth ?? 1) * tileSize);
    maxY = Math.max(maxY, y + (item.gridHeight ?? 1) * tileSize);
  }

  return fitBoundsToViewport(
    { minX: minX - padding, minY: minY - padding, maxX: maxX + padding, maxY: maxY + padding },
    canvasWidth,
    canvasHeight,
  );
}
