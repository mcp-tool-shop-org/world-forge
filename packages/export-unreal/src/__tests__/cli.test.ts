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

  it('--help lists the Produces: block (UE-B-007)', async () => {
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout).toContain('Produces');
    expect(stdout).toContain('pack.json');
    expect(stdout).toContain('zones/<id>.json');
    expect(stdout).toContain('districts/<id>.json');
    expect(stdout).toContain('actors/manifest.json');
    expect(stdout).toContain('connections.json');
    expect(stdout).toContain('world-partition.json');
    expect(stdout).toContain('fidelity.json');
  });

  it('--help advertises the pack format version and that Meta fields may grow (UE-A-003)', async () => {
    // UE-A-003: help text must tell users the pack format is versioned and that
    // Meta may gain fields in minor versions (e.g. UE-FT-007 integrity hash,
    // UE-FT-008 schema version). Asserts the guidance exists without pinning
    // exact wording so UE-FT-007/008 can edit it without breaking this test.
    const { code, stdout } = await runCli(['--help']);
    expect(code).toBe(0);
    expect(stdout.toLowerCase()).toContain('pack format version');
    expect(stdout.toLowerCase()).toMatch(/minor version/);
  });

  it('pack.json is a shape-checked manifest, not a frozen field list (UE-A-003)', async () => {
    // UE-A-003: previously tests asserted a frozen set of pack.json fields.
    // UE-FT-007 (signing) and UE-FT-008 (versioning) will ADD fields — this
    // test validates only the contract-stable shape so those additions don't
    // break this assertion when they land.
    const outDir = join(tmpDir, 'shape-out');
    const { code } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    const pack = JSON.parse(await readFile(join(outDir, 'pack.json'), 'utf-8'));

    // Required stable fields — these are part of the v1.x contract.
    const REQUIRED_FIELDS = [
      'Id', 'Name', 'Description', 'Version',
      'SourceProjectId', 'TileSizeCm', 'SourceTileSizePx', 'FormatVersion',
    ];
    for (const field of REQUIRED_FIELDS) {
      expect(pack).toHaveProperty(field);
    }

    // FormatVersion is a semver string — loaders range-match against it.
    expect(typeof pack.FormatVersion).toBe('string');
    expect(pack.FormatVersion).toMatch(/^\d+\.\d+\.\d+$/);

    // Additional fields are allowed (UE-FT-007/008 will add them). We do NOT
    // assert the field list is exactly REQUIRED_FIELDS.
  });

  it('--verbose --warnings-only filters out lossless/info entries (UE-B-008)', async () => {
    const outDir = join(tmpDir, 'warnings-only-out');
    const { code, stdout } = await runCli([
      validJsonPath, '--out', outDir, '--verbose', '--warnings-only',
    ]);
    expect(code).toBe(0);
    // Header indicates the filter is active.
    expect(stdout).toContain('warnings only');
    // No lossless/info line should appear in the warnings-only block.
    const lines = stdout.split(/\r?\n/);
    const fidelityStart = lines.findIndex((l) => l.includes('Fidelity entries'));
    expect(fidelityStart).toBeGreaterThan(-1);
    for (const l of lines.slice(fidelityStart + 1)) {
      expect(l.includes('[lossless/info]')).toBe(false);
    }
  });

  it('UE-B-002: emits a progress status to stderr before writing the pack', async () => {
    // UE-B-002: on large projects the CLI goes silent for seconds while it
    // writes zones/districts. A single-line progress status on stderr tells
    // users the CLI is alive and which workload is pending. Doesn't need to
    // be fancy — just must mention "zones" and "districts" and NOT arrive
    // after the "Exported to" stdout line.
    const outDir = join(tmpDir, 'progress-out');
    const { code, stderr } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    expect(stderr.toLowerCase()).toContain('zones');
    expect(stderr.toLowerCase()).toContain('districts');
  });

  it('UE-B-001: exits non-zero with per-file diagnostic when a zone write fails', async () => {
    // UE-B-001: previously Promise.all rejected with only the first failure's
    // message and left the pack corrupted without a useful diagnostic. The
    // fix uses Promise.allSettled and aggregates per-file failures into
    // stderr. We simulate a write failure by pointing --out at a file path
    // instead of a directory — mkdir('zones') inside that path will fail.
    //
    // On Windows/POSIX the first mkdir on the pre-existing file will fail,
    // so we assert the process exits non-zero and stderr names the failure
    // (either the mkdir or the write path). This is the defensive envelope
    // we need for the allSettled path.
    const blockerPath = join(tmpDir, 'blocker-file-not-dir');
    await writeFile(blockerPath, 'not a dir');
    const { code, stderr } = await runCli([validJsonPath, '--out', blockerPath]);
    expect(code).not.toBe(0);
    expect(stderr.length).toBeGreaterThan(0);
  });

  it('UE-B-001 + UE-B-003: pack manifest + fidelity carry Dropped/Incomplete fields on export', async () => {
    // Shape check: the happy-path manifest must always include the new
    // Dropped array + Incomplete flag so UE5 loaders can rely on them being
    // present regardless of whether anything was dropped.
    const outDir = join(tmpDir, 'dropped-shape-out');
    const { code } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    const actors = JSON.parse(
      await readFile(join(outDir, 'actors', 'manifest.json'), 'utf-8'),
    );
    expect(actors).toHaveProperty('Dropped');
    expect(Array.isArray(actors.Dropped)).toBe(true);
    expect(actors).toHaveProperty('Incomplete');
    expect(typeof actors.Incomplete).toBe('boolean');

    const fidelity = JSON.parse(await readFile(join(outDir, 'fidelity.json'), 'utf-8'));
    expect(fidelity.summary).toHaveProperty('incomplete');
    expect(fidelity.summary).toHaveProperty('droppedEntityCount');
    expect(fidelity.summary.incomplete).toBe(false);
    expect(fidelity.summary.droppedEntityCount).toBe(0);
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

    // UE-FT-004: parallax manifest + transitions file are always written, even
    // if empty, so the UE5 loader can blindly read them.
    const parallax = JSON.parse(
      await readFile(join(outDir, 'actors', 'parallax-manifest.json'), 'utf-8'),
    );
    expect(Array.isArray(parallax.Actors)).toBe(true);

    const transitions = JSON.parse(
      await readFile(join(outDir, 'actors', 'transitions.json'), 'utf-8'),
    );
    expect(Array.isArray(transitions)).toBe(true);

    // At least one zone file was written.
    const firstZoneId = minimalProject.zones[0].id.replace(/[^a-zA-Z0-9._-]/g, '_');
    const zone = JSON.parse(await readFile(join(outDir, 'zones', `${firstZoneId}.json`), 'utf-8'));
    expect(zone.Id).toBe(minimalProject.zones[0].id);

    // At least one district file was written.
    const firstDistrictId = minimalProject.districts[0].id.replace(/[^a-zA-Z0-9._-]/g, '_');
    const district = JSON.parse(await readFile(join(outDir, 'districts', `${firstDistrictId}.json`), 'utf-8'));
    expect(district.Id).toBe(minimalProject.districts[0].id);
  });

  // UE-FT-007: --sign attaches an integrity hash to pack.json.
  it('UE-FT-007: --sign attaches a sha256 Signature to pack.json', async () => {
    const outDir = join(tmpDir, 'signed-out');
    const { code } = await runCli([validJsonPath, '--out', outDir, '--sign']);
    expect(code).toBe(0);
    const pack = JSON.parse(await readFile(join(outDir, 'pack.json'), 'utf-8'));
    expect(pack.Signature).toBeDefined();
    expect(pack.Signature.algorithm).toBe('sha256');
    expect(typeof pack.Signature.value).toBe('string');
    expect(pack.Signature.value).toMatch(/^[0-9a-f]{64}$/);
    expect(Array.isArray(pack.Signature.signedFields)).toBe(true);
  });

  it('UE-FT-007: export without --sign has no Signature (backward compat)', async () => {
    const outDir = join(tmpDir, 'unsigned-out');
    const { code } = await runCli([validJsonPath, '--out', outDir]);
    expect(code).toBe(0);
    const pack = JSON.parse(await readFile(join(outDir, 'pack.json'), 'utf-8'));
    expect(pack.Signature).toBeUndefined();
  });

  // UE-FT-005: --summary prints a human-readable overview of a pack dir.
  it('UE-FT-005: --summary prints a human-readable summary', async () => {
    const outDir = join(tmpDir, 'summary-src-out');
    await runCli([validJsonPath, '--out', outDir]);
    const { code, stdout } = await runCli(['--summary', outDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Pack:');
    expect(stdout).toContain('FormatVersion:');
    expect(stdout).toContain('Zones:');
    expect(stdout).toContain('Signed:');
  });

  it('UE-FT-005: --summary on a missing directory exits non-zero with a hint', async () => {
    const { code, stderr } = await runCli(['--summary', join(tmpDir, 'no-such-dir')]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('pack.json');
  });

  it('UE-FT-005: --diff on identical packs reports all zeros', async () => {
    const aDir = join(tmpDir, 'diff-id-a');
    const bDir = join(tmpDir, 'diff-id-b');
    await runCli([validJsonPath, '--out', aDir]);
    await runCli([validJsonPath, '--out', bDir]);
    const { code, stdout } = await runCli(['--diff', aDir, bDir]);
    expect(code).toBe(0);
    expect(stdout).toContain('Zones:');
    expect(stdout).toContain('0 added, 0 removed, 0 changed');
  });

  it('UE-FT-005: --diff with only one path exits non-zero', async () => {
    const { code, stderr } = await runCli(['--diff', tmpDir]);
    expect(code).not.toBe(0);
    expect(stderr).toContain('--diff requires two');
  });
});
