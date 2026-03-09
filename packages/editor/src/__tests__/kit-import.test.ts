import { describe, it, expect } from 'vitest';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import { serializeKit, prepareKitImport } from '../kits/bundle.js';
import type { StarterKit } from '../kits/types.js';
import { useKitStore } from '../kits/kit-store.js';

const sampleInput = {
  name: 'Test Import Kit',
  description: 'A test kit for import',
  icon: '🧪',
  modes: ['dungeon' as const],
  tags: ['test'],
  project: BUILTIN_KITS[0].project,
  presetRefs: { region: [] as string[], encounter: [] as string[] },
  guideHints: {},
  source: 'imported' as const,
};

function resetStore() {
  useKitStore.setState({ kits: [...BUILTIN_KITS] });
}

describe('importKit store method', () => {
  it('creates new kit with generated ID', () => {
    resetStore();
    const result = useKitStore.getState().importKit(sampleInput);
    expect(result.id).toMatch(/^kit-\d+$/);
    expect(result.name).toBe('Test Import Kit');
  });

  it('sets builtIn: false', () => {
    resetStore();
    const result = useKitStore.getState().importKit(sampleInput);
    expect(result.builtIn).toBe(false);
  });

  it('sets timestamps', () => {
    resetStore();
    const result = useKitStore.getState().importKit(sampleInput);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('deep-clones project', () => {
    resetStore();
    const result = useKitStore.getState().importKit(sampleInput);
    expect(result.project.zones).not.toBe(sampleInput.project.zones);
    expect(result.project.zones.length).toBe(sampleInput.project.zones.length);
  });

  it('with replaceId overwrites existing custom kit', () => {
    resetStore();
    // First save a custom kit
    const saved = useKitStore.getState().importKit({ ...sampleInput, name: 'Original' });
    const before = useKitStore.getState().kits.length;
    // Replace it
    const replaced = useKitStore.getState().importKit({ ...sampleInput, name: 'Replaced' }, saved.id);
    expect(replaced.id).toBe(saved.id);
    expect(replaced.name).toBe('Replaced');
    expect(useKitStore.getState().kits.length).toBe(before); // count unchanged
  });

  it('with replaceId preserves original createdAt', () => {
    resetStore();
    const saved = useKitStore.getState().importKit(sampleInput);
    const originalCreatedAt = saved.createdAt;
    const replaced = useKitStore.getState().importKit({ ...sampleInput, name: 'v2' }, saved.id);
    expect(replaced.createdAt).toBe(originalCreatedAt);
  });

  it('with replaceId pointing to built-in falls through to new kit', () => {
    resetStore();
    const before = useKitStore.getState().kits.length;
    const result = useKitStore.getState().importKit(sampleInput, BUILTIN_KITS[0].id);
    // Should create a new kit, not replace the built-in
    expect(result.id).not.toBe(BUILTIN_KITS[0].id);
    expect(useKitStore.getState().kits.length).toBe(before + 1);
  });

  it('with replaceId pointing to nonexistent kit creates new', () => {
    resetStore();
    const before = useKitStore.getState().kits.length;
    const result = useKitStore.getState().importKit(sampleInput, 'nonexistent-id');
    expect(result.id).toMatch(/^kit-\d+$/);
    expect(useKitStore.getState().kits.length).toBe(before + 1);
  });
});

describe('collision detection', () => {
  it('finds case-insensitive name match', () => {
    resetStore();
    useKitStore.getState().importKit({ ...sampleInput, name: 'My Kit' });
    const kits = useKitStore.getState().kits;
    const collision = kits.find((k) => k.name.toLowerCase() === 'my kit');
    expect(collision).toBeDefined();
    expect(collision!.name).toBe('My Kit');
  });

  it('import as copy with suffix does not re-collide', () => {
    resetStore();
    useKitStore.getState().importKit({ ...sampleInput, name: 'My Kit' });
    useKitStore.getState().importKit({ ...sampleInput, name: 'My Kit (imported)' });
    const kits = useKitStore.getState().kits;
    const matches = kits.filter((k) => k.name.startsWith('My Kit'));
    expect(matches.length).toBe(2);
    expect(matches.map((m) => m.name).sort()).toEqual(['My Kit', 'My Kit (imported)']);
  });

  it('built-in collision detected correctly', () => {
    resetStore();
    const kits = useKitStore.getState().kits;
    const collision = kits.find((k) => k.name.toLowerCase() === BUILTIN_KITS[0].name.toLowerCase());
    expect(collision).toBeDefined();
    expect(collision!.builtIn).toBe(true);
  });
});

describe('export + import round-trip', () => {
  it('preserves all content fields', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    const parsed = prepareKitImport(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    resetStore();
    const imported = useKitStore.getState().importKit(parsed.kit);
    expect(imported.name).toBe(BUILTIN_KITS[0].name);
    expect(imported.modes).toEqual(BUILTIN_KITS[0].modes);
    expect(imported.project.zones.length).toBe(BUILTIN_KITS[0].project.zones.length);
    expect(imported.builtIn).toBe(false);
    expect(imported.source).toBe('imported');
  });
});
