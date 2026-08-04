import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MODE_PROFILES, getModeProfile, getDefaultConnectionKind, generateZoneName } from '../mode-profiles.js';
import { AUTHORING_MODES, DEFAULT_MODE } from '@world-forge/schema';
import type { AuthoringMode } from '@world-forge/schema';

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

  // -- v3.4 guide/checklist enhancements --

  it('each mode has a non-empty modeTip', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].modeTip.length).toBeGreaterThan(0);
    }
  });

  it('each mode has guideOverrides for district, zone, spawn, player, and npc', () => {
    for (const mode of AUTHORING_MODES) {
      const ov = MODE_PROFILES[mode].guideOverrides;
      expect(ov.district).toBeDefined();
      expect(ov.zone).toBeDefined();
      expect(ov.spawn).toBeDefined();
      expect(ov.player).toBeDefined();
      expect(ov.npc).toBeDefined();
    }
  });

  it('dungeon player override says adventurer', () => {
    expect(getModeProfile('dungeon').guideOverrides.player?.label).toBe('Create an adventurer');
  });

  it('ocean player override says captain', () => {
    expect(getModeProfile('ocean').guideOverrides.player?.label).toBe('Create a captain');
  });

  it('space npc override says contact', () => {
    expect(getModeProfile('space').guideOverrides.npc?.label).toBe('Add a speaking contact');
  });

  it('wilderness spawn override says camp spawn', () => {
    expect(getModeProfile('wilderness').guideOverrides.spawn?.label).toBe('Place a camp spawn');
  });
});

// ──────────────────────────────────────────────────────────────────
// F-5fc88e24: getModeProfile(mode) did a bare `MODE_PROFILES[mode ??
// DEFAULT_MODE]` with no guard for a mode value outside the 7-mode union.
// project.mode is never validated on load (normalizeProjectShape spreads it
// through unchecked; validate.ts's isValidMode() guard is a separate,
// not-yet-wired schema-domain gap), so a typo, a stale value from a schema
// migration, or a hand-edited project file reaches this function unchanged.
// App.tsx calls getModeProfile(project.mode).icon UNCONDITIONALLY on every
// render, twice, with no guard around either call site — an undefined
// profile is a first-render TypeError that takes down the whole editor to
// the ErrorBoundary.
// ──────────────────────────────────────────────────────────────────

describe('F-5fc88e24: invalid mode fallback (getModeProfile / generateZoneName)', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not throw for an unrecognized mode string (reproduces the exact crash trigger)', () => {
    expect(() => getModeProfile('castle-siege-mode-that-does-not-exist' as AuthoringMode)).not.toThrow();
  });

  it('falls back to the DEFAULT_MODE profile for an unrecognized mode string', () => {
    const profile = getModeProfile('castle-siege-mode-that-does-not-exist' as AuthoringMode);
    expect(profile).toBeDefined();
    expect(profile.mode).toBe(DEFAULT_MODE);
    // The very access pattern App.tsx uses unconditionally, twice per render —
    // must not throw "Cannot read properties of undefined".
    expect(profile.icon.length).toBeGreaterThan(0);
    expect(profile.label.length).toBeGreaterThan(0);
  });

  it('warns when falling back for an unrecognized mode', () => {
    getModeProfile('nonsense' as AuthoringMode);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('is immune to a "__proto__" prototype-pollution key (does not resolve to Object.prototype)', () => {
    const profile = getModeProfile('__proto__' as AuthoringMode);
    expect(profile.mode).toBe(DEFAULT_MODE);
    // A naive `MODE_PROFILES['__proto__']` bracket lookup would have returned
    // Object.prototype (truthy, so a bare `??` fallback never fires) — assert
    // we got a REAL profile, not the object prototype wearing a disguise.
    expect(profile.icon.length).toBeGreaterThan(0);
    expect(Object.prototype.hasOwnProperty.call(MODE_PROFILES, profile.mode)).toBe(true);
  });

  it('handles a non-string garbage value without throwing (?? only substitutes null/undefined)', () => {
    expect(() => getModeProfile(42 as unknown as AuthoringMode)).not.toThrow();
    expect(getModeProfile(42 as unknown as AuthoringMode).mode).toBe(DEFAULT_MODE);
  });

  it('handles null the same as an invalid value (warn + fallback), not a silent pass-through', () => {
    const profile = getModeProfile(null as unknown as AuthoringMode);
    expect(profile.mode).toBe(DEFAULT_MODE);
    // Unlike `undefined` (a legitimate "field omitted" case), `null` is a
    // present-but-wrong value and should be flagged the same as any other
    // invalid mode, not silently absorbed by `?? DEFAULT_MODE`.
    expect(warnSpy).toHaveBeenCalled();
  });

  it('generateZoneName falls back to the DEFAULT_MODE pattern for an unrecognized mode instead of throwing', () => {
    expect(() => generateZoneName('nonsense' as AuthoringMode, 1)).not.toThrow();
    expect(generateZoneName('nonsense' as AuthoringMode, 1)).toBe(`${MODE_PROFILES[DEFAULT_MODE].zoneNamePattern} 1`);
  });

  // -- Controls: well-formed input must keep behaving exactly as before --

  it('control: getModeProfile(undefined) still returns the DEFAULT_MODE profile silently (no warning)', () => {
    warnSpy.mockClear();
    const profile = getModeProfile(undefined);
    expect(profile.mode).toBe(DEFAULT_MODE);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('control: getModeProfile still returns the exact profile for every valid mode, with no warning', () => {
    for (const mode of AUTHORING_MODES) {
      warnSpy.mockClear();
      const profile = getModeProfile(mode);
      expect(profile.mode).toBe(mode);
      expect(profile).toBe(MODE_PROFILES[mode]);
      expect(warnSpy).not.toHaveBeenCalled();
    }
  });

  it('control: generateZoneName still produces the documented example for every valid mode', () => {
    expect(generateZoneName('dungeon', 3)).toBe('Chamber 3');
    for (const mode of AUTHORING_MODES) {
      expect(generateZoneName(mode, 1)).toBe(`${MODE_PROFILES[mode].zoneNamePattern} 1`);
    }
  });
});
