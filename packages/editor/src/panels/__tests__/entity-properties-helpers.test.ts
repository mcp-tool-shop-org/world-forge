import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_ROLES, parseCsv, formatCsv, parseNamedNumbers, formatNamedNumbers,
  emptyToUndef, spawnConditionMessage,
} from '../entity-properties-helpers.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('entity-properties-helpers (F-539476f4)', () => {
  it('lists every EntityRole', () => {
    expect(ALL_ROLES).toEqual(['npc', 'enemy', 'merchant', 'quest-giver', 'companion', 'boss']);
  });

  it('parses and formats csv tags', () => {
    expect(parseCsv(' a, b,,c ')).toEqual(['a', 'b', 'c']);
    expect(formatCsv(['a', 'b'])).toBe('a, b');
    expect(formatCsv(undefined)).toBe('');
  });

  it('parses name:value stats and skips junk', () => {
    expect(parseNamedNumbers('vigor:3, instinct:2, nope, hp:10')).toEqual({ vigor: 3, instinct: 2, hp: 10 });
    expect(formatNamedNumbers({ vigor: 3, hp: 10 })).toBe('vigor:3, hp:10');
    expect(formatNamedNumbers(undefined)).toBe('');
  });

  it('emptyToUndef trims blank strings', () => {
    expect(emptyToUndef('  ')).toBeUndefined();
    expect(emptyToUndef('always')).toBe('always');
  });

  it('spawnConditionMessage reuses validateSpawnCondition', () => {
    expect(spawnConditionMessage(undefined)).toBeNull();
    expect(spawnConditionMessage('')).toBeNull();
    expect(spawnConditionMessage('always')).toBeNull();
    expect(spawnConditionMessage('random:0.3')).toBeNull();
    expect(spawnConditionMessage('not-a-condition')).toMatch(/Unrecognized/);
  });
});

describe('EntityProperties inspector wiring (F-539476f4)', () => {
  it('calls updateEntity and covers the inspector fields', () => {
    const src = readFileSync(join(here, '../EntityProperties.tsx'), 'utf8');
    expect(src).toContain('updateEntity');
    expect(src).toContain('dialogueId');
    expect(src).toContain('factionId');
    expect(src).toContain('spawnCondition');
    expect(src).toContain('spawnConditionMessage');
    expect(src).toContain('portraitId');
    expect(src).toContain('spriteId');
    expect(src).toContain('selection.entities.length === 1');
    expect(src).toContain('role-pill-');
    expect(src).toContain("activeTool !== 'entity-place'");
  });
});
