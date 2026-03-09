import { describe, it, expect } from 'vitest';
import { emptyStateMessage } from '../panels/ObjectListPanel.js';

describe('ObjectListPanel empty state', () => {
  it('dungeon mentions "chamber"', () => {
    expect(emptyStateMessage('dungeon')).toContain('chamber');
  });

  it('ocean mentions "waters"', () => {
    expect(emptyStateMessage('ocean')).toContain('waters');
  });

  it('space mentions "sector"', () => {
    expect(emptyStateMessage('space')).toContain('sector');
  });
});
