// spawn-condition-codec.test.ts — C3/P1: the SpawnCondition grammar is a CODEC.
//
// `parseSpawnCondition` compiled and nothing decompiled, which hid a real
// regression for a whole cycle (see formatSpawnCondition's docstring): the C1
// export fix was correct and broke the import, because import-zones.ts read a
// compiled ConditionSpec back as `condition.type` — dropping every operand.
//
// The property these tests pin is round-trip identity over the WHOLE grammar,
// not over a sample:
//
//     parse(format(parse(s))) deep-equals parse(s)
//
// plus a completeness check that fails when a family is added to the parser and
// forgotten in the formatter — which is the only reason this stays true as the
// grammar grows.

import { describe, it, expect } from 'vitest';
import {
  parseSpawnCondition,
  formatSpawnCondition,
  formatConditionSpec,
  validateSpawnCondition,
  type SpawnConditionType,
} from '../spawn-condition.js';

/**
 * One authored string per operand family. The `family` field is what the
 * completeness test counts, so adding a family to the parser without adding a
 * sample here fails rather than silently reducing coverage.
 */
const SAMPLES: ReadonlyArray<{ family: SpawnConditionType; src: string }> = [
  { family: 'always', src: 'always' },
  { family: 'never', src: 'never' },
  { family: 'random-probability', src: 'random:0.3' },
  { family: 'time-of-day', src: 'time:night' },
  { family: 'quest-progress', src: 'quest:salt-debt:stage-2' },
  { family: 'faction-rep', src: 'faction:tidewardens:>50' },
  { family: 'player-level', src: 'level:>=5' },
  { family: 'party-level', src: 'party-level:>=10' },
  { family: 'party-size', src: 'party-size:>=3' },
  { family: 'has-item', src: 'item:rope' },
  { family: 'has-flag', src: 'flag:ledger-signed' },
  { family: 'party-member', src: 'member:mira' },
  { family: 'party-class', src: 'class:factor' },
];

/** Every family the parser can produce — harvested from the exported union. */
const ALL_FAMILIES: readonly SpawnConditionType[] = [
  'time-of-day', 'quest-progress', 'faction-rep', 'player-level',
  'random-probability', 'always', 'never', 'party-level', 'party-size',
  'has-item', 'has-flag', 'party-member', 'party-class',
];

describe('C3/P1 — codec completeness', () => {
  it('every grammar family has a sample (a family added to the parser cannot hide)', () => {
    const covered = new Set(SAMPLES.map((s) => s.family));
    const uncovered = ALL_FAMILIES.filter((f) => !covered.has(f));
    expect(uncovered, 'families with no round-trip sample').toEqual([]);
    // Both directions of the count, so a stale ALL_FAMILIES cannot pass either.
    expect(covered.size).toBe(ALL_FAMILIES.length);
  });

  it('each sample parses to the family it claims', () => {
    for (const { family, src } of SAMPLES) {
      expect(parseSpawnCondition(src)?.type, `"${src}"`).toBe(family);
    }
  });
});

describe('C3/P1 — round-trip identity over all thirteen families', () => {
  it('parse(format(parse(s))) === parse(s), operands and all', () => {
    for (const { src } of SAMPLES) {
      const first = parseSpawnCondition(src);
      expect(first, `"${src}" must parse`).not.toBeNull();

      const formatted = formatSpawnCondition(first);
      expect(formatted, `"${src}" must be formattable`).not.toBeNull();

      const second = parseSpawnCondition(formatted!);
      expect(second, `"${src}" -> "${formatted}" must re-parse`).not.toBeNull();
      // Deep equality on the NODE, not on the string: a formatter is free to
      // normalise spacing, but it may never lose or alter an operand.
      expect(second, `round-trip changed the node for "${src}"`).toEqual(first);
    }
  });

  it('the formatted string is itself valid authored grammar', () => {
    // The stronger claim: the decompiled string is something an author could
    // have typed and validateProject would accept. A decompiler that emits
    // grammar the validator rejects is the bug being fixed, not a fix.
    for (const { src } of SAMPLES) {
      const formatted = formatSpawnCondition(parseSpawnCondition(src))!;
      expect(validateSpawnCondition(formatted), `"${formatted}"`).toBeNull();
    }
  });

  it('operand-bearing families really do carry their operands back', () => {
    // Guards against a formatter that passes the identity test by emitting the
    // ORIGINAL string from some cached corner rather than from the node.
    expect(formatSpawnCondition({ type: 'has-item', params: { id: 'lantern' } })).toBe('item:lantern');
    expect(formatSpawnCondition({ type: 'party-level', params: { op: '>=', value: 12 } })).toBe('party-level:>=12');
    expect(formatSpawnCondition({ type: 'faction-rep', params: { id: 'guild', op: '<', value: -20 } })).toBe('faction:guild:<-20');
    expect(formatSpawnCondition({ type: 'quest-progress', params: { id: 'q', stage: 's' } })).toBe('quest:q:s');
  });
});

describe('C3/P1 — the regression this codec exists to fix, pinned', () => {
  // This block would have FAILED on main before C3. It is the C1 defect, stated
  // as the behaviour that must now hold.
  const CASES = [
    { src: 'item:rope', bareType: 'has-item' },
    { src: 'party-level:>=10', bareType: 'party-level' },
    { src: 'flag:x', bareType: 'has-flag' },
  ];

  it('RED (the old importer shape): reading back ConditionSpec.type alone yields INVALID grammar', () => {
    // Not a hypothetical — `import-zones.ts:71` did exactly this. Kept as an
    // executable statement of why the naive inverse is wrong, so nobody
    // reintroduces it as a "simplification".
    for (const { src, bareType } of CASES) {
      const spec = parseSpawnCondition(src)!;
      expect(spec.type).toBe(bareType);
      expect(parseSpawnCondition(spec.type), `"${spec.type}" must NOT parse`).toBeNull();
      expect(validateSpawnCondition(spec.type)).not.toBeNull();
    }
  });

  it('GREEN: the codec recovers the authored string exactly', () => {
    for (const { src } of CASES) {
      expect(formatConditionSpec(parseSpawnCondition(src))).toBe(src);
    }
  });
});

describe('C3/P1 — the formatter REFUSES rather than emitting invalid grammar', () => {
  it('an unknown condition type is unformattable', () => {
    expect(formatSpawnCondition({ type: 'not-a-family' as SpawnConditionType })).toBeNull();
  });

  it('a known family with a missing operand is unformattable', () => {
    expect(formatSpawnCondition({ type: 'has-item' })).toBeNull();
    expect(formatSpawnCondition({ type: 'has-item', params: { id: '' } })).toBeNull();
    expect(formatSpawnCondition({ type: 'party-size', params: { op: '>=' } })).toBeNull();
    expect(formatSpawnCondition({ type: 'quest-progress', params: { id: 'q' } })).toBeNull();
  });

  it('a known family with an OUT-OF-VOCABULARY operand is unformattable, not passed through', () => {
    // The sharp case. `time:teatime` would format to a syntactically plausible
    // string the parser then rejects — emitting it would move the failure from
    // here (loud) to validateProject (confusing). The closed key set is
    // re-checked on the way out.
    expect(formatSpawnCondition({ type: 'time-of-day', params: { when: 'teatime' } })).toBeNull();
    expect(formatSpawnCondition({ type: 'random-probability', params: { p: 1.5 } })).toBeNull();
    expect(formatSpawnCondition({ type: 'player-level', params: { op: '=~', value: 3 } })).toBeNull();
    expect(formatSpawnCondition({ type: 'party-level', params: { op: '>=', value: Number.NaN } })).toBeNull();
  });

  it('null / undefined / non-object input is null, never a throw', () => {
    expect(formatSpawnCondition(null)).toBeNull();
    expect(formatSpawnCondition(undefined)).toBeNull();
    expect(formatConditionSpec(null)).toBeNull();
    expect(formatConditionSpec(undefined)).toBeNull();
    expect(formatConditionSpec({})).toBeNull();
    expect(formatConditionSpec({ type: 7 } as never)).toBeNull();
    expect(formatConditionSpec({ type: 'has-item', params: 'nope' } as never)).toBeNull();
  });
});
