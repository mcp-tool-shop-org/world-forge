// hit-testing.ts — pure coordinate math for finding objects under a point or within a rectangle

import type { WorldProject } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import type { SelectionSet } from './store/editor-store.js';
import { findConnectionAt } from './connection-lines.js';
import { collectTownMarkers, type TownMarker } from './town-markers.js';

export interface HitResult {
  type: 'zone' | 'entity' | 'landmark' | 'spawn' | 'encounter' | 'connection'
    | 'item' | 'market' | 'building' | 'hub' | 'stronghold' | 'station';
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
  /** F-5515c044: town markers. Default true when omitted. */
  showTown?: boolean;
  /** F-df71e70a: item placements. Default true when omitted. */
  showItems?: boolean;
}

/** Screen-space pixel radius for point-object hit detection (entities, landmarks, spawns). */
export const HIT_RADIUS = 8;

/**
 * ED-B-002: one-time console notice so a developer or power-user notices the
 * orphan state the first time hit-testing encounters it. The Object List panel
 * is the primary UX surface for repair; this log just leaves a breadcrumb.
 */
let _warnedOrphanedEncounter = false;

/** Reset the orphaned-encounter warning latch. Exported for tests only. */
export function _resetOrphanedEncounterWarning(): void {
  _warnedOrphanedEncounter = false;
}

// ── Coordinate helpers ──────────────────────────────────────────

/** Build a zone lookup map — O(n) once, O(1) per lookup. */
function buildZoneMap(zones: WorldProject['zones']): Map<string, WorldProject['zones'][number]> {
  const map = new Map<string, WorldProject['zones'][number]>();
  for (const z of zones) map.set(z.id, z);
  return map;
}

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

function townMarkerHitsScreen(m: TownMarker, screenX: number, screenY: number, viewport: ViewportState): boolean {
  if (m.w != null && m.h != null) {
    const a = worldToScreen(m.x, m.y, viewport);
    const b = worldToScreen(m.x + m.w, m.y + m.h, viewport);
    const minX = Math.min(a.screenX, b.screenX);
    const maxX = Math.max(a.screenX, b.screenX);
    const minY = Math.min(a.screenY, b.screenY);
    const maxY = Math.max(a.screenY, b.screenY);
    return screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
  }
  const { screenX: sx, screenY: sy } = worldToScreen(m.x, m.y, viewport);
  return screenDist(screenX, screenY, sx, sy) < HIT_RADIUS;
}

function itemWorldPos(
  ip: WorldProject['itemPlacements'][number],
  zone: WorldProject['zones'][number],
  tileSize: number,
): { wx: number; wy: number } {
  return {
    wx: (ip.gridX ?? zone.gridX + 2) * tileSize,
    wy: (ip.gridY ?? zone.gridY + 2) * tileSize,
  };
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
  const zoneMap = buildZoneMap(project.zones);

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
  // Note: Encounters are always hit-testable regardless of visibility flags.
  // VisibilityFlags does not include showEncounters because encounters are
  // considered structural (tied to zone identity) rather than decorative.
  // If a showEncounters toggle is added to VisibilityFlags in the future,
  // gate this block the same way spawns/landmarks/entities are gated.
  for (const enc of project.encounterAnchors) {
    const zone = zoneMap.get(enc.zoneId);
    if (!zone) {
      // ED-B-002: orphaned encounter — zone was deleted. We can't hit-test
      // against a zone that doesn't exist, but we warn once so the user has a
      // breadcrumb pointing at the Object List "Orphaned" group for repair.
      if (!_warnedOrphanedEncounter) {
        console.warn(
          `[hit-testing] Encounter "${enc.id}" references missing zone "${enc.zoneId}". ` +
          'Open the Object List panel — orphaned encounters are grouped there for reassignment or deletion.',
        );
        _warnedOrphanedEncounter = true;
      }
      continue;
    }
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
      const zone = zoneMap.get(lm.zoneId);
      if (!zone) continue;
      const wx = lm.gridX * tileSize;
      const wy = lm.gridY * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        return { type: 'landmark', id: lm.id };
      }
    }
  }

  // 4. Items
  if (visibility.showItems !== false) {
    for (const ip of project.itemPlacements ?? []) {
      const zone = zoneMap.get(ip.zoneId);
      if (!zone) continue;
      const { wx, wy } = itemWorldPos(ip, zone, tileSize);
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        return { type: 'item', id: ip.itemId };
      }
    }
  }

  // 5. Town markers (markets, stations, hubs, strongholds, buildings)
  if (visibility.showTown !== false) {
    const markers = collectTownMarkers(project, tileSize);
    for (let i = markers.length - 1; i >= 0; i--) {
      const m = markers[i];
      if (townMarkerHitsScreen(m, screenX, screenY, viewport)) {
        return { type: m.type, id: m.id };
      }
    }
  }

  // 6. Entities
  if (visibility.showEntities) {
    for (const ep of project.entityPlacements) {
      const zone = zoneMap.get(ep.zoneId);
      if (!zone) continue;
      const wx = (ep.gridX ?? zone.gridX + 2) * tileSize;
      const wy = (ep.gridY ?? zone.gridY + 2) * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        return { type: 'entity', id: ep.entityId };
      }
    }
  }

  // 7. Connections (line segment proximity)
  if (visibility.showConnections) {
    const connKey = findConnectionAt(screenX, screenY, project.connections, project.zones, tileSize, viewport, zoneMap);
    if (connKey) {
      return { type: 'connection', id: `${connKey.from}::${connKey.to}` };
    }
  }

  // 8. Zones (grid containment)
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
  const zoneMap = buildZoneMap(project.zones);

  // Normalize rect (handle inverted coords)
  const minX = Math.min(rect.x1, rect.x2);
  const minY = Math.min(rect.y1, rect.y2);
  const maxX = Math.max(rect.x1, rect.x2);
  const maxY = Math.max(rect.y1, rect.y2);

  const zones: string[] = [];
  const entities: string[] = [];
  const landmarks: string[] = [];
  const spawns: string[] = [];
  const items: string[] = [];
  const markets: string[] = [];
  const stations: string[] = [];
  const buildings: string[] = [];
  const hubs: string[] = [];
  const strongholds: string[] = [];

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
      const zone = zoneMap.get(ep.zoneId);
      if (!zone) continue;
      // ED-A-001 / F-1af6c905: parenthesize the fallback so it matches
      // findHitAt / findAllHitsAt / Canvas.tsx's renderer exactly — use the
      // entity's explicit position as-is when it has one, and only add the
      // +2 fallback offset when it doesn't. The previous `(ep.gridX ?? zone.gridX) + 2`
      // added +2 even when gridX was explicitly set, checking 2 grid cells
      // away from where the entity is actually rendered and click-hit-tested.
      const wx = (ep.gridX ?? (zone.gridX + 2)) * tileSize;
      const wy = (ep.gridY ?? (zone.gridY + 2)) * tileSize;
      const { screenX, screenY } = worldToScreen(wx, wy, viewport);
      if (inRect(screenX, screenY)) {
        entities.push(ep.entityId);
      }
    }
  }

  // Landmarks
  if (visibility.showLandmarks) {
    for (const lm of project.landmarks) {
      const zone = zoneMap.get(lm.zoneId);
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

  // Encounters — zone-anchored at zone center (always visible; see findHitAt comment)
  const encounters: string[] = [];
  for (const enc of project.encounterAnchors) {
    const zone = zoneMap.get(enc.zoneId);
    if (!zone) continue;
    const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
    const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
    const { screenX, screenY } = worldToScreen(cx, cy, viewport);
    if (inRect(screenX, screenY)) {
      encounters.push(enc.id);
    }
  }

  if (visibility.showItems !== false) {
    for (const ip of project.itemPlacements ?? []) {
      const zone = zoneMap.get(ip.zoneId);
      if (!zone) continue;
      const { wx, wy } = itemWorldPos(ip, zone, tileSize);
      const { screenX, screenY } = worldToScreen(wx, wy, viewport);
      if (inRect(screenX, screenY)) items.push(ip.itemId);
    }
  }

  if (visibility.showTown !== false) {
    for (const m of collectTownMarkers(project, tileSize)) {
      const cx = m.w != null ? m.x + m.w / 2 : m.x;
      const cy = m.h != null ? m.y + m.h / 2 : m.y;
      const { screenX, screenY } = worldToScreen(cx, cy, viewport);
      if (!inRect(screenX, screenY)) continue;
      if (m.type === 'market') markets.push(m.id);
      else if (m.type === 'station') stations.push(m.id);
      else if (m.type === 'building') buildings.push(m.id);
      else if (m.type === 'hub') hubs.push(m.id);
      else strongholds.push(m.id);
    }
  }

  return { zones, entities, landmarks, spawns, encounters, items, markets, stations, buildings, hubs, strongholds };
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
  const zoneMap = buildZoneMap(project.zones);
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

  // Encounters (always visible; see findHitAt comment)
  for (const enc of project.encounterAnchors) {
    const zone = zoneMap.get(enc.zoneId);
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
      const zone = zoneMap.get(lm.zoneId);
      if (!zone) continue;
      const wx = lm.gridX * tileSize;
      const wy = lm.gridY * tileSize;
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        hits.push({ type: 'landmark', id: lm.id });
      }
    }
  }

  // Items
  if (visibility.showItems !== false) {
    for (const ip of project.itemPlacements ?? []) {
      const zone = zoneMap.get(ip.zoneId);
      if (!zone) continue;
      const { wx, wy } = itemWorldPos(ip, zone, tileSize);
      const { screenX: sx, screenY: sy } = worldToScreen(wx, wy, viewport);
      if (screenDist(screenX, screenY, sx, sy) < HIT_RADIUS) {
        hits.push({ type: 'item', id: ip.itemId });
      }
    }
  }

  // Town markers
  if (visibility.showTown !== false) {
    for (const m of collectTownMarkers(project, tileSize)) {
      if (townMarkerHitsScreen(m, screenX, screenY, viewport)) {
        hits.push({ type: m.type, id: m.id });
      }
    }
  }

  // Entities
  if (visibility.showEntities) {
    for (const ep of project.entityPlacements) {
      const zone = zoneMap.get(ep.zoneId);
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
    const connKey = findConnectionAt(screenX, screenY, project.connections, project.zones, tileSize, viewport, zoneMap);
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
