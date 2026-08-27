// optional-world-arrays-validation.test.ts — F-7282f981
//
// leftover optionalArrays: lootTables / transitions / strata / stratumLinks /
// hazardDefinitions used `project.X ?? []` + for...of. object/number threw;
// string was iterated character-by-character; null was silently valid:true.
// Town arrays (buildings/hubs/strongholds) already reject the same shapes.
// Undefined stays valid (additive optional contract).

import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { ValidationResult } from '../validate.js';

const OPTIONAL_FIELDS = [
  'lootTables',
  'transitions',
  'strata',
  'stratumLinks',
  'hazardDefinitions',
] as const;

const BAD_VALUES: ReadonlyArray<[string, unknown]> = [
  ['object', {}],
  ['number', 42],
  ['string', 'nope'],
  ['null', null],
];

function run(project: WorldProject): ValidationResult {
  let result: ValidationResult | undefined;
  expect(() => {
    result = validateProject(project);
  }).not.toThrow();
  return result!;
}

describe('leftover optional WorldProject arrays (F-7282f981)', () => {
  it('treats omitted leftover optional arrays as valid (undefined stays valid)', () => {
    expect(minimalProject.lootTables).toBeUndefined();
    expect(minimalProject.transitions).toBeUndefined();
    expect(minimalProject.strata).toBeUndefined();
    expect(minimalProject.stratumLinks).toBeUndefined();
    expect(minimalProject.hazardDefinitions).toBeUndefined();
    const result = run(minimalProject);
    expect(result.valid).toBe(true);
  });

  it('accepts empty arrays for leftover optional fields', () => {
    const p = {
      ...minimalProject,
      lootTables: [],
      transitions: [],
      strata: [],
      stratumLinks: [],
      hazardDefinitions: [],
    };
    expect(run(p).valid).toBe(true);
  });

  for (const field of OPTIONAL_FIELDS) {
    for (const [label, value] of BAD_VALUES) {
      it(`does not throw and rejects ${field} set to ${label}`, () => {
        const bad = { ...minimalProject, [field]: value } as unknown as WorldProject;
        const result = run(bad);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.path === field && e.message.includes('to be an array'))).toBe(true);
      });
    }
  }

  it('rejects all five leftover fields at once when corrupted (same shapes as the town guard)', () => {
    const bad = {
      ...minimalProject,
      lootTables: {},
      transitions: 7,
      strata: 'nope',
      stratumLinks: null,
      hazardDefinitions: { id: 'not-an-array' },
    } as unknown as WorldProject;
    const result = run(bad);
    expect(result.valid).toBe(false);
    for (const field of OPTIONAL_FIELDS) {
      expect(result.errors.some((e) => e.path === field)).toBe(true);
    }
  });
});
