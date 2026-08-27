// connection-lines.ts — pure math for connection routing, anchoring & hit-testing
// Pattern: hit-testing.ts, layout.ts, snap.ts — no React/store deps

import type { ZoneConnection, Zone } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import { HIT_RADIUS } from './hit-testing.js';

// ED-B-003: one-time dev warnings for missing zones on a connection. Keyed by
// "from::to" so importers leaving multiple dangling connections each surface
// once instead of flooding the console every render tick.
const _warnedDangling = new Set<string>();

/** Reset the dangling-connection warning cache. Exported for tests only. */
export function _resetDanglingConnectionWarnings(): void {
  _warnedDangling.clear();
}

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

  // If the target is the zone's own center, there's no direction to project —
  // return the center itself.
  if (dx === 0 && dy === 0) return { wx: cx, wy: cy };

  // Parametric ray intersection: find the smallest t that reaches a zone edge.
  // We check whichever axes have nonzero delta and pick the closer edge.
  const tX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const tY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);

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
  /** Pre-built zone lookup map. When omitted the function builds one internally. */
  zoneMap?: Map<string, Zone>,
): ConnectionEndpoints | null {
  const lookup = zoneMap ?? new Map(zones.map((z) => [z.id, z]));
  const fromZone = lookup.get(conn.fromZoneId);
  const toZone = lookup.get(conn.toZoneId);
  if (!fromZone || !toZone) {
    // ED-B-003: surface the reason this connection will not render. The user
    // saw it in the Connections list but the line is missing on the canvas
    // because one endpoint zone was deleted (or never imported).
    const key = `${conn.fromZoneId}::${conn.toZoneId}`;
    if (!_warnedDangling.has(key)) {
      const missing = !fromZone && !toZone
        ? `${conn.fromZoneId} and ${conn.toZoneId}`
        : (!fromZone ? conn.fromZoneId : conn.toZoneId);
      console.warn(
        `[connection-lines] Connection ${key} will not render — zone "${missing}" is missing. ` +
        'Check the Dependency panel to remove or re-link this connection.',
      );
      _warnedDangling.add(key);
    }
    return null;
  }

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
  zoneMap?: Map<string, Zone>,
): boolean {
  const endpoints = getConnectionEndpoints(conn, zones, tileSize, undefined, zoneMap);
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
  zoneMap?: Map<string, Zone>,
): ConnectionKey | null {
  const lookup = zoneMap ?? new Map(zones.map((z) => [z.id, z]));
  for (const conn of connections) {
    if (hitTestConnection(screenX, screenY, conn, zones, tileSize, viewport, lookup)) {
      return { from: conn.fromZoneId, to: conn.toZoneId };
    }
  }
  return null;
}

// ── Kind styles ─────────────────────────────────────────────────

/** Visual style for a connection kind. */
export interface KindStyle {
  color: string;
  hoverColor: string;
  dash: number[] | null;
}

export const CONNECTION_KIND_STYLES: Record<string, KindStyle> = {
  // F-95e5bb3f: solid (not alpha-washed) tokens, ≥3:1 on the canvas well.
  // Secret stays dashed rather than transparent.
  passage:  { color: 'var(--wf-conn-passage)', hoverColor: 'var(--wf-conn-passage)', dash: null },
  door:     { color: 'var(--wf-conn-door)',    hoverColor: 'var(--wf-conn-door)',    dash: null },
  stairs:   { color: 'var(--wf-conn-stairs)',  hoverColor: 'var(--wf-conn-stairs)',  dash: [4, 2, 2, 2] },
  road:     { color: 'var(--wf-conn-road)',    hoverColor: 'var(--wf-conn-road)',    dash: null },
  portal:   { color: 'var(--wf-conn-portal)',  hoverColor: 'var(--wf-conn-portal)',  dash: null },
  secret:   { color: 'var(--wf-conn-secret)',  hoverColor: 'var(--wf-conn-secret)',  dash: [3, 5] },
  hazard:   { color: 'var(--wf-conn-hazard)',  hoverColor: 'var(--wf-conn-hazard)',  dash: null },
  channel:  { color: 'var(--wf-conn-channel)', hoverColor: 'var(--wf-conn-channel)', dash: null },
  route:    { color: 'var(--wf-conn-route)',   hoverColor: 'var(--wf-conn-route)',   dash: [6, 3] },
  docking:  { color: 'var(--wf-conn-docking)', hoverColor: 'var(--wf-conn-docking)', dash: [3, 2] },
  warp:     { color: 'var(--wf-conn-warp)',    hoverColor: 'var(--wf-conn-warp)',    dash: [2, 4, 2, 4] },
  trail:    { color: 'var(--wf-conn-trail)',   hoverColor: 'var(--wf-conn-trail)',   dash: [4, 3] },
};

/** Get the visual style for a connection kind, defaulting to passage. */
export function getKindStyle(kind?: string): KindStyle {
  return CONNECTION_KIND_STYLES[kind ?? 'passage'] ?? CONNECTION_KIND_STYLES.passage;
}

// ── Midpoint ────────────────────────────────────────────────────

/** Compute the world-pixel midpoint of connection endpoints. */
export function connectionMidpoint(ep: ConnectionEndpoints): { mx: number; my: number } {
  return { mx: (ep.fx + ep.tx) / 2, my: (ep.fy + ep.ty) / 2 };
}

// ── Display helpers ─────────────────────────────────────────────

/** Format a connection as a display label. */
export function connectionLabel(conn: ZoneConnection, zones: Zone[]): string {
  const from = zones.find((z) => z.id === conn.fromZoneId);
  const to = zones.find((z) => z.id === conn.toZoneId);
  const arrow = conn.bidirectional ? ' \u2194 ' : ' \u2192 ';
  const prefix = conn.kind && conn.kind !== 'passage' ? `[${conn.kind}] ` : '';
  return `${prefix}${from?.name ?? conn.fromZoneId}${arrow}${to?.name ?? conn.toZoneId}`;
}
