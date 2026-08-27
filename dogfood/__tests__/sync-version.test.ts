// sync-version.test.ts — regression coverage for F-adf9c645.
//
// Default (write) mode used to stamp README.md during `npm prebuild`, which
// CI runs before `npm run check-version`. --check then read the already
// rewritten file and could not see committed README version drift. In CI
// the default write is now a no-op; --check stays a read-only comparison
// against the committed README.

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT = resolve(REPO_ROOT, 'scripts/sync-version.mjs');

describe('sync-version.mjs CI write guard (F-adf9c645)', () => {
    it('default mode refuses to write when CI is set', () => {
        const stdout = execFileSync(process.execPath, [SCRIPT], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            env: { ...process.env, CI: 'true', GITHUB_ACTIONS: 'true' },
        });
        expect(stdout).toMatch(/refusing to write README/);
        expect(stdout).not.toMatch(/stamped/);
    });

    it('default mode refuses to write when GITHUB_ACTIONS is set without CI=true', () => {
        const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_ACTIONS: 'true' };
        delete env.CI;
        const stdout = execFileSync(process.execPath, [SCRIPT], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            env,
        });
        expect(stdout).toMatch(/refusing to write README/);
        expect(stdout).not.toMatch(/stamped/);
    });
});

describe('sync-version.mjs help / unknown flags (F-2c5673a7)', () => {
    function localEnv(): NodeJS.ProcessEnv {
        const env = { ...process.env };
        delete env.CI;
        delete env.GITHUB_ACTIONS;
        return env;
    }

    it('--help prints the three modes and does not stamp', () => {
        const stdout = execFileSync(process.execPath, [SCRIPT, '--help'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            env: localEnv(),
        });
        expect(stdout).toMatch(/node scripts\/sync-version\.mjs --check/);
        expect(stdout).toMatch(/node scripts\/sync-version\.mjs --sync-tests/);
        expect(stdout).not.toMatch(/stamped/);
        expect(stdout).not.toMatch(/already matches/);
        expect(stdout).not.toMatch(/refusing to write/);
    });

    it('-h is the same as --help', () => {
        const stdout = execFileSync(process.execPath, [SCRIPT, '-h'], {
            cwd: REPO_ROOT,
            encoding: 'utf-8',
            env: localEnv(),
        });
        expect(stdout).toMatch(/--check/);
        expect(stdout).toMatch(/--sync-tests/);
        expect(stdout).not.toMatch(/stamped/);
    });

    it('unknown flag prints the three modes and exits 2 without writing', () => {
        try {
            execFileSync(process.execPath, [SCRIPT, '--not-a-real-flag'], {
                cwd: REPO_ROOT,
                encoding: 'utf-8',
                env: localEnv(),
            });
            throw new Error('expected exit 2');
        } catch (err) {
            const e = err as { status?: number; stdout?: string; stderr?: string; message?: string };
            if (e.message === 'expected exit 2') throw err;
            expect(e.status).toBe(2);
            const text = `${e.stdout ?? ''}${e.stderr ?? ''}`;
            expect(text).toMatch(/unknown flag/);
            expect(text).toMatch(/--check/);
            expect(text).toMatch(/--sync-tests/);
            expect(text).not.toMatch(/stamped/);
            expect(text).not.toMatch(/already matches/);
        }
    });
});
