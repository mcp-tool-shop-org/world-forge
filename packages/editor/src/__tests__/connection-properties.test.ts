import { describe, it, expect } from 'vitest';
import { getOrderedKinds, KIND_LABELS } from '../panels/ConnectionProperties.js';
import { AUTHORING_MODES } from '@world-forge/schema';
import type { ConnectionKind } from '@world-forge/schema';

const ALL_KINDS = Object.keys(KIND_LABELS) as ConnectionKind[];

describe('getOrderedKinds', () => {
  it('returns all 12 ConnectionKind values across preferred + other', () => {
    const { preferred, other } = getOrderedKinds('dungeon');
    const combined = [...preferred, ...other];
    expect(combined.length).toBe(ALL_KINDS.length);
    for (const kind of ALL_KINDS) {
      expect(combined).toContain(kind);
    }
  });

  it('dungeon mode has door first in preferred', () => {
    const { preferred } = getOrderedKinds('dungeon');
    expect(preferred[0]).toBe('door');
  });

  it('ocean mode has channel first in preferred', () => {
    const { preferred } = getOrderedKinds('ocean');
    expect(preferred[0]).toBe('channel');
  });

  it('mode-relevant kinds appear in preferred, not in other', () => {
    const { preferred, other } = getOrderedKinds('space');
    expect(preferred).toContain('docking');
    expect(preferred).toContain('warp');
    expect(other).not.toContain('docking');
    expect(other).not.toContain('warp');
  });

  it('no duplicates in combined list', () => {
    for (const mode of AUTHORING_MODES) {
      const { preferred, other } = getOrderedKinds(mode);
      const combined = [...preferred, ...other];
      expect(new Set(combined).size).toBe(combined.length);
    }
  });

  it('undefined mode defaults to dungeon ordering', () => {
    const { preferred } = getOrderedKinds(undefined);
    expect(preferred[0]).toBe('door');
    expect(preferred).toContain('secret');
  });
});
