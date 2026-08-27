import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadRecentSearches, saveRecentSearch, RECENT_SEARCHES_KEY } from '../SearchOverlay.js';

describe('F-33ea175d / F-5c35446e: recent search write path', () => {
  beforeEach(() => {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('selecting a result after typing saves that term', () => {
    // handleSelect now lists `query` in useCallback deps; this is the write
    // it performs with the live (not stale-empty) query.
    saveRecentSearch('chapel entrance');
    expect(loadRecentSearches()).toEqual(['chapel entrance']);
  });

  it('does not persist an empty stale query', () => {
    saveRecentSearch('   ');
    expect(loadRecentSearches()).toEqual([]);
  });

  it('QuotaExceededError on setItem does not throw (navigation can proceed)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveRecentSearch('chapel')).not.toThrow();
  });
});
