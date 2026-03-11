import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { writeFile, readFile, rm, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { invalidOrphanProject } from '../../../schema/src/__tests__/fixtures/invalid-orphan.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cli.js');

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('node', [CLI_PATH, ...args], { timeout: 10_000 }, (error, stdout, stderr) => {
      resolve({ code: error?.code !== undefined ? (error.code as unknown as number) : error ? 1 : 0, stdout, stderr });
    });
  });
}

let tmpDir: string;
let validJsonPath: string;
let invalidJsonPath: string;
let badJsonPath: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'wf-cli-'));
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

describe('CLI: world-forge-export', () => {
  it('shows help with --help', async () => {
    const { stdout } = await runCli(['--help']);
    expect(stdout).toContain('Usage: world-forge-export');
    expect(stdout).toContain('--validate-only');
  });

  it('shows help with no args', async () => {
    const { stdout } = await runCli([]);
    expect(stdout).toContain('Usage: world-forge-export');
  });

  it('validates a valid project with --validate-only', async () => {
    const { code, stdout } = await runCli([validJsonPath, '--validate-only']);
    expect(code).toBe(0);
    expect(stdout).toContain('Validation passed');
  });

  it('rejects an invalid project with exit code 1', async () => {
    const { code, stderr } = await runCli([invalidJsonPath]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('Validation failed');
  });

  it('rejects invalid JSON with exit code 1', async () => {
    const { code, stderr } = await runCli([badJsonPath]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('not valid JSON');
  });

  it('rejects missing file with exit code 1', async () => {
    const { code, stderr } = await runCli([join(tmpDir, 'missing.json')]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('cannot read');
  });

  it('exports output files with --out', async () => {
    const outDir = join(tmpDir, 'export-out');
    const { code, stdout } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Exported to');

    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(contentPack.zones).toBeDefined();
    expect(contentPack.entities).toBeDefined();

    const manifest = JSON.parse(await readFile(join(outDir, 'manifest.json'), 'utf-8'));
    expect(manifest).toBeDefined();

    const packMeta = JSON.parse(await readFile(join(outDir, 'pack-meta.json'), 'utf-8'));
    expect(packMeta).toBeDefined();
  });
});
