// verify-golden-corpus.ts — Runs World Forge's sample, template, fixture, and dogfood
// worlds through the real engine load gate and intake dry run, verifying both structured
// gate execution (`checks.length > 0`) and exact stability of expected blockers.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { WorldProject } from '../packages/schema/src/index.js';
import {
  SAMPLE_WORLDS,
  GENRE_TEMPLATES,
  MODE_STARTERS,
  LAYOUT_TEMPLATES,
} from '../packages/editor/src/templates/registry.js';
import { chapelProject } from '../packages/schema/src/__tests__/fixtures/chapel-authored.js';
import { exportToEngine } from '../packages/export-ai-rpg/src/index.js';
import {
  validateExportWithEngine,
  type EngineValidationResult,
} from '../packages/export-ai-rpg/src/engine-gate.js';
import { proofProject } from './worlds/multi-target-proof.js';
import { saltRoadProject } from './worlds/salt-road.js';
import { scaleForSandbox } from './worlds/sandbox-scale.js';

export interface CorpusWorld {
  name: string;
  project: WorldProject;
}

export interface ExpectedCorpusBlocker {
  world: string;
  encounterType: string;
}

/**
 * Expected encounter-type blockers on worlds whose sample/mode flavour uses an
 * encounter type outside AI RPG Engine's core four (`ambush`, `patrol`, `horde`, `duel`).
 */
export const EXPECTED_CORPUS_BLOCKERS: readonly ExpectedCorpusBlocker[] = [
  { world: 'sample:chapel-threshold', encounterType: 'boss' },
  { world: 'sample:ocean-harbor', encounterType: 'pirate' },
  { world: 'sample:space-station', encounterType: 'boarding' },
  { world: 'sample:wilderness-trail', encounterType: 'beast' },
  { world: 'sample:city-market', encounterType: 'brawl' },
  { world: 'sample:world-map', encounterType: 'caravan-raid' },
  { world: 'sample:cabin-interior', encounterType: 'haunt' },
  { world: 'mode:district-starter', encounterType: 'brawl' },
  { world: 'mode:world-starter', encounterType: 'caravan-raid' },
  { world: 'mode:ocean-starter', encounterType: 'pirate' },
  { world: 'mode:space-starter', encounterType: 'boarding' },
  { world: 'mode:interior-starter', encounterType: 'haunt' },
  { world: 'mode:wilderness-starter', encounterType: 'beast' },
  { world: 'fixture:chapel-authored', encounterType: 'combat' },
] as const;

/** Load all 31 sample, genre, mode, layout, fixture, and dogfood worlds in deterministic order. */
export function loadGoldenCorpusWorlds(): CorpusWorld[] {
  return [
    ...SAMPLE_WORLDS.map((s) => ({ name: `sample:${s.id}`, project: s.project })),
    ...GENRE_TEMPLATES.map((g) => ({ name: `genre:${g.id}`, project: g.project })),
    ...MODE_STARTERS.map((m) => ({ name: `mode:${m.id}`, project: m.project })),
    ...LAYOUT_TEMPLATES.map((l) => ({ name: `layout:${l.id}`, project: l.generate() as WorldProject })),
    { name: 'fixture:chapel-authored', project: chapelProject },
    { name: 'dogfood:multi-target-proof', project: proofProject },
    { name: 'dogfood:salt-road(scaled)', project: scaleForSandbox(saltRoadProject) },
    { name: 'dogfood:salt-road(raw)', project: saltRoadProject },
  ];
}

export interface GoldenCorpusReport {
  ok: boolean;
  worldsChecked: number;
  totalGateChecksRun: number;
  observedBlockers: ExpectedCorpusBlocker[];
  failures: string[];
}

export function verifyGoldenCorpus(options?: {
  worlds?: CorpusWorld[];
  runValidation?: typeof validateExportWithEngine;
  expectedBlockers?: readonly ExpectedCorpusBlocker[];
}): GoldenCorpusReport {
  const worlds = options?.worlds ?? loadGoldenCorpusWorlds();
  const runValidation = options?.runValidation ?? validateExportWithEngine;
  const expectedBlockers = options?.expectedBlockers ?? EXPECTED_CORPUS_BLOCKERS;

  const failures: string[] = [];
  const observedBlockers: ExpectedCorpusBlocker[] = [];
  let totalGateChecksRun = 0;

  if (worlds.length === 0) {
    failures.push('No corpus worlds loaded.');
  }

  for (const world of worlds) {
    const exported = exportToEngine(world.project);
    if (!exported.success) {
      failures.push(`${world.name}: exportToEngine failed (${exported.errors.map((e) => e.message).join('; ')})`);
      continue;
    }

    const validation: EngineValidationResult = runValidation(world.project, exported);
    const checks = validation.gate?.checks ?? [];
    if (!Array.isArray(checks) || checks.length === 0) {
      failures.push(`${world.name}: structured load gate executed 0 checks (zero-check pass is invalid)`);
      continue;
    }
    totalGateChecksRun += checks.length;

    if (!validation.gate.ok) {
      failures.push(`${world.name}: load gate refused pack (${validation.failedGateCheckCodes.join(', ')})`);
    }

    if (validation.encounterBlockers.length > 0) {
      for (const blocker of validation.encounterBlockers) {
        observedBlockers.push({ world: world.name, encounterType: blocker.encounterType });
      }
      // Verify all intake errors on expected-blocked worlds are solely encounterType blockers.
      const blockerIds = new Set(validation.encounterBlockers.map((b) => b.anchorId));
      const nonEncounterErrors = validation.intake.errors.filter(
        (err) => !err.path.startsWith('encounterAnchors') || ![...blockerIds].some((id) => err.path.includes(id)),
      );
      if (nonEncounterErrors.length > 0) {
        failures.push(
          `${world.name}: unexpected non-encounter intake error(s): ${nonEncounterErrors.map((e) => `${e.path}: ${e.message}`).join('; ')}`,
        );
      }
    } else if (!validation.intake.ok) {
      failures.push(
        `${world.name}: intake dry run refused unblocked world (${validation.intake.errors.map((e) => `${e.path}: ${e.message}`).join('; ')})`,
      );
    }
  }

  if (totalGateChecksRun <= 0) {
    failures.push(`Expected more than zero structured gate checks across corpus, got ${totalGateChecksRun}`);
  }

  const expectedSerial = JSON.stringify(expectedBlockers);
  const observedSerial = JSON.stringify(observedBlockers);
  if (observedSerial !== expectedSerial) {
    const expSet = new Set(expectedBlockers.map((b) => `${b.world}:${b.encounterType}`));
    const obsSet = new Set(observedBlockers.map((b) => `${b.world}:${b.encounterType}`));
    const missing = [...expSet].filter((x) => !obsSet.has(x));
    const added = [...obsSet].filter((x) => !expSet.has(x));
    failures.push(
      `Expected-blocker list drifted (expected ${expectedBlockers.length}, observed ${observedBlockers.length}; ` +
        `missing=[${missing.join(', ')}], added=[${added.join(', ')}])`,
    );
  }

  return {
    ok: failures.length === 0 && totalGateChecksRun > 0 && worlds.length > 0,
    worldsChecked: worlds.length,
    totalGateChecksRun,
    observedBlockers,
    failures,
  };
}

function parseJsonOutArg(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json-out') return argv[i + 1] ?? null;
    if (argv[i].startsWith('--json-out=')) return argv[i].slice('--json-out='.length);
  }
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const jsonOut = parseJsonOutArg(process.argv.slice(2));
  const report = verifyGoldenCorpus();
  if (jsonOut) {
    writeFileSync(resolve(process.cwd(), jsonOut), `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  }
  console.log(
    `[golden-corpus] worlds=${report.worldsChecked} gateChecks=${report.totalGateChecksRun} ` +
      `blockedByDesign=${report.observedBlockers.length} ok=${report.ok}`,
  );
  if (!report.ok) {
    for (const failure of report.failures) {
      console.error(`  FAIL: ${failure}`);
    }
    process.exit(1);
  }
  process.exit(0);
}
