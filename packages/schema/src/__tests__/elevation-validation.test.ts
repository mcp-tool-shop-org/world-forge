import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { advisoryValidation } from '../advisory.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';

function withZone(project: WorldProject, patch: Partial<WorldProject['zones'][number]>): WorldProject {
  return {
    ...project,
    zones: project.zones.map((z, i) => (i === 0 ? { ...z, ...patch } : z)),
  };
}

describe('2.5D elevation validation', () => {
  it('accepts a well-formed elevationRange (floor < ceiling)', () => {
    const project = withZone(minimalProject, { elevationRange: { floor: 0, ceiling: 10 } });
    const result = validateProject(project);
    expect(result.errors.filter((e) => e.path.includes('elevationRange'))).toEqual([]);
  });

  it('rejects elevationRange when floor >= ceiling', () => {
    const bad = withZone(minimalProject, { elevationRange: { floor: 5, ceiling: 5 } });
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('elevationRange'))).toBe(true);
  });

  it('rejects elevationRange with inverted bounds', () => {
    const bad = withZone(minimalProject, { elevationRange: { floor: 10, ceiling: 2 } });
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
  });

  it('treats absent elevation fields as backward-compatible (valid)', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
  });
});

describe('2.5D parallax layer validation', () => {
  it('accepts unique layer ids and unique depths', () => {
    const project = withZone(minimalProject, {
      parallaxLayers: [
        { id: 'far', depth: 100, assetRef: 'bg-far', scrollFactor: 0.1 },
        { id: 'near', depth: 10, assetRef: 'bg-near', scrollFactor: 0.8 },
      ],
    });
    const result = validateProject(project);
    expect(result.errors.filter((e) => e.path.includes('parallaxLayers'))).toEqual([]);
  });

  it('rejects duplicate layer ids within a zone', () => {
    const project = withZone(minimalProject, {
      parallaxLayers: [
        { id: 'dup', depth: 100, assetRef: 'a', scrollFactor: 0.1 },
        { id: 'dup', depth: 10, assetRef: 'b', scrollFactor: 0.8 },
      ],
    });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('duplicate parallax layer id'))).toBe(true);
  });

  it('rejects duplicate depth values within a zone', () => {
    const project = withZone(minimalProject, {
      parallaxLayers: [
        { id: 'a', depth: 50, assetRef: 'x', scrollFactor: 0.1 },
        { id: 'b', depth: 50, assetRef: 'y', scrollFactor: 0.5 },
      ],
    });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('share depth'))).toBe(true);
  });
});

describe('2.5D advisory suggestions', () => {
  it('suggests setting elevation when mode is space and no zone has elevation', () => {
    const project: WorldProject = { ...minimalProject, mode: 'space' };
    const result = advisoryValidation(project);
    expect(result.items.some((item) => item.message.includes('Space tip') && item.message.includes('elevation'))).toBe(true);
  });

  it('suggests elevation in wilderness mode for terrain variation', () => {
    const project: WorldProject = { ...minimalProject, mode: 'wilderness' };
    const result = advisoryValidation(project);
    expect(result.items.some((item) => item.message.includes('Wilderness tip') && item.message.includes('elevation'))).toBe(true);
  });

  it('does not suggest elevation when at least one zone already has elevation set', () => {
    const project: WorldProject = {
      ...minimalProject,
      mode: 'space',
      zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, elevation: 3 } : z)),
    };
    const result = advisoryValidation(project);
    expect(result.items.some((item) => item.message.includes('Space tip') && item.message.includes('elevation'))).toBe(false);
  });
});
