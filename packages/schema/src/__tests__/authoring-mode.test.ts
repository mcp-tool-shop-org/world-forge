import { describe, it, expect } from 'vitest';
import { AUTHORING_MODES, isValidMode, DEFAULT_MODE } from '../authoring-mode.js';
import type { AuthoringMode } from '../authoring-mode.js';
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

  // F-004: isValidMode() was exported specifically to guard WorldProject.mode
  // but validateProject() never called it, so a garbage mode value passed
  // silently. These lock in the wiring.
  it('validateProject rejects a garbage mode value', () => {
    const bad = { ...minimalProject, mode: 'castle-siege-mode-that-does-not-exist' as unknown as AuthoringMode };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'mode')).toBe(true);
  });

  it('validateProject accepts every real AuthoringMode (control)', () => {
    for (const mode of AUTHORING_MODES) {
      const good = { ...minimalProject, mode };
      expect(validateProject(good).valid).toBe(true);
    }
  });

  it('validateProject treats an absent mode as backward-compatible (control)', () => {
    // minimalProject never sets `mode` at all — this is the pre-v4.x shape.
    expect(minimalProject.mode).toBeUndefined();
    expect(validateProject(minimalProject).valid).toBe(true);
  });
});
