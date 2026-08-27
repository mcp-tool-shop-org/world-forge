// wave9-schema-amends.test.ts — Stage B Wave 9 schema findings.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateProject, SCHEMA_VERSION, stampProjectSchemaVersion } from '../validate.js';
import { buildReviewSnapshot, __resetClassifyDomainWarnings } from '../review.js';
import { scanDependencies } from '../dependencies.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { BuildCatalogDefinition } from '../build-catalog.js';

function clone(p: WorldProject): WorldProject {
  return JSON.parse(JSON.stringify(p)) as WorldProject;
}

const emptyCatalog: BuildCatalogDefinition = {
  statBudget: 10,
  maxTraits: 1,
  requiredFlaws: 0,
  archetypes: [],
  backgrounds: [],
  traits: [],
  disciplines: [],
  crossTitles: [],
  entanglements: [],
};

describe('F-a393af30: required map object + tones array', () => {
  it('rejects omitted map', () => {
    const p = clone(minimalProject);
    delete (p as { map?: unknown }).map;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'map')).toBe(true);
  });

  it('rejects map=null and map=[]', () => {
    for (const bad of [null, []]) {
      const result = validateProject({ ...minimalProject, map: bad } as unknown as WorldProject);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === 'map')).toBe(true);
    }
  });

  it('rejects tones as an object', () => {
    const result = validateProject({ ...minimalProject, tones: {} } as unknown as WorldProject);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'tones' && e.message.includes('to be an array'))).toBe(true);
  });
});

describe('F-63bcf524: finite / range numeric guards', () => {
  it('rejects NaN zone elevation', () => {
    const p = clone(minimalProject);
    p.zones[0].elevation = NaN;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('elevation') && !e.path.includes('elevationRange'))).toBe(true);
  });

  it('rejects NaN and non-positive map grid dims', () => {
    const nanMap = clone(minimalProject);
    nanMap.map.gridWidth = NaN;
    expect(validateProject(nanMap).errors.some((e) => e.path === 'map.gridWidth')).toBe(true);

    const zeroMap = clone(minimalProject);
    zeroMap.map.gridWidth = 0;
    expect(validateProject(zeroMap).errors.some((e) => e.path === 'map.gridWidth')).toBe(true);
  });

  it('rejects encounter probability NaN and > 1', () => {
    const p = clone(minimalProject);
    p.encounterAnchors[0].probability = NaN;
    expect(validateProject(p).errors.some((e) => e.path.includes('probability'))).toBe(true);

    const p2 = clone(minimalProject);
    p2.encounterAnchors[0].probability = 2.5;
    expect(validateProject(p2).errors.some((e) => e.path.includes('probability'))).toBe(true);
  });

  it('rejects NaN market priceModifier and ambient intensity', () => {
    const p = clone(minimalProject);
    p.marketNodes = [{ id: 'm1', zoneId: 'zone-entrance', supplyCategories: [], priceModifier: NaN, contrabandAvailable: false }];
    p.ambientLayers = [{ id: 'fog', name: 'Fog', zoneIds: ['zone-entrance'], type: 'fog', intensity: NaN }];
    const result = validateProject(p);
    expect(result.errors.some((e) => e.path.includes('priceModifier'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('intensity'))).toBe(true);
  });

  it('rejects building width/height that are not finite > 0', () => {
    const p = clone(minimalProject);
    p.buildings = [{
      id: 'b1', name: 'Hut', buildingType: 'house', gridX: 0, gridY: 0,
      width: -3, height: 0, tags: [],
    }];
    const result = validateProject(p);
    expect(result.errors.some((e) => e.path.includes('.width'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('.height'))).toBe(true);
  });

  it('rejects DistrictMetrics outside 0-100', () => {
    const p = clone(minimalProject);
    p.districts[0].baseMetrics.commerce = 200;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('commerce') && e.message.includes('[0, 100]'))).toBe(true);
  });
});

describe('F-57682903: closed-union runtime guards', () => {
  it('rejects AmbientLayer.type lava, EntityRole dragon, ItemSlot hat, ItemRarity mythic', () => {
    const p = clone(minimalProject);
    p.ambientLayers = [{ id: 'lava-glow', name: 'Lava', zoneIds: ['zone-entrance'], type: 'lava' as never, intensity: 0.4 }];
    p.entityPlacements[0].role = 'dragon' as never;
    p.itemPlacements[0].slot = 'hat' as never;
    p.itemPlacements[0].rarity = 'mythic' as never;
    const result = validateProject(p);
    expect(result.errors.some((e) => e.path.includes('ambientLayers') && e.message.includes('lava'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('.role') && e.message.includes('dragon'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('.slot') && e.message.includes('hat'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('.rarity') && e.message.includes('mythic'))).toBe(true);
  });

  it('rejects Interactable.type explode and Landmark.interactionType explode', () => {
    const p = clone(minimalProject);
    p.zones[0].interactables = [{ name: 'barrel', type: 'explode' as never }];
    p.landmarks[0].interactionType = 'explode' as never;
    const result = validateProject(p);
    expect(result.errors.some((e) => e.path.includes('interactables') && e.message.includes('explode'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('interactionType') && e.message.includes('explode'))).toBe(true);
  });
});

describe('F-eb1959c8: physicsMode + gravityDirection runtime guards', () => {
  it('rejects physicsMode narnia and gravityDirection sideways', () => {
    const p = clone(minimalProject);
    p.zones[0].physicsMode = 'narnia' as never;
    p.zones[0].gravityDirection = 'sideways' as never;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('physicsMode') && e.message.includes('narnia'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('gravityDirection') && e.message.includes('sideways'))).toBe(true);
  });

  it('accepts legal physicsMode / gravityDirection (control)', () => {
    const p = clone(minimalProject);
    p.zones[0].physicsMode = 'zero-g';
    p.zones[0].gravityDirection = 'none';
    expect(validateProject(p).valid).toBe(true);
  });
});

describe('F-9aaa76cf: leftover nested collections go through isArrayOrReport', () => {
  it('rejects parallaxLayers: {}', () => {
    const p = clone(minimalProject);
    (p.zones[0] as { parallaxLayers: unknown }).parallaxLayers = {};
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('parallaxLayers') && e.message.includes('to be an array'))).toBe(true);
  });

  it('rejects buildCatalog.backgrounds: {} and still errors defaultBackgroundId', () => {
    const p = clone(minimalProject);
    p.buildCatalog = { ...emptyCatalog, backgrounds: {} as never };
    p.playerTemplate = { ...p.playerTemplate!, defaultBackgroundId: 'ghost-bg' };
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'buildCatalog.backgrounds' && e.message.includes('to be an array'))).toBe(true);
    expect(result.errors.some((e) => e.path === 'playerTemplate.defaultBackgroundId' && e.message.includes('ghost-bg'))).toBe(true);
  });

  it('rejects hazardRefs: {} and visibleStrata: {}', () => {
    const p = clone(minimalProject);
    (p.zones[0] as { hazardRefs: unknown }).hazardRefs = {};
    p.strata = [{ id: 'surface', name: 'Surface', order: 0, tags: [], visibleStrata: {} as never }];
    const result = validateProject(p);
    expect(result.errors.some((e) => e.path.includes('hazardRefs') && e.message.includes('to be an array'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('visibleStrata') && e.message.includes('to be an array'))).toBe(true);
  });
});

describe('F-ada715a3: parentDistrictId + patrolRoutes.zoneIds', () => {
  it('rejects parentDistrictId that is not a district', () => {
    const p = clone(minimalProject);
    p.zones[0].parentDistrictId = 'district-ghost';
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('parentDistrictId') && e.message.includes('district-ghost'))).toBe(true);
  });

  it('rejects patrolRoutes.zoneIds pointing at a missing zone', () => {
    const p = clone(minimalProject);
    p.factionPresences[0].patrolRoutes = [{ zoneIds: ['zone-ghost'] }];
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('patrolRoutes') && e.message.includes('zone-ghost'))).toBe(true);
  });

  it('does not reject free-form encounter enemyIds (engine catalog ids)', () => {
    const p = clone(minimalProject);
    p.encounterAnchors[0].enemyIds = ['ghost-enemy'];
    const result = validateProject(p);
    expect(result.errors.filter((e) => e.message.includes('ghost-enemy'))).toEqual([]);
  });
});

describe('F-1560bc4b: ContentCounts covers v4.3–v4.5 catalogs', () => {
  it('counts one of each new catalog type', () => {
    const p = clone(minimalProject);
    p.lootTables = [{ id: 'lt1', entries: [{ itemId: 'engine-drop', weight: 1 }] }];
    p.transitions = [{
      id: 't1', zoneId: 'zone-entrance', targetZoneId: 'zone-cellar', type: 'elevator',
    }];
    p.buildings = [{
      id: 'b1', name: 'Inn', buildingType: 'tavern', gridX: 1, gridY: 1, width: 2, height: 2, tags: [],
    }];
    p.hubs = [{
      id: 'h1', name: 'Square', zoneId: 'zone-entrance', hubType: 'market-square',
      serviceTypes: ['market'], connectedZoneIds: [], tags: [],
    }];
    p.strongholds = [{
      id: 's1', name: 'Keep', zoneId: 'zone-entrance', defenseLevel: 2, garrisonEntityIds: [], tags: [],
    }];
    p.strata = [{ id: 'surface', name: 'Surface', order: 0, tags: [] }];
    p.hazardDefinitions = [{
      id: 'poison', name: 'Poison', trigger: 'on-enter', tags: [],
      effects: [{ kind: 'status', statusId: 'poison', chance: 0.4, stacking: 'refresh' }],
    }];
    p.tileLayers = [{ id: 'ground', name: 'Ground', zIndex: 0, tiles: [] }];
    const snap = buildReviewSnapshot(p);
    expect(snap.counts.lootTables).toBe(1);
    expect(snap.counts.transitions).toBe(1);
    expect(snap.counts.buildings).toBe(1);
    expect(snap.counts.hubs).toBe(1);
    expect(snap.counts.strongholds).toBe(1);
    expect(snap.counts.strata).toBe(1);
    expect(snap.counts.hazards).toBe(1);
    expect(snap.counts.tileLayers).toBe(1);
  });
});

describe('F-3c037170: buildings / lootTables prefixes do not warn', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetClassifyDomainWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a buildings.* / lootTables.* error does not warn', () => {
    const p = clone(minimalProject);
    p.buildings = [{
      id: 'b1', name: 'Hut', buildingType: 'house', gridX: 0, gridY: 0, width: 2, height: 2,
      zoneId: 'zone-ghost', tags: [],
    }];
    p.lootTables = [{ id: 'lt1', entries: [] }];
    buildReviewSnapshot(p);
    const text = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(text).not.toContain('"buildings"');
    expect(text).not.toContain('"lootTables"');
  });
});

describe('F-caf7c234: scanDependencies 2.5D asset edges', () => {
  it('ghost-sky and ghost-para produce broken edges', () => {
    const p = clone(minimalProject);
    p.zones[0].skylineRef = 'ghost-sky';
    p.zones[0].parallaxLayers = [
      { id: 'far', depth: 100, assetRef: 'ghost-para', scrollFactor: 0.5 },
    ];
    const report = scanDependencies(p);
    expect(report.edges.some((e) => e.fieldName === 'skylineRef' && e.status === 'broken' && e.targetId === 'ghost-sky')).toBe(true);
    expect(report.edges.some((e) => e.fieldName === 'parallaxLayers.assetRef' && e.status === 'broken' && e.targetId === 'ghost-para')).toBe(true);
  });

  it('kind mismatch on skylineRef / parallax assetRef is mismatched', () => {
    const p = clone(minimalProject);
    p.assets = [
      { id: 'icon-1', kind: 'icon', label: 'I', path: '/i.png', tags: [] },
      { id: 'tiles-1', kind: 'tileset', label: 'T', path: '/t.png', tags: [] },
    ];
    p.zones[0].skylineRef = 'tiles-1';
    p.zones[0].parallaxLayers = [
      { id: 'far', depth: 100, assetRef: 'icon-1', scrollFactor: 0.5 },
    ];
    const report = scanDependencies(p);
    expect(report.edges.some((e) => e.fieldName === 'skylineRef' && e.status === 'mismatched')).toBe(true);
    expect(report.edges.some((e) => e.fieldName === 'parallaxLayers.assetRef' && e.status === 'mismatched')).toBe(true);
  });
});

describe('F-b5ad26a4: scanDependencies zone-ref edges for placement layer', () => {
  it('emits broken zone-ref edges for entity/item/landmark/building/transition/hotspot', () => {
    const p = clone(minimalProject);
    p.entityPlacements[0].zoneId = 'zone-ghost';
    p.itemPlacements[0].zoneId = 'zone-ghost';
    p.landmarks[0].zoneId = 'zone-ghost';
    p.craftingStations = [{ id: 'cs1', zoneId: 'zone-ghost', stationType: 'forge', availableRecipes: [] }];
    p.marketNodes = [{ id: 'mn1', zoneId: 'zone-ghost', supplyCategories: [], priceModifier: 1, contrabandAvailable: false }];
    p.buildings = [{
      id: 'b1', name: 'Hut', buildingType: 'house', gridX: 0, gridY: 0, width: 2, height: 2,
      zoneId: 'zone-ghost', tags: [],
    }];
    p.hubs = [{
      id: 'h1', name: 'Square', zoneId: 'zone-ghost', hubType: 'market-square',
      serviceTypes: [], connectedZoneIds: ['zone-ghost'], tags: [],
    }];
    p.strongholds = [{
      id: 's1', name: 'Keep', zoneId: 'zone-ghost', defenseLevel: 1, garrisonEntityIds: [], tags: [],
    }];
    p.transitions = [{
      id: 't1', zoneId: 'zone-ghost', targetZoneId: 'zone-ghost', type: 'elevator',
    }];
    p.propPlacements = [{ id: 'pp1', propId: 'missing', gridX: 0, gridY: 0, zoneId: 'zone-ghost' }];
    p.pressureHotspots[0].zoneId = 'zone-ghost';
    const report = scanDependencies(p);
    const broken = report.edges.filter((e) => e.domain === 'zone-ref' && e.status === 'broken' && e.targetId === 'zone-ghost');
    const sources = new Set(broken.map((e) => e.sourceType));
    expect([...sources]).toEqual(expect.arrayContaining([
      'entityPlacement', 'itemPlacement', 'landmark', 'craftingStation', 'marketNode',
      'building', 'hub', 'stronghold', 'transition', 'propPlacement', 'pressureHotspot',
    ]));
  });
});

describe('F-7876b1d3: WorldProject.schemaVersion stamp helper', () => {
  it('stamps SCHEMA_VERSION when missing', () => {
    const stamped = stampProjectSchemaVersion(clone(minimalProject));
    expect(stamped.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it('leaves an existing schemaVersion alone', () => {
    const p = clone(minimalProject);
    p.schemaVersion = '4.0.0';
    expect(stampProjectSchemaVersion(p).schemaVersion).toBe('4.0.0');
  });

  it('omitted project.schemaVersion still validates (pre-stamp v4.x)', () => {
    expect(minimalProject.schemaVersion).toBeUndefined();
    expect(validateProject(minimalProject).valid).toBe(true);
  });
});

describe('F-504ca98b: schemaVersion is always present on ValidationResult', () => {
  it('is a required string on a valid result', () => {
    const result = validateProject(minimalProject);
    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect(result.errorCount).toBe(result.errors.length);
  });
});
