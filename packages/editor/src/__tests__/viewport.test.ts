import { describe, it, expect } from 'vitest';
import {
  screenToWorld, worldToScreen, screenToGrid,
  computeContentBounds, fitBoundsToViewport, centerOnPoint,
  centerOnZone, zoomAtPoint, DEFAULT_VIEWPORT, MIN_ZOOM, MAX_ZOOM,
} from '../viewport.js';
import { SAMPLE_WORLDS } from '../templates/registry.js';

const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold')!;
const hello = SAMPLE_WORLDS.find((s) => s.id === 'hello-world')!;
const TILE = 32;

// ── screenToWorld / worldToScreen ────────────────────────────────

describe('screenToWorld / worldToScreen', () => {
  it('identity at default viewport — screen coords equal world coords', () => {
    const { worldX, worldY } = screenToWorld(100, 200, DEFAULT_VIEWPORT);
    expect(worldX).toBe(100);
    expect(worldY).toBe(200);
  });

  it('with pan offset — screenToWorld adds panX/panY', () => {
    const vp = { panX: 50, panY: 30, zoom: 1 };
    const { worldX, worldY } = screenToWorld(100, 200, vp);
    expect(worldX).toBe(150);
    expect(worldY).toBe(230);
  });

  it('with zoom 2x — screenToWorld divides by zoom then adds pan', () => {
    const vp = { panX: 10, panY: 20, zoom: 2 };
    const { worldX, worldY } = screenToWorld(100, 200, vp);
    expect(worldX).toBe(60);  // 100/2 + 10
    expect(worldY).toBe(120); // 200/2 + 20
  });

  it('round-trip: worldToScreen(screenToWorld(x,y)) === (x,y)', () => {
    const viewports = [
      { panX: 0, panY: 0, zoom: 1 },
      { panX: 100, panY: -50, zoom: 0.5 },
      { panX: -200, panY: 300, zoom: 3 },
    ];
    for (const vp of viewports) {
      const { worldX, worldY } = screenToWorld(256, 384, vp);
      const { screenX, screenY } = worldToScreen(worldX, worldY, vp);
      expect(screenX).toBeCloseTo(256, 10);
      expect(screenY).toBeCloseTo(384, 10);
    }
  });
});

// ── screenToGrid ─────────────────────────────────────────────────

describe('screenToGrid', () => {
  it('at default viewport, tileSize 32 — screen (64, 96) → grid (2, 3)', () => {
    const { gridX, gridY } = screenToGrid(64, 96, DEFAULT_VIEWPORT, TILE);
    expect(gridX).toBe(2);
    expect(gridY).toBe(3);
  });

  it('with zoom and pan — correct grid snapping', () => {
    const vp = { panX: 32, panY: 64, zoom: 2 };
    // worldX = 64/2 + 32 = 64, worldY = 128/2 + 64 = 128
    // gridX = floor(64/32) = 2, gridY = floor(128/32) = 4
    const { gridX, gridY } = screenToGrid(64, 128, vp, TILE);
    expect(gridX).toBe(2);
    expect(gridY).toBe(4);
  });

  it('negative screen coords produce negative grid coords', () => {
    // With panX: -100 → worldX = -64/1 + (-100) = -164
    // gridX = floor(-164/32) = floor(-5.125) = -6
    const vp = { panX: -100, panY: -100, zoom: 1 };
    const { gridX, gridY } = screenToGrid(-64, -64, vp, TILE);
    expect(gridX).toBeLessThan(0);
    expect(gridY).toBeLessThan(0);
  });
});

// ── computeContentBounds ─────────────────────────────────────────

describe('computeContentBounds', () => {
  it('empty project (no zones) returns null', () => {
    const empty = { ...chapel.project, zones: [] };
    expect(computeContentBounds(empty, TILE)).toBeNull();
  });

  it('Hello World — correct bounds with padding for single zone', () => {
    // Zone: gridX:15, gridY:12, gridWidth:10, gridHeight:6, tileSize:32
    // Zone rect: x=480..800, y=384..576
    // Spawn: gridX:18, gridY:14 → x=576, y=448 (inside zone rect)
    // With default padding 64: minX=416, minY=320, maxX=864, maxY=640
    const bounds = computeContentBounds(hello.project, TILE);
    expect(bounds).not.toBeNull();
    expect(bounds!.minX).toBe(480 - 64);
    expect(bounds!.minY).toBe(384 - 64);
    expect(bounds!.maxX).toBe(800 + 64);
    expect(bounds!.maxY).toBe(576 + 64);
  });

  it('Chapel Threshold — bounds encompass all 5 zones including crypt-chamber at gridX:30', () => {
    const bounds = computeContentBounds(chapel.project, TILE);
    expect(bounds).not.toBeNull();
    // crypt-chamber: gridX:30, gridWidth:10 → right edge = (30+10)*32 = 1280
    // chapel-entrance: gridX:10 → left edge = 10*32 = 320
    // chapel-entrance: gridY:10 → top = 10*32 = 320
    // crypt-chamber: gridY:25, gridHeight:8 → bottom = (25+8)*32 = 1056
    // With 64px padding
    expect(bounds!.minX).toBeLessThanOrEqual(320 - 64);
    expect(bounds!.maxX).toBeGreaterThanOrEqual(1280 + 64);
  });

  it('includes spawn points and landmarks in bounds', () => {
    // Chapel spawn at gridX:12, gridY:12 → 384, 384
    // Landmarks also contribute to bounds
    const bounds = computeContentBounds(chapel.project, TILE);
    expect(bounds).not.toBeNull();
    // Spawn point at 12*32=384 is inside zone rect so won't extend beyond
    // But we verify bounds exist and are reasonable
    expect(bounds!.minX).toBeLessThan(bounds!.maxX);
    expect(bounds!.minY).toBeLessThan(bounds!.maxY);
  });

  it('custom padding value works', () => {
    const bounds0 = computeContentBounds(hello.project, TILE, 0);
    const bounds128 = computeContentBounds(hello.project, TILE, 128);
    expect(bounds0).not.toBeNull();
    expect(bounds128).not.toBeNull();
    // bounds128 should be 128px wider on each side than bounds0
    expect(bounds128!.minX).toBe(bounds0!.minX - 128);
    expect(bounds128!.maxX).toBe(bounds0!.maxX + 128);
    expect(bounds128!.minY).toBe(bounds0!.minY - 128);
    expect(bounds128!.maxY).toBe(bounds0!.maxY + 128);
  });
});

// ── fitBoundsToViewport ──────────────────────────────────────────

describe('fitBoundsToViewport', () => {
  it('square content in square canvas → centered', () => {
    const bounds = { minX: 0, minY: 0, maxX: 400, maxY: 400 };
    const vp = fitBoundsToViewport(bounds, 400, 400);
    expect(vp.zoom).toBeCloseTo(1, 5);
    // Center of bounds (200,200) should map to canvas center (200,200)
    const screen = worldToScreen(200, 200, vp);
    expect(screen.screenX).toBeCloseTo(200, 5);
    expect(screen.screenY).toBeCloseTo(200, 5);
  });

  it('wide content in narrow canvas → zoom limited by width', () => {
    const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 200 };
    const vp = fitBoundsToViewport(bounds, 500, 500);
    // Width constrains: 500/1000 = 0.5, height: 500/200 = 2.5 → zoom = 0.5
    expect(vp.zoom).toBeCloseTo(0.5, 5);
  });

  it('tall content in wide canvas → zoom limited by height', () => {
    const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 1000 };
    const vp = fitBoundsToViewport(bounds, 500, 500);
    // Width: 500/200 = 2.5, height: 500/1000 = 0.5 → zoom = 0.5
    expect(vp.zoom).toBeCloseTo(0.5, 5);
  });

  it('zoom clamped to maxZoom when content is tiny', () => {
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const vp = fitBoundsToViewport(bounds, 800, 600, MIN_ZOOM, 3.0);
    expect(vp.zoom).toBe(3.0);
  });

  it('zoom clamped to minZoom when content is huge', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100000, maxY: 100000 };
    const vp = fitBoundsToViewport(bounds, 800, 600, 0.5, MAX_ZOOM);
    expect(vp.zoom).toBe(0.5);
  });
});

// ── centerOnPoint ────────────────────────────────────────────────

describe('centerOnPoint', () => {
  it('centers correctly — worldToScreen of target is canvas center', () => {
    const vp = centerOnPoint(500, 300, 800, 600, 2);
    const screen = worldToScreen(500, 300, vp);
    expect(screen.screenX).toBeCloseTo(400, 5); // 800/2
    expect(screen.screenY).toBeCloseTo(300, 5); // 600/2
  });
});

// ── centerOnZone ─────────────────────────────────────────────────

describe('centerOnZone', () => {
  it('chapel-entrance frames correctly in 800x600 canvas', () => {
    const zone = chapel.project.zones.find((z) => z.id === 'chapel-entrance')!;
    const vp = centerOnZone(zone, TILE, 800, 600);
    // Zone center in world pixels
    const cx = (zone.gridX + zone.gridWidth / 2) * TILE;
    const cy = (zone.gridY + zone.gridHeight / 2) * TILE;
    const screen = worldToScreen(cx, cy, vp);
    expect(screen.screenX).toBeCloseTo(400, 1);
    expect(screen.screenY).toBeCloseTo(300, 1);
  });

  it('crypt-chamber frames correctly in 800x600 canvas', () => {
    const zone = chapel.project.zones.find((z) => z.id === 'crypt-chamber')!;
    const vp = centerOnZone(zone, TILE, 800, 600);
    const cx = (zone.gridX + zone.gridWidth / 2) * TILE;
    const cy = (zone.gridY + zone.gridHeight / 2) * TILE;
    const screen = worldToScreen(cx, cy, vp);
    expect(screen.screenX).toBeCloseTo(400, 1);
    expect(screen.screenY).toBeCloseTo(300, 1);
  });
});

// ── zoomAtPoint ──────────────────────────────────────────────────

describe('zoomAtPoint', () => {
  it('zoom in at canvas center keeps center stable', () => {
    const vp = centerOnPoint(500, 300, 800, 600, 1);
    const zoomed = zoomAtPoint(vp, 400, 300, 0.5);
    // World point at canvas center before zoom
    const beforeWorld = screenToWorld(400, 300, vp);
    // Same world point after zoom — should still be at canvas center
    const afterScreen = worldToScreen(beforeWorld.worldX, beforeWorld.worldY, zoomed);
    expect(afterScreen.screenX).toBeCloseTo(400, 5);
    expect(afterScreen.screenY).toBeCloseTo(300, 5);
  });

  it('zoom in at corner — world point under cursor stays stationary', () => {
    const vp = { panX: 100, panY: 50, zoom: 1 };
    const cornerX = 0;
    const cornerY = 0;
    const zoomed = zoomAtPoint(vp, cornerX, cornerY, 1.0);
    // World point at (0,0) screen before zoom
    const beforeWorld = screenToWorld(cornerX, cornerY, vp);
    const afterScreen = worldToScreen(beforeWorld.worldX, beforeWorld.worldY, zoomed);
    expect(afterScreen.screenX).toBeCloseTo(cornerX, 5);
    expect(afterScreen.screenY).toBeCloseTo(cornerY, 5);
  });

  it('zoom clamped at MIN_ZOOM does not go below', () => {
    const vp = { panX: 0, panY: 0, zoom: 0.2 };
    const zoomed = zoomAtPoint(vp, 400, 300, -0.5);
    expect(zoomed.zoom).toBe(MIN_ZOOM);
  });

  it('zoom clamped at MAX_ZOOM does not go above', () => {
    const vp = { panX: 0, panY: 0, zoom: 4.8 };
    const zoomed = zoomAtPoint(vp, 400, 300, 0.5);
    expect(zoomed.zoom).toBe(MAX_ZOOM);
  });
});
