import { describe, it, expect } from 'vitest';
import { MODE_PROFILES, getModeProfile, getDefaultConnectionKind } from '../mode-profiles.js';
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

  // -- v3.3 mode-aware defaults --

  it('each mode has at least 3 encounter types', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].encounterTypes.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('each mode has non-empty defaultEntityRole', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].defaultEntityRole.length).toBeGreaterThan(0);
    }
  });

  it('each mode has non-empty zoneNamePattern', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].zoneNamePattern.length).toBeGreaterThan(0);
    }
  });

  it('getDefaultConnectionKind(undefined) returns door (dungeon default)', () => {
    expect(getDefaultConnectionKind(undefined)).toBe('door');
  });

  it('getDefaultConnectionKind("ocean") returns channel', () => {
    expect(getDefaultConnectionKind('ocean')).toBe('channel');
  });

  it('getDefaultConnectionKind("space") returns docking', () => {
    expect(getDefaultConnectionKind('space')).toBe('docking');
  });

  it('getDefaultConnectionKind("wilderness") returns trail', () => {
    expect(getDefaultConnectionKind('wilderness')).toBe('trail');
  });

  it('all defaultEntityRole values are valid entity roles', () => {
    const VALID_ROLES = new Set(['npc', 'enemy', 'merchant', 'boss', 'companion']);
    for (const mode of AUTHORING_MODES) {
      expect(VALID_ROLES.has(MODE_PROFILES[mode].defaultEntityRole)).toBe(true);
    }
  });

  it('no duplicate encounter types per profile', () => {
    for (const mode of AUTHORING_MODES) {
      const types = MODE_PROFILES[mode].encounterTypes;
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it('getDefaultConnectionKind matches connectionKinds[0] for each mode', () => {
    for (const mode of AUTHORING_MODES) {
      expect(getDefaultConnectionKind(mode)).toBe(MODE_PROFILES[mode].connectionKinds[0]);
    }
  });
});
