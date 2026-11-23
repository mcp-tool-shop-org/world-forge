// bundle.ts — Kit bundle serialization for portable export/import

import type { KitSpeedPanelPresets, StarterKit } from './types.js';
import type { AuthoringMode, WorldProject } from '@world-forge/schema';
import { validateKit } from './validate-kit.js';
import { sanitizeMacros, sanitizePins } from '../store/speed-panel-store.js';

/** Current bundle format version. Increment on breaking changes. */
export const BUNDLE_VERSION = 1;

/** Oldest version we still accept (best-effort migrate). */
export const MIN_SUPPORTED_BUNDLE_VERSION = 1;

/**
 * Per-from-version migrators. Key is the version being migrated *from*.
 * v1 is the original format; there are no field rewrites yet — the table
 * exists so bumping BUNDLE_VERSION to 2 does not hard-reject existing files.
 */
const KIT_BUNDLE_MIGRATORS: Record<number, (obj: Record<string, unknown>) => Record<string, unknown>> = {
  // 1 → 2: identity until a breaking field lands.
};

export function migrateKitBundle(
  obj: Record<string, unknown>,
  fromVersion: number,
  toVersion: number = BUNDLE_VERSION,
): { data: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  let data = obj;
  let version = fromVersion;
  while (version < toVersion) {
    const step = KIT_BUNDLE_MIGRATORS[version];
    if (step) {
      data = step(data);
    } else {
      warnings.push(`No explicit migrator for kit bundle v${version} → v${version + 1}; reading best-effort.`);
    }
    version += 1;
  }
  return { data, warnings };
}

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
  speedPanelPresets?: KitSpeedPanelPresets;
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

export function sanitizeKitSpeedPanelPresets(raw: unknown): {
  value?: KitSpeedPanelPresets;
  warnings: string[];
} {
  if (raw === undefined) {
    return { warnings: [] };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { warnings: ['Ignored malformed speedPanelPresets field'] };
  }
  const obj = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const pins = sanitizePins(obj.pins ?? [], warnings);
  const macros = sanitizeMacros(obj.macros ?? [], warnings);
  return {
    value: { pins, macros },
    warnings,
  };
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
    ...(kit.speedPanelPresets
      ? {
          speedPanelPresets: {
            pins: [...kit.speedPanelPresets.pins],
            macros: JSON.parse(JSON.stringify(kit.speedPanelPresets.macros)),
          },
        }
      : {}),
    version: kit.version,
    exportedAt: new Date().toISOString(),
  };
}

/**
 * Parse raw JSON data into a validated KitBundle.
 * Returns errors for structural problems, warnings for missing optional fields.
 *
 * F-b81060ec: accept version <= current (run migrators); reject only unknown
 * *future* versions. `currentVersion` is overridable so tests can prove a v1
 * file still parses after BUNDLE_VERSION becomes 2.
 */
export function parseKitBundle(
  data: unknown,
  opts?: { currentVersion?: number },
): ParseBundleResult | ParseBundleError {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Invalid kit bundle: not an object' };
  }
  const obj = data as Record<string, unknown>;
  const currentVersion = opts?.currentVersion ?? BUNDLE_VERSION;

  if (typeof obj.bundleVersion !== 'number') {
    return { ok: false, error: 'Invalid kit bundle: missing bundleVersion' };
  }
  if (obj.bundleVersion > currentVersion) {
    return { ok: false, error: `Unsupported bundle version: ${obj.bundleVersion} (expected <= ${currentVersion})` };
  }
  if (obj.bundleVersion < MIN_SUPPORTED_BUNDLE_VERSION) {
    return { ok: false, error: `Unsupported bundle version: ${obj.bundleVersion} (expected >= ${MIN_SUPPORTED_BUNDLE_VERSION})` };
  }
  const migrated = migrateKitBundle(obj, obj.bundleVersion, currentVersion);
  const parsedObj = migrated.data;
  if (typeof parsedObj.name !== 'string' || !parsedObj.name.trim()) {
    return { ok: false, error: 'Invalid kit bundle: name is required' };
  }
  if (!Array.isArray(parsedObj.modes) || parsedObj.modes.length === 0) {
    return { ok: false, error: 'Invalid kit bundle: at least one mode is required' };
  }
  if (!parsedObj.project || typeof parsedObj.project !== 'object') {
    return { ok: false, error: 'Invalid kit bundle: project is required' };
  }

  const warnings: string[] = [...migrated.warnings];
  if (typeof parsedObj.description !== 'string') warnings.push('Missing description');
  if (typeof parsedObj.icon !== 'string') warnings.push('Missing icon');
  if (!Array.isArray(parsedObj.tags)) warnings.push('Missing tags array');
  const spPresets = sanitizeKitSpeedPanelPresets(parsedObj.speedPanelPresets);
  warnings.push(...spPresets.warnings);

  const bundle: KitBundle = {
    bundleVersion: currentVersion,
    name: parsedObj.name as string,
    description: typeof parsedObj.description === 'string' ? parsedObj.description : '',
    icon: typeof parsedObj.icon === 'string' ? parsedObj.icon : '',
    modes: parsedObj.modes as AuthoringMode[],
    tags: Array.isArray(parsedObj.tags)
      ? parsedObj.tags.filter((t): t is string => typeof t === 'string')
      : [],
    project: parsedObj.project as WorldProject,
    presetRefs:
      parsedObj.presetRefs && typeof parsedObj.presetRefs === 'object'
        ? {
            region: Array.isArray((parsedObj.presetRefs as Record<string, unknown>).region)
              ? ((parsedObj.presetRefs as Record<string, unknown>).region as string[])
              : [],
            encounter: Array.isArray((parsedObj.presetRefs as Record<string, unknown>).encounter)
              ? ((parsedObj.presetRefs as Record<string, unknown>).encounter as string[])
              : [],
          }
        : { region: [], encounter: [] },
    guideHints:
      parsedObj.guideHints && typeof parsedObj.guideHints === 'object'
        ? (parsedObj.guideHints as KitBundle['guideHints'])
        : {},
    ...(spPresets.value ? { speedPanelPresets: spPresets.value } : {}),
    version: typeof parsedObj.version === 'string' ? parsedObj.version : undefined,
    exportedAt:
      typeof parsedObj.exportedAt === 'string' ? parsedObj.exportedAt : new Date().toISOString(),
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

/** Merge current user Speed Panel pins & macros onto a kit copy prior to bundle export. */
export function buildKitWithSpeedPanelPresets(
  kit: StarterKit,
  current?: KitSpeedPanelPresets,
): StarterKit {
  if (!current || (current.pins.length === 0 && current.macros.length === 0)) {
    return kit;
  }
  const existing = kit.speedPanelPresets;
  if (!existing) {
    return {
      ...kit,
      speedPanelPresets: {
        pins: [...current.pins],
        macros: JSON.parse(JSON.stringify(current.macros)),
      },
    };
  }
  const pinSet = new Set([...existing.pins, ...current.pins]);
  const macroIds = new Set(existing.macros.map((m) => m.id));
  const mergedMacros = [
    ...JSON.parse(JSON.stringify(existing.macros)),
    ...JSON.parse(JSON.stringify(current.macros)).filter((m: { id: string }) => !macroIds.has(m.id)),
  ];
  return {
    ...kit,
    speedPanelPresets: {
      pins: [...pinSet],
      macros: mergedMacros,
    },
  };
}

/** Serialize a kit bundle, optionally folding in live user Speed Panel pins & macros. */
export function buildExportBundleForKit(
  kit: StarterKit,
  options: { includeSpeedPanel: boolean; currentPresets?: KitSpeedPanelPresets },
): { filename: string; bundle: KitBundle } {
  const effectiveKit = options.includeSpeedPanel
    ? buildKitWithSpeedPanelPresets(kit, options.currentPresets)
    : kit;
  return {
    filename: kitFilename(effectiveKit.name),
    bundle: serializeKit(effectiveKit),
  };
}

/** Format user-facing status feedback after merging a Starter Kit's Speed Panel presets. */
export function mergeKitSpeedPanelPresetsIfEnabled(
  kit: StarterKit,
  includePresets: boolean,
  mergeFn: (presets: KitSpeedPanelPresets, kitName: string) => {
    addedPins: string[];
    addedMacros: unknown[];
    warnings: string[];
  },
): { message: string; level: 'info' | 'warning' } | null {
  if (!includePresets || !kit.speedPanelPresets) return null;
  const merged = mergeFn(kit.speedPanelPresets, kit.name);
  if (merged.warnings.length > 0) {
    return { message: merged.warnings[0], level: 'warning' };
  }
  if (merged.addedPins.length > 0 || merged.addedMacros.length > 0) {
    return {
      message: `Added ${merged.addedPins.length} Speed Panel pin(s) and ${merged.addedMacros.length} macro(s) from "${kit.name}".`,
      level: 'info',
    };
  }
  return null;
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
    ...(bundle.speedPanelPresets ? { speedPanelPresets: bundle.speedPanelPresets } : {}),
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
      ...(bundle.speedPanelPresets ? { speedPanelPresets: bundle.speedPanelPresets } : {}),
      version: bundle.version,
      source: 'imported' as const,
    },
    parseWarnings,
    validationWarnings: validation.warnings,
    validationErrors: validation.errors,
    isValid: validation.valid,
  };
}
