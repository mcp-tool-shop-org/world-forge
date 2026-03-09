import { describe, it, expect, vi } from 'vitest';
import { executeAction, executeMacro, type ExecuteStores } from '../speed-panel-execute.js';
import type { HitResult } from '../hit-testing.js';
import type { WorldProject } from '@world-forge/schema';

function makeStores(overrides: Partial<ExecuteStores> = {}): ExecuteStores {
  return {
    selectZone: vi.fn(),
    selectEntity: vi.fn(),
    selectLandmark: vi.fn(),
    selectSpawn: vi.fn(),
    selectEncounter: vi.fn(),
    selectConnection: vi.fn(),
    clearSelection: vi.fn(),
    setRightTab: vi.fn(),
    setTool: vi.fn(),
    setConnectionStart: vi.fn(),
    setViewport: vi.fn(),
    removeSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    removeConnection: vi.fn(),
    addConnection: vi.fn(),
    project: {
      map: { tileSize: 32 },
      zones: [{ gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4 }],
      connections: [{ fromZoneId: 'z1', toZoneId: 'z2', bidirectional: false }],
    } as unknown as WorldProject,
    ...overrides,
  };
}

describe('executeAction', () => {
  it('edit-props selects context and opens map tab', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const result = executeAction('edit-props', ctx, stores);
    expect(result.executed).toBe(true);
    expect(stores.selectZone).toHaveBeenCalledWith('z1', false);
    expect(stores.setRightTab).toHaveBeenCalledWith('map');
  });

  it('edit-props returns false for null context', () => {
    const stores = makeStores();
    const result = executeAction('edit-props', null, stores);
    expect(result.executed).toBe(false);
  });

  it('delete dispatches removeConnection for connection context', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'connection', id: 'z1::z2' };
    const result = executeAction('delete', ctx, stores);
    expect(result.executed).toBe(true);
    expect(stores.removeConnection).toHaveBeenCalledWith('z1', 'z2');
    expect(stores.clearSelection).toHaveBeenCalled();
  });

  it('delete dispatches removeSelected for zone context', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const result = executeAction('delete', ctx, stores);
    expect(result.executed).toBe(true);
    expect(stores.removeSelected).toHaveBeenCalledWith(
      expect.objectContaining({ zones: ['z1'] }),
    );
  });

  it('swap-direction returns false for zone context (context mismatch)', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const result = executeAction('swap-direction', ctx, stores);
    expect(result.executed).toBe(false);
  });

  it('swap-direction executes for connection context', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'connection', id: 'z1::z2' };
    const result = executeAction('swap-direction', ctx, stores);
    expect(result.executed).toBe(true);
    expect(stores.removeConnection).toHaveBeenCalledWith('z1', 'z2');
    expect(stores.addConnection).toHaveBeenCalledWith(
      expect.objectContaining({ fromZoneId: 'z2', toZoneId: 'z1' }),
    );
  });

  it('unknown action returns false', () => {
    const stores = makeStores();
    const result = executeAction('unknown-action', null, stores);
    expect(result.executed).toBe(false);
  });
});

describe('executeMacro', () => {
  it('runs all steps of a 3-step macro', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const macro = {
      id: 'm1', name: 'Test',
      steps: [{ actionId: 'edit-props' }, { actionId: 'duplicate' }, { actionId: 'assign-district' }],
    };
    const result = executeMacro(macro, ctx, stores);
    expect(result.completed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.abortedAt).toBeUndefined();
  });

  it('aborts at step 2 on context mismatch', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const macro = {
      id: 'm1', name: 'Test',
      // swap-direction requires connection context → will fail
      steps: [{ actionId: 'edit-props' }, { actionId: 'swap-direction' }, { actionId: 'delete' }],
    };
    const result = executeMacro(macro, ctx, stores);
    expect(result.completed).toBe(1);
    expect(result.total).toBe(3);
    expect(result.abortedAt).toBe(1);
    expect(result.reason).toContain('swap-direction');
  });

  it('empty macro returns completed 0', () => {
    const stores = makeStores();
    const result = executeMacro({ id: 'm1', name: 'Empty', steps: [] }, null, stores);
    expect(result.completed).toBe(0);
    expect(result.total).toBe(0);
    expect(result.abortedAt).toBeUndefined();
  });

  it('2-step delete+duplicate on zone context', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const macro = {
      id: 'm1', name: 'Del+Dup',
      steps: [{ actionId: 'delete' }, { actionId: 'duplicate' }],
    };
    const result = executeMacro(macro, ctx, stores);
    expect(result.completed).toBe(2);
    expect(stores.removeSelected).toHaveBeenCalled();
    expect(stores.duplicateSelected).toHaveBeenCalled();
  });

  it('partial result includes abortedAt and reason', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'entity', id: 'e1' };
    const macro = {
      id: 'm1', name: 'Fail',
      steps: [{ actionId: 'edit-props' }, { actionId: 'assign-district' }], // assign-district needs zone
    };
    const result = executeMacro(macro, ctx, stores);
    expect(result.completed).toBe(1);
    expect(result.abortedAt).toBe(1);
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain('assign-district');
  });
});
