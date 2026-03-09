import { describe, it, expect } from 'vitest';
import { SPEED_PANEL_ACTIONS, filterActions } from '../speed-panel-actions.js';
import type { HitResult } from '../hit-testing.js';

describe('SPEED_PANEL_ACTIONS contextFilter', () => {
  it('empty canvas returns global actions', () => {
    const matching = SPEED_PANEL_ACTIONS.filter((a) => a.contextFilter(null));
    const ids = matching.map((a) => a.id);
    expect(ids).toContain('new-zone');
    expect(ids).toContain('fit-content');
    expect(ids).not.toContain('edit-props');
  });

  it('zone context returns zone-specific actions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const matching = SPEED_PANEL_ACTIONS.filter((a) => a.contextFilter(hit));
    const ids = matching.map((a) => a.id);
    expect(ids).toContain('edit-props');
    expect(ids).toContain('delete');
    expect(ids).toContain('duplicate');
    expect(ids).toContain('assign-district');
    expect(ids).toContain('place-entity');
    expect(ids).toContain('connect-from');
    expect(ids).not.toContain('swap-direction');
  });

  it('entity context returns entity actions', () => {
    const hit: HitResult = { type: 'entity', id: 'e1' };
    const matching = SPEED_PANEL_ACTIONS.filter((a) => a.contextFilter(hit));
    const ids = matching.map((a) => a.id);
    expect(ids).toContain('edit-props');
    expect(ids).toContain('delete');
    expect(ids).toContain('duplicate');
    expect(ids).not.toContain('assign-district');
  });

  it('connection context returns connection actions', () => {
    const hit: HitResult = { type: 'connection', id: 'z1::z2' };
    const matching = SPEED_PANEL_ACTIONS.filter((a) => a.contextFilter(hit));
    const ids = matching.map((a) => a.id);
    expect(ids).toContain('edit-props');
    expect(ids).toContain('delete');
    expect(ids).toContain('swap-direction');
    expect(ids).not.toContain('duplicate');
  });
});

describe('filterActions', () => {
  it('filters by query string', () => {
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, null, 'zone', new Set());
    const all = [...pinned, ...contextual];
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('new-zone');
  });

  it('separates pinned from contextual', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const pins = new Set(['edit-props', 'delete']);
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, '', pins);
    expect(pinned.map((a) => a.id)).toEqual(['edit-props', 'delete']);
    expect(contextual.every((a) => !pins.has(a.id))).toBe(true);
  });
});
