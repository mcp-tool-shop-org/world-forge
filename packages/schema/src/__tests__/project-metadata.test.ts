import { describe, it, expect } from 'vitest';
import { advisoryValidation } from '../advisory.js';
import type { WorldProject } from '../project.js';
import type { AuthoringMode } from '../authoring-mode.js';

/** Minimal empty project factory — metadata fields omitted by default. */
function emptyProject(overrides?: Partial<WorldProject>): WorldProject {
  return {
    id: 'test-metadata',
    name: 'Metadata Test',
    description: 'Test',
    version: '1.0.0',
    genre: 'fantasy',
    tones: ['dark'],
    difficulty: 'normal',
    narratorTone: 'neutral',
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
    ...overrides,
  };
}

describe('FT-035: Project Metadata', () => {
  // ── Type-level checks ─────────────────────────────────────

  it('accepts all metadata fields when populated', () => {
    const project = emptyProject({
      author: 'Jane Doe',
      license: 'CC-BY-4.0',
      category: 'fantasy',
      projectTags: ['medieval', 'magic'],
    });
    expect(project.author).toBe('Jane Doe');
    expect(project.license).toBe('CC-BY-4.0');
    expect(project.category).toBe('fantasy');
    expect(project.projectTags).toEqual(['medieval', 'magic']);
  });

  it('metadata fields are optional — project valid without them', () => {
    const project = emptyProject();
    expect(project.author).toBeUndefined();
    expect(project.license).toBeUndefined();
    expect(project.category).toBeUndefined();
    expect(project.projectTags).toBeUndefined();
  });

  it('projectTags can be empty array', () => {
    const project = emptyProject({ projectTags: [] });
    expect(project.projectTags).toEqual([]);
  });

  // ── Advisory: author ──────────────────────────────────────

  it('warns when author is missing', () => {
    const project = emptyProject();
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'author')).toBe(true);
  });

  it('warns when author is empty string', () => {
    const project = emptyProject({ author: '' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'author')).toBe(true);
  });

  it('warns when author is whitespace-only', () => {
    const project = emptyProject({ author: '   ' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'author')).toBe(true);
  });

  it('no author warning when author is set', () => {
    const project = emptyProject({ author: 'Jane Doe' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'author')).toBe(false);
  });

  // ── Advisory: license ─────────────────────────────────────

  it('warns when license is missing', () => {
    const project = emptyProject();
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'license')).toBe(true);
  });

  it('warns when license is empty string', () => {
    const project = emptyProject({ license: '' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'license')).toBe(true);
  });

  it('no license warning when license is set', () => {
    const project = emptyProject({ license: 'MIT' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'license')).toBe(false);
  });

  // ── Advisory: category ────────────────────────────────────

  it('warns when category is present but empty string', () => {
    const project = emptyProject({ category: '' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'category')).toBe(true);
  });

  it('warns when category is whitespace-only', () => {
    const project = emptyProject({ category: '  ' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'category')).toBe(true);
  });

  it('no category warning when category is omitted', () => {
    const project = emptyProject();
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'category')).toBe(false);
  });

  it('no category warning when category is valid', () => {
    const project = emptyProject({ category: 'sci-fi' });
    const result = advisoryValidation(project);
    expect(result.items.some((i) => i.path === 'category')).toBe(false);
  });

  // ── Advisory severity ─────────────────────────────────────

  it('all metadata advisories have suggestion severity', () => {
    const project = emptyProject({ category: '' });
    const result = advisoryValidation(project);
    const metadataItems = result.items.filter((i) =>
      ['author', 'license', 'category'].includes(i.path),
    );
    expect(metadataItems.length).toBeGreaterThan(0);
    for (const item of metadataItems) {
      expect(item.severity).toBe('suggestion');
    }
  });

  // ── Full metadata suppresses all metadata advisories ──────

  it('no metadata advisories when all fields populated', () => {
    const project = emptyProject({
      author: 'Jane Doe',
      license: 'CC-BY-4.0',
      category: 'fantasy',
      projectTags: ['medieval'],
    });
    const result = advisoryValidation(project);
    const metadataItems = result.items.filter((i) =>
      ['author', 'license', 'category'].includes(i.path),
    );
    expect(metadataItems).toHaveLength(0);
  });
});
