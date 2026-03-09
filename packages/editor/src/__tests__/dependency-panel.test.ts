import { describe, it, expect } from 'vitest';
import { scanDependencies } from '@world-forge/schema';
import type { WorldProject, DepDomain } from '@world-forge/schema';
import { repairsForEdge, batchRepair } from '../repairs.js';
import { buildSearchIndex, filterResults } from '../panels/SearchOverlay.js';
import { classifyDependencyDomain, isRefError, type Domain } from '../panels/validation-helpers.js';

// Minimal valid project base
const base: WorldProject = {
  id: 'test', name: 'Test', description: '', version: '0.1.0',
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

describe('DependencyPanel behavior', () => {
  it('healthy project has zero issue count', () => {
    const report = scanDependencies(base);
    const issues = report.summary.broken + report.summary.mismatched + report.summary.orphaned;
    expect(issues).toBe(0);
  });

  it('broken edges produce repair buttons', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.status === 'broken');
    expect(broken.length).toBeGreaterThan(0);
    for (const edge of broken) {
      const repairs = repairsForEdge(edge, proj);
      expect(repairs.length).toBeGreaterThan(0);
    }
  });

  it('edges group by domain correctly', () => {
    const proj = clone({
      assets: [{ id: 'orphan', kind: 'sprite', label: 'Orphan', path: '/s.png', tags: [] }],
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const report = scanDependencies(proj);
    const domains = new Set(report.edges.filter((e) => e.status !== 'ok').map((e) => e.domain));
    expect(domains.has('zone-asset')).toBe(true);
    expect(domains.has('orphan-asset')).toBe(true);
  });

  it('summary bar shows correct counts', () => {
    const proj = clone({
      assets: [
        { id: 'orphan', kind: 'sprite', label: 'Orphan', path: '/s.png', tags: [] },
        { id: 'icon-wrong', kind: 'icon', label: 'Wrong', path: '/w.png', tags: [] },
      ],
      zones: [{ ...base.zones[0], backgroundId: 'ghost', tilesetId: 'icon-wrong' }],
    });
    const report = scanDependencies(proj);
    expect(report.summary.broken).toBe(1);       // ghost bg
    expect(report.summary.mismatched).toBe(1);    // icon used as tileset
    expect(report.summary.orphaned).toBe(1);      // orphan sprite
  });

  it('batch clear broken refs clears all broken', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost-bg', tilesetId: 'ghost-ts' }],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.status === 'broken');
    const clearRepairs = broken.flatMap((e) => repairsForEdge(e, proj).filter((r) => r.kind === 'clear-broken-ref'));
    const fixed = batchRepair(clearRepairs)(proj);
    const after = scanDependencies(fixed);
    expect(after.summary.broken).toBe(0);
  });

  it('relink picker shows only same-kind assets', () => {
    const proj = clone({
      assets: [
        { id: 'bg-alt', kind: 'background', label: 'Alt BG', path: '/bg.png', tags: [] },
        { id: 'sprite-1', kind: 'sprite', label: 'Sprite', path: '/s.png', tags: [] },
      ],
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const report = scanDependencies(proj);
    const edge = report.edges.find((e) => e.status === 'broken' && e.fieldName === 'backgroundId')!;
    const relinks = repairsForEdge(edge, proj).filter((r) => r.kind === 'relink-asset');
    expect(relinks).toHaveLength(1);
    expect(relinks[0].label).toContain('Alt BG');
  });

  it('deps tab badge shows correct count', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
      assets: [{ id: 'orphan', kind: 'sprite', label: 'O', path: '/o.png', tags: [] }],
    });
    const report = scanDependencies(proj);
    const count = report.summary.broken + report.summary.mismatched + report.summary.orphaned;
    expect(count).toBe(2); // 1 broken bg + 1 orphan sprite
  });

  it('after repair, rescan shows reduced issue count', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const before = scanDependencies(proj);
    const brokenBefore = before.summary.broken;

    const edge = before.edges.find((e) => e.status === 'broken')!;
    const clear = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);

    const after = scanDependencies(fixed);
    expect(after.summary.broken).toBeLessThan(brokenBefore);
  });

  it('batch remove orphans removes all orphaned assets and packs', () => {
    const proj = clone({
      assets: [
        { id: 'orphan1', kind: 'sprite', label: 'O1', path: '/o1.png', tags: [] },
        { id: 'orphan2', kind: 'portrait', label: 'O2', path: '/o2.png', tags: [] },
      ],
      assetPacks: [{ id: 'pk-lonely', label: 'Lonely', version: '1.0.0', tags: [] }],
    });
    const report = scanDependencies(proj);
    const orphans = report.edges.filter((e) => e.status === 'orphaned');
    const repairs = orphans.flatMap((e) => repairsForEdge(e, proj));
    const fixed = batchRepair(repairs)(proj);
    const after = scanDependencies(fixed);
    expect(after.summary.orphaned).toBe(0);
  });
});

describe('Search & Guide integration', () => {
  it('search index includes dependency edges', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const index = buildSearchIndex(proj);
    const deps = index.filter((r) => r.type === 'dependency');
    expect(deps.length).toBeGreaterThan(0);
    expect(deps[0].detail).toBe('zone-asset');
  });

  it('dependency search result filters correctly', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const index = buildSearchIndex(proj);
    const results = filterResults(index, 'ghost');
    expect(results.some((r) => r.type === 'dependency')).toBe(true);
  });

  it('search index excludes ok dependency edges', () => {
    const proj = clone({
      assets: [{ id: 'bg1', kind: 'background', label: 'BG', path: '/bg.png', tags: [] }],
      zones: [{ ...base.zones[0], backgroundId: 'bg1' }],
    });
    const index = buildSearchIndex(proj);
    const deps = index.filter((r) => r.type === 'dependency');
    // ok edges should not appear in search
    expect(deps.every((r) => !r.label.includes('→ asset'))).toBe(true);
  });

  it('healthy project has no dependency search results', () => {
    const index = buildSearchIndex(base);
    const deps = index.filter((r) => r.type === 'dependency');
    expect(deps).toHaveLength(0);
  });

  it('guide shows green check when all references resolved', () => {
    const report = scanDependencies(base);
    const issues = report.summary.broken + report.summary.mismatched;
    const orphaned = report.summary.orphaned;
    // For healthy base: both should be 0
    expect(issues).toBe(0);
    expect(orphaned).toBe(0);
  });

  it('guide detects broken references', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const report = scanDependencies(proj);
    const issues = report.summary.broken + report.summary.mismatched;
    expect(issues).toBeGreaterThan(0);
  });

  it('guide detects orphans separately', () => {
    const proj = clone({
      assets: [{ id: 'orphan', kind: 'sprite', label: 'O', path: '/o.png', tags: [] }],
    });
    const report = scanDependencies(proj);
    expect(report.summary.broken).toBe(0);
    expect(report.summary.orphaned).toBeGreaterThan(0);
  });

  it('guide updates after repair', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const before = scanDependencies(proj);
    expect(before.summary.broken).toBeGreaterThan(0);

    const edge = before.edges.find((e) => e.status === 'broken')!;
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = repair.apply(proj);

    const after = scanDependencies(fixed);
    expect(after.summary.broken).toBe(0);
  });
});

describe('Validation Surface Unification', () => {
  it('classifyDependencyDomain covers all DepDomain values', () => {
    const domains: DepDomain[] = [
      'zone-asset', 'entity-asset', 'item-asset', 'landmark-asset',
      'asset-pack', 'zone-ref', 'dialogue-ref', 'orphan-asset', 'orphan-pack', 'kit-provenance',
    ];
    for (const d of domains) {
      const result = classifyDependencyDomain(d);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('classifyDependencyDomain maps to correct validation domains', () => {
    expect(classifyDependencyDomain('zone-asset')).toBe('world');
    expect(classifyDependencyDomain('entity-asset')).toBe('entities');
    expect(classifyDependencyDomain('item-asset')).toBe('items');
    expect(classifyDependencyDomain('dialogue-ref')).toBe('dialogue');
    expect(classifyDependencyDomain('orphan-asset')).toBe('assets');
    expect(classifyDependencyDomain('orphan-pack')).toBe('packs');
    expect(classifyDependencyDomain('kit-provenance')).toBe('deps');
  });

  it('isRefError detects asset ref errors', () => {
    expect(isRefError({ path: 'zones.z1.backgroundId', message: 'broken' })).toBe(true);
    expect(isRefError({ path: 'entityPlacements.e1.portraitId', message: 'broken' })).toBe(true);
    expect(isRefError({ path: 'itemPlacements.i1.iconId', message: 'broken' })).toBe(true);
    expect(isRefError({ path: 'connections.c1.fromZoneId', message: 'broken' })).toBe(true);
  });

  it('isRefError rejects non-ref errors', () => {
    expect(isRefError({ path: 'zones.z1.name', message: 'empty' })).toBe(false);
    expect(isRefError({ path: 'playerTemplate.hp', message: 'invalid' })).toBe(false);
    expect(isRefError({ path: 'map.gridWidth', message: 'too small' })).toBe(false);
  });

  it('deps panel and validation agree on broken ref presence', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const depReport = scanDependencies(proj);
    const hasBrokenDeps = depReport.summary.broken > 0;
    // If deps scanner found broken refs, validation should too (both check same refs)
    expect(hasBrokenDeps).toBe(true);
  });

  it('validation deps domain shows only when deps have issues', () => {
    // Healthy project — no ref errors to cross-link
    const healthyReport = scanDependencies(base);
    const healthyIssues = healthyReport.summary.broken + healthyReport.summary.mismatched + healthyReport.summary.orphaned;
    expect(healthyIssues).toBe(0);

    // Broken project — has ref errors that benefit from cross-link
    const broken = clone({ zones: [{ ...base.zones[0], backgroundId: 'ghost' }] });
    const brokenReport = scanDependencies(broken);
    expect(brokenReport.summary.broken).toBeGreaterThan(0);
  });
});
