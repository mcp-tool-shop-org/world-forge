import { describe, it, expect } from 'vitest';
import { AUTHORING_MODES, isValidMode, DEFAULT_MODE } from '../authoring-mode.js';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import { chapelProject } from './fixtures/chapel-authored.js';

describe('AuthoringMode', () => {
  it('AUTHORING_MODES contains all 7 modes', () => {
    expect(AUTHORING_MODES).toEqual([
      'dungeon', 'district', 'world', 'ocean', 'space', 'interior', 'wilderness',
    ]);
  });

  it('isValidMode returns true for each mode', () => {
    for (const mode of AUTHORING_MODES) {
      expect(isValidMode(mode)).toBe(true);
    }
  });

  it('isValidMode returns false for invalid values', () => {
    expect(isValidMode('cave')).toBe(false);
    expect(isValidMode('')).toBe(false);
    expect(isValidMode('DUNGEON')).toBe(false);
  });

  it('DEFAULT_MODE is dungeon', () => {
    expect(DEFAULT_MODE).toBe('dungeon');
  });

  it('existing fixtures still pass validateProject', () => {
    expect(validateProject(minimalProject).valid).toBe(true);
    expect(validateProject(chapelProject).valid).toBe(true);
  });
});
