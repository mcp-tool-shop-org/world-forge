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
  return new Promise((resolvePromise) => {
    execFile('node', [CLI_PATH, ...args], { timeout: 15_000 }, (error, stdout, stderr) => {
      resolvePromise({
        code: error?.code !== undefined ? (error.code as unknown as number) : error ? 1 : 0,
        stdout,
        stderr,
      });
    });
  });
}

let tmpDir: string;
let validJsonPath: string;
let invalidJsonPath: string;
let badJsonPath: string;

beforeAll(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'wf-ue-cli-'));
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

describe('CLI: world-forge-export-unreal', () => {
  it('shows help with --help and exits 0', async () => {
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: world-forge-export-unreal');
    expect(stdout).toContain('--validate-only');
    expect(stdout).toContain('--tile-size-cm');
  });

  it('shows help with no args and exits 0', async () => {
    const { code, stdout } = await runCli([]);
    expect(code).toBe(0);
    expect(stdout).toContain('Usage: world-forge-export-unreal');
  });

  it('rejects a missing input file with exit code 1', async () => {
    const { code, stderr } = await runCli([join(tmpDir, 'missing.json')]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('cannot read');
  });

  it('rejects invalid JSON with exit code 1', async () => {
    const { code, stderr } = await runCli([badJsonPath]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('not valid JSON');
  });

  it('errors when --out is passed with no value', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--out']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--out requires a path value');
  });

  it('errors when --tile-size-cm is non-numeric', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--tile-size-cm', 'abc']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('positive finite number');
  });

  it('errors when --tile-size-cm is negative', async () => {
    const { code, stderr } = await runCli([validJsonPath, '--tile-size-cm', '-5']);
    expect(code).not.toBe(0);
    expect(stderr).toContain('positive finite number');
  });

  it('rejects an invalid project with exit code 1', async () => {
    const { code, stderr } = await runCli([invalidJsonPath]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('Validation failed');
  });

  it('--validate-only on a valid project exits 0 and does not write files', async () => {
    const outDir = join(tmpDir, 'validate-only-out');
    const { code, stdout } = await runCli([validJsonPath, '--validate-only', '--out', outDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Validation passed');

    // Output dir should not exist (no files written).
    let exists = true;
    try {
      await access(outDir);
    } catch {
      exists = false;
    }
    expect(exists).toBe(false);
  });

  it('happy-path export writes the full Unreal pack layout under --out', async () => {
    const outDir = join(tmpDir, 'export-out');
    const { code, stdout } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Exported to');

    const pack = JSON.parse(await readFile(join(outDir, 'pack.json'), 'utf-8'));
    expect(pack.Id).toBe(minimalProject.id);
    expect(pack.SourceTileSizePx).toBe(minimalProject.map.tileSize);

    const wp = JSON.parse(await readFile(join(outDir, 'world-partition.json'), 'utf-8'));
    expect(wp.CellsX).toBeGreaterThanOrEqual(1);

    const connections = JSON.parse(await readFile(join(outDir, 'connections.json'), 'utf-8'));
    expect(Array.isArray(connections)).toBe(true);

    const fidelity = JSON.parse(await readFile(join(outDir, 'fidelity.json'), 'utf-8'));
    expect(fidelity.entries).toBeDefined();
    expect(fidelity.summary).toBeDefined();

    const actorsManifest = JSON.parse(await readFile(join(outDir, 'actors', 'manifest.json'), 'utf-8'));
    expect(actorsManifest.All).toBeDefined();

    // At least one zone file was written.
    const firstZoneId = minimalProject.zones[0].id.replace(/[^a-zA-Z0-9._-]/g, '_');
    const zone = JSON.parse(await readFile(join(outDir, 'zones', `${firstZoneId}.json`), 'utf-8'));
    expect(zone.Id).toBe(minimalProject.zones[0].id);

    // At least one district file was written.
    const firstDistrictId = minimalProject.districts[0].id.replace(/[^a-zA-Z0-9._-]/g, '_');
    const district = JSON.parse(await readFile(join(outDir, 'districts', `${firstDistrictId}.json`), 'utf-8'));
    expect(district.Id).toBe(minimalProject.districts[0].id);
  });
});
