import { describe, it, expect } from 'vitest';
import { validateProject, AUTHORING_MODES, isValidMode } from '@world-forge/schema';
import { BUILTIN_KITS } from '../kits/index.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from '../presets/built-ins.js';
import { MODE_STARTERS, createProjectFromModeStarter } from '../templates/registry.js';

const regionPresetIds = new Set(BUILTIN_REGION_PRESETS.map((p) => p.id));
const encounterPresetIds = new Set(BUILTIN_ENCOUNTER_PRESETS.map((p) => p.id));

describe('BUILTIN_KITS', () => {
  it('has exactly 7 entries (one per mode)', () => {
    expect(BUILTIN_KITS.length).toBe(7);
  });

  it('covers all 7 authoring modes', () => {
    const modes = BUILTIN_KITS.flatMap((k) => k.modes).sort();
    expect(modes).toEqual([...AUTHORING_MODES].sort());
  });

  it('all kit IDs are unique', () => {
    const ids = BUILTIN_KITS.map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all kits are builtIn', () => {
    for (const kit of BUILTIN_KITS) {
      expect(kit.builtIn).toBe(true);
    }
  });

  it('all kits have non-empty name, description, icon', () => {
    for (const kit of BUILTIN_KITS) {
      expect(kit.name.length).toBeGreaterThan(0);
      expect(kit.description.length).toBeGreaterThan(0);
      expect(kit.icon.length).toBeGreaterThan(0);
    }
  });

  it('all kits have non-empty tags', () => {
    for (const kit of BUILTIN_KITS) {
      expect(kit.tags.length).toBeGreaterThan(0);
    }
  });

  it('all kit modes contain valid AuthoringMode values', () => {
    for (const kit of BUILTIN_KITS) {
      for (const m of kit.modes) {
        expect(isValidMode(m)).toBe(true);
      }
    }
  });

  it('each kit project.mode is in its modes array', () => {
    for (const kit of BUILTIN_KITS) {
      expect(kit.modes).toContain(kit.project.mode);
    }
  });

  it('all kit guideHints default to empty objects', () => {
    for (const kit of BUILTIN_KITS) {
      expect(kit.guideHints).toEqual({});
    }
  });

  it('no kit has createdAt or updatedAt (built-in)', () => {
    for (const kit of BUILTIN_KITS) {
      expect(kit.createdAt).toBeUndefined();
      expect(kit.updatedAt).toBeUndefined();
    }
  });
});

describe.each(BUILTIN_KITS)('built-in kit: $name ($id)', (kit) => {
  it('project validates cleanly', () => {
    const result = validateProject(kit.project);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('all region preset refs exist in built-ins', () => {
    for (const refId of kit.presetRefs.region) {
      expect(regionPresetIds.has(refId)).toBe(true);
    }
  });

  it('all encounter preset refs exist in built-ins', () => {
    for (const refId of kit.presetRefs.encounter) {
      expect(encounterPresetIds.has(refId)).toBe(true);
    }
  });

  it('has at least one region preset ref', () => {
    expect(kit.presetRefs.region.length).toBeGreaterThanOrEqual(1);
  });

  it('has at least one encounter preset ref', () => {
    expect(kit.presetRefs.encounter.length).toBeGreaterThanOrEqual(1);
  });
});

describe('MODE_STARTERS backward compatibility', () => {
  it('still has 7 entries', () => {
    expect(MODE_STARTERS.length).toBe(7);
  });

  it('each entry has correct ModeStarter shape', () => {
    for (const s of MODE_STARTERS) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.name).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(typeof s.icon).toBe('string');
      expect(typeof s.mode).toBe('string');
      expect(s.project).toBeDefined();
    }
  });

  it('MODE_STARTERS[n].mode === BUILTIN_KITS[n].modes[0]', () => {
    for (let i = 0; i < BUILTIN_KITS.length; i++) {
      expect(MODE_STARTERS[i].mode).toBe(BUILTIN_KITS[i].modes[0]);
    }
  });

  it('MODE_STARTERS shares project references with BUILTIN_KITS', () => {
    for (let i = 0; i < BUILTIN_KITS.length; i++) {
      expect(MODE_STARTERS[i].project).toBe(BUILTIN_KITS[i].project);
    }
  });

  it('createProjectFromModeStarter still works with derived MODE_STARTERS', () => {
    const starter = MODE_STARTERS[0];
    const project = createProjectFromModeStarter('Test', starter);
    expect(project.name).toBe('Test');
    expect(project.id).toMatch(/^project-\d+$/);
    expect(validateProject(project)).toEqual({ valid: true, errors: [] });
  });

  it('deep-clones (no shared references with source)', () => {
    const starter = MODE_STARTERS[0];
    const p1 = createProjectFromModeStarter('A', starter);
    const p2 = createProjectFromModeStarter('B', starter);
    p1.zones[0].name = 'MODIFIED';
    expect(p2.zones[0].name).not.toBe('MODIFIED');
    expect(starter.project.zones[0].name).not.toBe('MODIFIED');
  });
});
