// Tests for EU dogfood findings fixes
import { describe, it, expect } from 'vitest';
import { createProjectFromKit, countContent } from '../panels/TemplateManager.js';
import { filterResults, buildSearchIndex } from '../panels/SearchOverlay.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import type { WorldProject } from '@world-forge/schema';

// EU-009: structuredClone instead of JSON.parse(JSON.stringify())
describe('EU-009: createProjectFromKit deep clone', () => {
  // Build a minimal StarterKit-like object
  const fakeProject: WorldProject = SAMPLE_WORLDS[0].project;
  const fakeKit = {
    id: 'test-kit',
    name: 'Test Kit',
    description: 'test',
    icon: 'T',
    builtIn: false,
    source: 'local' as const,
    modes: ['dungeon' as const],
    tags: [],
    project: fakeProject,
    presetRefs: { region: [], encounter: [] },
    guideHints: {},
  };

  it('produces a distinct object from the source', () => {
    const result = createProjectFromKit(fakeKit);
    expect(result).not.toBe(fakeKit.project);
    expect(result.zones).not.toBe(fakeKit.project.zones);
  });

  it('assigns a new project ID', () => {
    const result = createProjectFromKit(fakeKit);
    expect(result.id).toMatch(/^project-/);
    expect(result.id).not.toBe(fakeKit.project.id);
  });

  it('uses custom name when provided', () => {
    const result = createProjectFromKit(fakeKit, 'My Custom Name');
    expect(result.name).toBe('My Custom Name');
  });

  it('falls back to kit name when no name provided', () => {
    const result = createProjectFromKit(fakeKit);
    expect(result.name).toBe('Test Kit');
  });

  it('preserves zone data', () => {
    const result = createProjectFromKit(fakeKit);
    expect(result.zones.length).toBe(fakeKit.project.zones.length);
  });
});

// EU-009: countContent correctness
describe('EU-009: countContent', () => {
  it('counts all content types', () => {
    const project = SAMPLE_WORLDS[0].project;
    const c = countContent(project);
    expect(c.zones).toBe(project.zones.length);
    expect(c.entities).toBe(project.entityPlacements.length);
    expect(c.dialogues).toBe(project.dialogues.length);
    expect(c.trees).toBe(project.progressionTrees.length);
    expect(c.items).toBe(project.itemPlacements.length);
  });
});

// EU-006: filterResults works (search overlay)
describe('EU-006: search overlay filterResults', () => {
  const project = SAMPLE_WORLDS[0].project;
  const index = buildSearchIndex(project);

  it('returns empty for blank query', () => {
    expect(filterResults(index, '')).toHaveLength(0);
    expect(filterResults(index, '   ')).toHaveLength(0);
  });

  it('limits results to 20', () => {
    // Use a very broad query that matches many items
    const results = filterResults(index, 'a');
    expect(results.length).toBeLessThanOrEqual(20);
  });
});
