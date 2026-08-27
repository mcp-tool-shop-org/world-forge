// swarm-wave9-amends.test.ts — Stage-B AMEND wave (wave 9) fixes for export-ai-rpg.
//
// One describe block per approved finding. See
// E:\AI\testing-os\swarms\swarm-1787820671-c76a\wave-9\export-engine.md for
// the full finding text this wave fixes.

import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertItems } from '../convert-items.js';
import { convertPackMeta } from '../convert-pack.js';
import { computeContentHash, SIM_AFFECTING_KEYS } from '../content-hash.js';
import {
  importFromContentPack,
  importFromExportResult,
  importProject,
} from '../import.js';
import type { ImportResult, ImportError } from '../import.js';
import type { ContentPack } from '../export.js';
import type { FidelityEntry } from '../fidelity.js';
import type { WorldProject } from '@world-forge/schema';
import type { PackMetadata } from '@ai-rpg-engine/pack-registry';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { invalidOrphanProject } from '../../../schema/src/__tests__/fixtures/invalid-orphan.js';

function requireImport(r: ImportResult | ImportError): ImportResult {
  if (!r.success) throw new Error(r.message);
  return r;
}

function stubMeta(over: Partial<PackMetadata> = {}): PackMetadata {
  return {
    id: 'test',
    name: 'Test',
    tagline: '',
    genres: ['fantasy'],
    difficulty: 'intermediate',
    tones: ['dark'],
    tags: [],
    engineVersion: '>=3.8.0 <4.0.0',
    version: '1.0.0',
    description: 'test',
    narratorTone: '',
    ...over,
  };
}

// --- F-06fd0fb3: hidden→contraband and description/container get a reporting channel ---

describe('F-06fd0fb3: convertItems reports hidden→contraband and dropped container', () => {
  it('a hidden item still gets the contraband flag AND populates warnings + fidelity', () => {
    const project: WorldProject = {
      ...minimalProject,
      itemPlacements: [
        { itemId: 'item-lantern', name: 'Hidden Lantern', zoneId: 'zone-entrance', hidden: true },
      ],
    };
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const items = convertItems(project, warnings, fidelity);
    expect(items[0].provenance?.flags).toContain('contraband');
    expect(warnings.some((w) => w.includes('hidden') && w.includes('contraband'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'hidden-reencoded-as-contraband')).toBe(true);
  });

  it('when both description and container are authored, container is dropped WITH a warning', () => {
    const project: WorldProject = {
      ...minimalProject,
      itemPlacements: [
        {
          itemId: 'item-rope',
          name: 'Rope',
          description: 'Forty feet, tarred against the wet.',
          container: 'stall crate',
          zoneId: 'zone-entrance',
          hidden: false,
        },
      ],
    };
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const items = convertItems(project, warnings, fidelity);
    expect(items[0].description).toBe('Forty feet, tarred against the wet.');
    expect(items[0].description).not.toContain('stall crate');
    expect(warnings.some((w) => w.includes('container') && w.includes('stall crate'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'item-container-dropped-when-description-present')).toBe(true);
  });

  it('CONTROL: container-only still folds into the synthesised description with no drop warning', () => {
    const project: WorldProject = {
      ...minimalProject,
      itemPlacements: [
        { itemId: 'item-torch', name: 'Torch', container: 'shelf', zoneId: 'zone-entrance', hidden: false },
      ],
    };
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const items = convertItems(project, warnings, fidelity);
    expect(items[0].description).toBe('Found in shelf');
    expect(fidelity.some((f) => f.reason === 'item-container-dropped-when-description-present')).toBe(false);
  });
});

// --- F-0fdda22c: unmapped genre/difficulty warn; mercantile/pursuit identity-map ---

describe('F-0fdda22c: unmapped genre/difficulty warn; VALID_GENRES identity-map', () => {
  it('mercantile and pursuit identity-map instead of silent fantasy fallback', () => {
    for (const g of ['mercantile', 'pursuit'] as const) {
      const warnings: string[] = [];
      const meta = convertPackMeta({ ...minimalProject, genre: g }, warnings);
      expect(meta.genres).toEqual([g]);
      expect(warnings.join('\n')).not.toContain(g);
    }
  });

  it('unmapped difficulty warns with the authored value and the fallback', () => {
    const warnings: string[] = [];
    const meta = convertPackMeta({ ...minimalProject, difficulty: 'legendary' }, warnings);
    expect(meta.difficulty).toBe('intermediate');
    expect(warnings.join('\n')).toContain('legendary');
    expect(warnings.join('\n')).toContain('intermediate');
  });
});

// --- F-159f42a6: world-project import fail-closes on validateProject ---

describe('F-159f42a6: importProject fail-closes on an invalid WorldProject', () => {
  it('importProject(invalidOrphanProject) is not {success:true, lossless:true}', () => {
    const result = importProject(invalidOrphanProject);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it('CONTROL: a valid WorldProject still imports losslessly', () => {
    const result = importProject(minimalProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.lossless).toBe(true);
      expect(result.format).toBe('world-project');
    }
  });
});

// --- F-1d5f2ce5: missing districts/items do not throw ---

describe('F-1d5f2ce5: a pack of {entities:[], zones:[]} does not throw', () => {
  it('{entities:[], zones:[]} returns success or a structured ImportError', () => {
    const result = importFromContentPack({ entities: [], zones: [] } as unknown as ContentPack);
    if (result.success) {
      expect(result.project.districts).toEqual([]);
      expect(result.project.itemPlacements).toEqual([]);
    } else {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

// --- F-64b9e73d: importer consults schemaVersion / retired modules ---

describe('F-64b9e73d: import consults schemaVersion and retired modules', () => {
  it('importFromExportResult warns when schemaVersion is omitted and modules includes movement-core', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const pack = { ...exported.contentPack };
    delete pack.schemaVersion;
    const imported = requireImport(importFromExportResult({
      ...exported,
      contentPack: pack,
      manifest: { ...exported.manifest, modules: [...exported.manifest.modules, 'movement-core'] },
    }));
    expect(imported.warnings.some((w) => w.includes('schemaVersion') && /missing/i.test(w))).toBe(true);
    expect(imported.warnings.some((w) => w.includes('movement-core') && w.includes('traversal-core'))).toBe(true);
    expect(imported.fidelityReport.entries.some((f) => f.reason === 'schema-version-missing')).toBe(true);
    expect(imported.fidelityReport.entries.some((f) => f.reason === 'retired-module-remapped')).toBe(true);
  });

  it('names a pure phantom (faction-core) with no remapping', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromExportResult({
      ...exported,
      manifest: { ...exported.manifest, modules: [...exported.manifest.modules, 'faction-core'] },
    }));
    expect(imported.warnings.some((w) => w.includes('faction-core') && /no engine counterpart/i.test(w))).toBe(true);
    expect(imported.fidelityReport.entries.some((f) => f.reason === 'retired-module-phantom')).toBe(true);
  });
});

// --- F-8820cfd8: items / factionPresences / pressureHotspots participate in the hash ---

describe('F-8820cfd8: items/factionPresences/pressureHotspots change contentHash', () => {
  it('SIM_AFFECTING_KEYS contains the three previously-omitted ContentPack channels', () => {
    expect(SIM_AFFECTING_KEYS).toContain('items');
    expect(SIM_AFFECTING_KEYS).toContain('factionPresences');
    expect(SIM_AFFECTING_KEYS).toContain('pressureHotspots');
  });

  it('cloning a pack and mutating each of the three keys changes the digest', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const pack = exported.contentPack;
    const base = computeContentHash(pack);
    expect(base).toBe(exported.manifest.contentHash);

    const withItems = computeContentHash({
      ...pack,
      items: [...pack.items, { id: 'item-mutated', name: 'Mutated', description: 'x', slot: 'trinket' as const, rarity: 'common' as const }],
    });
    const withFactions = computeContentHash({
      ...pack,
      factionPresences: [...pack.factionPresences, { factionId: 'other', districtIds: [], influence: 1, alertLevel: 0 }],
    });
    const withHotspots = computeContentHash({
      ...pack,
      pressureHotspots: [...pack.pressureHotspots, { id: 'ph-mutated', zoneId: 'zone-entrance', pressureType: 'mutated', baseProbability: 0.1, tags: [] }],
    });
    expect(withItems).not.toBe(base);
    expect(withFactions).not.toBe(base);
    expect(withHotspots).not.toBe(base);
  });
});

// --- F-aa2c07bb: DROPPED_CONTAINERS warn when present; landmarks polarity flipped ---

describe('F-aa2c07bb: dropped town/stratum/transition/landmark layers are reported', () => {
  const droppedProject = (): WorldProject => ({
    ...minimalProject,
    buildings: [{
      id: 'b-inn', name: 'Inn', buildingType: 'tavern',
      gridX: 1, gridY: 1, width: 2, height: 2, tags: [],
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
    strata: [
      { id: 'surface', name: 'Surface', order: 0, tags: [] },
      { id: 'under', name: 'Under', order: -1, tags: [] },
    ],
    stratumLinks: [{
      id: 'l-stairs', fromStratumId: 'surface', toStratumId: 'under',
      bidirectional: true, linkType: 'stairs', fromZoneId: 'zone-entrance',
    }],
    transitions: [{
      id: 't-lift', zoneId: 'zone-entrance', targetZoneId: 'zone-cellar',
      type: 'elevator', label: 'Entrance → Cellar Lift',
    }],
    landmarks: [{
      id: 'lm-named', name: 'Named Stone', zoneId: 'zone-entrance',
      gridX: 2, gridY: 2, tags: [], description: 'A named landmark.',
      interactionType: 'inspect',
    }],
  });

  it('exportToEngine.warnings and fidelity.dropped mention each authored no-channel layer', () => {
    const result = exportToEngine(droppedProject());
    if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
    const joined = result.warnings.join('\n');
    expect(joined).toContain('building');
    expect(joined).toContain('hub');
    expect(joined).toContain('stronghold');
    expect(joined).toContain('stratum');
    expect(joined).toContain('stratum link');
    expect(joined).toContain('transition');
    expect(joined).toContain('landmark');
    const droppedReasons = result.fidelity.entries.filter((f) => f.level === 'dropped').map((f) => f.reason);
    expect(droppedReasons).toEqual(expect.arrayContaining([
      'buildings-dropped',
      'hubs-dropped',
      'strongholds-dropped',
      'strata-dropped',
      'stratum-links-dropped',
      'transitions-dropped',
      'landmarks-authored-and-dropped',
    ]));
  });

  it('CONTROL: empty leftover v4.5 arrays stay silent (craftingStations polarity)', () => {
    const result = exportToEngine({
      ...minimalProject,
      landmarks: [],
      buildings: [],
      hubs: [],
      strongholds: [],
      strata: [],
      stratumLinks: [],
      transitions: [],
    });
    if (!result.success) throw new Error('export failed');
    const noisy = result.warnings.filter((w) =>
      /building|hub\b|stronghold|stratum|transition|landmark/i.test(w),
    );
    expect(noisy).toEqual([]);
    const aaReasons = new Set([
      'buildings-dropped', 'hubs-dropped', 'strongholds-dropped',
      'strata-dropped', 'stratum-links-dropped', 'transitions-dropped',
      'landmarks-authored-and-dropped',
    ]);
    expect(result.fidelity.entries.filter((f) => aaReasons.has(f.reason))).toEqual([]);
  });
});

// --- F-d0f3a1ed: reverse maps go through safeLookup ---

describe('F-d0f3a1ed: reverse-map prototype keys miss instead of resolving Object.prototype', () => {
  it('genres: ["__proto__"] falls back to the raw string, not Object.prototype', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(
      exported.contentPack,
      'proto',
      stubMeta({ genres: ['__proto__'] as never }),
    ));
    expect(typeof imported.project.genre).toBe('string');
    expect(imported.project.genre).toBe('__proto__');
    expect(JSON.stringify(imported.project.genre)).not.toBe('{}');
  });

  it('genres: ["constructor"] falls back to the raw string, not the Object function', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(
      exported.contentPack,
      'ctor',
      stubMeta({ genres: ['constructor'] as never }),
    ));
    expect(typeof imported.project.genre).toBe('string');
    expect(imported.project.genre).toBe('constructor');
  });

  it('difficulty: "toString" falls back to intermediate, not Object.prototype.toString', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = requireImport(importFromContentPack(
      exported.contentPack,
      'toString',
      stubMeta({ difficulty: 'toString' as never }),
    ));
    expect(imported.project.difficulty).toBe('intermediate');
  });
});
