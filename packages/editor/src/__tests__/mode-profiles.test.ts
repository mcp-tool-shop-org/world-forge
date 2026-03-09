import { describe, it, expect } from 'vitest';
import { MODE_PROFILES, getModeProfile } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';

/** Valid checklist step IDs from ChecklistPanel. */
const VALID_STEP_IDS = new Set(['district', 'zone', 'spawn', 'player', 'npc', 'export']);

/** All valid ConnectionKind values (current + expanded). */
const VALID_KINDS = new Set([
  'passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard',
  'channel', 'route', 'docking', 'warp', 'trail',
]);

describe('ModeProfiles', () => {
  it('getModeProfile(undefined) returns dungeon', () => {
    const profile = getModeProfile(undefined);
    expect(profile.mode).toBe('dungeon');
  });

  it('getModeProfile("ocean") returns ocean', () => {
    const profile = getModeProfile('ocean');
    expect(profile.mode).toBe('ocean');
    expect(profile.label).toBe('Ocean / Sea');
  });

  it('profile count equals AUTHORING_MODES count', () => {
    expect(Object.keys(MODE_PROFILES).length).toBe(AUTHORING_MODES.length);
  });

  it('each mode has label, icon, description, and positive grid', () => {
    for (const mode of AUTHORING_MODES) {
      const p = MODE_PROFILES[mode];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.icon.length).toBeGreaterThan(0);
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.grid.width).toBeGreaterThan(0);
      expect(p.grid.height).toBeGreaterThan(0);
      expect(p.grid.tileSize).toBeGreaterThan(0);
    }
  });

  it('all connectionKinds are valid ConnectionKind values', () => {
    for (const mode of AUTHORING_MODES) {
      for (const kind of MODE_PROFILES[mode].connectionKinds) {
        expect(VALID_KINDS.has(kind)).toBe(true);
      }
    }
  });

  it('guideOverrides keys are valid checklist step IDs', () => {
    for (const mode of AUTHORING_MODES) {
      for (const key of Object.keys(MODE_PROFILES[mode].guideOverrides)) {
        expect(VALID_STEP_IDS.has(key)).toBe(true);
      }
    }
  });

  it('all grid tileSize values are positive multiples of 8', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].grid.tileSize % 8).toBe(0);
    }
  });

  it('no duplicate connectionKinds per profile', () => {
    for (const mode of AUTHORING_MODES) {
      const kinds = MODE_PROFILES[mode].connectionKinds;
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it('dungeon guide overrides label for district step', () => {
    const profile = getModeProfile('dungeon');
    expect(profile.guideOverrides.district?.label).toBe('Create a dungeon level');
  });

  it('ocean guide overrides label for zone step', () => {
    const profile = getModeProfile('ocean');
    expect(profile.guideOverrides.zone?.label).toBe('Add a sea zone');
  });

  it('default (district) keeps original-style labels', () => {
    const profile = getModeProfile('district');
    // district mode has overrides, but they're ward-specific, not the defaults
    expect(profile.guideOverrides.district?.label).toBe('Create a ward');
  });

  it('guide step IDs are stable across all modes', () => {
    for (const mode of AUTHORING_MODES) {
      const overrideKeys = Object.keys(MODE_PROFILES[mode].guideOverrides);
      for (const key of overrideKeys) {
        expect(VALID_STEP_IDS.has(key)).toBe(true);
      }
    }
  });
});
