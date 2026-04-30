// ed-b-humanization.test.ts — logic-level coverage for the Stage C humanization
// pass (ED-B-001 … ED-B-014). We avoid mounting React where a pure-function or
// direct-module check is possible; the handler + store wiring carries the
// user-visible behavior.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  pushToast, dismissToast, _resetToastsForTest, _getToastsForTest,
} from '../ui/Toast.js';
import {
  runEngineExport, runUnrealExport,
  type ExportEnv,
} from '../panels/export-handlers.js';
import {
  getLastAutoSaveError, clearLastAutoSaveError, getAutoSaveHealth,
} from '../store/project-store.js';
import {
  buildSearchIndex, filterResults, pruneRecentSearches,
} from '../panels/SearchOverlay.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import type { WorldProject } from '@world-forge/schema';

// ── Toast primitive ─────────────────────────────────────────────────────

describe('Toast primitive (shared infrastructure for ED-B-006, ED-B-013)', () => {
  beforeEach(() => { _resetToastsForTest(); });

  it('pushes and auto-dismisses a toast', async () => {
    vi.useFakeTimers();
    const id = pushToast('hello', 'info', 100);
    expect(_getToastsForTest()).toHaveLength(1);
    expect(_getToastsForTest()[0].id).toBe(id);
    vi.advanceTimersByTime(101);
    expect(_getToastsForTest()).toHaveLength(0);
    vi.useRealTimers();
  });

  it('supports manual dismiss', () => {
    const id = pushToast('warn', 'warning', 10_000);
    expect(_getToastsForTest()).toHaveLength(1);
    dismissToast(id);
    expect(_getToastsForTest()).toHaveLength(0);
  });
});

// ── ED-B-002: export manual-download fallback ────────────────────────────

const validProject: WorldProject = SAMPLE_WORLDS[2].project;

function makeStubEnv(returnUrl: string | null): ExportEnv {
  return {
    downloadJson: () => returnUrl,
  };
}

function makeCb() {
  let status = 'idle' as string;
  let errors: string[] = [];
  let warnings: string[] = [];
  let exported = 0;
  let fallback: { href: string; filename: string } | null = null;
  return {
    setStatus: (s: string) => { status = s; },
    setErrors: (e: string[]) => { errors = e; },
    setWarnings: (w: string[]) => { warnings = w; },
    markExported: () => { exported += 1; },
    setFallback: (f: { href: string; filename: string } | null) => { fallback = f; },
    get status() { return status; },
    get errors() { return errors; },
    get warnings() { return warnings; },
    get exported() { return exported; },
    get fallback() { return fallback; },
  };
}

describe('ED-B-002: export manual-download fallback', () => {
  it('runEngineExport populates setFallback with filename + href', async () => {
    const cb = makeCb();
    await runEngineExport(validProject, cb, makeStubEnv('blob:fake-engine-url'));
    expect(cb.status).toBe('exported');
    expect(cb.exported).toBe(1);
    expect(cb.fallback).toEqual({
      href: 'blob:fake-engine-url',
      filename: `${validProject.id}-engine-pack.json`,
    });
  });

  it('runUnrealExport populates setFallback with filename + href', async () => {
    const cb = makeCb();
    await runUnrealExport(validProject, cb, makeStubEnv('blob:fake-unreal-url'));
    expect(cb.status).toBe('exported');
    expect(cb.fallback).toEqual({
      href: 'blob:fake-unreal-url',
      filename: `${validProject.id}-unreal-pack.json`,
    });
  });

  it('skips fallback when env returns null (caller-suppressed)', async () => {
    const cb = makeCb();
    await runEngineExport(validProject, cb, makeStubEnv(null));
    expect(cb.status).toBe('exported');
    expect(cb.fallback).toBeNull();
  });
});

// ── ED-B-001 + ED-B-008: auto-save error + health getters ───────────────

describe('ED-B-001 / ED-B-008: auto-save health getters', () => {
  beforeEach(() => { clearLastAutoSaveError(); });

  it('getAutoSaveHealth returns a structured snapshot', () => {
    const h = getAutoSaveHealth();
    expect(h).toMatchObject({
      lastError: null,
      oversize: expect.any(Boolean),
      lastBytes: expect.any(Number),
      limitBytes: expect.any(Number),
    });
    expect(h.limitBytes).toBeGreaterThan(1_000_000);
  });

  it('clearLastAutoSaveError is idempotent', () => {
    clearLastAutoSaveError();
    expect(getLastAutoSaveError()).toBeNull();
    clearLastAutoSaveError();
    expect(getLastAutoSaveError()).toBeNull();
  });
});

// ── ED-B-006: stale recent-search pruning ───────────────────────────────

describe('ED-B-006: stale recent-search pruning', () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });
  afterEach(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });

  it('pruneRecentSearches drops terms that no longer match anything', () => {
    const project = validProject;
    const idx = buildSearchIndex(project);
    // "zzz-not-in-project" matches nothing; "chapel" should match since the
    // chapel sample project is zone/tag heavy. Fall back to a real label from
    // the index to avoid a brittle hardcoded name.
    const realTerm = idx[0]?.label ?? 'zone';
    const stale = ['zzz-not-in-project', realTerm];
    const pruned = pruneRecentSearches(idx, stale);
    expect(pruned).toEqual([realTerm]);
  });

  it('pruneRecentSearches is a no-op when everything still matches', () => {
    const project = validProject;
    const idx = buildSearchIndex(project);
    const realTerm = idx[0]?.label ?? 'zone';
    const kept = pruneRecentSearches(idx, [realTerm]);
    expect(kept).toEqual([realTerm]);
  });
});

// ── Sanity: filter + index still behave ─────────────────────────────────

describe('ED-B-006 adjacent: filterResults still returns empty for unknown', () => {
  it('returns [] for a term with no hits', () => {
    const idx = buildSearchIndex(validProject);
    expect(filterResults(idx, 'zzz-not-in-project-xyz')).toEqual([]);
  });
});
