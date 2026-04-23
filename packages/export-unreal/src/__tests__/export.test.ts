import { describe, it, expect } from 'vitest';
import { exportToUnreal } from '../export.js';
import { importFromUnreal } from '../import.js';
import { convertEntities } from '../convert-entities.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';

function withElevation(project: WorldProject): WorldProject {
  return {
    ...project,
    mode: 'space',
    // Declare the parallax + skyline assets the zone patches below reference.
    // Required since SCH-A-002/004 tightened validation to require matching AssetEntry.
    assets: [
      ...project.assets,
      { id: 'asset-sky', kind: 'background', label: 'Sky', path: 'bg/sky.png', tags: [] },
      { id: 'asset-mid', kind: 'background', label: 'Mid', path: 'bg/mid.png', tags: [] },
      { id: 'asset-skyline', kind: 'background', label: 'Skyline', path: 'bg/skyline.png', tags: [] },
    ],
    zones: project.zones.map((z, i) => ({
      ...z,
      elevation: i * 2,
      elevationRange: i === 0 ? undefined : { floor: -1, ceiling: 5 },
      parallaxLayers: i === 0
        ? [
            { id: 'sky', depth: 100, assetRef: 'asset-sky', scrollFactor: 0.1 },
            { id: 'mid', depth: 50, assetRef: 'asset-mid', scrollFactor: 0.5 },
          ]
        : undefined,
      skylineRef: i === 0 ? 'asset-skyline' : undefined,
    })),
  };
}

describe('exportToUnreal', () => {
  it('returns success for a minimal valid project', () => {
    const result = exportToUnreal(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.Zones.length).toBe(minimalProject.zones.length);
    expect(result.contentPack.Districts.length).toBe(minimalProject.districts.length);
    expect(result.contentPack.Connections.length).toBe(minimalProject.connections.length);
  });

  it('emits WorldPartition hints driven by authoring mode', () => {
    const result = exportToUnreal(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.WorldPartition.SourceMode).toBe('dungeon');
    // 20×20 tiles × 100 cm = 2000 cm on each axis; 2000 / 12800 → 1 cell each way.
    expect(result.contentPack.WorldPartition.CellsX).toBe(1);
    expect(result.contentPack.WorldPartition.CellsY).toBe(1);
  });

  it('preserves 2.5D fields through export (lossless fidelity)', () => {
    const project = withElevation(minimalProject);
    const result = exportToUnreal(project);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const zoneWithParallax = result.contentPack.Zones.find((z) => z.Id === 'zone-entrance');
    expect(zoneWithParallax?.ParallaxLayers).toBeDefined();
    expect(zoneWithParallax?.ParallaxLayers?.length).toBe(2);
    expect(zoneWithParallax?.SkylineAssetId).toBe('asset-skyline');

    const zoneWithRange = result.contentPack.Zones.find((z) => z.Id === 'zone-cellar');
    expect(zoneWithRange?.ElevationRangeCm).toEqual({ FloorCm: -100, CeilingCm: 500 });
    expect(zoneWithRange?.ElevationCm).toBe(200);

    const losslessElevation = result.fidelity.entries.some(
      (e) => e.domain === 'elevation' && e.level === 'lossless',
    );
    expect(losslessElevation).toBe(true);
  });

  it('warns when the world is entirely flat in a 2.5D context', () => {
    const result = exportToUnreal(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('elevation'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('parallax'))).toBe(true);
  });

  it('returns a validation error for an invalid project', () => {
    const broken: WorldProject = { ...minimalProject, spawnPoints: [] };
    const result = exportToUnreal(broken);
    expect(result.success).toBe(false);
  });

  it('persists SourceTileSizePx on pack meta for lossless round-trip', () => {
    const result = exportToUnreal(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.Meta.SourceTileSizePx).toBe(minimalProject.map.tileSize);
  });

  it('stamps FormatVersion on pack meta distinct from project Version (UE-B-010)', () => {
    // FormatVersion describes pack STRUCTURE; Version tracks the project's iteration.
    // Loaders should check FormatVersion, not Version, for compatibility breaks.
    const result = exportToUnreal(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.Meta.FormatVersion).toBe('1.0.0');
    expect(result.contentPack.Meta.Version).toBe(minimalProject.version);
  });

  it('rejects a non-finite tileSizeCm with a structured validation error (UE-B-001)', () => {
    const result = exportToUnreal(minimalProject, { tileSizeCm: Number.NaN });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].path).toBe('options.tileSizeCm');
    expect(result.errors[0].message).toContain('positive finite number');
  });

  it('rejects a non-positive tileSizeCm with a structured validation error (UE-B-001)', () => {
    const result = exportToUnreal(minimalProject, { tileSizeCm: -50 });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors[0].path).toBe('options.tileSizeCm');
  });

  it('returns a validation error for an empty project (0 zones)', () => {
    // UE-A-006: empty project — should fail cleanly via validateProject rather
    // than crashing the pipeline.
    const empty: WorldProject = {
      ...minimalProject,
      zones: [],
      connections: [],
      districts: [],
      landmarks: [],
      factionPresences: [],
      pressureHotspots: [],
      entityPlacements: [],
      itemPlacements: [],
      encounterAnchors: [],
      spawnPoints: [],
    };
    const result = exportToUnreal(empty);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('emits a dropped world-partition fidelity entry for zero-width map', () => {
    // UE-A-005 / UE-A-006: gridWidth=0 should emit a "dropped" world-partition
    // entry but still produce a structurally valid pack with clamped extent.
    const bad: WorldProject = {
      ...minimalProject,
      map: { ...minimalProject.map, gridWidth: 0 },
    };
    const result = exportToUnreal(bad);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.fidelity.entries.find(
      (e) => e.domain === 'world-partition' && e.level === 'dropped',
    );
    expect(entry).toBeDefined();
    expect(entry?.severity).toBe('warning');
    // Clamped output: extent must still be structurally valid.
    expect(result.contentPack.WorldPartition.CellsX).toBeGreaterThanOrEqual(1);
    expect(result.contentPack.WorldPartition.CellsY).toBeGreaterThanOrEqual(1);
  });

  it('emits a dropped world-partition fidelity entry for zero-height map', () => {
    const bad: WorldProject = {
      ...minimalProject,
      map: { ...minimalProject.map, gridHeight: 0 },
    };
    const result = exportToUnreal(bad);
    expect(result.success).toBe(true);
    if (!result.success) return;
    const entry = result.fidelity.entries.find(
      (e) => e.domain === 'world-partition' && e.level === 'dropped',
    );
    expect(entry).toBeDefined();
  });

  it('drops an entity placement referencing a non-existent zone (convertEntities direct)', () => {
    // UE-A-006: orphan zone reference must produce a dropped fidelity entry
    // and NOT be included in the actor manifest. Exercised at the converter
    // level because validateProject would reject this project upstream.
    const orphan: WorldProject = {
      ...minimalProject,
      entityPlacements: [
        ...minimalProject.entityPlacements,
        { entityId: 'npc-ghost', zoneId: 'zone-does-not-exist', role: 'npc' },
      ],
    };
    const result = convertEntities(orphan);
    const dropped = result.fidelity.find(
      (e) => e.domain === 'entities' && e.level === 'dropped' && e.entityId === 'npc-ghost',
    );
    expect(dropped).toBeDefined();
    expect(dropped?.severity).toBe('error');
    expect(result.manifest.All.find((a) => a.ActorId === 'npc-ghost')).toBeUndefined();
  });

  it('maps every connection kind to a StreamMode', () => {
    const project: WorldProject = {
      ...minimalProject,
      connections: [
        { fromZoneId: 'zone-entrance', toZoneId: 'zone-cellar', kind: 'warp', bidirectional: true },
        { fromZoneId: 'zone-cellar', toZoneId: 'zone-entrance', kind: 'docking', bidirectional: false },
      ],
    };
    const result = exportToUnreal(project);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.Connections[0].StreamMode).toBe('teleport');
    expect(result.contentPack.Connections[1].StreamMode).toBe('load');
  });
});

describe('exportToUnreal → importFromUnreal round-trip', () => {
  it('recovers zones, districts, and entity placements with 2.5D fields intact', () => {
    const project = withElevation(minimalProject);
    const exported = exportToUnreal(project);
    if (!exported.success) throw new Error('export failed');

    const imported = importFromUnreal(exported.contentPack);
    expect(imported.success).toBe(true);
    if (!imported.success) return;

    expect(imported.project.zones.length).toBe(project.zones.length);
    expect(imported.project.districts.length).toBe(project.districts.length);
    expect(imported.project.entityPlacements.length).toBe(project.entityPlacements.length);

    const zoneEntrance = imported.project.zones.find((z) => z.id === 'zone-entrance');
    expect(zoneEntrance?.parallaxLayers?.length).toBe(2);
    expect(zoneEntrance?.skylineRef).toBe('asset-skyline');

    const zoneCellar = imported.project.zones.find((z) => z.id === 'zone-cellar');
    expect(zoneCellar?.elevation).toBe(2);
    expect(zoneCellar?.elevationRange).toEqual({ floor: -1, ceiling: 5 });
  });

  it('round-trips a non-default pixel tileSize (48) through SourceTileSizePx', () => {
    const project: WorldProject = {
      ...minimalProject,
      map: { ...minimalProject.map, tileSize: 48 },
    };
    const exported = exportToUnreal(project);
    if (!exported.success) throw new Error('export failed');
    expect(exported.contentPack.Meta.SourceTileSizePx).toBe(48);

    const imported = importFromUnreal(exported.contentPack);
    if (!imported.success) throw new Error('import failed');
    expect(imported.project.map.tileSize).toBe(48);

    // No "tile size missing" fidelity entry should be emitted on a fresh pack.
    const lossEntry = imported.fidelity.entries.find(
      (e) => e.domain === 'world' && e.fieldPath === 'map.tileSize',
    );
    expect(lossEntry).toBeUndefined();
  });

  it('falls back to tileSize=32 and emits a dropped fidelity entry for older packs missing SourceTileSizePx', () => {
    const exported = exportToUnreal(minimalProject);
    if (!exported.success) throw new Error('export failed');

    // Simulate an older pack by stripping SourceTileSizePx.
    const legacyPack = {
      ...exported.contentPack,
      Meta: { ...exported.contentPack.Meta },
    };
    delete (legacyPack.Meta as { SourceTileSizePx?: number }).SourceTileSizePx;

    const imported = importFromUnreal(legacyPack);
    if (!imported.success) throw new Error('import failed');
    expect(imported.project.map.tileSize).toBe(32);

    const lossEntry = imported.fidelity.entries.find(
      (e) => e.domain === 'world' && e.fieldPath === 'map.tileSize',
    );
    expect(lossEntry).toBeDefined();
    expect(lossEntry?.level).toBe('dropped');
    expect(lossEntry?.severity).toBe('warning');
    expect(lossEntry?.reason).toContain('SourceTileSizePx');
  });

  it('emits a single consolidated "world" fidelity entry listing every unrecoverable field', () => {
    // UE-B-004: previously only `dialogues` was flagged, hiding 17+ other
    // dropped fields. One consolidated entry now names every field the
    // Unreal pack cannot round-trip.
    const exported = exportToUnreal(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const imported = importFromUnreal(exported.contentPack);
    if (!imported.success) throw new Error('import failed');

    const consolidated = imported.fidelity.entries.filter(
      (e) => e.domain === 'world' && e.level === 'dropped' && e.severity === 'warning'
        && e.message.includes('not recoverable'),
    );
    expect(consolidated.length).toBe(1);
    // Must name each unrecoverable field in the message.
    const msg = consolidated[0].message;
    for (const field of [
      'dialogues', 'progressionTrees', 'playerTemplate', 'buildCatalog',
      'itemPlacements', 'encounterAnchors', 'spawnPoints', 'craftingStations',
      'marketNodes', 'landmarks', 'factionPresences', 'pressureHotspots',
      'tilesets', 'tileLayers', 'props', 'propPlacements', 'ambientLayers',
      'assets', 'assetPacks', 'genre', 'tones', 'difficulty', 'narratorTone',
    ]) {
      expect(msg).toContain(field);
    }
  });

  it('emits a dropped "world" fidelity entry when pack TileSizeCm is invalid', () => {
    // UE-B-003: importer must not silently downshift a bad TileSizeCm.
    const exported = exportToUnreal(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const brokenPack = {
      ...exported.contentPack,
      Meta: { ...exported.contentPack.Meta, TileSizeCm: 0 },
    };
    const imported = importFromUnreal(brokenPack);
    if (!imported.success) throw new Error('import failed');
    const entry = imported.fidelity.entries.find(
      (e) => e.domain === 'world' && e.fieldPath === 'Meta.TileSizeCm' && e.level === 'dropped',
    );
    expect(entry).toBeDefined();
    expect(entry?.severity).toBe('warning');
  });
});
