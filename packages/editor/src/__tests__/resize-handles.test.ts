import { describe, it, expect } from 'vitest';
import { getHandles, getHandleAxes, applyResize, findHandleAt, MIN_ZONE_SIZE, HANDLE_SCREEN_RADIUS } from '../resize-handles.js';

// Chapel fixture zones (matching snap.test.ts):
// chapel-entrance: gridX=10, gridY=10, gridWidth=8, gridHeight=6  → right=18, bottom=16
// chapel-alcove:   gridX=22, gridY=22, gridWidth=5, gridHeight=4  → right=27, bottom=26

const entrance = { gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6 };
const alcove = { gridX: 22, gridY: 22, gridWidth: 5, gridHeight: 4 };

describe('getHandles', () => {
  it('returns 8 handles', () => {
    const handles = getHandles(entrance);
    expect(handles).toHaveLength(8);
    expect(new Set(handles.map((h) => h.kind)).size).toBe(8);
  });

  it('corner positions match zone corners (chapel-entrance)', () => {
    const handles = getHandles(entrance);
    const byKind = Object.fromEntries(handles.map((h) => [h.kind, h]));
    // nw = top-left
    expect(byKind.nw).toEqual({ kind: 'nw', gx: 10, gy: 10 });
    // ne = top-right
    expect(byKind.ne).toEqual({ kind: 'ne', gx: 18, gy: 10 });
    // sw = bottom-left
    expect(byKind.sw).toEqual({ kind: 'sw', gx: 10, gy: 16 });
    // se = bottom-right
    expect(byKind.se).toEqual({ kind: 'se', gx: 18, gy: 16 });
  });

  it('edge midpoints correct (chapel-entrance)', () => {
    const handles = getHandles(entrance);
    const byKind = Object.fromEntries(handles.map((h) => [h.kind, h]));
    expect(byKind.n).toEqual({ kind: 'n', gx: 14, gy: 10 });
    expect(byKind.s).toEqual({ kind: 's', gx: 14, gy: 16 });
    expect(byKind.w).toEqual({ kind: 'w', gx: 10, gy: 13 });
    expect(byKind.e).toEqual({ kind: 'e', gx: 18, gy: 13 });
  });

  it('odd-width zone produces fractional midpoint', () => {
    const handles = getHandles(alcove);
    const byKind = Object.fromEntries(handles.map((h) => [h.kind, h]));
    // alcove: gridX=22, gridWidth=5 → center-x = 22 + 5/2 = 24.5
    expect(byKind.n.gx).toBe(24.5);
    expect(byKind.s.gx).toBe(24.5);
    // gridY=22, gridHeight=4 → center-y = 22 + 4/2 = 24
    expect(byKind.w.gy).toBe(24);
    expect(byKind.e.gy).toBe(24);
  });
});

describe('getHandleAxes', () => {
  it('corner handles control two axes', () => {
    const nw = getHandleAxes('nw');
    expect(nw.movesLeft).toBe(true);
    expect(nw.movesTop).toBe(true);
    expect(nw.movesRight).toBe(false);
    expect(nw.movesBottom).toBe(false);

    const se = getHandleAxes('se');
    expect(se.movesRight).toBe(true);
    expect(se.movesBottom).toBe(true);
    expect(se.movesLeft).toBe(false);
    expect(se.movesTop).toBe(false);
  });

  it('edge handles control one axis', () => {
    const n = getHandleAxes('n');
    expect(n.movesTop).toBe(true);
    expect(n.movesBottom).toBe(false);
    expect(n.movesLeft).toBe(false);
    expect(n.movesRight).toBe(false);

    const e = getHandleAxes('e');
    expect(e.movesRight).toBe(true);
    expect(e.movesLeft).toBe(false);
    expect(e.movesTop).toBe(false);
    expect(e.movesBottom).toBe(false);
  });

  it('all 8 kinds return valid axes', () => {
    const kinds = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
    for (const kind of kinds) {
      const axes = getHandleAxes(kind);
      expect(typeof axes.movesLeft).toBe('boolean');
      expect(typeof axes.movesRight).toBe('boolean');
      expect(typeof axes.movesTop).toBe('boolean');
      expect(typeof axes.movesBottom).toBe('boolean');
    }
  });
});

describe('applyResize', () => {
  it('SE drag expands both axes', () => {
    const result = applyResize(entrance, 'se', 3, 2);
    expect(result).toEqual({ gridX: 10, gridY: 10, gridWidth: 11, gridHeight: 8 });
  });

  it('NW drag shrinks both axes (origin moves)', () => {
    const result = applyResize(entrance, 'nw', 2, 1);
    expect(result).toEqual({ gridX: 12, gridY: 11, gridWidth: 6, gridHeight: 5 });
  });

  it('N handle: only Y axis changes', () => {
    const result = applyResize(entrance, 'n', 5, -3);
    expect(result.gridX).toBe(10);
    expect(result.gridWidth).toBe(8);
    expect(result.gridY).toBe(7);
    expect(result.gridHeight).toBe(9);
  });

  it('E handle: only X axis changes (Y delta ignored)', () => {
    const result = applyResize(entrance, 'e', 4, 99);
    expect(result.gridX).toBe(10);
    expect(result.gridY).toBe(10);
    expect(result.gridWidth).toBe(12);
    expect(result.gridHeight).toBe(6);
  });

  it('SE drag clamped when width would go below MIN_ZONE_SIZE', () => {
    // entrance: 8×6, SE shrink by -10 → clamped to MIN_ZONE_SIZE
    const result = applyResize(entrance, 'se', -10, -10);
    expect(result.gridWidth).toBe(MIN_ZONE_SIZE);
    expect(result.gridHeight).toBe(MIN_ZONE_SIZE);
    expect(result.gridX).toBe(10);
    expect(result.gridY).toBe(10);
  });

  it('NW drag inward clamped at minimum', () => {
    // entrance: 8×6, NW drag inward by +10,+10 → max dx = 8-2=6, max dy = 6-2=4
    const result = applyResize(entrance, 'nw', 10, 10);
    expect(result.gridX).toBe(16);
    expect(result.gridY).toBe(14);
    expect(result.gridWidth).toBe(MIN_ZONE_SIZE);
    expect(result.gridHeight).toBe(MIN_ZONE_SIZE);
  });

  it('W handle drag to near-minimum', () => {
    const result = applyResize(entrance, 'w', 5, 0);
    // max dx for movesLeft = 8 - 2 = 6, so 5 is within range
    expect(result.gridX).toBe(15);
    expect(result.gridWidth).toBe(3);
  });

  it('S handle drag to near-minimum', () => {
    const result = applyResize(entrance, 's', 0, -3);
    // min dY for movesBottom = 2 - 6 = -4, so -3 is within range
    expect(result.gridHeight).toBe(3);
  });

  it('zero delta returns original geometry', () => {
    const result = applyResize(entrance, 'se', 0, 0);
    expect(result).toEqual({ gridX: 10, gridY: 10, gridWidth: 8, gridHeight: 6 });
  });
});

describe('findHandleAt', () => {
  const tileSize = 32;
  const vp = { panX: 0, panY: 0, zoom: 1 };

  it('hits NW corner at exact position', () => {
    // NW handle at grid (10,10) → screen (320, 320)
    const result = findHandleAt(320, 320, entrance, tileSize, vp);
    expect(result).toBe('nw');
  });

  it('hits SE corner', () => {
    // SE handle at grid (18,16) → screen (576, 512)
    const result = findHandleAt(576, 512, entrance, tileSize, vp);
    expect(result).toBe('se');
  });

  it('hits N midpoint near edge of radius', () => {
    // N handle at grid (14,10) → screen (448, 320)
    const result = findHandleAt(448, 320 + HANDLE_SCREEN_RADIUS - 1, entrance, tileSize, vp);
    expect(result).toBe('n');
  });

  it('misses when clicking in zone center (far from handles)', () => {
    // Zone center: grid (14,13) → screen (448, 416) — far from any handle
    const result = findHandleAt(448, 416, entrance, tileSize, vp);
    expect(result).toBeNull();
  });
});
