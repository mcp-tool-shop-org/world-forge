// export-modal.test.ts — ED-A-008 / ED-A-009: cover the ExportModal handler
// flows at the logic level (no DOM mount). Exercises `runEngineExport` and
// `runUnrealExport` extracted from ExportModal.tsx.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement, isValidElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { WorldProject } from '@world-forge/schema';

const modalHarness = vi.hoisted(() => ({
  onModalChildren: null as ((children: unknown) => void) | null,
  runEngineExportSpy: null as ReturnType<typeof vi.fn> | null,
}));

vi.mock('../ui/ModalFrame.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui/ModalFrame.js')>();
  return {
    ...actual,
    ModalFrame: (props: Parameters<typeof actual.ModalFrame>[0]) => {
      modalHarness.onModalChildren?.(props.children);
      return actual.ModalFrame(props);
    },
  };
});

vi.mock('../panels/export-handlers.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../panels/export-handlers.js')>();
  const spy = vi.fn((...args: Parameters<typeof actual.runEngineExport>) => actual.runEngineExport(...args));
  modalHarness.runEngineExportSpy = spy;
  return {
    ...actual,
    runEngineExport: spy,
  };
});

import {
  runEngineExport,
  runUnrealExport,
  type ExportCallbacks,
  type ExportEnv,
  type ExportStatus,
} from '../panels/export-handlers.js';
import { computeTargetReadiness, ExportModal, TargetReadinessSummary } from '../panels/ExportModal.js';
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
      // ED-B-002: ExportEnv.downloadJson now returns the object URL (or null)
      // so the handler can surface a manual-download fallback in the modal.
      return null;
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
    {
      id: 'bad', name: '', tags: [], description: '', gridX: -1, gridY: -1,
      gridWidth: 0, gridHeight: 0, neighbors: [], exits: [], light: 0, noise: 0,
      hazards: [], interactables: []
    } as WorldProject['zones'][number],
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

  it('succeeds on a valid project and sets status=exported', async () => {
    await runEngineExport(validProject, harness.cb, env);
    expect(harness.getStatus()).toBe('exported');
    expect(harness.exportedCount()).toBe(1);
    expect(env.count).toBe(1);
    expect(env.last?.filename).toBe(`${validProject.id}-engine-pack.json`);
    expect(env.last?.data).toMatchObject({ contentPack: expect.any(Object) });
    expect(harness.getErrors()).toEqual([]);
  });

  it('sets status=invalid and populates errors[] on validation failure', async () => {
    await runEngineExport(invalidProject, harness.cb, env);
    expect(harness.getStatus()).toBe('invalid');
    expect(harness.getErrors().length).toBeGreaterThan(0);
    expect(env.count).toBe(0); // never attempted the download
    expect(harness.exportedCount()).toBe(0);
  });

  it('clears stale errors between attempts (ED-A-001)', async () => {
    // First attempt: invalid → errors populated
    await runEngineExport(invalidProject, harness.cb, env);
    expect(harness.getErrors().length).toBeGreaterThan(0);

    // Second attempt: valid → stale errors must be wiped before new attempt
    await runEngineExport(validProject, harness.cb, env);
    expect(harness.getErrors()).toEqual([]);
    expect(harness.getStatus()).toBe('exported');
    // Status history should include an 'idle' reset between runs.
    expect(harness.statusHistory()).toContain('idle');
  });

  it('catches serialization failure and surfaces it as errors[] + invalid status (ED-A-011)', async () => {
    const throwingEnv = makeThrowingEnv('Converting circular structure to JSON');
    await runEngineExport(validProject, harness.cb, throwingEnv);
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

  it('succeeds on a valid project (mock-friendly env) and includes fidelity', async () => {
    await runUnrealExport(validProject, harness.cb, env);
    expect(harness.getStatus()).toBe('exported');
    expect(harness.exportedCount()).toBe(1);
    expect(env.last?.filename).toBe(`${validProject.id}-unreal-pack.json`);
    // ED-A-006: fidelity is always present on success — the bundle must carry it.
    expect(env.last?.data).toMatchObject({
      contentPack: expect.any(Object),
      fidelity: expect.any(Object),
    });
  });

  it('clears stale errors between attempts (ED-A-002)', async () => {
    await runUnrealExport(invalidProject, harness.cb, env);
    expect(harness.getErrors().length).toBeGreaterThan(0);
    const firstCount = harness.getErrors().length;
    expect(firstCount).toBeGreaterThan(0);

    await runUnrealExport(validProject, harness.cb, env);
    expect(harness.getErrors()).toEqual([]);
    expect(harness.getStatus()).toBe('exported');
  });

  it('sets status=invalid with errors[] when project fails validation', async () => {
    await runUnrealExport(invalidProject, harness.cb, env);
    expect(harness.getStatus()).toBe('invalid');
    expect(harness.getErrors().length).toBeGreaterThan(0);
    expect(env.count).toBe(0);
    expect(harness.exportedCount()).toBe(0);
  });

  it('catches Unreal serialization failure (ED-A-011)', async () => {
    const throwingEnv = makeThrowingEnv('boom');
    await runUnrealExport(validProject, harness.cb, throwingEnv);
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

function textContentOf(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContentOf).join('');
  if (isValidElement<{ children?: unknown }>(node)) return textContentOf(node.props.children);
  return '';
}

function findButtonOnClick(node: unknown, label: string): (() => void) | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findButtonOnClick(child, label);
      if (found) return found;
    }
    return undefined;
  }
  if (!isValidElement<{ children?: unknown; onClick?: () => void }>(node)) return undefined;
  if (node.type === 'button' && textContentOf(node.props.children) === label) {
    return node.props.onClick;
  }
  return findButtonOnClick(node.props.children, label);
}

// ── AI RPG encounterType readiness & Export JSON gating ───────────────

describe('ExportModal per-target readiness on encounterType', () => {
  afterEach(() => {
    modalHarness.onModalChildren = null;
    modalHarness.runEngineExportSpy?.mockClear();
  });

  it('computeTargetReadiness marks AI RPG not ready with blocker when encounterType is outside engine four, leaving UE5 and Godot ready', () => {
    const blocked: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-blocked', zoneId: validProject.zones[0].id, encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    const r = computeTargetReadiness(blocked, true);
    expect(r.aiRpg.ready).toBe(false);
    expect(r.aiRpg.blockers).toHaveLength(1);
    expect(r.aiRpg.blockers[0]).toContain('enc-blocked');
    expect(r.aiRpg.blockers[0]).toContain('ambush');
    expect(r.aiRpg.blockers[0]).toContain('patrol');
    expect(r.aiRpg.blockers[0]).toContain('horde');
    expect(r.aiRpg.blockers[0]).toContain('duel');
    expect(r.unreal.ready).toBe(true);
    expect(r.unreal.blockers).toEqual([]);
    expect(r.godot.ready).toBe(true);
    expect(r.godot.blockers).toEqual([]);
  });

  it('ExportModal renders AI RPG as Not ready with listed blockers while UE5 and Godot remain Ready', () => {
    const blocked: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-blocked', zoneId: validProject.zones[0].id, encounterType: 'pirate', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    const readiness = computeTargetReadiness(blocked, true);
    const html = renderToStaticMarkup(createElement(TargetReadinessSummary, { targetReadiness: readiness }));
    expect(html).toContain('AI RPG:');
    expect(html).toContain('Not ready (1 blocker)');
    expect(html).toContain('enc-blocked');
    expect(html).toContain('ambush, patrol, horde, duel');
    expect(html).toContain('UE5:');
    expect(html).toContain('Godot:');
    expect(html).toContain('Ready with 2 advisories');
  });

  it('computeTargetReadiness marks AI RPG ready when encounterAnchors use valid engine types', () => {
    const ok: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-ok', zoneId: validProject.zones[0].id, encounterType: 'horde', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    const r = computeTargetReadiness(ok, true);
    expect(r.aiRpg.ready).toBe(true);
    expect(r.aiRpg.blockers).toEqual([]);
    expect(r.unreal.ready).toBe(true);
    expect(r.godot.ready).toBe(true);
  });

  it('ExportModal disables Export JSON while !targetReadiness.aiRpg.ready, keeping UE5 and Godot enabled', () => {
    const blocked: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-blocked', zoneId: validProject.zones[0].id, encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    const html = renderToStaticMarkup(createElement(ExportModal, { onClose: () => {}, project: blocked }));
    const exportJsonBtn = /<button[^>]*>Export JSON<\/button>/.exec(html)?.[0];
    const exportUe5Btn = /<button[^>]*>Export Unreal Engine 5<\/button>/.exec(html)?.[0];
    const exportGodotBtn = /<button[^>]*>Export Godot 4<\/button>/.exec(html)?.[0];
    expect(exportJsonBtn).toBeDefined();
    expect(exportJsonBtn).toContain('disabled=""');
    expect(exportUe5Btn).toBeDefined();
    expect(exportUe5Btn).not.toContain('disabled=""');
    expect(exportGodotBtn).toBeDefined();
    expect(exportGodotBtn).not.toContain('disabled=""');
  });

  it('ExportModal enables Export JSON when AI RPG readiness has no blockers', () => {
    const ok: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-ok', zoneId: validProject.zones[0].id, encounterType: 'horde', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    const html = renderToStaticMarkup(createElement(ExportModal, { onClose: () => {}, project: ok }));
    const exportJsonBtn = /<button[^>]*>Export JSON<\/button>/.exec(html)?.[0];
    expect(exportJsonBtn).toBeDefined();
    expect(exportJsonBtn).not.toContain('disabled=""');
  });

  it('handleExport guard blocks runEngineExport when !precheck.valid or !targetReadiness.aiRpg.ready, and invokes it when ready', async () => {
    const spy = modalHarness.runEngineExportSpy!;
    const captureOnClick = (proj: WorldProject): (() => void) => {
      let captured: unknown = null;
      modalHarness.onModalChildren = (children) => { captured = children; };
      renderToStaticMarkup(createElement(ExportModal, { onClose: () => {}, project: proj }));
      const handler = findButtonOnClick(captured, 'Export JSON');
      expect(handler, 'Export JSON button onClick handler should be wired').toBeTypeOf('function');
      return handler!;
    };

    // Case 1: valid schema, blocked by non-engine encounterType
    const blocked: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-blocked', zoneId: validProject.zones[0].id, encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    spy.mockImplementationOnce(async () => {});
    captureOnClick(blocked)();
    expect(spy).not.toHaveBeenCalled();

    // Case 2: invalid schema (!precheck.valid)
    spy.mockReset();
    spy.mockImplementation(async () => {});
    captureOnClick(invalidProject)();
    expect(spy).not.toHaveBeenCalled();

    // Control: ready project triggers runEngineExport once
    const ok: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-ok', zoneId: validProject.zones[0].id, encounterType: 'horde', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    spy.mockClear();
    captureOnClick(ok)();
    expect(spy).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    // Reset default passthrough implementation for any subsequent calls.
    const actualHandlers = await vi.importActual<typeof import('../panels/export-handlers.js')>('../panels/export-handlers.js');
    spy.mockImplementation((...args: Parameters<typeof actualHandlers.runEngineExport>) => actualHandlers.runEngineExport(...args));
  });
});
