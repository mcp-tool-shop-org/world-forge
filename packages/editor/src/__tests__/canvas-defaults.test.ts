import { describe, it, expect } from 'vitest';
import { getModeProfile, getDefaultConnectionKind } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';

/**
 * These tests verify the mode-aware default logic consumed by Canvas.tsx.
 * Canvas uses these pure functions at object creation time:
 *   - getDefaultConnectionKind(project.mode) → connection kind
 *   - getModeProfile(project.mode).defaultEntityRole → entity role
 *   - getModeProfile(project.mode).encounterTypes[0] → encounter type
 *   - getModeProfile(project.mode).zoneNamePattern → zone name prefix
 */

describe('canvas connection defaults', () => {
  it('dungeon mode → door connection', () => {
    expect(getDefaultConnectionKind('dungeon')).toBe('door');
  });

  it('ocean mode → channel connection', () => {
    expect(getDefaultConnectionKind('ocean')).toBe('channel');
  });

  it('space mode → docking connection', () => {
    expect(getDefaultConnectionKind('space')).toBe('docking');
  });

  it('no mode (undefined) → door (dungeon default)', () => {
    expect(getDefaultConnectionKind(undefined)).toBe('door');
  });
});

describe('canvas entity defaults', () => {
  it('dungeon → enemy role', () => {
    expect(getModeProfile('dungeon').defaultEntityRole).toBe('enemy');
  });

  it('district → npc role', () => {
    expect(getModeProfile('district').defaultEntityRole).toBe('npc');
  });

  it('ocean → enemy role', () => {
    expect(getModeProfile('ocean').defaultEntityRole).toBe('enemy');
  });

  it('interior → npc role', () => {
    expect(getModeProfile('interior').defaultEntityRole).toBe('npc');
  });

  it('wilderness → enemy role', () => {
    expect(getModeProfile('wilderness').defaultEntityRole).toBe('enemy');
  });

  it('space → npc role', () => {
    expect(getModeProfile('space').defaultEntityRole).toBe('npc');
  });
});

describe('canvas encounter defaults', () => {
  it('dungeon → patrol encounter', () => {
    expect(getModeProfile('dungeon').encounterTypes[0]).toBe('patrol');
  });

  it('ocean → pirate encounter', () => {
    expect(getModeProfile('ocean').encounterTypes[0]).toBe('pirate');
  });

  it('space → pirate encounter', () => {
    expect(getModeProfile('space').encounterTypes[0]).toBe('pirate');
  });

  it('wilderness → patrol encounter', () => {
    expect(getModeProfile('wilderness').encounterTypes[0]).toBe('patrol');
  });
});

describe('canvas zone name defaults', () => {
  it('dungeon → "Chamber"', () => {
    expect(getModeProfile('dungeon').zoneNamePattern).toBe('Chamber');
  });

  it('ocean → "Waters"', () => {
    expect(getModeProfile('ocean').zoneNamePattern).toBe('Waters');
  });

  it('space → "Sector"', () => {
    expect(getModeProfile('space').zoneNamePattern).toBe('Sector');
  });

  it('interior → "Room"', () => {
    expect(getModeProfile('interior').zoneNamePattern).toBe('Room');
  });

  it('wilderness → "Area"', () => {
    expect(getModeProfile('wilderness').zoneNamePattern).toBe('Area');
  });

  it('no mode → "Chamber" (dungeon default)', () => {
    expect(getModeProfile(undefined).zoneNamePattern).toBe('Chamber');
  });
});
