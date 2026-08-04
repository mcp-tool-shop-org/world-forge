// chapel-threshold-gap-gate.test.ts — regression coverage for the gap
// regression gate on dogfood/chapel-threshold.ts (F-239f17d3).
//
// dogfood/WALKTHROUGH.md frames the Chapel Threshold's exported gap count as
// a regression narrative meant to trend toward and stay at zero ("The
// Chapel Threshold now exports with zero gaps"). Before this fix, the
// script only ever console.log'd the gap list (`Found N gaps:` / `No gaps
// found`) — it never turned a reintroduced gap into a failing exit code. A
// regression that broke, say, the build-catalog export would print "Found 1
// gaps:" to the console and still exit 0.
//
// This suite runs the REAL script as a subprocess (matching the pattern in
// packages/export-ai-rpg/src/__tests__/cli.test.ts) rather than re-deriving
// its logic in-test, because the defect was in top-level, non-exported
// script control flow. A `WORLD_FORGE_FORCE_DOGFOOD_GAP=1` env var — checked
// only by the script, never set in a normal run — deterministically forces a
// gap, so the "gate fires" behavior is exercised without depending on a real
// gap existing in the engine contract right now (the Chapel Threshold is
// meant to hold at zero gaps per WALKTHROUGH.md).
//
// Requires `packages/schema` to be built (`npm run build`) and `tsx`
// resolvable via `npx --no-install` (this repo's own documented way to run
// every dogfood/*.ts script — see each file's own header comment). Both are
// checked in beforeAll with an actionable thrown error, matching
// cli.test.ts's own beforeAll convention for a missing prerequisite, rather
// than silently skipping.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = resolve(__dirname, '../chapel-threshold.ts');
const SCHEMA_DIST = resolve(REPO_ROOT, 'packages/schema/dist/index.js');

beforeAll(async () => {
    try {
        await access(SCHEMA_DIST);
    } catch {
        throw new Error(
            `${SCHEMA_DIST} not found. Run "npm run build" first — ` +
            `chapel-threshold.ts transitively imports @world-forge/schema's built output ` +
            `via packages/export-ai-rpg.`,
        );
    }
    await new Promise<void>((resolvePromise, reject) => {
        execFile('npx', ['--no-install', 'tsx', '--version'], { shell: true, timeout: 15_000 }, (error) => {
            if (error) {
                reject(new Error(
                    'tsx is not available via `npx --no-install tsx` (no cached/local install found). ' +
                    'This suite spawns the real dogfood script exactly as documented in its own header ' +
                    'comment (`npx tsx dogfood/chapel-threshold.ts`). Run `npx tsx --version` once with ' +
                    'network access, or `npm install -D tsx`, then re-run.',
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
                const code = error ? (typeof (error as unknown as { code?: unknown }).code === 'number' ? (error as unknown as { code: number }).code : 1) : 0;
                resolvePromise({ code, stdout: String(stdout), stderr: String(stderr) });
            },
        );
    });
}

describe('chapel-threshold.ts gap regression gate (F-239f17d3)', () => {
    it('exits 0 with zero gaps on a clean run', async () => {
        const { code, stdout, stderr } = await runScript();
        expect(stderr).toBe('');
        expect(stdout).toContain('No gaps found');
        expect(code).toBe(0);
    }, 60_000);

    it('exits non-zero when a gap is forced (regression would have exited 0 before F-239f17d3)', async () => {
        const { code, stdout } = await runScript({ WORLD_FORGE_FORCE_DOGFOOD_GAP: '1' });
        expect(stdout).toContain('Found 1 gaps');
        expect(stdout).toContain('Test-injected gap');
        expect(code).not.toBe(0);
    }, 60_000);
});
