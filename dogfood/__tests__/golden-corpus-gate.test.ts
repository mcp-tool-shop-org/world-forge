// golden-corpus-gate.test.ts — tests structured gate verification across World Forge's
// sample, template, fixture, and dogfood world corpus.

import { describe, it, expect } from 'vitest';
import {
  EXPECTED_CORPUS_BLOCKERS,
  loadGoldenCorpusWorlds,
  verifyGoldenCorpus,
} from '../verify-golden-corpus.js';
import { validateExportWithEngine } from '../../packages/export-ai-rpg/src/engine-gate.js';

describe('golden corpus engine gate verification', () => {
  it('runs >0 structured gate checks on all 31 corpus worlds and matches the expected-blocker list', () => {
    const worlds = loadGoldenCorpusWorlds();
    expect(worlds).toHaveLength(31);
    expect(EXPECTED_CORPUS_BLOCKERS).toHaveLength(14);

    const report = verifyGoldenCorpus({ worlds });
    expect(report.failures).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.worldsChecked).toBe(31);
    expect(report.totalGateChecksRun).toBe(31 * 4);
    expect(report.observedBlockers).toEqual(EXPECTED_CORPUS_BLOCKERS);
  });

  it('rejects a structured gate result with zero executed checks even when gate.ok is true', () => {
    const [firstWorld] = loadGoldenCorpusWorlds();
    const report = verifyGoldenCorpus({
      worlds: [firstWorld],
      expectedBlockers: [],
      runValidation: (project, exportResult) => {
        const real = validateExportWithEngine(project, exportResult);
        return {
          ...real,
          gate: {
            ok: true,
            checks: [],
            errors: [],
            advisories: [],
            report: '',
          },
        };
      },
    });

    expect(report.ok).toBe(false);
    expect(report.totalGateChecksRun).toBe(0);
    expect(report.failures.some((f) => f.includes('0 checks'))).toBe(true);
  });

  it('fails if a blocker world is added, removed, or changes its encounterType', () => {
    const report = verifyGoldenCorpus({
      expectedBlockers: EXPECTED_CORPUS_BLOCKERS.slice(0, -1),
    });
    expect(report.ok).toBe(false);
    expect(report.failures.some((f) => f.includes('Expected-blocker list drifted'))).toBe(true);
  });
});
