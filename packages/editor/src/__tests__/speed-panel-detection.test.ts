import { describe, it, expect } from 'vitest';

// Test the double-right-click detection logic as a pure function
// (extracted from the Canvas.tsx inline logic for testability)

const DBL_RIGHT_INTERVAL = 300;
const DBL_RIGHT_RADIUS = 5;

interface RightClick { time: number; sx: number; sy: number }

/**
 * Simulates the double-right-click detection logic from Canvas.tsx.
 * Returns true if the second click qualifies as a double-right-click.
 */
function detectDoubleRightClick(
  prev: RightClick | null,
  current: RightClick,
  dragDist: number,
): { detected: boolean; nextTracker: RightClick | null } {
  // If drag occurred, clear tracker
  if (dragDist >= DBL_RIGHT_RADIUS) {
    return { detected: false, nextTracker: null };
  }
  // No drag — check for double-click
  if (prev && (current.time - prev.time) < DBL_RIGHT_INTERVAL) {
    const dx = current.sx - prev.sx;
    const dy = current.sy - prev.sy;
    if (Math.sqrt(dx * dx + dy * dy) < DBL_RIGHT_RADIUS) {
      return { detected: true, nextTracker: null };
    }
  }
  return { detected: false, nextTracker: current };
}

describe('double-right-click detection', () => {
  it('detects two right-clicks within interval and radius', () => {
    const first: RightClick = { time: 1000, sx: 100, sy: 200 };
    const second: RightClick = { time: 1200, sx: 102, sy: 201 };
    const result = detectDoubleRightClick(first, second, 0);
    expect(result.detected).toBe(true);
    expect(result.nextTracker).toBeNull();
  });

  it('rejects two right-clicks outside interval', () => {
    const first: RightClick = { time: 1000, sx: 100, sy: 200 };
    const second: RightClick = { time: 1400, sx: 101, sy: 200 };
    const result = detectDoubleRightClick(first, second, 0);
    expect(result.detected).toBe(false);
    expect(result.nextTracker).toBe(second);
  });

  it('rejects two right-clicks outside radius', () => {
    const first: RightClick = { time: 1000, sx: 100, sy: 200 };
    const second: RightClick = { time: 1100, sx: 120, sy: 200 };
    const result = detectDoubleRightClick(first, second, 0);
    expect(result.detected).toBe(false);
    expect(result.nextTracker).toBe(second);
  });

  it('clears tracker when a drag occurred', () => {
    const first: RightClick = { time: 1000, sx: 100, sy: 200 };
    const second: RightClick = { time: 1100, sx: 101, sy: 200 };
    const result = detectDoubleRightClick(first, second, 50);
    expect(result.detected).toBe(false);
    expect(result.nextTracker).toBeNull();
  });

  it('first right-click with no prior just records tracker', () => {
    const current: RightClick = { time: 1000, sx: 100, sy: 200 };
    const result = detectDoubleRightClick(null, current, 0);
    expect(result.detected).toBe(false);
    expect(result.nextTracker).toBe(current);
  });
});
