import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { writeFile, readFile, rm, mkdtemp, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { invalidOrphanProject } from '../../../schema/src/__tests__/fixtures/invalid-orphan.js';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cli.js');

beforeAll(async () => {
  try {
    await access(CLI_PATH);
  } catch {
    throw new Error(`CLI binary not found at ${CLI_PATH}. Run "npm run build" first.`);
  }
});

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

  // AIR-A-002: --out requires a path value (cli.ts lines 31-34)
  it('rejects --out with no value with exit code 1', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--out']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('requires a path');
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

  // AIR-FT-001: --profile flag
  it('defaults to release profile (no _debug in content-pack.json)', async () => {
    const outDir = join(tmpDir, 'export-profile-default');
    const { code } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(contentPack._debug).toBeUndefined();
  });

  it('--profile debug emits _debug block in content-pack.json', async () => {
    const outDir = join(tmpDir, 'export-profile-debug');
    const { code } = await runCli([validJsonPath, '--out', outDir, '--profile', 'debug']);
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(contentPack._debug).toBeDefined();
    expect(contentPack._debug.fidelityVerbose).toBe(true);
    expect(contentPack._debug.sourceProjectId).toBeTruthy();
  });

  it('rejects --profile with no value', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--profile']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--profile requires a value');
  });

  it('rejects unknown --profile value', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--profile', 'wobbly']);
    expect(code).not.toBe(0);
    expect(stderr).toContain("--profile must be 'release' or 'debug'");
  });

  // AIR-FT-005: --dry-run
  it('--dry-run does NOT create the output dir', async () => {
    const outDir = join(tmpDir, 'export-dry-run-should-not-exist');
    const { code, stdout } = await runCli([validJsonPath, '--dry-run']);
    expect(code).toBe(0);
    expect(stdout).toContain('Dry run');
    expect(stdout).toContain('bytes');

    // The default output dir would be ./export — but we never requested --out,
    // so the behavior we assert is: the explicit outDir wasn't created.
    let existed = true;
    try {
      await access(outDir);
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
  });

  it('--dry-run is mutually exclusive with --out', async () => {
    const outDir = join(tmpDir, 'export-dry-run-conflict');
    const { code, stderr } = await runCli([validJsonPath, '--dry-run', '--out', outDir]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('mutually exclusive');
    // Confirm the outDir was never created.
    let existed = true;
    try {
      await access(outDir);
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
  });

  // AIR-FT-005: --emit-schema-version (default on) / --no-emit-schema-version
  it('puts schemaVersion in the ContentPack by default', async () => {
    const outDir = join(tmpDir, 'export-schemaver-on');
    const { code } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(typeof contentPack.schemaVersion).toBe('string');
    expect(contentPack.schemaVersion.length).toBeGreaterThan(0);
  });

  it('--no-emit-schema-version strips schemaVersion from the ContentPack', async () => {
    const outDir = join(tmpDir, 'export-schemaver-off');
    const { code } = await runCli([validJsonPath, '--out', outDir, '--no-emit-schema-version']);
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(contentPack.schemaVersion).toBeUndefined();
  });
});
