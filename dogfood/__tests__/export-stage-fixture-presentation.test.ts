// export-stage-fixture-presentation.test.ts — stage pack.json carries the
// authored presentation block additively, and --strict refuses to write when
// a presentation advisory is in the export warnings.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const SCHEMA_DIST = resolve(REPO_ROOT, 'packages/schema/dist/index.js');
const SCRIPT = resolve(__dirname, '../export-stage-fixture.ts');

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

function tmpOut(prefix: string): string {
    return mkdtempSync(join(tmpdir(), prefix));
}

describe('export-stage-fixture.ts presentation carry', () => {
    it('--world=salt-road writes occupancy.length === 6', async () => {
        const out = tmpOut('wf-stage-pres-salt-');
        const { code, stderr } = await runScript(SCRIPT, {}, [`--world=salt-road`, `--out=${out}`]);
        expect(stderr, stderr).toBe('');
        expect(code).toBe(0);
        const pack = JSON.parse(readFileSync(join(out, 'pack.json'), 'utf-8')) as {
            presentation?: { occupancy?: unknown[] };
        };
        expect(pack.presentation?.occupancy).toHaveLength(6);
    }, 60_000);

    it('--world=proof emits no presentation key', async () => {
        const out = tmpOut('wf-stage-pres-proof-');
        const { code, stderr } = await runScript(SCRIPT, {}, [`--world=proof`, `--out=${out}`]);
        expect(stderr, stderr).toBe('');
        expect(code).toBe(0);
        const pack = JSON.parse(readFileSync(join(out, 'pack.json'), 'utf-8')) as Record<string, unknown>;
        expect(Object.prototype.hasOwnProperty.call(pack, 'presentation')).toBe(false);
    }, 60_000);

    it('--strict with WORLD_FORGE_FORCE_PRESENTATION_ADVISORY exits 1 and writes no pack.json', async () => {
        const out = tmpOut('wf-stage-pres-strict-');
        const { code, stderr } = await runScript(
            SCRIPT,
            { WORLD_FORGE_FORCE_PRESENTATION_ADVISORY: '1' },
            ['--world=salt-road', `--out=${out}`, '--strict'],
        );
        expect(stderr).toContain('✗ strict:');
        expect(code).toBe(1);
        expect(existsSync(join(out, 'pack.json'))).toBe(false);
    }, 60_000);
});
