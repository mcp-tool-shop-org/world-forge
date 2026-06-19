import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { Stratum, StratumLink } from '../stratum.js';

const stratum = (id: string, over: Partial<Stratum> = {}): Stratum =>
  ({ id, name: id, order: 0, tags: [], ...over });
const link = (id: string, over: Partial<StratumLink> = {}): StratumLink =>
  ({ id, fromStratumId: 'surface', toStratumId: 'under', bidirectional: true, linkType: 'stairs', ...over });

function withStrata(
  strata: Stratum[],
  stratumLinks: StratumLink[] = [],
  zonePatch: Partial<WorldProject['zones'][number]> = {},
): WorldProject {
  return {
    ...minimalProject,
    strata,
    stratumLinks,
    zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, ...zonePatch } : z)),
  };
}

describe('strata validation', () => {
  it('accepts well-formed strata + links + zone assignment', () => {
    const project = withStrata(
      [stratum('surface', { order: 0, zRange: { floor: 0, ceiling: 10 }, visibleStrata: ['under'] }), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: minimalProject.zones[0].id })],
      { stratumId: 'surface' },
    );
    const result = validateProject(project);
    expect(result.errors.filter((e) => e.path.includes('strat'))).toEqual([]);
  });

  it('treats absent strata as backward-compatible (valid)', () => {
    const result = validateProject(minimalProject);
    expect(result.errors.filter((e) => e.path.includes('strat'))).toEqual([]);
  });

  it('rejects duplicate stratum IDs', () => {
    const result = validateProject(withStrata([stratum('surface'), stratum('surface')]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate stratum ID'))).toBe(true);
  });

  it('rejects a stratum zRange with floor >= ceiling', () => {
    const result = validateProject(withStrata([stratum('s', { zRange: { floor: 5, ceiling: 5 } })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('strata.s.zRange'))).toBe(true);
  });

  it('rejects a stratum zRange with non-finite bounds', () => {
    const result = validateProject(withStrata([stratum('s', { zRange: { floor: 0, ceiling: Infinity } })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('strata.s.zRange') && e.message.includes('finite'))).toBe(true);
  });

  it('rejects a non-finite stratum order', () => {
    const result = validateProject(withStrata([stratum('s', { order: NaN })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('strata.s.order'))).toBe(true);
  });

  it('rejects visibleStrata referencing a nonexistent stratum', () => {
    const result = validateProject(withStrata([stratum('s', { visibleStrata: ['ghost'] })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('strata.s.visibleStrata') && e.message.includes('ghost'))).toBe(true);
  });

  it('rejects a zone.stratumId referencing a nonexistent stratum', () => {
    const result = validateProject(withStrata([stratum('surface')], [], { stratumId: 'no-such' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('stratumId') && e.message.includes('no-such'))).toBe(true);
  });

  it('rejects duplicate stratum link IDs', () => {
    const result = validateProject(withStrata([stratum('surface'), stratum('under', { order: -1 })], [link('l1'), link('l1')]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate stratum link ID'))).toBe(true);
  });

  it('rejects a stratum link referencing a nonexistent stratum endpoint', () => {
    const result = validateProject(withStrata([stratum('surface')], [link('l1', { toStratumId: 'ghost' })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('stratumLinks.l1.toStratumId') && e.message.includes('ghost'))).toBe(true);
  });

  it('rejects a stratum link anchoring to a nonexistent zone', () => {
    const result = validateProject(withStrata(
      [stratum('surface'), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: 'no-zone' })],
    ));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('stratumLinks.l1.fromZoneId') && e.message.includes('no-zone'))).toBe(true);
  });
});
