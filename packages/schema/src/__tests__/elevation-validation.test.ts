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
    const base = withZone(minimalProject, {
      parallaxLayers: [
        { id: 'far', depth: 100, assetRef: 'bg-far', scrollFactor: 0.1 },
        { id: 'near', depth: 10, assetRef: 'bg-near', scrollFactor: 0.8 },
      ],
    });
    const project: WorldProject = {
      ...base,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
        { id: 'bg-near', kind: 'background', label: 'Near', path: 'bg/near.png', tags: [] },
      ],
    };
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

// ---------------------------------------------------------------------------
// Wave 1 schema domain findings (SCH-A-001..004)
// ---------------------------------------------------------------------------

describe('SCH-A-001: elevationRange rejects non-finite floor/ceiling', () => {
  it('rejects NaN floor', () => {
    const bad = withZone(minimalProject, { elevationRange: { floor: NaN, ceiling: 10 } });
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('elevationRange') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });

  it('rejects NaN ceiling', () => {
    const bad = withZone(minimalProject, { elevationRange: { floor: 0, ceiling: NaN } });
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('elevationRange') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });

  it('rejects +Infinity ceiling (would pass `floor < ceiling` naively)', () => {
    const bad = withZone(minimalProject, { elevationRange: { floor: 0, ceiling: Infinity } });
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('elevationRange') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });

  it('rejects -Infinity floor', () => {
    const bad = withZone(minimalProject, { elevationRange: { floor: -Infinity, ceiling: 10 } });
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('elevationRange') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });
});

describe('SCH-A-002: parallax assetRef must resolve to background or sprite asset', () => {
  it('accepts parallax layer with a background asset', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far BG', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'far', depth: 100, assetRef: 'bg-far', scrollFactor: 0.1 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(
      result.errors.filter((e) => e.path.includes('parallaxLayers.far.assetRef')),
    ).toEqual([]);
  });

  it('accepts parallax layer with a sprite asset', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'spr-bird', kind: 'sprite', label: 'Bird', path: 'spr/bird.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'flock', depth: 50, assetRef: 'spr-bird', scrollFactor: 0.4 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(
      result.errors.filter((e) => e.path.includes('parallaxLayers.flock.assetRef')),
    ).toEqual([]);
  });

  it('rejects parallax assetRef that does not exist in assets', () => {
    const project = withZone(minimalProject, {
      parallaxLayers: [
        { id: 'ghost', depth: 100, assetRef: 'does-not-exist', scrollFactor: 0.2 },
      ],
    });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.includes('parallaxLayers.ghost.assetRef') &&
          e.message.includes('nonexistent'),
      ),
    ).toBe(true);
  });

  it('rejects parallax assetRef whose asset is the wrong kind (e.g. tileset)', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'ts-wrong', kind: 'tileset', label: 'TS', path: 'ts/wrong.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'bad', depth: 100, assetRef: 'ts-wrong', scrollFactor: 0.2 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.includes('parallaxLayers.bad.assetRef') &&
          e.message.includes('background') &&
          e.message.includes('sprite'),
      ),
    ).toBe(true);
  });
});

describe('SCH-A-003: parallax scrollFactor must be finite in [0.0, 1.0]', () => {
  function projectWithScrollFactor(sf: number): WorldProject {
    return {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'far', depth: 100, assetRef: 'bg-far', scrollFactor: sf },
              ],
            }
          : z,
      ),
    };
  }

  it('accepts scrollFactor = 0.0', () => {
    const result = validateProject(projectWithScrollFactor(0));
    expect(
      result.errors.filter((e) => e.path.includes('scrollFactor')),
    ).toEqual([]);
  });

  it('accepts scrollFactor = 1.0', () => {
    const result = validateProject(projectWithScrollFactor(1));
    expect(
      result.errors.filter((e) => e.path.includes('scrollFactor')),
    ).toEqual([]);
  });

  it('rejects scrollFactor = NaN', () => {
    const result = validateProject(projectWithScrollFactor(NaN));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path.includes('scrollFactor')),
    ).toBe(true);
  });

  it('rejects scrollFactor = Infinity', () => {
    const result = validateProject(projectWithScrollFactor(Infinity));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path.includes('scrollFactor')),
    ).toBe(true);
  });

  it('rejects negative scrollFactor', () => {
    const result = validateProject(projectWithScrollFactor(-0.1));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path.includes('scrollFactor')),
    ).toBe(true);
  });

  it('rejects scrollFactor > 1', () => {
    const result = validateProject(projectWithScrollFactor(1.5));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path.includes('scrollFactor')),
    ).toBe(true);
  });
});

describe('SCH-A-004: Zone.skylineRef must resolve to a background asset', () => {
  it('accepts a skylineRef that points to a background asset', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'sky-dawn', kind: 'background', label: 'Dawn Sky', path: 'bg/sky.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, skylineRef: 'sky-dawn' } : z,
      ),
    };
    const result = validateProject(project);
    expect(
      result.errors.filter((e) => e.path.includes('skylineRef')),
    ).toEqual([]);
  });

  it('treats absent skylineRef as valid (backward compatible)', () => {
    const result = validateProject(minimalProject);
    expect(
      result.errors.filter((e) => e.path.includes('skylineRef')),
    ).toEqual([]);
  });

  it('rejects skylineRef pointing at a nonexistent asset', () => {
    const project = withZone(minimalProject, { skylineRef: 'no-such-sky' });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('skylineRef') && e.message.includes('nonexistent'),
      ),
    ).toBe(true);
  });

  it('rejects skylineRef pointing at a non-background asset (e.g. tileset)', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'ts-oops', kind: 'tileset', label: 'TS', path: 'ts/oops.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, skylineRef: 'ts-oops' } : z,
      ),
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.includes('skylineRef') &&
          e.message.includes('tileset') &&
          e.message.includes('background'),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Wave 2 schema domain findings (SCH-A-005..008)
// ---------------------------------------------------------------------------

describe('SCH-A-005: parallax layer depth must be a finite number', () => {
  function projectWithDepth(depth: number): WorldProject {
    return {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'far', depth, assetRef: 'bg-far', scrollFactor: 0.5 },
              ],
            }
          : z,
      ),
    };
  }

  it('rejects NaN depth', () => {
    const result = validateProject(projectWithDepth(NaN));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('parallaxLayers.far.depth') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });

  it('rejects +Infinity depth', () => {
    const result = validateProject(projectWithDepth(Infinity));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('parallaxLayers.far.depth') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });

  it('rejects -Infinity depth', () => {
    const result = validateProject(projectWithDepth(-Infinity));
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('parallaxLayers.far.depth') && e.message.includes('finite'),
      ),
    ).toBe(true);
  });
});

describe('SCH-A-006: parallax layer id must be non-empty and not whitespace-only', () => {
  it('rejects empty layer id', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: '', depth: 100, assetRef: 'bg-far', scrollFactor: 0.1 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('parallaxLayers') && e.message.includes('missing'),
      ),
    ).toBe(true);
  });

  it('rejects whitespace-only layer id', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: '   ', depth: 100, assetRef: 'bg-far', scrollFactor: 0.1 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.path.includes('parallaxLayers') && e.message.includes('whitespace-only'),
      ),
    ).toBe(true);
  });
});

describe('SCH-A-007 / SCH-A-008: parallax layer additional coverage', () => {
  it('rejects parallax layer with missing assetRef (undefined)', () => {
    const project = withZone(minimalProject, {
      // Cast: the schema requires assetRef, but validateProject must defend
      // against callers that omit it at runtime (JSON from disk, external tools).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parallaxLayers: [
        { id: 'orphan', depth: 100, scrollFactor: 0.5 } as any,
      ],
    });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.includes('parallaxLayers.orphan.assetRef') &&
          e.message.includes('missing'),
      ),
    ).toBe(true);
  });

  it('rejects parallax layer with empty-string assetRef', () => {
    const project = withZone(minimalProject, {
      parallaxLayers: [
        { id: 'blank', depth: 100, assetRef: '', scrollFactor: 0.5 },
      ],
    });
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) =>
          e.path.includes('parallaxLayers.blank.assetRef') &&
          e.message.includes('missing'),
      ),
    ).toBe(true);
  });

  it('rejects scrollFactor just above 1.0 (out-of-bounds upper)', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'far', depth: 100, assetRef: 'bg-far', scrollFactor: 1.0001 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path.includes('scrollFactor')),
    ).toBe(true);
  });

  it('rejects scrollFactor just below 0.0 (out-of-bounds lower)', () => {
    const project: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'bg-far', kind: 'background', label: 'Far', path: 'bg/far.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0
          ? {
              ...z,
              parallaxLayers: [
                { id: 'far', depth: 100, assetRef: 'bg-far', scrollFactor: -0.0001 },
              ],
            }
          : z,
      ),
    };
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path.includes('scrollFactor')),
    ).toBe(true);
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
