import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../project-shape.js';
import { advisoryValidation } from '../advisory.js';
import {
  VALID_GENRES, VALID_TONES, VALID_DIFFICULTIES,
  isValidGenre, isValidTone, isValidDifficulty,
} from '../flavor.js';

describe('F-1fbf61d2: schema owns flavor vocabularies', () => {
  it('identity members and aliases are known', () => {
    expect(isValidGenre('fantasy')).toBe(true);
    expect(isValidGenre('mercantile')).toBe(true);
    expect(isValidGenre('detective')).toBe(true);
    expect(isValidGenre('typo-genre')).toBe(false);
    expect(isValidTone('atmospheric')).toBe(true);
    expect(isValidTone('sardonic')).toBe(false);
    expect(isValidDifficulty('beginner')).toBe(true);
    expect(isValidDifficulty('hard')).toBe(true);
    expect(isValidDifficulty('nightmare')).toBe(false);
    expect(VALID_GENRES).toContain('pursuit');
    expect(VALID_TONES).toContain('noir');
    expect(VALID_DIFFICULTIES).toEqual(['beginner', 'intermediate', 'advanced']);
  });

  it('advisory warns on unknown genre/tone/difficulty and stays silent on aliases', () => {
    const unknown = createEmptyProject();
    unknown.genre = 'typo-genre';
    unknown.tones = ['sardonic'];
    unknown.difficulty = 'nightmare';
    const bad = advisoryValidation(unknown);
    expect(bad.items.some((i) => i.path === 'genre' && /typo-genre/.test(i.message))).toBe(true);
    expect(bad.items.some((i) => i.path === 'tones' && /sardonic/.test(i.message))).toBe(true);
    expect(bad.items.some((i) => i.path === 'difficulty' && /nightmare/.test(i.message))).toBe(true);

    const aliased = createEmptyProject();
    aliased.genre = 'detective';
    aliased.tones = ['atmospheric'];
    aliased.difficulty = 'hard';
    const ok = advisoryValidation(aliased);
    expect(ok.items.filter((i) => i.path === 'genre' || i.path === 'tones' || i.path === 'difficulty')).toEqual([]);
  });
});
