import { describe, it, expect } from 'vitest';
import { advisoryValidation } from '../advisory.js';
import { validateProject } from '../validate.js';
import type { WorldProject } from '../project.js';
import type { AuthoringMode } from '../authoring-mode.js';
import { AUTHORING_MODES } from '../authoring-mode.js';

/** Minimal empty project factory for advisory testing. */
function emptyProject(mode?: AuthoringMode): WorldProject {
  return {
    id: 'test-advisory',
    name: 'Advisory Test',
    description: 'Test',
    version: '1.0.0',
    genre: 'fantasy',
    tones: ['dark'],
    difficulty: 'normal',
    narratorTone: 'neutral',
    mode,
    map: { id: 'map-1', name: 'Test Map', description: '', gridWidth: 30, gridHeight: 25, tileSize: 32 },
    zones: [],
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
    spawnPoints: [],
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
}

describe('advisoryValidation', () => {
  it('dungeon with no secrets → suggestion', () => {
    const project = emptyProject('dungeon');
    project.zones = [
      { id: 'z1', name: 'Room 1', x: 0, y: 0, width: 5, height: 5, tags: [] } as any,
      { id: 'z2', name: 'Room 2', x: 6, y: 0, width: 5, height: 5, tags: [] } as any,
    ];
    project.connections = [
      { id: 'c1', fromZoneId: 'z1', toZoneId: 'z2', kind: 'door', bidirectional: true } as any,
    ];
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.message.includes('secret'))).toBe(true);
  });

  it('ocean with no channels → suggestion', () => {
    const project = emptyProject('ocean');
    project.zones = [
      { id: 'z1', name: 'Harbor', x: 0, y: 0, width: 10, height: 10, tags: [] } as any,
      { id: 'z2', name: 'Open Sea', x: 10, y: 0, width: 10, height: 10, tags: [] } as any,
    ];
    project.connections = [
      { id: 'c1', fromZoneId: 'z1', toZoneId: 'z2', kind: 'passage', bidirectional: true } as any,
    ];
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.message.includes('channel') || i.message.includes('route'))).toBe(true);
  });

  it('well-formed dungeon project → fewer suggestions', () => {
    const project = emptyProject('dungeon');
    project.zones = [
      { id: 'z1', name: 'Room', x: 0, y: 0, width: 5, height: 5, tags: [] } as any,
      { id: 'z2', name: 'Vault', x: 6, y: 0, width: 5, height: 5, tags: [] } as any,
    ];
    project.connections = [
      { id: 'c1', fromZoneId: 'z1', toZoneId: 'z2', kind: 'secret', bidirectional: true } as any,
    ];
    project.pressureHotspots = [
      { id: 'h1', zoneId: 'z1', pressureType: 'trap-activation', baseProbability: 0.5, tags: ['trap'] } as any,
    ];
    const result = advisoryValidation(project);
    // Should have no dungeon-specific suggestions
    const dungeonItems = result.items.filter((i) => i.message.toLowerCase().includes('dungeon'));
    expect(dungeonItems).toHaveLength(0);
  });

  it.each(AUTHORING_MODES)('empty "%s" project produces at least 1 suggestion', (mode) => {
    const project = emptyProject(mode as AuthoringMode);
    const result = advisoryValidation(project);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('advisory items have valid path and message', () => {
    const project = emptyProject('dungeon');
    const result = advisoryValidation(project);
    for (const item of result.items) {
      expect(item.path).toBeTruthy();
      expect(item.message).toBeTruthy();
    }
  });

  it('undefined mode → dungeon rules', () => {
    const project = emptyProject(undefined);
    const dungeonProject = emptyProject('dungeon');
    const resultUndef = advisoryValidation(project);
    const resultDungeon = advisoryValidation(dungeonProject);
    expect(resultUndef.items.length).toBe(resultDungeon.items.length);
    expect(resultUndef.items.map((i) => i.message)).toEqual(resultDungeon.items.map((i) => i.message));
  });

  it('never duplicates hard validation errors', () => {
    const project = emptyProject('dungeon');
    const hardResult = validateProject(project);
    const advisoryResult = advisoryValidation(project);
    const hardPaths = new Set(hardResult.errors.map((e) => `${e.path}:${e.message}`));
    for (const item of advisoryResult.items) {
      expect(hardPaths.has(`${item.path}:${item.message}`)).toBe(false);
    }
  });

  it('severity is always info or suggestion', () => {
    for (const mode of AUTHORING_MODES) {
      const project = emptyProject(mode as AuthoringMode);
      const result = advisoryValidation(project);
      for (const item of result.items) {
        expect(['info', 'suggestion']).toContain(item.severity);
      }
    }
  });
});
