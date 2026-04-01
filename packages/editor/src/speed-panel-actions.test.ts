// speed-panel-actions.test.ts — tests for fuzzyMatch and fuzzy filterActions
import { describe, it, expect } from 'vitest';
import {
  fuzzyMatch,
  filterActions,
  SPEED_PANEL_ACTIONS,
  type SpeedPanelAction,
  type SpeedPanelMacro,
} from './speed-panel-actions.js';

// --------------- fuzzyMatch ---------------

describe('fuzzyMatch', () => {
  it('matches empty query against any text', () => {
    const r = fuzzyMatch('', 'anything');
    expect(r.match).toBe(true);
    expect(r.score).toBe(0);
  });

  it('matches exact substring', () => {
    const r = fuzzyMatch('zone', 'New Zone');
    expect(r.match).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('matches case-insensitively', () => {
    const r = fuzzyMatch('NZ', 'New Zone');
    expect(r.match).toBe(true);
  });

  it('rejects when characters are not all present', () => {
    const r = fuzzyMatch('xyz', 'New Zone');
    expect(r.match).toBe(false);
    expect(r.score).toBe(0);
  });

  it('rejects when characters are present but out of order', () => {
    // 'e' then 'd' — in "Delete" d comes before e, so 'ed' can match,
    // but 'td' requires t before d which fails in "bad"
    const r = fuzzyMatch('db', 'bad');
    // 'd' is at index 2, 'b' is at index 0 — out of order
    expect(r.match).toBe(false);
  });

  it('gives word-start bonus', () => {
    // "nz" matches "New Zone" — both chars are word starts
    const wordStart = fuzzyMatch('nz', 'New Zone');
    // "ew" matches "New Zone" — neither char is a word start
    const midWord = fuzzyMatch('ew', 'New Zone');
    expect(wordStart.match).toBe(true);
    expect(midWord.match).toBe(true);
    expect(wordStart.score).toBeGreaterThan(midWord.score);
  });

  it('gives consecutive-match bonus', () => {
    const consecutive = fuzzyMatch('new', 'New Zone');
    const scattered = fuzzyMatch('noe', 'New Zone');
    expect(consecutive.match).toBe(true);
    expect(scattered.match).toBe(true);
    expect(consecutive.score).toBeGreaterThan(scattered.score);
  });

  it('gives shorter-text bonus', () => {
    const short = fuzzyMatch('de', 'Delete');
    const long = fuzzyMatch('de', 'Delete Something Very Long');
    expect(short.match).toBe(true);
    expect(long.match).toBe(true);
    expect(short.score).toBeGreaterThan(long.score);
  });

  it('handles single-character query', () => {
    const r = fuzzyMatch('d', 'Delete');
    expect(r.match).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('handles query longer than text', () => {
    const r = fuzzyMatch('abcdefghij', 'abc');
    expect(r.match).toBe(false);
  });
});

// --------------- filterActions with fuzzy ---------------

describe('filterActions fuzzy search', () => {
  it('returns all context-matching actions when query is empty', () => {
    const result = filterActions(SPEED_PANEL_ACTIONS, null, '', []);
    // null hit → global actions
    expect(result.contextual.length).toBeGreaterThan(0);
    for (const a of result.contextual) {
      expect(a.contextFilter(null)).toBe(true);
    }
  });

  it('fuzzy-filters by label', () => {
    // "nz" should match "New Zone" via fuzzy
    const result = filterActions(SPEED_PANEL_ACTIONS, null, 'nz', []);
    const ids = result.contextual.map((a) => a.id);
    expect(ids).toContain('new-zone');
  });

  it('sorts results by fuzzy score (best match first)', () => {
    // "fit" should rank "Fit to Content" higher than other matches
    const result = filterActions(SPEED_PANEL_ACTIONS, null, 'fit', []);
    const all = [...result.pinned, ...result.recents, ...result.contextual, ...result.modeSuggested];
    if (all.length > 0) {
      expect(all[0].id).toBe('fit-content');
    }
  });

  it('fuzzy-filters macros by name', () => {
    const macros: SpeedPanelMacro[] = [
      { id: 'm1', name: 'Quick Build', steps: [{ actionId: 'fit-content' }] },
      { id: 'm2', name: 'Slow Tear', steps: [{ actionId: 'delete' }] },
    ];
    const result = filterActions(SPEED_PANEL_ACTIONS, null, 'qb', [], [], [], macros);
    expect(result.macros.map((m) => m.id)).toContain('m1');
    // "qb" should not match "Slow Tear"
    expect(result.macros.map((m) => m.id)).not.toContain('m2');
  });

  it('returns no actions when fuzzy query matches nothing', () => {
    const result = filterActions(SPEED_PANEL_ACTIONS, null, 'zzzzz', []);
    expect(result.contextual).toHaveLength(0);
    expect(result.pinned).toHaveLength(0);
    expect(result.recents).toHaveLength(0);
  });
});
