import { describe, it, expect, vi } from 'vitest';
import { matchHotkey, dispatchHotkey, type HotkeyContext } from '../hotkeys.js';
import type { SelectionSet } from '../store/editor-store.js';

function makeEvent(overrides: Partial<KeyboardEvent> & { code: string }): KeyboardEvent {
  return {
    code: overrides.code,
    ctrlKey: overrides.ctrlKey ?? false,
    metaKey: overrides.metaKey ?? false,
    shiftKey: overrides.shiftKey ?? false,
    repeat: overrides.repeat ?? false,
    target: overrides.target ?? { tagName: 'DIV' },
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

const emptySel: SelectionSet = { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] };

function makeCtx(overrides: Partial<HotkeyContext> = {}): HotkeyContext {
  return {
    selection: emptySel,
    selectedConnection: null,
    project: {
      zones: [], entityPlacements: [], landmarks: [], spawnPoints: [], encounterAnchors: [],
    } as any,
    showEntities: true,
    showLandmarks: true,
    showSpawns: true,
    clearSelection: vi.fn(),
    selectAll: vi.fn(),
    moveSelected: vi.fn(),
    removeSelected: vi.fn(),
    removeConnection: vi.fn(),
    duplicateSelected: vi.fn(() => emptySel),
    setShowSearch: vi.fn(),
    setRightTab: vi.fn(),
    ...overrides,
  };
}

describe('matchHotkey', () => {
  it('matches Ctrl+K to search', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyK', ctrlKey: true }))).toBe('search');
  });

  it('matches Ctrl+D to duplicate', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyD', ctrlKey: true }))).toBe('duplicate');
  });

  it('matches Enter to open-details', () => {
    expect(matchHotkey(makeEvent({ code: 'Enter' }))).toBe('open-details');
  });

  it('matches P to apply-preset', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyP' }))).toBe('apply-preset');
  });

  it('matches Shift+P to save-preset', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyP', shiftKey: true }))).toBe('save-preset');
  });

  it('matches Delete to delete', () => {
    expect(matchHotkey(makeEvent({ code: 'Delete' }))).toBe('delete');
  });

  it('matches Escape to escape', () => {
    expect(matchHotkey(makeEvent({ code: 'Escape' }))).toBe('escape');
  });

  it('returns null for unbound key', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyZ' }))).toBeNull();
  });

  it('does not match P with ctrl held (ctrl+P is not bound)', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyP', ctrlKey: true }))).toBeNull();
  });
});

describe('dispatchHotkey — input safety', () => {
  it('skips when target is an input', () => {
    const e = makeEvent({ code: 'KeyP', target: { tagName: 'INPUT' } as any });
    const ctx = makeCtx();
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
  });

  it('skips when target is a textarea', () => {
    const e = makeEvent({ code: 'Enter', target: { tagName: 'TEXTAREA' } as any });
    const ctx = makeCtx();
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
  });

  it('skips when target is a select', () => {
    const e = makeEvent({ code: 'Escape', target: { tagName: 'SELECT' } as any });
    const ctx = makeCtx();
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
  });
});

describe('dispatchHotkey — actions', () => {
  it('search opens search overlay', () => {
    const ctx = makeCtx();
    const e = makeEvent({ code: 'KeyK', ctrlKey: true });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setShowSearch).toHaveBeenCalledWith(true);
  });

  it('escape clears selection', () => {
    const ctx = makeCtx();
    const e = makeEvent({ code: 'Escape' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.clearSelection).toHaveBeenCalled();
  });

  it('apply-preset switches to presets tab', () => {
    const ctx = makeCtx();
    const e = makeEvent({ code: 'KeyP' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setRightTab).toHaveBeenCalledWith('presets');
  });

  it('open-details switches to map tab', () => {
    const ctx = makeCtx();
    const e = makeEvent({ code: 'Enter' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setRightTab).toHaveBeenCalledWith('map');
  });

  it('nudge-up moves selection', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel });
    const e = makeEvent({ code: 'ArrowUp' });
    dispatchHotkey(e, ctx);
    expect(ctx.moveSelected).toHaveBeenCalledWith(sel, 0, -1);
  });

  it('nudge with shift multiplies by 5', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel });
    const e = makeEvent({ code: 'ArrowRight', shiftKey: true });
    dispatchHotkey(e, ctx);
    expect(ctx.moveSelected).toHaveBeenCalledWith(sel, 5, 0);
  });

  it('delete with no selection does nothing harmful', () => {
    const ctx = makeCtx();
    const e = makeEvent({ code: 'Delete' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.removeSelected).not.toHaveBeenCalled();
  });

  it('delete removes selected connection', () => {
    const conn = { from: 'a', to: 'b' };
    const ctx = makeCtx({ selectedConnection: conn });
    const e = makeEvent({ code: 'Delete' });
    dispatchHotkey(e, ctx);
    expect(ctx.removeConnection).toHaveBeenCalledWith('a', 'b');
    expect(ctx.clearSelection).toHaveBeenCalled();
  });
});
