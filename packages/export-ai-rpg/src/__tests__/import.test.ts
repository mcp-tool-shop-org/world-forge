import { describe, it, expect } from 'vitest';
import { validateProject } from '@world-forge/schema';
import { exportToEngine } from '../export.js';
import { detectImportFormat, importProject, importFromContentPack, importFromExportResult } from '../import.js';
import { importZones } from '../import-zones.js';
import { importDistricts } from '../import-districts.js';
import { importEntities } from '../import-entities.js';
import { importItems } from '../import-items.js';
import { importDialogues } from '../import-dialogues.js';
import { importPlayerTemplate } from '../import-player-template.js';
import { importBuildCatalog } from '../import-build-catalog.js';
import { importProgressionTrees } from '../import-progression-trees.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';

// --- detectImportFormat ---

describe('detectImportFormat', () => {
  it('detects WorldProject format', () => {
    expect(detectImportFormat(minimalProject)).toBe('world-project');
  });

  it('detects ExportResult format', () => {
    const result = exportToEngine(minimalProject);
    expect(detectImportFormat(result)).toBe('export-result');
  });

  it('detects ContentPack format', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    expect(detectImportFormat(result.contentPack)).toBe('content-pack');
  });

  it('returns null for unrecognized format', () => {
    expect(detectImportFormat({ foo: 'bar' })).toBeNull();
  });

  it('returns null for null', () => {
    expect(detectImportFormat(null)).toBeNull();
  });

  it('returns null for non-object', () => {
    expect(detectImportFormat('hello')).toBeNull();
    expect(detectImportFormat(42)).toBeNull();
  });
});

// --- importZones ---

describe('importZones', () => {
  it('auto-layouts zones in grid', () => {
    const result = exportToEngine(chapelProject);
    if ('ok' in result) throw new Error('export failed');
    const zones = importZones(result.contentPack.zones);
    expect(zones.length).toBe(result.contentPack.zones.length);
    // First zone at (0,0), second at (defaultWidth + spacing, 0) = (10, 0)
    expect(zones[0].gridX).toBe(0);
    expect(zones[0].gridY).toBe(0);
    expect(zones[0].gridWidth).toBe(6);
    expect(zones[0].gridHeight).toBe(5);
    // Each zone gets unique grid position
    const positions = zones.map((z) => `${z.gridX},${z.gridY}`);
    expect(new Set(positions).size).toBe(zones.length);
  });

  it('reconstructs description from TextBlock array', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const zones = importZones(result.contentPack.zones);
    const entrance = zones.find((z) => z.id === 'zone-entrance');
    expect(entrance?.description).toBe('A dusty entrance hall with faded tapestries.');
  });

  it('handles zero zones', () => {
    expect(importZones([])).toHaveLength(0);
  });

  it('reconstructs interactables with inspect type', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const zones = importZones(result.contentPack.zones);
    const entrance = zones.find((z) => z.id === 'zone-entrance');
    expect(entrance?.interactables).toHaveLength(1);
    expect(entrance?.interactables[0].name).toBe('old tapestry');
    expect(entrance?.interactables[0].type).toBe('inspect');
  });

  it('preserves hazards', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const zones = importZones(result.contentPack.zones);
    const cellar = zones.find((z) => z.id === 'zone-cellar');
    expect(cellar?.hazards).toContain('unstable-floor');
  });
});

// --- importDistricts ---

describe('importDistricts', () => {
  it('reverses surveillance to safety', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const districts = importDistricts(result.contentPack.districts);
    expect(districts).toHaveLength(1);
    expect(districts[0].baseMetrics.safety).toBe(60); // original safety was 60
    expect(districts[0].baseMetrics.commerce).toBe(30);
  });

  it('defaults economyProfile', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const districts = importDistricts(result.contentPack.districts);
    expect(districts[0].economyProfile).toEqual({ supplyCategories: [], scarcityDefaults: {} });
  });
});

// --- importEntities ---

describe('importEntities', () => {
  it('reverse-maps npc role', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const { placements } = importEntities(result.contentPack.entities, ['zone-a']);
    expect(placements[0].role).toBe('npc');
  });

  it('reverse-maps boss from enemy+boss tag', () => {
    const { placements } = importEntities(
      [{ id: 'e1', type: 'enemy', name: 'Dragon', tags: ['hostile', 'boss', 'elite'], aiProfile: 'territorial' }],
      ['z1'],
    );
    expect(placements[0].role).toBe('boss');
  });

  it('reverse-maps merchant from npc+merchant tag', () => {
    const { placements } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Vendor', tags: ['merchant', 'trader'], aiProfile: 'passive' }],
      ['z1'],
    );
    expect(placements[0].role).toBe('merchant');
  });

  it('reverse-maps companion from recruitable tag', () => {
    const { placements } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Ally', tags: ['recruitable', 'companion'], aiProfile: 'follower' }],
      ['z1'],
    );
    expect(placements[0].role).toBe('companion');
  });

  it('strips role-injected tags', () => {
    const { placements } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Vendor', tags: ['merchant', 'trader', 'custom-tag'], aiProfile: 'passive' }],
      ['z1'],
    );
    expect(placements[0].tags).toEqual(['custom-tag']);
  });

  it('extracts factionId from faction:* tags', () => {
    const { placements } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Guard', tags: ['faction:keepers'], aiProfile: 'passive' }],
      ['z1'],
    );
    expect(placements[0].factionId).toBe('keepers');
  });

  it('round-robin distributes across zones', () => {
    const { placements } = importEntities(
      [
        { id: 'e1', type: 'npc', name: 'A', tags: [], aiProfile: 'passive' },
        { id: 'e2', type: 'npc', name: 'B', tags: [], aiProfile: 'passive' },
        { id: 'e3', type: 'npc', name: 'C', tags: [], aiProfile: 'passive' },
      ],
      ['z1', 'z2'],
    );
    expect(placements[0].zoneId).toBe('z1');
    expect(placements[1].zoneId).toBe('z2');
    expect(placements[2].zoneId).toBe('z1');
  });

  it('generates warnings for each entity', () => {
    const { warnings } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Bob', tags: [], aiProfile: 'passive' }],
      ['z1'],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Bob');
  });
});

// --- importItems ---

describe('importItems', () => {
  it('reverses contraband flag to hidden', () => {
    const { placements } = importItems(
      [{ id: 'i1', name: 'Secret', description: 'Hidden', slot: 'trinket', rarity: 'rare', provenance: { flags: ['contraband'] } } as never],
      ['z1'],
    );
    expect(placements[0].hidden).toBe(true);
  });

  it('places items in first zone', () => {
    const { placements } = importItems(
      [{ id: 'i1', name: 'Sword', description: 'A sword', slot: 'weapon', rarity: 'common' } as never],
      ['z1', 'z2'],
    );
    expect(placements[0].zoneId).toBe('z1');
  });

  it('handles empty items', () => {
    const { placements, warnings } = importItems([], ['z1']);
    expect(placements).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});

// --- importDialogues ---

describe('importDialogues', () => {
  it('preserves full node graph', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const dialogues = importDialogues(result.contentPack.dialogues);
    expect(dialogues).toHaveLength(1);
    expect(dialogues[0].id).toBe('dlg-keeper');
    expect(dialogues[0].entryNodeId).toBe('greet');
    expect(Object.keys(dialogues[0].nodes)).toHaveLength(3);
    expect(dialogues[0].nodes.greet.choices).toHaveLength(2);
  });
});

// --- importPlayerTemplate ---

describe('importPlayerTemplate', () => {
  it('round-trips player template fields', () => {
    const result = exportToEngine(minimalProject);
    if ('ok' in result) throw new Error('export failed');
    const pt = importPlayerTemplate(result.contentPack.playerTemplate);
    expect(pt).toBeDefined();
    expect(pt!.name).toBe('Traveler');
    expect(pt!.baseStats.vigor).toBe(3);
    expect(pt!.startingInventory).toEqual(['item-torch']);
    expect(pt!.spawnPointId).toBe('sp-default');
  });

  it('returns undefined for undefined input', () => {
    expect(importPlayerTemplate(undefined)).toBeUndefined();
  });
});

// --- importBuildCatalog ---

describe('importBuildCatalog', () => {
  it('strips packId and reconstructs catalog', () => {
    const result = exportToEngine(chapelProject);
    if ('ok' in result) throw new Error('export failed');
    const bc = importBuildCatalog(result.contentPack.buildCatalog);
    expect(bc).toBeDefined();
    expect(bc!.archetypes.length).toBeGreaterThan(0);
    expect(bc!.statBudget).toBe(chapelProject.buildCatalog!.statBudget);
    // packId should not exist on the result
    expect((bc as unknown as Record<string, unknown>).packId).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(importBuildCatalog(undefined)).toBeUndefined();
  });
});

// --- importProgressionTrees ---

describe('importProgressionTrees', () => {
  it('preserves tree structure', () => {
    const result = exportToEngine(chapelProject);
    if ('ok' in result) throw new Error('export failed');
    const trees = importProgressionTrees(result.contentPack.progressionTrees);
    expect(trees.length).toBe(chapelProject.progressionTrees.length);
    expect(trees[0].id).toBe(chapelProject.progressionTrees[0].id);
    expect(trees[0].nodes.length).toBe(chapelProject.progressionTrees[0].nodes.length);
  });
});

// --- Round-trip tests ---

describe('round-trip: export → import → re-export', () => {
  it('Chapel: export → import → validate passes', () => {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');

    const imported = importFromExportResult(exported);
    const validation = validateProject(imported.project);
    expect(validation.valid).toBe(true);
  });

  it('Chapel: export → import → re-export → ContentPacks match', () => {
    const exported1 = exportToEngine(chapelProject);
    if ('ok' in exported1) throw new Error('export failed');

    const imported = importFromExportResult(exported1);
    const exported2 = exportToEngine(imported.project);
    if ('ok' in exported2) throw new Error('re-export failed');

    const pack1 = exported1.contentPack;
    const pack2 = exported2.contentPack;

    // Zone count and IDs match
    expect(pack2.zones.length).toBe(pack1.zones.length);
    const zoneIds1 = pack1.zones.map((z) => z.id).sort();
    const zoneIds2 = pack2.zones.map((z) => z.id).sort();
    expect(zoneIds2).toEqual(zoneIds1);

    // District count and IDs match
    expect(pack2.districts.length).toBe(pack1.districts.length);

    // Dialogue count and structure match
    expect(pack2.dialogues.length).toBe(pack1.dialogues.length);
    for (let i = 0; i < pack1.dialogues.length; i++) {
      expect(pack2.dialogues.find((d) => d.id === pack1.dialogues[i].id)).toBeDefined();
    }

    // Player template fields match
    expect(pack2.playerTemplate?.name).toBe(pack1.playerTemplate?.name);
    expect(pack2.playerTemplate?.baseStats).toEqual(pack1.playerTemplate?.baseStats);

    // Build catalog core fields match
    expect(pack2.buildCatalog?.statBudget).toBe(pack1.buildCatalog?.statBudget);
    expect(pack2.buildCatalog?.archetypes.length).toBe(pack1.buildCatalog?.archetypes.length);

    // Progression tree count matches
    expect(pack2.progressionTrees.length).toBe(pack1.progressionTrees.length);

    // Entity count matches
    expect(pack2.entities.length).toBe(pack1.entities.length);

    // Item count matches
    expect(pack2.items.length).toBe(pack1.items.length);
  });

  it('Minimal: export → import → validate passes', () => {
    const exported = exportToEngine(minimalProject);
    if ('ok' in exported) throw new Error('export failed');

    const imported = importFromContentPack(exported.contentPack, 'Minimal Re-import');
    const validation = validateProject(imported.project);
    expect(validation.valid).toBe(true);
  });

  it('WorldProject: JSON round-trip preserves validity', () => {
    const json = JSON.stringify(chapelProject);
    const parsed = JSON.parse(json);
    const result = importProject(parsed);
    if ('ok' in result) throw new Error('import failed');
    expect(result.format).toBe('world-project');
    expect(result.lossless).toBe(true);
    const validation = validateProject(result.project);
    expect(validation.valid).toBe(true);
  });
});

// --- importProject orchestrator ---

describe('importProject', () => {
  it('imports WorldProject format losslessly', () => {
    const result = importProject(minimalProject);
    if ('ok' in result) throw new Error('import failed');
    expect(result.format).toBe('world-project');
    expect(result.lossless).toBe(true);
    expect(result.project.id).toBe(minimalProject.id);
  });

  it('imports ContentPack format with warnings', () => {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');
    const result = importProject(exported.contentPack);
    if ('ok' in result) throw new Error('import failed');
    expect(result.format).toBe('content-pack');
    expect(result.lossless).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('imports ExportResult format with metadata recovery', () => {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');
    const result = importProject(exported);
    if ('ok' in result) throw new Error('import failed');
    expect(result.format).toBe('export-result');
    expect(result.project.name).toBe(chapelProject.name);
  });

  it('rejects invalid format', () => {
    const result = importProject({ random: 'data' });
    expect(result).toHaveProperty('ok', false);
  });
});
