import { describe, it, expect } from 'vitest';
import { generateZoneName, MODE_PROFILES } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';

describe('Zone Auto-Naming (FT-024)', () => {
  it('dungeon generates "Chamber N"', () => {
    expect(generateZoneName('dungeon', 1)).toBe('Chamber 1');
    expect(generateZoneName('dungeon', 42)).toBe('Chamber 42');
  });

  it('ocean generates "Waters N"', () => {
    expect(generateZoneName('ocean', 1)).toBe('Waters 1');
  });

  it('district generates "Block N"', () => {
    expect(generateZoneName('district', 3)).toBe('Block 3');
  });

  it('space generates "Sector N"', () => {
    expect(generateZoneName('space', 7)).toBe('Sector 7');
  });

  it('interior generates "Room N"', () => {
    expect(generateZoneName('interior', 2)).toBe('Room 2');
  });

  it('wilderness generates "Area N"', () => {
    expect(generateZoneName('wilderness', 5)).toBe('Area 5');
  });

  it('world generates "Territory N"', () => {
    expect(generateZoneName('world', 1)).toBe('Territory 1');
  });

  it('every mode has a non-empty zoneNamePattern', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].zoneNamePattern.length).toBeGreaterThan(0);
    }
  });

  it('generateZoneName works for all modes', () => {
    for (const mode of AUTHORING_MODES) {
      const name = generateZoneName(mode, 1);
      expect(name).toMatch(/^.+ 1$/);
    }
  });
});
