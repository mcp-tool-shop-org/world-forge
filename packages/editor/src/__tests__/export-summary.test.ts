import { describe, it, expect } from 'vitest';
import { buildReviewSnapshot } from '@world-forge/schema';
import type { WorldProject } from '@world-forge/schema';
import { enrichReviewSnapshot } from '../panels/ReviewPanel.js';
import { reviewSnapshotToMarkdown, reviewSnapshotToJSON, summaryFilename } from '../review/export-summary.js';

// Minimal valid project
const base: WorldProject = {
  id: 'test', name: 'Test Project', description: 'A demo project', version: '0.1.0',
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

function makeEnriched(project: WorldProject = base) {
  const snap = buildReviewSnapshot(project);
  return enrichReviewSnapshot(snap, {
    activeKitId: null,
    importSourceFormat: null,
    projectBundleSource: null,
    importFidelityPercent: null,
    hasExported: false,
  });
}

function makeEnrichedWithProvenance(project: WorldProject = base) {
  const snap = buildReviewSnapshot(project);
  return enrichReviewSnapshot(snap, {
    activeKitId: 'chapel-kit',
    importSourceFormat: 'ai-rpg-v1',
    projectBundleSource: 'imported',
    importFidelityPercent: 95,
    hasExported: true,
  });
}

describe('reviewSnapshotToMarkdown', () => {
  it('contains project name heading', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).toContain('# Test Project — Review Summary');
  });

  it('contains health status', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).toContain('## Health: READY');
  });

  it('contains content count table', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).toContain('## Content Counts');
    expect(md).toContain('| zones | 1 |');
  });

  it('contains system completeness section', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).toContain('## System Completeness');
    expect(md).toContain('[x] Spawn Points');
    expect(md).toContain('[ ] Player Template');
  });

  it('contains region details when districts exist', () => {
    const proj = clone({
      districts: [{
        id: 'd1', name: 'Region A', zoneIds: ['z1'], tags: ['urban'],
        controllingFaction: 'faction-a',
        baseMetrics: { commerce: 50, morale: 60, safety: 70, stability: 80 },
        economyProfile: { supplyCategories: [], scarcityDefaults: {} },
      }],
    });
    const md = reviewSnapshotToMarkdown(makeEnriched(proj));
    expect(md).toContain('## Regions');
    expect(md).toContain('### Region A');
    expect(md).toContain('faction-a');
  });

  it('contains encounter summary when encounters exist', () => {
    const proj = clone({
      encounterAnchors: [
        { id: 'ea1', zoneId: 'z1', encounterType: 'combat', enemyIds: [], probability: 0.8, cooldownTurns: 0, tags: ['boss'] },
      ],
    });
    const md = reviewSnapshotToMarkdown(makeEnriched(proj));
    expect(md).toContain('## Encounters');
    expect(md).toContain('| combat | 1 |');
    expect(md).toContain('Boss Encounters');
  });

  it('contains connection summary when connections exist', () => {
    const proj = clone({
      zones: [base.zones[0], { ...base.zones[0], id: 'z2', name: 'Zone 2' }],
      connections: [
        { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true, kind: 'door' as const },
      ],
    });
    const md = reviewSnapshotToMarkdown(makeEnriched(proj));
    expect(md).toContain('## Connections');
    expect(md).toContain('| door | 1 |');
  });

  it('contains dependency section', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).toContain('## Dependencies');
    expect(md).toContain('All references resolved.');
  });

  it('contains validation section', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).toContain('## Validation');
    expect(md).toContain('No validation errors.');
  });

  it('contains provenance when present', () => {
    const md = reviewSnapshotToMarkdown(makeEnrichedWithProvenance());
    expect(md).toContain('## Provenance');
    expect(md).toContain('chapel-kit');
    expect(md).toContain('ai-rpg-v1');
    expect(md).toContain('95%');
  });

  it('omits provenance section when no import context', () => {
    const md = reviewSnapshotToMarkdown(makeEnriched());
    expect(md).not.toContain('## Provenance');
  });
});

describe('reviewSnapshotToJSON', () => {
  it('has stable field names', () => {
    const json = reviewSnapshotToJSON(makeEnriched()) as Record<string, unknown>;
    expect(json).toHaveProperty('project');
    expect(json).toHaveProperty('health');
    expect(json).toHaveProperty('counts');
    expect(json).toHaveProperty('systems');
    expect(json).toHaveProperty('regions');
    expect(json).toHaveProperty('encounters');
    expect(json).toHaveProperty('connections');
    expect(json).toHaveProperty('dependencies');
    expect(json).toHaveProperty('validation');
    expect(json).toHaveProperty('advisory');
    expect(json).toHaveProperty('provenance');
    expect(json).toHaveProperty('generatedAt');
  });

  it('includes all sections', () => {
    const json = reviewSnapshotToJSON(makeEnriched()) as Record<string, unknown>;
    const project = json.project as Record<string, unknown>;
    expect(project.name).toBe('Test Project');
    expect(project.genre).toBe('fantasy');
    const health = json.health as Record<string, unknown>;
    expect(health.status).toBe('ready');
  });

  it('is parseable (JSON.parse roundtrip)', () => {
    const json = reviewSnapshotToJSON(makeEnriched());
    const serialized = JSON.stringify(json, null, 2);
    const parsed = JSON.parse(serialized);
    expect(parsed.project.name).toBe('Test Project');
    expect(parsed.health.status).toBe('ready');
  });
});

describe('summaryFilename', () => {
  it('generates correct slugs', () => {
    expect(summaryFilename('Chapel Threshold', 'md')).toBe('chapel-threshold-review.md');
    expect(summaryFilename('Chapel Threshold', 'json')).toBe('chapel-threshold-review.json');
    expect(summaryFilename('My Cool World!', 'md')).toBe('my-cool-world-review.md');
    expect(summaryFilename('', 'md')).toBe('project-review.md');
  });
});
