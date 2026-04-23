import { describe, it, expect } from 'vitest';
import { validateProject, VALID_CONNECTION_KINDS, VALID_ASSET_KINDS } from '../validate.js';
import type { WorldProject } from '../project.js';
import { minimalProject } from './fixtures/minimal.js';
import { chapelProject } from './fixtures/chapel-authored.js';
import { invalidOrphanProject } from './fixtures/invalid-orphan.js';

describe('validateProject', () => {
  it('accepts a valid minimal project', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects project with no spawn points', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'spawnPoints')).toBe(true);
  });

  it('rejects orphaned zone neighbor references', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('neighbors') && e.message.includes('zone-nonexistent'),
    )).toBe(true);
  });

  it('rejects district referencing nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('districts') && e.message.includes('zone-missing'),
    )).toBe(true);
  });

  it('rejects entity placement in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('entityPlacements') && e.message.includes('zone-void'),
    )).toBe(true);
  });

  it('rejects item placement in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('itemPlacements') && e.message.includes('zone-void'),
    )).toBe(true);
  });

  it('rejects connection referencing nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path === 'connections' && e.message.includes('zone-ghost'),
    )).toBe(true);
  });

  it('accepts connection with valid kind', () => {
    const proj: WorldProject = {
      ...minimalProject,
      connections: [{ fromZoneId: minimalProject.zones[0].id, toZoneId: minimalProject.zones[1].id, bidirectional: true, kind: 'door' }],
    };
    const result = validateProject(proj);
    expect(result.errors.filter((e) => e.path === 'connections')).toHaveLength(0);
  });

  it.each(['channel', 'route', 'docking', 'warp', 'trail'] as const)('accepts new connection kind "%s"', (kind) => {
    const proj: WorldProject = {
      ...minimalProject,
      connections: [{ fromZoneId: minimalProject.zones[0].id, toZoneId: minimalProject.zones[1].id, bidirectional: true, kind }],
    };
    const result = validateProject(proj);
    expect(result.errors.filter((e) => e.path === 'connections')).toHaveLength(0);
  });

  it('rejects connection with invalid kind', () => {
    const proj: WorldProject = {
      ...minimalProject,
      connections: [{ fromZoneId: minimalProject.zones[0].id, toZoneId: minimalProject.zones[1].id, bidirectional: true, kind: 'teleporter' as any }],
    };
    const result = validateProject(proj);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'connections' && e.message.includes('unsupported kind'))).toBe(true);
  });

  it('rejects landmark in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('landmarks') && e.message.includes('zone-phantom'),
    )).toBe(true);
  });

  // --- Encounter / Faction / Pressure validation ---

  it('accepts valid encounter anchor', () => {
    const result = validateProject(minimalProject);
    expect(result.errors.filter((e) => e.path.includes('encounterAnchors'))).toHaveLength(0);
  });

  it('rejects duplicate encounter anchor IDs', () => {
    const enc = minimalProject.encounterAnchors[0];
    const bad: WorldProject = { ...minimalProject, encounterAnchors: [enc, enc] };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate encounter anchor ID'))).toBe(true);
  });

  it('rejects encounter anchor in nonexistent zone', () => {
    const bad: WorldProject = {
      ...minimalProject,
      encounterAnchors: [{ id: 'enc-bad', zoneId: 'zone-ghost', encounterType: 'ambush', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('zone-ghost') && e.message.includes('nonexistent zone'))).toBe(true);
  });

  it('rejects encounter anchor with empty encounterType', () => {
    const bad: WorldProject = {
      ...minimalProject,
      encounterAnchors: [{ id: 'enc-empty', zoneId: 'zone-cellar', encounterType: '', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('encounterType'))).toBe(true);
  });

  it('accepts valid faction presence', () => {
    const result = validateProject(minimalProject);
    expect(result.errors.filter((e) => e.path.includes('factionPresences'))).toHaveLength(0);
  });

  it('rejects faction referencing nonexistent district', () => {
    const bad: WorldProject = {
      ...minimalProject,
      factionPresences: [{ factionId: 'bad-faction', districtIds: ['district-ghost'], influence: 50, alertLevel: 30 }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('district-ghost') && e.message.includes('nonexistent district'))).toBe(true);
  });

  it('rejects duplicate pressure hotspot IDs', () => {
    const ph = minimalProject.pressureHotspots[0];
    const bad: WorldProject = { ...minimalProject, pressureHotspots: [ph, ph] };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate pressure hotspot ID'))).toBe(true);
  });

  it('rejects pressure hotspot in nonexistent zone', () => {
    const bad: WorldProject = {
      ...minimalProject,
      pressureHotspots: [{ id: 'ph-bad', zoneId: 'zone-nowhere', pressureType: 'test', baseProbability: 0.5, tags: [] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('zone-nowhere') && e.message.includes('nonexistent zone'))).toBe(true);
  });

  it('accepts chapel project with all encounter/faction/pressure data', () => {
    const result = validateProject(chapelProject);
    expect(result.valid).toBe(true);
  });

  it('detects duplicate zone IDs', () => {
    const duped = {
      ...minimalProject,
      zones: [minimalProject.zones[0], { ...minimalProject.zones[1], id: minimalProject.zones[0].id }],
    };
    const result = validateProject(duped);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate zone ID'))).toBe(true);
  });

  it('detects asymmetrical neighbors', () => {
    const asymmetric = {
      ...minimalProject,
      zones: [
        minimalProject.zones[0],
        { ...minimalProject.zones[1], neighbors: [] },  // cellar doesn't list entrance back
      ],
    };
    const result = validateProject(asymmetric);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('does not list'))).toBe(true);
  });

  // --- Dialogue validation ---

  it('accepts valid dialogues', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
  });

  it('rejects dialogue with missing entry node', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'nonexistent',
        nodes: { hello: { id: 'hello', speaker: 'NPC', text: 'Hi' } },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('entry node') && e.message.includes('nonexistent'))).toBe(true);
  });

  it('rejects dialogue with broken nextNodeId in choice', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: {
            id: 'start', speaker: 'NPC', text: 'Hello',
            choices: [{ id: 'c1', text: 'Go', nextNodeId: 'ghost-node' }],
          },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-node'))).toBe(true);
  });

  it('rejects dialogue with broken auto-advance nextNodeId', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: { id: 'start', speaker: 'NPC', text: 'Hello', nextNodeId: 'missing' },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('auto-advances') && e.message.includes('missing'))).toBe(true);
  });

  it('detects unreachable dialogue nodes', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: { id: 'start', speaker: 'NPC', text: 'Hello' },
          orphan: { id: 'orphan', speaker: 'NPC', text: 'Nobody reaches me' },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('unreachable') && e.message.includes('orphan'))).toBe(true);
  });

  it('rejects entity dialogueId referencing nonexistent dialogue', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [],
      entityPlacements: [
        { entityId: 'npc-1', zoneId: 'zone-entrance', role: 'npc', dialogueId: 'dlg-ghost' },
      ],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('dlg-ghost'))).toBe(true);
  });

  it('detects duplicate dialogue IDs', () => {
    const dlg = {
      id: 'dlg-dupe', speakers: ['npc'], entryNodeId: 'start',
      nodes: { start: { id: 'start', speaker: 'NPC', text: 'Hi' } },
    };
    const bad: WorldProject = { ...minimalProject, dialogues: [dlg, dlg] };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate dialogue ID'))).toBe(true);
  });

  // --- Player template validation ---

  it('accepts valid player template', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
  });

  it('rejects player template with invalid spawn point', () => {
    const bad: WorldProject = {
      ...minimalProject,
      playerTemplate: { ...minimalProject.playerTemplate!, spawnPointId: 'sp-nonexistent' },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'playerTemplate.spawnPointId')).toBe(true);
  });

  it('rejects player template with nonexistent starting inventory item', () => {
    const bad: WorldProject = {
      ...minimalProject,
      playerTemplate: { ...minimalProject.playerTemplate!, startingInventory: ['ghost-item'] },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-item'))).toBe(true);
  });

  it('rejects player template with nonexistent equipment item', () => {
    const bad: WorldProject = {
      ...minimalProject,
      playerTemplate: { ...minimalProject.playerTemplate!, startingEquipment: { weapon: 'phantom-sword' } },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('phantom-sword'))).toBe(true);
  });

  // --- Build catalog validation ---

  it('accepts valid build catalog (chapel)', () => {
    const result = validateProject(chapelProject);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate archetype IDs', () => {
    const bad: WorldProject = {
      ...chapelProject,
      buildCatalog: {
        ...chapelProject.buildCatalog!,
        archetypes: [chapelProject.buildCatalog!.archetypes[0], chapelProject.buildCatalog!.archetypes[0]],
      },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate archetype ID'))).toBe(true);
  });

  it('rejects archetype referencing nonexistent progression tree', () => {
    const bad: WorldProject = {
      ...chapelProject,
      buildCatalog: {
        ...chapelProject.buildCatalog!,
        archetypes: [{ ...chapelProject.buildCatalog!.archetypes[0], progressionTreeId: 'tree-ghost' }],
      },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('tree-ghost'))).toBe(true);
  });

  it('rejects cross-title referencing nonexistent archetype', () => {
    const bad: WorldProject = {
      ...chapelProject,
      buildCatalog: {
        ...chapelProject.buildCatalog!,
        crossTitles: [{ archetypeId: 'no-such', disciplineId: 'shadow-step', title: 'Test', tags: [] }],
      },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('no-such'))).toBe(true);
  });

  // --- Progression tree validation ---

  it('rejects duplicate progression tree IDs', () => {
    const bad: WorldProject = {
      ...chapelProject,
      progressionTrees: [chapelProject.progressionTrees[0], chapelProject.progressionTrees[0]],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate progression tree ID'))).toBe(true);
  });

  it('rejects node requiring nonexistent node', () => {
    const bad: WorldProject = {
      ...minimalProject,
      progressionTrees: [{
        id: 'tree-bad', name: 'Bad Tree', currency: 'xp',
        nodes: [
          { id: 'root', name: 'Root', cost: 5, effects: [] },
          { id: 'child', name: 'Child', cost: 10, requires: ['ghost-node'], effects: [] },
        ],
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-node'))).toBe(true);
  });

  it('rejects tree with no root nodes', () => {
    const bad: WorldProject = {
      ...minimalProject,
      progressionTrees: [{
        id: 'tree-cycle', name: 'Cycle Tree', currency: 'xp',
        nodes: [
          { id: 'a', name: 'A', cost: 5, requires: ['b'], effects: [] },
          { id: 'b', name: 'B', cost: 5, requires: ['a'], effects: [] },
        ],
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('no root nodes'))).toBe(true);
  });

  // --- Asset validation ---

  it('accepts project with valid assets', () => {
    const good: WorldProject = {
      ...minimalProject,
      assets: [
        { id: 'bg-1', kind: 'background', label: 'Entrance BG', path: 'assets/bg.png', tags: [] },
      ],
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, backgroundId: 'bg-1' } : z,
      ),
    };
    const result = validateProject(good);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate asset IDs', () => {
    const asset = { id: 'dup', kind: 'portrait' as const, label: 'Dup', path: 'a.png', tags: [] };
    const bad: WorldProject = {
      ...minimalProject,
      assets: [asset, asset],
      entityPlacements: minimalProject.entityPlacements.map((e) => ({ ...e, portraitId: 'dup' })),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate asset ID'))).toBe(true);
  });

  it('rejects asset with empty path', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'empty-path', kind: 'icon', label: 'Bad', path: '', tags: [] }],
      itemPlacements: minimalProject.itemPlacements.map((i) => ({ ...i, iconId: 'empty-path' })),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('empty path'))).toBe(true);
  });

  it('rejects zone backgroundId referencing nonexistent asset', () => {
    const bad: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, backgroundId: 'ghost-bg' } : z,
      ),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-bg') && e.message.includes('nonexistent'))).toBe(true);
  });

  it('rejects zone backgroundId referencing wrong asset kind', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'portrait-1', kind: 'portrait', label: 'Face', path: 'face.png', tags: [] }],
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, backgroundId: 'portrait-1' } : z,
      ),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('portrait') && e.message.includes('expected "background"'))).toBe(true);
  });

  it('rejects entity portraitId referencing nonexistent asset', () => {
    const bad: WorldProject = {
      ...minimalProject,
      entityPlacements: [{ entityId: 'npc-1', zoneId: 'zone-entrance', role: 'npc', portraitId: 'ghost-portrait' }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-portrait'))).toBe(true);
  });

  it('rejects item iconId referencing nonexistent asset', () => {
    const bad: WorldProject = {
      ...minimalProject,
      itemPlacements: [{ itemId: 'item-1', zoneId: 'zone-entrance', hidden: false, iconId: 'ghost-icon' }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-icon'))).toBe(true);
  });

  it('reports orphaned assets', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'orphan-bg', kind: 'background', label: 'Unused', path: 'unused.png', tags: [] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('orphan-bg') && e.message.includes('not referenced'))).toBe(true);
  });

  // --- Asset pack validation ---

  it('accepts valid asset pack with assigned assets', () => {
    const good: WorldProject = {
      ...minimalProject,
      assetPacks: [{ id: 'pack-1', label: 'Test Pack', version: '1.0.0', tags: [] }],
      assets: [{ id: 'bg-1', kind: 'background', label: 'BG', path: 'bg.png', tags: [], packId: 'pack-1' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'bg-1' } : z),
    };
    const result = validateProject(good);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate asset pack IDs', () => {
    const pack = { id: 'dup-pack', label: 'Pack', version: '1.0.0', tags: [] };
    const bad: WorldProject = {
      ...minimalProject,
      assetPacks: [pack, pack],
      assets: [{ id: 'a1', kind: 'background', label: 'A', path: 'a.png', tags: [], packId: 'dup-pack' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'a1' } : z),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate asset pack ID'))).toBe(true);
  });

  it('rejects asset pack with empty label', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assetPacks: [{ id: 'pack-nolabel', label: '', version: '1.0.0', tags: [] }],
      assets: [{ id: 'a1', kind: 'background', label: 'A', path: 'a.png', tags: [], packId: 'pack-nolabel' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'a1' } : z),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('empty label'))).toBe(true);
  });

  it('rejects asset pack with empty version', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assetPacks: [{ id: 'pack-nover', label: 'Pack', version: '', tags: [] }],
      assets: [{ id: 'a1', kind: 'background', label: 'A', path: 'a.png', tags: [], packId: 'pack-nover' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'a1' } : z),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('empty version'))).toBe(true);
  });

  it('rejects asset referencing nonexistent pack', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'a1', kind: 'background', label: 'A', path: 'a.png', tags: [], packId: 'ghost-pack' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'a1' } : z),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-pack') && e.message.includes('nonexistent pack'))).toBe(true);
  });

  it('reports orphaned asset packs', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assetPacks: [{ id: 'lonely-pack', label: 'Lonely', version: '1.0.0', tags: [] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('lonely-pack') && e.message.includes('no assets assigned'))).toBe(true);
  });

  it('rejects asset pack with invalid version format', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assetPacks: [{ id: 'pack-badver', label: 'Pack', version: 'v1.0', tags: [] }],
      assets: [{ id: 'a1', kind: 'background', label: 'A', path: 'a.png', tags: [], packId: 'pack-badver' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'a1' } : z),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('not valid semver'))).toBe(true);
  });

  // --- S-010: Cross-validation — playerTemplate refs require buildCatalog ---

  it('rejects playerTemplate with defaultArchetypeId when no buildCatalog exists', () => {
    const bad: WorldProject = {
      ...minimalProject,
      buildCatalog: undefined,
      playerTemplate: { ...minimalProject.playerTemplate!, defaultArchetypeId: 'arch-warrior' },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path === 'playerTemplate.defaultArchetypeId' && e.message.includes('no buildCatalog is defined'),
    )).toBe(true);
  });

  it('rejects playerTemplate with defaultBackgroundId when no buildCatalog exists', () => {
    const bad: WorldProject = {
      ...minimalProject,
      buildCatalog: undefined,
      playerTemplate: { ...minimalProject.playerTemplate!, defaultBackgroundId: 'bg-noble' },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path === 'playerTemplate.defaultBackgroundId' && e.message.includes('no buildCatalog is defined'),
    )).toBe(true);
  });

  it('accepts playerTemplate without archetype/background refs when no buildCatalog', () => {
    const good: WorldProject = {
      ...minimalProject,
      buildCatalog: undefined,
    };
    const result = validateProject(good);
    // Should not have any buildCatalog cross-ref errors
    expect(result.errors.filter((e) => e.message.includes('no buildCatalog'))).toHaveLength(0);
  });

  // --- S-003/S-005: Neighbor symmetry still works correctly with Map/Set optimization ---

  it('detects asymmetrical neighbors with many zones (performance regression guard)', () => {
    const zones = Array.from({ length: 50 }, (_, i) => ({
      ...minimalProject.zones[0],
      id: `zone-${i}`,
      name: `Zone ${i}`,
      neighbors: i < 49 ? [`zone-${i + 1}`] : [],
    }));
    // zone-0 lists zone-1, but zone-1 does NOT list zone-0 back
    const bad: WorldProject = { ...minimalProject, zones, districts: [], connections: [] };
    const result = validateProject(bad);
    expect(result.errors.some((e) => e.message.includes('does not list'))).toBe(true);
  });

  // --- SB-001: Nonexistent neighbor reported before symmetry check ---

  it('reports nonexistent neighbor before symmetry check', () => {
    const zones = [
      { ...minimalProject.zones[0], id: 'z-a', neighbors: ['z-b', 'z-ghost'] },
      { ...minimalProject.zones[1], id: 'z-b', neighbors: ['z-a'] },
    ];
    const bad: WorldProject = { ...minimalProject, zones, districts: [], connections: [] };
    const result = validateProject(bad);
    // Should report nonexistent neighbor
    expect(result.errors.some((e) =>
      e.path.includes('neighbors') && e.message.includes('nonexistent neighbor "z-ghost"'),
    )).toBe(true);
    // Should NOT report symmetry error for nonexistent zone
    expect(result.errors.some((e) =>
      e.message.includes('z-ghost') && e.message.includes('does not list'),
    )).toBe(false);
  });

  // --- SB-002: No non-null assertion on queue.pop() ---

  it('handles unreachable node detection without crashing', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-safe', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: { id: 'start', speaker: 'NPC', text: 'Hello' },
          island: { id: 'island', speaker: 'NPC', text: 'Unreachable' },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.errors.some((e) => e.message.includes('unreachable') && e.message.includes('island'))).toBe(true);
  });

  // --- SB-003: warningCount in result ---

  it('returns warningCount equal to error count', () => {
    const result = validateProject(minimalProject);
    expect(result.warningCount).toBe(0);
    expect(result.warningCount).toBe(result.errors.length);
  });

  it('warningCount matches errors when invalid', () => {
    const bad: WorldProject = { ...minimalProject, spawnPoints: [] };
    const result = validateProject(bad);
    expect(result.warningCount).toBe(result.errors.length);
    expect(result.warningCount).toBeGreaterThan(0);
  });

  it('accepts verbose option without changing result shape', () => {
    const normal = validateProject(minimalProject);
    const verbose = validateProject(minimalProject, { verbose: true });
    expect(normal.valid).toBe(verbose.valid);
    expect(normal.errors.length).toBe(verbose.errors.length);
  });

  // --- SB-006: VALID_CONNECTION_KINDS derived from ConnectionKind ---

  it('VALID_CONNECTION_KINDS matches all ConnectionKind values', () => {
    const expected = ['passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard', 'channel', 'route', 'docking', 'warp', 'trail'];
    for (const kind of expected) {
      expect(VALID_CONNECTION_KINDS.has(kind)).toBe(true);
    }
    expect(VALID_CONNECTION_KINDS.size).toBe(expected.length);
  });

  // --- SB-007: VALID_ASSET_KINDS derived from AssetKind ---

  it('VALID_ASSET_KINDS matches all AssetKind values', () => {
    const expected = ['portrait', 'sprite', 'background', 'icon', 'tileset'];
    for (const kind of expected) {
      expect(VALID_ASSET_KINDS.has(kind)).toBe(true);
    }
    expect(VALID_ASSET_KINDS.size).toBe(expected.length);
  });

  // --- SB-012: Whitespace-only encounterType rejected ---

  it('rejects encounter anchor with whitespace-only encounterType', () => {
    const bad: WorldProject = {
      ...minimalProject,
      encounterAnchors: [{ id: 'enc-ws', zoneId: 'zone-cellar', encounterType: '   ', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('whitespace-only') && e.message.includes('encounterType'))).toBe(true);
  });

  // --- SB-013: Enhanced checkAssetRef error messages ---

  it('asset ref error includes expected kind context', () => {
    const bad: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, backgroundId: 'ghost-bg' } : z,
      ),
    };
    const result = validateProject(bad);
    const err = result.errors.find((e) => e.message.includes('ghost-bg'));
    expect(err).toBeDefined();
    expect(err!.message).toContain('expected a "background" asset');
  });

  it('asset kind mismatch error suggests correct kind', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assets: [{ id: 'portrait-1', kind: 'portrait', label: 'Face', path: 'face.png', tags: [] }],
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, backgroundId: 'portrait-1' } : z,
      ),
    };
    const result = validateProject(bad);
    const err = result.errors.find((e) => e.message.includes('portrait-1') && e.message.includes('portrait'));
    expect(err).toBeDefined();
    expect(err!.message).toContain('Assign a "background" asset instead');
  });

  // --- SB-014: semverPattern extracted to module-level ---

  it('still validates semver format correctly', () => {
    const bad: WorldProject = {
      ...minimalProject,
      assetPacks: [{ id: 'p1', label: 'Pack', version: 'abc', tags: [] }],
      assets: [{ id: 'a1', kind: 'background', label: 'A', path: 'a.png', tags: [], packId: 'p1' }],
      zones: minimalProject.zones.map((z, i) => i === 0 ? { ...z, backgroundId: 'a1' } : z),
    };
    const result = validateProject(bad);
    expect(result.errors.some((e) => e.message.includes('not valid semver'))).toBe(true);
  });
});

// --- SCH-A-001 / SCH-A-002: enum drift guards ---
// The VALID_* sets are derived from a Record<Kind, true> lookup via Object.keys,
// so they cannot silently drift from the union type. These runtime tests confirm
// every expected kind is present — if a new kind is added to the union but the
// lookup is not updated, TypeScript errors first; if that slips past somehow,
// these tests also fail loudly.

describe('SCH-A-001: AssetKind VALID_ASSET_KINDS coverage', () => {
  it('contains every currently-known AssetKind value', () => {
    // If AssetKind gains a new variant, add it here AND to VALID_ASSET_KINDS_LOOKUP.
    const expected = ['portrait', 'sprite', 'background', 'icon', 'tileset'];
    for (const kind of expected) {
      expect(VALID_ASSET_KINDS.has(kind)).toBe(true);
    }
    expect(VALID_ASSET_KINDS.size).toBe(expected.length);
  });

  it('rejects an obviously-invalid asset kind at runtime', () => {
    expect(VALID_ASSET_KINDS.has('not-a-real-kind')).toBe(false);
    expect(VALID_ASSET_KINDS.has('')).toBe(false);
  });
});

describe('SCH-A-002: ConnectionKind VALID_CONNECTION_KINDS coverage', () => {
  it('contains every currently-known ConnectionKind value', () => {
    // If ConnectionKind gains a new variant, add it here AND to VALID_CONNECTION_KINDS_LOOKUP.
    const expected = [
      'passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard',
      'channel', 'route', 'docking', 'warp', 'trail',
    ];
    for (const kind of expected) {
      expect(VALID_CONNECTION_KINDS.has(kind)).toBe(true);
    }
    expect(VALID_CONNECTION_KINDS.size).toBe(expected.length);
  });

  it('rejects an obviously-invalid connection kind at runtime', () => {
    expect(VALID_CONNECTION_KINDS.has('teleport-beam')).toBe(false);
    expect(VALID_CONNECTION_KINDS.has('')).toBe(false);
  });
});

// --- SCH-A-004: non-string author/license/category surface as validation errors ---

describe('SCH-A-004: project metadata type guards (author/license/category)', () => {
  it('rejects non-string author (null)', () => {
    const bad = { ...minimalProject, author: null } as unknown as WorldProject;
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'author' && e.message.includes('must be a string'))).toBe(true);
  });

  it('rejects non-string license (number)', () => {
    const bad = { ...minimalProject, license: 42 } as unknown as WorldProject;
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'license' && e.message.includes('must be a string'))).toBe(true);
  });

  it('rejects non-string category (object)', () => {
    const bad = { ...minimalProject, category: { kind: 'fantasy' } } as unknown as WorldProject;
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'category' && e.message.includes('must be a string'))).toBe(true);
  });

  it('accepts undefined author/license/category (optional fields)', () => {
    const result = validateProject(minimalProject);
    expect(result.errors.some((e) => e.path === 'author')).toBe(false);
    expect(result.errors.some((e) => e.path === 'license')).toBe(false);
    expect(result.errors.some((e) => e.path === 'category')).toBe(false);
  });

  it('accepts string author/license/category', () => {
    const good: WorldProject = {
      ...minimalProject,
      author: 'Mike',
      license: 'MIT',
      category: 'fantasy',
    };
    const result = validateProject(good);
    expect(result.errors.some((e) => e.path === 'author')).toBe(false);
    expect(result.errors.some((e) => e.path === 'license')).toBe(false);
    expect(result.errors.some((e) => e.path === 'category')).toBe(false);
  });
});
