import { describe, it, expect } from 'vitest';
import { frameBounds, worldToScreen } from '../viewport.js';

const TILE = 32;

describe('frameBounds', () => {
  it('returns null for empty items', () => {
    expect(frameBounds([], TILE, 800, 600)).toBeNull();
  });

  it('frames a single zone correctly', () => {
    const items = [{ gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6 }];
    const vp = frameBounds(items, TILE, 800, 600);
    expect(vp).not.toBeNull();
    // Zone center should map near canvas center
    const cx = (10 + 4) * TILE;
    const cy = (10 + 3) * TILE;
    const screen = worldToScreen(cx, cy, vp!);
    expect(screen.screenX).toBeCloseTo(400, -1);
    expect(screen.screenY).toBeCloseTo(300, -1);
  });

  it('frames multiple zones — center of bounds maps to canvas center', () => {
    const items = [
      { gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4 },
      { gridX: 20, gridY: 20, gridWidth: 4, gridHeight: 4 },
    ];
    const vp = frameBounds(items, TILE, 800, 600);
    expect(vp).not.toBeNull();
    // Bounds center: world ((0+24)/2 * 32, (0+24)/2 * 32) = (384, 384)
    const screen = worldToScreen(384, 384, vp!);
    expect(screen.screenX).toBeCloseTo(400, -1);
    expect(screen.screenY).toBeCloseTo(300, -1);
  });

  it('frames point objects (no gridWidth/gridHeight)', () => {
    const items = [
      { gridX: 5, gridY: 5 },
      { gridX: 15, gridY: 15 },
    ];
    const vp = frameBounds(items, TILE, 800, 600);
    expect(vp).not.toBeNull();
    expect(vp!.zoom).toBeGreaterThan(0);
  });

  it('respects custom padding', () => {
    const items = [{ gridX: 10, gridY: 10, gridWidth: 4, gridHeight: 4 }];
    const narrow = frameBounds(items, TILE, 800, 600, 0);
    const wide = frameBounds(items, TILE, 800, 600, 200);
    expect(narrow).not.toBeNull();
    expect(wide).not.toBeNull();
    // More padding = lower zoom (content occupies less of canvas)
    expect(wide!.zoom).toBeLessThan(narrow!.zoom);
  });
});
