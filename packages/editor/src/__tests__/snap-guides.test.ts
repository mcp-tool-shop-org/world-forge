import { describe, it, expect } from 'vitest';
import { SNAP_GUIDE_COLOR, SNAP_GUIDE_DASH, computeSnapDistance } from '../snap.js';

describe('Snap Guide Visual Improvements (FT-011)', () => {
  it('SNAP_GUIDE_COLOR is cyan-400', () => {
    expect(SNAP_GUIDE_COLOR).toBe('#22d3ee');
  });

  it('SNAP_GUIDE_DASH is [6, 4]', () => {
    expect(SNAP_GUIDE_DASH).toEqual([6, 4]);
  });

  it('computeSnapDistance returns absolute distance', () => {
    expect(computeSnapDistance(10, 7)).toBe(3);
    expect(computeSnapDistance(7, 10)).toBe(3);
  });

  it('computeSnapDistance returns 0 for identical edges', () => {
    expect(computeSnapDistance(5, 5)).toBe(0);
  });

  it('computeSnapDistance handles negative coordinates', () => {
    expect(computeSnapDistance(-3, -7)).toBe(4);
    expect(computeSnapDistance(-3, 2)).toBe(5);
  });

  it('computeSnapDistance handles fractional values', () => {
    expect(computeSnapDistance(1.5, 3.25)).toBeCloseTo(1.75);
  });
});
