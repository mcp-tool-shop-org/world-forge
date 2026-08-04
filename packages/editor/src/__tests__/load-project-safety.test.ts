// load-project-safety.test.ts
//
// Regression for F-b7d3a887 (CRITICAL) — "the worst class of bug this
// product can have: losing the user's work."
//
// loadProject() used to perform no schema validation and backfill only 7
// hand-picked array fields via `?? []` — it never guarded `zones`, and
// Canvas.tsx reads `project.zones.length` unconditionally in its very first
// render effect, so loading ANY JSON missing a `zones` array crashed the
// whole app on the next render, OUTSIDE the try/catch App.tsx wrapped around
// the synchronous loadProject() call. Worse, the same unguarded loadProject
// ran with NO try/catch at all from the crash-recovery-at-boot effect, which
// then unconditionally wiped the autosave (and its history) immediately
// after — a corrupted recovery snapshot could crash the app AND destroy the
// only remaining copy of the work in the same tick.
//
// These tests exercise the fix at the store level (normalizeProjectShape,
// loadProject's boolean return, attemptCrashRecovery's ordering), which is
// where the actual guarantee lives — App.tsx's mount effect and "Load"
// button just consume it and can't be rendered directly in this repo's
// vitest setup (no jsdom).

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useProjectStore,
  createEmptyProject,
  normalizeProjectShape,
  attemptCrashRecovery,
  hasAutoSaveRecovery,
  clearAutoSave,
  stopAutoSave,
} from '../store/project-store.js';
import type { WorldProject } from '@world-forge/schema';

// Mock localStorage — mirrors autosave.test.ts's own setup so this file is
// independent of module-load order relative to vitest.setup.ts's global shim.
const store = new Map<string, string>();
const localStorageMock: Storage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => { store.set(key, value); },
  removeItem: (key: string) => { store.delete(key); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (i: number) => [...store.keys()][i] ?? null,
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

describe('normalizeProjectShape', () => {
  it('rejects null, primitives, and arrays — not even a plausible project object', () => {
    expect(normalizeProjectShape(null)).toBeNull();
    expect(normalizeProjectShape(undefined)).toBeNull();
    expect(normalizeProjectShape('a string')).toBeNull();
    expect(normalizeProjectShape(42)).toBeNull();
    expect(normalizeProjectShape([1, 2, 3])).toBeNull();
  });

  it('backfills a missing `zones` array instead of leaving it undefined (the exact F-b7d3a887 crash cause)', () => {
    const raw = { id: 'p1', name: 'Legacy Export' }; // no zones at all
    const result = normalizeProjectShape(raw);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.zones)).toBe(true);
    expect(result!.zones).toEqual([]);
    // Reading .length must never throw — this is what crashed Canvas.tsx's
    // first render effect.
    expect(() => result!.zones.length).not.toThrow();
  });

  it('backfills EVERY required array field, not just the 7 loadProject used to guard', () => {
    const result = normalizeProjectShape({ id: 'p1', name: 'Bare' });
    expect(result).not.toBeNull();
    const arrayFields: (keyof WorldProject)[] = [
      'zones', 'connections', 'districts', 'entityPlacements', 'itemPlacements',
      'spawnPoints', 'encounterAnchors', 'factionPresences', 'pressureHotspots',
      'landmarks', 'dialogues', 'progressionTrees', 'craftingStations',
      'marketNodes', 'tilesets', 'tileLayers', 'props', 'propPlacements',
      'ambientLayers', 'assets', 'assetPacks',
    ];
    for (const field of arrayFields) {
      expect(Array.isArray(result![field]), `expected ${field} to be an array`).toBe(true);
    }
  });

  it('coerces a present-but-wrong-typed array field instead of letting it through (a bare `?? []` would miss this)', () => {
    // A corrupted/hand-edited file where zones is a string, not an array.
    const raw = { id: 'p1', name: 'Corrupted', zones: 'not-an-array' };
    const result = normalizeProjectShape(raw);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.zones)).toBe(true);
    expect(result!.zones).toEqual([]);
  });

  it('preserves a well-formed project exactly (no data loss on the happy path)', () => {
    const project = createEmptyProject();
    project.zones.push({
      id: 'z1', name: 'Zone 1', description: '', tags: [],
      gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
      neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
    });
    project.name = 'My Real Project';
    const result = normalizeProjectShape(project);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('My Real Project');
    expect(result!.zones).toHaveLength(1);
    expect(result!.zones[0].id).toBe('z1');
  });

  it('leaves optional array fields (e.g. hazardDefinitions) as undefined when absent — does not fabricate them', () => {
    const raw = { id: 'p1', name: 'Bare' };
    const result = normalizeProjectShape(raw);
    expect(result).not.toBeNull();
    expect(result!.hazardDefinitions).toBeUndefined();
    expect(result!.lootTables).toBeUndefined();
    expect(result!.buildings).toBeUndefined();
  });

  it('coerces an optional array field when present but wrong-typed', () => {
    const raw = { id: 'p1', name: 'Bare', hazardDefinitions: { oops: true } };
    const result = normalizeProjectShape(raw);
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.hazardDefinitions)).toBe(true);
    expect(result!.hazardDefinitions).toEqual([]);
  });
});

describe('loadProject — the previous project survives a failed load (F-b7d3a887, rule 2: never half-apply)', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: createEmptyProject(), dirty: false, undoStack: [], redoStack: [] });
  });

  it('returns false and keeps the previous project when given non-object input', () => {
    const before = useProjectStore.getState().project;
    before.name = 'The Project The User Was Working On';

    const ok = useProjectStore.getState().loadProject('not a project' as unknown as WorldProject);

    expect(ok).toBe(false);
    expect(useProjectStore.getState().project).toBe(before);
    expect(useProjectStore.getState().project.name).toBe('The Project The User Was Working On');
  });

  it('returns false and keeps the previous project when given null', () => {
    const before = useProjectStore.getState().project;
    const ok = useProjectStore.getState().loadProject(null as unknown as WorldProject);
    expect(ok).toBe(false);
    expect(useProjectStore.getState().project).toBe(before);
  });

  it('does NOT clear undo/redo history or mark dirty on a rejected load', () => {
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Edited' }), 'Rename');
    expect(useProjectStore.getState().getUndoCount()).toBe(1);

    useProjectStore.getState().loadProject(42 as unknown as WorldProject);

    expect(useProjectStore.getState().getUndoCount()).toBe(1);
    expect(useProjectStore.getState().project.name).toBe('Edited');
  });

  it('returns true and replaces the project on a successful load — including a legacy project missing `zones` (does not crash reading .length)', () => {
    const legacy = { id: 'legacy-1', name: 'Old Save' } as unknown as WorldProject;
    const ok = useProjectStore.getState().loadProject(legacy);
    expect(ok).toBe(true);
    expect(useProjectStore.getState().project.name).toBe('Old Save');
    expect(() => useProjectStore.getState().project.zones.length).not.toThrow();
    expect(useProjectStore.getState().project.zones).toEqual([]);
  });

  it('a normal, well-formed project still loads exactly as before (no regression)', () => {
    const project = createEmptyProject();
    project.name = 'Fresh Project';
    const ok = useProjectStore.getState().loadProject(project);
    expect(ok).toBe(true);
    expect(useProjectStore.getState().project.name).toBe('Fresh Project');
    expect(useProjectStore.getState().dirty).toBe(false);
  });
});

describe('attemptCrashRecovery — the autosave survives a failed recovery (F-b7d3a887, rule 3)', () => {
  beforeEach(() => {
    store.clear();
    stopAutoSave();
    useProjectStore.setState({ project: createEmptyProject(), dirty: false, undoStack: [], redoStack: [] });
  });

  it('does nothing when there is no autosave to recover', () => {
    const outcome = attemptCrashRecovery();
    expect(outcome).toEqual({ attempted: false });
  });

  it('CRITICAL: a corrupted recovery snapshot (project is not an object) does NOT get deleted — it survives the failed load', () => {
    // Simulates a corrupted/legacy-schema autosave: the entry parses as JSON
    // and has a non-null `project` field (so hasAutoSaveRecovery sees it as
    // present), but that field itself isn't a usable project object.
    store.set('wf-autosave', JSON.stringify({ project: 'not-a-project-object', timestamp: Date.now() }));
    expect(hasAutoSaveRecovery()).toBe(true);

    const before = useProjectStore.getState().project;
    const outcome = attemptCrashRecovery();

    expect(outcome).toEqual({ attempted: true, loaded: false });
    // The autosave must still be there — NOT wiped alongside the failed load.
    expect(store.has('wf-autosave')).toBe(true);
    // And the previous in-memory project was never replaced.
    expect(useProjectStore.getState().project).toBe(before);
  });

  it('a good recovery snapshot loads successfully AND clears the autosave', () => {
    const project = createEmptyProject();
    project.name = 'Recovered Work';
    store.set('wf-autosave', JSON.stringify({ project, timestamp: Date.now() }));
    store.set('wf-autosave-history', JSON.stringify([{ project, timestamp: Date.now() }]));

    const outcome = attemptCrashRecovery();

    expect(outcome).toEqual({ attempted: true, loaded: true });
    expect(useProjectStore.getState().project.name).toBe('Recovered Work');
    expect(store.has('wf-autosave')).toBe(false);
    expect(store.has('wf-autosave-history')).toBe(false);
  });

  it('a legacy snapshot missing `zones` still recovers successfully (normalized, not rejected) and clears the autosave', () => {
    const legacyProject = { id: 'old', name: 'Pre-schema-change save' }; // no zones array
    store.set('wf-autosave', JSON.stringify({ project: legacyProject, timestamp: Date.now() }));

    const outcome = attemptCrashRecovery();

    expect(outcome).toEqual({ attempted: true, loaded: true });
    expect(useProjectStore.getState().project.name).toBe('Pre-schema-change save');
    expect(useProjectStore.getState().project.zones).toEqual([]);
    expect(store.has('wf-autosave')).toBe(false);
  });

  it('clears the slot when the outer entry has no usable project at all (nothing to preserve)', () => {
    store.set('wf-autosave', JSON.stringify({ project: null, timestamp: Date.now() }));
    // hasAutoSaveRecovery requires entry.project != null, so this path isn't
    // reachable via attemptCrashRecovery's normal flow — confirms the guard.
    expect(hasAutoSaveRecovery()).toBe(false);
    const outcome = attemptCrashRecovery();
    expect(outcome).toEqual({ attempted: false });
  });
});
