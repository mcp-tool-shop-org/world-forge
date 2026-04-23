// map-drift.test.ts — AIR-A-005 / AIR-A-006 drift guards
//
// Guards against silent drift between the forward maps (convert-pack.ts:
// GENRE_MAP, DIFFICULTY_MAP, TONE_MAP) and the reverse maps (import.ts:
// REVERSE_GENRE, REVERSE_DIFFICULTY). If someone adds a new mapping in
// convert-pack.ts without updating the reverse side, the importer will
// silently fall back to the raw engine value — these tests catch that.

import { describe, it, expect } from 'vitest';
import { GENRE_MAP, DIFFICULTY_MAP, TONE_MAP, DEFAULT_MODULES } from '../convert-pack.js';
import { REVERSE_GENRE, REVERSE_DIFFICULTY } from '../import.js';

describe('forward ↔ reverse map drift guards', () => {
  it('every canonical PackGenre value produced by GENRE_MAP has a REVERSE_GENRE entry', () => {
    const canonicalGenres = new Set(Object.values(GENRE_MAP));
    for (const canonical of canonicalGenres) {
      expect(
        REVERSE_GENRE[canonical],
        `REVERSE_GENRE is missing an entry for canonical genre '${canonical}'. ` +
        `Add it to import.ts REVERSE_GENRE.`,
      ).toBeDefined();
    }
  });

  it('every canonical PackDifficulty value produced by DIFFICULTY_MAP has a REVERSE_DIFFICULTY entry', () => {
    const canonicalDifficulties = new Set(Object.values(DIFFICULTY_MAP));
    for (const canonical of canonicalDifficulties) {
      expect(
        REVERSE_DIFFICULTY[canonical],
        `REVERSE_DIFFICULTY is missing an entry for canonical difficulty '${canonical}'. ` +
        `Add it to import.ts REVERSE_DIFFICULTY.`,
      ).toBeDefined();
    }
  });

  it('REVERSE_GENRE values round-trip back into GENRE_MAP', () => {
    // Each reverse-map value must itself be a valid forward-map key.
    for (const [packValue, projectValue] of Object.entries(REVERSE_GENRE)) {
      expect(
        GENRE_MAP[projectValue],
        `REVERSE_GENRE['${packValue}'] = '${projectValue}' but that key is not in GENRE_MAP.`,
      ).toBeDefined();
      // The round-trip should land back on the same canonical pack value.
      expect(GENRE_MAP[projectValue]).toBe(packValue);
    }
  });

  it('REVERSE_DIFFICULTY values round-trip back into DIFFICULTY_MAP', () => {
    for (const [packValue, projectValue] of Object.entries(REVERSE_DIFFICULTY)) {
      expect(
        DIFFICULTY_MAP[projectValue],
        `REVERSE_DIFFICULTY['${packValue}'] = '${projectValue}' but that key is not in DIFFICULTY_MAP.`,
      ).toBeDefined();
      expect(DIFFICULTY_MAP[projectValue]).toBe(packValue);
    }
  });

  it('TONE_MAP is identity — documents that tones are passed through unchanged', () => {
    // Tones do not use a reverse map (import.ts just passes meta.tones through).
    // If TONE_MAP ever introduces an alias (source !== target), importer will
    // need its own REVERSE_TONE. Fail here so the developer adds it.
    for (const [sourceKey, canonicalValue] of Object.entries(TONE_MAP)) {
      expect(
        sourceKey,
        `TONE_MAP['${sourceKey}'] = '${canonicalValue}' is an alias — add a REVERSE_TONE to import.ts ` +
        `and update the importer to use it, then update this test.`,
      ).toBe(canonicalValue);
    }
  });

  it('DEFAULT_MODULES is a non-empty list of unique strings', () => {
    expect(DEFAULT_MODULES.length).toBeGreaterThan(0);
    const unique = new Set(DEFAULT_MODULES);
    expect(unique.size).toBe(DEFAULT_MODULES.length);
    for (const m of DEFAULT_MODULES) {
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThan(0);
    }
  });
});
