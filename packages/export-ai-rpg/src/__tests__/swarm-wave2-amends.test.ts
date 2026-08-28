// swarm-wave2-amends.test.ts — Stage-A AMEND wave (wave 2) fixes for export-ai-rpg.
//
// One describe block per approved finding. See
// E:\AI\testing-os\swarms\swarm-1785831762-2a42\wave-2\export-engine.md for
// the full finding text this wave fixes.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertPackMeta } from '../convert-pack.js';
import { convertEntities } from '../convert-entities.js';
import { convertItems } from '../convert-items.js';
import { convertDistricts } from '../convert-districts.js';
import { importZones } from '../import-zones.js';
import { importFromContentPack } from '../import.js';
import type { ImportResult, ImportError } from '../import.js';

function requireImport(r: ImportResult | ImportError): ImportResult {
  if (!r.success) throw new Error(r.message);
  return r;
}
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';
import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from '../fidelity.js';
import type { ContentPack } from '../export.js';

afterEach(() => {
  vi.restoreAllMocks();
});

// --- F-3dab95a4: GENRE_MAP/TONE_MAP/DIFFICULTY_MAP prototype-pollution guard ---

describe('F-3dab95a4: prototype-key lookups on GENRE_MAP/TONE_MAP/DIFFICULTY_MAP are guarded', () => {
  it('project.genre = "__proto__" falls back to fantasy, not Object.prototype', () => {
    const project: WorldProject = { ...minimalProject, genre: '__proto__' };
    const warnings: string[] = [];
    const meta = convertPackMeta(project, warnings);
    expect(meta.genres).toEqual(['fantasy']);
    // The old bug: JSON.stringify(Object.prototype) is `{}`, so this is the
    // exact shape that used to leak through silently.
    expect(JSON.stringify(meta.genres)).not.toBe('[{}]');
  });

  it('project.genre = "constructor" falls back to fantasy, not the Object constructor', () => {
    const project: WorldProject = { ...minimalProject, genre: 'constructor' };
    const meta = convertPackMeta(project);
    expect(meta.genres).toEqual(['fantasy']);
  });

  it('tones: ["__proto__", "grim"] reports BOTH as unrecognized, not just "grim"', () => {
    const project: WorldProject = { ...minimalProject, tones: ['__proto__', 'grim'] };
    const warnings: string[] = [];
    const meta = convertPackMeta(project, warnings);
    const joined = warnings.join('\n');
    expect(joined).toContain('grim');
    expect(joined).toContain('__proto__');
    // Neither prototype value nor a non-string leaked into the mapped tones.
    for (const t of meta.tones) expect(typeof t).toBe('string');
  });

  it('project.difficulty = "toString" falls back to intermediate, not Object.prototype.toString', () => {
    const project: WorldProject = { ...minimalProject, difficulty: 'toString' };
    const meta = convertPackMeta(project);
    expect(meta.difficulty).toBe('intermediate');
  });

  it('a legitimate unmapped genre falls back to fantasy AND warns (F-0fdda22c)', () => {
    // F-0fdda22c: the prototype guard must not be the thing that invents a
    // warning, but unmapped genres are no longer silent — they name the
    // authored value and the fallback, matching the tone channel.
    const project: WorldProject = { ...minimalProject, genre: 'not-a-real-genre' };
    const warnings: string[] = [];
    const meta = convertPackMeta(project, warnings);
    expect(meta.genres).toEqual(['fantasy']);
    expect(warnings.join('\n')).toContain('not-a-real-genre');
    expect(warnings.join('\n')).toContain('fantasy');
  });
});

// --- crash finding: unrecognized entity role must not throw (unguarded spread) ---

describe('unrecognized entity role no longer crashes the export (unguarded array spread)', () => {
  it('convertEntities does not throw when role is a value outside the EntityRole union', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [
        { entityId: 'npc-x', zoneId: 'zone-entrance', role: 'villager' as never, name: 'Villager' },
      ],
    };
    expect(() => convertEntities(project)).not.toThrow();
  });

  it('an unrecognized role falls back to npc-shaped defaults with a warning, not Object.prototype tags', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [
        { entityId: 'npc-x', zoneId: 'zone-entrance', role: '__proto__' as never, name: 'Villager' },
      ],
    };
    const warnings: string[] = [];
    const entities = convertEntities(project, undefined, warnings);
    expect(entities[0].type).toBe('npc');
    expect(Array.isArray(entities[0].tags)).toBe(true);
    expect(warnings.some((w) => w.includes('__proto__'))).toBe(true);
  });

  it('exportToEngine fail-closes on an unrecognized role (schema runtime guard) instead of throwing', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [
        { entityId: 'npc-x', zoneId: 'zone-entrance', role: 'villager' as never, name: 'Villager' },
      ],
    };
    expect(() => exportToEngine(project)).not.toThrow();
    const result = exportToEngine(project);
    expect(result.success).toBe(false);
  });

  it('recognized roles are completely unaffected by the guard', () => {
    const entities = convertEntities(chapelProject);
    const boss = entities.find((e) => e.id === 'ash-ghoul')!;
    expect(boss.type).toBe('enemy');
    expect(boss.tags).toContain('boss');
  });
});

// --- F-1c1a6e56: convertItems slot fallback gets a reporting channel ---

describe('F-1c1a6e56: convertItems reports the slot/rarity fallback instead of staying silent', () => {
  it('a legal authored "consumable" slot still narrows to trinket (no engine-side target) but now WARNS', () => {
    const project: WorldProject = {
      ...minimalProject,
      itemPlacements: [
        { itemId: 'item-potion', name: 'Potion', zoneId: 'zone-entrance', hidden: false, slot: 'consumable' },
      ],
    };
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const items = convertItems(project, warnings, fidelity);
    expect(items[0].slot).toBe('trinket');
    expect(warnings.some((w) => w.includes('consumable'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'item-slot-no-engine-target')).toBe(true);
  });

  it('is backward-compatible when no warnings/fidelity arrays are provided', () => {
    const project: WorldProject = {
      ...minimalProject,
      itemPlacements: [
        { itemId: 'item-potion', name: 'Potion', zoneId: 'zone-entrance', hidden: false, slot: 'consumable' },
      ],
    };
    expect(() => convertItems(project)).not.toThrow();
  });

  it('a recognized slot (weapon) produces no warning and no fidelity entry', () => {
    const project: WorldProject = {
      ...minimalProject,
      itemPlacements: [
        { itemId: 'item-sword', name: 'Sword', zoneId: 'zone-entrance', hidden: false, slot: 'weapon' },
      ],
    };
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const items = convertItems(project, warnings, fidelity);
    expect(items[0].slot).toBe('weapon');
    expect(warnings).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });

  it('exportToEngine threads the warning through to ExportResult.warnings', () => {
    const project: WorldProject = {
      ...minimalProject,
      // Append rather than replace — minimalProject.playerTemplate.startingInventory
      // references 'item-torch', so dropping it would fail validateProject for an
      // unrelated reason before convertItems ever runs.
      itemPlacements: [
        ...minimalProject.itemPlacements,
        { itemId: 'item-potion', name: 'Potion', zoneId: 'zone-entrance', hidden: false, slot: 'consumable' },
      ],
    };
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('consumable'))).toBe(true);
    expect(result.fidelity.entries.some((f) => f.reason === 'item-slot-no-engine-target')).toBe(true);
  });
});

// --- F-6cd32f2d: safety -> surveillance mapping escalated to a warning ---

describe('F-6cd32f2d: district safety->surveillance mapping is escalated from silent comment to warning', () => {
  it('convertDistricts warns that safety is being reassigned to surveillance', () => {
    const warnings: string[] = [];
    const districts = convertDistricts(minimalProject, warnings);
    // Value mapping itself is UNCHANGED — only the reporting channel is new.
    expect(districts[0].baseMetrics?.surveillance).toBe(60);
    expect(warnings.some((w) => w.includes('safety') && w.includes('surveillance'))).toBe(true);
  });

  it('is backward-compatible when no warnings array is provided', () => {
    expect(() => convertDistricts(minimalProject)).not.toThrow();
  });

  it('no warning when the project has no districts', () => {
    const project: WorldProject = { ...minimalProject, districts: [] };
    const warnings: string[] = [];
    convertDistricts(project, warnings);
    expect(warnings.some((w) => w.includes('surveillance'))).toBe(false);
  });

  it('exportToEngine surfaces the district warning in ExportResult.warnings', () => {
    const result = exportToEngine(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('safety') && w.includes('surveillance'))).toBe(true);
  });
});

// --- F-9f90a607: zones[].hazardRefs and zones[].scene are read on import ---

describe('F-9f90a607: importZones restores hazardRefs and scene.timeOfDay', () => {
  it('round-trips hazardRefs unchanged through export -> import', () => {
    const project: WorldProject = {
      ...minimalProject,
      hazardDefinitions: [
        { id: 'hz-spikes', name: 'Spikes', trigger: 'on-enter', effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-start' }], passable: 'yes', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, hazardRefs: ['hz-spikes'] } : z)),
    };
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    expect(exported.contentPack.zones[0].hazardRefs).toEqual(['hz-spikes']);
    const { zones } = importZones(exported.contentPack.zones);
    expect(zones[0].hazardRefs).toEqual(['hz-spikes']);
  });

  it('round-trips timeOfDay unchanged through export -> import (only channel is scene.timeOfDay)', () => {
    const project: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, timeOfDay: 'dusk' } : z)),
    };
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    expect(exported.contentPack.zones[0].scene?.timeOfDay).toBe('dusk');
    const { zones } = importZones(exported.contentPack.zones);
    expect(zones[0].timeOfDay).toBe('dusk');
  });

  it('emits an approximated fidelity entry noting dressingDensity cannot be un-derived', () => {
    const project: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, interactables: [{ name: 'shrine', type: 'inspect' as const }] } : z,
      ),
    };
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    expect(exported.contentPack.zones[0].scene?.dressingDensity).toBeDefined();
    const { fidelity } = importZones(exported.contentPack.zones);
    expect(fidelity.some((f) => f.reason === 'dressing-density-not-derivable')).toBe(true);
  });

  it('a zone with no hazardRefs/scene imports cleanly with no crash', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    expect(() => importZones(exported.contentPack.zones)).not.toThrow();
  });

  it('full round trip via importFromContentPack also restores hazardRefs', () => {
    const project: WorldProject = {
      ...minimalProject,
      hazardDefinitions: [
        { id: 'hz-spikes', name: 'Spikes', trigger: 'on-enter', effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-start' }], passable: 'yes', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, hazardRefs: ['hz-spikes'] } : z)),
    };
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(exported.contentPack));
    const zone = imported.project.zones.find((z) => z.id === project.zones[0].id);
    expect(zone?.hazardRefs).toEqual(['hz-spikes']);
    // F-5442422b: hazardRefs-only is not sufficient — the catalog must survive too,
    // or schema rule 77 treats the restored refs as dangling.
    expect(imported.project.hazardDefinitions).toEqual(project.hazardDefinitions);
  });
});

// --- F-5a257bc8 (headline): ContentPack.placements is read on import ---

describe('F-5a257bc8: entity zone placements round-trip through pack.placements instead of round-robin', () => {
  // Deliberately a DERANGEMENT against round-robin: with zones authored in
  // order [zone-entrance, zone-cellar], round-robin would assign entity index
  // i to zoneIds[i % 2]. Every entity below is placed on the OPPOSITE zone
  // from what round-robin would pick, so a correct fix and the old bug can
  // never agree by coincidence.
  function derangedProject(): WorldProject {
    return {
      ...minimalProject,
      entityPlacements: [
        // index 0 — round-robin would pick zone-entrance. Author: zone-entrance too,
        // so this one is a control (round-robin and truth coincide) —
        // the two below are where the fix actually has to do work.
        { entityId: 'npc-keeper', zoneId: 'zone-entrance', role: 'npc', factionId: 'keepers', dialogueId: 'dlg-keeper' },
        // index 1 — round-robin would pick zone-cellar. Authored: zone-entrance.
        { entityId: 'npc-second', zoneId: 'zone-entrance', role: 'npc', name: 'Second', spawnCondition: 'flag:met-keeper' },
        // index 2 — round-robin would pick zone-entrance. Authored: zone-cellar.
        { entityId: 'npc-third', zoneId: 'zone-cellar', role: 'npc', name: 'Third' },
      ],
    };
  }

  it('ContentPack.placements carries the authored zoneId for every entity (export side, unchanged)', () => {
    const exported = exportToEngine(derangedProject());
    if (!exported.success) throw new Error('export failed');
    const byId = new Map(exported.contentPack.placements.map((p) => [p.entityId, p]));
    expect(byId.get('npc-second')!.zoneId).toBe('zone-entrance');
    expect(byId.get('npc-third')!.zoneId).toBe('zone-cellar');
  });

  it('THE FIX: importFromContentPack restores the authored zoneId, not round-robin', () => {
    const project = derangedProject();
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(exported.contentPack));
    const byId = new Map(imported.project.entityPlacements.map((e) => [e.entityId, e]));
    // These would read 'zone-cellar' / 'zone-entrance' (swapped) under the old
    // round-robin-only behavior — the whole point of the derangement.
    expect(byId.get('npc-second')!.zoneId).toBe('zone-entrance');
    expect(byId.get('npc-third')!.zoneId).toBe('zone-cellar');
    expect(byId.get('npc-keeper')!.zoneId).toBe('zone-entrance');
  });

  it('full export -> import cycle preserves every entity zoneId exactly (round-trip property)', () => {
    const project = derangedProject();
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(exported.contentPack));
    for (const orig of project.entityPlacements) {
      const back = imported.project.entityPlacements.find((e) => e.entityId === orig.entityId);
      expect(back, `entity ${orig.entityId} missing after round trip`).toBeDefined();
      expect(back!.zoneId, `entity ${orig.entityId} zoneId did not survive the round trip`).toBe(orig.zoneId);
    }
  });

  it('spawnCondition round-trips through placements[] via the same compile/decompile codec as zone exits', () => {
    const project = derangedProject();
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    const placement = exported.contentPack.placements.find((p) => p.entityId === 'npc-second')!;
    expect(placement.spawnCondition).toEqual({ type: 'has-flag', params: { id: 'met-keeper' } });
    const imported = requireImport(importFromContentPack(exported.contentPack));
    const back = imported.project.entityPlacements.find((e) => e.entityId === 'npc-second');
    expect(back?.spawnCondition).toBe('flag:met-keeper');
  });

  it('the fidelity report marks pack-driven zoneId restoration lossless, not approximated round-robin', () => {
    const project = derangedProject();
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(exported.contentPack));
    const roundRobin = imported.fidelityReport.entries.filter((e) => e.reason === 'zone-placement-round-robin');
    expect(roundRobin).toHaveLength(0);
    const restored = imported.fidelityReport.entries.filter((e) => e.reason === 'zone-placement-from-pack');
    expect(restored.length).toBe(project.entityPlacements.length);
    expect(restored.every((e) => e.level === 'lossless')).toBe(true);
  });

  it('the "reconstructed, original zones unknown" warning does not fire when placements[] covers every entity', () => {
    const exported = exportToEngine(derangedProject());
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(exported.contentPack));
    // Scoped to the ENTITY-placement warning specifically — the unrelated
    // item-placement warning ("Item zone placements reconstructed...") is
    // out of this finding's scope and still fires unconditionally, so a
    // broader regex would false-positive against it.
    expect(imported.warnings.some((w) => /Entity zone placements reconstructed/i.test(w))).toBe(false);
  });

  it('LEGACY PATH PRESERVED: a pack genuinely lacking placements[] still falls back to round-robin, with the honest warning', () => {
    const exported = exportToEngine(derangedProject());
    if (!exported.success) throw new Error('export failed');
    // Simulate an older / hand-built pack that predates the placements[] channel.
    const legacyPack = { ...exported.contentPack, placements: [] };
    const imported = requireImport(importFromContentPack(legacyPack));
    const roundRobin = imported.fidelityReport.entries.filter((e) => e.reason === 'zone-placement-round-robin');
    expect(roundRobin.length).toBe(legacyPack.entities.length);
    expect(imported.warnings.some((w) => /Entity zone placements reconstructed/i.test(w))).toBe(true);
  });

  it('MIXED PACK: an entity missing from placements[] falls back to round-robin individually, others still restore', () => {
    const exported = exportToEngine(derangedProject());
    if (!exported.success) throw new Error('export failed');
    const partialPack = {
      ...exported.contentPack,
      placements: exported.contentPack.placements.filter((p) => p.entityId !== 'npc-third'),
    };
    const imported = requireImport(importFromContentPack(partialPack));
    const byId = new Map(imported.project.entityPlacements.map((e) => [e.entityId, e]));
    // npc-second still restored correctly from its own placement record.
    expect(byId.get('npc-second')!.zoneId).toBe('zone-entrance');
    // npc-third had no placement record, so it took the (individual) fallback —
    // whatever round-robin computes for it — but the export/import cycle must
    // not crash or silently drop the entity.
    expect(byId.get('npc-third')).toBeDefined();
    const fidelity = imported.fidelityReport.entries;
    expect(fidelity.some((f) => f.entityId === 'npc-third' && f.reason === 'zone-placement-round-robin')).toBe(true);
    expect(fidelity.some((f) => f.entityId === 'npc-second' && f.reason === 'zone-placement-from-pack')).toBe(true);
  });
});

// --- F-ee46a52c: WorldProject.lootTables is exported ---

describe('F-ee46a52c: lootTables cross into the ContentPack instead of being silently dropped', () => {
  const lootTableProject = (): WorldProject => ({
    ...minimalProject,
    itemPlacements: [
      { itemId: 'item-torch', zoneId: 'zone-entrance', hidden: false, container: 'shelf' },
    ],
    lootTables: [
      {
        id: 'loot-x',
        rolls: 2,
        entries: [
          { itemId: 'item-torch', weight: 5, quantity: { min: 1, max: 2 }, condition: 'never', rarity: 'common' },
        ],
        tags: ['test'],
      },
    ],
  });

  it('exportToEngine puts project.lootTables onto ContentPack.lootTables verbatim', () => {
    const project = lootTableProject();
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.lootTables[0].entries[0].condition).toEqual({ type: 'never', params: {} });
    expect(result.contentPack.lootTables[0].id).toBe('loot-x');
  });

  it('ContentPack.lootTables is present as an empty array when the project authors none (unconditional key)', () => {
    const result = exportToEngine(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect((result.contentPack as unknown as { lootTables: unknown[] }).lootTables).toEqual([]);
  });

  it('is present in the debug/prefixed branch too', () => {
    const project = lootTableProject();
    const result = exportToEngine(project, { profile: 'debug', debugTimestamp: '2026-01-01T00:00:00.000Z' });
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.lootTables[0].entries[0].condition).toEqual({ type: 'never', params: {} });
  });

  it('lootTables participates in the content hash (SIM_AFFECTING_KEYS)', () => {
    const withTables = exportToEngine(lootTableProject());
    const without = exportToEngine(minimalProject);
    if (!withTables.success || !without.success) throw new Error('export failed');
    expect(withTables.manifest.contentHash).not.toBe(without.manifest.contentHash);
  });
});

// --- F-5442422b: importFromContentPack restores hazardDefinitions + lootTables ---

describe('F-5442422b: hazardDefinitions and lootTables round-trip through importFromContentPack', () => {
  const catalogProject = (): WorldProject => ({
    ...minimalProject,
    hazardDefinitions: [
      { id: 'hz-spikes', name: 'Spikes', trigger: 'on-enter', effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-start' }], passable: 'yes', tags: [] },
    ],
    zones: minimalProject.zones.map((z, i) => (i === 0 ? { ...z, hazardRefs: ['hz-spikes'] } : z)),
    lootTables: [
      {
        id: 'loot-x',
        rolls: 2,
        entries: [
          { itemId: 'item-torch', weight: 5, quantity: { min: 1, max: 2 }, condition: 'never', rarity: 'common' },
        ],
        tags: ['test'],
      },
    ],
  });

  it('export → import restores BOTH the hazard catalog AND zone.hazardRefs, plus lootTables', () => {
    const project = catalogProject();
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');

    expect(exported.contentPack.hazardDefinitions).toEqual(project.hazardDefinitions);
    expect(exported.contentPack.zones[0].hazardRefs).toEqual(['hz-spikes']);
    expect(exported.contentPack.lootTables[0].entries[0].condition).toEqual({ type: 'never', params: {} });

    const imported = requireImport(importFromContentPack(exported.contentPack));
    expect(imported.project.hazardDefinitions).toEqual(project.hazardDefinitions);
    const zone = imported.project.zones.find((z) => z.id === project.zones[0].id);
    expect(zone?.hazardRefs).toEqual(['hz-spikes']);
    expect(imported.project.lootTables).toEqual(project.lootTables);
    // Catalog restore is what makes the refs valid — rule 77 must not fire.
    expect(imported.warnings.some((w) => /nonexistent hazard/i.test(w))).toBe(false);
  });

  it('CONTROL: a pack omitting hazardDefinitions/lootTables imports them as []', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const omitted = { ...exported.contentPack } as unknown as Record<string, unknown>;
    delete omitted.hazardDefinitions;
    delete omitted.lootTables;
    const omittedPack = omitted as unknown as ContentPack;

    expect('hazardDefinitions' in omittedPack).toBe(false);
    expect('lootTables' in omittedPack).toBe(false);

    const imported = requireImport(importFromContentPack(omittedPack));
    expect(imported.project.hazardDefinitions).toEqual([]);
    expect(imported.project.lootTables).toEqual([]);
  });

  it('sweep: every remaining ContentPack pass-through catalog is restored (omit → [])', () => {
    // The five that wave-4 already restored, plus the two this finding closed.
    const catalogs = [
      'encounterAnchors',
      'factionPresences',
      'pressureHotspots',
      'craftingStations',
      'marketNodes',
      'hazardDefinitions',
      'lootTables',
      'districts',
    ] as const;
    // F-1d5f2ce5: districts and items used to be INCLUDED as [] on this bare
    // pack, so the sweep could not go red when those keys were actually
    // missing. Omit them; importDistricts/importItems must ?? [] rather than throw.
    const bare = {
      entities: [],
      placements: [],
      zones: [],
      dialogues: [],
      progressionTrees: [],
    } as unknown as ContentPack;

    const imported = requireImport(importFromContentPack(bare));
    for (const key of catalogs) {
      expect(imported.project[key], `${key} must default to [] when the pack omits it`).toEqual([]);
    }
    expect(imported.project.itemPlacements, 'items must default to [] when the pack omits it').toEqual([]);
  });
});
