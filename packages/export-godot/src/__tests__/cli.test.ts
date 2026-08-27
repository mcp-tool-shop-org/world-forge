/**
 * cli.test.ts — world-forge-export-godot operator CLI (F-1a660063).
 *
 * Imports runGodotCli from the TypeScript source so the suite does not depend
 * on a pre-built dist/cli.js (verify still compiles the bin for npx).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, rm, mkdtemp, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGodotCli, USAGE } from '../cli.js';
import { GODOT_PACK_FORMAT_VERSION } from '../export.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { invalidOrphanProject } from '../../../schema/src/__tests__/fixtures/invalid-orphan.js';

function capture() {
    const stdout: string[] = [];
    const stderr: string[] = [];
    return {
        stdout,
        stderr,
        io: {
            log: (line: string) => stdout.push(line),
            error: (line: string) => stderr.push(line),
            stderrWrite: (line: string) => stderr.push(line),
        },
    };
}

let tmpDir: string;
let validJsonPath: string;
let invalidJsonPath: string;
let badJsonPath: string;

beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-godot-cli-'));
    validJsonPath = join(tmpDir, 'valid.json');
    invalidJsonPath = join(tmpDir, 'invalid.json');
    badJsonPath = join(tmpDir, 'bad.json');
    await writeFile(validJsonPath, JSON.stringify(minimalProject, null, 2));
    await writeFile(invalidJsonPath, JSON.stringify(invalidOrphanProject, null, 2));
    await writeFile(badJsonPath, 'not json at all {{{');
});

afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe('CLI: world-forge-export-godot', () => {
    it('shows help with --help and exits 0 (format version 1.1.0, files/zoneGates)', async () => {
        const cap = capture();
        const code = await runGodotCli(['--help'], cap.io);
        expect(code).toBe(0);
        const out = cap.stdout.join('\n');
        expect(out).toContain('Usage: world-forge-export-godot');
        expect(out).toContain('--validate-only');
        expect(out).toContain('--out');
        expect(out).toContain('--include-world-tscn');
        expect(out).toContain('--no-world-tscn');
        expect(out).toContain(GODOT_PACK_FORMAT_VERSION);
        expect(out).toContain('1.1.0');
        expect(out).toContain('files');
        expect(out).toContain('zoneGates');
        expect(USAGE).toContain('files');
        expect(USAGE).toContain('zoneGates');
    });

    it('shows help with no args and exits 0', async () => {
        const cap = capture();
        const code = await runGodotCli([], cap.io);
        expect(code).toBe(0);
        expect(cap.stdout.join('\n')).toContain('Usage: world-forge-export-godot');
    });

    it('rejects swallowed --out (following token starts with -) with exit 1', async () => {
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--out', '--validate-only'], cap.io);
        expect(code).toBe(1);
        const err = cap.stderr.join('\n');
        expect(err).toContain('--out requires a path');
        expect(err).toMatch(/swallowed flag/);
        let existed = true;
        try {
            await access(join(tmpDir, '--validate-only'));
        } catch {
            existed = false;
        }
        expect(existed).toBe(false);
    });

    it('rejects --out with no value with exit 1', async () => {
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--out'], cap.io);
        expect(code).toBe(1);
        expect(cap.stderr.join('\n')).toContain('--out requires a path');
    });

    it('validation-failure exits 1 with path + message + a fix hint', async () => {
        const cap = capture();
        const code = await runGodotCli([invalidJsonPath], cap.io);
        expect(code).toBe(1);
        const err = cap.stderr.join('\n');
        expect(err).toMatch(/Godot export failed|Validation failed/);
        expect(err).toMatch(/\[.+\] .+/);
        expect(err.toLowerCase()).toContain('hint');
    });

    it('--validate-only on a valid project exits 0 and does not write files', async () => {
        const outDir = join(tmpDir, 'validate-only-out');
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--validate-only', '--out', outDir], cap.io);
        expect(code).toBe(0);
        expect(cap.stdout.join('\n')).toContain('Validation passed');
        let exists = true;
        try {
            await access(outDir);
        } catch {
            exists = false;
        }
        expect(exists).toBe(false);
    });
});
