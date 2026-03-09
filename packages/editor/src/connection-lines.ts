// connection-lines.ts — pure math for connection routing, anchoring & hit-testing
// Pattern: hit-testing.ts, layout.ts, snap.ts — no React/store deps

import type { ZoneConnection, Zone } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import { HIT_RADIUS } from './hit-testing.js';

/** Edge-anchored connection endpoints in world pixels. */
export interface ConnectionEndpoints {
  fx: number; fy: number;  // from zone edge anchor
  tx: number; ty: number;  // to zone edge anchor
}

/** Composite key for identifying a connection. */
export interface ConnectionKey {
  from: string;
  to: string;
}

/** Zone geometry used for anchor computation. */
type ZoneRect = { gridX: number; gridY: number; gridWidth: number; gridHeight: number };

// ── Coordinate helpers ──────────────────────────────────────────

function worldToScreen(wx: number, wy: number, vp: ViewportState) {
  return { sx: (wx - vp.panX) * vp.zoom, sy: (wy - vp.panY) * vp.zoom };
}

// ── Edge anchor ─────────────────────────────────────────────────

/**
 * Compute where a line from zone center toward (targetWX, targetWY)
 * exits the zone rectangle. Returns world-pixel coordinates.
 */
export function getEdgeAnchor(
  zone: ZoneRect,
  targetWX: number,
  targetWY: number,
  tileSize: number,
): { wx: number; wy: number } {
  const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
  const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
  const hw = (zone.gridWidth / 2) * tileSize;
  const hh = (zone.gridHeight / 2) * tileSize;

  const dx = targetWX - cx;
  const dy = targetWY - cy;

  // Degenerate: same center
  if (dx === 0 && dy === 0) return { wx: cx, wy: cy };

  // Parametric intersection with each edge, take smallest positive t
  let t = Infinity;
  if (dx !== 0) {
    const t1 = hw / Math.abs(dx);   // right or left edge
    if (t1 < t) t = t1;
  }
  if (dy !== 0) {
    const t2 = hh / Math.abs(dy);   // bottom or top edge
    if (t2 < t) t = t2;
  }

  return { wx: cx + dx * t, wy: cy + dy * t };
}

// ── Connection endpoints ────────────────────────────────────────

/**
 * Resolve a connection to edge-anchored world-pixel endpoints.
 * Optional zoneOverrides map for drag/resize preview geometry.
 * Returns null if either zone is missing.
 */
export function getConnectionEndpoints(
  conn: ZoneConnection,
  zones: Zone[],
  tileSize: number,
  zoneOverrides?: Map<string, ZoneRect>,
): ConnectionEndpoints | null {
  const fromZone = zones.find((z) => z.id === conn.fromZoneId);
  const toZone = zones.find((z) => z.id === conn.toZoneId);
  if (!fromZone || !toZone) return null;

  const fRect = zoneOverrides?.get(conn.fromZoneId) ?? fromZone;
  const tRect = zoneOverrides?.get(conn.toZoneId) ?? toZone;

  // Target centers for anchor computation
  const tCX = (tRect.gridX + tRect.gridWidth / 2) * tileSize;
  const tCY = (tRect.gridY + tRect.gridHeight / 2) * tileSize;
  const fCX = (fRect.gridX + fRect.gridWidth / 2) * tileSize;
  const fCY = (fRect.gridY + fRect.gridHeight / 2) * tileSize;

  const fAnchor = getEdgeAnchor(fRect, tCX, tCY, tileSize);
  const tAnchor = getEdgeAnchor(tRect, fCX, fCY, tileSize);

  return { fx: fAnchor.wx, fy: fAnchor.wy, tx: tAnchor.wx, ty: tAnchor.wy };
}

// ── Point-to-segment distance ───────────────────────────────────

/** Perpendicular distance from point (px,py) to line segment (ax,ay)-(bx,by). */
export function pointToSegmentDist(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;

  // Degenerate: zero-length segment
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);

  // Project point onto line, clamp to segment
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const projX = ax + t * abx;
  const projY = ay + t * aby;

  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2);
}

// ── Hit testing ─────────────────────────────────────────────────

/** Check if a screen point is within HIT_RADIUS of a connection line. */
export function hitTestConnection(
  screenX: number,
  screenY: number,
  conn: ZoneConnection,
  zones: Zone[],
  tileSize: number,
  viewport: ViewportState,
): boolean {
  const endpoints = getConnectionEndpoints(conn, zones, tileSize);
  if (!endpoints) return false;

  const { sx: sfx, sy: sfy } = worldToScreen(endpoints.fx, endpoints.fy, viewport);
  const { sx: stx, sy: sty } = worldToScreen(endpoints.tx, endpoints.ty, viewport);

  return pointToSegmentDist(screenX, screenY, sfx, sfy, stx, sty) < HIT_RADIUS;
}

/** Find the first connection at a screen point (within HIT_RADIUS). */
export function findConnectionAt(
  screenX: number,
  screenY: number,
  connections: ZoneConnection[],
  zones: Zone[],
  tileSize: number,
  viewport: ViewportState,
): ConnectionKey | null {
  for (const conn of connections) {
    if (hitTestConnection(screenX, screenY, conn, zones, tileSize, viewport)) {
      return { from: conn.fromZoneId, to: conn.toZoneId };
    }
  }
  return null;
}

// ── Display helpers ─────────────────────────────────────────────

/** Format a connection as a display label. */
export function connectionLabel(conn: ZoneConnection, zones: Zone[]): string {
  const from = zones.find((z) => z.id === conn.fromZoneId);
  const to = zones.find((z) => z.id === conn.toZoneId);
  const arrow = conn.bidirectional ? ' \u2194 ' : ' \u2192 ';
  return `${from?.name ?? conn.fromZoneId}${arrow}${to?.name ?? conn.toZoneId}`;
}
