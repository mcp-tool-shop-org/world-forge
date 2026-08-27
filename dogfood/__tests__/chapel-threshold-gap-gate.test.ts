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

/**
 * Lines on stderr that belong to the toolchain, not to the script under test.
 *
 * `npx` under npm >= 11.5 announces itself ("npm notice run <pkg> npx ..."), and
 * npm emits update/funding notices on the same channel. None of these are output
 * from chapel-threshold.ts, so none of them should be able to fail a test about
 * chapel-threshold.ts.
 *
 * Deliberately a NARROW allow-list of known-benign prefixes rather than a broad
 * "ignore anything that looks like noise" filter: the point of the assertion is
 * that the script itself stays silent on a clean run, and a filter loose enough to
 * swallow a real diagnostic would turn this into a check that cannot fail.
 */
const BENIGN_STDERR = [
    /^npm notice\b/,
    /^npm warn\b/,
    /^npm WARN\b/,
    // convert-items now reports hidden/container losses on stderr (F-06fd0fb3).
    // Those are intended export warnings, not chapel-threshold script failures.
    /^\[convert-items\]/,
];

export function stderrDiagnostics(stderr: string): string[] {
    return stderr
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0)
        .filter((l) => !BENIGN_STDERR.some((p) => p.test(l)));
}

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

describe('stderrDiagnostics — the noise filter must not become a gate that cannot fail', () => {
    it('drops the npm notice that broke the v4.6.0 release', () => {
        expect(stderrDiagnostics('npm notice run world-forge@4.6.0 npx tsx dogfood/x.ts')).toEqual([]);
    });

    it('drops npm warn/WARN lines', () => {
        expect(stderrDiagnostics('npm warn deprecated foo@1.0.0\nnpm WARN old lockfile')).toEqual([]);
    });

    it('KEEPS a real diagnostic — this is the assertion that matters', () => {
        expect(stderrDiagnostics('Error: something actually broke')).toEqual(['Error: something actually broke']);
    });

    it('KEEPS a real diagnostic even when npm noise surrounds it', () => {
        const mixed = 'npm notice run world-forge@4.6.0 npx\nTypeError: cannot read x of undefined\nnpm warn whatever';
        expect(stderrDiagnostics(mixed)).toEqual(['TypeError: cannot read x of undefined']);
    });

    it('does not treat a line merely CONTAINING "npm notice" as benign', () => {
        // Anchored at start, so a script printing "... unexpected npm notice ..." still fails.
        expect(stderrDiagnostics('assertion failed: saw npm notice where none expected')).toHaveLength(1);
    });
});

describe('chapel-threshold.ts gap regression gate (F-239f17d3)', () => {
    it('exits 0 with zero gaps on a clean run', async () => {
        const { code, stdout, stderr } = await runScript();
        // Assert the script wrote no DIAGNOSTICS — not that stderr is byte-empty.
        //
        // `expect(stderr).toBe('')` was too strict and failed the v4.6.0 release for
        // a reason that had nothing to do with this repo: release.yml installs
        // npm >= 11.5 in a sandbox for OIDC trusted-publishing auth, and newer npm
        // writes a benign `npm notice run <pkg> npx ...` line to stderr that the
        // bundled npm in ci.yml does not. Same code, same tree — green in CI, red in
        // release, on a line the script never wrote.
        //
        // A test that pins "no output at all" when it means "no error" is coupled to
        // the toolchain's chattiness rather than to the behaviour under test.
        expect(stderrDiagnostics(stderr)).toEqual([]);
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
