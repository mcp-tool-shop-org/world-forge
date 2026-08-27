// chapel-threshold-unreal-25d-gate.test.ts — F-4641d61e / F-66a22d53.
//
// chapel-threshold-unreal.ts authored elevation/skyline/parallax then only
// console.log'd OriginCm/ElevationCm. A converter that zeroed elevation or
// dropped parallax still exited 0. WORLD_FORGE_FORCE_UNREAL_25D_FAIL mutates
// the pack so this suite can fire the gate without a live converter bug.

import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../..');
const SCRIPT_PATH = resolve(__dirname, '../chapel-threshold-unreal.ts');
const SCHEMA_DIST = resolve(REPO_ROOT, 'packages/schema/dist/index.js');

beforeAll(async () => {
    try {
        await access(SCHEMA_DIST);
    } catch {
        throw new Error(
            `${SCHEMA_DIST} not found. Run "npm run build" first — ` +
            `chapel-threshold-unreal.ts imports @world-forge/export-unreal which ` +
            `transitively needs @world-forge/schema's built output.`,
        );
    }
    await new Promise<void>((resolvePromise, reject) => {
        execFile('npx', ['--no-install', 'tsx', '--version'], { shell: true, timeout: 15_000 }, (error) => {
            if (error) {
                reject(new Error(
                    'tsx is not available via `npx --no-install tsx`. ' +
                    'This suite spawns `npx tsx dogfood/chapel-threshold-unreal.ts`.',
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

describe('chapel-threshold-unreal.ts 2.5D gate (F-4641d61e)', () => {
    it('exits 0 when elevation/skyline/parallax survive', async () => {
        const { code, stdout } = await runScript();
        expect(stdout).toContain('✓ cellar_elevation_cm');
        expect(stdout).toContain('✓ zone_0_skyline_survives');
        expect(stdout).toContain('✓ zone_0_parallax_survives');
        expect(code).toBe(0);
    }, 60_000);

    it('exits non-zero when 2.5D fields are forced dropped', async () => {
        const { code, stdout } = await runScript({ WORLD_FORGE_FORCE_UNREAL_25D_FAIL: '1' });
        expect(stdout).toMatch(/✗ cellar_elevation_cm/);
        expect(stdout).toMatch(/✗ zone_0_skyline_survives/);
        expect(stdout).toMatch(/✗ zone_0_parallax_survives/);
        expect(code).not.toBe(0);
    }, 60_000);
});
