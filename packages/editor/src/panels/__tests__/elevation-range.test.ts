import { describe, it, expect } from 'vitest';
import {
  nextElevationRange,
  validateElevationRange,
  defaultShowElevation,
} from '../zone-2d5-helpers.js';

describe('F-2f33dcb9: nextElevationRange does not coerce empty to 0', () => {
  it('persists undefined for an empty ceiling instead of 0', () => {
    const next = nextElevationRange({ floor: 0, ceiling: 5 }, 'floor', 10);
    expect(next).toEqual({ floor: 10, ceiling: 5 });

    const partial = nextElevationRange(undefined, 'floor', 10);
    expect(partial).toEqual({ floor: 10, ceiling: undefined });
    expect(partial?.ceiling).toBeUndefined();
    expect(partial?.ceiling).not.toBe(0);
  });

  it('clears the range when both sides are empty', () => {
    expect(nextElevationRange({ floor: 10, ceiling: 20 }, 'floor', undefined)?.floor).toBeUndefined();
    const afterCeiling = nextElevationRange({ floor: undefined, ceiling: 20 }, 'ceiling', undefined);
    expect(afterCeiling).toBeUndefined();
  });

  it('backspacing a side unsets it rather than snapping to 0', () => {
    const next = nextElevationRange({ floor: 10, ceiling: 20 }, 'ceiling', undefined);
    expect(next).toEqual({ floor: 10, ceiling: undefined });
    expect(validateElevationRange(next?.floor, next?.ceiling)).toBeNull();
  });
});

describe('F-2514135c: defaultShowElevation mode-aware default', () => {
  it('is on for space and wilderness, off otherwise', () => {
    expect(defaultShowElevation('space')).toBe(true);
    expect(defaultShowElevation('wilderness')).toBe(true);
    expect(defaultShowElevation('dungeon')).toBe(false);
    expect(defaultShowElevation('interior')).toBe(false);
    expect(defaultShowElevation(undefined)).toBe(false);
  });
});
