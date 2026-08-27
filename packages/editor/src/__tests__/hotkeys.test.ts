import { describe, it, expect, vi } from 'vitest';
import { matchHotkey, dispatchHotkey, shouldArmSpacePan, isActivatingControl, type HotkeyContext } from '../hotkeys.js';
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
    activeModal: null,
    showSearch: false,
    clearSelection: vi.fn(),
    selectAll: vi.fn(),
    moveSelected: vi.fn(),
    removeSelected: vi.fn(),
    removeConnection: vi.fn(),
    duplicateSelected: vi.fn(() => emptySel),
    copySelection: vi.fn(),
    pasteClipboard: vi.fn(),
    setShowSearch: vi.fn(),
    setRightTab: vi.fn(),
    setTool: vi.fn(),
    showSpeedPanel: false,
    closeSpeedPanel: vi.fn(),
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
    expect(matchHotkey(makeEvent({ code: 'KeyQ' }))).toBeNull();
  });

  it('does not match P with ctrl held (ctrl+P is not bound)', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyP', ctrlKey: true }))).toBeNull();
  });

  it('matches bare V to tool-select (not Ctrl+V paste)', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyV' }))).toBe('tool-select');
    expect(matchHotkey(makeEvent({ code: 'KeyV', ctrlKey: true }))).toBe('paste');
  });

  it('matches bare C to tool-connection (not Ctrl+C copy)', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyC' }))).toBe('tool-connection');
    expect(matchHotkey(makeEvent({ code: 'KeyC', ctrlKey: true }))).toBe('copy');
  });

  it('F-f2564ffa: matches Ctrl+Z to undo and does not steal bare Z (zone tool)', () => {
    expect(matchHotkey(makeEvent({ code: 'KeyZ' }))).toBe('tool-zone');
    expect(matchHotkey(makeEvent({ code: 'KeyZ', ctrlKey: true }))).toBe('undo');
    expect(matchHotkey(makeEvent({ code: 'KeyZ', ctrlKey: true, shiftKey: true }))).toBe('redo');
    expect(matchHotkey(makeEvent({ code: 'KeyY', ctrlKey: true }))).toBe('redo');
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

describe('dispatchHotkey — modal/overlay-aware guard (F-340b4aff)', () => {
  it('does not delete the selection when a modal is open (Delete key)', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel, activeModal: 'export' });
    const e = makeEvent({ code: 'Delete' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(ctx.removeSelected).not.toHaveBeenCalled();
  });

  it('does not select-all underneath an open modal (Ctrl+A)', () => {
    const ctx = makeCtx({
      activeModal: 'import',
      project: { zones: [{ id: 'z1' }], entityPlacements: [], landmarks: [], spawnPoints: [], encounterAnchors: [] } as any,
    });
    const e = makeEvent({ code: 'KeyA', ctrlKey: true });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(ctx.selectAll).not.toHaveBeenCalled();
  });

  it('does not duplicate the selection underneath an open modal (Ctrl+D)', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel, activeModal: 'template-manager' });
    const e = makeEvent({ code: 'KeyD', ctrlKey: true });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(ctx.duplicateSelected).not.toHaveBeenCalled();
  });

  it('does not nudge the selection underneath an open modal (arrow keys)', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel, activeModal: 'save-template' });
    const e = makeEvent({ code: 'ArrowUp' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(ctx.moveSelected).not.toHaveBeenCalled();
  });

  it('does not switch tools underneath an open modal (bare V/Z/C/E/L/S/T/O)', () => {
    const ctx = makeCtx({ activeModal: 'save-kit' });
    const e = makeEvent({ code: 'KeyV' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(ctx.setTool).not.toHaveBeenCalled();
  });

  it('does not act while the search overlay is open, even with no modal active', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel, activeModal: null, showSearch: true });
    const e = makeEvent({ code: 'Delete' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(ctx.removeSelected).not.toHaveBeenCalled();
  });

  it('acts normally once the modal is closed (activeModal: null)', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel, activeModal: null, showSearch: false });
    const e = makeEvent({ code: 'Delete' });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.removeSelected).toHaveBeenCalled();
  });

  it('F-f2564ffa: does not undo underneath an open modal (Ctrl+Z)', () => {
    const undo = vi.fn();
    const ctx = makeCtx({ activeModal: 'export', undo });
    const e = makeEvent({ code: 'KeyZ', ctrlKey: true });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(undo).not.toHaveBeenCalled();
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

  it('F-eb7fc5ef: escape clears connectionStart', () => {
    const setConnectionStart = vi.fn();
    const ctx = makeCtx({ setConnectionStart });
    const result = dispatchHotkey(makeEvent({ code: 'Escape' }), ctx);
    expect(result.handled).toBe(true);
    expect(setConnectionStart).toHaveBeenCalledWith(null);
    expect(ctx.clearSelection).toHaveBeenCalled();
  });

  it('F-eb7fc5ef: escape clears connectionStart even when a speed panel was closed', () => {
    const setConnectionStart = vi.fn();
    const ctx = makeCtx({ showSpeedPanel: true, setConnectionStart });
    const result = dispatchHotkey(makeEvent({ code: 'Escape' }), ctx);
    expect(result.handled).toBe(true);
    expect(ctx.closeSpeedPanel).toHaveBeenCalled();
    expect(ctx.clearSelection).not.toHaveBeenCalled();
    expect(setConnectionStart).toHaveBeenCalledWith(null);
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

  it('F-f2564ffa: Ctrl+Z calls undo and Ctrl+Shift+Z / Ctrl+Y call redo', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    const ctx = makeCtx({ undo, redo });
    expect(dispatchHotkey(makeEvent({ code: 'KeyZ', ctrlKey: true }), ctx)).toEqual({ handled: true, action: 'undo' });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(dispatchHotkey(makeEvent({ code: 'KeyZ', ctrlKey: true, shiftKey: true }), ctx)).toEqual({ handled: true, action: 'redo' });
    expect(dispatchHotkey(makeEvent({ code: 'KeyY', ctrlKey: true }), ctx)).toEqual({ handled: true, action: 'redo' });
    expect(redo).toHaveBeenCalledTimes(2);
  });

  it('F-ef6c82dc: Ctrl+C with empty selection does not preventDefault (browser copy of non-input text)', () => {
    const ctx = makeCtx();
    const e = makeEvent({ code: 'KeyC', ctrlKey: true });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(ctx.copySelection).not.toHaveBeenCalled();
  });

  it('F-ef6c82dc: Ctrl+C with a selection preventDefaults and copies', () => {
    const sel: SelectionSet = { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] };
    const ctx = makeCtx({ selection: sel });
    const e = makeEvent({ code: 'KeyC', ctrlKey: true });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(ctx.copySelection).toHaveBeenCalled();
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

  it.each([
    ['KeyV', 'select'],
    ['KeyZ', 'zone-paint'],
    ['KeyC', 'connection'],
    ['KeyE', 'entity-place'],
    ['KeyL', 'landmark'],
    ['KeyS', 'spawn'],
    ['KeyN', 'encounter-place'],
    ['KeyI', 'item-place'],
  ] as const)('tool shortcut %s switches to %s', (code, tool) => {
    const ctx = makeCtx();
    const e = makeEvent({ code });
    const result = dispatchHotkey(e, ctx);
    expect(result.handled).toBe(true);
    expect(ctx.setTool).toHaveBeenCalledWith(tool);
  });
});

describe('F-6c1fa8ce: shouldArmSpacePan', () => {
  const canvas = { tagName: 'CANVAS' };

  it('arms when focus is on the canvas', () => {
    expect(shouldArmSpacePan(canvas, canvas, canvas)).toBe(true);
  });

  it('arms when focus is on body/root', () => {
    expect(shouldArmSpacePan({ tagName: 'BODY' }, { tagName: 'BODY' }, canvas)).toBe(true);
    expect(shouldArmSpacePan({ tagName: 'DIV' }, { tagName: 'HTML' }, canvas)).toBe(true);
    expect(shouldArmSpacePan({ tagName: 'DIV' }, null, canvas)).toBe(true);
  });

  it('does not steal Space from a focused button', () => {
    const btn = { tagName: 'BUTTON' };
    expect(isActivatingControl(btn)).toBe(true);
    expect(shouldArmSpacePan(btn, btn, canvas)).toBe(false);
  });

  it('skips INPUT/TEXTAREA/SELECT', () => {
    expect(shouldArmSpacePan({ tagName: 'INPUT' }, { tagName: 'INPUT' }, canvas)).toBe(false);
    expect(shouldArmSpacePan({ tagName: 'TEXTAREA' }, { tagName: 'TEXTAREA' }, canvas)).toBe(false);
    expect(shouldArmSpacePan({ tagName: 'SELECT' }, { tagName: 'SELECT' }, canvas)).toBe(false);
  });

  it('skips role=button, links, contentEditable, and menuitem', () => {
    expect(shouldArmSpacePan(
      { tagName: 'DIV', getAttribute: (n: string) => n === 'role' ? 'button' : null },
      { tagName: 'DIV', getAttribute: (n: string) => n === 'role' ? 'button' : null },
      canvas,
    )).toBe(false);
    expect(shouldArmSpacePan({ tagName: 'A' }, { tagName: 'A' }, canvas)).toBe(false);
    expect(shouldArmSpacePan(
      { tagName: 'DIV', isContentEditable: true },
      { tagName: 'DIV', isContentEditable: true },
      canvas,
    )).toBe(false);
    expect(shouldArmSpacePan(
      { tagName: 'BUTTON', getAttribute: (n: string) => n === 'role' ? 'menuitem' : null },
      { tagName: 'BUTTON', getAttribute: (n: string) => n === 'role' ? 'menuitem' : null },
      canvas,
    )).toBe(false);
  });

  it('does not arm when some other chrome control is focused', () => {
    const tab = { tagName: 'BUTTON', getAttribute: () => 'tab' };
    expect(shouldArmSpacePan({ tagName: 'DIV' }, tab, canvas)).toBe(false);
  });
});
