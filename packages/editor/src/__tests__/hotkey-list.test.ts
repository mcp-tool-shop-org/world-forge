import { describe, it, expect } from 'vitest';
import { getHotkeyList, HOTKEY_BINDINGS } from '../hotkeys.js';

describe('Keyboard Shortcut Registry (FT-017)', () => {
  it('getHotkeyList returns an array with the same length as HOTKEY_BINDINGS', () => {
    const list = getHotkeyList();
    expect(list.length).toBe(HOTKEY_BINDINGS.length);
  });

  it('each entry has key, label, and description strings', () => {
    for (const item of getHotkeyList()) {
      expect(typeof item.key).toBe('string');
      expect(item.key.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it('does not leak internal fields like action or ctrl', () => {
    const list = getHotkeyList();
    for (const item of list) {
      expect(Object.keys(item).sort()).toEqual(['description', 'key', 'label']);
    }
  });

  it('includes Ctrl+K search shortcut', () => {
    const list = getHotkeyList();
    expect(list.some((h) => h.label === 'Ctrl+K')).toBe(true);
  });

  it('includes Delete shortcut', () => {
    const list = getHotkeyList();
    expect(list.some((h) => h.label === 'Del')).toBe(true);
  });
});
