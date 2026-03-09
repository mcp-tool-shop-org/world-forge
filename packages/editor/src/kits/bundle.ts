// bundle.ts — Kit bundle serialization for portable export/import

import type { StarterKit } from './types.js';
import type { AuthoringMode, WorldProject } from '@world-forge/schema';
import { validateKit } from './validate-kit.js';

/** Current bundle format version. Increment on breaking changes. */
export const BUNDLE_VERSION = 1;

/** Portable on-disk format for a starter kit. No runtime ID, no builtIn flag. */
export interface KitBundle {
  bundleVersion: number;
  name: string;
  description: string;
  icon: string;
  modes: AuthoringMode[];
  tags: string[];
  project: WorldProject;
  presetRefs: { region: string[]; encounter: string[] };
  guideHints: Partial<Record<string, { label: string; description: string }>>;
  version?: string;
  exportedAt: string;
}

export interface ParseBundleResult {
  ok: true;
  bundle: KitBundle;
  warnings: string[];
}

export interface ParseBundleError {
  ok: false;
  error: string;
}

/**
 * Serialize a StarterKit into a portable KitBundle.
 * Strips id, builtIn, createdAt, updatedAt, source. Deep-clones the project.
 */
export function serializeKit(kit: StarterKit): KitBundle {
  return {
    bundleVersion: BUNDLE_VERSION,
    name: kit.name,
    description: kit.description,
    icon: kit.icon,
    modes: [...kit.modes],
    tags: [...kit.tags],
    project: JSON.parse(JSON.stringify(kit.project)),
    presetRefs: {
      region: [...kit.presetRefs.region],
      encounter: [...kit.presetRefs.encounter],
    },
    guideHints: JSON.parse(JSON.stringify(kit.guideHints)),
    version: kit.version,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Parse raw JSON data into a validated KitBundle.
 * Returns errors for structural problems, warnings for missing optional fields.
 */
export function parseKitBundle(data: unknown): ParseBundleResult | ParseBundleError {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid kit bundle: not an object' };
  }
  const obj = data as Record<string, unknown>;

  if (typeof obj.bundleVersion !== 'number') {
    return { ok: false, error: 'Invalid kit bundle: missing bundleVersion' };
  }
  if (obj.bundleVersion !== BUNDLE_VERSION) {
    return { ok: false, error: `Unsupported bundle version: ${obj.bundleVersion} (expected ${BUNDLE_VERSION})` };
  }
  if (typeof obj.name !== 'string' || !obj.name.trim()) {
    return { ok: false, error: 'Invalid kit bundle: name is required' };
  }
  if (!Array.isArray(obj.modes) || obj.modes.length === 0) {
    return { ok: false, error: 'Invalid kit bundle: at least one mode is required' };
  }
  if (!obj.project || typeof obj.project !== 'object') {
    return { ok: false, error: 'Invalid kit bundle: project is required' };
  }

  const warnings: string[] = [];
  if (typeof obj.description !== 'string') warnings.push('Missing description');
  if (typeof obj.icon !== 'string') warnings.push('Missing icon');
  if (!Array.isArray(obj.tags)) warnings.push('Missing tags array');

  const bundle: KitBundle = {
    bundleVersion: BUNDLE_VERSION,
    name: obj.name as string,
    description: typeof obj.description === 'string' ? obj.description : '',
    icon: typeof obj.icon === 'string' ? obj.icon : '',
    modes: obj.modes as AuthoringMode[],
    tags: Array.isArray(obj.tags)
      ? obj.tags.filter((t): t is string => typeof t === 'string')
      : [],
    project: obj.project as WorldProject,
    presetRefs:
      obj.presetRefs && typeof obj.presetRefs === 'object'
        ? {
            region: Array.isArray((obj.presetRefs as Record<string, unknown>).region)
              ? ((obj.presetRefs as Record<string, unknown>).region as string[])
              : [],
            encounter: Array.isArray((obj.presetRefs as Record<string, unknown>).encounter)
              ? ((obj.presetRefs as Record<string, unknown>).encounter as string[])
              : [],
          }
        : { region: [], encounter: [] },
    guideHints:
      obj.guideHints && typeof obj.guideHints === 'object'
        ? (obj.guideHints as KitBundle['guideHints'])
        : {},
    version: typeof obj.version === 'string' ? obj.version : undefined,
    exportedAt:
      typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
  };

  return { ok: true, bundle, warnings };
}

/** Generate a sanitized filename from a kit name. */
export function kitFilename(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'kit'}.wfkit.json`;
}

/** Result of the full import validation pipeline. */
export interface ImportKitResult {
  ok: true;
  kit: Omit<StarterKit, 'id' | 'builtIn' | 'createdAt' | 'updatedAt'>;
  parseWarnings: string[];
  validationWarnings: string[];
  validationErrors: string[];
  isValid: boolean;
}

/**
 * Full import pipeline: parse JSON → validate bundle → validate as kit.
 * Returns a ready-to-import kit shape (without ID) or a parse error.
 */
export function prepareKitImport(data: unknown): ImportKitResult | ParseBundleError {
  const parsed = parseKitBundle(data);
  if (!parsed.ok) return parsed;

  const { bundle, warnings: parseWarnings } = parsed;

  const tempKit: StarterKit = {
    id: 'temp-import',
    builtIn: false,
    name: bundle.name,
    description: bundle.description,
    icon: bundle.icon,
    modes: bundle.modes,
    tags: bundle.tags,
    project: bundle.project,
    presetRefs: bundle.presetRefs,
    guideHints: bundle.guideHints,
    version: bundle.version,
    source: 'imported',
  };

  const validation = validateKit(tempKit);

  return {
    ok: true,
    kit: {
      name: bundle.name,
      description: bundle.description,
      icon: bundle.icon,
      modes: bundle.modes,
      tags: bundle.tags,
      project: bundle.project,
      presetRefs: bundle.presetRefs,
      guideHints: bundle.guideHints,
      version: bundle.version,
      source: 'imported' as const,
    },
    parseWarnings,
    validationWarnings: validation.warnings,
    validationErrors: validation.errors,
    isValid: validation.valid,
  };
}
