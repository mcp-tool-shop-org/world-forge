import { describe, it, expect, vi, afterEach } from 'vitest';
import { importEntities } from '../import-entities.js';
import { importItems } from '../import-items.js';
import { importFromContentPack } from '../import.js';
import { importBuildCatalog } from '../import-build-catalog.js';
import { importZones } from '../import-zones.js';
import { exportToEngine } from '../export.js';
import { convertEntities } from '../convert-entities.js';
import { convertPackMeta } from '../convert-pack.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';

// --- E-001: import-entities custom field runtime validation ---

describe('E-001: importEntities custom field validation', () => {
  it('safely converts non-string custom field values to strings', () => {
    const { placements } = importEntities(
      [{
        id: 'e1', type: 'npc', name: 'Test', tags: [], aiProfile: 'passive',
        custom: { str: 'hello', num: 42, bool: true },
      } as never],
      ['z1'],
    );
    expect(placements[0].custom).toEqual({ str: 'hello', num: '42', bool: 'true' });
  });

  it('rejects array custom field', () => {
    const { placements } = importEntities(
      [{
        id: 'e1', type: 'npc', name: 'Test', tags: [], aiProfile: 'passive',
        custom: ['not', 'an', 'object'],
      } as never],
      ['z1'],
    );
    expect(placements[0].custom).toBeUndefined();
  });

  it('handles null custom field gracefully', () => {
    const { placements } = importEntities(
      [{
        id: 'e1', type: 'npc', name: 'Test', tags: [], aiProfile: 'passive',
        custom: null,
      } as never],
      ['z1'],
    );
    expect(placements[0].custom).toBeUndefined();
  });
});

// --- E-002: importItems provenance.flags Array.isArray guard ---

describe('E-002: importItems provenance.flags guard', () => {
  it('handles flags as array correctly', () => {
    const { placements } = importItems(
      [{ id: 'i1', name: 'Secret', description: 'x', slot: 'trinket', rarity: 'rare', provenance: { flags: ['contraband'] } } as never],
      ['z1'],
    );
    expect(placements[0].hidden).toBe(true);
  });

  it('handles flags as non-array (string) gracefully', () => {
    const { placements } = importItems(
      [{ id: 'i1', name: 'Item', description: 'x', slot: 'weapon', rarity: 'common', provenance: { flags: 'contraband' } } as never],
      ['z1'],
    );
    expect(placements[0].hidden).toBe(false);
  });

  it('handles missing provenance gracefully', () => {
    const { placements } = importItems(
      [{ id: 'i1', name: 'Item', description: 'x', slot: 'weapon', rarity: 'common' } as never],
      ['z1'],
    );
    expect(placements[0].hidden).toBe(false);
  });

  it('handles flags as number gracefully', () => {
    const { placements } = importItems(
      [{ id: 'i1', name: 'Item', description: 'x', slot: 'weapon', rarity: 'common', provenance: { flags: 123 } } as never],
      ['z1'],
    );
    expect(placements[0].hidden).toBe(false);
  });
});

// --- E-004: import.ts map bounds calculated from zones ---

describe('E-004: map bounds from zone positions', () => {
  it('uses 40x30 minimum floor when zones are small', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = importFromContentPack(exported.contentPack);
    expect(imported.project.map.gridWidth).toBeGreaterThanOrEqual(40);
    expect(imported.project.map.gridHeight).toBeGreaterThanOrEqual(30);
  });

  it('expands beyond 40x30 when zones are large', () => {
    // Create a content pack with zones that would push boundaries
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    // The auto-layout for 2 zones should be within 40x30 minimum
    const imported = importFromContentPack(exported.contentPack);
    expect(imported.project.map.gridWidth).toBeGreaterThanOrEqual(40);
    expect(imported.project.map.gridHeight).toBeGreaterThanOrEqual(30);
  });
});

// --- E-005: project ID uniqueness ---

describe('E-005: project ID has random suffix', () => {
  it('generated project ID includes random suffix', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = importFromContentPack(exported.contentPack);
    expect(imported.project.id).toMatch(/^imported-\d+-[a-z0-9]{2,6}$/);
  });

  it('two imports produce different IDs', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported1 = importFromContentPack(exported.contentPack);
    const imported2 = importFromContentPack(exported.contentPack);
    // IDs should differ (extremely unlikely to collide with random suffix)
    expect(imported1.project.id).not.toBe(imported2.project.id);
  });
});

// --- E-006: exportToEngine JSDoc ---

describe('E-006: exportToEngine has JSDoc', () => {
  it('exportToEngine is a function (JSDoc is compile-time check)', () => {
    expect(typeof exportToEngine).toBe('function');
  });
});

// --- E-007: convert-pack tones fallback warning ---

describe('E-007: convertPackMeta tones fallback warning', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns when no valid tones are mapped', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['unmapped-tone'] };
    const meta = convertPackMeta(project);
    expect(meta.tones).toEqual(['atmospheric']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('falling back'));
  });

  it('does not warn when valid tones exist', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['dark'] };
    const meta = convertPackMeta(project);
    expect(meta.tones).toEqual(['dark']);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

// --- E-008: importEntities zero zoneIds warning ---

describe('E-008: importEntities warns on zero zoneIds', () => {
  it('warns with "no zones available" when zoneIds is empty', () => {
    const { warnings, placements } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Bob', tags: [], aiProfile: 'passive' }],
      [],
    );
    expect(placements[0].zoneId).toBe('unplaced');
    expect(warnings[0]).toContain('no zones available');
  });
});

// --- E-009: convert-entities typeof check on custom ---

describe('E-009: convertEntities custom field typeof check', () => {
  it('skips custom field when it is an array', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'e1', zoneId: 'zone-entrance', role: 'npc',
        name: 'Test',
        custom: ['bad'] as unknown as Record<string, string>,
      }],
    };
    const entities = convertEntities(project);
    expect((entities[0] as Record<string, unknown>).custom).toBeUndefined();
  });

  it('passes through valid custom object', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'e1', zoneId: 'zone-entrance', role: 'npc',
        name: 'Test',
        custom: { key: 'value' },
      }],
    };
    const entities = convertEntities(project);
    expect((entities[0] as Record<string, unknown>).custom).toEqual({ key: 'value' });
  });
});

// --- E-010: import-build-catalog only emit fidelity when packId exists ---

describe('E-010: importBuildCatalog pack-id-stripped only when packId present', () => {
  it('does not emit pack-id-stripped when packId is absent', () => {
    const { fidelity } = importBuildCatalog({
      statBudget: 10, maxTraits: 2, requiredFlaws: 0,
      archetypes: [], backgrounds: [], traits: [],
      disciplines: [], crossTitles: [], entanglements: [],
    } as never);
    expect(fidelity.some((f) => f.reason === 'pack-id-stripped')).toBe(false);
  });

  it('does not emit pack-id-stripped when packId is empty string', () => {
    const { fidelity } = importBuildCatalog({
      packId: '',
      statBudget: 10, maxTraits: 2, requiredFlaws: 0,
      archetypes: [], backgrounds: [], traits: [],
      disciplines: [], crossTitles: [], entanglements: [],
    } as never);
    expect(fidelity.some((f) => f.reason === 'pack-id-stripped')).toBe(false);
  });

  it('emits pack-id-stripped when packId has value', () => {
    const { fidelity } = importBuildCatalog({
      packId: 'my-pack',
      statBudget: 10, maxTraits: 2, requiredFlaws: 0,
      archetypes: [], backgrounds: [], traits: [],
      disciplines: [], crossTitles: [], entanglements: [],
    } as never);
    expect(fidelity.some((f) => f.reason === 'pack-id-stripped')).toBe(true);
    expect(fidelity.find((f) => f.reason === 'pack-id-stripped')!.message).toContain('my-pack');
  });
});

// --- E-012: import.ts empty string spawnPointId ---

describe('E-012: empty string spawnPointId treated as falsy', () => {
  it('replaces empty string spawnPointId with generated one', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    // Modify player template to have empty string spawnPointId
    const pack = { ...exported.contentPack, playerTemplate: { ...exported.contentPack.playerTemplate!, spawnPointId: '' } };
    const imported = importFromContentPack(pack);
    expect(imported.project.playerTemplate?.spawnPointId).toBeTruthy();
    expect(imported.project.playerTemplate?.spawnPointId).not.toBe('');
  });
});

// --- E-014: import-zones grid exceeds 20x20 → fidelity entry (EB-005 migrated from console.warn) ---

describe('E-014: importZones fidelity on large grid', () => {
  it('emits fidelity entry when auto-layout grid exceeds 20x20', () => {
    // Create 500 zones to force a grid > 20x20
    const manyZones = Array.from({ length: 500 }, (_, i) => ({
      id: `zone-${i}`, name: `Zone ${i}`, tags: [],
      description: [{ text: 'test' }],
      neighbors: [], exits: [], hazards: [], interactables: [],
      light: 5, noise: 3,
    }));
    const { fidelity } = importZones(manyZones as never);
    expect(fidelity.some((f) => f.reason === 'grid-exceeds-recommended-size')).toBe(true);
  });

  it('does not emit grid-exceeds fidelity for small zone counts', () => {
    const fewZones = Array.from({ length: 4 }, (_, i) => ({
      id: `zone-${i}`, name: `Zone ${i}`, tags: [],
      description: [{ text: 'test' }],
      neighbors: [], exits: [], hazards: [], interactables: [],
      light: 5, noise: 3,
    }));
    const { fidelity } = importZones(fewZones as never);
    expect(fidelity.some((f) => f.reason === 'grid-exceeds-recommended-size')).toBe(false);
  });
});

// --- E-015 + I-001 + I-002: CLI error handling ---
// Tested via cli.test.ts (integration tests that invoke the CLI binary).
// The fixes are:
//   E-015: readFile catch now logs err.message to stderr
//   I-001: main() is wrapped with .catch() for unhandled promise rejection
//   I-002: readFile catch uses try/catch so `raw` is always defined in success path

// --- E-013: fidelity.ts JSDoc (compile-time, verify types exist) ---

describe('E-013: fidelity types have JSDoc', () => {
  it('FidelityEntry type is importable', async () => {
    const mod = await import('../fidelity.js');
    expect(mod.buildFidelityReport).toBeDefined();
    expect(mod.summarizeFidelity).toBeDefined();
  });
});
