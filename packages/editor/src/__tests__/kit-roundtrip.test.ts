import { describe, it, expect } from 'vitest';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import { useKitStore } from '../kits/kit-store.js';
import { serializeKit, prepareKitImport } from '../kits/bundle.js';
import { validateKit } from '../kits/validate-kit.js';
import type { StarterKit } from '../kits/types.js';

function resetStore() {
  useKitStore.setState({ kits: [...BUILTIN_KITS] });
}

describe('full round-trip', () => {
  it('save custom kit → export → parse → import as new → all fields match', () => {
    resetStore();
    const saved = useKitStore.getState().saveKit({
      name: 'Round-Trip Kit',
      description: 'Testing full cycle',
      icon: '🔄',
      modes: ['dungeon'],
      tags: ['test', 'roundtrip'],
      project: BUILTIN_KITS[0].project,
      presetRefs: { region: ['cave-system'], encounter: ['goblin-ambush'] },
      guideHints: { zone: { label: 'Add a chamber', description: 'Place your first dungeon room.' } },
    });

    // Export
    const bundle = serializeKit(saved);

    // Parse + validate
    const parsed = prepareKitImport(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.isValid).toBe(true);

    // Import as new
    resetStore();
    const imported = useKitStore.getState().importKit(parsed.kit);

    // Verify all fields match
    expect(imported.name).toBe(saved.name);
    expect(imported.description).toBe(saved.description);
    expect(imported.icon).toBe(saved.icon);
    expect(imported.modes).toEqual(saved.modes);
    expect(imported.tags).toEqual(saved.tags);
    expect(imported.project.zones.length).toBe(saved.project.zones.length);
    expect(imported.project.entityPlacements.length).toBe(saved.project.entityPlacements.length);
    expect(imported.project.dialogues.length).toBe(saved.project.dialogues.length);
    expect(imported.presetRefs).toEqual(saved.presetRefs);
    expect(imported.guideHints).toEqual(saved.guideHints);
    expect(imported.id).not.toBe(saved.id); // new ID
    expect(imported.builtIn).toBe(false);
    expect(imported.source).toBe('imported');
  });

  it('export built-in → import → project content matches original', () => {
    for (const builtIn of BUILTIN_KITS) {
      const bundle = serializeKit(builtIn);
      const parsed = prepareKitImport(bundle);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;

      resetStore();
      const imported = useKitStore.getState().importKit(parsed.kit);

      expect(imported.name).toBe(builtIn.name);
      expect(imported.modes).toEqual(builtIn.modes);
      expect(imported.project.zones.length).toBe(builtIn.project.zones.length);
      expect(imported.project.entityPlacements.length).toBe(builtIn.project.entityPlacements.length);
      expect(imported.project.dialogues.length).toBe(builtIn.project.dialogues.length);
      expect(imported.project.progressionTrees.length).toBe(builtIn.project.progressionTrees.length);
      expect(imported.project.itemPlacements.length).toBe(builtIn.project.itemPlacements.length);
    }
  });

  it('export strips id, builtIn, createdAt, updatedAt', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    expect(bundle).not.toHaveProperty('id');
    expect(bundle).not.toHaveProperty('builtIn');
    expect(bundle).not.toHaveProperty('createdAt');
    expect(bundle).not.toHaveProperty('updatedAt');
    expect(bundle).not.toHaveProperty('source');
  });

  it('import assigns new ID different from original', () => {
    const saved = useKitStore.getState().saveKit({
      name: 'ID Test',
      description: '',
      icon: '',
      modes: ['dungeon'],
      tags: [],
      project: BUILTIN_KITS[0].project,
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    const bundle = serializeKit(saved);
    const parsed = prepareKitImport(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const imported = useKitStore.getState().importKit(parsed.kit);
    expect(imported.id).not.toBe(saved.id);
    expect(imported.id).toMatch(/^kit-\d+$/);
  });

  it('imported kit passes validateKit cleanly', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    const parsed = prepareKitImport(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    resetStore();
    const imported = useKitStore.getState().importKit(parsed.kit);
    const validation = validateKit(imported);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('imported kit with valid preset refs produces no validation errors', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    const parsed = prepareKitImport(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    // prepareKitImport already ran validation
    expect(parsed.validationErrors).toHaveLength(0);
  });
});
