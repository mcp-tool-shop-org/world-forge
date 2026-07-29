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

  it('zone exits: the whole SpawnCondition string is stuffed into ConditionSpec.type', () => {
    const authoredExit = project.zones[0].exits[0];
    const exportedExit = pack.zones[0].exits![0];
    expect(authoredExit.condition).toBe('item:rope');
    // `type` is meant to NAME a condition kind; here it carries the operands too.
    expect(exportedExit.condition).toEqual({ type: 'item:rope', params: {} });
    // Proof this is garbled rather than merely renamed: the grammar HAS a parser
    // in the same repo that would have produced { type: 'has-item', params: { id } },
    // and the exporter never calls it.
    expect(exportedExit.condition!.type).not.toBe('has-item');
    expect(Object.keys(exportedExit.condition!.params ?? {})).toEqual([]);
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

  it('item slot: a legal authored `consumable` is silently narrowed to `trinket`', () => {
    const ration = project.itemPlacements.find((i) => i.itemId === 'item-tide-ration')!;
    expect(ration.slot).toBe('consumable');
    const exported = pack.items.find((i) => i.id === 'item-tide-ration')!;
    expect(exported.slot).toBe('trinket');
    // Silently: no warning, and no fidelity entry.
    expect(result.warnings.join('\n')).not.toContain('consumable');
    expect(result.fidelity.entries).toEqual([]);
  });

  it('item container survives ONLY when description is unset', () => {
    const withDesc = pack.items.find((i) => i.id === 'item-rope')!;
    const withoutDesc = pack.items.find((i) => i.id === 'item-tide-ration')!;
    expect(withDesc.description).toBe('Forty feet, tarred against the wet.');
    expect(withDesc.description).not.toContain('stall crate'); // container lost
    expect(withoutDesc.description).toBe('Found in gantry locker'); // container folded in
  });

  it('item hidden re-encodes as the economic flag `contraband`, and only when true', () => {
    const hidden = pack.items.find((i) => i.id === 'item-lantern')!;
    const visible = pack.items.find((i) => i.id === 'item-rope')!;
    expect((hidden as { provenance?: { flags?: string[] } }).provenance?.flags).toEqual(['contraband']);
    expect((visible as { provenance?: unknown }).provenance).toBeUndefined();
    expect(allExportKeyNames(artifacts).has('hidden')).toBe(false);
  });

  it('authoring mode is encoded as a `mode:` tag prefix, not a field', () => {
    expect(project.mode).toBe('district');
    expect(result.packMeta.tags).toContain('mode:district');
    // The bare value never appears as a leaf — a value-only matcher calls this dropped.
    expect(allExportLeafValues(artifacts).has('district')).toBe(false);
  });

  it('landmark ids survive only as asset-binding map keys', () => {
    // Binding-map keys are sorted alphabetically for byte-identical output
    // (export.ts:296), so compare as sets, not in authored order.
    expect(Object.keys(result.assetBindings!.landmarks!).sort()).toEqual(
      project.landmarks.map((l) => l.id).sort(),
    );
    // …and nowhere in the ContentPack the engine actually loads.
    expect(JSON.stringify(pack)).not.toContain('lm-tide-stone');
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
  it('reports 100% lossless and zero warnings while dropping most of the vocabulary', () => {
    // Not a bug report against fidelity.ts, whose docstring scopes it to the
    // IMPORT direction — but `ExportResult.fidelity` is surfaced on the EXPORT
    // result, where it reads as an export-fidelity claim. Recorded, not fixed.
    expect(result.fidelity.summary.dropped).toBe(0);
    expect(result.fidelity.summary.losslessPercent).toBe(100);
    expect(result.warnings).toEqual([]);

    const noChannel = expandTable(project).filter((r) => r.class === 'no-channel').length;
    expect(noChannel).toBeGreaterThan(100);
  });
});

describe('C0/P1 — the machine-readable artifact', () => {
  it('writes docs/c0-alignment/export-table.json deterministically', () => {
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
