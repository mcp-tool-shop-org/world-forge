import { describe, it, expect } from 'vitest';
import { scanDependencies } from '../dependencies.js';
import type { WorldProject } from '../project.js';
import { minimalProject } from './fixtures/minimal.js';
import { chapelProject } from './fixtures/chapel-authored.js';

/** Clone minimal and override specific fields. */
function withOverrides(overrides: Partial<WorldProject>): WorldProject {
  return { ...structuredClone(minimalProject), ...overrides };
}

describe('scanDependencies', () => {
  // --- Empty / healthy projects ---

  it('returns empty edges for a project with no assets or refs', () => {
    const proj = withOverrides({ assets: [], assetPacks: [] });
    const report = scanDependencies(proj);
    // no asset refs to scan (minimal has no portraitId/spriteId/iconId/backgroundId/tilesetId)
    expect(report.edges.filter((e) => e.status === 'broken')).toHaveLength(0);
    expect(report.edges.filter((e) => e.status === 'mismatched')).toHaveLength(0);
  });

  it('returns all-ok edges for a project with valid refs', () => {
    const proj = withOverrides({
      assets: [
        { id: 'bg-1', kind: 'background', label: 'Hall BG', path: '/bg.png', tags: [] },
        { id: 'ts-1', kind: 'tileset', label: 'Hall Tiles', path: '/ts.png', tags: [] },
      ],
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'bg-1', tilesetId: 'ts-1' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const zoneAssets = report.edges.filter((e) => e.domain === 'zone-asset');
    expect(zoneAssets).toHaveLength(2);
    expect(zoneAssets.every((e) => e.status === 'ok')).toBe(true);
  });

  // --- Zone asset refs ---

  it('detects broken zone backgroundId', () => {
    const proj = withOverrides({
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'nonexistent-bg' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.status === 'broken' && e.fieldName === 'backgroundId');
    expect(broken).toHaveLength(1);
    expect(broken[0].domain).toBe('zone-asset');
    expect(broken[0].targetId).toBe('nonexistent-bg');
    expect(broken[0].expectedKind).toBe('background');
  });

  it('detects mismatched zone backgroundId (wrong kind)', () => {
    const proj = withOverrides({
      assets: [{ id: 'sprite-1', kind: 'sprite', label: 'Wrong Kind', path: '/s.png', tags: [] }],
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'sprite-1' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const mismatched = report.edges.filter((e) => e.status === 'mismatched' && e.fieldName === 'backgroundId');
    expect(mismatched).toHaveLength(1);
    expect(mismatched[0].expectedKind).toBe('background');
    expect(mismatched[0].actualKind).toBe('sprite');
  });

  it('produces ok edge for valid zone backgroundId', () => {
    const proj = withOverrides({
      assets: [{ id: 'bg-ok', kind: 'background', label: 'Valid BG', path: '/bg.png', tags: [] }],
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'bg-ok' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const ok = report.edges.filter((e) => e.status === 'ok' && e.fieldName === 'backgroundId');
    expect(ok).toHaveLength(1);
  });

  it('detects broken zone tilesetId', () => {
    const proj = withOverrides({
      zones: [
        { ...minimalProject.zones[0], tilesetId: 'missing-tileset' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.status === 'broken' && e.fieldName === 'tilesetId');
    expect(broken).toHaveLength(1);
    expect(broken[0].expectedKind).toBe('tileset');
  });

  // --- Entity asset refs ---

  it('detects broken entity portraitId and spriteId', () => {
    const proj = withOverrides({
      entityPlacements: [
        { ...minimalProject.entityPlacements[0], portraitId: 'ghost-portrait', spriteId: 'ghost-sprite' },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'entity-asset' && e.status === 'broken');
    expect(broken).toHaveLength(2);
    expect(broken.map((e) => e.fieldName).sort()).toEqual(['portraitId', 'spriteId']);
  });

  it('detects mismatched entity portraitId (wrong kind)', () => {
    const proj = withOverrides({
      assets: [{ id: 'icon-1', kind: 'icon', label: 'An Icon', path: '/i.png', tags: [] }],
      entityPlacements: [
        { ...minimalProject.entityPlacements[0], portraitId: 'icon-1' },
      ],
    });
    const report = scanDependencies(proj);
    const mismatched = report.edges.filter((e) => e.status === 'mismatched' && e.fieldName === 'portraitId');
    expect(mismatched).toHaveLength(1);
    expect(mismatched[0].expectedKind).toBe('portrait');
    expect(mismatched[0].actualKind).toBe('icon');
  });

  // --- Item asset refs ---

  it('detects broken item iconId', () => {
    const proj = withOverrides({
      itemPlacements: [
        { ...minimalProject.itemPlacements[0], iconId: 'missing-icon' },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'item-asset' && e.status === 'broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].fieldName).toBe('iconId');
  });

  // --- Landmark asset refs ---

  it('detects broken landmark iconId', () => {
    const proj = withOverrides({
      landmarks: [
        { ...minimalProject.landmarks[0], iconId: 'missing-icon' },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'landmark-asset' && e.status === 'broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].fieldName).toBe('iconId');
  });

  // --- Asset → pack refs ---

  it('detects broken asset packId', () => {
    const proj = withOverrides({
      assets: [{ id: 'a1', kind: 'portrait', label: 'P1', path: '/p.png', tags: [], packId: 'dead-pack' }],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'asset-pack' && e.status === 'broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].targetId).toBe('dead-pack');
  });

  it('produces ok edge for valid asset packId', () => {
    const proj = withOverrides({
      assets: [{ id: 'a1', kind: 'portrait', label: 'P1', path: '/p.png', tags: [], packId: 'pack-1' }],
      assetPacks: [{ id: 'pack-1', label: 'Pack 1', version: '1.0.0', tags: [] }],
    });
    const report = scanDependencies(proj);
    const ok = report.edges.filter((e) => e.domain === 'asset-pack' && e.status === 'ok');
    expect(ok).toHaveLength(1);
  });

  // --- Connection zone refs ---

  it('detects broken connection fromZoneId', () => {
    const proj = withOverrides({
      connections: [
        { fromZoneId: 'zone-gone', toZoneId: minimalProject.zones[0].id, bidirectional: true },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'zone-ref' && e.status === 'broken' && e.fieldName === 'fromZoneId');
    expect(broken).toHaveLength(1);
  });

  it('detects broken connection toZoneId', () => {
    const proj = withOverrides({
      connections: [
        { fromZoneId: minimalProject.zones[0].id, toZoneId: 'zone-gone', bidirectional: true },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'zone-ref' && e.status === 'broken' && e.fieldName === 'toZoneId');
    expect(broken).toHaveLength(1);
  });

  // --- District zone refs ---

  it('detects broken district zoneIds entry', () => {
    const proj = withOverrides({
      districts: [
        { ...minimalProject.districts[0], zoneIds: ['zone-entrance', 'zone-deleted'] },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'zone-ref' && e.status === 'broken' && e.sourceType === 'district');
    expect(broken).toHaveLength(1);
    expect(broken[0].targetId).toBe('zone-deleted');
  });

  // --- Spawn zone refs ---

  it('detects broken spawn zoneId', () => {
    const proj = withOverrides({
      spawnPoints: [{ id: 'sp-1', zoneId: 'zone-deleted', gridX: 0, gridY: 0, isDefault: true }],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'zone-ref' && e.status === 'broken' && e.sourceType === 'spawnPoint');
    expect(broken).toHaveLength(1);
  });

  // --- Encounter zone refs ---

  it('detects broken encounter anchor zoneId', () => {
    const proj = withOverrides({
      encounterAnchors: [
        { id: 'enc-1', zoneId: 'zone-deleted', encounterType: 'test', enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'zone-ref' && e.status === 'broken' && e.sourceType === 'encounterAnchor');
    expect(broken).toHaveLength(1);
  });

  // --- Entity dialogue refs ---

  it('detects broken entity dialogueId', () => {
    const proj = withOverrides({
      entityPlacements: [
        { ...minimalProject.entityPlacements[0], dialogueId: 'dlg-deleted' },
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'dialogue-ref' && e.status === 'broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].targetId).toBe('dlg-deleted');
  });

  // --- Orphan detection ---

  it('detects orphaned assets (not referenced by any placement)', () => {
    const proj = withOverrides({
      assets: [
        { id: 'orphan-bg', kind: 'background', label: 'Unused BG', path: '/bg.png', tags: [] },
      ],
    });
    const report = scanDependencies(proj);
    const orphans = report.edges.filter((e) => e.domain === 'orphan-asset');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].status).toBe('orphaned');
    expect(orphans[0].sourceId).toBe('orphan-bg');
  });

  it('detects orphaned packs (no assets reference them)', () => {
    const proj = withOverrides({
      assetPacks: [{ id: 'lonely-pack', label: 'Lonely Pack', version: '1.0.0', tags: [] }],
    });
    const report = scanDependencies(proj);
    const orphans = report.edges.filter((e) => e.domain === 'orphan-pack');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].status).toBe('orphaned');
    expect(orphans[0].sourceId).toBe('lonely-pack');
  });

  // --- Summary & byDomain ---

  it('summary counts match edge statuses', () => {
    const proj = withOverrides({
      assets: [
        { id: 'bg-1', kind: 'background', label: 'BG', path: '/bg.png', tags: [], packId: 'dead-pack' },
        { id: 'orphan-sprite', kind: 'sprite', label: 'Orphan', path: '/s.png', tags: [] },
      ],
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'bg-1' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const byCounting = { ok: 0, broken: 0, mismatched: 0, orphaned: 0, informational: 0 };
    for (const e of report.edges) {
      byCounting[e.status as keyof typeof byCounting]++;
    }
    expect(report.summary.ok).toBe(byCounting.ok);
    expect(report.summary.broken).toBe(byCounting.broken);
    expect(report.summary.mismatched).toBe(byCounting.mismatched);
    expect(report.summary.orphaned).toBe(byCounting.orphaned);
    expect(report.summary.total).toBe(report.edges.length);
  });

  it('byDomain groups edges correctly', () => {
    const proj = withOverrides({
      assets: [{ id: 'bg-1', kind: 'background', label: 'BG', path: '/bg.png', tags: [] }],
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'bg-1' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    expect(report.byDomain['zone-asset']).toBeDefined();
    expect(report.byDomain['zone-asset'].total).toBeGreaterThan(0);
  });

  // --- Chapel Threshold sample ---

  it('chapel project produces expected summary (no broken refs)', () => {
    const report = scanDependencies(chapelProject);
    expect(report.summary.broken).toBe(0);
    expect(report.summary.mismatched).toBe(0);
  });

  // --- Multiple broken refs ---

  it('multiple broken refs in same zone produce separate edges', () => {
    const proj = withOverrides({
      zones: [
        { ...minimalProject.zones[0], backgroundId: 'ghost-bg', tilesetId: 'ghost-ts' },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.domain === 'zone-asset' && e.status === 'broken');
    expect(broken).toHaveLength(2);
    expect(broken.map((e) => e.fieldName).sort()).toEqual(['backgroundId', 'tilesetId']);
  });

  // --- Skips undefined refs ---

  it('skips zones without asset refs (no false edges)', () => {
    const report = scanDependencies(minimalProject);
    const zoneAssets = report.edges.filter((e) => e.domain === 'zone-asset');
    // minimal project zones have no backgroundId/tilesetId set
    expect(zoneAssets).toHaveLength(0);
  });

  it('skips entity placements without portrait/sprite refs', () => {
    const report = scanDependencies(minimalProject);
    const entityAssets = report.edges.filter((e) => e.domain === 'entity-asset');
    expect(entityAssets).toHaveLength(0);
  });
});
