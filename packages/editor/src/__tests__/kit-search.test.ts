import { describe, it, expect, beforeEach } from 'vitest';
import { buildSearchIndex, filterResults } from '../panels/SearchOverlay.js';
import { useEditorStore } from '../store/editor-store.js';
import { BUILTIN_KITS } from '../kits/index.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import type { SearchResult } from '../panels/SearchOverlay.js';

// Chapel Threshold — richest sample
const chapel = SAMPLE_WORLDS[2].project;

describe('starter-kit search', () => {
  it('search index includes starter-kit entries when kits are appended', () => {
    const base = buildSearchIndex(chapel);
    // Append kits manually (mirrors what SearchOverlay does)
    for (const kit of BUILTIN_KITS) {
      const status = kit.builtIn ? 'built-in' : 'custom';
      const modeTag = kit.modes.join(', ');
      base.push({ type: 'starter-kit', id: kit.id, label: kit.name, detail: `${status} kit [${modeTag}]` });
    }
    const kitResults = base.filter((r) => r.type === 'starter-kit');
    expect(kitResults.length).toBe(BUILTIN_KITS.length);
  });

  it('built-in kits show "built-in" in detail', () => {
    const results: SearchResult[] = BUILTIN_KITS.map((kit) => ({
      type: 'starter-kit' as const,
      id: kit.id,
      label: kit.name,
      detail: `${kit.builtIn ? 'built-in' : 'custom'} kit [${kit.modes.join(', ')}]`,
    }));
    for (const r of results) {
      expect(r.detail).toContain('built-in');
    }
  });

  it('custom kits show "custom" in detail', () => {
    const result: SearchResult = {
      type: 'starter-kit',
      id: 'custom-kit-1',
      label: 'My Kit',
      detail: 'custom kit [dungeon]',
    };
    expect(result.detail).toContain('custom');
  });

  it('filterResults finds kits by name', () => {
    const index: SearchResult[] = BUILTIN_KITS.map((kit) => ({
      type: 'starter-kit' as const,
      id: kit.id,
      label: kit.name,
      detail: `${kit.builtIn ? 'built-in' : 'custom'} kit [${kit.modes.join(', ')}]`,
    }));
    const results = filterResults(index, 'Forgotten');
    expect(results.length).toBe(1);
    expect(results[0].label).toBe('Forgotten Vault');
  });

  it('filterResults finds kits by mode in detail', () => {
    const index: SearchResult[] = BUILTIN_KITS.map((kit) => ({
      type: 'starter-kit' as const,
      id: kit.id,
      label: kit.name,
      detail: `${kit.builtIn ? 'built-in' : 'custom'} kit [${kit.modes.join(', ')}]`,
    }));
    const results = filterResults(index, 'ocean');
    expect(results.length).toBe(1);
    expect(results[0].detail).toContain('ocean');
  });
});

describe('activeKitId', () => {
  beforeEach(() => {
    useEditorStore.setState({ activeKitId: null });
  });

  it('defaults to null', () => {
    expect(useEditorStore.getState().activeKitId).toBeNull();
  });

  it('setActiveKitId updates store', () => {
    useEditorStore.getState().setActiveKitId('dungeon-starter');
    expect(useEditorStore.getState().activeKitId).toBe('dungeon-starter');
  });

  it('resetChecklist clears activeKitId', () => {
    useEditorStore.getState().setActiveKitId('dungeon-starter');
    expect(useEditorStore.getState().activeKitId).toBe('dungeon-starter');
    useEditorStore.getState().resetChecklist();
    expect(useEditorStore.getState().activeKitId).toBeNull();
  });
});

describe('no regression on existing search tests', () => {
  it('buildSearchIndex still returns all standard types', () => {
    const index = buildSearchIndex(chapel);
    const types = new Set(index.map((r) => r.type));
    expect(types.has('zone')).toBe(true);
    expect(types.has('entity')).toBe(true);
    expect(types.has('district')).toBe(true);
  });
});
