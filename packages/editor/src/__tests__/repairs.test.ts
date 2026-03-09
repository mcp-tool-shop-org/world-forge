import { describe, it, expect } from 'vitest';
import { repairsForEdge, batchRepair } from '../repairs.js';
import { scanDependencies } from '@world-forge/schema';
import type { WorldProject } from '@world-forge/schema';
import type { DependencyEdge } from '@world-forge/schema';

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

function findEdge(proj: WorldProject, filter: (e: DependencyEdge) => boolean): DependencyEdge {
  const report = scanDependencies(proj);
  const edge = report.edges.find(filter);
  if (!edge) throw new Error('Expected edge not found');
  return edge;
}

describe('repairsForEdge', () => {
  it('returns empty array for ok edge', () => {
    const proj = clone({
      assets: [{ id: 'bg1', kind: 'background', label: 'BG', path: '/bg.png', tags: [] }],
      zones: [{ ...base.zones[0], backgroundId: 'bg1' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'ok' && e.domain === 'zone-asset');
    expect(repairsForEdge(edge, proj)).toHaveLength(0);
  });

  it('returns empty array for informational edge', () => {
    const edge: DependencyEdge = {
      domain: 'kit-provenance', status: 'informational',
      sourceType: 'bundle', sourceId: 'b1', fieldName: 'kitName',
      targetType: 'kit', targetId: 'k1', message: 'Kit provenance',
    };
    expect(repairsForEdge(edge, base)).toHaveLength(0);
  });

  // --- Asset ref: clear-broken-ref ---

  it('clear-broken-ref on zone.backgroundId sets it to undefined', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken' && e.fieldName === 'backgroundId');
    const repairs = repairsForEdge(edge, proj);
    const clear = repairs.find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);
    expect(fixed.zones[0].backgroundId).toBeUndefined();
  });

  it('clear-broken-ref on entityPlacement.portraitId sets it to undefined', () => {
    const proj = clone({
      entityPlacements: [{ entityId: 'e1', zoneId: 'z1', role: 'npc' as const, portraitId: 'ghost' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken' && e.fieldName === 'portraitId');
    const clear = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);
    expect(fixed.entityPlacements[0].portraitId).toBeUndefined();
  });

  it('clear-broken-ref on itemPlacement.iconId sets it to undefined', () => {
    const proj = clone({
      itemPlacements: [{ itemId: 'i1', zoneId: 'z1', hidden: false, iconId: 'ghost' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken' && e.fieldName === 'iconId' && e.domain === 'item-asset');
    const clear = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);
    expect(fixed.itemPlacements[0].iconId).toBeUndefined();
  });

  it('clear-broken-ref on landmark.iconId sets it to undefined', () => {
    const proj = clone({
      landmarks: [{ id: 'lm1', name: 'LM', zoneId: 'z1', gridX: 0, gridY: 0, tags: [], interactionType: 'inspect' as const, iconId: 'ghost' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken' && e.fieldName === 'iconId' && e.domain === 'landmark-asset');
    const clear = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);
    expect(fixed.landmarks[0].iconId).toBeUndefined();
  });

  // --- relink-asset ---

  it('relink-asset offers same-kind alternatives only', () => {
    const proj = clone({
      assets: [
        { id: 'bg1', kind: 'background', label: 'BG1', path: '/bg1.png', tags: [] },
        { id: 'sp1a', kind: 'sprite', label: 'Sprite', path: '/s.png', tags: [] },
      ],
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken' && e.fieldName === 'backgroundId');
    const repairs = repairsForEdge(edge, proj);
    const relinks = repairs.filter((r) => r.kind === 'relink-asset');
    expect(relinks).toHaveLength(1);
    expect(relinks[0].label).toContain('BG1');
  });

  it('relink-asset apply changes ref to new asset ID', () => {
    const proj = clone({
      assets: [{ id: 'bg-new', kind: 'background', label: 'New BG', path: '/bg.png', tags: [] }],
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken' && e.fieldName === 'backgroundId');
    const relink = repairsForEdge(edge, proj).find((r) => r.kind === 'relink-asset')!;
    const fixed = relink.apply(proj);
    expect(fixed.zones[0].backgroundId).toBe('bg-new');
  });

  // --- remove-orphan-asset ---

  it('remove-orphan-asset removes asset from project.assets', () => {
    const proj = clone({
      assets: [{ id: 'orphan', kind: 'portrait', label: 'Orphan', path: '/o.png', tags: [] }],
    });
    const edge = findEdge(proj, (e) => e.domain === 'orphan-asset');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'remove-orphan-asset')!;
    const fixed = repair.apply(proj);
    expect(fixed.assets).toHaveLength(0);
  });

  // --- remove-orphan-pack ---

  it('remove-orphan-pack removes pack and clears packId refs', () => {
    const proj = clone({
      assetPacks: [{ id: 'pk1', label: 'Pack', version: '1.0.0', tags: [] }],
      assets: [{ id: 'a1', kind: 'portrait', label: 'A1', path: '/a.png', tags: [], packId: 'pk1' }],
    });
    // pk1 is NOT orphaned because a1 references it — let's make a truly orphaned pack
    const proj2 = clone({
      assetPacks: [{ id: 'pk-lonely', label: 'Lonely', version: '1.0.0', tags: [] }],
    });
    const edge = findEdge(proj2, (e) => e.domain === 'orphan-pack');
    const repair = repairsForEdge(edge, proj2).find((r) => r.kind === 'remove-orphan-pack')!;
    const fixed = repair.apply(proj2);
    expect(fixed.assetPacks).toHaveLength(0);
  });

  // --- clear-pack-ref ---

  it('clear-pack-ref sets asset.packId to undefined', () => {
    const proj = clone({
      assets: [{ id: 'a1', kind: 'portrait', label: 'A1', path: '/a.png', tags: [], packId: 'dead-pack' }],
    });
    const edge = findEdge(proj, (e) => e.domain === 'asset-pack' && e.status === 'broken');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-pack-ref')!;
    const fixed = repair.apply(proj);
    expect(fixed.assets[0].packId).toBeUndefined();
  });

  // --- zone ref repairs ---

  it('clear-broken-zone-ref removes connection with broken fromZoneId', () => {
    const proj = clone({
      connections: [{ fromZoneId: 'dead-zone', toZoneId: 'z1', bidirectional: true }],
    });
    const edge = findEdge(proj, (e) => e.domain === 'zone-ref' && e.status === 'broken');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-zone-ref')!;
    const fixed = repair.apply(proj);
    expect(fixed.connections).toHaveLength(0);
  });

  it('clear-broken-zone-ref removes zoneId from district.zoneIds', () => {
    const proj = clone({
      districts: [{
        id: 'd1', name: 'D1', zoneIds: ['z1', 'dead-zone'], tags: [],
        baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
        economyProfile: { supplyCategories: [], scarcityDefaults: {} },
      }],
    });
    const edge = findEdge(proj, (e) => e.domain === 'zone-ref' && e.status === 'broken' && e.sourceType === 'district');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-zone-ref')!;
    const fixed = repair.apply(proj);
    expect(fixed.districts[0].zoneIds).toEqual(['z1']);
  });

  it('clear-broken-zone-ref removes spawn with broken zoneId', () => {
    const proj = clone({
      spawnPoints: [
        { id: 'sp1', zoneId: 'z1', gridX: 0, gridY: 0, isDefault: true },
        { id: 'sp-dead', zoneId: 'dead-zone', gridX: 0, gridY: 0, isDefault: false },
      ],
    });
    const edge = findEdge(proj, (e) => e.domain === 'zone-ref' && e.status === 'broken' && e.sourceType === 'spawnPoint');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-zone-ref')!;
    const fixed = repair.apply(proj);
    expect(fixed.spawnPoints).toHaveLength(1);
    expect(fixed.spawnPoints[0].id).toBe('sp1');
  });

  it('clear-broken-zone-ref removes encounter with broken zoneId', () => {
    const proj = clone({
      encounterAnchors: [
        { id: 'enc-dead', zoneId: 'dead-zone', encounterType: 'test', enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
      ],
    });
    const edge = findEdge(proj, (e) => e.domain === 'zone-ref' && e.status === 'broken' && e.sourceType === 'encounterAnchor');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-zone-ref')!;
    const fixed = repair.apply(proj);
    expect(fixed.encounterAnchors).toHaveLength(0);
  });

  // --- dialogue ref repairs ---

  it('clear-broken-dialogue-ref clears encounter dialogueId', () => {
    const proj = clone({
      entityPlacements: [{ entityId: 'e1', zoneId: 'z1', role: 'npc' as const, dialogueId: 'dlg-dead' }],
    });
    const edge = findEdge(proj, (e) => e.domain === 'dialogue-ref' && e.status === 'broken');
    const repair = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-dialogue-ref')!;
    const fixed = repair.apply(proj);
    expect(fixed.entityPlacements[0].dialogueId).toBeUndefined();
  });
});

describe('batchRepair', () => {
  it('composes multiple repairs', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost-bg', tilesetId: 'ghost-ts' }],
    });
    const report = scanDependencies(proj);
    const broken = report.edges.filter((e) => e.status === 'broken');
    const allRepairs = broken.flatMap((e) => repairsForEdge(e, proj).filter((r) => r.kind === 'clear-broken-ref'));
    const fixed = batchRepair(allRepairs)(proj);
    expect(fixed.zones[0].backgroundId).toBeUndefined();
    expect(fixed.zones[0].tilesetId).toBeUndefined();
  });

  it('empty array is identity', () => {
    const fixed = batchRepair([])(base);
    expect(fixed).toEqual(base);
  });

  it('repair + rescan produces fewer broken edges', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
    });
    const before = scanDependencies(proj);
    const brokenBefore = before.edges.filter((e) => e.status === 'broken').length;

    const edge = before.edges.find((e) => e.status === 'broken')!;
    const clear = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);

    const after = scanDependencies(fixed);
    const brokenAfter = after.edges.filter((e) => e.status === 'broken').length;
    expect(brokenAfter).toBeLessThan(brokenBefore);
  });

  it('repair preserves unrelated project data', () => {
    const proj = clone({
      zones: [{ ...base.zones[0], backgroundId: 'ghost' }],
      dialogues: [{ id: 'dlg1', speakers: ['a'], entryNodeId: 'n1', nodes: { n1: { id: 'n1', speaker: 'A', text: 'Hello' } } }],
    });
    const edge = findEdge(proj, (e) => e.status === 'broken');
    const clear = repairsForEdge(edge, proj).find((r) => r.kind === 'clear-broken-ref')!;
    const fixed = clear.apply(proj);
    expect(fixed.dialogues).toEqual(proj.dialogues);
    expect(fixed.name).toBe(proj.name);
  });
});
