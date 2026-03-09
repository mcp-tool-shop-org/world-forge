import { describe, it, expect } from 'vitest';
import { getSelectedZoneId, getSelectionCount, isSelected, type SelectionSet } from '../store/editor-store.js';

const empty: SelectionSet = { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] };

describe('getSelectedZoneId', () => {
  it('returns null for empty selection', () => {
    expect(getSelectedZoneId(empty)).toBeNull();
  });

  it('returns zone ID for single-zone selection', () => {
    expect(getSelectedZoneId({ ...empty, zones: ['zone-1'] })).toBe('zone-1');
  });

  it('returns null for multi-zone selection', () => {
    expect(getSelectedZoneId({ ...empty, zones: ['z1', 'z2'] })).toBeNull();
  });

  it('returns null when only entities selected', () => {
    expect(getSelectedZoneId({ ...empty, entities: ['e1'] })).toBeNull();
  });
});

describe('getSelectionCount', () => {
  it('returns 0 for empty selection', () => {
    expect(getSelectionCount(empty)).toBe(0);
  });

  it('counts all types', () => {
    const sel: SelectionSet = { zones: ['z1', 'z2'], entities: ['e1'], landmarks: ['l1', 'l2', 'l3'], spawns: [], encounters: [] };
    expect(getSelectionCount(sel)).toBe(6);
  });

  it('counts single item', () => {
    expect(getSelectionCount({ ...empty, spawns: ['s1'] })).toBe(1);
  });
});

describe('isSelected', () => {
  const sel: SelectionSet = { zones: ['z1'], entities: ['e1', 'e2'], landmarks: [], spawns: ['s1'], encounters: [] };

  it('finds zone in selection', () => {
    expect(isSelected(sel, 'zone', 'z1')).toBe(true);
  });

  it('returns false for missing zone', () => {
    expect(isSelected(sel, 'zone', 'z999')).toBe(false);
  });

  it('finds entity in selection', () => {
    expect(isSelected(sel, 'entity', 'e2')).toBe(true);
  });

  it('finds spawn in selection', () => {
    expect(isSelected(sel, 'spawn', 's1')).toBe(true);
  });

  it('returns false for empty landmarks', () => {
    expect(isSelected(sel, 'landmark', 'l1')).toBe(false);
  });
});
