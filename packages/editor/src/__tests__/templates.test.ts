import { describe, it, expect } from 'vitest';
import { validateProject, AUTHORING_MODES } from '@world-forge/schema';
import type { AuthoringMode } from '@world-forge/schema';
import { GENRE_TEMPLATES, SAMPLE_WORLDS, createProjectFromWizard } from '../templates/registry.js';
import { classifyError } from '../panels/validation-helpers.js';
import { createEmptyProject } from '../store/project-store.js';
import { getModeProfile } from '../mode-profiles.js';

describe('genre templates', () => {
  for (const t of GENRE_TEMPLATES) {
    it(`${t.name} template validates clean`, () => {
      const result = validateProject(t.project);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it(`${t.name} template has starter items`, () => {
      expect(t.project.itemPlacements.length).toBeGreaterThanOrEqual(2);
    });
  }
});

describe('sample worlds', () => {
  for (const s of SAMPLE_WORLDS) {
    it(`${s.name} sample validates clean`, () => {
      const result = validateProject(s.project);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  }
});

describe('createProjectFromWizard', () => {
  it('creates a valid project from genre template with all systems', () => {
    const project = createProjectFromWizard({
      name: 'Test Fantasy',
      genre: 'fantasy',
      mode: 'dungeon',
      includePlayer: true,
      includeBuildCatalog: true,
      includeProgressionTree: true,
      includeDialogue: true,
      includeSampleNPCs: true,
    });
    expect(project.name).toBe('Test Fantasy');
    expect(project.id).toMatch(/^project-/);
    const result = validateProject(project);
    expect(result.valid).toBe(true);
  });

  it('creates a valid blank project with no systems', () => {
    const project = createProjectFromWizard({
      name: 'Empty',
      genre: 'blank',
      mode: 'dungeon',
      includePlayer: false,
      includeBuildCatalog: false,
      includeProgressionTree: false,
      includeDialogue: false,
      includeSampleNPCs: false,
    });
    expect(project.name).toBe('Empty');
    expect(project.playerTemplate).toBeUndefined();
    expect(project.buildCatalog).toBeUndefined();
    expect(project.progressionTrees).toHaveLength(0);
    expect(project.dialogues).toHaveLength(0);
    expect(project.entityPlacements).toHaveLength(0);
  });

  it('strips player template when unchecked', () => {
    const project = createProjectFromWizard({
      name: 'No Player',
      genre: 'fantasy',
      mode: 'dungeon',
      includePlayer: false,
      includeBuildCatalog: true,
      includeProgressionTree: true,
      includeDialogue: true,
      includeSampleNPCs: true,
    });
    expect(project.playerTemplate).toBeUndefined();
    expect(project.buildCatalog).toBeDefined();
  });

  it('strips dialogue and clears entity dialogue refs when unchecked', () => {
    const project = createProjectFromWizard({
      name: 'No Dialogue',
      genre: 'fantasy',
      mode: 'dungeon',
      includePlayer: true,
      includeBuildCatalog: true,
      includeProgressionTree: true,
      includeDialogue: false,
      includeSampleNPCs: true,
    });
    expect(project.dialogues).toHaveLength(0);
    for (const e of project.entityPlacements) {
      expect(e.dialogueId).toBeUndefined();
    }
  });
});

describe('chapel assets', () => {
  const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold')!;

  it('has asset entries', () => {
    expect(chapel.project.assets.length).toBeGreaterThanOrEqual(5);
  });

  it('asset bindings reference valid asset IDs', () => {
    const assetIds = new Set(chapel.project.assets.map((a) => a.id));
    for (const z of chapel.project.zones) {
      if (z.backgroundId) expect(assetIds.has(z.backgroundId)).toBe(true);
      if (z.tilesetId) expect(assetIds.has(z.tilesetId)).toBe(true);
    }
    for (const e of chapel.project.entityPlacements) {
      if (e.portraitId) expect(assetIds.has(e.portraitId)).toBe(true);
      if (e.spriteId) expect(assetIds.has(e.spriteId)).toBe(true);
    }
    for (const i of chapel.project.itemPlacements) {
      if (i.iconId) expect(assetIds.has(i.iconId)).toBe(true);
    }
  });

  it('all samples validate with assets', () => {
    for (const s of SAMPLE_WORLDS) {
      const result = validateProject(s.project);
      expect(result.valid).toBe(true);
    }
  });

  it('landmark icon bindings reference valid asset IDs', () => {
    const assetIds = new Set(chapel.project.assets.map((a) => a.id));
    expect(chapel.project.landmarks.length).toBeGreaterThanOrEqual(1);
    for (const lm of chapel.project.landmarks) {
      if (lm.iconId) expect(assetIds.has(lm.iconId)).toBe(true);
    }
  });
});

describe('chapel asset packs', () => {
  const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold')!;

  it('has an asset pack', () => {
    expect(chapel.project.assetPacks.length).toBe(1);
    expect(chapel.project.assetPacks[0].id).toBe('chapel-base-pack');
  });

  it('all chapel assets reference valid pack ID', () => {
    const packIds = new Set(chapel.project.assetPacks.map((p) => p.id));
    for (const a of chapel.project.assets) {
      expect(a.packId).toBeDefined();
      expect(packIds.has(a.packId!)).toBe(true);
    }
  });

  it('all samples validate with asset packs', () => {
    for (const s of SAMPLE_WORLDS) {
      const result = validateProject(s.project);
      expect(result.valid).toBe(true);
    }
  });
});

describe('invalid project path — classifyError routing', () => {
  it('routes spawnPoint errors to world domain', () => {
    const project = createProjectFromWizard({
      name: 'Broken',
      genre: 'fantasy',
      mode: 'dungeon',
      includePlayer: true,
      includeBuildCatalog: true,
      includeProgressionTree: true,
      includeDialogue: true,
      includeSampleNPCs: true,
    });
    // Break it: remove spawn points
    project.spawnPoints = [];
    const result = validateProject(project);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const spawnError = result.errors.find((e) => e.path === 'spawnPoints');
    expect(spawnError).toBeDefined();
    expect(classifyError(spawnError!)).toBe('world');
  });

  it('routes entity errors to entities domain', () => {
    const project = createProjectFromWizard({
      name: 'Bad Entity',
      genre: 'fantasy',
      mode: 'dungeon',
      includePlayer: true,
      includeBuildCatalog: true,
      includeProgressionTree: true,
      includeDialogue: true,
      includeSampleNPCs: true,
    });
    // Break it: point entity to nonexistent zone
    project.entityPlacements[0].zoneId = 'zone-nonexistent';
    const result = validateProject(project);
    expect(result.valid).toBe(false);

    const entityError = result.errors.find((e) => e.path.includes('entityPlacements'));
    expect(entityError).toBeDefined();
    expect(classifyError(entityError!)).toBe('entities');
  });
});

describe('mode-aware project creation', () => {
  it('createEmptyProject() defaults to dungeon grid (30×25, tileSize 32)', () => {
    const project = createEmptyProject();
    expect(project.mode).toBe('dungeon');
    expect(project.map.gridWidth).toBe(30);
    expect(project.map.gridHeight).toBe(25);
    expect(project.map.tileSize).toBe(32);
  });

  it('createEmptyProject("ocean") uses ocean grid (60×50, tileSize 48)', () => {
    const project = createEmptyProject('ocean');
    expect(project.mode).toBe('ocean');
    expect(project.map.gridWidth).toBe(60);
    expect(project.map.gridHeight).toBe(50);
    expect(project.map.tileSize).toBe(48);
  });

  it('createEmptyProject("space") uses space grid (100×80, tileSize 64)', () => {
    const project = createEmptyProject('space');
    expect(project.mode).toBe('space');
    expect(project.map.gridWidth).toBe(100);
    expect(project.map.gridHeight).toBe(80);
    expect(project.map.tileSize).toBe(64);
  });

  it('createEmptyProject("interior") uses interior grid (20×15, tileSize 24)', () => {
    const project = createEmptyProject('interior');
    expect(project.mode).toBe('interior');
    expect(project.map.gridWidth).toBe(20);
    expect(project.map.gridHeight).toBe(15);
    expect(project.map.tileSize).toBe(24);
  });

  it('wizard with mode="world" applies world grid (80×60, tileSize 48)', () => {
    const project = createProjectFromWizard({
      name: 'World Test',
      genre: 'blank',
      mode: 'world',
      includePlayer: false,
      includeBuildCatalog: false,
      includeProgressionTree: false,
      includeDialogue: false,
      includeSampleNPCs: false,
    });
    expect(project.mode).toBe('world');
    expect(project.map.gridWidth).toBe(80);
    expect(project.map.gridHeight).toBe(60);
    expect(project.map.tileSize).toBe(48);
  });

  it('genre templates preserve genre when mode is set independently', () => {
    const project = createProjectFromWizard({
      name: 'Pirate Dungeon',
      genre: 'pirate',
      mode: 'dungeon',
      includePlayer: true,
      includeBuildCatalog: false,
      includeProgressionTree: false,
      includeDialogue: false,
      includeSampleNPCs: false,
    });
    expect(project.genre).toBe('pirate');
    expect(project.mode).toBe('dungeon');
    expect(project.map.gridWidth).toBe(30);
  });

  it('blank wizard respects mode grid defaults', () => {
    const project = createProjectFromWizard({
      name: 'Blank Wilderness',
      genre: 'blank',
      mode: 'wilderness',
      includePlayer: false,
      includeBuildCatalog: false,
      includeProgressionTree: false,
      includeDialogue: false,
      includeSampleNPCs: false,
    });
    expect(project.mode).toBe('wilderness');
    expect(project.map.gridWidth).toBe(60);
    expect(project.map.gridHeight).toBe(50);
    expect(project.map.tileSize).toBe(48);
  });

  it.each(AUTHORING_MODES)('createEmptyProject("%s") applies correct mode and grid', (mode) => {
    const project = createEmptyProject(mode as AuthoringMode);
    expect(project.mode).toBe(mode);
    const profile = getModeProfile(mode as AuthoringMode);
    expect(project.map.gridWidth).toBe(profile.grid.width);
    expect(project.map.gridHeight).toBe(profile.grid.height);
    expect(project.map.tileSize).toBe(profile.grid.tileSize);
    // Empty projects are structurally valid WorldProject objects
    expect(project.id).toBeTruthy();
    expect(project.name).toBeTruthy();
    expect(project.zones).toEqual([]);
  });

  it('all genre templates have mode field set', () => {
    for (const t of GENRE_TEMPLATES) {
      expect(t.mode).toBeDefined();
    }
  });
});

describe('mode samples', () => {
  it('sample count is 9', () => {
    expect(SAMPLE_WORLDS.length).toBe(9);
  });

  for (const s of SAMPLE_WORLDS) {
    it(`${s.name} sample validates clean`, () => {
      const result = validateProject(s.project);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it(`${s.name} has correct mode set`, () => {
      expect(s.mode).toBeDefined();
      expect(s.project.mode).toBe(s.mode);
    });
  }

  it('each new sample has >= 1 zone, connection, district, spawn', () => {
    const newIds = ['ocean-harbor', 'space-station', 'wilderness-trail', 'city-market', 'world-map', 'cabin-interior'];
    for (const id of newIds) {
      const sample = SAMPLE_WORLDS.find((s) => s.id === id);
      expect(sample).toBeDefined();
      expect(sample!.project.zones.length).toBeGreaterThanOrEqual(1);
      expect(sample!.project.connections.length).toBeGreaterThanOrEqual(1);
      expect(sample!.project.districts.length).toBeGreaterThanOrEqual(1);
      expect(sample!.project.spawnPoints.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('ocean uses channel, space uses docking, wilderness uses trail', () => {
    const ocean = SAMPLE_WORLDS.find((s) => s.id === 'ocean-harbor')!;
    expect(ocean.project.connections[0].kind).toBe('channel');

    const space = SAMPLE_WORLDS.find((s) => s.id === 'space-station')!;
    expect(space.project.connections[0].kind).toBe('docking');

    const wild = SAMPLE_WORLDS.find((s) => s.id === 'wilderness-trail')!;
    expect(wild.project.connections[0].kind).toBe('trail');
  });

  it('all sample IDs are unique', () => {
    const ids = SAMPLE_WORLDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('existing samples have mode field', () => {
    const helloWorld = SAMPLE_WORLDS.find((s) => s.id === 'hello-world');
    expect(helloWorld?.mode).toBe('dungeon');
    const tavern = SAMPLE_WORLDS.find((s) => s.id === 'tavern-crossroads');
    expect(tavern?.mode).toBe('district');
    const chapel = SAMPLE_WORLDS.find((s) => s.id === 'chapel-threshold');
    expect(chapel?.mode).toBe('dungeon');
  });
});
