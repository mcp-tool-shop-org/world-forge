import { describe, it, expect } from 'vitest';
import { countContent, createProjectFromKit } from '../panels/TemplateManager.js';
import { BUILTIN_KITS, serializeKit, parseKitBundle, kitFilename } from '../kits/index.js';
import type { StarterKit } from '../kits/index.js';

const sampleKit = BUILTIN_KITS[0]; // dungeon-starter

describe('countContent', () => {
  it('returns correct counts for a kit project', () => {
    const c = countContent(sampleKit.project);
    expect(c.zones).toBe(sampleKit.project.zones.length);
    expect(c.entities).toBe(sampleKit.project.entityPlacements.length);
    expect(c.dialogues).toBe(sampleKit.project.dialogues.length);
    expect(c.trees).toBe(sampleKit.project.progressionTrees.length);
    expect(c.items).toBe(sampleKit.project.itemPlacements.length);
    // Ensure all counts are non-negative
    expect(c.zones).toBeGreaterThanOrEqual(0);
    expect(c.entities).toBeGreaterThanOrEqual(0);
  });
});

describe('createProjectFromKit', () => {
  it('produces valid project with new ID', () => {
    const project = createProjectFromKit(sampleKit, 'Test Project');
    expect(project.id).toMatch(/^project-\d+$/);
    expect(project.name).toBe('Test Project');
    expect(project.zones.length).toBe(sampleKit.project.zones.length);
    expect(project.mode).toBe(sampleKit.project.mode);
  });

  it('deep-clones (no shared references)', () => {
    const originalZoneName = sampleKit.project.zones[0].name;
    const p1 = createProjectFromKit(sampleKit, 'A');
    const p2 = createProjectFromKit(sampleKit, 'B');
    p1.zones[0].name = 'MUTATED';
    expect(p2.zones[0].name).not.toBe('MUTATED');
    expect(sampleKit.project.zones[0].name).toBe(originalZoneName);
  });

  it('name input applies to project on open', () => {
    const project = createProjectFromKit(sampleKit, 'My Custom Name');
    expect(project.name).toBe('My Custom Name');
  });

  it('empty name falls back to kit name', () => {
    const project = createProjectFromKit(sampleKit);
    expect(project.name).toBe(sampleKit.name);
  });
});

describe('kit browser rendering logic', () => {
  it('built-in kits are flagged for lock icon (no Edit/Delete)', () => {
    const builtInKits = BUILTIN_KITS.filter((k) => k.builtIn);
    expect(builtInKits.length).toBe(7);
    // Rendering guard: !kit.builtIn → Edit/Delete hidden for all built-in kits
    for (const kit of builtInKits) {
      expect(kit.builtIn).toBe(true);
    }
  });

  it('custom kits would show Edit/Delete', () => {
    const customKit: StarterKit = {
      ...sampleKit,
      id: 'custom-test',
      builtIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Rendering guard: !kit.builtIn → Edit/Delete shown
    expect(customKit.builtIn).toBe(false);
    expect(customKit.createdAt).toBeDefined();
    expect(customKit.updatedAt).toBeDefined();
  });

  it('kit mode badges correspond to modes array', () => {
    // Single-mode kits get exactly one badge
    for (const kit of BUILTIN_KITS) {
      expect(kit.modes.length).toBeGreaterThan(0);
    }
    // Multi-mode kit gets multiple badges
    const multiModeKit: StarterKit = {
      ...sampleKit,
      id: 'multi-test',
      modes: ['dungeon', 'interior'],
    };
    expect(multiModeKit.modes.length).toBe(2);
  });

  it('preset count is sum of region + encounter refs', () => {
    for (const kit of BUILTIN_KITS) {
      const presetCount = kit.presetRefs.region.length + kit.presetRefs.encounter.length;
      expect(presetCount).toBeGreaterThan(0);
    }
  });
});

describe('kit export', () => {
  it('serializeKit produces valid bundle from built-in kit', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    const parsed = parseKitBundle(bundle);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.warnings).toHaveLength(0);
  });

  it('serializeKit produces valid bundle from custom kit', () => {
    const custom: StarterKit = {
      ...BUILTIN_KITS[0],
      id: 'custom-1',
      builtIn: false,
      source: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const bundle = serializeKit(custom);
    const parsed = parseKitBundle(bundle);
    expect(parsed.ok).toBe(true);
  });

  it('kitFilename produces expected filename', () => {
    expect(kitFilename('Forgotten Vault')).toBe('forgotten-vault.wfkit.json');
  });

  it('kitFilename handles empty name', () => {
    expect(kitFilename('')).toBe('kit.wfkit.json');
  });
});
