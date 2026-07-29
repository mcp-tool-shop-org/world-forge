// c3-condition-roundtrip.test.ts — C3/P1: the export→import round-trip for
// SpawnCondition-bearing fields, end to end through the real pipeline.
//
// ⚠ THIS FILE WOULD HAVE FAILED ON `main` BEFORE C3.
//
// C1 fixed the export side of zone exit conditions: the grammar string now
// COMPILES through parseSpawnCondition into a proper ConditionSpec, closing the
// audit's single `carried-garbled` row. Its proof was one-directional — it
// asserted the exported shape, correctly — and the import side still read
// `condition.type` and threw the operands away. Before C1 that was invisible
// because the garble put the whole string in `type`, so a broken export and a
// broken import cancelled out.
//
// Measured at C3/P0 on the built packages: `item:rope` exported correctly and
// imported back as the bare string `"has-item"`, which parseSpawnCondition
// rejects — so a full round-trip produced a project whose conditions fail
// validateSpawnCondition. The repair is `formatConditionSpec`, the codec's
// inverse, and this file is the test that keeps it honest in BOTH directions.

import { describe, it, expect } from 'vitest';
import { parseSpawnCondition, validateSpawnCondition } from '@world-forge/schema';
import { vocabularyCoverageProject } from './fixtures/vocabulary-coverage.js';
import { exportToEngine } from '../export.js';
import { importZones } from '../import-zones.js';

const exported = exportToEngine(vocabularyCoverageProject);
if (!exported.success) throw new Error('fixture must export cleanly');
const pack = exported.contentPack;

/** Every authored exit condition in the fixture, with its zone. */
const authoredConditions = vocabularyCoverageProject.zones.flatMap((z) =>
  z.exits.filter((e) => e.condition !== undefined).map((e) => ({
    zoneId: z.id,
    targetZoneId: e.targetZoneId,
    condition: e.condition!,
  })),
);

describe('C3/P1 — the fixture actually exercises operand-bearing conditions', () => {
  it('authors at least one condition WITH operands (else the test is vacuous)', () => {
    // The vacuity guard. A round-trip over `always`/`never` alone would pass
    // even with the broken importer, which is precisely how this regression
    // survived a cycle. Five of v3.6's validators failed exactly this way.
    expect(authoredConditions.length).toBeGreaterThan(0);
    const withOperands = authoredConditions.filter(
      (c) => Object.keys(parseSpawnCondition(c.condition)?.params ?? {}).length > 0,
    );
    expect(withOperands.length, 'conditions carrying operands').toBeGreaterThan(0);
  });

  it('the export compiles them (C1 behaviour, re-pinned here)', () => {
    const exportedConditions = pack.zones
      .flatMap((z) => z.exits ?? [])
      .map((e) => e.condition)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);
    expect(exportedConditions.length).toBe(authoredConditions.length);
    for (const c of exportedConditions) {
      // A kind, not a raw grammar string.
      expect(c.type).not.toContain(':');
    }
  });
});

describe('C3/P1 — round-trip: authored → exported → imported', () => {
  const { zones: reimported, fidelity } = importZones(pack.zones);
  const byId = new Map(reimported.map((z) => [z.id, z]));

  it('every authored condition comes back BYTE-IDENTICAL', () => {
    for (const authored of authoredConditions) {
      const zone = byId.get(authored.zoneId);
      expect(zone, `zone ${authored.zoneId} must re-import`).toBeDefined();
      const exit = zone!.exits.find((e) => e.targetZoneId === authored.targetZoneId);
      expect(exit, `exit ${authored.zoneId}->${authored.targetZoneId}`).toBeDefined();
      expect(
        exit!.condition,
        `round-trip lost or altered "${authored.condition}"`,
      ).toBe(authored.condition);
    }
  });

  it('every re-imported condition is VALID authored grammar', () => {
    // The claim that actually failed before the repair: not merely "a string
    // came back" but "a string an author could have typed and validateProject
    // would accept". `"has-item"` satisfied the first and failed the second.
    for (const zone of reimported) {
      for (const exit of zone.exits) {
        if (exit.condition === undefined) continue;
        expect(
          validateSpawnCondition(exit.condition),
          `re-imported condition "${exit.condition}" is not valid grammar`,
        ).toBeNull();
      }
    }
  });

  it('no condition-related fidelity loss is reported on a fully-expressible pack', () => {
    // The complement of the assertion above: silence here means the importer
    // did not quietly downgrade anything. A pack whose conditions ARE all
    // expressible must produce zero condition warnings.
    const conditionEntries = fidelity.filter(
      (e) => e.reason === 'condition-not-expressible-in-grammar',
    );
    expect(conditionEntries).toEqual([]);
  });
});

describe('C3/P1 — RED: the pre-repair importer shape is caught', () => {
  it('reading ConditionSpec.type alone produces conditions the validator REJECTS', () => {
    // The old line, executed. This is the defect stated as a test so a future
    // "simplification" back to `e.condition?.type` fails here rather than in a
    // player's project file.
    const naive = pack.zones.flatMap((z) =>
      (z.exits ?? []).map((e) => e.condition?.type),
    );
    const operandBearing = naive.filter(
      (t): t is string => typeof t === 'string' && parseSpawnCondition(t) === null,
    );
    expect(
      operandBearing.length,
      'the naive inverse must produce at least one INVALID condition, or this control proves nothing',
    ).toBeGreaterThan(0);
    for (const t of operandBearing) {
      expect(validateSpawnCondition(t)).not.toBeNull();
    }
  });

  it('an inexpressible ConditionSpec is dropped WITH a fidelity entry, not passed through', () => {
    // A spec the grammar cannot express (an engine-side condition kind with no
    // authored form) must not become an invalid string. Doctored, because the
    // exporter cannot currently produce one — and that is the point: the guard
    // exists for the pack that arrives from somewhere else.
    const doctored = structuredClone(pack.zones);
    const target = doctored.find((z) => (z.exits ?? []).some((e) => e.condition !== undefined))!;
    const exit = target.exits!.find((e) => e.condition !== undefined)!;
    exit.condition = { type: 'engine-only-predicate', params: {} };

    const { zones, fidelity } = importZones(doctored);
    const roundTripped = zones
      .find((z) => z.id === target.id)!
      .exits.find((e) => e.targetZoneId === exit.targetZoneId)!;

    expect(roundTripped.condition).toBeUndefined();
    expect(
      fidelity.some((e) => e.reason === 'condition-not-expressible-in-grammar'),
      'dropping a condition must be reported, never silent',
    ).toBe(true);
  });
});
