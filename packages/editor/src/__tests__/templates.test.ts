import { describe, it, expect } from 'vitest';
import { validateProject } from '@world-forge/schema';
import { GENRE_TEMPLATES, SAMPLE_WORLDS, createProjectFromWizard } from '../templates/registry.js';
import { classifyError } from '../panels/validation-helpers.js';

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

describe('invalid project path — classifyError routing', () => {
  it('routes spawnPoint errors to world domain', () => {
    const project = createProjectFromWizard({
      name: 'Broken',
      genre: 'fantasy',
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
