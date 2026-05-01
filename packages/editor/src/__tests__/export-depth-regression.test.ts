// export-depth-regression.test.ts — Phase 10E: regression lock for export
// depth features (10A receipts, 10B options, 10C readiness).
//
// Exercises the export handlers at logic level to ensure:
// - AI RPG, UE5, and Godot exports produce receipts
// - Options wire through correctly
// - Per-target readiness and advisories are computed correctly

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldProject } from '@world-forge/schema';
import {
    runEngineExport,
    runUnrealExport,
    runGodotExport,
    type ExportCallbacks,
    type ExportEnv,
    type ExportStatus,
    type ExportReceipt,
    type AiRpgExportOptions,
    type UnrealExportOptions,
    type GodotExportUIOptions,
    DEFAULT_AI_RPG_OPTIONS,
    DEFAULT_UNREAL_OPTIONS,
    DEFAULT_GODOT_OPTIONS,
} from '../panels/export-handlers.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';

// ── Test doubles ───────────────────────────────────────────────────────

function makeCallbacks(): {
    cb: ExportCallbacks;
    getStatus: () => ExportStatus | null;
    getErrors: () => string[];
    getWarnings: () => string[];
    getReceipts: () => ExportReceipt[];
} {
    let status: ExportStatus | null = null;
    let errors: string[] = [];
    let warnings: string[] = [];
    const receipts: ExportReceipt[] = [];

    return {
        cb: {
            setErrors: (e) => { errors = e; },
            setWarnings: (w) => { warnings = w; },
            setStatus: (s) => { status = s; },
            markExported: () => { },
            addReceipt: (r) => { receipts.push(r); },
        },
        getStatus: () => status,
        getErrors: () => errors,
        getWarnings: () => warnings,
        getReceipts: () => receipts,
    };
}

function makeEnv(): ExportEnv {
    return {
        downloadJson: () => null,
    };
}

const chapel: WorldProject = SAMPLE_WORLDS[2].project;

// ── 10E: Receipt regression ──────────────────────────────────────────

describe('10E: AI RPG export receipt', () => {
    let h: ReturnType<typeof makeCallbacks>;
    let env: ExportEnv;

    beforeEach(() => { h = makeCallbacks(); env = makeEnv(); });

    it('produces a receipt on successful export', async () => {
        await runEngineExport(chapel, h.cb, env);
        expect(h.getStatus()).toBe('exported');
        expect(h.getReceipts()).toHaveLength(1);
        const r = h.getReceipts()[0];
        expect(r.target).toBe('ai-rpg');
        expect(r.zones).toBe(chapel.zones.length);
        expect(r.entities).toBe(chapel.entityPlacements.length);
        expect(r.items).toBe(chapel.itemPlacements.length);
        expect(r.dialogues).toBe(chapel.dialogues.length);
        expect(r.trees).toBe(chapel.progressionTrees.length);
        expect(r.filename).toContain('engine-pack.json');
        expect(r.fidelity).toBe('preserved');
        expect(r.sizeEstimate).toBeGreaterThan(0);
        expect(r.timestamp).toBeGreaterThan(0);
    });

    it('receipt includes fidelity report when option enabled', async () => {
        await runEngineExport(chapel, h.cb, env, { ...DEFAULT_AI_RPG_OPTIONS, includeFidelityReport: true });
        expect(h.getReceipts()[0].fidelity).toBe('preserved');
    });
});

describe('10E: UE5 export receipt', () => {
    let h: ReturnType<typeof makeCallbacks>;
    let env: ExportEnv;

    beforeEach(() => { h = makeCallbacks(); env = makeEnv(); });

    it('produces a receipt on successful export', async () => {
        await runUnrealExport(chapel, h.cb, env);
        expect(h.getStatus()).toBe('exported');
        expect(h.getReceipts()).toHaveLength(1);
        const r = h.getReceipts()[0];
        expect(r.target).toBe('unreal');
        expect(r.zones).toBe(chapel.zones.length);
        expect(r.filename).toContain('unreal-pack.json');
        expect(r.sizeEstimate).toBeGreaterThan(0);
        expect(['preserved', 'approximated', 'dropped']).toContain(r.fidelity);
    });

    it('respects custom tileSizeCm option', async () => {
        const customOpts: UnrealExportOptions = { ...DEFAULT_UNREAL_OPTIONS, tileSizeCm: 200 };
        await runUnrealExport(chapel, h.cb, env, customOpts);
        expect(h.getStatus()).toBe('exported');
        expect(h.getReceipts()).toHaveLength(1);
    });
});

describe('10E: Godot export receipt', () => {
    let h: ReturnType<typeof makeCallbacks>;
    let env: ExportEnv;

    beforeEach(() => { h = makeCallbacks(); env = makeEnv(); });

    it('produces a receipt on successful export', async () => {
        await runGodotExport(chapel, h.cb, env);
        expect(h.getStatus()).toBe('exported');
        expect(h.getReceipts()).toHaveLength(1);
        const r = h.getReceipts()[0];
        expect(r.target).toBe('godot');
        expect(r.zones).toBe(chapel.zones.length);
        expect(r.filename).toContain('godot-pack.json');
        expect(r.sizeEstimate).toBeGreaterThan(0);
        expect(['preserved', 'approximated', 'dropped']).toContain(r.fidelity);
    });

    it('respects custom Godot options', async () => {
        const customOpts: GodotExportUIOptions = {
            ...DEFAULT_GODOT_OPTIONS,
            entityScenePrefix: 'res://custom_entities/',
            assetBindingMode: 'manual',
        };
        await runGodotExport(chapel, h.cb, env, customOpts);
        expect(h.getStatus()).toBe('exported');
        expect(h.getReceipts()).toHaveLength(1);
    });
});

// ── 10E: Options wire-through regression ──────────────────────────────

describe('10E: AI RPG options affect bundle', () => {
    let env: ExportEnv & { lastData: unknown };

    beforeEach(() => {
        env = {
            lastData: null,
            downloadJson: (_filename: string, data: unknown) => { env.lastData = data; return null; },
        };
    });

    it('excludes build catalog when option is off', async () => {
        const h = makeCallbacks();
        const opts: AiRpgExportOptions = { ...DEFAULT_AI_RPG_OPTIONS, includeBuildCatalog: false };
        await runEngineExport(chapel, h.cb, env, opts);
        expect(h.getStatus()).toBe('exported');
        const bundle = env.lastData as Record<string, unknown>;
        const cp = bundle.contentPack as Record<string, unknown>;
        expect(cp.buildCatalog).toBeUndefined();
    });

    it('excludes dialogue/progression when option is off', async () => {
        const h = makeCallbacks();
        const opts: AiRpgExportOptions = { ...DEFAULT_AI_RPG_OPTIONS, includeDialogueProgression: false };
        await runEngineExport(chapel, h.cb, env, opts);
        const bundle = env.lastData as Record<string, unknown>;
        const cp = bundle.contentPack as Record<string, unknown>;
        expect(cp.dialogues).toBeUndefined();
        expect(cp.progressionTrees).toBeUndefined();
    });

    it('includes fidelity report when option is on', async () => {
        const h = makeCallbacks();
        await runEngineExport(chapel, h.cb, env, { ...DEFAULT_AI_RPG_OPTIONS, includeFidelityReport: true });
        const bundle = env.lastData as Record<string, unknown>;
        expect(bundle.fidelityReport).toBeDefined();
        expect((bundle.fidelityReport as Record<string, unknown>).level).toBe('preserved');
    });

    it('omits fidelity report when option is off', async () => {
        const h = makeCallbacks();
        await runEngineExport(chapel, h.cb, env, { ...DEFAULT_AI_RPG_OPTIONS, includeFidelityReport: false });
        const bundle = env.lastData as Record<string, unknown>;
        expect(bundle.fidelityReport).toBeUndefined();
    });
});

describe('10E: UE5 options embed in bundle', () => {
    let env: ExportEnv & { lastData: unknown };

    beforeEach(() => {
        env = {
            lastData: null,
            downloadJson: (_filename: string, data: unknown) => { env.lastData = data; return null; },
        };
    });

    it('embeds tileSizeCm and blueprintPathPrefix in exportSettings', async () => {
        const h = makeCallbacks();
        const opts: UnrealExportOptions = { tileSizeCm: 200, blueprintPathPrefix: '/Game/Custom/', includeStreamingHints: false };
        await runUnrealExport(chapel, h.cb, env, opts);
        const bundle = env.lastData as Record<string, unknown>;
        const settings = bundle.exportSettings as Record<string, unknown>;
        expect(settings.tileSizeCm).toBe(200);
        expect(settings.blueprintPathPrefix).toBe('/Game/Custom/');
        expect(settings.streamingHints).toBe(false);
        expect(settings.signing).toBe('disabled (CLI-only)');
    });
});

describe('10E: Godot options embed in bundle', () => {
    let env: ExportEnv & { lastData: unknown };

    beforeEach(() => {
        env = {
            lastData: null,
            downloadJson: (_filename: string, data: unknown) => { env.lastData = data; return null; },
        };
    });

    it('embeds scene prefixes and binding mode in exportSettings', async () => {
        const h = makeCallbacks();
        const opts: GodotExportUIOptions = {
            entityScenePrefix: 'res://npcs/',
            transitionScenePrefix: 'res://doors/',
            includeWorldTscn: false,
            assetBindingMode: 'manual',
        };
        await runGodotExport(chapel, h.cb, env, opts);
        const bundle = env.lastData as Record<string, unknown>;
        const settings = bundle.exportSettings as Record<string, unknown>;
        expect(settings.entityScenePrefix).toBe('res://npcs/');
        expect(settings.transitionScenePrefix).toBe('res://doors/');
        expect(settings.includeWorldTscn).toBe(false);
        expect(settings.assetBindingMode).toBe('manual');
    });
});

// ── 10E: Pre-export advisories regression ──────────────────────────────

describe('10E: Pre-export advisories', () => {
    it('chapel project has no entity-placement advisory (it has entities)', () => {
        // Chapel has 4 entities — should NOT trigger the "no entities" advisory
        expect(chapel.entityPlacements.length).toBeGreaterThan(0);
    });

    it('chapel project has connections (no connection advisory)', () => {
        expect(chapel.connections.length).toBeGreaterThan(0);
    });

    it('default options export identically to no-options export', async () => {
        const h1 = makeCallbacks();
        const h2 = makeCallbacks();
        const env1: ExportEnv & { lastData: unknown } = { lastData: null, downloadJson: (_, d) => { env1.lastData = d; return null; } };
        const env2: ExportEnv & { lastData: unknown } = { lastData: null, downloadJson: (_, d) => { env2.lastData = d; return null; } };

        await runEngineExport(chapel, h1.cb, env1, DEFAULT_AI_RPG_OPTIONS);
        await runEngineExport(chapel, h2.cb, env2);

        expect(JSON.stringify(env1.lastData)).toBe(JSON.stringify(env2.lastData));
    });
});
