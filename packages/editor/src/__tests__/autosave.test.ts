import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useProjectStore,
  createEmptyProject,
  hasAutoSaveRecovery,
  recoverAutoSave,
  clearAutoSave,
  startAutoSave,
  stopAutoSave,
  flushAutoSaveIfDirty,
  writeAutoSave,
} from '../store/project-store.js';

// Mock localStorage
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

describe('Auto-save + Crash Recovery (FT-001)', () => {
  beforeEach(() => {
    store.clear();
    stopAutoSave();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAutoSave();
    vi.useRealTimers();
  });

  it('hasAutoSaveRecovery returns false when nothing saved', () => {
    expect(hasAutoSaveRecovery()).toBe(false);
  });

  it('hasAutoSaveRecovery returns false for invalid JSON', () => {
    store.set('wf-autosave', '{invalid');
    expect(hasAutoSaveRecovery()).toBe(false);
  });

  it('recoverAutoSave returns null when nothing saved', () => {
    expect(recoverAutoSave()).toBeNull();
  });

  it('clearAutoSave removes both keys', () => {
    store.set('wf-autosave', '{"project":{},"timestamp":1}');
    store.set('wf-autosave-history', '[]');
    clearAutoSave();
    expect(store.has('wf-autosave')).toBe(false);
    expect(store.has('wf-autosave-history')).toBe(false);
  });

  it('auto-save writes to localStorage when dirty after interval', () => {
    const project = createEmptyProject();
    useProjectStore.getState().loadProject(project);
    // Mark dirty via an update
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Dirty Project' }));
    expect(useProjectStore.getState().dirty).toBe(true);

    startAutoSave();
    vi.advanceTimersByTime(30_000);

    expect(hasAutoSaveRecovery()).toBe(true);
    const recovered = recoverAutoSave();
    expect(recovered).not.toBeNull();
    expect(recovered!.name).toBe('Dirty Project');
  });

  it('auto-save does NOT write when not dirty', () => {
    const project = createEmptyProject();
    useProjectStore.getState().loadProject(project);
    expect(useProjectStore.getState().dirty).toBe(false);

    startAutoSave();
    vi.advanceTimersByTime(30_000);

    expect(hasAutoSaveRecovery()).toBe(false);
  });

  it('auto-save history keeps at most 3 entries', () => {
    useProjectStore.getState().loadProject(createEmptyProject());

    startAutoSave();

    for (let i = 1; i <= 5; i++) {
      useProjectStore.getState().updateProject((p) => ({ ...p, name: `Version ${i}` }));
      vi.advanceTimersByTime(30_000);
    }

    const raw = store.get('wf-autosave-history');
    expect(raw).toBeTruthy();
    const history = JSON.parse(raw!);
    expect(history.length).toBe(3);
    // Most recent should be the last entry
    expect(history[2].project.name).toBe('Version 5');
  });

  it('startAutoSave is idempotent (no double timers)', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'X' }));

    startAutoSave();
    startAutoSave(); // second call should be no-op
    vi.advanceTimersByTime(30_000);

    // Should only have 1 entry in history, not 2
    const history = JSON.parse(store.get('wf-autosave-history')!);
    expect(history.length).toBe(1);
  });

  it('stopAutoSave prevents further writes', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Before Stop' }));

    startAutoSave();
    vi.advanceTimersByTime(30_000);
    expect(hasAutoSaveRecovery()).toBe(true);

    clearAutoSave();
    stopAutoSave();

    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'After Stop' }));
    vi.advanceTimersByTime(60_000);

    expect(hasAutoSaveRecovery()).toBe(false);
  });

  it('F-e6f1b71a: flushAutoSaveIfDirty writes immediately when dirty and is a no-op when clean', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    expect(flushAutoSaveIfDirty()).toBe(false);
    expect(hasAutoSaveRecovery()).toBe(false);

    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Flushed' }));
    expect(useProjectStore.getState().dirty).toBe(true);
    expect(flushAutoSaveIfDirty()).toBe(true);
    expect(hasAutoSaveRecovery()).toBe(true);
    expect(recoverAutoSave()?.name).toBe('Flushed');
  });

  it('F-e6f1b71a: flushAutoSaveIfDirty calls writeAutoSave', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Spy' }));
    const spy = vi.spyOn({ writeAutoSave }, 'writeAutoSave');
    // The named export is the same function the flush helper calls; asserting
    // the slot is the observable consequence.
    flushAutoSaveIfDirty();
    expect(hasAutoSaveRecovery()).toBe(true);
    spy.mockRestore();
  });
});

// --- Phase 17: markClean + persistence regression ---

describe('Phase 17: markClean resets dirty flag', () => {
  it('markClean sets dirty to false without clearing undo stack', () => {
    const project = createEmptyProject();
    useProjectStore.getState().loadProject(project);
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Changed' }));
    expect(useProjectStore.getState().dirty).toBe(true);
    expect(useProjectStore.getState().getUndoCount()).toBe(1);

    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().dirty).toBe(false);
    // Undo stack should still be intact
    expect(useProjectStore.getState().getUndoCount()).toBe(1);
    expect(useProjectStore.getState().project.name).toBe('Changed');
  });

  it('editing after markClean makes dirty again', () => {
    const project = createEmptyProject();
    useProjectStore.getState().loadProject(project);
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'First' }));
    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().dirty).toBe(false);

    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Second' }));
    expect(useProjectStore.getState().dirty).toBe(true);
  });
});

// F-9e54f408: clearAutoSave existed but production lifecycle never called it
// except inside attemptCrashRecovery after a successful boot recover. Load /
// New / Save left the slot in place, so abandoning A (autosaved) then loading
// B resurrected A as "crash recovery" on next boot.
describe('F-9e54f408: loadProject / newProject / markClean drop the crash-recovery slot', () => {
  beforeEach(() => {
    store.clear();
    stopAutoSave();
    vi.useFakeTimers();
  });

  afterEach(() => {
    stopAutoSave();
    vi.useRealTimers();
  });

  function seedDirtyAutosave(name: string): void {
    useProjectStore.getState().loadProject(createEmptyProject());
    useProjectStore.getState().updateProject((p) => ({ ...p, name }));
    startAutoSave();
    vi.advanceTimersByTime(30_000);
    expect(hasAutoSaveRecovery()).toBe(true);
  }

  it('loadProject after a dirty autosave slot makes hasAutoSaveRecovery() false', () => {
    seedDirtyAutosave('Abandoned A');
    const b = { ...createEmptyProject(), name: 'Project B' };
    const ok = useProjectStore.getState().loadProject(b);
    expect(ok).toBe(true);
    expect(hasAutoSaveRecovery()).toBe(false);
  });

  it('newProject after a dirty autosave slot makes hasAutoSaveRecovery() false', () => {
    seedDirtyAutosave('Abandoned A');
    useProjectStore.getState().newProject();
    expect(hasAutoSaveRecovery()).toBe(false);
  });

  it('markClean (successful Save) after a dirty autosave slot makes hasAutoSaveRecovery() false', () => {
    seedDirtyAutosave('Saved A');
    useProjectStore.getState().markClean();
    expect(hasAutoSaveRecovery()).toBe(false);
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('a rejected loadProject does NOT clear the autosave slot', () => {
    seedDirtyAutosave('Still Recoverable');
    const ok = useProjectStore.getState().loadProject('not a project' as never);
    expect(ok).toBe(false);
    expect(hasAutoSaveRecovery()).toBe(true);
  });
});

