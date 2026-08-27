// project-shape.test.ts — F-581f740f: v4.0 JSON omitted arrays + barrel helpers
import { describe, it, expect } from 'vitest';
import {
  createEmptyProject,
  normalizeProjectShape,
  stampProjectSchemaVersion,
  validateProject,
  WORLD_PROJECT_REQUIRED_ARRAY_FIELDS,
  WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS,
  SCHEMA_VERSION,
  MODE_GRID_DEFAULTS,
  DEFAULT_MODE,
} from '../index.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';

const POST_V40_REQUIRED = [
  'craftingStations',
  'marketNodes',
  'tilesets',
  'tileLayers',
  'props',
  'propPlacements',
  'ambientLayers',
  'tones',
] as const;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function v4Bare(overrides: Record<string, unknown> = {}): WorldProject {
  const p = clone(minimalProject) as WorldProject & Record<string, unknown>;
  for (const field of POST_V40_REQUIRED) {
    delete p[field];
  }
  Object.assign(p, overrides);
  return p as WorldProject;
}

describe('createEmptyProject', () => {
  it('defaults to dungeon grid and fills every required array', () => {
    const project = createEmptyProject();
    expect(project.mode).toBe(DEFAULT_MODE);
    expect(project.map.gridWidth).toBe(MODE_GRID_DEFAULTS.dungeon.width);
    expect(project.map.gridHeight).toBe(MODE_GRID_DEFAULTS.dungeon.height);
    expect(project.map.tileSize).toBe(MODE_GRID_DEFAULTS.dungeon.tileSize);
    expect(project.tones).toEqual(['atmospheric']);
    for (const field of WORLD_PROJECT_REQUIRED_ARRAY_FIELDS) {
      expect(Array.isArray(project[field]), field).toBe(true);
    }
  });

  it('applies per-mode grid defaults', () => {
    const ocean = createEmptyProject('ocean');
    expect(ocean.mode).toBe('ocean');
    expect(ocean.map.gridWidth).toBe(MODE_GRID_DEFAULTS.ocean.width);
    expect(ocean.map.tileSize).toBe(MODE_GRID_DEFAULTS.ocean.tileSize);
    const space = createEmptyProject('space');
    expect(space.map.gridWidth).toBe(MODE_GRID_DEFAULTS.space.width);
    expect(space.map.tileSize).toBe(MODE_GRID_DEFAULTS.space.tileSize);
  });
});

describe('normalizeProjectShape', () => {
  it('rejects null, primitives, and arrays', () => {
    expect(normalizeProjectShape(null)).toBeNull();
    expect(normalizeProjectShape(undefined)).toBeNull();
    expect(normalizeProjectShape('a string')).toBeNull();
    expect(normalizeProjectShape(42)).toBeNull();
    expect(normalizeProjectShape([1, 2, 3])).toBeNull();
  });

  it('backfills every required array on a bare v4.0 object', () => {
    const result = normalizeProjectShape({ id: 'p1', name: 'Bare' });
    expect(result).not.toBeNull();
    for (const field of WORLD_PROJECT_REQUIRED_ARRAY_FIELDS) {
      expect(Array.isArray(result![field]), field).toBe(true);
    }
  });

  it('leaves optional arrays undefined when omitted', () => {
    const result = normalizeProjectShape({ id: 'p1', name: 'Bare' });
    expect(result).not.toBeNull();
    for (const field of WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS) {
      expect(result![field], field).toBeUndefined();
    }
  });

  it('coerces present-but-wrong-typed arrays so loaders do not crash', () => {
    const result = normalizeProjectShape({ id: 'p1', name: 'Corrupted', zones: 'not-an-array' });
    expect(result).not.toBeNull();
    expect(result!.zones).toEqual([]);
  });

  it('preserves a well-formed project', () => {
    const project = clone(minimalProject);
    project.name = 'My Real Project';
    const result = normalizeProjectShape(project);
    expect(result).not.toBeNull();
    expect(result!.name).toBe('My Real Project');
    expect(result!.zones).toHaveLength(2);
    expect(result!.zones[0].id).toBe('zone-entrance');
  });
});

describe('F-581f740f: v4.0 omitted arrays vs present-but-wrong types', () => {
  it('validateProject rejects omitted post-v4.0 required arrays on raw JSON', () => {
    const raw = v4Bare();
    const result = validateProject(raw);
    expect(result.valid).toBe(false);
    for (const field of POST_V40_REQUIRED) {
      expect(result.errors.some((e) => e.path === field), field).toBe(true);
    }
  });

  it('stampProjectSchemaVersion backfills omitted required arrays and then validates', () => {
    const raw = v4Bare();
    const stamped = stampProjectSchemaVersion(raw);
    for (const field of POST_V40_REQUIRED) {
      expect(Array.isArray(stamped[field]), field).toBe(true);
    }
    expect(stamped.schemaVersion).toBe(SCHEMA_VERSION);
    expect(validateProject(stamped).valid).toBe(true);
  });

  it('stamp leaves an existing schemaVersion and still backfills omitted arrays', () => {
    const raw = v4Bare({ schemaVersion: '4.0.0' });
    const stamped = stampProjectSchemaVersion(raw);
    expect(stamped.schemaVersion).toBe('4.0.0');
    expect(Array.isArray(stamped.craftingStations)).toBe(true);
    expect(validateProject(stamped).valid).toBe(true);
  });

  it('validateProject still rejects present-but-wrong types (honesty)', () => {
    const bad = {
      ...minimalProject,
      craftingStations: 'not-an-array',
      marketNodes: { oops: true },
      tilesets: 42,
    } as unknown as WorldProject;
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'craftingStations')).toBe(true);
    expect(result.errors.some((e) => e.path === 'marketNodes')).toBe(true);
    expect(result.errors.some((e) => e.path === 'tilesets')).toBe(true);
  });

  it('stamp does not coerce present-but-wrong types, so validate stays honest after stamp', () => {
    const bad = {
      ...minimalProject,
      craftingStations: 'not-an-array',
    } as unknown as WorldProject;
    const stamped = stampProjectSchemaVersion(bad);
    expect(stamped.craftingStations).toBe('not-an-array' as unknown as WorldProject['craftingStations']);
    const result = validateProject(stamped);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'craftingStations')).toBe(true);
  });
});
