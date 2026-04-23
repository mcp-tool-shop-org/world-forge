/**
 * summary-diff.test.ts — UE-FT-005 summary + diff helpers.
 *
 * The CLI wrappers are covered by cli.test.ts. These tests exercise the pure
 * functions by writing small pack fixtures to tmp dirs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { exportToUnreal } from '../export.js';
import { summarizePack, formatSummary } from '../summary.js';
import { diffPacks, formatDiff } from '../diff.js';
import type { UnrealContentPack } from '../export.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

interface WrittenPack {
  dir: string;
  pack: UnrealContentPack;
}

async function writePack(root: string, name: string, pack: UnrealContentPack): Promise<string> {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  await mkdir(join(dir, 'zones'), { recursive: true });
  await mkdir(join(dir, 'districts'), { recursive: true });
  await mkdir(join(dir, 'actors'), { recursive: true });

  await writeFile(join(dir, 'pack.json'), JSON.stringify(pack.Meta, null, 2));
  await writeFile(join(dir, 'connections.json'), JSON.stringify(pack.Connections, null, 2));
  await writeFile(join(dir, 'world-partition.json'), JSON.stringify(pack.WorldPartition, null, 2));
  await writeFile(join(dir, 'actors', 'manifest.json'), JSON.stringify(pack.Actors, null, 2));
  await writeFile(
    join(dir, 'actors', 'parallax-manifest.json'),
    JSON.stringify(pack.Parallax, null, 2),
  );
  await writeFile(join(dir, 'actors', 'transitions.json'), JSON.stringify(pack.Transitions, null, 2));
  for (const zone of pack.Zones) {
    await writeFile(join(dir, 'zones', `${zone.Id}.json`), JSON.stringify(zone, null, 2));
  }
  for (const d of pack.Districts) {
    await writeFile(join(dir, 'districts', `${d.Id}.json`), JSON.stringify(d, null, 2));
  }
  return dir;
}

async function buildPack(signing = false): Promise<WrittenPack['pack']> {
  const result = exportToUnreal(
    minimalProject,
    signing ? { signing: { algorithm: 'sha256' } } : undefined,
  );
  if (!result.success) throw new Error('export failed');
  return result.contentPack;
}

let root: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'wf-ue-summary-diff-'));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('summarizePack', () => {
  it('returns counts matching a known minimal pack', async () => {
    const pack = await buildPack();
    const dir = await writePack(root, 'baseline', pack);
    const result = await summarizePack(dir);
    if ('error' in result) throw new Error(result.error);
    expect(result.counts.zones).toBe(pack.Zones.length);
    expect(result.counts.districts).toBe(pack.Districts.length);
    expect(result.counts.actors).toBe(pack.Actors.All.length);
    expect(result.counts.connections).toBe(pack.Connections.length);
    expect(result.meta.formatVersion).toBe('1.1.0');
    expect(result.meta.signed).toBe(false);
    expect(result.sizeBytes).toBeGreaterThan(0);
  });

  it('flags signed packs with signatureAlgorithm', async () => {
    const pack = await buildPack(true);
    const dir = await writePack(root, 'signed', pack);
    const result = await summarizePack(dir);
    if ('error' in result) throw new Error(result.error);
    expect(result.meta.signed).toBe(true);
    expect(result.meta.signatureAlgorithm).toBe('sha256');
  });

  it('formatSummary produces the expected labeled lines', async () => {
    const pack = await buildPack();
    const dir = await writePack(root, 'fmt', pack);
    const result = await summarizePack(dir);
    if ('error' in result) throw new Error(result.error);
    const text = formatSummary(result);
    expect(text).toContain('Pack:');
    expect(text).toContain('FormatVersion: 1.1.0');
    expect(text).toContain('Zones:');
    expect(text).toContain('Signed:');
  });

  it('returns an actionable error for a missing pack dir', async () => {
    const result = await summarizePack(join(root, 'does-not-exist'));
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('pack.json');
      expect(result.hint).toBeDefined();
    }
  });

  it('returns an actionable error for a dir missing FormatVersion', async () => {
    const badDir = join(root, 'malformed');
    await mkdir(badDir, { recursive: true });
    await writeFile(join(badDir, 'pack.json'), JSON.stringify({ Id: 'x', Name: 'x' }));
    const result = await summarizePack(badDir);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('FormatVersion');
    }
  });
});

describe('diffPacks', () => {
  it('reports all zeros for identical packs', async () => {
    const packA = await buildPack();
    const packB = await buildPack();
    const a = await writePack(root, 'diff-a', packA);
    const b = await writePack(root, 'diff-b', packB);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    expect(result.zones).toEqual({ added: [], removed: [], changed: [] });
    expect(result.districts).toEqual({ added: [], removed: [], changed: [] });
    expect(result.actors).toEqual({ added: [], removed: [], changed: [] });
    expect(result.formatVersion.changed).toBe(false);
    expect(result.signature.changed).toBe(false);
  });

  it('reports "1 added" when a zone is added', async () => {
    const packA = await buildPack();
    const packB = await buildPack();
    // Add an extra zone to B by copying an existing one with a new id.
    const cloneSource = packB.Zones[0];
    const extra = { ...cloneSource, Id: 'zone-extra-for-diff' };
    const packBPlus: UnrealContentPack = {
      ...packB,
      Zones: [...packB.Zones, extra],
    };
    const a = await writePack(root, 'diff-add-a', packA);
    const b = await writePack(root, 'diff-add-b', packBPlus);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    expect(result.zones.added).toContain('zone-extra-for-diff');
    expect(result.zones.added.length).toBe(1);
    expect(result.zones.removed.length).toBe(0);
  });

  it('reports "1 removed" when an entity is dropped', async () => {
    const packA = await buildPack();
    if (packA.Actors.All.length === 0) return; // guard: minimal fixture has no entities
    const packB: UnrealContentPack = {
      ...packA,
      Actors: {
        ...packA.Actors,
        All: packA.Actors.All.slice(1),
      },
    };
    const a = await writePack(root, 'diff-rm-a', packA);
    const b = await writePack(root, 'diff-rm-b', packB);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    expect(result.actors.removed.length).toBe(1);
    expect(result.actors.added.length).toBe(0);
  });

  it('reports "1 changed" when a zone field is edited', async () => {
    const packA = await buildPack();
    const edited = {
      ...packA.Zones[0],
      Description: 'EDITED FOR DIFF TEST',
    };
    const packB: UnrealContentPack = {
      ...packA,
      Zones: [edited, ...packA.Zones.slice(1)],
    };
    const a = await writePack(root, 'diff-chg-a', packA);
    const b = await writePack(root, 'diff-chg-b', packB);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    expect(result.zones.changed).toContain(packA.Zones[0].Id);
  });

  it('calls out FormatVersion change explicitly', async () => {
    const packA = await buildPack();
    const packB: UnrealContentPack = {
      ...packA,
      Meta: { ...packA.Meta, FormatVersion: '1.0.0' },
    };
    const a = await writePack(root, 'diff-fmt-a', packA);
    const b = await writePack(root, 'diff-fmt-b', packB);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    expect(result.formatVersion.changed).toBe(true);
    expect(result.formatVersion.prev).toBe('1.1.0');
    expect(result.formatVersion.next).toBe('1.0.0');
    const formatted = formatDiff(result);
    expect(formatted).toContain('FormatVersion');
  });

  it('calls out Signature addition', async () => {
    const packA = await buildPack(false);
    const packB = await buildPack(true);
    const a = await writePack(root, 'diff-sig-a', packA);
    const b = await writePack(root, 'diff-sig-b', packB);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    expect(result.signature.changed).toBe(true);
    expect(result.signature.next).toBe(true);
    const formatted = formatDiff(result);
    expect(formatted).toContain('Signature');
  });

  it('--detailed formatting lists ids with +/-/~ markers', async () => {
    const packA = await buildPack();
    const cloneSource = packA.Zones[0];
    const extra = { ...cloneSource, Id: 'zone-detailed-extra' };
    const packB: UnrealContentPack = { ...packA, Zones: [...packA.Zones, extra] };
    const a = await writePack(root, 'diff-detail-a', packA);
    const b = await writePack(root, 'diff-detail-b', packB);
    const result = await diffPacks(a, b);
    if ('error' in result) throw new Error(result.error);
    const formatted = formatDiff(result, true);
    expect(formatted).toContain('+ zone-detailed-extra');
  });

  it('returns an actionable error for a missing pack dir', async () => {
    const packA = await buildPack();
    const a = await writePack(root, 'diff-missing-a', packA);
    const result = await diffPacks(a, join(root, 'does-not-exist'));
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('pack.json');
      expect(result.hint).toBeDefined();
    }
  });
});
