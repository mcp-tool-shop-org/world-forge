// bundle.ts — Project bundle serialization for portable export/import

import type { WorldProject } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

/** Current project bundle format version. Increment on breaking changes. */
export const PROJECT_BUNDLE_VERSION = 1;

/** Content counts for quick preview before import. */
export interface ProjectBundleSummary {
  zones: number;
  entities: number;
  items: number;
  dialogues: number;
  districts: number;
  spawns: number;
  connections: number;
  encounters: number;
  assets: number;
  assetPacks: number;
}

/** External references this project expects. */
export interface ProjectBundleDependencies {
  kitName?: string;        // active kit name at export time (display-only)
  kitSource?: string;      // 'local' | 'imported' | 'built-in'
  assetPackIds: string[];  // IDs of embedded asset packs (always present)
}

/** Portable on-disk format for a World Forge project. */
export interface ProjectBundle {
  bundleVersion: number;
  exportedAt: string;
  name: string;
  description: string;
  version: string;
  genre: string;
  mode?: string;
  project: WorldProject;
  summary: ProjectBundleSummary;
  dependencies: ProjectBundleDependencies;
}

export interface ParseProjectResult {
  ok: true;
  bundle: ProjectBundle;
  warnings: string[];
}

export interface ParseProjectError {
  ok: false;
  error: string;
}

/** Result of the full import validation pipeline. */
export interface ImportProjectResult {
  ok: true;
  project: WorldProject;
  bundle: ProjectBundle;
  parseWarnings: string[];
  validationWarnings: string[];
  validationErrors: string[];
  isValid: boolean;
}

/** Kit provenance + asset pack listing for display. */
export interface DependencyReport {
  kitRef?: { name: string; source?: string };
  assetPacks: Array<{ id: string; label: string }>;
}

/**
 * Serialize a WorldProject into a portable ProjectBundle.
 * Deep-clones the project. Computes summary and dependencies.
 */
export function serializeProject(
  project: WorldProject,
  activeKit?: { name: string; source?: string } | null,
): ProjectBundle {
  const summary: ProjectBundleSummary = {
    zones: project.zones.length,
    entities: project.entityPlacements.length,
    items: project.itemPlacements.length,
    dialogues: project.dialogues.length,
    districts: project.districts.length,
    spawns: project.spawnPoints.length,
    connections: project.connections.length,
    encounters: project.encounterAnchors.length,
    assets: project.assets.length,
    assetPacks: project.assetPacks.length,
  };

  const dependencies: ProjectBundleDependencies = {
    kitName: activeKit?.name,
    kitSource: activeKit?.source,
    assetPackIds: project.assetPacks.map((p) => p.id),
  };

  return {
    bundleVersion: PROJECT_BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    name: project.name,
    description: project.description,
    version: project.version,
    genre: project.genre,
    mode: project.mode,
    project: JSON.parse(JSON.stringify(project)),
    summary,
    dependencies,
  };
}

/**
 * Parse raw JSON data into a validated ProjectBundle.
 * Returns errors for structural problems, warnings for missing optional fields.
 */
export function parseProjectBundle(data: unknown): ParseProjectResult | ParseProjectError {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid project bundle: not an object' };
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.bundleVersion !== 'number') {
    return { ok: false, error: 'Invalid project bundle: missing bundleVersion' };
  }
  if (obj.bundleVersion !== PROJECT_BUNDLE_VERSION) {
    return { ok: false, error: `Unsupported bundle version: ${obj.bundleVersion} (expected ${PROJECT_BUNDLE_VERSION})` };
  }
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    return { ok: false, error: 'Invalid project bundle: name is required' };
  }
  if (!obj.project || typeof obj.project !== 'object') {
    return { ok: false, error: 'Invalid project bundle: project is required' };
  }

  const warnings: string[] = [];
  if (typeof obj.description !== 'string') warnings.push('Missing description');
  if (typeof obj.mode !== 'string') warnings.push('Missing mode');
  if (typeof obj.version !== 'string') warnings.push('Missing version');
  if (typeof obj.genre !== 'string') warnings.push('Missing genre');

  const bundle: ProjectBundle = {
    bundleVersion: PROJECT_BUNDLE_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    name: obj.name as string,
    description: typeof obj.description === 'string' ? obj.description : '',
    version: typeof obj.version === 'string' ? obj.version : '',
    genre: typeof obj.genre === 'string' ? obj.genre : '',
    mode: typeof obj.mode === 'string' ? obj.mode : undefined,
    project: obj.project as WorldProject,
    summary: obj.summary && typeof obj.summary === 'object'
      ? obj.summary as ProjectBundleSummary
      : {
          zones: 0, entities: 0, items: 0, dialogues: 0, districts: 0,
          spawns: 0, connections: 0, encounters: 0, assets: 0, assetPacks: 0,
        },
    dependencies: obj.dependencies && typeof obj.dependencies === 'object'
      ? obj.dependencies as ProjectBundleDependencies
      : { assetPackIds: [] },
  };

  return { ok: true, bundle, warnings };
}

/** Generate a sanitized filename from a project name. */
export function projectFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'project'}.wfproject.json`;
}

/**
 * Full import pipeline: parse JSON → validate project.
 * Returns a ready-to-load project or a parse error.
 */
export function prepareProjectImport(data: unknown): ImportProjectResult | ParseProjectError {
  const parsed = parseProjectBundle(data);
  if (!parsed.ok) return parsed;

  const { bundle, warnings: parseWarnings } = parsed;
  const validation = validateProject(bundle.project);

  return {
    ok: true,
    project: bundle.project,
    bundle,
    parseWarnings,
    validationWarnings: validation.valid ? [] : validation.errors.map((e) => `${e.path}: ${e.message}`),
    validationErrors: [],
    isValid: validation.valid || validation.errors.length === 0,
  };
}

/** Extract dependency info from a parsed bundle for display. */
export function extractDependencies(bundle: ProjectBundle): DependencyReport {
  return {
    kitRef: bundle.dependencies.kitName
      ? { name: bundle.dependencies.kitName, source: bundle.dependencies.kitSource }
      : undefined,
    assetPacks: bundle.project.assetPacks.map((p) => ({ id: p.id, label: p.label })),
  };
}
