import { describe, it, expect } from 'vitest';
import { SPEED_PANEL_ACTIONS, filterActions } from '../speed-panel-actions.js';
import type { HitResult } from '../hit-testing.js';
import type { SpeedPanelGroup, SpeedPanelMacro } from '../speed-panel-actions.js';

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

describe('macroSafe flag', () => {
  it('interactive-picking actions are not macroSafe', () => {
    const find = (id: string) => SPEED_PANEL_ACTIONS.find((a) => a.id === id)!;
    expect(find('new-zone').macroSafe).toBe(false);
    expect(find('place-entity').macroSafe).toBe(false);
    expect(find('connect-from').macroSafe).toBe(false);
  });

  it('deterministic actions are macroSafe', () => {
    const find = (id: string) => SPEED_PANEL_ACTIONS.find((a) => a.id === id)!;
    expect(find('delete').macroSafe).toBe(true);
    expect(find('duplicate').macroSafe).toBe(true);
    expect(find('fit-content').macroSafe).toBe(true);
    expect(find('edit-props').macroSafe).toBe(true);
    expect(find('assign-district').macroSafe).toBe(true);
    expect(find('swap-direction').macroSafe).toBe(true);
  });
});

describe('filterActions', () => {
  it('filters by query string', () => {
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, null, 'zone', []);
    const all = [...pinned, ...contextual];
    expect(all.length).toBe(1);
    expect(all[0].id).toBe('new-zone');
  });

  it('separates pinned from contextual', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const { pinned, contextual } = filterActions(SPEED_PANEL_ACTIONS, hit, '', ['edit-props', 'delete']);
    expect(pinned.map((a) => a.id)).toEqual(['edit-props', 'delete']);
    expect(contextual.every((a) => a.id !== 'edit-props' && a.id !== 'delete')).toBe(true);
  });

  it('includes recents section excluding pinned', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', ['edit-props'], ['edit-props', 'delete', 'duplicate']);
    // edit-props is pinned → should NOT appear in recents
    expect(result.recents.map((a) => a.id)).toEqual(['delete', 'duplicate']);
    expect(result.pinned.map((a) => a.id)).toEqual(['edit-props']);
  });

  it('filters groups by context, hides empty groups', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const groups: SpeedPanelGroup[] = [
      { id: 'g1', name: 'Zone Ops', actionIds: ['delete', 'assign-district'] },
      { id: 'g2', name: 'Conn Ops', actionIds: ['swap-direction'] }, // not visible for zone
    ];
    const result = filterActions(SPEED_PANEL_ACTIONS, hit, '', [], [], groups);
    expect(result.groups.length).toBe(1);
    expect(result.groups[0].group.id).toBe('g1');
    expect(result.groups[0].actions.map((a) => a.id)).toEqual(['delete', 'assign-district']);
  });

  it('includes all macros (filtered by query)', () => {
    const macros: SpeedPanelMacro[] = [
      { id: 'm1', name: 'Quick Delete', steps: [{ actionId: 'delete' }] },
      { id: 'm2', name: 'Zone Setup', steps: [{ actionId: 'assign-district' }] },
    ];
    const result = filterActions(SPEED_PANEL_ACTIONS, null, '', [], [], [], macros);
    expect(result.macros.length).toBe(2);

    const filtered = filterActions(SPEED_PANEL_ACTIONS, null, 'quick', [], [], [], macros);
    expect(filtered.macros.length).toBe(1);
    expect(filtered.macros[0].id).toBe('m1');
  });
});
