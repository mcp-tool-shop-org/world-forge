// hit-testing.ts — pure coordinate math for finding objects under a point or within a rectangle

import type { WorldProject } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import type { SelectionSet } from './store/editor-store.js';
import { findConnectionAt } from './connection-lines.js';

export interface HitResult {
  type: 'zone' | 'entity' | 'landmark' | 'spawn' | 'encounter' | 'connection';
  id: string;
}

export interface ScreenRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface VisibilityFlags {
  showEntities: boolean;
  showLandmarks: boolean;
  showSpawns: boolean;
  showConnections: boolean;
}

/** Screen-space pixel radius for point-object hit detection (entities, landmarks, spawns). */
export const HIT_RADIUS = 8;

// ── Coordinate helpers ──────────────────────────────────────────

function screenToWorld(screenX: number, screenY: number, viewport: ViewportState) {
  return {
    worldX: screenX / viewport.zoom + viewport.panX,
    worldY: screenY / viewport.zoom + viewport.panY,
  };
}

function worldToScreen(worldX: number, worldY: number, viewport: ViewportState) {
  return {
    screenX: (worldX - viewport.panX) * viewport.zoom,
    screenY: (worldY - viewport.panY) * viewport.zoom,
  };
}

function screenDist(sx1: number, sy1: number, sx2: number, sy2: number): number {
  const dx = sx1 - sx2;
  const dy = sy1 - sy2;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── findHitAt ───────────────────────────────────────────────────

/**
 * Find the topmost object at a screen-space point.
 *
 * Priority order (reverse draw order — topmost rendered last = checked first):
 *   1. Spawns  2. Encounters  3. Landmarks  4. Entities  5. Connections  6. Zones
 */
export function findHitAt(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  project: WorldProject,
  tileSize: number,
  visibility: VisibilityFlags,
): HitResult | null {
  // 1. Spawns
  if (visibility.showSpawns) {
    for (const sp of project.spawnPoints) {
      const wx = sp.gridX * tileSize;
      const wy = sp.gridY * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        return { type: 'spawn', id: sp.id };
      }
    }
  }

  // 2. Encounters (zone-anchored at zone center)
  for (const enc of project.encounterAnchors) {
    const zone = project.zones.find((z) => z.id === enc.zoneId);
    if (!zone) continue;
    const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
    const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
    const { screenX: sx, screenY: sy } = worldToScreen(cx, cy, viewport);
    if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
      return { type: 'encounter', id: enc.id };
    }
  }

  // 3. Landmarks
  if (visibility.showLandmarks) {
    for (const lm of project.landmarks) {
      const zone = project.zones.find((z) => z.id === lm.zoneId);
      if (!zone) continue;
      const wx = lm.gridX * tileSize;
      const wy = lm.gridY * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        return { type: 'landmark', id: lm.id };
      }
    }
  }

  // 4. Entities
  if (visibility.showEntities) {
    for (const ep of project.entityPlacements) {
      const zone = project.zones.find((z) => z.id === ep.zoneId);
      if (!zone) continue;
      const wx = (ep.gridX ?? zone.gridX + 2) * tileSize;
      const wy = (ep.gridY ?? zone.gridY + 2) * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        return { type: 'entity', id: ep.entityId };
      }
    }
  }

  // 5. Connections (line segment proximity)
  if (visibility.showConnections) {
    const connKey = findConnectionAt(screenX, screenY, project.connections, project.zones, tileSize, viewport);
    if (connKey) {
      return { type: 'connection', id: `${connKey.from}::${connKey.to}` };
    }
  }

  // 6. Zones (grid containment)
  const { worldX, worldY } = screenToWorld(screenX, screenY, viewport);
  const gx = Math.floor(worldX / tileSize);
  const gy = Math.floor(worldY / tileSize);
  for (const zone of project.zones) {
    if (
      gx >= zone.gridX &&
      gx < zone.gridX + zone.gridWidth &&
      gy >= zone.gridY &&
      gy < zone.gridY + zone.gridHeight
    ) {
      return { type: 'zone', id: zone.id };
    }
  }

  return null;
}

// ── findAllInRect ───────────────────────────────────────────────

/**
 * Find all objects whose rendered center falls within a screen-space rectangle.
 * Used for box-select / marquee selection.
 */
export function findAllInRect(
  rect: ScreenRect,
  viewport: ViewportState,
  project: WorldProject,
  tileSize: number,
  visibility: VisibilityFlags,
): SelectionSet {
  // Normalize rect (handle inverted coords)
  const minX = Math.min(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxX = Math.max(rect.x1, rect.x2);
  const maxY = Math.max(rect.y1, rect.y2);

  const zones: string[] = [];
  const entities: string[] = [];
  const landmarks: string[] = [];
  const spawns: string[] = [];

  function inRect(sx: number, sy: number): boolean {
    return sx >= minX && sx <= maxX && sy >= minY && sy <= maxY;
  }

  // Zones — center of zone rect (always checked, not gated by visibility)
  for (const zone of project.zones) {
    const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
    const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
    const { screenX, screenY } = worldToScreen(cx, cy, viewport);
    if (inRect(screenX, screenY)) {
      zones.push(zone.id);
    }
  }

  // Entities
  if (visibility.showEntities) {
    for (const ep of project.entityPlacements) {
      const zone = project.zones.find((z) => z.id === ep.zoneId);
      if (!zone) continue;
      const wx = (ep.gridX ?? zone.gridX + 2) * tileSize;
      const wy = (ep.gridY ?? zone.gridY + 2) * tileSize;
      const { screenX, screenY } = worldToScreen(wx, wy, viewport);
      if (inRect(screenX, screenY)) {
        entities.push(ep.entityId);
      }
    }
  }

  // Landmarks
  if (visibility.showLandmarks) {
    for (const lm of project.landmarks) {
      const zone = project.zones.find((z) => z.id === lm.zoneId);
      if (!zone) continue;
      const wx = lm.gridX * tileSize;
      const wy = lm.gridY * tileSize;
      const { screenX, screenY } = worldToScreen(wx, wy, viewport);
      if (inRect(screenX, screenY)) {
        landmarks.push(lm.id);
      }
    }
  }

  // Spawns
  if (visibility.showSpawns) {
    for (const sp of project.spawnPoints) {
      const wx = sp.gridX * tileSize;
      const wy = sp.gridY * tileSize;
      const { screenX, screenY } = worldToScreen(wx, wy, viewport);
      if (inRect(screenX, screenY)) {
        spawns.push(sp.id);
      }
    }
  }

  // Encounters — zone-anchored at zone center
  const encounters: string[] = [];
  for (const enc of project.encounterAnchors) {
    const zone = project.zones.find((z) => z.id === enc.zoneId);
    if (!zone) continue;
    const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
    const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
    const { screenX, screenY } = worldToScreen(cx, cy, viewport);
    if (inRect(screenX, screenY)) {
      encounters.push(enc.id);
    }
  }

  return { zones, entities, landmarks, spawns, encounters };
}

// ── findAllHitsAt ─────────────────────────────────────────────

/**
 * Find ALL objects at a screen-space point, in priority order.
 * Used for click-cycle disambiguation on dense maps.
 */
export function findAllHitsAt(
  screenX: number,
  screenY: number,
  viewport: ViewportState,
  project: WorldProject,
  tileSize: number,
  visibility: VisibilityFlags,
): HitResult[] {
  const hits: HitResult[] = [];

  // Spawns
  if (visibility.showSpawns) {
    for (const sp of project.spawnPoints) {
      const wx = sp.gridX * tileSize;
      const wy = sp.gridY * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        hits.push({ type: 'spawn', id: sp.id });
      }
    }
  }

  // Encounters
  for (const enc of project.encounterAnchors) {
    const zone = project.zones.find((z) => z.id === enc.zoneId);
    if (!zone) continue;
    const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
    const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
    const { screenX: sx, screenY: sy } = worldToScreen(cx, cy, viewport);
    if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
      hits.push({ type: 'encounter', id: enc.id });
    }
  }

  // Landmarks
  if (visibility.showLandmarks) {
    for (const lm of project.landmarks) {
      const zone = project.zones.find((z) => z.id === lm.zoneId);
      if (!zone) continue;
      const wx = lm.gridX * tileSize;
      const wy = lm.gridY * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        hits.push({ type: 'landmark', id: lm.id });
      }
    }
  }

  // Entities
  if (visibility.showEntities) {
    for (const ep of project.entityPlacements) {
      const zone = project.zones.find((z) => z.id === ep.zoneId);
      if (!zone) continue;
      const wx = (ep.gridX ?? zone.gridX + 2) * tileSize;
      const wy = (ep.gridY ?? zone.gridY + 2) * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        hits.push({ type: 'entity', id: ep.entityId });
      }
    }
  }

  // Connections
  if (visibility.showConnections) {
    const connKey = findConnectionAt(screenX, screenY, project.connections, project.zones, tileSize, viewport);
    if (connKey) {
      hits.push({ type: 'connection', id: `${connKey.from}::${connKey.to}` });
    }
  }

  // Zones
  const { worldX, worldY } = screenToWorld(screenX, screenY, viewport);
  const gx = Math.floor(worldX / tileSize);
  const gy = Math.floor(worldY / tileSize);
  for (const zone of project.zones) {
    if (gx >= zone.gridX && gx < zone.gridX + zone.gridWidth &&
        gy >= zone.gridY && gy < zone.gridY + zone.gridHeight) {
      hits.push({ type: 'zone', id: zone.id });
    }
  }

  return hits;
}
