// c0-fixture-coverage.test.ts — P0 of the C0 Forge↔Engine alignment audit.
//
// The fixture is the audit's measuring stick, so it gets measured first. This
// file proves four things before any truth table is built on top of it:
//
//   1. The fixture is a VALID WorldProject (`validateProject` green) — if the
//      instrument cannot pass the authoring layer's own gate, nothing it
//      reports about the export lane can be trusted.
//   2. The fixture actually COVERS the `project.ts` master list — every field
//      is populated, checked mechanically rather than by eyeballing the file.
//   3. The GREEN control: a known-carried field (`zone.name`) reaches the pack.
//   4. The RED control: a known-dropped field (`zone.entryGate`) does NOT reach
//      the pack, and is *reported dropped* — not merely absent. An instrument
//      that only checks absence would score a typo the same as a finding.
//
// Plus determinism: `exportToEngine` on the fixture is byte-identical across
// two runs, so the whole audit rests on a stable artifact.

import { describe, it, expect } from 'vitest';
import { validateProject } from '@world-forge/schema';
import { exportToEngine } from '../export.js';
import { vocabularyCoverageProject, ALL_SPAWN_CONDITION_OPERANDS } from './fixtures/vocabulary-coverage.js';
import { parseSpawnCondition } from '../../../schema/src/spawn-condition.js';

/**
 * Every key on the `WorldProject` interface (`packages/schema/src/project.ts`),
 * transcribed by hand from the type at the audit's HEAD. Kept as a literal list
 * because TypeScript interfaces have no runtime reflection — if the schema
 * grows a field and this list is not updated, the drift guard below fails,
 * which is the point.
 */
const WORLD_PROJECT_FIELDS = [
  'id', 'name', 'description', 'version',
  'genre', 'tones', 'difficulty', 'narratorTone', 'mode',
  'author', 'license', 'category', 'projectTags',
  'map', 'zones', 'connections', 'districts', 'landmarks',
  'factionPresences', 'pressureHotspots',
  'dialogues',
  'playerTemplate', 'buildCatalog', 'progressionTrees',
  'entityPlacements', 'itemPlacements', 'encounterAnchors',
  'spawnPoints', 'craftingStations', 'marketNodes',
  'buildings', 'hubs', 'strongholds',
  'strata', 'stratumLinks',
  'hazardDefinitions',
  'tilesets', 'tileLayers', 'props', 'propPlacements', 'ambientLayers',
  'assets', 'assetPacks',
  'lootTables', 'transitions',
] as const;

/** Every optional field on the `Zone` interface (`schema/src/spatial.ts`). */
const ZONE_OPTIONAL_FIELDS = [
  'parentDistrictId', 'backgroundId', 'tilesetId',
  'elevation', 'elevationRange', 'stratumId', 'hazardRefs', 'entryGate',
  'parallaxLayers', 'skylineRef',
  'gravityOverride', 'gravityDirection', 'physicsMode',
  'skyAtmosphereRef', 'directionalLightYaw', 'directionalLightPitch',
  'skyLightIntensity', 'timeOfDay', 'collisionType',
] as const;

function exportOrThrow() {
  const result = exportToEngine(vocabularyCoverageProject);
  if (!result.success) {
    throw new Error(`fixture failed to export: ${JSON.stringify(result.errors, null, 2)}`);
  }
  return result;
}

describe('C0/P0 — the vocabulary-coverage fixture is a valid, total instrument', () => {
  it('passes validateProject with zero errors', () => {
    const result = validateProject(vocabularyCoverageProject);
    // Print the errors, not just the count — a bare `toBe(true)` on a fixture
    // this large is unfixable from the failure message alone.
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('populates every field on the WorldProject master list', () => {
    const missing = WORLD_PROJECT_FIELDS.filter(
      (f) => (vocabularyCoverageProject as unknown as Record<string, unknown>)[f] === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('populates every array-valued domain with at least one element', () => {
    const empty: string[] = [];
    for (const f of WORLD_PROJECT_FIELDS) {
      const v = (vocabularyCoverageProject as unknown as Record<string, unknown>)[f];
      if (Array.isArray(v) && v.length === 0) empty.push(f);
    }
    expect(empty).toEqual([]);
  });

  it('populates every optional Zone field at least once across the zone set', () => {
    const seen = new Set<string>();
    for (const z of vocabularyCoverageProject.zones) {
      for (const f of ZONE_OPTIONAL_FIELDS) {
        if ((z as unknown as Record<string, unknown>)[f] !== undefined) seen.add(f);
      }
    }
    const missing = ZONE_OPTIONAL_FIELDS.filter((f) => !seen.has(f));
    expect(missing).toEqual([]);
  });

  it('exercises every SpawnCondition operand family, and each one parses', () => {
    // The declared operand list must actually be legal grammar — otherwise the
    // audit would be measuring what the export lane does with garbage.
    for (const c of ALL_SPAWN_CONDITION_OPERANDS) {
      expect(parseSpawnCondition(c), `operand "${c}" must parse`).not.toBeNull();
    }

    // And every one must appear on some authored condition field in the fixture.
    const authored = new Set<string>();
    for (const z of vocabularyCoverageProject.zones) {
      for (const c of z.entryGate?.conditions ?? []) authored.add(c);
      for (const e of z.exits) if (e.condition) authored.add(e.condition);
    }
    for (const c of vocabularyCoverageProject.connections) if (c.condition) authored.add(c.condition);
    for (const e of vocabularyCoverageProject.entityPlacements) if (e.spawnCondition) authored.add(e.spawnCondition);
    for (const t of vocabularyCoverageProject.lootTables ?? []) {
      for (const entry of t.entries) if (entry.condition) authored.add(entry.condition);
    }

    const operandType = (s: string) => parseSpawnCondition(s)?.type;
    const authoredTypes = new Set([...authored].map(operandType).filter(Boolean));
    const declaredTypes = new Set(ALL_SPAWN_CONDITION_OPERANDS.map(operandType).filter(Boolean));

    const uncovered = [...declaredTypes].filter((t) => !authoredTypes.has(t));
    expect(uncovered).toEqual([]);
  });
});

describe('C0/P0 — the controls (both directions, same commit)', () => {
  it('GREEN control: a known-carried field (zone.name) reaches the exported pack', () => {
    const { contentPack } = exportOrThrow();
    const authoredNames = vocabularyCoverageProject.zones.map((z) => z.name).sort();
    const exportedNames = contentPack.zones.map((z) => z.name).sort();
    expect(exportedNames).toEqual(authoredNames);
  });

  it('CLOSED BY C3/P2: zone.entryGate is CARRIED, and its authored reason survives verbatim', () => {
    // ⚠ FLIPPED BY C3/P2 (the pinned-test rule). This was C0's RED control
    // asserting the gate was absent from the pack under ANY key — reason string,
    // gate-only condition strings, and the `entryGate` key itself. All three
    // assertions are now correctly false: the gate is a real pack field the
    // engine evaluates in traversal-core's move handler.
    //
    // The flip is stated as the POSITIVE claim rather than by deleting the old
    // one, so the record shows what changed and the new behaviour is pinned just
    // as tightly.
    const { contentPack } = exportOrThrow();

    expect(vocabularyCoverageProject.zones.every((z) => z.entryGate !== undefined)).toBe(true);

    const serialized = JSON.stringify(contentPack);
    for (const z of vocabularyCoverageProject.zones) {
      // The authored "show the lock" message crosses VERBATIM — the client has
      // to be told why, so a paraphrase or a truncation would defeat the point.
      expect((z.entryGate!.reason ?? '').length).toBeGreaterThan(0);
      expect(serialized).toContain(z.entryGate!.reason!);
    }

    // Every zone's gate is present, with `mode` intact and a non-empty
    // AND-array. Empty conditions would be vacuously TRUE — the one shape that
    // silently unlocks a zone — so it is asserted against explicitly.
    for (const zone of contentPack.zones) {
      const authored = vocabularyCoverageProject.zones.find((z) => z.id === zone.id)!;
      expect(zone.entryGate, `zone ${zone.id} must carry its gate`).toBeDefined();
      expect(zone.entryGate!.mode).toBe(authored.entryGate!.mode);
      expect(zone.entryGate!.conditions.length).toBeGreaterThan(0);
      expect(zone.entryGate!.conditions.length).toBe(authored.entryGate!.conditions.length);
      // COMPILED, not copied: `type` names a grammar KIND, never a raw string.
      for (const c of zone.entryGate!.conditions) {
        expect(c.type).not.toContain(':');
      }
    }

    // The gate-only grammar strings no longer appear as RAW STRINGS — because
    // they were compiled, not because they were dropped. That distinction is the
    // whole substance of this flip, so it is asserted both ways.
    expect(serialized).not.toContain('class:delver');
    expect(serialized).not.toContain('member:npc-quartermaster');
    const vaultGate = contentPack.zones.find((z) => z.id === 'zone-under-vault')!.entryGate!;
    expect(vaultGate.conditions).toEqual(
      expect.arrayContaining([
        { type: 'party-class', params: { id: 'delver' } },
        { type: 'party-member', params: { id: 'npc-quartermaster' } },
      ]),
    );
  });

  it('RED control is not vacuous: the same probe DETECTS a planted entryGate', () => {
    // Prove the check above can fail. Plant the gate into a pack-shaped object
    // and confirm the probe fires — a control that has only ever passed proves
    // nothing about what it would catch.
    const { contentPack } = exportOrThrow();
    const doctored = JSON.parse(JSON.stringify(contentPack)) as typeof contentPack;
    (doctored.zones[0] as unknown as Record<string, unknown>).entryGate =
      vocabularyCoverageProject.zones[0].entryGate;

    expect(Object.keys(doctored.zones[0])).toContain('entryGate');
    expect(JSON.stringify(doctored)).toContain(
      vocabularyCoverageProject.zones[0].entryGate!.reason!,
    );
  });
});

describe('C0/P0 — determinism survives the instrument', () => {
  it('exportToEngine on the fixture is byte-identical across two runs', () => {
    const a = exportOrThrow();
    const b = exportOrThrow();
    expect(JSON.stringify(a.contentPack)).toBe(JSON.stringify(b.contentPack));
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
    expect(JSON.stringify(a.packMeta)).toBe(JSON.stringify(b.packMeta));
  });

  it('the pinned-timestamp debug profile is byte-identical across two runs', () => {
    const opts = { profile: 'debug' as const, debugTimestamp: '2026-01-01T00:00:00.000Z' };
    const a = exportToEngine(vocabularyCoverageProject, opts);
    const b = exportToEngine(vocabularyCoverageProject, opts);
    expect(a.success && b.success).toBe(true);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
