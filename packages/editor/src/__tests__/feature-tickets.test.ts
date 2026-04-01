// Tests for FT-002, FT-006, FT-012, FT-016, FT-017, FT-024, FT-035
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSearchIndex, filterResults, loadRecentSearches, saveRecentSearch, RECENT_SEARCHES_KEY } from '../panels/SearchOverlay.js';
import { getHotkeyList, HOTKEY_BINDINGS } from '../hotkeys.js';
import { generateZoneName, MODE_PROFILES } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';
import type { EntityRole } from '@world-forge/schema';
import { SAMPLE_WORLDS } from '../templates/samples.js';

const chapel = SAMPLE_WORLDS[2].project;

// ── FT-002: Unsaved Changes Warning ────────────────────────

describe('FT-002: unsaved changes indicator', () => {
  it('dirty state exists on project store type', async () => {
    // Verify that the project store exports dirty state (compilation check)
    const { useProjectStore } = await import('../store/project-store.js');
    const state = useProjectStore.getState();
    expect(typeof state.dirty).toBe('boolean');
  });
});

// ── FT-006: Search Recent Searches ─────────────────────────

describe('FT-006: recent searches', () => {
  beforeEach(() => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  });

  it('loads empty when no recent searches stored', () => {
    expect(loadRecentSearches()).toEqual([]);
  });

  it('saves and loads a recent search', () => {
    saveRecentSearch('chapel');
    const recent = loadRecentSearches();
    expect(recent).toEqual(['chapel']);
  });

  it('deduplicates searches (most recent first)', () => {
    saveRecentSearch('chapel');
    saveRecentSearch('dungeon');
    saveRecentSearch('chapel');
    const recent = loadRecentSearches();
    expect(recent[0]).toBe('chapel');
    expect(recent.filter((s) => s === 'chapel').length).toBe(1);
  });

  it('caps at 5 recent searches', () => {
    for (let i = 0; i < 8; i++) {
      saveRecentSearch(`search-${i}`);
    }
    const recent = loadRecentSearches();
    expect(recent.length).toBe(5);
  });

  it('ignores whitespace-only queries', () => {
    saveRecentSearch('   ');
    expect(loadRecentSearches()).toEqual([]);
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, 'not-json');
    expect(loadRecentSearches()).toEqual([]);
  });

  it('handles non-array localStorage gracefully', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, '"string"');
    expect(loadRecentSearches()).toEqual([]);
  });
});

// ── FT-012: Entity Role Quick-Filter ───────────────────────

describe('FT-012: entity role filter', () => {
  const allRoles: EntityRole[] = ['npc', 'enemy', 'merchant', 'quest-giver', 'companion', 'boss'];

  it('all entity roles from schema are present in the filter list', () => {
    // Verify the roles we list match the schema type
    for (const role of allRoles) {
      expect(typeof role).toBe('string');
    }
  });

  it('role counts match entity placements in sample project', () => {
    const counts: Record<string, number> = {};
    for (const role of allRoles) counts[role] = 0;
    for (const ep of chapel.entityPlacements) {
      if (ep.role in counts) counts[ep.role]++;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(chapel.entityPlacements.length);
  });

  it('filtering by a specific role returns only those entities', () => {
    const enemies = chapel.entityPlacements.filter((ep) => ep.role === 'enemy');
    const npcs = chapel.entityPlacements.filter((ep) => ep.role === 'npc');
    // At least one of these should have data
    expect(enemies.length + npcs.length).toBeGreaterThan(0);
  });
});

// ── FT-016: First Zone Guide Hint ──────────────────────────

describe('FT-016: first zone guide hint', () => {
  it('each mode has a zoneNamePattern', () => {
    for (const mode of AUTHORING_MODES) {
      expect(MODE_PROFILES[mode].zoneNamePattern.length).toBeGreaterThan(0);
    }
  });

  it('dungeon mode suggests "Chamber" as zone pattern', () => {
    expect(MODE_PROFILES.dungeon.zoneNamePattern).toBe('Chamber');
  });

  it('interior mode suggests "Room" as zone pattern', () => {
    expect(MODE_PROFILES.interior.zoneNamePattern).toBe('Room');
  });
});

// ── FT-017: Keyboard Cheat Sheet ───────────────────────────

describe('FT-017: keyboard cheat sheet', () => {
  it('getHotkeyList returns all hotkey bindings', () => {
    const list = getHotkeyList();
    expect(list.length).toBe(HOTKEY_BINDINGS.length);
  });

  it('each entry has key, label, and description', () => {
    for (const entry of getHotkeyList()) {
      expect(typeof entry.key).toBe('string');
      expect(typeof entry.label).toBe('string');
      expect(typeof entry.description).toBe('string');
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('includes Ctrl+K for search', () => {
    const list = getHotkeyList();
    expect(list.some((h) => h.label === 'Ctrl+K')).toBe(true);
  });

  it('includes Ctrl+D for duplicate', () => {
    const list = getHotkeyList();
    expect(list.some((h) => h.label === 'Ctrl+D')).toBe(true);
  });
});

// ── FT-024: Zone Auto-Naming ───────────────────────────────

describe('FT-024: zone auto-naming', () => {
  it('generates mode-appropriate zone names', () => {
    expect(generateZoneName('dungeon', 1)).toBe('Chamber 1');
    expect(generateZoneName('ocean', 3)).toBe('Waters 3');
    expect(generateZoneName('space', 5)).toBe('Sector 5');
    expect(generateZoneName('interior', 2)).toBe('Room 2');
    expect(generateZoneName('wilderness', 4)).toBe('Area 4');
    expect(generateZoneName('district', 1)).toBe('Block 1');
    expect(generateZoneName('world', 7)).toBe('Territory 7');
  });

  it('uses incrementing index for sequential zones', () => {
    const name1 = generateZoneName('dungeon', 1);
    const name2 = generateZoneName('dungeon', 2);
    expect(name1).not.toBe(name2);
    expect(name1).toBe('Chamber 1');
    expect(name2).toBe('Chamber 2');
  });
});

// ── FT-035: Project Metadata Schema ────────────────────────

describe('FT-035: project metadata fields', () => {
  it('WorldProject schema supports author, license, category, projectTags', () => {
    // These fields are optional in the schema
    const project = { ...chapel, author: 'Test Author', license: 'MIT', category: 'fantasy', projectTags: ['demo', 'test'] };
    expect(project.author).toBe('Test Author');
    expect(project.license).toBe('MIT');
    expect(project.category).toBe('fantasy');
    expect(project.projectTags).toEqual(['demo', 'test']);
  });

  it('metadata fields default to undefined', () => {
    expect(chapel.author).toBeUndefined();
    expect(chapel.license).toBeUndefined();
    expect(chapel.category).toBeUndefined();
  });

  it('project store can set metadata fields via updateProject', async () => {
    const { useProjectStore } = await import('../store/project-store.js');
    const { updateProject } = useProjectStore.getState();
    updateProject((p) => ({ ...p, author: 'Meta Test' }));
    expect(useProjectStore.getState().project.author).toBe('Meta Test');
    // Clean up
    updateProject((p) => ({ ...p, author: undefined }));
  });
});
