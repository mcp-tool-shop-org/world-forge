// c0-export-table.test.ts — P1 of the C0 Forge↔Engine alignment audit.
//
// Runs the export truth table against a live export and writes the
// machine-readable artifact. Three layers of check, in increasing strength:
//
//   1. COMPLETENESS — every authored leaf path has exactly one row, and every
//      row names a real authored path. No field can be quietly skipped.
//   2. PER-ROW VERIFICATION — every declared classification is confirmed
//      against the actual export (see export-differ.ts for what each proof
//      shape can and cannot show).
//   3. NAMED-TRANSFORM ASSERTIONS — the rows the differ can only shallow-check
//      (because their transform is prose) get bespoke assertions here.
//
// Plus the P1 negative control: a doctored pack with a known-carried field
// removed MUST be flagged. Proven to fail once, in this commit.

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCHEMA_VERSION } from '@world-forge/schema';
import { vocabularyCoverageProject as project } from './fixtures/vocabulary-coverage.js';
import { collectLeafPaths, resolvePath } from './c0/leaf-paths.js';
import {
  artifactsOf,
  allExportKeyNames,
  allExportLeafValues,
  buildArtifact,
  expandTable,
  exportFixture,
  renderMarkdown,
  scopedKeyNames,
  verifyRow,
  verifyTable,
} from './c0/export-differ.js';
import type { CarriedRow } from './c0/export-table-data.js';

const result = exportFixture(project);
const artifacts = artifactsOf(result);
const pack = result.contentPack;

describe('C0/P1 — completeness: one classified row per authored field', () => {
  it('every authored leaf path has exactly one row', () => {
    const authored = collectLeafPaths(project);
    const rows = expandTable(project);
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.path, (counts.get(r.path) ?? 0) + 1);

    const missing = [...authored].filter((p) => !counts.has(p)).sort();
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1).map(([p]) => p).sort();

    expect(missing, 'authored fields with no row').toEqual([]);
    expect(duplicated, 'fields classified more than once').toEqual([]);
  });

  it('every row names a path that actually exists in the fixture', () => {
    const authored = collectLeafPaths(project);
    const phantom = expandTable(project).map((r) => r.path).filter((p) => !authored.has(p)).sort();
    expect(phantom, 'rows describing fields the fixture does not author').toEqual([]);
  });
});

describe('C0/P1 — per-row verification against the live export', () => {
  it('every declared classification holds', () => {
    const failures = verifyTable(project, result)
      .filter((v) => !v.ok)
      .map((v) => `${v.row.path} [${v.row.class}] — ${v.evidence}`);
    expect(failures).toEqual([]);
  });
});

describe('C0/P1 — the named transforms, asserted individually', () => {
  it('zone description: a plain string becomes a one-element TextBlock array', () => {
    const authored = project.zones[0].description;
    const exported = pack.zones[0].description;
    expect(Array.isArray(exported)).toBe(true);
    expect(exported).toEqual([{ text: authored }]);
    // …while dialogue node text stays a bare string. The two disagree.
    expect(typeof Object.values(pack.dialogues[0].nodes)[0].text).toBe('string');
  });

  it('CLOSED BY C1/P2: zone exits COMPILE through parseSpawnCondition', () => {
    // ⚠ FLIPPED BY C1/P2 (the pinned-test rule). C0 asserted the garble: the
    // whole grammar string went into `type` — a field meant to NAME a condition
    // kind — with `params: {}`, so `"item:rope"` exported as
    // `{ type: "item:rope", params: {} }`. Structurally valid, meaning nothing.
    // The repo's own parser would have produced the right shape all along and
    // was never called. It is called now.
    const authoredExit = project.zones[0].exits[0];
    const exportedExit = pack.zones[0].exits![0];
    expect(authoredExit.condition).toBe('item:rope');
    expect(exportedExit.condition).toEqual({ type: 'has-item', params: { id: 'rope' } });
    // The operands live in params, where a consumer can read them, and `type`
    // names a kind from the closed grammar — the C0 row's exact complaint.
    expect(exportedExit.condition!.type).toBe('has-item');
    expect(Object.keys(exportedExit.condition!.params ?? {})).toEqual(['id']);
  });

  it('C1/P2: an operand-bearing condition round-trips its operands too', () => {
    // `item:rope` alone would pass with a parser that only handled one form.
    // The fixture's other exits carry a comparator condition and a bare one.
    const conditions = pack.zones
      .flatMap((z) => z.exits ?? [])
      .map((e) => e.condition)
      .filter((c): c is NonNullable<typeof c> => c !== undefined);

    // Every exported condition names a grammar KIND, never a raw source string.
    for (const c of conditions) {
      expect(c.type, `"${c.type}" should be a condition kind, not a grammar string`).not.toContain(':');
    }
    // …and at least one carries real parsed operands.
    expect(conditions.some((c) => Object.keys(c.params ?? {}).length > 0)).toBe(true);
  });

  it('zone interactables: objects collapse to a bare name string, losing type + description', () => {
    const authored = project.zones[0].interactables;
    const exported = pack.zones[0].interactables;
    expect(authored[0]).toMatchObject({ name: 'notice board', type: 'inspect' });
    expect(exported).toEqual(authored.map((i) => i.name));
    expect(exported!.every((v) => typeof v === 'string')).toBe(true);
  });

  it('district safety is assigned to engine surveillance — value crosses, meaning does not', () => {
    for (const [i, d] of project.districts.entries()) {
      expect(pack.districts[i].baseMetrics!.surveillance).toBe(d.baseMetrics.safety);
    }
    // And nothing in the pack carries the authored name.
    expect(allExportKeyNames(artifacts).has('safety')).toBe(false);
  });

  it('entity role collapses six authored roles into two engine types', () => {
    const roles = project.entityPlacements.map((e) => e.role);
    expect(roles).toEqual(['merchant', 'boss', 'companion']);
    expect(pack.entities.map((e) => e.type)).toEqual(['npc', 'enemy', 'npc']);
    // merchant and companion are indistinguishable by `type`; only tags separate them.
    expect(pack.entities[0].tags).toContain('merchant');
    expect(pack.entities[2].tags).toContain('companion');
  });

  it('entity faction becomes a string tag, not a typed reference', () => {
    expect(pack.entities[0].tags).toContain('faction:tidewardens');
    // No `factionId` key on the blueprint. Scoped deliberately: the key DOES
    // exist elsewhere in the pack, on the raw-pass-through factionPresences.
    expect(scopedKeyNames(artifacts, [{ channel: 'contentPack', packPath: 'entities[]' }]).has('factionId')).toBe(false);
    expect(allExportKeyNames(artifacts).has('factionId')).toBe(true);
  });

  it('entity tags are a superset: authored ∪ ROLE_TAGS ∪ faction tag', () => {
    const authored = new Set(project.entityPlacements[1].tags ?? []);
    const exported = pack.entities[1].tags ?? [];
    for (const t of authored) expect(exported).toContain(t);
    // ROLE_TAGS['boss'] adds these; an importer cannot tell them from authored tags.
    expect(exported).toEqual(expect.arrayContaining(['hostile', 'elite']));
    expect(authored.has('hostile')).toBe(false);
    expect(authored.has('elite')).toBe(false);
  });

  it('item slot: a legal authored `consumable` narrows to `trinket` (no engine-side target) but is now REPORTED, not silent', () => {
    // ⚠ FLIPPED BY swarm wave-2 (F-1c1a6e56, the pinned-test rule). C0 pinned
    // the SILENCE as expected output: no warning, `result.fidelity.entries`
    // required to be exactly empty. The value still narrows to 'trinket' —
    // the engine's EquipmentSlot set genuinely has no consumable-equivalent
    // slot (confirmed against @ai-rpg-engine/equipment's published type) — but
    // convertItems now has the same warnings/fidelity reporting channel every
    // sibling converter already had, so the loss is no longer invisible.
    const ration = project.itemPlacements.find((i) => i.itemId === 'item-tide-ration')!;
    expect(ration.slot).toBe('consumable');
    const exported = pack.items.find((i) => i.id === 'item-tide-ration')!;
    expect(exported.slot).toBe('trinket');
    expect(result.warnings.join('\n')).toContain('consumable');
    const entry = result.fidelity.entries.find((f) => f.reason === 'item-slot-no-engine-target');
    expect(entry).toBeDefined();
    expect(entry!.level).toBe('approximated');
    expect(entry!.entityId).toBe('item-tide-ration');
  });

  it('item container survives ONLY when description is unset', () => {
    const withDesc = pack.items.find((i) => i.id === 'item-rope')!;
    const withoutDesc = pack.items.find((i) => i.id === 'item-tide-ration')!;
    expect(withDesc.description).toBe('Forty feet, tarred against the wet.');
    expect(withDesc.description).not.toContain('stall crate'); // container lost from catalog description
    expect(withoutDesc.description).toBe('Found in gantry locker'); // container folded in
    // F-42772fc9: the placement channel carries container regardless.
    expect(pack.itemPlacements.find((p) => p.itemId === 'item-rope')?.container).toBe('stall crate');
  });

  it('item hidden re-encodes as the economic flag `contraband`, and only when true', () => {
    const hidden = pack.items.find((i) => i.id === 'item-lantern')!;
    const visible = pack.items.find((i) => i.id === 'item-rope')!;
    expect((hidden as { provenance?: { flags?: string[] } }).provenance?.flags).toEqual(['contraband']);
    expect((visible as { provenance?: unknown }).provenance).toBeUndefined();
    // F-42772fc9: the placement channel now carries the boolean too.
    expect(pack.itemPlacements.find((p) => p.itemId === 'item-lantern')?.hidden).toBe(true);
    expect(pack.itemPlacements.find((p) => p.itemId === 'item-rope')?.hidden).toBe(false);
  });

  it('authoring mode is encoded as a `mode:` tag prefix, not a field', () => {
    expect(project.mode).toBe('district');
    expect(result.packMeta.tags).toContain('mode:district');
    // The bare value never appears as a leaf — a value-only matcher calls this dropped.
    expect(allExportLeafValues(artifacts).has('district')).toBe(false);
  });

  it('landmark ids survive on ContentPack.landmarks and as asset-binding map keys', () => {
    expect(Object.keys(result.assetBindings!.landmarks!).sort()).toEqual(
      project.landmarks.map((l) => l.id).sort(),
    );
    expect(pack.landmarks.map((l) => l.id).sort()).toEqual(
      project.landmarks.map((l) => l.id).sort(),
    );
    expect(JSON.stringify(pack)).toContain('lm-tide-stone');
  });
});

describe('C0/P1 — the negative control (proven to fail once, in this commit)', () => {
  const carriedRow = expandTable(project).find(
    (r): r is CarriedRow => r.path === 'zones[].name',
  )!;

  it('control passes on the real export', () => {
    const v = verifyRow(carriedRow, project, artifacts);
    expect(v.ok).toBe(true);
  });

  it('RED: the differ flags a doctored pack with a known-carried field deleted', () => {
    const doctored = structuredClone(artifacts);
    for (const z of (doctored.contentPack as { zones: Record<string, unknown>[] }).zones) {
      delete z.name;
    }
    const v = verifyRow(carriedRow, project, doctored);
    expect(v.ok).toBe(false);
    expect(v.evidence).toContain('resolves to NOTHING');
  });

  it('RED: the differ flags a doctored pack with a known-carried field CHANGED', () => {
    // Deletion is the easy case. A silent value corruption is the one a
    // presence-only check would wave through.
    const doctored = structuredClone(artifacts);
    (doctored.contentPack as { zones: { name: string }[] }).zones[0].name = 'Wrong Name';
    const v = verifyRow(carriedRow, project, doctored);
    expect(v.ok).toBe(false);
    expect(v.evidence).toContain('!=');
  });

  it('RED: the differ flags a no-channel row whose field STARTS being carried', () => {
    const droppedRow = expandTable(project).find((r) => r.path === 'zones[].elevation')!;
    const doctored = structuredClone(artifacts);
    for (const z of (doctored.contentPack as { zones: Record<string, unknown>[] }).zones) {
      z.elevation = 0;
    }
    const v = verifyRow(droppedRow, project, doctored);
    expect(v.ok).toBe(false);
    expect(v.evidence).toContain('IS present');
  });

  it('RED: a value-absent proof is rejected as VACUOUS when no strings are authored', () => {
    // The failure mode that made five of v3.6's validators worthless: a proof
    // that cannot fail because it has nothing to look at.
    const bogus = {
      path: 'zones[].elevation',
      class: 'no-channel' as const,
      absence: { kind: 'value-absent' as const },
      note: 'deliberately wrong proof shape',
    };
    const v = verifyRow(bogus, project, artifacts);
    expect(v.ok).toBe(false);
    expect(v.evidence).toContain('VACUOUS');
  });
});

describe('C0/P1 — the exporter self-report, recorded', () => {
  it('CLOSED BY C1/P2: the null-vs-100%-on-empty lie stays fixed (unit-tested directly in fidelity.test.ts)', () => {
    // ⚠ FLIPPED BY C1/P2, then UPDATED by swarm wave-2. C0 asserted
    // `losslessPercent: 100` and `dropped: 0` on an export that drops 194 of
    // 377 authored fields — a green number computed from zero observations.
    // C1/P2's fix: the honest value for "no observations" is null, with
    // `observed: false` saying why — never a false 100%. That behavior is
    // unconditionally true of `summarizeFidelity([])` and is unit-tested
    // directly (fidelity.test.ts: 'summarize empty → UNMEASURED, not 100%').
    //
    // This fixture specifically is no longer a zero-observation case: swarm
    // wave-2 (F-1c1a6e56) wired convertItems into the export-side fidelity
    // collector — a SECOND converter beside whichever one was "the one"
    // C1/P2 described — and this fixture authors an item with slot:
    // 'consumable', which convertItems now reports losing (see the item-slot
    // test above). So the assertion here shifts from "this fixture measures
    // zero" to "this fixture measures a REAL, non-lying, non-100% number".
    expect(result.fidelity.summary.observed).toBe(true);
    expect(result.fidelity.summary.total).toBeGreaterThan(0);
    expect(result.fidelity.summary.losslessPercent).not.toBeNull();
    expect(result.fidelity.summary.losslessPercent).toBeLessThan(100);

    // The finding underneath is UNCHANGED and still measured: the export
    // still drops most of the authored vocabulary — wiring one more
    // converter's SLOT/RARITY fallback into the collector does not touch the
    // hundreds of still-no-channel fields. Wiring every remaining converter
    // is still NOT done here (still a C3-sized pass); the remaining gap is
    // recorded rather than quietly widened.
    const noChannel = expandTable(project).filter((r) => r.class === 'no-channel').length;
    expect(noChannel).toBeGreaterThan(50);
  });
});

describe('C0/P1 — the machine-readable artifact', () => {
  it('writes docs/c0-alignment/export-table.json deterministically', () => {
    // ⚠ `engineDepVersions` below is a FROZEN C0 STAMP, not a live reading, and
    // the 2026-07-29 dependency errand deliberately did NOT update it. It
    // records what was installed when the C0 audit ran, next to the
    // `forgeCommit` that ran it; bumping the versions while leaving the commit
    // would make the artifact claim the C0 audit was performed against 3.8.0
    // deps, which it was not. A dated record stays dated.
    //
    // Current dependency truth is asserted live in `engine-deps-3x.test.ts`
    // (declared ranges AND resolved versions) and described in
    // `src/ENGINE_CONTRACT.md`. Do not read this artifact for it.
    const artifact = buildArtifact(project, result, {
      schemaVersion: SCHEMA_VERSION,
      forgeCommit: 'feat/c0-alignment-audit',
      engineDepVersions: {
        '@ai-rpg-engine/content-schema': '2.0.1',
        '@ai-rpg-engine/core': '2.0.1',
        '@ai-rpg-engine/modules': '2.1.0',
        '@ai-rpg-engine/pack-registry': '2.0.2',
        '@ai-rpg-engine/equipment': '2.0.2',
        '@ai-rpg-engine/character-creation': '2.0.2',
      },
    });

    // Byte-identical across two builds — the artifact is a committed file.
    const again = buildArtifact(project, exportFixture(project), {
      schemaVersion: SCHEMA_VERSION,
      forgeCommit: 'feat/c0-alignment-audit',
      engineDepVersions: {
        '@ai-rpg-engine/content-schema': '2.0.1',
        '@ai-rpg-engine/core': '2.0.1',
        '@ai-rpg-engine/modules': '2.1.0',
        '@ai-rpg-engine/pack-registry': '2.0.2',
        '@ai-rpg-engine/equipment': '2.0.2',
        '@ai-rpg-engine/character-creation': '2.0.2',
      },
    });
    expect(JSON.stringify(artifact)).toBe(JSON.stringify(again));
    expect(artifact.rows.every((r) => r.verified)).toBe(true);

    const outDir = path.resolve(import.meta.dirname, '../../../../docs/c0-alignment');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'export-table.json'), `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
    // The pack itself, byte-for-byte as the lane produces it. The engine-side
    // half of this audit loads THIS file through the real `loadContentFromFile`
    // rather than re-deriving a pack shape from types.
    fs.writeFileSync(
      path.join(outDir, 'fixture-pack.json'),
      `${JSON.stringify(result.contentPack, null, 2)}\n`,
      'utf-8',
    );
    // C1/P2: the MANIFEST too. The exporter has always written manifest.json
    // beside content-pack.json, but only the pack crossed to the engine repo —
    // so the engine-side audit could never see the version and module claims it
    // was supposed to be checking. That is a large part of why nine phantom
    // module ids rode along unnoticed. The engine's live resolution test reads
    // THIS file — `packages/cli/src/c1-gate.test.ts`, the "C1/P2 — the forge
    // export, gated live" block. (Pointer corrected 2026-07-29: it named
    // `c1-forge-manifest.test.ts`, which does not exist.)
    fs.writeFileSync(
      path.join(outDir, 'fixture-manifest.json'),
      `${JSON.stringify(result.manifest, null, 2)}\n`,
      'utf-8',
    );
    fs.writeFileSync(
      path.join(outDir, 'export-table.md'),
      `# C0 — Export truth table (WorldProject → export artifacts)\n\n` +
        `Generated by \`packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts\`. Do not hand-edit.\n\n` +
        `Schema version ${SCHEMA_VERSION}. Tally: ${JSON.stringify(artifact.tally.byClass)}.\n\n` +
        `${renderMarkdown(artifact)}\n`,
      'utf-8',
    );
  });
});
