// cli-host-parity.test.ts — verifies that the CLI and engine contract tests share
// the single runtime validation host factory, checks all 31 corpus worlds against
// their committed record, and verifies per-world engine isolation across sequential runs.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../../packages/export-ai-rpg/src/index.js';
import {
  createRuntimeValidationHost,
  validateExportWithEngine,
} from '../../packages/export-ai-rpg/src/engine-gate.js';
import { contractValidationHostFactory } from '../../packages/export-ai-rpg/src/__tests__/helpers/contract-host.js';
import { loadGoldenCorpusWorlds } from '../verify-golden-corpus.js';
import { CORPUS_HOST_RECORD } from './fixtures/corpus-host-record.js';

const worlds = loadGoldenCorpusWorlds();
const REPO_ROOT = resolve(import.meta.dirname, '../..');

describe('shared runtime validation host factory and corpus record', () => {
  it('CLI and engine contract tests build their validation host from the same factory', () => {
    expect(contractValidationHostFactory).toBe(createRuntimeValidationHost);

    const cliSrc = readFileSync(resolve(REPO_ROOT, 'packages/export-ai-rpg/src/cli.ts'), 'utf-8');
    const gateSrc = readFileSync(resolve(REPO_ROOT, 'packages/export-ai-rpg/src/engine-gate.ts'), 'utf-8');
    const contractTestSrc = readFileSync(
      resolve(REPO_ROOT, 'packages/export-ai-rpg/src/__tests__/engine-contract.test.ts'),
      'utf-8',
    );
    const itemsTestSrc = readFileSync(
      resolve(REPO_ROOT, 'packages/export-ai-rpg/src/__tests__/item-placements-contract.test.ts'),
      'utf-8',
    );

    expect(cliSrc).toContain("from './engine-gate.js'");
    expect(cliSrc).toContain('validateExportWithEngine');
    expect(cliSrc).not.toContain('@ai-rpg-engine/starter-fantasy');
    expect(cliSrc).not.toContain('new Engine(');

    expect(gateSrc).toContain('export function createRuntimeValidationHost');
    expect(gateSrc).not.toContain('@ai-rpg-engine/starter-fantasy');

    expect(contractTestSrc).toContain("from './helpers/contract-host.js'");
    expect(contractTestSrc).not.toContain('@ai-rpg-engine/starter-fantasy');
    expect(contractTestSrc).not.toContain('createGame(');
    expect(contractTestSrc).not.toContain('new Engine(');

    expect(itemsTestSrc).toContain("from './helpers/contract-host.js'");
    expect(itemsTestSrc).not.toContain('@ai-rpg-engine/starter-fantasy');
    expect(itemsTestSrc).not.toContain('createGame(');
    expect(itemsTestSrc).not.toContain('new Engine(');
  });

  it('committed corpus record covers all 31 corpus worlds in order', () => {
    expect(CORPUS_HOST_RECORD).toHaveLength(31);
    expect(CORPUS_HOST_RECORD.map((r) => r.world)).toEqual(worlds.map((w) => w.name));
  });

  it.each(worlds.map((world, idx) => ({ world, expected: CORPUS_HOST_RECORD[idx] })))(
    '$world.name matches committed validation record via shared host factory',
    ({ world, expected }) => {
      const exported = exportToEngine(world.project);
      expect(exported.success, `${world.name} failed exportToEngine`).toBe(true);
      if (!exported.success) throw new Error(`${world.name} export failed`);

      const actual = validateExportWithEngine(world.project, exported);

      expect(actual.gate.ok).toBe(expected.gateOk);
      expect(actual.gate.checks.map((c) => ({ check: c.check, ok: c.ok }))).toEqual(expected.gateChecks);
      expect(actual.intake.ok).toBe(expected.intakeOk);
      expect(actual.refusalCode).toBe(expected.refusalCode);
      expect(actual.intake.applied).toEqual(expected.applied);
      expect(actual.intake.errors).toEqual(expected.errors);
      expect(actual.intake.advisories).toEqual(expected.advisories);
      expect(actual.intake.dropped).toEqual(expected.dropped);
    },
  );
});

describe('per-world engine isolation across sequential corpus runs', () => {
  it('running salt-road(scaled) then salt-road(raw) matches solo runs with no hazard registry leak', () => {
    const scaledWorld = worlds.find((w) => w.name === 'dogfood:salt-road(scaled)');
    const rawWorld = worlds.find((w) => w.name === 'dogfood:salt-road(raw)');
    expect(scaledWorld).toBeDefined();
    expect(rawWorld).toBeDefined();

    const scaledExport = exportToEngine(scaledWorld!.project);
    const rawExport = exportToEngine(rawWorld!.project);
    expect(scaledExport.success).toBe(true);
    expect(rawExport.success).toBe(true);
    if (!scaledExport.success || !rawExport.success) throw new Error('salt-road export failed');

    const soloRaw = validateExportWithEngine(rawWorld!.project, rawExport);
    const soloScaled = validateExportWithEngine(scaledWorld!.project, scaledExport);

    // Run scaled immediately before raw, then raw immediately before scaled.
    const scaledBeforeRaw = validateExportWithEngine(scaledWorld!.project, scaledExport);
    const rawAfterScaled = validateExportWithEngine(rawWorld!.project, rawExport);
    const scaledAfterRaw = validateExportWithEngine(scaledWorld!.project, scaledExport);

    for (const res of [soloRaw, soloScaled, scaledBeforeRaw, rawAfterScaled, scaledAfterRaw]) {
      const duplicateHazard = res.intake.dropped.filter((d) =>
        d.detail.includes('already registered by pack CODE'),
      );
      expect(duplicateHazard).toEqual([]);
    }

    expect(rawAfterScaled.gate).toEqual(soloRaw.gate);
    expect(rawAfterScaled.intake).toEqual(soloRaw.intake);
    expect(scaledAfterRaw.gate).toEqual(soloScaled.gate);
    expect(scaledAfterRaw.intake).toEqual(soloScaled.intake);
  });
});
