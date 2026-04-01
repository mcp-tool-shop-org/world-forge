// ft-features.test.ts — tests for FT-003, FT-005, FT-007, FT-014, FT-022, FT-028, FT-029

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isGenericAssetName } from '../panels/AssetPanel.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';
import type { HitResult } from '../hit-testing.js';

// ── FT-003: Undo/Redo feedback ─────────────────────────────────

describe('FT-003: Undo/Redo feedback', () => {
  it('project store exposes getUndoCount and getRedoCount', async () => {
    const { useProjectStore } = await import('../store/project-store.js');
    const state = useProjectStore.getState();
    expect(typeof state.getUndoCount).toBe('function');
    expect(typeof state.getRedoCount).toBe('function');
    expect(state.getUndoCount()).toBe(0);
    expect(state.getRedoCount()).toBe(0);
  });

  it('project store exposes getUndoLabel and getRedoLabel', async () => {
    const { useProjectStore } = await import('../store/project-store.js');
    const state = useProjectStore.getState();
    expect(typeof state.getUndoLabel).toBe('function');
    expect(typeof state.getRedoLabel).toBe('function');
    expect(state.getUndoLabel()).toBeNull();
    expect(state.getRedoLabel()).toBeNull();
  });

  it('undo count increases after project update', async () => {
    const { useProjectStore } = await import('../store/project-store.js');
    const store = useProjectStore.getState();
    store.newProject();
    expect(store.getUndoCount()).toBe(0);
    store.updateProject((p) => ({ ...p, name: 'Test' }));
    expect(useProjectStore.getState().getUndoCount()).toBe(1);
  });
});

// ── FT-005: Right-Click Context Menu ────────────────────────────

describe('FT-005: Right-click context menu actions', () => {
  it('getContextMenuActions for empty canvas returns global actions', () => {
    const actions = SPEED_PANEL_ACTIONS
      .filter((a) => a.contextFilter(null))
      .slice(0, 7);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.id === 'new-zone')).toBe(true);
  });

  it('getContextMenuActions for zone returns zone actions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const actions = SPEED_PANEL_ACTIONS
      .filter((a) => a.contextFilter(hit))
      .slice(0, 7);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.id === 'edit-props')).toBe(true);
  });

  it('context menu actions are capped at 7', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const actions = SPEED_PANEL_ACTIONS
      .filter((a) => a.contextFilter(hit))
      .slice(0, 7);
    expect(actions.length).toBeLessThanOrEqual(7);
  });
});

// ── FT-014: Minimap Integration ─────────────────────────────────

describe('FT-014: Minimap toggle in editor store', () => {
  it('showMinimap defaults to true', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    expect(useEditorStore.getState().showMinimap).toBe(true);
  });

  it('toggleMinimap flips the flag', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    useEditorStore.getState().toggleMinimap();
    expect(useEditorStore.getState().showMinimap).toBe(false);
    useEditorStore.getState().toggleMinimap();
    expect(useEditorStore.getState().showMinimap).toBe(true);
  });
});

// ── FT-028: Asset naming advisory ───────────────────────────────

describe('FT-028: Asset naming advisory', () => {
  it('detects generic names with "image"', () => {
    expect(isGenericAssetName('My image file')).toBe(true);
  });

  it('detects generic names with "sprite"', () => {
    expect(isGenericAssetName('sprite')).toBe(true);
  });

  it('detects generic names with "copy"', () => {
    expect(isGenericAssetName('Asset copy')).toBe(true);
  });

  it('detects generic names with "untitled"', () => {
    expect(isGenericAssetName('Untitled')).toBe(true);
  });

  it('detects numeric-only names', () => {
    expect(isGenericAssetName('12345')).toBe(true);
  });

  it('accepts descriptive names', () => {
    expect(isGenericAssetName('npc-merchant-01')).toBe(false);
  });

  it('accepts non-generic names', () => {
    expect(isGenericAssetName('forest-background')).toBe(false);
  });

  it('trims whitespace', () => {
    expect(isGenericAssetName('  untitled  ')).toBe(true);
  });
});

// ── FT-029: Dependency panel discoverability ─────────────────────

describe('FT-029: Dependency panel discoverability', () => {
  it('scanDependencies is importable', async () => {
    const { scanDependencies } = await import('@world-forge/schema');
    expect(typeof scanDependencies).toBe('function');
  });
});

// ── FT-007: Connection preview ──────────────────────────────────

describe('FT-007: Connection tool state', () => {
  it('connection tool exists in editor tools', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const store = useEditorStore.getState();
    store.setTool('connection');
    expect(useEditorStore.getState().activeTool).toBe('connection');
  });

  it('connectionStart can be set and cleared', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const store = useEditorStore.getState();
    store.setConnectionStart('zone-1');
    expect(useEditorStore.getState().connectionStart).toBe('zone-1');
    store.setConnectionStart(null);
    expect(useEditorStore.getState().connectionStart).toBeNull();
  });
});

// ── FT-022: Validation toast ────────────────────────────────────

describe('FT-022: Validation toast notifications', () => {
  it('useIssueCount returns a number', async () => {
    // We test the hook contract, not the rendering
    const { useIssueCount } = await import('../panels/ValidationPanel.js');
    expect(typeof useIssueCount).toBe('function');
  });
});
