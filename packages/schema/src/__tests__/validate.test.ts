import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import { invalidOrphanProject } from './fixtures/invalid-orphan.js';

describe('validateProject', () => {
  it('accepts a valid minimal project', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects project with no spawn points', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'spawnPoints')).toBe(true);
  });

  it('rejects orphaned zone neighbor references', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('neighbors') && e.message.includes('zone-nonexistent'),
    )).toBe(true);
  });

  it('rejects district referencing nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('districts') && e.message.includes('zone-missing'),
    )).toBe(true);
  });

  it('rejects entity placement in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('entityPlacements') && e.message.includes('zone-void'),
    )).toBe(true);
  });

  it('rejects item placement in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('itemPlacements') && e.message.includes('zone-void'),
    )).toBe(true);
  });

  it('rejects connection referencing nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path === 'connections' && e.message.includes('zone-ghost'),
    )).toBe(true);
  });

  it('rejects landmark in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('landmarks') && e.message.includes('zone-phantom'),
    )).toBe(true);
  });

  it('detects duplicate zone IDs', () => {
    const duped = {
      ...minimalProject,
      zones: [minimalProject.zones[0], { ...minimalProject.zones[1], id: minimalProject.zones[0].id }],
    };
    const result = validateProject(duped);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate zone ID'))).toBe(true);
  });

  it('detects asymmetrical neighbors', () => {
    const asymmetric = {
      ...minimalProject,
      zones: [
        minimalProject.zones[0],
        { ...minimalProject.zones[1], neighbors: [] },  // cellar doesn't list entrance back
      ],
    };
    const result = validateProject(asymmetric);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('does not list'))).toBe(true);
  });
});
