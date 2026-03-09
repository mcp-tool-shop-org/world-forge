import { describe, it, expect } from 'vitest';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import { useKitStore } from '../kits/kit-store.js';
import { serializeKit, prepareKitImport } from '../kits/bundle.js';
import type { StarterKit } from '../kits/types.js';
import type { SearchResult } from '../panels/SearchOverlay.js';

const sampleInput = {
  name: 'Provenance Test Kit',
  description: 'Testing provenance tracking',
  icon: '🏷️',
  modes: ['dungeon' as const],
  tags: ['test'],
  project: BUILTIN_KITS[0].project,
  presetRefs: { region: [] as string[], encounter: [] as string[] },
  guideHints: {},
};

function resetStore() {
  useKitStore.setState({ kits: [...BUILTIN_KITS] });
}

describe('provenance: saveKit', () => {
  it('sets source to "local" by default', () => {
    resetStore();
    const saved = useKitStore.getState().saveKit(sampleInput);
    expect(saved.source).toBe('local');
  });

  it('preserves explicit source when provided', () => {
    resetStore();
    const saved = useKitStore.getState().saveKit({ ...sampleInput, source: 'imported' });
    expect(saved.source).toBe('imported');
  });
});

describe('provenance: importKit', () => {
  it('sets source to "imported" via prepareKitImport', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    const parsed = prepareKitImport(bundle);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.kit.source).toBe('imported');

    resetStore();
    const imported = useKitStore.getState().importKit(parsed.kit);
    expect(imported.source).toBe('imported');
  });
});

describe('provenance: duplicateKit', () => {
  it('preserves source "imported" when duplicating imported kit', () => {
    resetStore();
    const imported = useKitStore.getState().importKit({ ...sampleInput, source: 'imported' });
    const copy = useKitStore.getState().duplicateKit(imported.id);
    expect(copy).toBeDefined();
    expect(copy!.source).toBe('imported');
  });

  it('preserves source "local" when duplicating local kit', () => {
    resetStore();
    const saved = useKitStore.getState().saveKit({ ...sampleInput, source: 'local' });
    const copy = useKitStore.getState().duplicateKit(saved.id);
    expect(copy).toBeDefined();
    expect(copy!.source).toBe('local');
  });

  it('duplicating built-in kit gets undefined source', () => {
    resetStore();
    const copy = useKitStore.getState().duplicateKit(BUILTIN_KITS[0].id);
    expect(copy).toBeDefined();
    expect(copy!.source).toBeUndefined();
    expect(copy!.builtIn).toBe(false);
  });
});

describe('provenance: search index three-way status', () => {
  // Mirrors the logic in SearchOverlay.tsx
  function kitSearchDetail(kit: StarterKit): string {
    const status = kit.builtIn ? 'built-in' : kit.source === 'imported' ? 'imported' : 'custom';
    const modeTag = kit.modes.join(', ');
    return `${status} kit [${modeTag}]`;
  }

  it('shows "built-in" for built-in kits', () => {
    expect(kitSearchDetail(BUILTIN_KITS[0])).toContain('built-in');
  });

  it('shows "imported" for imported kits', () => {
    const importedKit: StarterKit = {
      ...BUILTIN_KITS[0],
      id: 'imported-1',
      builtIn: false,
      source: 'imported',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(kitSearchDetail(importedKit)).toContain('imported');
    expect(kitSearchDetail(importedKit)).not.toContain('built-in');
    expect(kitSearchDetail(importedKit)).not.toContain('custom');
  });

  it('shows "custom" for local kits', () => {
    const localKit: StarterKit = {
      ...BUILTIN_KITS[0],
      id: 'local-1',
      builtIn: false,
      source: 'local',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(kitSearchDetail(localKit)).toContain('custom');
    expect(kitSearchDetail(localKit)).not.toContain('imported');
    expect(kitSearchDetail(localKit)).not.toContain('built-in');
  });

  it('shows "custom" for kits without source field (backward compat)', () => {
    const legacyKit: StarterKit = {
      ...BUILTIN_KITS[0],
      id: 'legacy-1',
      builtIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // source is undefined → treated as custom
    expect(kitSearchDetail(legacyKit)).toContain('custom');
  });
});
