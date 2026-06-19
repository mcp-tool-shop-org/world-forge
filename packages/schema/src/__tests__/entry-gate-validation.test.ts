import { describe, it, expect } from 'vitest';
import { parseSpawnCondition, validateSpawnCondition } from '../spawn-condition.js';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { ZoneEntryGate } from '../spatial.js';

function withGate(gate: ZoneEntryGate | undefined): WorldProject {
  return {
    ...minimalProject,
    zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, entryGate: gate } : z)),
  };
}

describe('spawn-condition — party-state operands (entry gates)', () => {
  it('parses party-level + party-size comparisons', () => {
    expect(parseSpawnCondition('party-level:>=10')).toEqual({ type: 'party-level', params: { op: '>=', value: 10 } });
    expect(parseSpawnCondition('party-size:>3')).toEqual({ type: 'party-size', params: { op: '>', value: 3 } });
  });

  it('parses id-based operands (item / flag / member / class)', () => {
    expect(parseSpawnCondition('item:iron-key')).toEqual({ type: 'has-item', params: { id: 'iron-key' } });
    expect(parseSpawnCondition('flag:met-king')).toEqual({ type: 'has-flag', params: { id: 'met-king' } });
    expect(parseSpawnCondition('member:renna')).toEqual({ type: 'party-member', params: { id: 'renna' } });
    expect(parseSpawnCondition('class:healer')).toEqual({ type: 'party-class', params: { id: 'healer' } });
  });

  it('rejects malformed party operands', () => {
    expect(parseSpawnCondition('party-level:abc')).toBeNull();  // non-numeric value
    expect(parseSpawnCondition('party-size:foo')).toBeNull();   // non-numeric value
    expect(parseSpawnCondition('party-size:5')).toBeNull();     // missing comparator
    expect(parseSpawnCondition('item:')).toBeNull();            // empty id
    expect(parseSpawnCondition('class:')).toBeNull();           // empty id
  });

  it('still accepts the pre-existing forms (no regression)', () => {
    expect(parseSpawnCondition('always')).toEqual({ type: 'always' });
    expect(parseSpawnCondition('level:>=5')).toEqual({ type: 'player-level', params: { op: '>=', value: 5 } });
    expect(validateSpawnCondition('quest:main:3')).toBeNull();
  });
});

describe('zone entry gate validation', () => {
  it('accepts a well-formed gate with party conditions', () => {
    const result = validateProject(withGate({ conditions: ['party-level:>=10', 'item:iron-key'], mode: 'hard', reason: 'You need a level-10 party and the Iron Key.' }));
    expect(result.errors.filter((e) => e.path.includes('entryGate'))).toEqual([]);
  });

  it('treats no gate as backward-compatible (valid)', () => {
    const result = validateProject(withGate(undefined));
    expect(result.errors.filter((e) => e.path.includes('entryGate'))).toEqual([]);
  });

  it('rejects an unsupported gate mode', () => {
    const result = validateProject(withGate({ conditions: ['always'], mode: 'locked' as never }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('entryGate.mode'))).toBe(true);
  });

  it('rejects a gate with no conditions', () => {
    const result = validateProject(withGate({ conditions: [], mode: 'hard' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('entryGate.conditions'))).toBe(true);
  });

  it('rejects a gate with an unrecognized condition string', () => {
    const result = validateProject(withGate({ conditions: ['party-level:>=10', 'nonsense:foo'], mode: 'soft' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('entryGate.conditions[1]'))).toBe(true);
  });
});
