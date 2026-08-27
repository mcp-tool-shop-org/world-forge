// project-shape.ts — empty-project factory + v4.x document normalizer
//
// These helpers live in @world-forge/schema so headless export CLIs can
// backfill arrays added after v4.0 without depending on the editor store.
// Semantic validity (dangling refs, empty loot tables, missing spawn points)
// stays in validateProject.

import type { WorldProject } from './project.js';
import {
  WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS,
  WORLD_PROJECT_REQUIRED_ARRAY_FIELDS,
} from './project.js';
import {
  DEFAULT_MODE,
  isValidMode,
  MODE_GRID_DEFAULTS,
  type AuthoringMode,
} from './authoring-mode.js';

/**
 * Optional arrays that a brand-new project still materializes as [].
 * lootTables / transitions / projectTags stay omitted (undefined is valid).
 */
const EMPTY_PROJECT_OPTIONAL_ARRAYS = [
  'buildings',
  'hubs',
  'strongholds',
  'strata',
  'stratumLinks',
  'hazardDefinitions',
] as const satisfies readonly (typeof WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS)[number][];

export function createEmptyProject(mode?: AuthoringMode): WorldProject {
  const gridMode = mode !== undefined && isValidMode(mode) ? mode : DEFAULT_MODE;
  const grid = MODE_GRID_DEFAULTS[gridMode];
  const requiredArrays = {} as { [K in typeof WORLD_PROJECT_REQUIRED_ARRAY_FIELDS[number]]: [] };
  for (const field of WORLD_PROJECT_REQUIRED_ARRAY_FIELDS) {
    requiredArrays[field] = [];
  }
  const optionalArrays = {} as { [K in typeof EMPTY_PROJECT_OPTIONAL_ARRAYS[number]]: [] };
  for (const field of EMPTY_PROJECT_OPTIONAL_ARRAYS) {
    optionalArrays[field] = [];
  }
  return {
    id: 'new-project',
    name: 'Untitled World',
    description: '',
    version: '0.1.0',
    genre: 'fantasy',
    difficulty: 'beginner',
    narratorTone: '',
    mode: mode ?? DEFAULT_MODE,
    map: {
      id: 'map-1',
      name: 'Map',
      description: '',
      gridWidth: grid.width,
      gridHeight: grid.height,
      tileSize: grid.tileSize,
    },
    ...requiredArrays,
    tones: ['atmospheric'],
    ...optionalArrays,
  };
}

/**
 * Shape-normalizer for a document about to be validated or loaded.
 *
 * Backfills every WorldProject array field from WORLD_PROJECT_*_ARRAY_FIELDS
 * so omitted post-v4.0 arrays (craftingStations, tilesets, …) become [].
 * Present-but-wrong-typed values are coerced to [] here; validateProject still
 * rejects those shapes when called on the raw document.
 *
 * Returns null when `raw` is not a plausible project object.
 */
export function normalizeProjectShape(raw: unknown): WorldProject | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const mode = typeof r.mode === 'string' ? (r.mode as AuthoringMode) : undefined;
  const empty = createEmptyProject(mode);

  function arr<T>(v: unknown, fallback: T[]): T[] {
    return Array.isArray(v) ? (v as T[]) : fallback;
  }
  function str(v: unknown, fallback: string): string {
    return typeof v === 'string' ? v : fallback;
  }
  function finitePositive(v: unknown): number | null {
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
  }
  function normalizeMap(rawMap: unknown): WorldProject['map'] {
    if (!rawMap || typeof rawMap !== 'object' || Array.isArray(rawMap)) return empty.map;
    const m = rawMap as Record<string, unknown>;
    const tileSize = finitePositive(m.tileSize) ?? empty.map.tileSize;
    const gridWidth = finitePositive(m.gridWidth) ?? empty.map.gridWidth;
    const gridHeight = finitePositive(m.gridHeight) ?? empty.map.gridHeight;
    return {
      ...empty.map,
      ...(m as unknown as WorldProject['map']),
      tileSize,
      gridWidth,
      gridHeight,
    };
  }

  const next: WorldProject = {
    ...empty,
    ...(r as unknown as WorldProject),
    id: str(r.id, empty.id),
    name: str(r.name, empty.name),
    description: str(r.description, empty.description),
    version: str(r.version, empty.version),
    genre: str(r.genre, empty.genre),
    difficulty: str(r.difficulty, empty.difficulty),
    narratorTone: str(r.narratorTone, empty.narratorTone),
    map: normalizeMap(r.map),
  };
  for (const field of WORLD_PROJECT_REQUIRED_ARRAY_FIELDS) {
    (next as unknown as Record<string, unknown>)[field] = arr(
      r[field],
      empty[field] as unknown as unknown[],
    );
  }
  for (const field of WORLD_PROJECT_OPTIONAL_ARRAY_FIELDS) {
    (next as unknown as Record<string, unknown>)[field] =
      r[field] === undefined ? undefined : arr(r[field], []);
  }
  return next;
}

/**
 * Backfill omitted required arrays to [] without coercing present-but-wrong types.
 * Used by stampProjectSchemaVersion so a v4.0 JSON becomes structurally valid
 * while validateProject still reports corrupted (non-array) fields.
 */
export function backfillOmittedRequiredArrays(project: WorldProject): WorldProject {
  const patches: Partial<WorldProject> = {};
  let missing = false;
  for (const field of WORLD_PROJECT_REQUIRED_ARRAY_FIELDS) {
    if (project[field] === undefined) {
      (patches as Record<string, unknown>)[field] = [];
      missing = true;
    }
  }
  return missing ? { ...project, ...patches } : project;
}
