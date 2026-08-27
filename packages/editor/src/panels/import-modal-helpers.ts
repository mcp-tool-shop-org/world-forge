// import-modal-helpers.ts — ImportModal validation-gate extracted for tests
// (no jsdom; this package's vitest environment defaults to 'node').
//
// F-f6081e61: prepareProjectImport returns real isValid/validationErrors, but
// ImportModal never read either field — a schema-invalid WorldProject whose
// envelope parsed was loadable in one click. Mirror ImportKitModal: errors
// block Import; parse/validation warnings stay a separate, non-blocking list.

import type { ImportProjectResult } from '../projects/index.js';

/** Import is enabled for a standard ImportResult, or a *valid* project bundle. */
export function canConfirmImport(args: {
  result: unknown | null;
  bundleResult: { isValid: boolean } | null;
}): boolean {
  if (args.bundleResult) return args.bundleResult.isValid;
  return args.result != null;
}

/**
 * Load a project-bundle import. Returns false (and does not call loadProject)
 * when the bundle is missing or schema-invalid.
 */
export function applyBundleImport<T>(
  bundleResult: { isValid: boolean; project: T } | null,
  loadProject: (project: T) => void,
): boolean {
  if (!bundleResult || !bundleResult.isValid) return false;
  loadProject(bundleResult.project);
  return true;
}

/** Parse warnings stay separate from validation errors; drop warning dupes of errors. */
export function distinctBundleWarnings(bundle: ImportProjectResult): {
  parseWarnings: string[];
  validationWarnings: string[];
} {
  const errorSet = new Set(bundle.validationErrors);
  return {
    parseWarnings: bundle.parseWarnings,
    validationWarnings: bundle.validationWarnings.filter((w) => !errorSet.has(w)),
  };
}

export interface SafeDependencyReport {
  kitRef?: { name: string; source?: string };
  assetPacks: Array<{ id: string; label: string }>;
}

/**
 * F-67ac3bf9: extractDependencies maps bundle.project.assetPacks with no
 * fallback. A truncated-but-ok bundle throws while painting the preview and
 * unmounts the modal. Never let a dependency report crash the import UI.
 */
export function safeExtractDependencies(
  extract: (bundle: ImportProjectResult['bundle']) => SafeDependencyReport,
  bundle: ImportProjectResult['bundle'] | null | undefined,
): SafeDependencyReport | null {
  if (!bundle) return null;
  try {
    const deps = extract(bundle);
    const assetPacks = Array.isArray(deps?.assetPacks) ? deps.assetPacks : [];
    return { kitRef: deps?.kitRef, assetPacks };
  } catch {
    return null;
  }
}
