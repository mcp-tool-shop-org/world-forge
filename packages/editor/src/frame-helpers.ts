// frame-helpers.ts — shared viewport framing utilities

import type { WorldProject } from '@world-forge/schema';
import { centerOnZone, frameBounds } from './viewport.js';
import type { ViewportState } from './viewport.js';

export interface FrameTarget {
  type: 'zone' | 'entity' | 'landmark' | 'spawn';
  id: string;
}

/**
 * Compute viewport state to frame a single object.
 * Returns null if the object cannot be found or canvas size is missing.
 */
export function computeFrameViewport(
  target: FrameTarget,
  project: WorldProject,
  canvasWidth: number,
  canvasHeight: number,
): ViewportState | null {
  const tileSize = project.map.tileSize;

  if (target.type === 'zone') {
    const zone = project.zones.find((z) => z.id === target.id);
    if (!zone) return null;
    return centerOnZone(zone, tileSize, canvasWidth, canvasHeight);
  }

  if (target.type === 'entity') {
    const ep = project.entityPlacements.find((e) => e.entityId === target.id);
    if (!ep) return null;
    const zone = project.zones.find((z) => z.id === ep.zoneId);
    return frameBounds(
      [{ gridX: ep.gridX ?? (zone ? zone.gridX + 2 : 0), gridY: ep.gridY ?? (zone ? zone.gridY + 2 : 0) }],
      tileSize, canvasWidth, canvasHeight,
    );
  }

  if (target.type === 'landmark') {
    const lm = project.landmarks.find((l) => l.id === target.id);
    if (!lm) return null;
    return frameBounds([{ gridX: lm.gridX, gridY: lm.gridY }], tileSize, canvasWidth, canvasHeight);
  }

  if (target.type === 'spawn') {
    const sp = project.spawnPoints.find((s) => s.id === target.id);
    if (!sp) return null;
    return frameBounds([{ gridX: sp.gridX, gridY: sp.gridY }], tileSize, canvasWidth, canvasHeight);
  }

  return null;
}

/** Helper to get canvas dimensions, returns null if canvas not found or zero-sized. */
export function getCanvasSize(): { cw: number; ch: number } | null {
  const canvas = document.querySelector('canvas');
  if (!canvas) return null;
  const cw = canvas.offsetWidth;
  const ch = canvas.offsetHeight;
  return cw > 0 && ch > 0 ? { cw, ch } : null;
}
