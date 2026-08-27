import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRecentSearches, saveRecentSearch, RECENT_SEARCHES_KEY } from '../SearchOverlay.js';

const here = dirname(fileURLToPath(import.meta.url));

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

describe('F-807b04f7: starter-kit and export-summary have consequences', () => {
  it('selecting a starter kit opens TemplateManager on Starters; Export Summary downloads', () => {
    const src = readFileSync(join(here, '../SearchOverlay.tsx'), 'utf8');
    expect(src).not.toMatch(/kit is informational in search/);
    expect(src).toContain('requestTemplateManagerTab');
    expect(src).toContain("openModal('template-manager')");
    expect(src).toContain('downloadReviewMarkdown');
    expect(src).toContain("result.id === 'export-summary'");
  });
});
