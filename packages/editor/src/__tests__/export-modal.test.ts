// export-modal.test.ts — ED-A-008 / ED-A-009: cover the ExportModal handler
// flows at the logic level (no DOM mount). Exercises `runEngineExport` and
// `runUnrealExport` extracted from ExportModal.tsx.

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldProject } from '@world-forge/schema';
import {
  runEngineExport,
  runUnrealExport,
  type ExportCallbacks,
  type ExportEnv,
  type ExportStatus,
} from '../panels/export-handlers.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';

// ── Test doubles ───────────────────────────────────────────────────────

function makeCallbacks(): {
  cb: ExportCallbacks;
  getStatus: () => ExportStatus | null;
  getErrors: () => string[];
  getWarnings: () => string[];
  exportedCount: () => number;
  statusHistory: () => ExportStatus[];
} {
  let status: ExportStatus | null = null;
  let errors: string[] = [];
  let warnings: string[] = [];
  let exported = 0;
  const statusHistory: ExportStatus[] = [];

  return {
    cb: {
      setErrors: (e) => { errors = e; },
      setWarnings: (w) => { warnings = w; },
      setStatus: (s) => { status = s; statusHistory.push(s); },
      markExported: () => { exported += 1; },
    },
    getStatus: () => status,
    getErrors: () => errors,
    getWarnings: () => warnings,
    exportedCount: () => exported,
    statusHistory: () => statusHistory,
  };
}

/** Captures the last filename + payload fed to `downloadJson`. */
function makeEnv(): ExportEnv & { last: { filename: string; data: unknown } | null; count: number } {
  const harness: { filename: string; data: unknown } | null = null;
  const env = {
    last: harness as { filename: string; data: unknown } | null,
    count: 0,
    downloadJson: (filename: string, data: unknown) => {
      env.last = { filename, data };
      env.count += 1;
    },
  };
  return env;
}

/** Env that always throws — simulates a circular-reference JSON error. */
function makeThrowingEnv(message: string): ExportEnv {
  return {
    downloadJson: () => {
      throw new Error(message);
    },
  };
}

// The `chapel` sample is a validated WorldProject that passes
// exportToEngine + exportToUnreal cleanly.
const validProject: WorldProject = SAMPLE_WORLDS[2].project;

// An intentionally invalid project (missing required nested fields) so the
// export pipelines reject it via validateProject().
const invalidProject: WorldProject = {
  ...validProject,
  zones: [
    // Missing required fields (e.g. gridWidth) to fail validation.
    { id: 'bad', name: '', tags: [], description: '', gridX: -1, gridY: -1,
      gridWidth: 0, gridHeight: 0, neighbors: [], exits: [], light: 0, noise: 0,
      hazards: [], interactables: [] } as WorldProject['zones'][number],
  ],
  spawnPoints: [], // no default spawn → validation failure
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('ED-A-008/009: runEngineExport', () => {
  let harness: ReturnType<typeof makeCallbacks>;
  let env: ReturnType<typeof makeEnv>;

  beforeEach(() => {
    harness = makeCallbacks();
    env = makeEnv();
  });

  it('succeeds on a valid project and sets status=exported', () => {
    runEngineExport(validProject, harness.cb, env);
    expect(harness.getStatus()).toBe('exported');
    expect(harness.exportedCount()).toBe(1);
    expect(env.count).toBe(1);
    expect(env.last?.filename).toBe(`${validProject.id}-engine-pack.json`);
    expect(env.last?.data).toMatchObject({ contentPack: expect.any(Object) });
    expect(harness.getErrors()).toEqual([]);
  });

  it('sets status=invalid and populates errors[] on validation failure', () => {
    runEngineExport(invalidProject, harness.cb, env);
    expect(harness.getStatus()).toBe('invalid');
    expect(harness.getErrors().length).toBeGreaterThan(0);
    expect(env.count).toBe(0); // never attempted the download
    expect(harness.exportedCount()).toBe(0);
  });

  it('clears stale errors between attempts (ED-A-001)', () => {
    // First attempt: invalid → errors populated
    runEngineExport(invalidProject, harness.cb, env);
    expect(harness.getErrors().length).toBeGreaterThan(0);

    // Second attempt: valid → stale errors must be wiped before new attempt
    runEngineExport(validProject, harness.cb, env);
    expect(harness.getErrors()).toEqual([]);
    expect(harness.getStatus()).toBe('exported');
    // Status history should include an 'idle' reset between runs.
    expect(harness.statusHistory()).toContain('idle');
  });

  it('catches serialization failure and surfaces it as errors[] + invalid status (ED-A-011)', () => {
    const throwingEnv = makeThrowingEnv('Converting circular structure to JSON');
    runEngineExport(validProject, harness.cb, throwingEnv);
    expect(harness.getStatus()).toBe('invalid');
    expect(harness.getErrors().length).toBe(1);
    expect(harness.getErrors()[0]).toContain('Failed to serialize export bundle');
    expect(harness.getErrors()[0]).toContain('circular');
    expect(harness.exportedCount()).toBe(0);
  });
});

describe('ED-A-008/009: runUnrealExport', () => {
  let harness: ReturnType<typeof makeCallbacks>;
  let env: ReturnType<typeof makeEnv>;

  beforeEach(() => {
    harness = makeCallbacks();
    env = makeEnv();
  });

  it('succeeds on a valid project (mock-friendly env) and includes fidelity', () => {
    runUnrealExport(validProject, harness.cb, env);
    expect(harness.getStatus()).toBe('exported');
    expect(harness.exportedCount()).toBe(1);
    expect(env.last?.filename).toBe(`${validProject.id}-unreal-pack.json`);
    // ED-A-006: fidelity is always present on success — the bundle must carry it.
    expect(env.last?.data).toMatchObject({
      contentPack: expect.any(Object),
      fidelity: expect.any(Object),
    });
  });

  it('clears stale errors between attempts (ED-A-002)', () => {
    runUnrealExport(invalidProject, harness.cb, env);
    expect(harness.getErrors().length).toBeGreaterThan(0);
    const firstCount = harness.getErrors().length;
    expect(firstCount).toBeGreaterThan(0);

    runUnrealExport(validProject, harness.cb, env);
    expect(harness.getErrors()).toEqual([]);
    expect(harness.getStatus()).toBe('exported');
  });

  it('sets status=invalid with errors[] when project fails validation', () => {
    runUnrealExport(invalidProject, harness.cb, env);
    expect(harness.getStatus()).toBe('invalid');
    expect(harness.getErrors().length).toBeGreaterThan(0);
    expect(env.count).toBe(0);
    expect(harness.exportedCount()).toBe(0);
  });

  it('catches Unreal serialization failure (ED-A-011)', () => {
    const throwingEnv = makeThrowingEnv('boom');
    runUnrealExport(validProject, harness.cb, throwingEnv);
    expect(harness.getStatus()).toBe('invalid');
    expect(harness.getErrors()[0]).toContain('Failed to serialize Unreal export bundle');
    expect(harness.getErrors()[0]).toContain('boom');
    expect(harness.exportedCount()).toBe(0);
  });
});

// ── Speed-panel / Escape-hotkey contract (ED-A-013) ────────────────────
// Editor tests are logic-level — we exercise the store transitions rather
// than a DOM keydown. This mirrors how `speed-panel-store.test.ts` runs.

describe('ED-A-013: speed panel Escape behaviour', () => {
  it('closing an open speed panel resets all panel state', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    const s = useEditorStore.getState();
    s.openSpeedPanel(10, 20, null);
    expect(useEditorStore.getState().showSpeedPanel).toBe(true);
    expect(useEditorStore.getState().speedPanelPosition).toEqual({ x: 10, y: 20 });

    // Escape → closeSpeedPanel is the handler the Canvas wires up.
    useEditorStore.getState().closeSpeedPanel();
    const after = useEditorStore.getState();
    expect(after.showSpeedPanel).toBe(false);
    expect(after.speedPanelPosition).toBeNull();
    expect(after.speedPanelContext).toBeNull();
    expect(after.speedPanelEditMode).toBe(false);
  });

  it('closeSpeedPanel when already closed is idempotent (no-op)', async () => {
    const { useEditorStore } = await import('../store/editor-store.js');
    useEditorStore.getState().closeSpeedPanel();
    expect(useEditorStore.getState().showSpeedPanel).toBe(false);
    // Calling again must not throw or flip state.
    useEditorStore.getState().closeSpeedPanel();
    expect(useEditorStore.getState().showSpeedPanel).toBe(false);
  });

  it('Escape on a hotkey-registered binding resolves to the escape action', async () => {
    const { HOTKEY_BINDINGS } = await import('../hotkeys.js');
    const escape = HOTKEY_BINDINGS.find((b) => b.key === 'Escape');
    expect(escape).toBeDefined();
    expect(escape?.action).toBe('escape');
    // No Ctrl/Shift modifiers — confirms it's the plain-Escape binding.
    expect(escape?.ctrl).toBeUndefined();
    expect(escape?.shift).toBeUndefined();
  });
});
