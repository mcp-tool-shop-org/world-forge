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

function runCli(args: string[], extraEnv?: NodeJS.ProcessEnv): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile('node', [CLI_PATH, ...args], { timeout: 10_000, env: extraEnv ? { ...process.env, ...extraEnv } : process.env }, (error, stdout, stderr) => {
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
    expect(stdout).toContain('--dry-run');
    expect(stdout).toContain('--profile');
    expect(stdout).toContain('--verbose');
    expect(stdout).toContain('--import');
    expect(stdout).toContain('--from-pack');
    expect(stdout).toContain('fidelity.json');
    expect(stdout).toContain('Produces (under --out)');
    expect(stdout).toContain('unknown option');
    expect(stdout).toContain('mutually exclusive with --out');
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
    // F-a7f30487: keep the parser's own location text, not just the wrapper.
    expect(stderr).toMatch(/Unexpected token|position/);
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

    // F-3162133c: --out always writes fidelity.json next to the three pack files.
    const fidelity = JSON.parse(await readFile(join(outDir, 'fidelity.json'), 'utf-8'));
    expect(fidelity.entries).toBeDefined();
    expect(Array.isArray(fidelity.entries)).toBe(true);
  });

  it('F-3162133c: --out writes assets.json / asset-bindings.json when the project has assets', async () => {
    const withAssets = {
      ...minimalProject,
      assets: [{ id: 'bg-1', kind: 'background', label: 'Hall', path: 'assets/hall.png', tags: [] }],
      zones: minimalProject.zones.map((z: (typeof minimalProject.zones)[number], i: number) =>
        i === 0 ? { ...z, backgroundId: 'bg-1' } : z,
      ),
    };
    const assetsJsonPath = join(tmpDir, 'with-assets.json');
    await writeFile(assetsJsonPath, JSON.stringify(withAssets, null, 2));
    const outDir = join(tmpDir, 'export-assets-sidecars');
    const { code } = await runCli([assetsJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    const assets = JSON.parse(await readFile(join(outDir, 'assets.json'), 'utf-8'));
    expect(assets[0].id).toBe('bg-1');
    const bindings = JSON.parse(await readFile(join(outDir, 'asset-bindings.json'), 'utf-8'));
    expect(bindings.zones['zone-entrance'].backgroundId).toBe('bg-1');
  });

  it('F-c5ed434d: --import of a pack directory writes world-project.json', async () => {
    const packDir = join(tmpDir, 'export-for-import');
    const { code: exportCode } = await runCli([validJsonPath, '--out', packDir]);
    expect(exportCode).toBe(0);
    const importDir = join(tmpDir, 'imported-project');
    const { code, stdout } = await runCli(['--from-pack', packDir, '--out', importDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Imported to');
    expect(stdout).toContain('world-project.json');
    const project = JSON.parse(await readFile(join(importDir, 'world-project.json'), 'utf-8'));
    expect(Array.isArray(project.zones)).toBe(true);
    expect(project.zones.length).toBeGreaterThan(0);
    expect(Array.isArray(project.spawnPoints)).toBe(true);
    expect(project.spawnPoints.length).toBeGreaterThan(0);
  });

  it('F-c5ed434d: --import of a ContentPack JSON file is accepted', async () => {
    const packDir = join(tmpDir, 'export-for-import-file');
    const { code: exportCode } = await runCli([validJsonPath, '--out', packDir]);
    expect(exportCode).toBe(0);
    const importDir = join(tmpDir, 'imported-from-file');
    const { code, stdout } = await runCli(['--import', join(packDir, 'content-pack.json'), '--out', importDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Imported to');
    const project = JSON.parse(await readFile(join(importDir, 'world-project.json'), 'utf-8'));
    expect(project.zones.length).toBeGreaterThan(0);
  });

  it('F-c5ed434d: --import without --out writes WorldProject JSON to stdout', async () => {
    const packDir = join(tmpDir, 'export-for-import-stdout');
    const { code: exportCode } = await runCli([validJsonPath, '--out', packDir]);
    expect(exportCode).toBe(0);
    const { code, stdout } = await runCli(['--import', join(packDir, 'content-pack.json')]);
    expect(code).toBe(0);
    const project = JSON.parse(stdout.split('\nWarnings:')[0] || stdout);
    expect(Array.isArray(project.zones)).toBe(true);
  });

  it('F-c5ed434d: unknown --import is NOT still an unknown-option error', async () => {
    const { code, stderr } = await runCli(['--import']);
    expect(code).not.toBe(0);
    expect(stderr).not.toContain("unknown option '--import'");
    expect(stderr).toContain('--import requires a path');
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

  // F-4ac43db0: --emit-schema-version wins over --no-emit-schema-version and env
  it('--emit-schema-version wins over --no-emit-schema-version when both appear', async () => {
    const outDir = join(tmpDir, 'export-schemaver-force-on');
    const { code } = await runCli([validJsonPath, '--out', outDir, '--no-emit-schema-version', '--emit-schema-version']);
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(typeof contentPack.schemaVersion).toBe('string');
    expect(contentPack.schemaVersion.length).toBeGreaterThan(0);
  });

  it('WORLD_FORGE_EMIT_SCHEMA_VERSION=0 strips schemaVersion unless --emit-schema-version is set', async () => {
    const outDir = join(tmpDir, 'export-schemaver-env-off');
    const { code } = await runCli([validJsonPath, '--out', outDir], { WORLD_FORGE_EMIT_SCHEMA_VERSION: '0' });
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(contentPack.schemaVersion).toBeUndefined();
  });

  it('--emit-schema-version overrides WORLD_FORGE_EMIT_SCHEMA_VERSION=0', async () => {
    const outDir = join(tmpDir, 'export-schemaver-env-override');
    const { code } = await runCli(
      [validJsonPath, '--out', outDir, '--emit-schema-version'],
      { WORLD_FORGE_EMIT_SCHEMA_VERSION: '0' },
    );
    expect(code).toBe(0);
    const contentPack = JSON.parse(await readFile(join(outDir, 'content-pack.json'), 'utf-8'));
    expect(typeof contentPack.schemaVersion).toBe('string');
  });

  // F-82e1add2: --out followed by another flag is a swallowed flag, not a path
  it('rejects --out --profile debug (swallowed flag) with exit code 1', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--out', '--profile', 'debug']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--profile');
    expect(stderr).toMatch(/swallowed flag/);
    let existed = true;
    try {
      await access(join(tmpDir, '--profile'));
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
  });

  // F-08ce4899: unknown flags are errors, not silent no-ops
  it('rejects unknown option --strict with exit code 1 and does not write a pack', async () => {
    const outDir = join(tmpDir, 'export-strict-should-not-exist');
    const { code, stderr } = await runCli([validJsonPath, '--out', outDir, '--strict']);
    expect(code).not.toBe(0);
    expect(stderr).toContain("unknown option '--strict'");
    expect(stderr).toContain('--help');
    let existed = true;
    try {
      await access(outDir);
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
  });

  it('rejects unknown option --pretty with exit code 1 and does not write a pack', async () => {
    const outDir = join(tmpDir, 'export-pretty-should-not-exist');
    const { code, stderr } = await runCli([validJsonPath, '--out', outDir, '--pretty']);
    expect(code).not.toBe(0);
    expect(stderr).toContain("unknown option '--pretty'");
    let existed = true;
    try {
      await access(outDir);
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
  });

  // F-608e5fc5: --validate-only is mutually exclusive with --out (same as --dry-run)
  it('--validate-only is mutually exclusive with --out and does not create the out dir', async () => {
    const outDir = join(tmpDir, 'export-validate-only-conflict');
    const { code, stderr } = await runCli([validJsonPath, '--validate-only', '--out', outDir]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('mutually exclusive');
    expect(stderr).toContain('--validate-only');
    let existed = true;
    try {
      await access(outDir);
    } catch {
      existed = false;
    }
    expect(existed).toBe(false);
  });

  // F-b2103ece: flag-first is not ENOENT on a path named --validate-only
  it('accepts --validate-only before the project path', async () => {
    const { code, stdout, stderr } = await runCli(['--validate-only', validJsonPath]);
    expect(code).toBe(0);
    expect(stdout).toContain('Validation passed');
    expect(stderr).not.toMatch(/ENOENT/);
    expect(stderr).not.toMatch(/cannot read "--validate-only"/);
  });

  it('rejects a leading flag with no project path (does not ENOENT the flag)', async () => {
    const { code, stderr } = await runCli(['--validate-only']);
    expect(code).not.toBe(0);
    expect(stderr).toMatch(/project\.json|first/);
    expect(stderr).not.toMatch(/ENOENT/);
    expect(stderr).not.toMatch(/cannot read "--validate-only"/);
  });

  // F-a7f30487: truncated JSON keeps the parser's position text
  it('rejects truncated JSON naming the parser position', async () => {
    const truncatedPath = join(tmpDir, 'truncated.json');
    await writeFile(truncatedPath, '{');
    const { code, stderr } = await runCli([truncatedPath]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('not valid JSON');
    expect(stderr).toMatch(/position/);
  });

  // F-f54a9f8b: --verbose is live on validate-only / dry-run / failure
  it('--validate-only --verbose prints verbose diagnostics', async () => {
    const { code, stdout } = await runCli([validJsonPath, '--validate-only', '--verbose']);
    expect(code).toBe(0);
    expect(stdout).toContain('Validation passed');
    expect(stdout).toContain('Verbose Diagnostics');
    expect(stdout).toContain('Profile:');
  });

  it('--dry-run --verbose prints verbose diagnostics', async () => {
    const { code, stdout } = await runCli([validJsonPath, '--dry-run', '--verbose']);
    expect(code).toBe(0);
    expect(stdout).toContain('Dry run');
    expect(stdout).toContain('Verbose Diagnostics');
  });

  it('failed export with --verbose prints errors plus verbose diagnostics', async () => {
    const { code, stdout, stderr } = await runCli([invalidJsonPath, '--verbose']);
    expect(code).not.toBe(0);
    const combined = `${stdout}\n${stderr}`;
    expect(combined).toContain('Validation failed');
    expect(combined).toContain('Verbose Diagnostics');
  });

  // F-cd05e76f: Fidelity entries cannot hide behind a green Exported to.
  // JSON files cannot encode a circular `custom` field (that path is covered
  // by convertEntities unit tests); the CLI print channel is the same for
  // any fidelity entry — landmarks on the minimal fixture is the on-disk case.
  it('prints Fidelity: on a successful export so dropped rows cannot hide behind Exported to', async () => {
    const outDir = join(tmpDir, 'export-fidelity-print');
    const { code, stdout, stderr } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Exported to');
    const combined = `${stdout}\n${stderr}`;
    expect(combined).toMatch(/Fidelity:|Warnings:/);
    expect(combined).toMatch(/landmarks-authored-and-dropped|authored-and-dropped/);
  });
});

