// export-modal.test.ts — ED-A-008 / ED-A-009: cover the ExportModal handler
// flows at the logic level (no DOM mount). Exercises `runEngineExport` and
// `runUnrealExport` extracted from ExportModal.tsx.

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execFile } from 'node:child_process';
import { writeFile, rm, mkdtemp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  loadContent,
  validateGameContent,
  type ContentPack as EngineContentPack,
} from '@ai-rpg-engine/content-schema';
import { exportToEngine } from '@world-forge/export-ai-rpg';
import type { WorldProject } from '@world-forge/schema';
import {
  runEngineExport,
  runUnrealExport,
  type ExportCallbacks,
  type ExportEnv,
  type ExportStatus,
} from '../panels/export-handlers.js';
import { computeTargetReadiness, ExportModal, TargetReadinessSummary } from '../panels/ExportModal.js';
import { STARTER_DIALOGUE } from '../panels/DialoguePanel.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import { prepareKitImport, serializeKit } from '../kits/bundle.js';
import { createProjectFromKit } from '../panels/TemplateManager.js';
import { prepareProjectImport, serializeProject } from '../projects/bundle.js';
import { createProjectFromWizard } from '../templates/registry.js';
import { useProjectStore } from '../store/project-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AI_RPG_CLI_PATH = resolve(__dirname, '../../../export-ai-rpg/dist/cli.js');

function runAiRpgCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    execFile('node', [AI_RPG_CLI_PATH, ...args], { timeout: 10_000 }, (error, stdout, stderr) => {
      resolvePromise({
        code: error?.code !== undefined ? (error.code as unknown as number) : error ? 1 : 0,
        stdout,
        stderr,
      });
    });
  });
}

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

// ── AI RPG encounterType readiness & Export JSON gating ───────────────

describe('E2: ExportModal per-target readiness on encounterType', () => {
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
        { id: 'enc-blocked', zoneId: validProject.zones[0].id, encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
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
});

describe('E2+: mapped/dropped encounter readiness and TargetReadinessSummary color', () => {
  it('computeTargetReadiness marks AI RPG ready for translated and dropped encounter types, listing approximations and drops', () => {
    const zoneId = validProject.zones[0].id;
    const mapped: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-boss', zoneId, encounterType: 'boss', enemyIds: [], probability: 1, cooldownTurns: 0, tags: [] },
        { id: 'enc-hazard', zoneId, encounterType: 'hazard', enemyIds: [], probability: 0.6, cooldownTurns: 2, tags: [] },
        { id: 'enc-discovery', zoneId, encounterType: 'discovery', enemyIds: [], probability: 0.4, cooldownTurns: 5, tags: [] },
      ],
    };

    const r = computeTargetReadiness(mapped, true);
    expect(r.aiRpg.ready).toBe(true);
    expect(r.aiRpg.blockers).toEqual([]);
    expect(r.aiRpg.advisories.some((a) => a.includes('enc-boss') && a.includes('duel'))).toBe(true);
    expect(r.aiRpg.advisories.some((a) => a.includes('enc-hazard') && a.includes('left out'))).toBe(true);
    expect(r.aiRpg.advisories.some((a) => a.includes('enc-discovery') && a.includes('left out'))).toBe(true);

    const html = renderToStaticMarkup(createElement(TargetReadinessSummary, { targetReadiness: r }));
    expect(html).not.toContain('Not ready');
    expect(html).toContain('Ready with 3 advisories');
    expect(html).toContain('enc-boss');
    expect(html).toContain('enc-hazard');
    expect(html).toContain('enc-discovery');
  });

  it('TargetReadinessSummary renders danger styling when blocked, warning when advisory-only, and success when clean ready', () => {
    const blocked: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-custom', zoneId: validProject.zones[0].id, encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      ],
    };
    const blockedHtml = renderToStaticMarkup(
      createElement(TargetReadinessSummary, { targetReadiness: computeTargetReadiness(blocked, true) }),
    );
    const blockedOuterStyle = /^<div style="([^"]+)"/.exec(blockedHtml)?.[1] ?? '';
    expect(blockedOuterStyle).toContain('var(--wf-danger)');
    expect(blockedOuterStyle).not.toContain('var(--wf-success)');

    const advisoryReadiness = {
      aiRpg: { ready: true, advisories: ['Encounter anchor "enc-boss" maps "boss" to "duel".'], blockers: [] },
      unreal: { ready: true, advisories: [], blockers: [] },
      godot: { ready: true, advisories: [], blockers: [] },
    };
    const advisoryHtml = renderToStaticMarkup(
      createElement(TargetReadinessSummary, { targetReadiness: advisoryReadiness }),
    );
    const advisoryOuterStyle = /^<div style="([^"]+)"/.exec(advisoryHtml)?.[1] ?? '';
    expect(advisoryOuterStyle).toContain('var(--wf-warning)');
    expect(advisoryOuterStyle).not.toContain('var(--wf-success)');

    const cleanReadiness = {
      aiRpg: { ready: true, advisories: [], blockers: [] },
      unreal: { ready: true, advisories: [], blockers: [] },
      godot: { ready: true, advisories: [], blockers: [] },
    };
    const cleanHtml = renderToStaticMarkup(
      createElement(TargetReadinessSummary, { targetReadiness: cleanReadiness }),
    );
    const cleanOuterStyle = /^<div style="([^"]+)"/.exec(cleanHtml)?.[1] ?? '';
    expect(cleanOuterStyle).toContain('var(--wf-success)');
    expect(cleanOuterStyle).not.toContain('var(--wf-danger)');
    expect(cleanOuterStyle).not.toContain('var(--wf-warning)');
  });
});

const PROTOTYPE_KEY_TYPES = ['constructor', 'toString', 'hasOwnProperty', '__proto__'] as const;

describe('E2+: prototype-key encounter types block editor readiness', () => {
  it.each(PROTOTYPE_KEY_TYPES)('computeTargetReadiness blocks AI RPG export for %s by name', (badType) => {
    const project: WorldProject = {
      ...validProject,
      encounterAnchors: [
        { id: 'enc-proto', zoneId: validProject.zones[0].id, encounterType: badType, enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
      ],
    };

    const readiness = computeTargetReadiness(project, true);
    expect(readiness.aiRpg.ready).toBe(false);
    expect(readiness.aiRpg.blockers.join('\n')).toContain('enc-proto');
    expect(readiness.aiRpg.blockers.join('\n')).toContain(badType);
    expect(readiness.aiRpg.advisories.join('\n')).not.toContain('enc-proto');
  });
});

describe('PR #57 fix 1: unresolved dialogue speakers refused by readiness and CLI', () => {
  let tmpDir: string;

  beforeAll(async () => {
    await access(AI_RPG_CLI_PATH);
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-spk-blocker-'));
  });

  afterAll(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  async function assertSpeakerRefused(
    name: string,
    project: WorldProject,
    dialogueId: string,
    speaker: string,
  ): Promise<void> {
    const readiness = computeTargetReadiness(project, true);
    expect(readiness.aiRpg.ready).toBe(false);
    expect(readiness.aiRpg.blockers.join('\n')).toContain(dialogueId);
    expect(readiness.aiRpg.blockers.join('\n')).toContain(speaker);

    const html = renderToStaticMarkup(createElement(TargetReadinessSummary, { targetReadiness: readiness }));
    const outerStyle = /^<div style="([^"]+)"/.exec(html)?.[1] ?? '';
    expect(outerStyle).toContain('var(--wf-danger)');

    const jsonPath = join(tmpDir, `${name}.json`);
    await writeFile(jsonPath, JSON.stringify(project, null, 2));
    const cli = await runAiRpgCli([jsonPath, '--validate-only']);
    expect(cli.code).toBe(1);
    expect(cli.stderr).toContain(dialogueId);
    expect(cli.stderr).toContain(speaker);
  }

  it('refuses a free-typed speaker name in readiness and CLI', async () => {
    const store = useProjectStore.getState();
    store.loadProject(structuredClone(validProject));
    const firstDlg = useProjectStore.getState().project.dialogues[0];
    store.updateDialogue(firstDlg.id, { speakers: ['Tavern Keeper'] });
    await assertSpeakerRefused('free-typed', useProjectStore.getState().project, firstDlg.id, 'Tavern Keeper');
  });

  it('refuses a speaker left dangling after removeEntity', async () => {
    const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold')!;
    const store = useProjectStore.getState();
    store.loadProject(structuredClone(chapel.project));
    store.removeEntity('suspicious-pilgrim');
    await assertSpeakerRefused('remove-entity', useProjectStore.getState().project, 'pilgrim-talk', 'suspicious-pilgrim');
  });

  it('refuses an unresolved speaker loaded from a .wfkit.json kit bundle', async () => {
    const baseKit = BUILTIN_KITS[0];
    const badProject: WorldProject = {
      ...structuredClone(baseKit.project),
      dialogues: [
        ...structuredClone(baseKit.project.dialogues),
        { id: 'kit-dlg', speakers: ['kit-ghost'], entryNodeId: 'n1', nodes: { n1: { id: 'n1', speaker: 'kit-ghost', text: 'Hello.', choices: [] } } },
      ],
    };
    const serialized = serializeKit({ ...baseKit, project: badProject });
    const imported = prepareKitImport(JSON.parse(JSON.stringify(serialized)));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);
    const created = createProjectFromKit({
      ...imported.kit,
      id: 'imported-kit-1',
      builtIn: false,
      createdAt: serialized.exportedAt,
      updatedAt: serialized.exportedAt,
    });
    await assertSpeakerRefused('kit-import', created, 'kit-dlg', 'kit-ghost');
  });

  it('refuses an unresolved speaker loaded from a .wfproject.json project bundle', async () => {
    const firstDlg = validProject.dialogues[0];
    const badProject: WorldProject = {
      ...structuredClone(validProject),
      dialogues: validProject.dialogues.map((d, i) => (i === 0 ? { ...d, speakers: ['bundle-ghost'] } : d)),
    };
    const serialized = serializeProject(badProject);
    const imported = prepareProjectImport(JSON.parse(JSON.stringify(serialized)));
    expect(imported.ok).toBe(true);
    if (!imported.ok) throw new Error(imported.error);
    await assertSpeakerRefused('bundle-import', imported.project, firstDlg.id, 'bundle-ghost');
  });

  it('refuses starter dialogue speakers when wizard creates a world without sample NPCs', async () => {
    const project = createProjectFromWizard({
      name: 'Wizard No NPCs',
      genre: 'fantasy',
      mode: 'district',
      includePlayer: true,
      includeBuildCatalog: false,
      includeProgressionTree: false,
      includeDialogue: true,
      includeSampleNPCs: false,
    });
    await assertSpeakerRefused('wizard-no-npcs', project, 'elder-talk', 'village-elder');
  });
});

describe('PR #57 fix 1: Keeper starter dialogue in a fresh project', () => {
  it('fresh project + Keeper starter exports to AI RPG without an engine-refused pack', () => {
    const store = useProjectStore.getState();
    store.newProject();
    store.addZone({
      id: 'zone-start',
      name: 'Entry Hall',
      tags: ['indoor'],
      description: 'Starting chamber.',
      gridX: 0,
      gridY: 0,
      gridWidth: 10,
      gridHeight: 10,
      neighbors: [],
      exits: [],
      light: 5,
      noise: 1,
      hazards: [],
      interactables: [],
    });
    store.addSpawnPoint({ id: 'sp-start', zoneId: 'zone-start', gridX: 2, gridY: 2, isDefault: true });
    store.addDialogue(structuredClone(STARTER_DIALOGUE));

    const project = useProjectStore.getState().project;
    const readiness = computeTargetReadiness(project, true);
    if (readiness.aiRpg.ready) {
      const exported = exportToEngine(project);
      expect(exported.success).toBe(true);
      if (!exported.success) throw new Error('exportToEngine failed');
      const enginePack = exported.contentPack as unknown as EngineContentPack;
      expect(validateGameContent(enginePack).ok).toBe(true);
      expect(loadContent(enginePack).ok).toBe(true);
    } else {
      expect(readiness.aiRpg.blockers.length).toBeGreaterThan(0);
    }
  });
});
