import { describe, it, expect } from 'vitest';
import { exportToUnreal } from '../export.js';
import type { FidelityDomain } from '../fidelity.js';
import {
  ALL_WORLD_PROJECT_FIELDS,
  COVERED_FIELDS,
  KNOWN_DROPPED,
} from '../field-coverage.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';

/**
 * Parity contract between the Unreal exporter and the WorldProject schema.
 *
 * These tests are the canonical "what survives an Unreal export?" list. When a
 * WorldProject field gains a new home in UnrealContentPack, update the covered
 * set. When a field is intentionally dropped, add it to `KNOWN_DROPPED` with a
 * reason — a fidelity entry then exists for it on export (see
 * `collectDroppedFieldFidelity` in field-coverage.ts), enforced below.
 *
 * F-e2908aac: ALL_WORLD_PROJECT_FIELDS / COVERED_FIELDS / KNOWN_DROPPED used to
 * be hand-maintained directly in this file — a copy of the real WorldProject
 * type that was never checked against it, and drifted (six v4.5 fields were
 * invisible to every test below AND to the fidelity report). They are now
 * imported from '../field-coverage.js', a production module whose backing
 * object is typed `{ [K in keyof WorldProject]-?: FieldStatus }`. Adding a
 * WorldProject field without classifying it there is a `tsc --build` failure,
 * not a silent gap — see field-coverage.ts's header comment for the full story.
 */

describe('WorldProject → UnrealContentPack parity', () => {
  it('every canonical WorldProject field is either covered or documented as dropped', () => {
    const uncovered = ALL_WORLD_PROJECT_FIELDS.filter(
      (f) => !COVERED_FIELDS.has(f) && KNOWN_DROPPED[f] === undefined,
    );
    expect(uncovered).toEqual([]);
  });

  it('covered and known-dropped sets are disjoint', () => {
    const both = [...COVERED_FIELDS].filter((f) => KNOWN_DROPPED[f] !== undefined);
    expect(both).toEqual([]);
  });

  it('the minimal fixture does not introduce surprise fields outside the canonical list', () => {
    const canonical = new Set(ALL_WORLD_PROJECT_FIELDS);
    const surprise = Object.keys(minimalProject).filter((f) => !canonical.has(f));
    expect(surprise).toEqual([]);
  });

  it('fidelity report uses only known FidelityDomain values', () => {
    const result = exportToUnreal(minimalProject);
    if (!result.success) throw new Error('export failed');
    const validDomains: FidelityDomain[] = [
      'zones', 'districts', 'entities', 'items',
      'connections', 'world-partition', 'assets', 'parallax',
      'elevation', 'skyline', 'dialogues', 'world',
      'lighting', 'collision', 'physics', 'transitions',
    ];
    const domainSet = new Set<string>(validDomains);
    for (const entry of result.fidelity.entries) {
      expect(domainSet.has(entry.domain)).toBe(true);
    }
  });

  // F-e2908aac: the six fields that actually drifted (schema comments them
  // "Additive since v4.5") — named explicitly, not just covered generically by
  // the "every field classified" check above. If someone deletes one of these
  // six entries from field-coverage.ts's KNOWN_DROPPED/COVERED_FIELDS without
  // also removing it from FIELD_COVERAGE, the exhaustiveness assertion in
  // field-coverage.ts fails tsc first — but this test documents intent in a
  // human-readable, IDE-visible way and fails immediately under plain
  // `vitest run` (no build step needed) if the classification regresses.
  it('F-e2908aac: the six previously-drifted v4.5 fields are now classified', () => {
    const previouslyDrifted = [
      'buildings', 'hubs', 'strongholds',
      'strata', 'stratumLinks', 'hazardDefinitions',
    ];
    for (const field of previouslyDrifted) {
      const covered = COVERED_FIELDS.has(field);
      const dropped = KNOWN_DROPPED[field] !== undefined;
      expect(ALL_WORLD_PROJECT_FIELDS).toContain(field);
      expect(covered || dropped).toBe(true);
      expect(covered && dropped).toBe(false);
    }
    // Honesty check: no Unreal converter exists for any of these six yet
    // (see field-coverage.ts's comment block), so today they must all be
    // KNOWN_DROPPED, not COVERED_FIELDS. This is the "do not mark them
    // covered to make the test green" guardrail — if a real converter lands,
    // update this test alongside field-coverage.ts, don't just flip the flag.
    for (const field of previouslyDrifted) {
      expect(COVERED_FIELDS.has(field)).toBe(false);
      expect(typeof KNOWN_DROPPED[field]).toBe('string');
      expect(KNOWN_DROPPED[field].length).toBeGreaterThan(0);
    }
  });

  it('F-e2908aac: fidelity report says "dropped" for authored v4.5 fields instead of staying silent', () => {
    // Before collectDroppedFieldFidelity existed, NONE of these fields ever
    // produced a fidelity entry — the export pipeline had no code path that
    // even looked at them. This project authors all six; every one must now
    // show up as a `dropped` entry naming the field in `fieldPath`.
    const project: WorldProject = {
      ...minimalProject,
      buildings: [
        { id: 'bld-mill', name: 'Old Mill', buildingType: 'mill', gridX: 1, gridY: 1, width: 2, height: 2, tags: [] },
      ],
      hubs: [
        {
          id: 'hub-market', name: 'Market Square', zoneId: 'zone-entrance', hubType: 'market-square',
          serviceTypes: ['market'], connectedZoneIds: ['zone-cellar'], tags: [],
        },
      ],
      strongholds: [
        { id: 'str-keep', name: 'The Keep', zoneId: 'zone-entrance', defenseLevel: 3, garrisonEntityIds: [], tags: [] },
      ],
      strata: [
        { id: 'strat-surface', name: 'Surface', order: 0, tags: [] },
        { id: 'strat-cellar', name: 'Cellar Level', order: -1, tags: [] },
      ],
      stratumLinks: [
        { id: 'link-stairs', fromStratumId: 'strat-surface', toStratumId: 'strat-cellar', bidirectional: true, linkType: 'stairs' },
      ],
      hazardDefinitions: [
        { id: 'hz-gas', name: 'Poison Gas', effects: [{ kind: 'instakill' }], trigger: 'on-enter', tags: [] },
      ],
    };

    const result = exportToUnreal(project);
    expect(result.success).toBe(true);
    if (!result.success) return;

    for (const field of ['buildings', 'hubs', 'strongholds', 'strata', 'stratumLinks', 'hazardDefinitions']) {
      const entry = result.fidelity.entries.find((e) => e.level === 'dropped' && e.fieldPath === field);
      expect(entry, `expected a dropped fidelity entry for "${field}"`).toBeDefined();
      expect(entry?.reason.length).toBeGreaterThan(0);
    }

    // The report must not be able to claim 100% lossless while these six
    // authored-but-unmapped fields are silently missing from the entries list.
    expect(result.fidelity.summary.dropped).toBeGreaterThanOrEqual(6);
    expect(result.fidelity.summary.losslessPercent).toBeLessThan(100);
  });

  it('F-e2908aac: a project that never touches the v4.5 fields gets no spurious dropped entries for them', () => {
    // Fields that are genuinely empty/undefined authored nothing to lose —
    // collectDroppedFieldFidelity must stay silent for them, the same way it
    // was silent before (just now for an honest reason instead of a code gap).
    const result = exportToUnreal(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const field of ['buildings', 'hubs', 'strongholds', 'strata', 'stratumLinks', 'hazardDefinitions']) {
      const entry = result.fidelity.entries.find((e) => e.fieldPath === field);
      expect(entry).toBeUndefined();
    }
  });
});
