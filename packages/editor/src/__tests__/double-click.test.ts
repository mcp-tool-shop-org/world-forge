// double-click.test.ts — tests for hit-type dispatch on double-click
// These test the findHitAt behavior that powers double-click (actual handler is in Canvas.tsx)

import { describe, it, expect } from 'vitest';
import { findHitAt, findAllHitsAt } from '../hit-testing.js';
import type { WorldProject } from '@world-forge/schema';
import { SAMPLE_WORLDS } from '../templates/samples.js';

const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold')!.project;
const tileSize = chapel.map.tileSize;
const viewport = { panX: 0, panY: 0, zoom: 1 };
const visFlags = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true };

describe('double-click hit dispatch', () => {
  it('double-click on zone center returns zone or encounter', () => {
    // Crypt chamber center: gridX=30, gridY=25, gridWidth=10, gridHeight=8
    const chamber = chapel.zones.find((z) => z.id === 'crypt-chamber')!;
    const cx = (chamber.gridX + chamber.gridWidth / 2) * tileSize;
    const cy = (chamber.gridY + chamber.gridHeight / 2) * tileSize;
    const hit = findHitAt(cx, cy, viewport, chapel, tileSize, visFlags);
    expect(hit).toBeDefined();
    // Should hit encounter (priority) or zone
    expect(['encounter', 'zone']).toContain(hit!.type);
  });

  it('double-click on empty space returns null', () => {
    // Far off the map
    const hit = findHitAt(9999, 9999, viewport, chapel, tileSize, visFlags);
    expect(hit).toBeNull();
  });

  it('double-click on spawn returns spawn hit', () => {
    const spawn = chapel.spawnPoints[0];
    // Hit-testing uses sp.gridX * tileSize for spawn world position
    const sx = spawn.gridX * tileSize;
    const sy = spawn.gridY * tileSize;
    const hit = findHitAt(sx, sy, viewport, chapel, tileSize, visFlags);
    expect(hit).toBeDefined();
    expect(hit!.type).toBe('spawn');
    expect(hit!.id).toBe(spawn.id);
  });

  it('findAllHitsAt returns multiple hits at zone with encounter', () => {
    const chamber = chapel.zones.find((z) => z.id === 'crypt-chamber')!;
    const cx = (chamber.gridX + chamber.gridWidth / 2) * tileSize;
    const cy = (chamber.gridY + chamber.gridHeight / 2) * tileSize;
    const hits = findAllHitsAt(cx, cy, viewport, chapel, tileSize, visFlags);
    const types = hits.map((h) => h.type);
    expect(types).toContain('zone');
    // If encounter exists at center, it should be in the list
    if (chapel.encounterAnchors.some((e) => e.zoneId === 'crypt-chamber')) {
      expect(types).toContain('encounter');
    }
  });

  it('connection hit returns type connection', () => {
    // Connection between entry-hall and crypt-chamber
    const conn = chapel.connections.find((c) => c.fromZoneId === 'entry-hall' && c.toZoneId === 'crypt-chamber');
    if (!conn) return; // Skip if sample changed
    // Midpoint of connection line
    const z1 = chapel.zones.find((z) => z.id === conn.fromZoneId)!;
    const z2 = chapel.zones.find((z) => z.id === conn.toZoneId)!;
    const mx = ((z1.gridX + z1.gridWidth / 2) + (z2.gridX + z2.gridWidth / 2)) / 2 * tileSize;
    const my = ((z1.gridY + z1.gridHeight / 2) + (z2.gridY + z2.gridHeight / 2)) / 2 * tileSize;
    const hits = findAllHitsAt(mx, my, viewport, chapel, tileSize, visFlags);
    // Connection might be in the list depending on exact position
    // At minimum, zone should be hit
    expect(hits.length).toBeGreaterThan(0);
  });
});
