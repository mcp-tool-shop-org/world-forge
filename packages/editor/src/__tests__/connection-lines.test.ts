import { describe, it, expect } from 'vitest';
import {
  getEdgeAnchor,
  getConnectionEndpoints,
  pointToSegmentDist,
  hitTestConnection,
  findConnectionAt,
  connectionLabel,
  getKindStyle,
  connectionMidpoint,
  CONNECTION_KIND_STYLES,
} from '../connection-lines.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import type { Zone, ZoneConnection } from '@world-forge/schema';

const chapel = structuredClone(SAMPLE_WORLDS[2].project); // Chapel Threshold
const TILE = 32;
const zones = chapel.zones;
const connections = chapel.connections;

// Chapel zones reference:
//   chapel-entrance: grid(10,10) 8x6  → center world (448, 416)
//   chapel-nave:     grid(10,20) 10x8 → center world (480, 768)
//   chapel-alcove:   grid(22,22) 5x4  → center world (784, 768)
//   vestry-door:     grid(4,22)  4x4  → center world (192, 768)
//   crypt-chamber:   grid(30,25) 10x8 → center world (1120, 928)

describe('getEdgeAnchor', () => {
  const entrance = { gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6 };

  it('exits east edge when target is directly right', () => {
    // Target at (1000, 416) — far right, same Y as center
    const { wx, wy } = getEdgeAnchor(entrance, 1000, 416, TILE);
    expect(wx).toBe(18 * TILE); // right edge = (10+8)*32 = 576
    expect(wy).toBe(416); // same Y as center
  });

  it('exits south edge when target is directly below', () => {
    const { wx, wy } = getEdgeAnchor(entrance, 448, 1000, TILE);
    expect(wx).toBe(448); // same X as center
    expect(wy).toBe(16 * TILE); // bottom edge = (10+6)*32 = 512
  });

  it('exits diagonally (NW corner direction)', () => {
    // Target at (0, 0) — northwest
    const { wx, wy } = getEdgeAnchor(entrance, 0, 0, TILE);
    // Should exit through left or top edge depending on aspect ratio
    expect(wx).toBeLessThan(448); // left of center
    expect(wy).toBeLessThan(416); // above center
  });

  it('returns center for degenerate same-center case', () => {
    const cx = (entrance.gridX + entrance.gridWidth / 2) * TILE;
    const cy = (entrance.gridY + entrance.gridHeight / 2) * TILE;
    const { wx, wy } = getEdgeAnchor(entrance, cx, cy, TILE);
    expect(wx).toBe(cx);
    expect(wy).toBe(cy);
  });
});

describe('getConnectionEndpoints', () => {
  it('resolves chapel entrance-to-nave connection', () => {
    const conn = connections.find((c) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave');
    expect(conn).toBeDefined();
    const ep = getConnectionEndpoints(conn!, zones, TILE);
    expect(ep).not.toBeNull();
    // From endpoint should be on entrance's bottom edge (toward nave below)
    expect(ep!.fy).toBe(16 * TILE); // bottom of entrance = (10+6)*32 = 512
    // To endpoint should be on nave's top edge (toward entrance above)
    expect(ep!.ty).toBe(20 * TILE); // top of nave = 20*32 = 640
  });

  it('returns null for missing zone', () => {
    const fake: ZoneConnection = { fromZoneId: 'nonexistent', toZoneId: 'chapel-nave', bidirectional: true };
    expect(getConnectionEndpoints(fake, zones, TILE)).toBeNull();
  });

  it('uses zoneOverrides for preview geometry', () => {
    const conn = connections.find((c) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')!;
    const overrides = new Map([['chapel-entrance', { gridX: 10, gridY: 12, gridWidth: 8, gridHeight: 6 }]]);
    const ep = getConnectionEndpoints(conn, zones, TILE, overrides);
    expect(ep).not.toBeNull();
    // From Y should use override's bottom edge: (12+6)*32 = 576
    expect(ep!.fy).toBe(18 * TILE);
  });
});

describe('pointToSegmentDist', () => {
  it('perpendicular distance to horizontal segment', () => {
    // Segment (0,0)-(10,0), point at (5, 3) → distance = 3
    expect(pointToSegmentDist(5, 3, 0, 0, 10, 0)).toBe(3);
  });

  it('distance before segment start', () => {
    // Segment (2,0)-(10,0), point at (0, 0) → distance = 2
    expect(pointToSegmentDist(0, 0, 2, 0, 10, 0)).toBe(2);
  });

  it('distance past segment end', () => {
    // Segment (0,0)-(10,0), point at (13, 4) → distance to (10,0) = 5
    expect(pointToSegmentDist(13, 4, 0, 0, 10, 0)).toBe(5);
  });

  it('point on segment returns 0', () => {
    expect(pointToSegmentDist(5, 0, 0, 0, 10, 0)).toBe(0);
  });

  it('zero-length segment returns distance to point', () => {
    expect(pointToSegmentDist(3, 4, 0, 0, 0, 0)).toBe(5);
  });
});

describe('hitTestConnection', () => {
  const vp = { panX: 0, panY: 0, zoom: 1 };

  it('hits entrance-nave connection at midpoint', () => {
    const conn = connections.find((c) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')!;
    // Midpoint is roughly between entrance bottom (512) and nave top (640), X ~= 448-480
    // Use a point on the line between the two edge anchors
    const ep = getConnectionEndpoints(conn, zones, TILE)!;
    const mx = (ep.fx + ep.tx) / 2;
    const my = (ep.fy + ep.ty) / 2;
    expect(hitTestConnection(mx, my, conn, zones, TILE, vp)).toBe(true);
  });

  it('misses when far from any connection', () => {
    const conn = connections.find((c) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')!;
    // Far away from any line
    expect(hitTestConnection(0, 0, conn, zones, TILE, vp)).toBe(false);
  });
});

describe('findConnectionAt', () => {
  const vp = { panX: 0, panY: 0, zoom: 1 };

  it('finds connection at midpoint of entrance-nave line', () => {
    const conn = connections.find((c) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')!;
    const ep = getConnectionEndpoints(conn, zones, TILE)!;
    const mx = (ep.fx + ep.tx) / 2;
    const my = (ep.fy + ep.ty) / 2;
    const result = findConnectionAt(mx, my, connections, zones, TILE, vp);
    expect(result).not.toBeNull();
    expect(result!.from).toBe('chapel-entrance');
    expect(result!.to).toBe('chapel-nave');
  });

  it('returns null on miss', () => {
    const result = findConnectionAt(0, 0, connections, zones, TILE, vp);
    expect(result).toBeNull();
  });

  it('finds conditional connection', () => {
    const condConn = connections.find((c) => c.condition != null);
    expect(condConn).toBeDefined();
    const ep = getConnectionEndpoints(condConn!, zones, TILE)!;
    const mx = (ep.fx + ep.tx) / 2;
    const my = (ep.fy + ep.ty) / 2;
    const result = findConnectionAt(mx, my, connections, zones, TILE, vp);
    expect(result).not.toBeNull();
    expect(result!.from).toBe(condConn!.fromZoneId);
    expect(result!.to).toBe(condConn!.toZoneId);
  });
});

describe('connectionLabel', () => {
  it('formats bidirectional connection', () => {
    const conn = connections.find((c) => c.bidirectional)!;
    const label = connectionLabel(conn, zones);
    expect(label).toContain('\u2194'); // ↔
  });

  it('formats one-way connection', () => {
    const oneWay: ZoneConnection = { fromZoneId: 'chapel-entrance', toZoneId: 'chapel-nave', bidirectional: false };
    const label = connectionLabel(oneWay, zones);
    expect(label).toContain('\u2192'); // →
    expect(label).toContain('Chapel Entrance');
    expect(label).toContain('Chapel Nave');
  });

  it('falls back to IDs for missing zones', () => {
    const fake: ZoneConnection = { fromZoneId: 'nonexistent', toZoneId: 'also-missing', bidirectional: true };
    const label = connectionLabel(fake, zones);
    expect(label).toContain('nonexistent');
    expect(label).toContain('also-missing');
  });

  it('includes kind prefix for non-passage connections', () => {
    const conn: ZoneConnection = { fromZoneId: 'chapel-entrance', toZoneId: 'chapel-nave', bidirectional: true, kind: 'door' };
    const label = connectionLabel(conn, zones);
    expect(label).toMatch(/^\[door\] /);
    expect(label).toContain('Chapel Entrance');
  });

  it('omits kind prefix for passage connections', () => {
    const conn: ZoneConnection = { fromZoneId: 'chapel-entrance', toZoneId: 'chapel-nave', bidirectional: true, kind: 'passage' };
    const label = connectionLabel(conn, zones);
    expect(label).not.toContain('[passage]');
  });
});

describe('getKindStyle', () => {
  it.each(['passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard'] as const)('returns style for %s', (kind) => {
    const style = getKindStyle(kind);
    expect(style.color).toBeTruthy();
    expect(style.hoverColor).toBeTruthy();
  });

  it('defaults to passage for undefined', () => {
    const style = getKindStyle(undefined);
    expect(style).toEqual(CONNECTION_KIND_STYLES.passage);
  });

  it('defaults to passage for unknown kind', () => {
    const style = getKindStyle('teleporter');
    expect(style).toEqual(CONNECTION_KIND_STYLES.passage);
  });
});

describe('connectionMidpoint', () => {
  it('returns correct midpoint', () => {
    const { mx, my } = connectionMidpoint({ fx: 100, fy: 200, tx: 300, ty: 400 });
    expect(mx).toBe(200);
    expect(my).toBe(300);
  });
});
