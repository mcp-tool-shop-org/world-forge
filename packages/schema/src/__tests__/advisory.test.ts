import { describe, it, expect } from 'vitest';
import { advisoryValidation } from '../advisory.js';
import { validateProject } from '../validate.js';
import { buildReviewSnapshot } from '../review.js';
import type { WorldProject } from '../project.js';
import type { AuthoringMode } from '../authoring-mode.js';
import { AUTHORING_MODES } from '../authoring-mode.js';
import { minimalProject } from './fixtures/minimal.js';

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

  // --- FT-028: Asset naming validation ---

  it('warns on asset with "untitled" in the name', () => {
    const project = emptyProject('dungeon');
    project.assets = [
      { id: 'a1', kind: 'portrait', label: 'Untitled', path: 'a.png', tags: [] },
    ];
    const result = advisoryValidation(project);
    const hit = result.items.find((i) => i.path.includes('a1'));
    expect(hit).toBeDefined();
    expect(hit!.severity).toBe('suggestion');
    expect(hit!.message).toContain("Asset 'Untitled' has a generic name");
  });

  it('warns on purely numeric asset label', () => {
    const project = emptyProject('dungeon');
    project.assets = [
      { id: 'a2', kind: 'sprite', label: '12345', path: 'b.png', tags: [] },
    ];
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path.includes('a2') && i.message.includes("'12345'"))).toBe(true);
  });

  it('warns on asset label shorter than 3 characters', () => {
    const project = emptyProject('world');
    project.assets = [
      { id: 'a3', kind: 'icon', label: 'ab', path: 'c.png', tags: [] },
    ];
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path.includes('a3'))).toBe(true);
  });

  it('warns on asset label containing "sprite_copy"', () => {
    const project = emptyProject('dungeon');
    project.assets = [
      { id: 'a4', kind: 'sprite', label: 'hero_sprite_copy', path: 'd.png', tags: [] },
    ];
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path.includes('a4') && i.message.includes('generic name'))).toBe(true);
  });

  it('warns on asset label containing "image"', () => {
    const project = emptyProject('dungeon');
    project.assets = [
      { id: 'a5', kind: 'background', label: 'new image 2', path: 'e.png', tags: [] },
    ];
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path.includes('a5'))).toBe(true);
  });

  it('does not warn on descriptive asset names', () => {
    const project = emptyProject('dungeon');
    project.assets = [
      { id: 'a6', kind: 'portrait', label: 'npc-merchant-portrait', path: 'f.png', tags: [] },
      { id: 'a7', kind: 'sprite', label: 'goblin-warrior', path: 'g.png', tags: [] },
      { id: 'a8', kind: 'tileset', label: 'forest-floor', path: 'h.png', tags: [] },
    ];
    const result = advisoryValidation(project);
    const assetWarnings = result.items.filter((i) => i.path.startsWith('assets['));
    expect(assetWarnings).toHaveLength(0);
  });

  // --- S-006: pressureType null safety ---

  it('dungeon advisory handles hotspot with undefined pressureType', () => {
    const project = emptyProject('dungeon');
    project.zones = [
      { id: 'z1', name: 'Room 1', x: 0, y: 0, width: 5, height: 5, tags: [] } as any,
      { id: 'z2', name: 'Room 2', x: 6, y: 0, width: 5, height: 5, tags: [] } as any,
    ];
    project.connections = [
      { id: 'c1', fromZoneId: 'z1', toZoneId: 'z2', kind: 'secret', bidirectional: true } as any,
    ];
    // Hotspot with undefined pressureType (simulates missing field)
    project.pressureHotspots = [
      { id: 'h1', zoneId: 'z1', pressureType: undefined as any, baseProbability: 0.5, tags: [] },
    ];
    // Should not throw — optional chaining prevents crash
    expect(() => advisoryValidation(project)).not.toThrow();
    const result = advisoryValidation(project);
    // With no trap tag and undefined pressureType, the trap suggestion should appear
    expect(result.items.some((i) => i.message.includes('trap'))).toBe(true);
  });

  it('dungeon advisory handles hotspot with empty-string pressureType', () => {
    const project = emptyProject('dungeon');
    project.zones = [
      { id: 'z1', name: 'Room 1', x: 0, y: 0, width: 5, height: 5, tags: [] } as any,
      { id: 'z2', name: 'Room 2', x: 6, y: 0, width: 5, height: 5, tags: [] } as any,
    ];
    project.connections = [
      { id: 'c1', fromZoneId: 'z1', toZoneId: 'z2', kind: 'secret', bidirectional: true } as any,
    ];
    // Empty string pressureType — should not crash and trap suggestion should appear
    project.pressureHotspots = [
      { id: 'h1', zoneId: 'z1', pressureType: '', baseProbability: 0.5, tags: [] },
    ];
    expect(() => advisoryValidation(project)).not.toThrow();
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.message.includes('trap'))).toBe(true);
  });

  it('dungeon advisory recognizes trap in pressureType string', () => {
    const project = emptyProject('dungeon');
    project.zones = [
      { id: 'z1', name: 'Room 1', x: 0, y: 0, width: 5, height: 5, tags: [] } as any,
      { id: 'z2', name: 'Room 2', x: 6, y: 0, width: 5, height: 5, tags: [] } as any,
    ];
    project.connections = [
      { id: 'c1', fromZoneId: 'z1', toZoneId: 'z2', kind: 'secret', bidirectional: true } as any,
    ];
    project.pressureHotspots = [
      { id: 'h1', zoneId: 'z1', pressureType: 'trap-activation', baseProbability: 0.5, tags: [] },
    ];
    const result = advisoryValidation(project);
    // No trap suggestion since pressureType contains 'trap'
    expect(result.items.filter((i) => i.message.includes('trap'))).toHaveLength(0);
  });

  // --- F-124d264f: omitted label / interior-without-map must not throw ---

  it('omitted asset label returns AdvisoryResult and never throws', () => {
    const project = emptyProject('dungeon');
    project.assets = [
      { id: 'a-nolabel', kind: 'portrait', path: 'a.png', tags: [] } as any,
    ];
    let result: ReturnType<typeof advisoryValidation> | undefined;
    expect(() => {
      result = advisoryValidation(project);
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(Array.isArray(result!.items)).toBe(true);
    expect(result!.items.some((i) => i.path.includes('a-nolabel'))).toBe(true);
  });

  it('interior mode with omitted map returns AdvisoryResult and never throws', () => {
    const project = emptyProject('interior');
    delete (project as { map?: unknown }).map;
    let result: ReturnType<typeof advisoryValidation> | undefined;
    expect(() => {
      result = advisoryValidation(project);
    }).not.toThrow();
    expect(result).toBeDefined();
    expect(Array.isArray(result!.items)).toBe(true);
  });

  it('buildReviewSnapshot with omitted asset label never throws (blocked snapshot)', () => {
    const project: WorldProject = {
      ...JSON.parse(JSON.stringify(minimalProject)),
      assets: [
        { id: 'a-nolabel', kind: 'portrait', path: 'a.png', tags: [] } as any,
      ],
    };
    let snap: ReturnType<typeof buildReviewSnapshot> | undefined;
    expect(() => {
      snap = buildReviewSnapshot(project);
    }).not.toThrow();
    expect(snap).toBeDefined();
    expect(snap!.health).toBe('blocked');
    expect(Array.isArray(snap!.advisory.firstSuggestions)).toBe(true);
  });

  it('buildReviewSnapshot interior-without-map never throws', () => {
    const project = JSON.parse(JSON.stringify(minimalProject)) as WorldProject;
    project.mode = 'interior';
    delete (project as { map?: unknown }).map;
    let snap: ReturnType<typeof buildReviewSnapshot> | undefined;
    expect(() => {
      snap = buildReviewSnapshot(project);
    }).not.toThrow();
    expect(snap).toBeDefined();
    expect(snap!.advisory).toBeDefined();
  });

  // --- F-df8b561a: non-array tags must not throw ---
  // validateProject may stay valid:true on these shapes; that is the bug's setup,
  // not a Stage B reopen. Non-array tags are treated as no tags.

  it.each([
    { mode: 'dungeon' as const, corrupt: 'hotspot', tags: {}, label: '{}' },
    { mode: 'dungeon' as const, corrupt: 'hotspot', tags: 123, label: '123' },
    { mode: 'space' as const, corrupt: 'zone', tags: {}, label: '{}' },
    { mode: 'space' as const, corrupt: 'zone', tags: 123, label: '123' },
    { mode: 'ocean' as const, corrupt: 'district', tags: {}, label: '{}' },
    { mode: 'ocean' as const, corrupt: 'district', tags: 123, label: '123' },
  ])(
    '$mode $corrupt tags=$label never throws from advisoryValidation or buildReviewSnapshot',
    ({ mode, corrupt, tags }) => {
      const project = JSON.parse(JSON.stringify(minimalProject)) as WorldProject;
      project.mode = mode;
      if (corrupt === 'hotspot') {
        (project.pressureHotspots[0] as { tags: unknown }).tags = tags;
      } else if (corrupt === 'zone') {
        (project.zones[0] as { tags: unknown }).tags = tags;
      } else {
        (project.districts[0] as { tags: unknown }).tags = tags;
      }

      let advisory: ReturnType<typeof advisoryValidation> | undefined;
      expect(() => {
        advisory = advisoryValidation(project);
      }).not.toThrow();
      expect(advisory).toBeDefined();
      expect(Array.isArray(advisory!.items)).toBe(true);

      let snap: ReturnType<typeof buildReviewSnapshot> | undefined;
      expect(() => {
        snap = buildReviewSnapshot(project);
      }).not.toThrow();
      expect(snap).toBeDefined();
      expect(snap!.advisory).toBeDefined();
      expect(Array.isArray(snap!.advisory.firstSuggestions)).toBe(true);
    },
  );
});
