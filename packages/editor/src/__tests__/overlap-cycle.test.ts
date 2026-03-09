import { describe, it, expect } from 'vitest';
import { findAllHitsAt, HIT_RADIUS } from '../hit-testing.js';
import type { VisibilityFlags } from '../hit-testing.js';
import type { ViewportState } from '../viewport.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';

// ── Setup ───────────────────────────────────────────────────────

const chapel = structuredClone(SAMPLE_WORLDS[2].project); // Chapel Threshold
const TILE = 32;
const allVisible: VisibilityFlags = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true };
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

// ── findAllHitsAt ───────────────────────────────────────────────

describe('findAllHitsAt', () => {
  it('returns empty array when no objects at position', () => {
    // Click at world (0, 0) -> grid (0, 0) — outside all zones, no objects
    const hits = findAllHitsAt(0, 0, defaultVP, chapel, TILE, allVisible);
    expect(hits).toEqual([]);
  });

  it('returns single zone when only a zone is at position', () => {
    // Click inside crypt-chamber away from center (encounter anchor at center)
    // crypt-chamber zone: grid(30,25) 10x8 -> grid (38, 31) -> world (1216, 992)
    const hits = findAllHitsAt(1216, 992, defaultVP, chapel, TILE, allVisible);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toEqual({ type: 'zone', id: 'crypt-chamber' });
  });

  it('returns entity + zone when entity overlaps with zone (entity first due to priority)', () => {
    // brother-aldric at world (384, 704) inside chapel-nave
    // No spawn or landmark at this position
    const hits = findAllHitsAt(384, 704, defaultVP, chapel, TILE, allVisible);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    // Entity must come before zone in the results
    const entityIdx = hits.findIndex((h) => h.type === 'entity' && h.id === 'brother-aldric');
    const zoneIdx = hits.findIndex((h) => h.type === 'zone' && h.id === 'chapel-nave');
    expect(entityIdx).toBeGreaterThanOrEqual(0);
    expect(zoneIdx).toBeGreaterThanOrEqual(0);
    expect(entityIdx).toBeLessThan(zoneIdx);
  });

  it('returns spawn + zone when spawn overlaps with zone (spawn first)', () => {
    // chapel-spawn at grid(12,12) -> world (384, 384)
    // Also inside chapel-entrance zone (grid(10,10) 8x6 -> 320..576, 320..512)
    // suspicious-pilgrim entity also at (384, 384) — so spawn + entity + zone
    // But let's just verify spawn comes before zone
    const hits = findAllHitsAt(384, 384, defaultVP, chapel, TILE, allVisible);
    const spawnIdx = hits.findIndex((h) => h.type === 'spawn' && h.id === 'chapel-spawn');
    const zoneIdx = hits.findIndex((h) => h.type === 'zone' && h.id === 'chapel-entrance');
    expect(spawnIdx).toBeGreaterThanOrEqual(0);
    expect(zoneIdx).toBeGreaterThanOrEqual(0);
    expect(spawnIdx).toBeLessThan(zoneIdx);
  });

  it('returns spawn + entity + zone when all three overlap (spawn -> entity -> zone order)', () => {
    // chapel-spawn at (384, 384) and suspicious-pilgrim entity at (384, 384)
    // Both inside chapel-entrance zone
    const hits = findAllHitsAt(384, 384, defaultVP, chapel, TILE, allVisible);
    expect(hits.length).toBeGreaterThanOrEqual(3);

    const spawnIdx = hits.findIndex((h) => h.type === 'spawn' && h.id === 'chapel-spawn');
    const entityIdx = hits.findIndex((h) => h.type === 'entity' && h.id === 'suspicious-pilgrim');
    const zoneIdx = hits.findIndex((h) => h.type === 'zone' && h.id === 'chapel-entrance');

    expect(spawnIdx).toBeGreaterThanOrEqual(0);
    expect(entityIdx).toBeGreaterThanOrEqual(0);
    expect(zoneIdx).toBeGreaterThanOrEqual(0);

    // Priority order: spawn < entity < zone in index
    expect(spawnIdx).toBeLessThan(entityIdx);
    expect(entityIdx).toBeLessThan(zoneIdx);
  });

  it('visibility flags filter: hiding entities removes entity from results', () => {
    // brother-aldric at world (384, 704) inside chapel-nave
    const vis: VisibilityFlags = { showEntities: false, showLandmarks: true, showSpawns: true, showConnections: true };
    const hits = findAllHitsAt(384, 704, defaultVP, chapel, TILE, vis);
    // Should NOT contain the entity
    const entityHit = hits.find((h) => h.type === 'entity' && h.id === 'brother-aldric');
    expect(entityHit).toBeUndefined();
    // Should still contain the zone
    const zoneHit = hits.find((h) => h.type === 'zone' && h.id === 'chapel-nave');
    expect(zoneHit).toBeDefined();
  });

  it('multiple overlapping zones: both zones returned', () => {
    // Create a modified project with two overlapping zones
    const modified = structuredClone(chapel);
    modified.zones.push({
      id: 'overlap-zone',
      name: 'Overlap Zone',
      tags: [],
      description: 'Test overlap zone',
      gridX: 30,
      gridY: 25,
      gridWidth: 5,
      gridHeight: 5,
      neighbors: [],
      exits: [],
      light: 5,
      noise: 0,
      hazards: [],
      interactables: [],
    });
    // Click at a point inside both crypt-chamber and overlap-zone
    // crypt-chamber: grid(30,25) 10x8 -> covers grid 30..39, 25..32
    // overlap-zone:  grid(30,25) 5x5  -> covers grid 30..34, 25..29
    // Grid (32, 27) is inside both -> world (1024, 864)
    const hits = findAllHitsAt(1024, 864, defaultVP, modified, TILE, allVisible);
    const zoneIds = hits.filter((h) => h.type === 'zone').map((h) => h.id);
    expect(zoneIds).toContain('crypt-chamber');
    expect(zoneIds).toContain('overlap-zone');
  });

  it('returns landmark + zone when landmark overlaps with zone', () => {
    // altar-of-passage at grid(14,13) -> world (448, 416)
    // Inside chapel-entrance zone (grid(10,10) 8x6 -> 320..576, 320..512)
    // No spawn or entity at exactly (448, 416) — spawn is at (384, 384) which is 90px away
    const hits = findAllHitsAt(448, 416, defaultVP, chapel, TILE, allVisible);
    const landmarkIdx = hits.findIndex((h) => h.type === 'landmark' && h.id === 'altar-of-passage');
    const zoneIdx = hits.findIndex((h) => h.type === 'zone' && h.id === 'chapel-entrance');
    expect(landmarkIdx).toBeGreaterThanOrEqual(0);
    expect(zoneIdx).toBeGreaterThanOrEqual(0);
    // Landmark comes before zone in priority order
    expect(landmarkIdx).toBeLessThan(zoneIdx);
  });
});
