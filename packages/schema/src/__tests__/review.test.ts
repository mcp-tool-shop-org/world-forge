import { describe, it, expect } from 'vitest';
import { classifyHealth, buildReviewSnapshot } from '../review.js';
import type { WorldProject } from '../project.js';
import type { ValidationResult } from '../validate.js';
import type { DependencySummary } from '../dependencies.js';
import { chapelProject } from './fixtures/chapel-authored.js';

// Minimal valid project base
const base: WorldProject = {
  id: 'test', name: 'Test', description: 'A test project', version: '0.1.0',
  genre: 'fantasy', tones: [], difficulty: 'beginner', narratorTone: '',
  map: { id: 'm', name: 'M', description: '', gridWidth: 10, gridHeight: 10, tileSize: 32 },
  zones: [
    { id: 'z1', name: 'Zone 1', tags: [], description: '', gridX: 0, gridY: 0, gridWidth: 5, gridHeight: 5, neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [] },
  ],
  connections: [],
  districts: [],
  landmarks: [],
  factionPresences: [],
  pressureHotspots: [],
  dialogues: [],
  progressionTrees: [],
  entityPlacements: [],
  itemPlacements: [],
  encounterAnchors: [],
  spawnPoints: [{ id: 'sp1', zoneId: 'z1', gridX: 0, gridY: 0, isDefault: true }],
  craftingStations: [],
  marketNodes: [],
  tilesets: [],
  tileLayers: [],
  props: [],
  propPlacements: [],
  ambientLayers: [],
  assets: [],
  assetPacks: [],
};

function clone(overrides: Partial<WorldProject> = {}): WorldProject {
  return { ...structuredClone(base), ...overrides };
}

function cleanSummary(overrides: Partial<DependencySummary> = {}): DependencySummary {
  return { total: 0, ok: 0, broken: 0, mismatched: 0, orphaned: 0, informational: 0, ...overrides };
}

function validResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return { valid: true, errors: [], ...overrides };
}

// ── classifyHealth ──────────────────────────────────────────

describe('classifyHealth', () => {
  it('returns blocked when validation is invalid', () => {
    expect(classifyHealth(
      validResult({ valid: false, errors: [{ path: 'x', message: 'err' }] }),
      cleanSummary(),
    )).toBe('blocked');
  });

  it('returns degraded when broken deps exist', () => {
    expect(classifyHealth(validResult(), cleanSummary({ broken: 2 }))).toBe('degraded');
  });

  it('returns degraded when mismatched deps exist', () => {
    expect(classifyHealth(validResult(), cleanSummary({ mismatched: 1 }))).toBe('degraded');
  });

  it('returns healthy when only orphans exist', () => {
    expect(classifyHealth(validResult(), cleanSummary({ orphaned: 3 }))).toBe('healthy');
  });

  it('returns ready when fully clean', () => {
    expect(classifyHealth(validResult(), cleanSummary())).toBe('ready');
  });
});

// ── buildReviewSnapshot ─────────────────────────────────────

describe('buildReviewSnapshot', () => {
  it('produces a snapshot for empty/minimal project', () => {
    const snap = buildReviewSnapshot(base);
    expect(snap.projectName).toBe('Test');
    expect(snap.projectId).toBe('test');
    expect(snap.version).toBe('0.1.0');
    expect(snap.genre).toBe('fantasy');
    expect(snap.mode).toBe('dungeon'); // default
    expect(snap.modeLabel).toBe('Dungeon Crawl');
  });

  it('content counts match project arrays', () => {
    const proj = clone({
      zones: [
        base.zones[0],
        { ...base.zones[0], id: 'z2', name: 'Zone 2' },
      ],
      entityPlacements: [
        { entityId: 'e1', zoneId: 'z1', role: 'npc' as const },
      ],
      connections: [
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.counts.zones).toBe(2);
    expect(snap.counts.entities).toBe(1);
    expect(snap.counts.connections).toBe(1);
    expect(snap.counts.spawns).toBe(1);
  });

  it('detects missing systems', () => {
    const snap = buildReviewSnapshot(base);
    expect(snap.systems.hasPlayerTemplate).toBe(false);
    expect(snap.systems.hasBuildCatalog).toBe(false);
    expect(snap.systems.hasProgressionTrees).toBe(false);
    expect(snap.systems.hasDialogues).toBe(false);
    expect(snap.systems.hasSpawnPoints).toBe(true);
    expect(snap.systems.missingLabels).toContain('No player template');
    expect(snap.systems.missingLabels).toContain('No build catalog');
    expect(snap.systems.missingLabels).toContain('No dialogues');
  });

  it('detects present systems', () => {
    const snap = buildReviewSnapshot(chapelProject);
    expect(snap.systems.hasPlayerTemplate).toBe(true);
    expect(snap.systems.hasBuildCatalog).toBe(true);
    expect(snap.systems.hasProgressionTrees).toBe(true);
    expect(snap.systems.hasDialogues).toBe(true);
    expect(snap.systems.hasSpawnPoints).toBe(true);
    expect(snap.systems.missingLabels).toHaveLength(0);
  });

  it('computes region summaries from districts', () => {
    const proj = clone({
      zones: [
        base.zones[0],
        { ...base.zones[0], id: 'z2', name: 'Zone 2' },
      ],
      districts: [{
        id: 'd1', name: 'District 1', zoneIds: ['z1', 'z2'], tags: ['urban'],
        controllingFaction: 'faction-a',
        baseMetrics: { commerce: 50, morale: 60, safety: 70, stability: 80 },
        economyProfile: { supplyCategories: [], scarcityDefaults: {} },
      }],
      entityPlacements: [
        { entityId: 'e1', zoneId: 'z1', role: 'npc' as const },
        { entityId: 'e2', zoneId: 'z2', role: 'enemy' as const },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.regions).toHaveLength(1);
    expect(snap.regions[0].name).toBe('District 1');
    expect(snap.regions[0].zoneCount).toBe(2);
    expect(snap.regions[0].zoneNames).toEqual(['Zone 1', 'Zone 2']);
    expect(snap.regions[0].controllingFaction).toBe('faction-a');
    expect(snap.regions[0].metrics.commerce).toBe(50);
  });

  it('counts entity roles correctly in regions', () => {
    const proj = clone({
      districts: [{
        id: 'd1', name: 'D1', zoneIds: ['z1'], tags: [],
        baseMetrics: { commerce: 0, morale: 0, safety: 0, stability: 0 },
        economyProfile: { supplyCategories: [], scarcityDefaults: {} },
      }],
      entityPlacements: [
        { entityId: 'e1', zoneId: 'z1', role: 'npc' as const },
        { entityId: 'e2', zoneId: 'z1', role: 'npc' as const },
        { entityId: 'e3', zoneId: 'z1', role: 'enemy' as const },
        { entityId: 'e4', zoneId: 'z1', role: 'boss' as const },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.regions[0].entityCount).toBe(4);
    expect(snap.regions[0].entityRoles).toEqual({ npc: 2, enemy: 1, boss: 1 });
  });

  it('computes encounter summary by type', () => {
    const proj = clone({
      encounterAnchors: [
        { id: 'ea1', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [] },
        { id: 'ea2', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 1.0, cooldownTurns: 0, tags: ['boss'] },
        { id: 'ea3', zoneId: 'z1', encounterType: 'random-hostile', enemyIds: [], probability: 0.3, cooldownTurns: 5, tags: [] },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.encounters.totalCount).toBe(3);
    expect(snap.encounters.byType).toEqual({ combat: 2, 'random-hostile': 1 });
    expect(snap.encounters.bossEncounters).toBe(1);
  });

  it('computes average encounter probability', () => {
    const proj = clone({
      encounterAnchors: [
        { id: 'ea1', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [] },
        { id: 'ea2', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 1.0, cooldownTurns: 0, tags: [] },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.encounters.avgProbability).toBe(0.75);
  });

  it('detects boss encounters by tag', () => {
    const proj = clone({
      encounterAnchors: [
        { id: 'ea1', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 1.0, cooldownTurns: 0, tags: ['boss', 'undead'] },
        { id: 'ea2', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [] },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.encounters.bossEncounters).toBe(1);
  });

  it('computes connection summary by kind', () => {
    const proj = clone({
      zones: [
        base.zones[0],
        { ...base.zones[0], id: 'z2', name: 'Zone 2' },
        { ...base.zones[0], id: 'z3', name: 'Zone 3' },
      ],
      connections: [
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true, kind: 'door' as const },
        { fromZoneId: 'z2', toZoneId: 'z3', bidirectional: false, kind: 'secret' as const },
        { fromZoneId: 'z1', toZoneId: 'z3', bidirectional: true, kind: 'door' as const, condition: 'has-key' },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.connections.totalCount).toBe(3);
    expect(snap.connections.byKind).toEqual({ door: 2, secret: 1 });
    expect(snap.connections.bidirectionalCount).toBe(2);
    expect(snap.connections.oneWayCount).toBe(1);
  });

  it('counts conditional connections', () => {
    const proj = clone({
      zones: [
        base.zones[0],
        { ...base.zones[0], id: 'z2', name: 'Zone 2' },
      ],
      connections: [
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true, condition: 'has-key' },
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.connections.conditionalCount).toBe(1);
  });

  it('counts one-way vs bidirectional connections', () => {
    const proj = clone({
      zones: [
        base.zones[0],
        { ...base.zones[0], id: 'z2', name: 'Zone 2' },
      ],
      connections: [
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true },
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: false },
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: false },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.connections.bidirectionalCount).toBe(1);
    expect(snap.connections.oneWayCount).toBe(2);
  });

  it('groups validation errors by domain', () => {
    const proj = clone({
      spawnPoints: [], // will produce validation errors
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.validation.valid).toBe(false);
    expect(snap.validation.errorCount).toBeGreaterThan(0);
    expect(snap.validation.errorsByDomain['world']).toBeGreaterThan(0);
  });

  it('caps firstErrors to 5', () => {
    // Create many validation errors by duplicating zone IDs
    const proj = clone({
      zones: Array.from({ length: 10 }, (_, i) => ({
        ...base.zones[0],
        id: 'dup', name: `Zone ${i}`,
      })),
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.validation.firstErrors.length).toBeLessThanOrEqual(5);
  });

  it('computes advisory summary', () => {
    // Minimal project triggers advisory suggestions (e.g. less than 2 zones)
    const snap = buildReviewSnapshot(base);
    expect(snap.advisory.suggestionCount).toBeGreaterThan(0);
    expect(snap.advisory.firstSuggestions.length).toBeGreaterThan(0);
  });

  it('computes dependency health from scan', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
      assets: [{ id: 'orphan', kind: 'sprite', label: 'O', path: '/o.png', tags: [] }],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.dependencies.broken).toBeGreaterThan(0);
    expect(snap.dependencies.orphaned).toBeGreaterThan(0);
    expect(snap.dependencies.totalIssues).toBe(
      snap.dependencies.broken + snap.dependencies.mismatched + snap.dependencies.orphaned,
    );
  });

  it('populates mode label', () => {
    const proj = clone({ mode: 'ocean' });
    const snap = buildReviewSnapshot(proj);
    expect(snap.mode).toBe('ocean');
    expect(snap.modeLabel).toBe('Naval / Ocean');
  });

  it('is deterministic (same project, same output minus timestamp)', () => {
    const snap1 = buildReviewSnapshot(base);
    const snap2 = buildReviewSnapshot(base);
    // Compare everything except generatedAt
    const { generatedAt: _t1, ...rest1 } = snap1;
    const { generatedAt: _t2, ...rest2 } = snap2;
    expect(rest1).toEqual(rest2);
  });

  it('produces expected summary for chapel project', () => {
    const snap = buildReviewSnapshot(chapelProject);
    expect(snap.projectName).toBe('Chapel Threshold');
    expect(snap.counts.zones).toBe(5);
    expect(snap.counts.districts).toBe(2);
    expect(snap.counts.entities).toBe(4);
    expect(snap.counts.items).toBe(3);
    expect(snap.counts.encounters).toBe(1);
    expect(snap.counts.dialogues).toBe(1);
    expect(snap.regions).toHaveLength(2);
    expect(snap.encounters.bossEncounters).toBe(1);
    expect(snap.systems.hasPlayerTemplate).toBe(true);
    expect(snap.systems.hasBuildCatalog).toBe(true);
  });

  it('sets health correctly for healthy minimal project', () => {
    const snap = buildReviewSnapshot(base);
    // Base project has validation errors (only 1 zone → advisory only; but also orphaned assets etc.)
    // Base is actually valid with 1 spawn + 1 zone, no broken deps
    expect(snap.health).toBe('ready');
    expect(snap.healthLabel).toBe('Ready to export');
  });

  it('zonesWithEncounters counts distinct zones', () => {
    const proj = clone({
      encounterAnchors: [
        { id: 'ea1', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [] },
        { id: 'ea2', zoneId: 'z1', encounterType: 'random', enemyIds: [], probability: 0.3, cooldownTurns: 0, tags: [] },
      ],
    });
    const snap = buildReviewSnapshot(proj);
    expect(snap.encounters.zonesWithEncounters).toBe(1);
  });
});
