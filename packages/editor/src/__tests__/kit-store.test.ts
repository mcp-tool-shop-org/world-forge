import { describe, it, expect, beforeEach } from 'vitest';
import { useKitStore, filterKitsByMode } from '../kits/index.js';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import type { AuthoringMode } from '@world-forge/schema';

// Minimal valid project for custom kit tests
const minimalProject = BUILTIN_KITS[0].project;

beforeEach(() => {
  useKitStore.setState({ kits: [...BUILTIN_KITS] });
});

describe('kit-store', () => {
  it('starts with 7 built-in kits', () => {
    const { kits } = useKitStore.getState();
    expect(kits.length).toBe(7);
    expect(kits.every((k) => k.builtIn)).toBe(true);
  });

  it('saves a custom kit with generated ID and timestamps', () => {
    const { saveKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'My Kit',
      description: 'A test kit.',
      icon: '\uD83D\uDCE6',
      modes: ['dungeon'],
      tags: ['test'],
      project: minimalProject,
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    expect(saved.builtIn).toBe(false);
    expect(saved.id).toMatch(/^kit-\d+$/);
    expect(saved.createdAt).toBeDefined();
    expect(saved.updatedAt).toBeDefined();
    expect(useKitStore.getState().kits.length).toBe(8);
  });

  it('cannot delete a built-in kit', () => {
    const { deleteKit } = useKitStore.getState();
    deleteKit(BUILTIN_KITS[0].id);
    expect(useKitStore.getState().kits.length).toBe(7);
  });

  it('deletes a custom kit', () => {
    const { saveKit, deleteKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Temp Kit', description: '', icon: '', modes: ['dungeon'],
      tags: [], project: minimalProject,
      presetRefs: { region: [], encounter: [] }, guideHints: {},
    });
    expect(useKitStore.getState().kits.length).toBe(8);
    deleteKit(saved.id);
    expect(useKitStore.getState().kits.length).toBe(7);
  });

  it('cannot update a built-in kit', () => {
    const { updateKit } = useKitStore.getState();
    updateKit(BUILTIN_KITS[0].id, { name: 'Hacked' });
    expect(useKitStore.getState().kits[0].name).toBe(BUILTIN_KITS[0].name);
  });

  it('updates a custom kit', () => {
    const { saveKit, updateKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Original', description: '', icon: '', modes: ['dungeon'],
      tags: [], project: minimalProject,
      presetRefs: { region: [], encounter: [] }, guideHints: {},
    });
    updateKit(saved.id, { name: 'Renamed' });
    const found = useKitStore.getState().kits.find((k) => k.id === saved.id);
    expect(found?.name).toBe('Renamed');
    expect(found?.updatedAt).toBeDefined();
  });

  it('duplicates a built-in kit as non-built-in with (copy) suffix', () => {
    const { duplicateKit } = useKitStore.getState();
    const copy = duplicateKit(BUILTIN_KITS[0].id);
    expect(copy).toBeDefined();
    expect(copy!.builtIn).toBe(false);
    expect(copy!.name).toBe(`${BUILTIN_KITS[0].name} (copy)`);
    expect(copy!.id).toMatch(/^kit-\d+$/);
    expect(copy!.id).not.toBe(BUILTIN_KITS[0].id);
    expect(useKitStore.getState().kits.length).toBe(8);
  });

  it('duplicates a custom kit', () => {
    const { saveKit, duplicateKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Custom', description: '', icon: '', modes: ['ocean'],
      tags: ['pirate'], project: minimalProject,
      presetRefs: { region: [], encounter: [] }, guideHints: {},
    });
    const copy = duplicateKit(saved.id);
    expect(copy).toBeDefined();
    expect(copy!.name).toBe('Custom (copy)');
    expect(copy!.modes).toEqual(['ocean']);
    expect(useKitStore.getState().kits.length).toBe(9);
  });

  it('deep-clones saved kit project (no shared references)', () => {
    const { saveKit } = useKitStore.getState();
    const sourceProject = JSON.parse(JSON.stringify(minimalProject));
    const saved = saveKit({
      name: 'Clone Test', description: '', icon: '', modes: ['dungeon'],
      tags: [], project: sourceProject,
      presetRefs: { region: [], encounter: [] }, guideHints: {},
    });
    sourceProject.zones[0].name = 'MUTATED';
    const stored = useKitStore.getState().kits.find((k) => k.id === saved.id);
    expect(stored!.project.zones[0].name).not.toBe('MUTATED');
  });

  it('returns undefined when duplicating non-existent kit', () => {
    const { duplicateKit } = useKitStore.getState();
    expect(duplicateKit('nonexistent')).toBeUndefined();
  });
});

describe('filterKitsByMode', () => {
  it('returns all kits when mode is undefined', () => {
    const result = filterKitsByMode(BUILTIN_KITS, undefined);
    expect(result.length).toBe(BUILTIN_KITS.length);
  });

  it('returns matching kits for a specific mode', () => {
    const result = filterKitsByMode(BUILTIN_KITS, 'dungeon');
    expect(result.length).toBe(1);
    expect(result[0].modes).toContain('dungeon');
  });

  it('excludes non-matching kits', () => {
    const result = filterKitsByMode(BUILTIN_KITS, 'ocean');
    expect(result.every((k) => k.modes.includes('ocean'))).toBe(true);
    expect(result.length).toBe(1);
  });

  it('works with multi-mode kits', () => {
    const multiModeKit: any = {
      ...BUILTIN_KITS[0],
      id: 'multi-test',
      modes: ['dungeon', 'interior'] as AuthoringMode[],
    };
    const kits = [...BUILTIN_KITS, multiModeKit];
    const dungeonResult = filterKitsByMode(kits, 'dungeon');
    expect(dungeonResult.length).toBe(2); // original dungeon + multi
    const interiorResult = filterKitsByMode(kits, 'interior');
    expect(interiorResult.length).toBe(2); // original interior + multi
  });

  it('is a pure function (does not mutate input)', () => {
    const kits = [...BUILTIN_KITS];
    const original = kits.length;
    filterKitsByMode(kits, 'dungeon');
    expect(kits.length).toBe(original);
  });
});
