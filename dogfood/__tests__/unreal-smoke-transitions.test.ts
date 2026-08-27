// unreal-smoke-transitions.test.ts — regression coverage for F-933d65b9.
//
// run-unreal-smoke.ts used to `assert(true, 'transition_zone_refs_valid')`
// when pack.Transitions.length === 0, so a convert-transitions regression
// that emitted [] still recorded a pass for the ID-preservation step and
// could exit 0 with VERDICT PASS. The script now requires
// pack.Transitions.length === (proofProject.transitions ?? []).length
// (must be > 0 for this fixture) before validating refs.
//
// WORLD_FORGE_FORCE_UNREAL_EMPTY_TRANSITIONS=1 — checked only by the
// script, never set in a normal run — empties the pack array so this suite
// can exercise the gate without depending on a live converter bug.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { SCHEMA_VERSION } from '../../packages/schema/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = resolve(__dirname, '../run-unreal-smoke.ts');
const SCHEMA_DIST = resolve(REPO_ROOT, 'packages/schema/dist/index.js');

beforeAll(async () => {
    try {
        await access(SCHEMA_DIST);
    } catch {
        throw new Error(
            `${SCHEMA_DIST} not found. Run "npm run build" first — ` +
            `run-unreal-smoke.ts imports @world-forge/export-unreal which ` +
            `transitively needs @world-forge/schema's built output.`,
        );
    }
    await new Promise<void>((resolvePromise, reject) => {
        execFile('npx', ['--no-install', 'tsx', '--version'], { shell: true, timeout: 15_000 }, (error) => {
            if (error) {
                reject(new Error(
                    'tsx is not available via `npx --no-install tsx`. ' +
                    'This suite spawns `npx tsx dogfood/run-unreal-smoke.ts`.',
                ));
            } else {
                resolvePromise();
            }
        });
    });
}, 20_000);

function runScript(extraEnv: Record<string, string> = {}): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolvePromise) => {
        execFile(
            'npx',
            ['tsx', SCRIPT_PATH],
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

describe('run-unreal-smoke.ts transition ref gate (F-933d65b9)', () => {
    it('exits 0 on a clean run (fixture has transitions)', async () => {
        const { code, stdout } = await runScript();
        expect(stdout).toContain('transition_count_matches_source');
        expect(stdout).toContain('transition_zone_refs_valid');
        expect(stdout).not.toMatch(/✗ transition_count_matches_source/);
        expect(code).toBe(0);
    }, 60_000);

    it('exits non-zero when Transitions is forced empty', async () => {
        const { code, stdout } = await runScript({ WORLD_FORGE_FORCE_UNREAL_EMPTY_TRANSITIONS: '1' });
        expect(stdout).toMatch(/✗ transition_count_matches_source/);
        expect(stdout).toMatch(/✗ transition_zone_refs_valid/);
        expect(stdout).toContain('Transitions is empty');
        expect(code).not.toBe(0);
    }, 60_000);
});

describe('run-unreal-smoke.ts required-fixture receipt (F-fb07f3a1)', () => {
    it('exits non-zero and still writes a receipt when cellar is dropped', async () => {
        const { code, stdout } = await runScript({ WORLD_FORGE_FORCE_UNREAL_DROP_CELLAR: '1' });
        expect(stdout).toMatch(/✗ cellar_zone_found/);
        expect(stdout).toContain('Receipt:');
        expect(code).not.toBe(0);

        const receiptMatch = stdout.match(/Receipt:\s*(.+\.md)/);
        expect(receiptMatch).not.toBeNull();
        const receipt = readFileSync(receiptMatch![1].trim(), 'utf8');

        // F-eab38be2: Schema line is SCHEMA_VERSION, not WorldProject.version '1.0.0'.
        expect(receipt).toContain(`**Schema:** ${SCHEMA_VERSION}`);
        expect(receipt).toMatch(/\*\*Schema:\*\*\s*4\./);
        expect(receipt).not.toContain('**Schema:** 1.0.0');

        // F-c621e532: missing cellar is not painted as a success-shaped coord row.
        expect(receipt).not.toContain('| cellar | 0,4 | -3m | 0 | -400 | -300 |');
        expect(receipt).toContain('| cellar | 0,4 | -3m | n/a | n/a | n/a |');
    }, 60_000);
});
