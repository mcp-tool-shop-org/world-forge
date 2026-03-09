import { describe, it, expect } from 'vitest';
import { scanDependencies } from '@world-forge/schema';
import type { WorldProject } from '@world-forge/schema';
import { serializeProject, prepareProjectImport } from '../projects/bundle.js';

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

describe('Import/Export dependency health integration', () => {
  it('export bundle includes dependencyHealth in dependencies', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const bundle = serializeProject(proj);
    expect(bundle.dependencies.dependencyHealth).toBeDefined();
    expect(bundle.dependencies.dependencyHealth!.broken).toBe(1);
  });

  it('export bundle dependencyHealth matches scan results', () => {
    const proj = clone({
      assets: [{ id: 'orphan', kind: 'sprite', label: 'O', path: '/o.png', tags: [] }],
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const bundle = serializeProject(proj);
    const report = scanDependencies(proj);
    expect(bundle.dependencies.dependencyHealth!.broken).toBe(report.summary.broken);
    expect(bundle.dependencies.dependencyHealth!.mismatched).toBe(report.summary.mismatched);
    expect(bundle.dependencies.dependencyHealth!.orphaned).toBe(report.summary.orphaned);
  });

  it('serializeProject with healthy project produces zero health counts', () => {
    const bundle = serializeProject(base);
    expect(bundle.dependencies.dependencyHealth!.broken).toBe(0);
    expect(bundle.dependencies.dependencyHealth!.mismatched).toBe(0);
    expect(bundle.dependencies.dependencyHealth!.orphaned).toBe(0);
  });

  it('serializeProject with broken refs produces correct health', () => {
    const proj = clone({
      assets: [{ id: 'icon-wrong', kind: 'icon', label: 'Wrong', path: '/w.png', tags: [] }],
      zones: [{ ...base.zones[0], backgroundId: 'icon-wrong' }],
    });
    const bundle = serializeProject(proj);
    expect(bundle.dependencies.dependencyHealth!.mismatched).toBe(1);
  });

  it('import preview detects dependency issues for project-bundle', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const bundle = serializeProject(proj);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const report = scanDependencies(result.project);
    expect(report.summary.broken).toBeGreaterThan(0);
  });

  it('import preview shows no issues for healthy project-bundle', () => {
    const bundle = serializeProject(base);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const report = scanDependencies(result.project);
    expect(report.summary.broken).toBe(0);
    expect(report.summary.mismatched).toBe(0);
  });

  it('import preview detects dependency issues for world-project format', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    // Direct scan on the project (simulating what ImportModal does for world-project)
    const report = scanDependencies(proj);
    expect(report.summary.broken).toBeGreaterThan(0);
  });

  it('dependency health survives round-trip through bundle', () => {
    const proj = clone({
      assets: [{ id: 'orphan', kind: 'sprite', label: 'O', path: '/o.png', tags: [] }],
    });
    const bundle = serializeProject(proj);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The embedded project should have the same dependency profile
    const reportBefore = scanDependencies(proj);
    const reportAfter = scanDependencies(result.project);
    expect(reportAfter.summary.orphaned).toBe(reportBefore.summary.orphaned);
  });
});
