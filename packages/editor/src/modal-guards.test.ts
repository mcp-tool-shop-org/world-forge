// modal-guards.test.ts — tests for confirmDiscard
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { confirmDiscard } from './modal-guards.js';

// Provide a minimal window.confirm in Node test environment
beforeEach(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = { confirm: () => true };
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('confirmDiscard', () => {
  it('returns true when user confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    expect(confirmDiscard()).toBe(true);
  });

  it('returns false when user cancels', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    expect(confirmDiscard()).toBe(false);
  });

  it('uses default message when none provided', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    confirmDiscard();
    expect(spy).toHaveBeenCalledWith('You have unsaved changes. Discard?');
  });

  it('uses custom message when provided', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    confirmDiscard('Really delete this?');
    expect(spy).toHaveBeenCalledWith('Really delete this?');
  });
});
