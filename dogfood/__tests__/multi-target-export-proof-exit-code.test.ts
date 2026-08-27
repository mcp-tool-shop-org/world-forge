// multi-target-export-proof-exit-code.test.ts — regression coverage for the
// exit-code + receipt-honesty gate on dogfood/multi-target-export-proof.ts
// (F-6245cd73, plus the receipt "Product Assessment" fix in the same file).
//
// Before this fix, the script's only process.exit() calls were the four
// early-failure guards (validation / lane export failures) — ALL of which
// run before the cross-lane invariant section (line 304+). Once execution
// reached the verdict, the script fell off the end with Node's default exit
// code 0 no matter how many of the 20+ cross-lane invariants failed, so a
// CI wrapper gating on this script's exit status could never see a failure
// here — unlike its siblings run-godot-smoke.ts, run-unreal-smoke.ts, and
// run-ai-rpg-smoke.ts, which all set their exit code from their verdict.
//
// The receipt's "Product Assessment" section had the same shape of bug one
// level up: it was hardcoded prose (literal checkmarks + "successfully" +
// "This proves") printed unconditionally, so a failing run's receipt would
// still read as an unqualified success two headings below a verdict line
// reading BLOCKED/NEEDS FOLLOW-UP.
//
// This suite runs the REAL script as a subprocess (matching the pattern in
// packages/export-ai-rpg/src/__tests__/cli.test.ts) rather than re-deriving
// its logic in-test, because the exact defect was in top-level, non-exported
// script control flow — a pure-function unit test would not have caught it
// (there is nothing to import: the whole file is the side effect). A
// `WORLD_FORGE_FORCE_DOGFOOD_FAIL=1` env var — checked only by the script,
// never set in a normal run — deterministically forces one cross-lane
// assertion to fail, so the "gate fires" behavior is exercised without
// depending on a real cross-lane regression existing in the export
// pipeline right now.
//
// Requires `packages/schema` to be built (`npm run build`) and `tsx`
// resolvable via `npx --no-install` (this repo's own documented way to run
// every dogfood/*.ts script — see each file's own header comment). Both are
// checked in beforeAll with an actionable thrown error, matching
// cli.test.ts's own beforeAll convention for a missing prerequisite, rather
// than silently skipping.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = resolve(__dirname, '../multi-target-export-proof.ts');
const SCHEMA_DIST = resolve(REPO_ROOT, 'packages/schema/dist/index.js');
// The receipt filename carries the run's own date. It used to be hardcoded to
// 2026-04-30 while the heading interpolated `new Date()`, so every run overwrote
// one file whose name disagreed with its contents. Derive the name the same way
// the script does, rather than pinning a literal that will silently stop
// matching — a test that reads the wrong path fails loudly, but a test that
// reads a STALE path left behind by an earlier run would pass while checking
// nothing, which is the defect class this whole file exists to prevent.
const RECEIPT_PATH = resolve(
    __dirname,
    `../output/DOGFOOD_MULTI_TARGET_EXPORT_${new Date().toISOString().slice(0, 10)}.md`,
);

beforeAll(async () => {
    try {
        await access(SCHEMA_DIST);
    } catch {
        throw new Error(
            `${SCHEMA_DIST} not found. Run "npm run build" first — ` +
            `multi-target-export-proof.ts transitively imports @world-forge/schema's built output ` +
            `via packages/export-ai-rpg (and export-godot / export-unreal).`,
        );
    }
    await new Promise<void>((resolvePromise, reject) => {
        execFile('npx', ['--no-install', 'tsx', '--version'], { shell: true, timeout: 15_000 }, (error) => {
            if (error) {
                reject(new Error(
                    'tsx is not available via `npx --no-install tsx` (no cached/local install found). ' +
                    'This suite spawns the real dogfood script exactly as documented in its own header ' +
                    'comment (`npx tsx dogfood/multi-target-export-proof.ts`). Run `npx tsx --version` ' +
                    'once with network access, or `npm install -D tsx`, then re-run.',
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
                const code = error ? (typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number' ? (error as unknown as { code: number }).code : 1) : 0;
                resolvePromise({ code, stdout: String(stdout), stderr: String(stderr) });
            },
        );
    });
}

describe('multi-target-export-proof.ts exit code gate (F-6245cd73)', () => {
    it('exits 0 on a clean run', async () => {
        // Not asserting on stderr: the export pipeline legitimately warns there
        // (e.g. item slot narrowing) independent of this fix — the exit code
        // is the thing F-6245cd73 is about.
        const { code, stdout } = await runScript();
        expect(stdout).toContain('Done.');
        expect(code).toBe(0);
    }, 60_000);

    it('exits non-zero when a cross-lane invariant is forced to fail', async () => {
        const { code, stdout } = await runScript({ WORLD_FORGE_FORCE_DOGFOOD_FAIL: '1' });
        expect(stdout).toContain('Test-injected failure');
        // F-683e8222: a BLOCKED run must not close on the success-shaped `Done.`
        expect(stdout).not.toContain('Done.');
        expect(code).not.toBe(0);
    }, 60_000);

    it('receipt Product Assessment reports failure honestly (agrees with verdict) when the gate fires', async () => {
        const { code } = await runScript({ WORLD_FORGE_FORCE_DOGFOOD_FAIL: '1' });
        expect(code).not.toBe(0);

        const receipt = await readFile(RECEIPT_PATH, 'utf-8');
        // Verdict line must NOT read as an unqualified pass on a failing run.
        expect(receipt).toMatch(/\*\*(BLOCKED|NEEDS FOLLOW-UP)/);
        // Product Assessment must not contain the old unconditional success prose,
        // and must instead honestly report the failure.
        expect(receipt).not.toContain('World Forge exported one canonical authored world to three engine targets, and all');
        expect(receipt).toContain('did NOT cleanly export');
    }, 60_000);

    it('receipt Product Assessment reports success (agrees with verdict) when the gate does not fire', async () => {
        const { code } = await runScript();
        expect(code).toBe(0);

        const receipt = await readFile(RECEIPT_PATH, 'utf-8');
        expect(receipt).toMatch(/\*\*PASSES/);
        expect(receipt).toContain('cross-lane invariant assertions passed');
    }, 60_000);
});

const PROOF_FORCE_FLAGS = [
    'breakFixCaught',
    'breakFixRepaired',
    'hasGdScene',
    'allResValid',
    'zoneIdsPreserved',
    'entityIdsPreserved',
    'unrealZoneIdsPreserved',
] as const;

const PROOF_FLAG_RECEIPT: Record<(typeof PROOF_FORCE_FLAGS)[number], string> = {
    breakFixCaught: 'ghost-invalid=false',
    breakFixRepaired: 'repair-valid=false',
    hasGdScene: '[gd_scene] header=false',
    allResValid: 'res:// prefixed=false',
    zoneIdsPreserved: '**Zone IDs preserved:** false',
    entityIdsPreserved: '**Entity IDs preserved:** false',
    unrealZoneIdsPreserved: '**Zone IDs preserved:** false',
};

describe('multi-target-export-proof.ts structural gates (F-987419c9)', () => {
    it.each(PROOF_FORCE_FLAGS)(
        'exits non-zero and receipt is honest when %s is forced false',
        async (flag) => {
            const { code } = await runScript({ WORLD_FORGE_FORCE_PROOF_FLAG: flag });
            expect(code).not.toBe(0);

            const receipt = await readFile(RECEIPT_PATH, 'utf-8');
            expect(receipt).toMatch(/\*\*(BLOCKED|NEEDS FOLLOW-UP)/);
            expect(receipt).toContain(PROOF_FLAG_RECEIPT[flag]);
            expect(receipt).not.toContain('Ghost entity in nonexistent zone caught → removed → revalidated clean');
            expect(receipt).not.toMatch(/valid `\[gd_scene\]` header/);
            expect(receipt).not.toContain('all valid `res://` prefixed');
        },
        60_000,
    );
});
