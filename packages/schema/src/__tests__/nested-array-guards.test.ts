// nested-array-guards.test.ts — F-5142b53f
//
// validateProject threw on omitted nested arrays (zone.exits, zone.neighbors,
// hazard.effects, hub.connectedZoneIds, stronghold.garrisonEntityIds,
// district.zoneIds, tileset.tiles, tileLayer.tiles, playerTemplate.startingInventory,
// dialogue.nodes, buildCatalog.archetypes) and on non-string spawn conditions.
// Every path must return ValidationResult.

import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { validateSpawnCondition } from '../spawn-condition.js';
import { buildReviewSnapshot } from '../review.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { ValidationResult } from '../validate.js';
import type { Hub, Stronghold } from '../town.js';
import type { HazardDefinition } from '../hazard.js';
import type { BuildCatalogDefinition } from '../build-catalog.js';

function clone(p: WorldProject): WorldProject {
  return JSON.parse(JSON.stringify(p)) as WorldProject;
}

function run(project: WorldProject): ValidationResult {
  let result: ValidationResult | undefined;
  expect(() => {
    result = validateProject(project);
  }).not.toThrow();
  return result!;
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

describe('nested array guards (F-5142b53f)', () => {
  it('does not throw when zone.exits is omitted; present-non-array is valid:false', () => {
    const omitted = clone(minimalProject);
    delete (omitted.zones[0] as { exits?: unknown }).exits;
    const omittedResult = run(omitted);
    expect(omittedResult.valid).toBe(false);
    expect(omittedResult.errors.some((e) => e.path.includes('.exits'))).toBe(true);

    const corrupted = clone(minimalProject);
    (corrupted.zones[0] as { exits: unknown }).exits = 'nope';
    const corruptedResult = run(corrupted);
    expect(corruptedResult.valid).toBe(false);
    expect(corruptedResult.errors.some((e) => e.path.includes('.exits'))).toBe(true);
  });

  it('does not throw when zone.neighbors is omitted', () => {
    const p = clone(minimalProject);
    delete (p.zones[0] as { neighbors?: unknown }).neighbors;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.neighbors'))).toBe(true);
  });

  it('does not throw when district.zoneIds is omitted', () => {
    const p = clone(minimalProject);
    delete (p.districts[0] as { zoneIds?: unknown }).zoneIds;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('.zoneIds'))).toBe(true);
  });

  it('does not throw when hazard.effects is omitted or a string', () => {
    const baseHazard: HazardDefinition = {
      id: 'lava', name: 'Lava', trigger: 'on-enter', tags: [],
      effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-end' }],
    };
    const omitted: WorldProject = { ...clone(minimalProject), hazardDefinitions: [{ ...baseHazard }] };
    delete (omitted.hazardDefinitions![0] as { effects?: unknown }).effects;
    const omittedResult = run(omitted);
    expect(omittedResult.valid).toBe(false);
    expect(omittedResult.errors.some((e) => e.path.includes('.effects'))).toBe(true);

    const asString: WorldProject = {
      ...clone(minimalProject),
      hazardDefinitions: [{ ...baseHazard, effects: 'nope' as unknown as HazardDefinition['effects'] }],
    };
    const stringResult = run(asString);
    expect(stringResult.valid).toBe(false);
    expect(stringResult.errors.some((e) => e.path.includes('.effects') && e.message.includes('to be an array'))).toBe(true);
    expect(stringResult.errors.filter((e) => e.message.includes('unsupported effect kind')).length).toBe(0);
  });

  it('does not throw when hub.connectedZoneIds is omitted', () => {
    const hub: Hub = {
      id: 'h-square', name: 'Square', zoneId: 'zone-entrance',
      hubType: 'market-square', serviceTypes: ['market'], tags: [],
      connectedZoneIds: [],
    };
    const p: WorldProject = { ...clone(minimalProject), hubs: [hub] };
    delete (p.hubs![0] as { connectedZoneIds?: unknown }).connectedZoneIds;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('connectedZoneIds'))).toBe(true);
  });

  it('does not throw when stronghold.garrisonEntityIds is omitted', () => {
    const stronghold: Stronghold = {
      id: 's-keep', name: 'Keep', zoneId: 'zone-entrance',
      defenseLevel: 3, garrisonEntityIds: [], tags: [],
    };
    const p: WorldProject = { ...clone(minimalProject), strongholds: [stronghold] };
    delete (p.strongholds![0] as { garrisonEntityIds?: unknown }).garrisonEntityIds;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('garrisonEntityIds'))).toBe(true);
  });

  it('does not throw when tileset.tiles is omitted', () => {
    const p: WorldProject = {
      ...clone(minimalProject),
      tilesets: [{ id: 'ts1', name: 'Stone', tileWidth: 32, tileHeight: 32, tiles: [] }],
    };
    delete (p.tilesets[0] as { tiles?: unknown }).tiles;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('tilesets') && e.path.includes('.tiles'))).toBe(true);
  });

  it('does not throw when tileLayer.tiles is omitted', () => {
    const p: WorldProject = {
      ...clone(minimalProject),
      tileLayers: [{ id: 'layer1', name: 'Ground', zIndex: 0, tiles: [] }],
    };
    delete (p.tileLayers[0] as { tiles?: unknown }).tiles;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('tileLayers') && e.path.includes('.tiles'))).toBe(true);
  });

  it('does not throw when playerTemplate.startingInventory is omitted', () => {
    const p = clone(minimalProject);
    delete (p.playerTemplate as { startingInventory?: unknown }).startingInventory;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'playerTemplate.startingInventory')).toBe(true);
  });

  it('does not throw when dialogue.nodes is omitted', () => {
    const p = clone(minimalProject);
    delete (p.dialogues[0] as { nodes?: unknown }).nodes;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('dialogues') && e.path.endsWith('.nodes'))).toBe(true);
  });

  it('does not throw when buildCatalog.archetypes is omitted', () => {
    const catalog = { ...emptyCatalog };
    delete (catalog as { archetypes?: unknown }).archetypes;
    const p: WorldProject = { ...clone(minimalProject), buildCatalog: catalog };
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'buildCatalog.archetypes')).toBe(true);
  });
});

describe('non-string spawn conditions (F-5142b53f)', () => {
  it('validateSpawnCondition(123) does not throw and rejects', () => {
    let err: string | null = 'unset';
    expect(() => {
      err = validateSpawnCondition(123);
    }).not.toThrow();
    expect(err).not.toBeNull();
    expect(err).toContain('must be a string');
  });

  it('entity spawnCondition number does not throw; valid:false', () => {
    const p = clone(minimalProject);
    (p.entityPlacements[0] as { spawnCondition?: unknown }).spawnCondition = 123;
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('spawnCondition') && e.message.includes('must be a string'))).toBe(true);
  });

  it('entryGate.conditions mixed array [always, 123] does not throw; valid:false', () => {
    const p = clone(minimalProject);
    p.zones = p.zones.map((z, i) =>
      i === 0
        ? { ...z, entryGate: { conditions: ['always', 123] as unknown as string[], mode: 'hard' } }
        : z,
    );
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('entryGate.conditions') && e.message.includes('must be a string'))).toBe(true);
  });

  it('entryGate.conditions set to 123 does not throw and reports a non-array, not "at least one condition"', () => {
    const p = clone(minimalProject);
    p.zones = p.zones.map((z, i) =>
      i === 0
        ? { ...z, entryGate: { conditions: 123 as unknown as string[], mode: 'hard' } }
        : z,
    );
    const result = run(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('entryGate.conditions') && e.message.includes('to be an array'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('must have at least one condition'))).toBe(false);
  });
});

describe('buildReviewSnapshot omitted nested arrays (class-fix with F-5142b53f)', () => {
  it('does not throw when assets is omitted; health is blocked', () => {
    const p = { ...clone(minimalProject) } as unknown as WorldProject;
    delete (p as { assets?: unknown }).assets;
    let snap: ReturnType<typeof buildReviewSnapshot> | undefined;
    expect(() => {
      snap = buildReviewSnapshot(p);
    }).not.toThrow();
    expect(snap!.validation.valid).toBe(false);
    expect(snap!.health).toBe('blocked');
  });

  it('does not throw when zones is a non-array and assets is missing', () => {
    const p = { ...clone(minimalProject), zones: 'nope' } as unknown as WorldProject;
    delete (p as { assets?: unknown }).assets;
    let snap: ReturnType<typeof buildReviewSnapshot> | undefined;
    expect(() => {
      snap = buildReviewSnapshot(p);
    }).not.toThrow();
    expect(snap!.validation.valid).toBe(false);
    expect(snap!.health).toBe('blocked');
  });

  it('does not throw when district.zoneIds is omitted', () => {
    const p = clone(minimalProject);
    delete (p.districts[0] as { zoneIds?: unknown }).zoneIds;
    expect(() => buildReviewSnapshot(p)).not.toThrow();
  });
});
