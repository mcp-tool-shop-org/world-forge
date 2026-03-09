import { describe, it, expect, beforeEach } from 'vitest';
import { useKitStore } from '../kits/index.js';
import { BUILTIN_KITS } from '../kits/index.js';
import type { StarterKit } from '../kits/index.js';
import type { AuthoringMode } from '@world-forge/schema';

const minimalProject = BUILTIN_KITS[0].project;

beforeEach(() => {
  useKitStore.setState({ kits: [...BUILTIN_KITS] });
});

describe('SaveKitModal logic', () => {
  it('captures project with correct name and auto-detected mode', () => {
    const { saveKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'My Dungeon Kit',
      description: 'A dungeon-themed starter.',
      icon: '\uD83D\uDDDD\uFE0F',
      modes: ['dungeon'],
      tags: ['dungeon', 'underground'],
      project: minimalProject,
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    expect(saved.name).toBe('My Dungeon Kit');
    expect(saved.modes).toEqual(['dungeon']);
    expect(saved.builtIn).toBe(false);
    expect(saved.id).toMatch(/^kit-\d+$/);
  });

  it('tags are split by comma and trimmed', () => {
    const tagsInput = ' fantasy , dungeon , underground ';
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    expect(tags).toEqual(['fantasy', 'dungeon', 'underground']);
  });

  it('empty tags are filtered out', () => {
    const tagsInput = 'fantasy, , , dungeon, ';
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    expect(tags).toEqual(['fantasy', 'dungeon']);
  });

  it('deep-clones project on save (no shared references)', () => {
    const { saveKit } = useKitStore.getState();
    const sourceProject = JSON.parse(JSON.stringify(minimalProject));
    const saved = saveKit({
      name: 'Clone Test',
      description: '',
      icon: '',
      modes: ['dungeon'],
      tags: [],
      project: sourceProject,
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    sourceProject.zones[0].name = 'MUTATED';
    const stored = useKitStore.getState().kits.find((k) => k.id === saved.id);
    expect(stored!.project.zones[0].name).not.toBe('MUTATED');
  });
});

describe('EditKitModal logic', () => {
  it('loads existing kit values for editing', () => {
    const { saveKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Editable Kit',
      description: 'Original description.',
      icon: '\uD83C\uDFAF',
      modes: ['ocean'],
      tags: ['pirate'],
      project: minimalProject,
      presetRefs: { region: ['ocean-port'], encounter: ['ocean-pirate-attack'] },
      guideHints: {},
    });
    const found = useKitStore.getState().kits.find((k) => k.id === saved.id);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Editable Kit');
    expect(found!.description).toBe('Original description.');
    expect(found!.modes).toEqual(['ocean']);
    expect(found!.presetRefs.region).toEqual(['ocean-port']);
  });

  it('updates name, modes, preset refs', () => {
    const { saveKit, updateKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Before',
      description: '',
      icon: '',
      modes: ['dungeon'],
      tags: [],
      project: minimalProject,
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    updateKit(saved.id, {
      name: 'After',
      modes: ['dungeon', 'interior'] as AuthoringMode[],
      presetRefs: { region: ['crypt-district'], encounter: ['boss-encounter'] },
    });
    const updated = useKitStore.getState().kits.find((k) => k.id === saved.id);
    expect(updated!.name).toBe('After');
    expect(updated!.modes).toEqual(['dungeon', 'interior']);
    expect(updated!.presetRefs.region).toEqual(['crypt-district']);
    expect(updated!.presetRefs.encounter).toEqual(['boss-encounter']);
    expect(updated!.updatedAt).toBeDefined();
  });

  it('updates guide hints', () => {
    const { saveKit, updateKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Hints Kit',
      description: '',
      icon: '',
      modes: ['dungeon'],
      tags: [],
      project: minimalProject,
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    updateKit(saved.id, {
      guideHints: {
        zone: { label: 'Custom Zone', description: 'Build your dungeon rooms' },
      },
    });
    const updated = useKitStore.getState().kits.find((k) => k.id === saved.id);
    expect(updated!.guideHints).toEqual({
      zone: { label: 'Custom Zone', description: 'Build your dungeon rooms' },
    });
  });
});

describe('duplicate built-in creates editable copy', () => {
  it('duplicates a built-in kit as non-built-in, then edits it', () => {
    const { duplicateKit, updateKit } = useKitStore.getState();
    const copy = duplicateKit(BUILTIN_KITS[0].id);
    expect(copy).toBeDefined();
    expect(copy!.builtIn).toBe(false);
    expect(copy!.name).toBe(`${BUILTIN_KITS[0].name} (copy)`);

    // Can edit the copy
    updateKit(copy!.id, { name: 'My Custom Dungeon' });
    const updated = useKitStore.getState().kits.find((k) => k.id === copy!.id);
    expect(updated!.name).toBe('My Custom Dungeon');
  });
});

describe('save-then-edit round-trip', () => {
  it('preserves all fields through save → edit cycle', () => {
    const { saveKit, updateKit } = useKitStore.getState();
    const saved = saveKit({
      name: 'Round Trip',
      description: 'Test description',
      icon: '\uD83C\uDF1F',
      modes: ['ocean', 'space'] as AuthoringMode[],
      tags: ['maritime', 'sci-fi'],
      project: minimalProject,
      presetRefs: { region: ['ocean-port'], encounter: ['ocean-pirate-attack'] },
      guideHints: { zone: { label: 'Z', description: 'Build zones' } },
    });

    // Edit only the name
    updateKit(saved.id, { name: 'Round Trip v2' });

    const result = useKitStore.getState().kits.find((k) => k.id === saved.id)!;
    expect(result.name).toBe('Round Trip v2');
    expect(result.description).toBe('Test description');
    expect(result.icon).toBe('\uD83C\uDF1F');
    expect(result.modes).toEqual(['ocean', 'space']);
    expect(result.tags).toEqual(['maritime', 'sci-fi']);
    expect(result.presetRefs.region).toEqual(['ocean-port']);
    expect(result.guideHints).toEqual({ zone: { label: 'Z', description: 'Build zones' } });
    expect(result.builtIn).toBe(false);
    expect(result.createdAt).toBe(saved.createdAt);
    // updatedAt is refreshed (may match if same ms, but must be defined)
    expect(result.updatedAt).toBeDefined();
  });
});
