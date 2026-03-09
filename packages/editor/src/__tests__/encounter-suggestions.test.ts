import { describe, it, expect } from 'vitest';
import { getModeProfile } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';

describe('encounter type suggestions', () => {
  it('dungeon suggestions include ambush', () => {
    expect(getModeProfile('dungeon').encounterTypes).toContain('ambush');
  });

  it('ocean suggestions include pirate', () => {
    expect(getModeProfile('ocean').encounterTypes).toContain('pirate');
  });

  it('space suggestions include anomaly', () => {
    expect(getModeProfile('space').encounterTypes).toContain('anomaly');
  });

  it('all modes have non-empty encounter type arrays', () => {
    for (const mode of AUTHORING_MODES) {
      expect(getModeProfile(mode).encounterTypes.length).toBeGreaterThan(0);
    }
  });
});
