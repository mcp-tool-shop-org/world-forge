// ft009-ft010-ft018-ft019-ft025.test.ts — tests for FT-009, FT-010, FT-018, FT-019, FT-025

import { describe, it, expect, beforeEach } from 'vitest';

// ── FT-009: Per-Object Visibility Toggle ─────────────────────────

describe('FT-009: Per-Object Visibility Toggle', () => {
  beforeEach(async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    useEditorStore.getState().showAll();
  });

  it('editor store exposes hiddenIds, toggleHidden, isHidden', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const state = useEditorStore.getState();
    expect(state.hiddenIds).toBeInstanceOf(Set);
    expect(typeof state.toggleHidden).toBe('function');
    expect(typeof state.isHidden).toBe('function');
  });

  it('toggleHidden adds and removes IDs from hiddenIds', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const store = useEditorStore;

    store.getState().toggleHidden('zone-1');
    expect(store.getState().hiddenIds.has('zone-1')).toBe(true);
    expect(store.getState().isHidden('zone-1')).toBe(true);

    store.getState().toggleHidden('zone-1');
    expect(store.getState().hiddenIds.has('zone-1')).toBe(false);
    expect(store.getState().isHidden('zone-1')).toBe(false);
  });

  it('showAll clears all hidden IDs', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const store = useEditorStore;

    store.getState().toggleHidden('a');
    store.getState().toggleHidden('b');
    expect(store.getState().hiddenIds.size).toBe(2);

    store.getState().showAll();
    expect(store.getState().hiddenIds.size).toBe(0);
  });

  it('hideSelected hides all currently selected objects', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const store = useEditorStore;

    store.setState({
      selection: { zones: ['z1', 'z2'], entities: ['e1'], landmarks: [], spawns: [], encounters: [] },
    });
    store.getState().hideSelected();

    expect(store.getState().isHidden('z1')).toBe(true);
    expect(store.getState().isHidden('z2')).toBe(true);
    expect(store.getState().isHidden('e1')).toBe(true);
  });
});

// ── FT-010: Performance Stats Toggle ─────────────────────────────

describe('FT-010: Performance Stats Toggle', () => {
  it('editor store exposes showPerfStats and togglePerfStats', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const state = useEditorStore.getState();
    expect(typeof state.showPerfStats).toBe('boolean');
    expect(typeof state.togglePerfStats).toBe('function');
  });

  it('togglePerfStats flips the boolean', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const store = useEditorStore;

    const initial = store.getState().showPerfStats;
    store.getState().togglePerfStats();
    expect(store.getState().showPerfStats).toBe(!initial);

    store.getState().togglePerfStats();
    expect(store.getState().showPerfStats).toBe(initial);
  });
});

// ── FT-018: Multi-User Documentation Hints ───────────────────────

describe('FT-018: Multi-User Documentation Hints', () => {
  it('ExportModal module exports ExportModal function', async () => {
    const mod = await import('../panels/ExportModal.js');
    expect(typeof mod.ExportModal).toBe('function');
  });
});

// ── FT-019: Import Fidelity Repair Suggestions ──────────────────

describe('FT-019: Import Fidelity Repair Suggestions', () => {
  it('ImportSummaryPanel module exports ImportSummaryPanel function', async () => {
    const mod = await import('../panels/ImportSummaryPanel.js');
    expect(typeof mod.ImportSummaryPanel).toBe('function');
  });
});

// ── FT-025: Progression Cross-Links ─────────────────────────────

describe('FT-025: Progression Cross-Links', () => {
  it('ProgressionPanel module exports ProgressionPanel function', async () => {
    const mod = await import('../panels/ProgressionPanel.js');
    expect(typeof mod.ProgressionPanel).toBe('function');
  });
});

// ── FT-009: VisibilityToggle component ───────────────────────────

describe('FT-009: VisibilityToggle component', () => {
  it('shared module exports VisibilityToggle', async () => {
    const mod = await import('../panels/shared.js');
    expect(typeof mod.VisibilityToggle).toBe('function');
  });
});

// ── FT-010: Viewport culling helpers ─────────────────────────────

describe('FT-010: Viewport culling (pure math)', () => {
  it('inViewport correctly identifies in-bounds rectangles', () => {
    // Simulating the culling logic from Canvas
    const vpLeft = 0;
    const vpTop = 0;
    const vpRight = 800;
    const vpBottom = 600;
    const margin = 64;

    const inViewport = (wx: number, wy: number, ww: number, wh: number) =>
      wx + ww > vpLeft - margin && wx < vpRight + margin &&
      wy + wh > vpTop - margin && wy < vpBottom + margin;

    // Fully inside
    expect(inViewport(100, 100, 50, 50)).toBe(true);
    // Partially overlapping right edge
    expect(inViewport(780, 100, 50, 50)).toBe(true);
    // Far outside
    expect(inViewport(2000, 2000, 50, 50)).toBe(false);
    // Just outside left (beyond margin)
    expect(inViewport(-200, 100, 50, 50)).toBe(false);
    // Within margin
    expect(inViewport(-60, 100, 50, 50)).toBe(true);
  });
});
