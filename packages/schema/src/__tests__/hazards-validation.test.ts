import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { HazardDefinition } from '../hazard.js';

const hazard = (id: string, over: Partial<HazardDefinition> = {}): HazardDefinition =>
  ({ id, name: id, effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-end' }], trigger: 'on-enter', tags: [], ...over });

function withHazards(
  hazardDefinitions: HazardDefinition[],
  zonePatch: Partial<WorldProject['zones'][number]> = {},
): WorldProject {
  return {
    ...minimalProject,
    hazardDefinitions,
    zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, ...zonePatch } : z)),
  };
}

describe('hazard validation', () => {
  it('accepts a well-formed hazard + zone ref', () => {
    const project = withHazards(
      [hazard('poison', { effects: [{ kind: 'status', statusId: 'poison', chance: 0.5, stacking: 'refresh' }], moveCostDelta: 1, passable: 'yes' })],
      { hazardRefs: ['poison'] },
    );
    const result = validateProject(project);
    expect(result.errors.filter((e) => e.path.includes('hazard'))).toEqual([]);
  });

  it('treats absent hazards as backward-compatible (valid)', () => {
    const result = validateProject(minimalProject);
    expect(result.errors.filter((e) => e.path.includes('hazard'))).toEqual([]);
  });

  it('rejects duplicate hazard IDs', () => {
    const result = validateProject(withHazards([hazard('lava'), hazard('lava')]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate hazard ID'))).toBe(true);
  });

  it('rejects an unsupported trigger', () => {
    const result = validateProject(withHazards([hazard('lava', { trigger: 'whenever' as never })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.trigger'))).toBe(true);
  });

  it('rejects an unsupported passable value', () => {
    const result = validateProject(withHazards([hazard('lava', { passable: 'maybe' as never })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.passable'))).toBe(true);
  });

  it('rejects a non-finite moveCostDelta', () => {
    const result = validateProject(withHazards([hazard('lava', { moveCostDelta: Infinity })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.moveCostDelta'))).toBe(true);
  });

  it('rejects a damage effect with a non-finite amount', () => {
    const result = validateProject(withHazards([hazard('lava', { effects: [{ kind: 'damage', amount: NaN, tickOn: 'turn-end' }] })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('effects[0]'))).toBe(true);
  });

  it('rejects a status effect with chance out of [0,1]', () => {
    const result = validateProject(withHazards([hazard('lava', { effects: [{ kind: 'status', statusId: 'burn', chance: 1.5, stacking: 'stack' }] })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('effects[0]') && e.message.includes('[0, 1]'))).toBe(true);
  });

  it('rejects a status effect with a missing statusId', () => {
    const result = validateProject(withHazards([hazard('lava', { effects: [{ kind: 'status', statusId: '', chance: 0.5, stacking: 'stack' }] })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('effects[0]') && e.message.includes('statusId'))).toBe(true);
  });

  it('rejects an ignite effect with igniteChance out of [0,1]', () => {
    const result = validateProject(withHazards([hazard('lava', { effects: [{ kind: 'ignite', igniteChance: 2 }] })]));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('effects[0]'))).toBe(true);
  });

  it('rejects a zone hazardRef that does not exist', () => {
    const result = validateProject(withHazards([hazard('lava')], { hazardRefs: ['ghost'] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('hazardRefs') && e.message.includes('ghost'))).toBe(true);
  });
});
