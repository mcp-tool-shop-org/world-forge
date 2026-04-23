// ed-b-stage-c.test.ts — Stage C HUMANIZATION amend wave (editor domain).
// Covers:
//   ED-B-001: transactional auto-save (project + history are either both
//     written or both rolled back; user-facing error names the cause).
//   ED-B-002: orphaned encounter detection + repair helpers (reassign,
//     delete), and the one-time hit-testing breadcrumb.
//   ED-B-003: one-time dev warning for connections referencing missing zones.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useProjectStore,
  createEmptyProject,
  recoverAutoSave,
  clearAutoSave,
  startAutoSave,
  stopAutoSave,
  getLastAutoSaveError,
  clearLastAutoSaveError,
  hasAutoSaveRecovery,
} from '../store/project-store.js';
import {
  findOrphanedEncounters,
  reassignEncounterZone,
  deleteEncounter,
} from '../orphans.js';
import { findHitAt, _resetOrphanedEncounterWarning } from '../hit-testing.js';
import {
  getConnectionEndpoints,
  _resetDanglingConnectionWarnings,
} from '../connection-lines.js';
import type { WorldProject, EncounterAnchor, ZoneConnection, Zone } from '@world-forge/schema';

// ── localStorage mock that can be flipped mid-test ──────────────────────

const store = new Map<string, string>();
let failOn: { key: string; afterCalls: number } | null = null;
let setItemCalls = 0;

const localStorageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => {
    setItemCalls++;
    if (failOn && key === failOn.key && setItemCalls > failOn.afterCalls) {
      const err = new Error('Quota exceeded');
      err.name = 'QuotaExceededError';
      throw err;
    }
    store.set(key, value);
  },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// ── ED-B-001: transactional auto-save ───────────────────────────────────

describe('ED-B-001: transactional auto-save', () => {
  beforeEach(() => {
    store.clear();
    failOn = null;
    setItemCalls = 0;
    stopAutoSave();
    clearLastAutoSaveError();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAutoSave();
    vi.useRealTimers();
  });

  it('writes project + history atomically on success', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Alpha' }));
    startAutoSave();
    vi.advanceTimersByTime(30_000);

    expect(hasAutoSaveRecovery()).toBe(true);
    expect(recoverAutoSave()?.name).toBe('Alpha');
    const historyRaw = store.get('wf-autosave-history');
    expect(historyRaw).toBeTruthy();
    const history = JSON.parse(historyRaw!);
    expect(history).toHaveLength(1);
    expect(history[0].project.name).toBe('Alpha');
    expect(getLastAutoSaveError()).toBeNull();
  });

  it('rolls back the project write when history write fails (quota)', () => {
    // Seed with a prior successful save so we can verify rollback restores it.
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'First' }));
    startAutoSave();
    vi.advanceTimersByTime(30_000);
    stopAutoSave();
    expect(recoverAutoSave()?.name).toBe('First');

    // Now make the *history* write fail on the next tick.
    // setItem sequence per writeAutoSave call: 1=project, 2=history. We want
    // only the 2nd call of this tick to fail. Reset counter and target
    // history with afterCalls=1 so the project write succeeds then history throws.
    setItemCalls = 0;
    failOn = { key: 'wf-autosave-history', afterCalls: 1 };

    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Second' }));
    startAutoSave();
    vi.advanceTimersByTime(30_000);

    // Project snapshot must have been rolled back to "First" — the user still
    // sees the earlier save, not a half-written state.
    expect(recoverAutoSave()?.name).toBe('First');

    // History from the prior successful save should still be intact.
    const history = JSON.parse(store.get('wf-autosave-history')!);
    expect(history[0].project.name).toBe('First');

    // The error is human-readable, names the cause, and mentions the safety net.
    const err = getLastAutoSaveError();
    expect(err).toBeTruthy();
    expect(err!.toLowerCase()).toContain('storage is full');
    expect(err!.toLowerCase()).toContain('undo history');
    expect(err!.toLowerCase()).toContain('previous auto-save is still intact');
  });

  it('surfaces a specific error when the project snapshot write fails', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Bravo' }));

    setItemCalls = 0;
    failOn = { key: 'wf-autosave', afterCalls: 0 }; // first setItem call = project

    startAutoSave();
    vi.advanceTimersByTime(30_000);

    const err = getLastAutoSaveError();
    expect(err).toBeTruthy();
    expect(err!.toLowerCase()).toContain('project snapshot');
    // No prior save existed, so no rollback message needed.
    expect(err!.toLowerCase()).not.toContain('previous auto-save is still intact');
    // History must not have been written with stale data either.
    expect(store.has('wf-autosave-history')).toBe(false);
  });

  it('clears the error once a subsequent save succeeds', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Fail' }));
    setItemCalls = 0;
    failOn = { key: 'wf-autosave', afterCalls: 0 };
    startAutoSave();
    vi.advanceTimersByTime(30_000);
    expect(getLastAutoSaveError()).toBeTruthy();

    // Recover: allow writes again.
    failOn = null;
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Pass' }));
    vi.advanceTimersByTime(30_000);

    expect(getLastAutoSaveError()).toBeNull();
    expect(recoverAutoSave()?.name).toBe('Pass');
    clearAutoSave();
  });
});

// ── ED-B-002: orphaned encounters ───────────────────────────────────────

function projectWithOrphan(): WorldProject {
  const p = createEmptyProject();
  const zoneA: Zone = {
    id: 'zone-a', name: 'Zone A', description: '', tags: [],
    gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
    neighbors: [], exits: [], light: 5, noise: 5, hazards: [], interactables: [],
  };
  const enc1: EncounterAnchor = {
    id: 'enc-live', zoneId: 'zone-a', encounterType: 'patrol',
    enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [],
  };
  const enc2: EncounterAnchor = {
    id: 'enc-orphan', zoneId: 'zone-deleted', encounterType: 'ambush',
    enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [],
  };
  return { ...p, zones: [zoneA], encounterAnchors: [enc1, enc2] };
}

describe('ED-B-002: orphaned encounter detection + repair', () => {
  it('findOrphanedEncounters returns encounters whose zone is missing', () => {
    const orphans = findOrphanedEncounters(projectWithOrphan());
    expect(orphans).toHaveLength(1);
    expect(orphans[0].encounter.id).toBe('enc-orphan');
    expect(orphans[0].missingZoneId).toBe('zone-deleted');
  });

  it('findOrphanedEncounters returns [] when nothing is broken', () => {
    const p = createEmptyProject();
    expect(findOrphanedEncounters(p)).toEqual([]);
  });

  it('reassignEncounterZone moves the orphan into an existing zone', () => {
    const p = projectWithOrphan();
    const repaired = reassignEncounterZone(p, 'enc-orphan', 'zone-a');
    expect(findOrphanedEncounters(repaired)).toEqual([]);
    const moved = repaired.encounterAnchors.find((e) => e.id === 'enc-orphan');
    expect(moved?.zoneId).toBe('zone-a');
  });

  it('reassignEncounterZone is a no-op when target zone does not exist', () => {
    const p = projectWithOrphan();
    const result = reassignEncounterZone(p, 'enc-orphan', 'zone-still-missing');
    expect(result).toEqual(p);
  });

  it('deleteEncounter removes the orphaned encounter and leaves siblings alone', () => {
    const p = projectWithOrphan();
    const repaired = deleteEncounter(p, 'enc-orphan');
    expect(repaired.encounterAnchors.map((e) => e.id)).toEqual(['enc-live']);
  });

  it('hit-testing warns once (not every tick) when an orphan is encountered', () => {
    _resetOrphanedEncounterWarning();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project = projectWithOrphan();
    const viewport = { panX: 0, panY: 0, zoom: 1 };
    const visibility = {
      showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true,
    };
    // Three hit-test calls, one orphan — must warn exactly once.
    findHitAt(10, 10, viewport, project, 32, visibility);
    findHitAt(20, 20, viewport, project, 32, visibility);
    findHitAt(30, 30, viewport, project, 32, visibility);
    const orphanWarns = warn.mock.calls.filter((c) =>
      typeof c[0] === 'string' && c[0].includes('Encounter "enc-orphan"'),
    );
    expect(orphanWarns).toHaveLength(1);
    expect(orphanWarns[0][0]).toContain('Object List');
    warn.mockRestore();
  });
});

// ── ED-B-003: dangling connection warning ──────────────────────────────

describe('ED-B-003: connection to missing zone', () => {
  beforeEach(() => {
    _resetDanglingConnectionWarnings();
  });

  it('getConnectionEndpoints returns null and warns once per connection', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const zones: Zone[] = [
      { id: 'z-exists', name: 'Z', description: '', tags: [],
        gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
        neighbors: [], exits: [], light: 5, noise: 5, hazards: [], interactables: [] },
    ];
    const conn: ZoneConnection = {
      fromZoneId: 'z-exists', toZoneId: 'z-missing', bidirectional: false,
    };

    expect(getConnectionEndpoints(conn, zones, 32)).toBeNull();
    // Call again — must NOT warn a second time for the same key.
    expect(getConnectionEndpoints(conn, zones, 32)).toBeNull();

    const danglingWarns = warn.mock.calls.filter((c) =>
      typeof c[0] === 'string' && c[0].includes('z-exists::z-missing'),
    );
    expect(danglingWarns).toHaveLength(1);
    expect(danglingWarns[0][0]).toContain('z-missing');
    expect(danglingWarns[0][0]).toContain('Dependency panel');
    warn.mockRestore();
  });

  it('names both endpoints when both zones are missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const conn: ZoneConnection = {
      fromZoneId: 'ghost-a', toZoneId: 'ghost-b', bidirectional: false,
    };
    expect(getConnectionEndpoints(conn, [], 32)).toBeNull();
    const msg = warn.mock.calls.find((c) =>
      typeof c[0] === 'string' && c[0].includes('ghost-a::ghost-b'),
    )?.[0] as string | undefined;
    expect(msg).toBeTruthy();
    expect(msg!).toContain('ghost-a and ghost-b');
    warn.mockRestore();
  });
});
