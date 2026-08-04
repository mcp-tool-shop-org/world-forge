// dependency-panel-helpers.test.ts — F-010: DependencyPanel's relink picker
// silently self-closes on unrelated project edits. Root cause: relinkEdge is
// tracked via `relinkEdge === edge` reference equality, but scanDependencies()
// is pure and reconstructs brand-new edge objects on every call — so ANY
// change to `project` (from anywhere in the app) invalidates the reference
// even when the specific edge the user was looking at hasn't changed at all.

import { describe, it, expect } from 'vitest';
import type { DependencyEdge } from '@world-forge/schema';
import { edgeKey } from '../dependency-panel-helpers.js';

function makeEdge(overrides: Partial<DependencyEdge> = {}): DependencyEdge {
  return {
    domain: 'entity-asset',
    status: 'broken',
    sourceType: 'entityPlacement',
    sourceId: 'npc-1',
    fieldName: 'spriteId',
    expectedKind: 'sprite',
    message: 'entityPlacement "npc-1" spriteId references nonexistent asset',
    ...overrides,
  };
}

describe('edgeKey (F-010)', () => {
  it('documents the root cause: two scans of the same underlying issue produce non-reference-equal objects', () => {
    const fromScanA = makeEdge();
    const fromScanB = makeEdge(); // fresh object literal, identical content
    expect(fromScanA).not.toBe(fromScanB);
  });

  it('is stable across independently-constructed edges describing the same underlying issue', () => {
    const fromScanA = makeEdge();
    const fromScanB = makeEdge();
    expect(edgeKey(fromScanA)).toBe(edgeKey(fromScanB));
  });

  it('differs for edges on different source entities', () => {
    const a = makeEdge({ sourceId: 'npc-1' });
    const b = makeEdge({ sourceId: 'npc-2' });
    expect(edgeKey(a)).not.toBe(edgeKey(b));
  });

  it('differs for different fields on the same source entity (e.g. sprite vs portrait both broken)', () => {
    const a = makeEdge({ fieldName: 'spriteId', expectedKind: 'sprite' });
    const b = makeEdge({ fieldName: 'portraitId', expectedKind: 'portrait' });
    expect(edgeKey(a)).not.toBe(edgeKey(b));
  });

  it('differs across domains even if source id happens to collide', () => {
    const a = makeEdge({ domain: 'entity-asset', sourceType: 'entityPlacement', sourceId: 'x' });
    const b = makeEdge({ domain: 'item-asset', sourceType: 'itemPlacement', sourceId: 'x' });
    expect(edgeKey(a)).not.toBe(edgeKey(b));
  });

  it('does not throw when optional fields are missing', () => {
    const a: DependencyEdge = { domain: 'orphan-asset', status: 'orphaned', sourceType: 'asset', sourceId: 'bg-1', message: 'orphaned' };
    expect(() => edgeKey(a)).not.toThrow();
  });
});
