import { describe, it, expect, vi } from 'vitest';
import { executeAction, executeMacro, type ExecuteStores } from '../speed-panel-execute.js';
import type { HitResult } from '../hit-testing.js';
import type { WorldProject } from '@world-forge/schema';
import { createEmptyProject } from '../store/project-store.js';

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

  it('unknown action returns false with reason "unknown action" (not context mismatch)', () => {
    const stores = makeStores();
    const result = executeAction('unknown-action', null, stores);
    expect(result.executed).toBe(false);
    expect(result.reason).toBe('unknown action');
  });

  it('F-e57095f8: executeMacro passes the actual fail reason through', () => {
    const stores = makeStores();
    const result = executeMacro(
      { id: 'm', name: 'Bad', steps: [{ actionId: 'not-a-real-action' }] },
      null,
      stores,
    );
    expect(result.abortedAt).toBe(0);
    expect(result.reason).toContain('unknown action');
    expect(result.reason).not.toContain('context mismatch');
  });

  it('F-69d97784: fit-content uses canvasSize when provided (not hardcoded 800×600)', () => {
    const stores800 = makeStores();
    const stores1440 = makeStores({ canvasSize: { w: 1440, h: 900 } });
    const ctx = null;
    executeAction('fit-content', ctx, stores800);
    executeAction('fit-content', ctx, stores1440);
    const vp800 = (stores800.setViewport as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const vp1440 = (stores1440.setViewport as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(vp800).toBeDefined();
    expect(vp1440).toBeDefined();
    expect(vp1440).not.toEqual(vp800);
  });

  it('edit-props returns false for malformed connection ID (no ::)', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'connection', id: 'bad-id-no-separator' };
    const result = executeAction('edit-props', ctx, stores);
    expect(result.executed).toBe(false);
    expect(stores.selectConnection).not.toHaveBeenCalled();
  });

  it('delete returns false for malformed connection ID (single element)', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'connection', id: 'only-one-part' };
    const result = executeAction('delete', ctx, stores);
    expect(result.executed).toBe(false);
    expect(stores.removeConnection).not.toHaveBeenCalled();
  });

  it('swap-direction returns false for malformed connection ID (triple ::)', () => {
    const stores = makeStores();
    const ctx: HitResult = { type: 'connection', id: 'a::b::c' };
    const result = executeAction('swap-direction', ctx, stores);
    expect(result.executed).toBe(false);
    expect(stores.removeConnection).not.toHaveBeenCalled();
  });
});

// F-bdf856bf: 3 of the 7 registered-but-unwired Speed Panel actions have
// real backing implementations that just needed a case in executeAction's
// switch. These tests assert the actions actually EXECUTE (call through to
// their backing implementation) — not just that they're registered, which
// is exactly the gap the finding calls out: the previous test coverage only
// ever asserted registry presence / contextFilter matches, never execution,
// so a case that silently fell through to `default: { executed: false }`
// was indistinguishable from one that worked.
describe('executeAction — previously-unwired actions (F-bdf856bf)', () => {
  it('open-review switches to the review tab and executes', () => {
    const stores = makeStores();
    const result = executeAction('open-review', null, stores);
    expect(result.executed).toBe(true);
    expect(stores.setRightTab).toHaveBeenCalledWith('review');
  });

  it('merge-zones returns false (fails closed, not silently) when the caller has not wired mergeZones/selection yet', () => {
    // ExecuteStores.mergeZones/selection are optional because the current
    // SpeedPanel.tsx caller does not thread them through — see this wave's
    // output notes. Until it does, this must be an honest { executed: false },
    // never a silent success and never a throw.
    const stores = makeStores();
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const result = executeAction('merge-zones', ctx, stores);
    expect(result.executed).toBe(false);
  });

  it('merge-zones calls stores.mergeZones with the full multi-zone selection and executes', () => {
    const mergeZones = vi.fn(() => 'zone-merged-1');
    const stores = makeStores({
      mergeZones,
      selection: { zones: ['z1', 'z2', 'z3'], entities: [], landmarks: [], spawns: [], encounters: [] },
    });
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const result = executeAction('merge-zones', ctx, stores);
    expect(result.executed).toBe(true);
    expect(mergeZones).toHaveBeenCalledWith(['z1', 'z2', 'z3']);
  });

  it('merge-zones returns false and does not call mergeZones when fewer than 2 zones are selected', () => {
    const mergeZones = vi.fn(() => 'zone-merged-1');
    const stores = makeStores({
      mergeZones,
      selection: { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] },
    });
    const ctx: HitResult = { type: 'zone', id: 'z1' };
    const result = executeAction('merge-zones', ctx, stores);
    expect(result.executed).toBe(false);
    expect(mergeZones).not.toHaveBeenCalled();
  });

  it('merge-zones returns false when mergeZones itself reports failure (e.g. fewer than 2 real zones found)', () => {
    const mergeZones = vi.fn(() => null);
    const stores = makeStores({
      mergeZones,
      selection: { zones: ['z1', 'z2'], entities: [], landmarks: [], spawns: [], encounters: [] },
    });
    const result = executeAction('merge-zones', { type: 'zone', id: 'z1' }, stores);
    expect(result.executed).toBe(false);
  });

  it('export-summary downloads a Markdown summary built from stores.project and executes', () => {
    const downloadFile = vi.fn();
    const project = { ...createEmptyProject(), name: 'My World' };
    const stores = makeStores({ downloadFile, project });
    const result = executeAction('export-summary', null, stores);
    expect(result.executed).toBe(true);
    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [filename, content, mimeType] = downloadFile.mock.calls[0];
    expect(filename).toBe('my-world-review.md');
    expect(typeof content).toBe('string');
    expect(content).toContain('My World');
    expect(mimeType).toBe('text/markdown');
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
