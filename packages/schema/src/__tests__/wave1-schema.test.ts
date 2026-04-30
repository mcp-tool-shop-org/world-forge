// wave1-schema.test.ts — coverage for Phase 7 Wave 1 schema additions:
//   SCH-FT-001 LootTable, SCH-FT-003 SpawnCondition grammar,
//   SCH-FT-004 TransitionEntity, SCH-FT-006 Zone physics overrides,
//   UE-FT-002 sky + lighting metadata, UE-FT-003 collision channel.

import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { parseSpawnCondition, validateSpawnCondition } from '../spawn-condition.js';
import { advisoryValidation } from '../advisory.js';
import type { WorldProject } from '../project.js';
import type { LootTable, LootTableEntry } from '../entities.js';
import type { TransitionEntity } from '../spatial.js';
import { minimalProject } from './fixtures/minimal.js';

// ── Helpers ─────────────────────────────────────────────────────
function clone(p: WorldProject): WorldProject {
  return JSON.parse(JSON.stringify(p));
}

function withLootTables(lts: LootTable[]): WorldProject {
  const p = clone(minimalProject);
  p.lootTables = lts;
  return p;
}

function withTransitions(ts: TransitionEntity[]): WorldProject {
  const p = clone(minimalProject);
  p.transitions = ts;
  return p;
}

// ── 0. Backward compat ──────────────────────────────────────────
describe('Wave 1: backward compat', () => {
  it('minimalProject (v4.2.x shape, no new fields) still validates', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('project without lootTables/transitions (undefined) validates clean', () => {
    const p = clone(minimalProject);
    // Explicitly assert those fields are undefined, not []
    expect(p.lootTables).toBeUndefined();
    expect(p.transitions).toBeUndefined();
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });
});

// ── 1. LootTable (SCH-FT-001) ──────────────────────────────────
describe('Wave 1: LootTable', () => {
  const sampleEntry: LootTableEntry = { itemId: 'item-torch', weight: 1 };

  it('accepts a happy-path loot table', () => {
    const p = withLootTables([
      { id: 'lt-chest', rolls: 2, entries: [sampleEntry, { itemId: 'item-torch', weight: 3 }], tags: ['chest'] },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate loot table ids (check #56)', () => {
    const p = withLootTables([
      { id: 'lt-dup', entries: [sampleEntry] },
      { id: 'lt-dup', entries: [sampleEntry] },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate loot table ID'))).toBe(true);
  });

  it('rejects empty entries array', () => {
    const p = withLootTables([{ id: 'lt-empty', entries: [] }]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('must contain at least one entry'))).toBe(true);
  });

  it('rejects non-positive or non-finite weights (check #57)', () => {
    const p = withLootTables([
      {
        id: 'lt-bad-wt',
        entries: [
          { itemId: 'a', weight: 0 },
          { itemId: 'b', weight: -2 },
          { itemId: 'c', weight: NaN },
          { itemId: 'd', weight: Infinity },
        ],
      },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    const weightErrors = result.errors.filter((e) => e.message.includes('weight'));
    expect(weightErrors.length).toBe(4);
  });

  it('rejects invalid quantity bounds (check #58)', () => {
    const p = withLootTables([
      {
        id: 'lt-qty',
        entries: [
          { itemId: 'a', weight: 1, quantity: { min: 3, max: 1 } }, // min > max
          { itemId: 'b', weight: 1, quantity: { min: -1, max: 2 } }, // negative
          { itemId: 'c', weight: 1, quantity: { min: 1, max: Infinity } }, // infinite
        ],
      },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) => e.path.includes('quantity')).length).toBe(3);
  });

  it('rejects rolls < 1 or non-finite (check #58 rolls half)', () => {
    const p = withLootTables([
      { id: 'lt-rolls-a', rolls: 0, entries: [sampleEntry] },
      { id: 'lt-rolls-b', rolls: NaN, entries: [sampleEntry] },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) => e.path.includes('rolls')).length).toBe(2);
  });

  it('validates loot entry condition via SpawnCondition grammar', () => {
    const p = withLootTables([
      {
        id: 'lt-cond',
        entries: [
          { itemId: 'a', weight: 1, condition: 'random:0.2' },
          { itemId: 'b', weight: 1, condition: 'garbage-condition' },
        ],
      },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    const condErrs = result.errors.filter((e) => e.path.includes('condition'));
    expect(condErrs.length).toBe(1);
    expect(condErrs[0].message).toContain('garbage-condition');
  });

  it('ItemPlacement.lootTableId must reference an existing table', () => {
    const p = withLootTables([{ id: 'lt-known', entries: [sampleEntry] }]);
    p.itemPlacements = [
      ...p.itemPlacements,
      { itemId: 'item-chest', zoneId: 'zone-cellar', hidden: false, lootTableId: 'lt-missing' },
    ];
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('nonexistent loot table "lt-missing"'))).toBe(true);
  });
});

// ── 2. SpawnCondition grammar (SCH-FT-003) ─────────────────────
describe('Wave 1: SpawnCondition parse/validate', () => {
  it('parses always / never', () => {
    expect(parseSpawnCondition('always')).toEqual({ type: 'always' });
    expect(parseSpawnCondition('never')).toEqual({ type: 'never' });
  });

  it('parses random-probability', () => {
    expect(parseSpawnCondition('random:0.3')).toEqual({
      type: 'random-probability', params: { p: 0.3 },
    });
    expect(parseSpawnCondition('random:1')).toEqual({
      type: 'random-probability', params: { p: 1 },
    });
    expect(parseSpawnCondition('random:1.1')).toBeNull();
    expect(parseSpawnCondition('random:-0.1')).toBeNull();
    expect(parseSpawnCondition('random:abc')).toBeNull();
  });

  it('parses time-of-day', () => {
    expect(parseSpawnCondition('time:day')).toEqual({
      type: 'time-of-day', params: { when: 'day' },
    });
    expect(parseSpawnCondition('time:night')).toEqual({
      type: 'time-of-day', params: { when: 'night' },
    });
    expect(parseSpawnCondition('time:noon')).toBeNull();
  });

  it('parses quest-progress', () => {
    expect(parseSpawnCondition('quest:main:3')).toEqual({
      type: 'quest-progress', params: { id: 'main', stage: '3' },
    });
    expect(parseSpawnCondition('quest:main:started')).toEqual({
      type: 'quest-progress', params: { id: 'main', stage: 'started' },
    });
    expect(parseSpawnCondition('quest:main:')).toBeNull();
    expect(parseSpawnCondition('quest::3')).toBeNull();
  });

  it('parses faction-rep with comparators', () => {
    expect(parseSpawnCondition('faction:keepers:>50')).toEqual({
      type: 'faction-rep', params: { id: 'keepers', op: '>', value: 50 },
    });
    expect(parseSpawnCondition('faction:keepers:<=10')).toEqual({
      type: 'faction-rep', params: { id: 'keepers', op: '<=', value: 10 },
    });
    expect(parseSpawnCondition('faction:keepers:==0')).toEqual({
      type: 'faction-rep', params: { id: 'keepers', op: '==', value: 0 },
    });
    expect(parseSpawnCondition('faction:keepers:bad')).toBeNull();
  });

  it('parses player-level', () => {
    expect(parseSpawnCondition('level:>=5')).toEqual({
      type: 'player-level', params: { op: '>=', value: 5 },
    });
    expect(parseSpawnCondition('level:<10')).toEqual({
      type: 'player-level', params: { op: '<', value: 10 },
    });
    expect(parseSpawnCondition('level:5')).toBeNull(); // no comparator
  });

  it('returns null for unknown / empty strings', () => {
    expect(parseSpawnCondition('')).toBeNull();
    expect(parseSpawnCondition(undefined)).toBeNull();
    expect(parseSpawnCondition('nonsense')).toBeNull();
  });

  it('validateSpawnCondition: null for valid, string for invalid', () => {
    expect(validateSpawnCondition('always')).toBeNull();
    expect(validateSpawnCondition(undefined)).toBeNull();
    expect(validateSpawnCondition('')).toBeNull();
    expect(validateSpawnCondition('garbage')).toContain('Unrecognized spawn condition');
  });

  it('validateProject flags invalid entity spawn condition (check #59)', () => {
    const p = clone(minimalProject);
    p.entityPlacements = [
      ...p.entityPlacements,
      { entityId: 'npc-bad', zoneId: 'zone-entrance', role: 'npc', spawnCondition: 'totally-bogus' },
    ];
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path.includes('spawnCondition') && e.message.includes('totally-bogus'),
    )).toBe(true);
  });

  it('validateProject accepts entity with valid spawn condition', () => {
    const p = clone(minimalProject);
    p.entityPlacements = [
      ...p.entityPlacements,
      { entityId: 'npc-ok', zoneId: 'zone-entrance', role: 'npc', spawnCondition: 'time:night' },
    ];
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });
});

// ── 3. TransitionEntity (SCH-FT-004) ───────────────────────────
describe('Wave 1: TransitionEntity', () => {
  const baseTransition: TransitionEntity = {
    id: 't-lift',
    zoneId: 'zone-entrance',
    targetZoneId: 'zone-cellar',
    type: 'elevator',
    durationSeconds: 2.5,
    label: 'Entrance → Cellar Lift',
  };

  it('accepts a happy-path transition', () => {
    const p = withTransitions([baseTransition]);
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate transition ids (check #60)', () => {
    const p = withTransitions([baseTransition, { ...baseTransition }]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate transition ID'))).toBe(true);
  });

  it('rejects transition referencing nonexistent zones (check #61)', () => {
    const p = withTransitions([
      { ...baseTransition, id: 't-bad-src', zoneId: 'zone-ghost' },
      { ...baseTransition, id: 't-bad-dst', targetZoneId: 'zone-phantom' },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('zone-ghost'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('zone-phantom'))).toBe(true);
  });

  it('rejects invalid durationSeconds (check #62)', () => {
    const p = withTransitions([
      { ...baseTransition, id: 't-neg', durationSeconds: -1 },
      { ...baseTransition, id: 't-nan', durationSeconds: NaN },
      { ...baseTransition, id: 't-inf', durationSeconds: Infinity },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) => e.path.includes('durationSeconds')).length).toBe(3);
  });

  it('accepts duration of zero (instant) and missing duration', () => {
    const p = withTransitions([
      { ...baseTransition, id: 't-instant', durationSeconds: 0 },
      { ...baseTransition, id: 't-nodur', durationSeconds: undefined },
    ]);
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });
});

// ── 4. Zone gravity + physics (SCH-FT-006) ─────────────────────
describe('Wave 1: Zone gravity + physics overrides', () => {
  it('accepts gravity 0 (zero-g)', () => {
    const p = clone(minimalProject);
    p.zones[0].gravityOverride = 0;
    p.zones[0].physicsMode = 'zero-g';
    p.zones[0].gravityDirection = 'none';
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });

  it('rejects non-finite gravity (check #63)', () => {
    const p = clone(minimalProject);
    p.zones[0].gravityOverride = NaN;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('gravityOverride'))).toBe(true);
  });

  it('space-mode station zone without physicsMode raises an advisory', () => {
    const p = clone(minimalProject);
    p.mode = 'space';
    p.zones[0].tags = [...p.zones[0].tags, 'station'];
    // Give it a warp/docking + elevation so we isolate the physicsMode advisory
    p.zones[0].elevation = 0;
    p.connections = [
      { fromZoneId: 'zone-entrance', toZoneId: 'zone-cellar', bidirectional: true, kind: 'docking' },
    ];
    const adv = advisoryValidation(p);
    expect(adv.items.some((i) =>
      i.path.includes('physicsMode') && i.message.includes(p.zones[0].id),
    )).toBe(true);
  });

  it('space-mode station zone WITH physicsMode does not raise the advisory', () => {
    const p = clone(minimalProject);
    p.mode = 'space';
    p.zones[0].tags = [...p.zones[0].tags, 'station'];
    p.zones[0].physicsMode = 'normal';
    const adv = advisoryValidation(p);
    expect(adv.items.some((i) => i.path.includes('physicsMode'))).toBe(false);
  });
});

// ── 5. Sky + lighting metadata (UE-FT-002) ─────────────────────
describe('Wave 1: Zone sky + lighting metadata', () => {
  it('accepts valid sky/lighting fields', () => {
    const p = clone(minimalProject);
    p.zones[0].skyAtmosphereRef = 'sky-dawn-preset';
    p.zones[0].directionalLightYaw = 45;
    p.zones[0].directionalLightPitch = -30;
    p.zones[0].skyLightIntensity = 1.5;
    p.zones[0].timeOfDay = 'dawn';
    const result = validateProject(p);
    expect(result.valid).toBe(true);
  });

  it('rejects out-of-range yaw / pitch / negative intensity (check #64)', () => {
    const p = clone(minimalProject);
    p.zones[0].directionalLightYaw = 400;
    p.zones[1].directionalLightPitch = 120;
    p.zones[0].skyLightIntensity = -0.5;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('directionalLightYaw'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('directionalLightPitch'))).toBe(true);
    expect(result.errors.some((e) => e.path.includes('skyLightIntensity'))).toBe(true);
  });

  it('rejects NaN light values', () => {
    const p = clone(minimalProject);
    p.zones[0].directionalLightYaw = NaN;
    p.zones[0].skyLightIntensity = NaN;
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.filter((e) =>
      e.path.includes('directionalLightYaw') || e.path.includes('skyLightIntensity'),
    ).length).toBeGreaterThanOrEqual(2);
  });
});

// ── 6. Collision channel (UE-FT-003) ───────────────────────────
describe('Wave 1: Zone collisionType', () => {
  it.each(['walkable', 'water', 'hazard', 'void', 'custom'] as const)(
    'accepts valid collisionType "%s"',
    (collisionType) => {
      const p = clone(minimalProject);
      p.zones[0].collisionType = collisionType;
      const result = validateProject(p);
      expect(result.valid).toBe(true);
    },
  );

  it('rejects unsupported collisionType on imported JSON (check #65)', () => {
    const p = clone(minimalProject);
    // Simulate a malformed JSON import — TS would block this at compile time.
    (p.zones[0] as unknown as { collisionType: string }).collisionType = 'lava';
    const result = validateProject(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path.includes('collisionType') && e.message.includes('lava'),
    )).toBe(true);
  });
});
