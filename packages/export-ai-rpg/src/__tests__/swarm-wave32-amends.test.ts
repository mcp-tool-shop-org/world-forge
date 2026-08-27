// swarm-wave32-amends.test.ts — Stage-B AMEND wave (wave 32) fixes for export-ai-rpg.
//
// One describe block per approved finding. See
// E:\AI\testing-os\swarms\swarm-1787820671-c76a\wave-32\export-engine.md

import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertConnections } from '../convert-connections.js';
import { convertSpawnPoints } from '../convert-spawn-points.js';
import { convertItemPlacements } from '../convert-item-placements.js';
import { convertPlacements } from '../convert-placements.js';
import { convertEntities } from '../convert-entities.js';
import { convertDistricts, ENGINE_SUPPLY_CATEGORIES } from '../convert-districts.js';
import { importFromContentPack, importFromExportResult } from '../import.js';
import type { ImportResult, ImportError } from '../import.js';
import { SIM_AFFECTING_KEYS } from '../content-hash.js';
import { parseSpawnCondition } from '@world-forge/schema';
import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { FidelityEntry } from '../fidelity.js';

function requireImport(r: ImportResult | ImportError): ImportResult {
  if (!r.success) throw new Error(r.message);
  return r;
}

function requireExport(project: WorldProject) {
  const result = exportToEngine(project);
  if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
  return result;
}

// --- F-2d93b8d0: convert-connections ---

describe('F-2d93b8d0: typed connections cross instead of neighbors-only', () => {
  const locked: WorldProject = {
    ...minimalProject,
    connections: [
      {
        fromZoneId: 'zone-entrance',
        toZoneId: 'zone-cellar',
        kind: 'secret',
        bidirectional: false,
        label: 'hidden trapdoor',
        condition: 'item:rope',
      },
    ],
  };

  it('ContentPack.connections carries from/to, kind, bidirectional, compiled condition, label', () => {
    const exported = requireExport(locked);
    expect(exported.contentPack.connections).toHaveLength(1);
    const c = exported.contentPack.connections[0];
    expect(c.fromZoneId).toBe('zone-entrance');
    expect(c.toZoneId).toBe('zone-cellar');
    expect(c.kind).toBe('secret');
    expect(c.bidirectional).toBe(false);
    expect(c.label).toBe('hidden trapdoor');
    expect(c.condition).toEqual({ type: 'has-item', params: { id: 'rope' } });
    expect(parseSpawnCondition('item:rope')).toEqual({ type: 'has-item', params: { id: 'rope' } });
  });

  it('unparseable condition warns + fidelity and drops the condition, not the edge', () => {
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const conns = convertConnections({
      ...locked,
      connections: [{
        fromZoneId: 'zone-entrance',
        toZoneId: 'zone-cellar',
        kind: 'door',
        bidirectional: true,
        condition: 'not-a-real-condition',
      }],
    }, warnings, fidelity);
    expect(conns[0].condition).toBeUndefined();
    expect(conns[0].kind).toBe('door');
    expect(warnings.some((w) => w.includes('not-a-real-condition'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'connection-condition-unparseable')).toBe(true);
  });

  it('import restores typed connections instead of synthesizing unlabeled bidirectional pairs', () => {
    const exported = requireExport(locked);
    const imported = requireImport(importFromContentPack(exported.contentPack));
    expect(imported.project.connections).toHaveLength(1);
    const c = imported.project.connections[0];
    expect(c.kind).toBe('secret');
    expect(c.bidirectional).toBe(false);
    expect(c.label).toBe('hidden trapdoor');
    expect(c.condition).toBe('item:rope');
    expect(imported.fidelityReport.entries.some((e) => e.reason === 'connections-from-pack')).toBe(true);
    expect(imported.fidelityReport.entries.some((e) => e.reason === 'connections-reconstructed')).toBe(false);
  });

  it('LEGACY: a pack without connections[] still reconstructs from neighbors', () => {
    const exported = requireExport(minimalProject);
    const { connections: _drop, ...rest } = exported.contentPack;
    const legacy = { ...rest } as typeof exported.contentPack;
    delete (legacy as { connections?: unknown }).connections;
    const imported = requireImport(importFromContentPack(legacy));
    expect(imported.project.connections.length).toBeGreaterThan(0);
    expect(imported.project.connections.every((c) => c.bidirectional === true && c.kind === undefined)).toBe(true);
    expect(imported.fidelityReport.entries.some((e) => e.reason === 'connections-reconstructed')).toBe(true);
  });
});

// --- F-c2cdc36d: EntityPlacement.dialogueId ---

describe('F-c2cdc36d: dialogueId crosses on placements[] and as a dialogue:<id> tag', () => {
  it('placements[].dialogueId and entities[].tags carry the binding', () => {
    const exported = requireExport(minimalProject);
    const keeper = exported.contentPack.placements.find((p) => p.entityId === 'npc-keeper');
    expect(keeper?.dialogueId).toBe('dlg-keeper');
    const bp = exported.contentPack.entities.find((e) => e.id === 'npc-keeper');
    expect(bp?.tags).toContain('dialogue:dlg-keeper');
    expect(exported.fidelity.entries.some((f) => f.reason === 'dialogue-id-as-tag')).toBe(true);
  });

  it('unresolved dialogueId warns', () => {
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [
        { entityId: 'npc-ghost', zoneId: 'zone-entrance', role: 'npc', dialogueId: 'dlg-missing' },
      ],
    };
    convertEntities(project, fidelity, warnings);
    convertPlacements(project, fidelity, warnings);
    expect(warnings.some((w) => w.includes('dlg-missing'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'dialogue-id-unresolved')).toBe(true);
  });

  it('importEntities restores dialogueId', () => {
    const exported = requireExport(minimalProject);
    const imported = requireImport(importFromContentPack(exported.contentPack));
    const keeper = imported.project.entityPlacements.find((e) => e.entityId === 'npc-keeper');
    expect(keeper?.dialogueId).toBe('dlg-keeper');
    expect(keeper?.tags?.some((t) => t.startsWith('dialogue:'))).toBeFalsy();
  });
});

// --- F-42772fc9: item placements zone/grid/lootTableId ---

describe('F-42772fc9: item placements carry zone/grid/lootTableId instead of catalog-only', () => {
  const placed: WorldProject = {
    ...minimalProject,
    lootTables: [{ id: 'loot-shelf', rolls: 1, entries: [{ itemId: 'item-torch', weight: 1 }] }],
    itemPlacements: [
      {
        itemId: 'item-torch',
        name: 'Torch',
        zoneId: 'zone-cellar',
        gridX: 4,
        gridY: 7,
        container: 'shelf',
        hidden: false,
        lootTableId: 'loot-shelf',
      },
    ],
  };

  it('ContentPack.itemPlacements carries location + reverse loot link; items[] stays the catalog', () => {
    const exported = requireExport(placed);
    expect(exported.contentPack.items[0].id).toBe('item-torch');
    const ip = exported.contentPack.itemPlacements[0];
    expect(ip.itemId).toBe('item-torch');
    expect(ip.zoneId).toBe('zone-cellar');
    expect(ip.gridX).toBe(4);
    expect(ip.gridY).toBe(7);
    expect(ip.container).toBe('shelf');
    expect(ip.lootTableId).toBe('loot-shelf');
  });

  it('import restores zone/grid/lootTableId/container instead of round-robining onto zones[0]', () => {
    const exported = requireExport(placed);
    const imported = requireImport(importFromContentPack(exported.contentPack));
    const torch = imported.project.itemPlacements.find((i) => i.itemId === 'item-torch');
    expect(torch?.zoneId).toBe('zone-cellar');
    expect(torch?.gridX).toBe(4);
    expect(torch?.gridY).toBe(7);
    expect(torch?.container).toBe('shelf');
    expect(torch?.lootTableId).toBe('loot-shelf');
    expect(imported.warnings.some((w) => /Item zone placements reconstructed/i.test(w))).toBe(false);
  });

  it('convertItemPlacements is 1:1 with authored itemPlacements', () => {
    expect(convertItemPlacements(placed)).toHaveLength(placed.itemPlacements.length);
  });
});

// --- F-5f16cf2e: town structures pass-through ---

describe('F-5f16cf2e: buildings/hubs/strongholds pass through and restore', () => {
  const town: WorldProject = {
    ...minimalProject,
    buildings: [{
      id: 'b-inn', name: 'Inn', buildingType: 'tavern',
      gridX: 1, gridY: 1, width: 2, height: 2, tags: ['civic'],
      zoneId: 'zone-entrance', interiorZoneId: 'zone-cellar',
    }],
    hubs: [{
      id: 'h-square', name: 'Market Square', zoneId: 'zone-entrance',
      hubType: 'market-square', serviceTypes: ['market'], connectedZoneIds: [], tags: [],
    }],
    strongholds: [{
      id: 's-keep', name: 'Keep', zoneId: 'zone-entrance',
      defenseLevel: 3, garrisonEntityIds: [], tags: [],
    }],
  };

  it('export copies the three arrays onto ContentPack and stamps lossless-passthrough fidelity', () => {
    const exported = requireExport(town);
    expect(exported.contentPack.buildings).toEqual(town.buildings);
    expect(exported.contentPack.hubs).toEqual(town.hubs);
    expect(exported.contentPack.strongholds).toEqual(town.strongholds);
    const reasons = exported.fidelity.entries.map((f) => f.reason);
    expect(reasons).toEqual(expect.arrayContaining([
      'buildings-raw-passthrough',
      'hubs-raw-passthrough',
      'strongholds-raw-passthrough',
    ]));
    expect(exported.fidelity.entries.filter((f) => f.reason.endsWith('-raw-passthrough')).every((f) => f.level === 'lossless')).toBe(true);
    expect(exported.warnings.some((w) => /building/i.test(w))).toBe(true);
  });

  it('importFromContentPack restores the three arrays', () => {
    const exported = requireExport(town);
    const imported = requireImport(importFromContentPack(exported.contentPack));
    expect(imported.project.buildings).toEqual(town.buildings);
    expect(imported.project.hubs).toEqual(town.hubs);
    expect(imported.project.strongholds).toEqual(town.strongholds);
  });

  it('empty town arrays are unconditional keys and silent', () => {
    const exported = requireExport(minimalProject);
    expect(exported.contentPack.buildings).toEqual([]);
    expect(exported.contentPack.hubs).toEqual([]);
    expect(exported.contentPack.strongholds).toEqual([]);
    expect(Object.keys(exported.contentPack)).toEqual(expect.arrayContaining(['buildings', 'hubs', 'strongholds']));
    expect(exported.fidelity.entries.some((f) => /buildings|hubs|strongholds/.test(f.reason) && f.reason.includes('passthrough'))).toBe(false);
  });
});

// --- F-229409a8: District.economyProfile ---

describe('F-229409a8: district economyProfile seeds engine baseline', () => {
  it('copies supplyCategories and maps recognized scarcityDefaults onto baseline', () => {
    const exported = requireExport(minimalProject);
    const eco = exported.contentPack.districts[0].economyProfile!;
    expect(eco.supplyCategories).toEqual(['food', 'medicine']);
    expect(eco.scarcityDefaults).toEqual({ food: 0.3, medicine: 0.5 });
    expect(eco.baseline.food).toBe(0.3);
    expect(eco.baseline.medicine).toBe(0.5);
    for (const cat of ENGINE_SUPPLY_CATEGORIES) {
      expect(typeof cat).toBe('string');
    }
  });

  it('warns on unrecognized category strings and omits them from baseline', () => {
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const project: WorldProject = {
      ...minimalProject,
      districts: [{
        ...minimalProject.districts[0],
        economyProfile: {
          supplyCategories: ['food', 'rope', 'salvage'],
          scarcityDefaults: { food: 0.4, rope: 0.2, salvage: 0.7 },
        },
      }],
    };
    const districts = convertDistricts(project, warnings, fidelity);
    const eco = districts[0].economyProfile!;
    expect(eco.supplyCategories).toEqual(['food', 'rope', 'salvage']);
    expect(eco.scarcityDefaults).toEqual({ food: 0.4, rope: 0.2, salvage: 0.7 });
    expect(eco.baseline).toEqual({ food: 0.4 });
    expect(Object.prototype.hasOwnProperty.call(eco.baseline, 'rope')).toBe(false);
    expect(warnings.some((w) => w.includes('rope'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'economy-supply-category-unrecognized')).toBe(true);
    expect(fidelity.some((f) => f.reason === 'economy-scarcity-category-unrecognized')).toBe(true);
  });

  it('import restores supplyCategories + scarcityDefaults', () => {
    const exported = requireExport(minimalProject);
    const imported = requireImport(importFromContentPack(exported.contentPack));
    expect(imported.project.districts[0].economyProfile).toEqual(minimalProject.districts[0].economyProfile);
  });
});

// --- F-0e432e10: SpawnPoint records ---

describe('F-0e432e10: spawn point records emit and restore', () => {
  const multi: WorldProject = {
    ...minimalProject,
    spawnPoints: [
      { id: 'sp-default', zoneId: 'zone-entrance', gridX: 2, gridY: 2, isDefault: true },
      { id: 'sp-cellar', zoneId: 'zone-cellar', gridX: 8, gridY: 11, isDefault: false },
    ],
    playerTemplate: {
      ...minimalProject.playerTemplate!,
      spawnPointId: 'sp-cellar',
    },
  };

  it('ContentPack.spawnPoints carries id/zoneId/isDefault/grid; spawnPointId stays a pointer', () => {
    const exported = requireExport(multi);
    expect(exported.contentPack.spawnPoints).toEqual(multi.spawnPoints);
    expect(exported.contentPack.playerTemplate?.spawnPointId).toBe('sp-cellar');
    expect(convertSpawnPoints(multi)).toHaveLength(2);
  });

  it('import restores both starts instead of synthesizing one imported-spawn on zones[0]', () => {
    const exported = requireExport(multi);
    const imported = requireImport(importFromContentPack(exported.contentPack));
    expect(imported.project.spawnPoints.map((s) => s.id).sort()).toEqual(['sp-cellar', 'sp-default']);
    expect(imported.project.spawnPoints.find((s) => s.id === 'sp-cellar')?.isDefault).toBe(false);
    expect(imported.project.spawnPoints.find((s) => s.id === 'sp-default')?.zoneId).toBe('zone-entrance');
    expect(imported.project.playerTemplate?.spawnPointId).toBe('sp-cellar');
    expect(imported.project.spawnPoints.some((s) => s.id === 'imported-spawn')).toBe(false);
  });
});

// --- F-3162133c / F-c5ed434d: covered at the library layer here; CLI tests in cli.test.ts ---

describe('F-3162133c: ExportResult still carries fidelity/assets for the CLI to persist', () => {
  it('exportToEngine returns fidelity always and assets when authored', () => {
    const withAssets: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'bg-1', kind: 'background', label: 'Hall', path: 'assets/hall.png', tags: [] }],
      zones: minimalProject.zones.map((z: (typeof minimalProject.zones)[number], i: number) => i === 0 ? { ...z, backgroundId: 'bg-1' } : z),
    };
    const exported = requireExport(withAssets);
    expect(exported.fidelity).toBeDefined();
    expect(exported.fidelity.entries).toBeDefined();
    expect(exported.assets).toHaveLength(1);
    expect(exported.assetBindings?.zones?.['zone-entrance']?.backgroundId).toBe('bg-1');
  });

  it('importFromExportResult recovers assets/bindings (the channel --import of a pack dir uses)', () => {
    const withAssets: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'bg-1', kind: 'background', label: 'Hall', path: 'assets/hall.png', tags: [] }],
      zones: minimalProject.zones.map((z: (typeof minimalProject.zones)[number], i: number) => i === 0 ? { ...z, backgroundId: 'bg-1' } : z),
    };
    const exported = requireExport(withAssets);
    const imported = requireImport(importFromExportResult(exported));
    expect(imported.project.assets).toHaveLength(1);
    expect(imported.project.zones.find((z) => z.id === 'zone-entrance')?.backgroundId).toBe('bg-1');
  });
});

describe('new ContentPack channels participate in the content hash', () => {
  it('SIM_AFFECTING_KEYS lists the wave-32 channels', () => {
    for (const k of ['connections', 'itemPlacements', 'spawnPoints', 'buildings', 'hubs', 'strongholds']) {
      expect(SIM_AFFECTING_KEYS).toContain(k);
    }
  });
});
