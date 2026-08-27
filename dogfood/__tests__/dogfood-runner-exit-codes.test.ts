// dogfood-runner-exit-codes.test.ts — F-66a22d53 / F-6551ab6c.
//
// chapel-threshold.ts and multi-target-export-proof.ts already have real-
// subprocess exit-code tests. The remaining dogfood/*.ts runners with the
// same "print a verdict / write a receipt / fall off the end" shape did not.
// Each FORCE-env here is checked only by the script, never set in a normal run.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const SCHEMA_DIST = resolve(REPO_ROOT, 'packages/schema/dist/index.js');

beforeAll(async () => {
    try {
        await access(SCHEMA_DIST);
    } catch {
        throw new Error(
            `${SCHEMA_DIST} not found. Run "npm run build" first — ` +
            `dogfood runners transitively import @world-forge/schema's built output.`,
        );
    }
    await new Promise<void>((resolvePromise, reject) => {
        execFile('npx', ['--no-install', 'tsx', '--version'], { shell: true, timeout: 15_000 }, (error) => {
            if (error) {
                reject(new Error(
                    'tsx is not available via `npx --no-install tsx`. ' +
                    'This suite spawns the real dogfood scripts via `npx tsx`.',
                ));
            } else {
                resolvePromise();
            }
        });
    });
}, 20_000);

function runScript(
    scriptPath: string,
    extraEnv: Record<string, string> = {},
    extraArgs: string[] = [],
): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolvePromise) => {
        execFile(
            'npx',
            ['tsx', scriptPath, ...extraArgs],
            {
                cwd: REPO_ROOT,
                shell: true,
                timeout: 60_000,
                maxBuffer: 20 * 1024 * 1024,
                env: { ...process.env, ...extraEnv },
            },
            (error, stdout, stderr) => {
                const code = error
                    ? (typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
                        ? (error as unknown as { code: number }).code
                        : 1)
                    : 0;
                resolvePromise({ code, stdout: String(stdout), stderr: String(stderr) });
            },
        );
    });
}

describe('run-godot-smoke.ts exit gates (F-66a22d53 / F-6551ab6c)', () => {
    it('exits 1 when WORLD_FORGE_FORCE_GODOT_FAIL is set (no Godot required)', async () => {
        const { code, stdout } = await runScript(
            resolve(__dirname, '../run-godot-smoke.ts'),
            { WORLD_FORGE_FORCE_GODOT_FAIL: '1' },
        );
        expect(stdout).toContain('WORLD_FORGE_FORCE_GODOT_FAIL');
        expect(code).toBe(1);
    }, 60_000);

    it('exits 2 when GODOT_BIN is set but the path does not exist', async () => {
        const missing = resolve(REPO_ROOT, 'definitely-not-a-godot-binary.exe');
        const { code, stderr } = await runScript(
            resolve(__dirname, '../run-godot-smoke.ts'),
            { GODOT_BIN: missing },
        );
        expect(stderr).toContain('GODOT_BIN is set');
        expect(stderr).toContain('does not exist');
        expect(code).toBe(2);
    }, 60_000);

    it('exits 2 when GODOT_BIN exists but --version is not Godot 4 (F-bd5349d4)', async () => {
        const { code, stdout, stderr } = await runScript(
            resolve(__dirname, '../run-godot-smoke.ts'),
            { GODOT_BIN: process.execPath },
        );
        expect(stdout).toContain('Resolved via: GODOT_BIN');
        expect(stderr).toMatch(/Godot 4 required/);
        expect(stderr).toMatch(/Set GODOT_BIN/);
        expect(code).toBe(2);
    }, 60_000);
});

describe('run-ai-rpg-smoke.ts exit gate (F-66a22d53)', () => {
    beforeAll(async () => {
        try {
            await import('@ai-rpg-engine/content-schema');
        } catch {
            throw new Error(
                '@ai-rpg-engine/content-schema is not resolvable. ' +
                'run-ai-rpg-smoke.ts is the claimed runtime proof and needs the engine packages installed.',
            );
        }
    });

    it('exits non-zero when WORLD_FORGE_FORCE_AI_RPG_FAIL is set', async () => {
        const { code, stdout } = await runScript(
            resolve(__dirname, '../run-ai-rpg-smoke.ts'),
            { WORLD_FORGE_FORCE_AI_RPG_FAIL: '1' },
        );
        expect(stdout).toMatch(/✗ test_injected_failure/);
        expect(code).not.toBe(0);
    }, 60_000);
});

describe('export-stage-fixture.ts exit gate (F-66a22d53)', () => {
    it('exits 2 when --out is missing', async () => {
        const { code, stderr } = await runScript(
            resolve(__dirname, '../export-stage-fixture.ts'),
        );
        expect(stderr).toContain('--out=<dir> is required');
        expect(code).toBe(2);
    }, 60_000);

    it('exits non-zero when WORLD_FORGE_FORCE_FIXTURE_FAIL is set', async () => {
        const out = mkdtempSync(join(tmpdir(), 'wf-fixture-'));
        const { code, stderr } = await runScript(
            resolve(__dirname, '../export-stage-fixture.ts'),
            { WORLD_FORGE_FORCE_FIXTURE_FAIL: '1' },
            [`--world=proof`, `--out=${out}`],
        );
        expect(stderr).toContain('WORLD_FORGE_FORCE_FIXTURE_FAIL');
        expect(code).not.toBe(0);
    }, 60_000);
});

describe('export-stage-fixture.ts operator CLI (F-e430ef33 / F-aa8332da)', () => {
    const SCRIPT = resolve(__dirname, '../export-stage-fixture.ts');

    it('--help prints the real contract (salt-road, --engine-out) and does not demand --out', async () => {
        const { code, stdout, stderr } = await runScript(SCRIPT, {}, ['--help']);
        const text = `${stdout}${stderr}`;
        expect(text).toMatch(/salt-road/);
        expect(text).toMatch(/--engine-out/);
        expect(text).toMatch(/coverage\|proof\|salt-road/);
        expect(text).not.toContain('--out=<dir> is required');
        expect(code).toBe(0);
    }, 60_000);

    it('unknown flags print the contract and exit 2', async () => {
        const { code, stdout, stderr } = await runScript(SCRIPT, {}, ['--not-a-flag']);
        expect(stderr).toMatch(/unknown flag/);
        expect(stderr).toMatch(/--engine-out/);
        expect(stderr).toMatch(/salt-road/);
        expect(stdout).not.toContain('done.');
        expect(code).toBe(2);
    }, 60_000);

    it('bare --engine-out without a file is a usage error (exit 2, no done.)', async () => {
        const out = mkdtempSync(join(tmpdir(), 'wf-fixture-'));
        const { code, stdout, stderr } = await runScript(
            SCRIPT,
            {},
            ['--world=proof', `--out=${out}`, '--engine-out'],
        );
        expect(stderr).toMatch(/--engine-out requires a file path/);
        expect(stdout).not.toContain('done.');
        expect(code).toBe(2);
    }, 60_000);

    it('accepts --engine-out <file> space form (does not treat it as a usage error)', async () => {
        const out = mkdtempSync(join(tmpdir(), 'wf-fixture-'));
        const { code, stderr, stdout } = await runScript(
            SCRIPT,
            { WORLD_FORGE_FORCE_FIXTURE_FAIL: '1' },
            ['--world=proof', `--out=${out}`, '--engine-out', join(out, 'engine-pack.json')],
        );
        expect(stderr).toContain('WORLD_FORGE_FORCE_FIXTURE_FAIL');
        expect(stderr).not.toMatch(/--engine-out requires a file path/);
        expect(stderr).not.toMatch(/unknown flag/);
        expect(stdout).not.toContain('done.');
        expect(code).toBe(1);
    }, 60_000);
});
