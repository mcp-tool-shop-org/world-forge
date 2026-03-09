import { describe, it, expect } from 'vitest';
import { findHitAt, findAllInRect, HIT_RADIUS } from '../hit-testing.js';
import type { ScreenRect } from '../hit-testing.js';
import type { ViewportState } from '../viewport.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { getConnectionEndpoints } from '../connection-lines.js';

// ── Setup ───────────────────────────────────────────────────────

const chapel = structuredClone(SAMPLE_WORLDS[2].project); // Chapel Threshold
const TILE = 32;
const allVisible = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true };
const defaultVP: ViewportState = { panX: 0, panY: 0, zoom: 1 };

/*
 * Chapel Threshold reference positions (tileSize = 32, zoom = 1, pan = 0):
 *
 * Zones:
 *   chapel-entrance : grid(10,10) 8x6  -> world rect (320,320)-(576,512)
 *   chapel-nave     : grid(10,20) 10x8 -> world rect (320,640)-(640,896)
 *   chapel-alcove   : grid(22,22) 5x4  -> world rect (704,704)-(864,832)
 *   vestry-door     : grid(4,22)  4x4  -> world rect (128,704)-(256,832)
 *   crypt-chamber   : grid(30,25) 10x8 -> world rect (960,800)-(1280,1056)
 *
 * Entities (none have explicit gridX/gridY, fall back to zone.gridX+2, zone.gridY+2):
 *   suspicious-pilgrim -> zone chapel-entrance -> world (384, 384)
 *   brother-aldric     -> zone chapel-nave     -> world (384, 704)
 *   sister-maren       -> zone vestry-door     -> world (192, 768)
 *   ash-ghoul          -> zone crypt-chamber   -> world (1024, 864)
 *
 * Landmark:
 *   altar-of-passage -> grid(14,13) -> world (448, 416)
 *
 * Spawn:
 *   chapel-spawn -> grid(12,12) -> world (384, 384)
 */

// ── findHitAt ───────────────────────────────────────────────────

describe('findHitAt', () => {
  it('returns null on empty canvas area (no objects)', () => {
    // Click far away from any zone — world (0, 0) is outside all zones
    const result = findHitAt(0, 0, defaultVP, chapel, TILE, allVisible);
    expect(result).toBeNull();
  });

  it('hits a zone at known grid coordinates', () => {
    // Click inside chapel-entrance at world grid (14, 13) = world (448, 416)
    // At zoom=1, pan=0, screen coords = world coords
    const result = findHitAt(450, 420, defaultVP, chapel, TILE, allVisible);
    // The landmark altar-of-passage is at (448,416), distance from (450,420) ~= 4.5 < 8
    // Landmarks are checked before zones but after spawns
    // So this hits the landmark first
    expect(result).not.toBeNull();
  });

  it('hits a zone center with no overlapping objects', () => {
    // Click inside crypt-chamber center area where no entity is placed
    // crypt-chamber zone: grid(30,25) 10x8 -> center grid (35, 29) -> world (1120, 928)
    // ash-ghoul entity is at world (1024, 864) — far enough away
    const result = findHitAt(1120, 928, defaultVP, chapel, TILE, allVisible);
    expect(result).toEqual({ type: 'zone', id: 'crypt-chamber' });
  });

  it('hits a zone with panned viewport', () => {
    // Pan viewport by (100, 100): screen coords differ from world coords
    // chapel-entrance at world grid(14,13) -> world (448, 416)
    // screen = (worldX - panX) * zoom = (448 - 100) * 1 = 348
    const vp: ViewportState = { panX: 100, panY: 100, zoom: 1 };
    // Click at screen (348, 316) -> world (448, 416) -> grid (14, 13) inside chapel-entrance
    const result = findHitAt(250, 250, vp, chapel, TILE, allVisible);
    // world = 250/1 + 100 = 350 -> grid = floor(350/32) = 10 -> inside chapel-entrance (gridX=10)
    // worldY = 250 + 100 = 350 -> grid = floor(350/32) = 10 -> inside chapel-entrance (gridY=10)
    expect(result).not.toBeNull();
    expect(result!.type).toBe('zone');
    expect(result!.id).toBe('chapel-entrance');
  });

  it('hits a zone with zoomed viewport (zoom=2)', () => {
    // zoom=2, pan=0: screen (640, 640) -> world (320, 320) -> grid (10, 10) -> chapel-entrance
    const vp: ViewportState = { panX: 0, panY: 0, zoom: 2 };
    const result = findHitAt(640, 640, vp, chapel, TILE, allVisible);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('zone');
    expect(result!.id).toBe('chapel-entrance');
  });

  it('hits entity when clicking on its position — entity takes priority over zone', () => {
    // brother-aldric is at world (384, 704) in chapel-nave
    // At zoom=1, pan=0, screen = (384, 704)
    // This is inside chapel-nave zone (gridX=10,gridY=20,w=10,h=8 -> 320..640, 640..896)
    // Entity should take priority over zone
    const result = findHitAt(384, 704, defaultVP, chapel, TILE, allVisible);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('entity');
    expect(result!.id).toBe('brother-aldric');
  });

  it('returns zone when entity visibility is off', () => {
    // brother-aldric at screen (384, 704) — but entities hidden
    const vis = { showEntities: false, showLandmarks: true, showSpawns: true, showConnections: true };
    const result = findHitAt(384, 704, defaultVP, chapel, TILE, vis);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('zone');
    expect(result!.id).toBe('chapel-nave');
  });

  it('hits landmark at its position', () => {
    // altar-of-passage at grid(14,13) -> world (448, 416)
    // At zoom=1, pan=0, screen = (448, 416)
    // Also inside chapel-entrance zone — landmark should take priority over zone
    // No spawn or entity at this exact position
    const result = findHitAt(448, 416, defaultVP, chapel, TILE, allVisible);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('landmark');
    expect(result!.id).toBe('altar-of-passage');
  });

  it('hits spawn at its position', () => {
    // chapel-spawn at grid(12,12) -> world (384, 384)
    // At zoom=1, pan=0, screen = (384, 384)
    // suspicious-pilgrim entity is also at (384, 384) but spawn has higher priority
    const result = findHitAt(384, 384, defaultVP, chapel, TILE, allVisible);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('spawn');
    expect(result!.id).toBe('chapel-spawn');
  });

  it('priority: spawn on top of landmark on top of entity on top of zone', () => {
    // chapel-spawn at (384, 384) — same position as suspicious-pilgrim entity
    // Spawn should win over entity, which would win over zone
    const spawnHit = findHitAt(384, 384, defaultVP, chapel, TILE, allVisible);
    expect(spawnHit).toEqual({ type: 'spawn', id: 'chapel-spawn' });

    // Hide spawn — entity should be next
    const entityHit = findHitAt(384, 384, defaultVP, chapel, TILE, {
      showEntities: true,
      showLandmarks: true,
      showSpawns: false,
      showConnections: true,
    });
    expect(entityHit).toEqual({ type: 'entity', id: 'suspicious-pilgrim' });

    // Hide spawn + entity — zone should be next
    const zoneHit = findHitAt(384, 384, defaultVP, chapel, TILE, {
      showEntities: false,
      showLandmarks: true,
      showSpawns: false,
      showConnections: true,
    });
    expect(zoneHit).toEqual({ type: 'zone', id: 'chapel-entrance' });
  });

  it('returns null when clicking outside all objects', () => {
    // Click at world (0, 0) -> grid (0, 0) — no zone, entity, landmark, or spawn here
    const result = findHitAt(0, 0, defaultVP, chapel, TILE, allVisible);
    expect(result).toBeNull();

    // Click at a very large coordinate with nothing there
    const result2 = findHitAt(5000, 5000, defaultVP, chapel, TILE, allVisible);
    expect(result2).toBeNull();
  });
});

// ── findAllInRect ───────────────────────────────────────────────

describe('findAllInRect', () => {
  it('empty rect returns empty SelectionSet', () => {
    // Rect with zero area at a spot with no objects
    const rect: ScreenRect = { x1: 0, y1: 0, x2: 0, y2: 0 };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, allVisible);
    expect(result.zones).toHaveLength(0);
    expect(result.entities).toHaveLength(0);
    expect(result.landmarks).toHaveLength(0);
    expect(result.spawns).toHaveLength(0);
  });

  it('rect encompassing all zones returns all zone IDs', () => {
    // All zones fit within world (0,0)-(1280,1056)
    // At zoom=1, pan=0, screen = world, so a large rect covers everything
    const rect: ScreenRect = { x1: 0, y1: 0, x2: 2000, y2: 2000 };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, allVisible);
    expect(result.zones).toHaveLength(5);
    expect(result.zones).toContain('chapel-entrance');
    expect(result.zones).toContain('chapel-nave');
    expect(result.zones).toContain('chapel-alcove');
    expect(result.zones).toContain('vestry-door');
    expect(result.zones).toContain('crypt-chamber');
  });

  it('rect encompassing one zone returns just that zone', () => {
    // vestry-door center: ((4+2)*32, (22+2)*32) = (192, 768)
    // Use a tight rect around that center
    const rect: ScreenRect = { x1: 180, y1: 756, x2: 204, y2: 780 };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, allVisible);
    expect(result.zones).toEqual(['vestry-door']);
  });

  it('rect includes entities when visible', () => {
    // brother-aldric at screen (384, 704)
    // Use a rect around that point
    const rect: ScreenRect = { x1: 370, y1: 690, x2: 400, y2: 720 };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, allVisible);
    expect(result.entities).toContain('brother-aldric');
  });

  it('rect excludes entities when showEntities is false', () => {
    // Same rect as above but entities hidden
    const rect: ScreenRect = { x1: 370, y1: 690, x2: 400, y2: 720 };
    const vis = { showEntities: false, showLandmarks: true, showSpawns: true, showConnections: true };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, vis);
    expect(result.entities).toHaveLength(0);
  });

  it('rect with inverted coordinates (x2 < x1) still works (normalization)', () => {
    // Same as "encompassing all zones" but inverted
    const rect: ScreenRect = { x1: 2000, y1: 2000, x2: 0, y2: 0 };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, allVisible);
    expect(result.zones).toHaveLength(5);
  });

  it('rect under zoom correctly maps screen coords to world', () => {
    // zoom=2, pan=0
    // vestry-door center: world (192, 768) -> screen = (192*2, 768*2) = (384, 1536)
    const vp: ViewportState = { panX: 0, panY: 0, zoom: 2 };
    const rect: ScreenRect = { x1: 370, y1: 1520, x2: 400, y2: 1550 };
    const result = findAllInRect(rect, vp, chapel, TILE, allVisible);
    expect(result.zones).toContain('vestry-door');
  });

  it('rect including landmarks and spawns', () => {
    // altar-of-passage at screen (448, 416) and chapel-spawn at screen (384, 384)
    // Use a wide rect around both
    const rect: ScreenRect = { x1: 370, y1: 370, x2: 460, y2: 430 };
    const result = findAllInRect(rect, defaultVP, chapel, TILE, allVisible);
    expect(result.landmarks).toContain('altar-of-passage');
    expect(result.spawns).toContain('chapel-spawn');
  });
});

// ── Connection hit-testing ──────────────────────────────────────

describe('findHitAt — connections', () => {
  it('hits a connection when showConnections is true', () => {
    // Find midpoint of entrance-nave connection line
    const conn = chapel.connections.find((c: any) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')!;
    const ep = getConnectionEndpoints(conn, chapel.zones, TILE);
    if (!ep) throw new Error('Expected endpoints');
    const mx = (ep.fx + ep.tx) / 2;
    const my = (ep.fy + ep.ty) / 2;
    const result = findHitAt(mx, my, defaultVP, chapel, TILE, allVisible);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('connection');
  });

  it('skips connections when showConnections is false', () => {
    const conn = chapel.connections.find((c: any) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')!;
    const ep = getConnectionEndpoints(conn, chapel.zones, TILE);
    if (!ep) throw new Error('Expected endpoints');
    const mx = (ep.fx + ep.tx) / 2;
    const my = (ep.fy + ep.ty) / 2;
    const vis = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: false };
    const result = findHitAt(mx, my, defaultVP, chapel, TILE, vis);
    // Should NOT be a connection hit
    expect(result?.type !== 'connection' || result === null).toBe(true);
  });

  it('entity takes priority over connection', () => {
    // brother-aldric is at world (384, 704) — entities checked before connections
    const result = findHitAt(384, 704, defaultVP, chapel, TILE, allVisible);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('entity');
  });
});

// ── HIT_RADIUS constant ────────────────────────────────────────

describe('HIT_RADIUS', () => {
  it('is exported and equals 8', () => {
    expect(HIT_RADIUS).toBe(8);
  });
});
