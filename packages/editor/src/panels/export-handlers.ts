// export-handlers.ts — pure logic for the Export / Export-Unreal flows.
//
// Extracted from `ExportModal.tsx` so the handler behaviour (clear-stale-state,
// success path, serialization-failure path) can be exercised by logic-level
// tests without mounting React. The modal consumes these via callbacks that
// wire into its local React state + `markExported` store action.

import type { WorldProject } from '@world-forge/schema';
import { exportToEngine } from '@world-forge/export-ai-rpg';
import { exportToUnreal } from '@world-forge/export-unreal';

export type ExportStatus = 'idle' | 'valid' | 'invalid' | 'exported';

/**
 * Ambient API the handlers depend on. Tests inject a stub so we don't need a
 * real `document`, `Blob`, or `URL.createObjectURL`.
 */
export interface ExportEnv {
  /**
   * Wraps the final bundle + triggers download. Returns the object URL that
   * was used, or null if the environment could not produce one. The caller is
   * responsible for revoking URLs it stashes as fallbacks.
   *
   * Throws on serialization / blob failure; the handler converts that into a
   * user-visible error.
   */
  downloadJson: (filename: string, data: unknown) => string | null;
}

/** Callbacks the handler uses to drive React state / side effects. */
export interface ExportCallbacks {
  setErrors: (errors: string[]) => void;
  setWarnings: (warnings: string[]) => void;
  setStatus: (status: ExportStatus) => void;
  markExported: () => void;
  /**
   * ED-B-002: manual-download fallback. If the browser blocks the synthetic
   * click (popup blocker, sandbox, etc.) the user sees nothing, so we hand the
   * caller an object URL + filename they can render as a visible
   * "click here to download" anchor. Revoked when the caller dismisses it.
   */
  setFallback?: (fallback: { href: string; filename: string } | null) => void;
}

/**
 * Default production implementation of `downloadJson` — creates a Blob, an
 * object URL, and synthesises a click. Used by the modal at runtime. Tests
 * replace this.
 */
export function defaultDownloadJson(filename: string, data: unknown): string | null {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // ED-B-002: we intentionally DO NOT revoke here. The caller may stash the
  // URL as a manual-download fallback if the synthetic click was blocked. The
  // fallback anchor is short-lived and revoked when the user dismisses it or
  // the modal unmounts.
  return url;
}

/**
 * Run the AI-RPG engine export flow.
 *
 * Covers: ED-A-001 (clear stale state), ED-A-011 (wrap serialization).
 */
export function runEngineExport(
  project: WorldProject,
  cb: ExportCallbacks,
  env: ExportEnv = { downloadJson: defaultDownloadJson },
): void {
  // ED-A-001: clear stale errors/warnings/status before a new attempt
  cb.setErrors([]);
  cb.setWarnings([]);
  cb.setStatus('idle');

  const result = exportToEngine(project);
  if (!result.success) {
    cb.setStatus('invalid');
    cb.setErrors(result.errors.map((e) => `[${e.path}] ${e.message}`));
    return;
  }

  cb.setWarnings(result.warnings);

  try {
    const filename = `${project.id}-engine-pack.json`;
    const url = env.downloadJson(filename, {
      contentPack: result.contentPack,
      manifest: result.manifest,
      packMeta: result.packMeta,
    });
    cb.setStatus('exported');
    cb.markExported();
    // ED-B-002: stash a manual-download URL so the modal can render a visible
    // "If nothing appears, click here" anchor. The browser popup-blocker can
    // swallow synthetic clicks silently.
    if (url && cb.setFallback) cb.setFallback({ href: url, filename });
  } catch (err) {
    cb.setStatus('invalid');
    const msg = err instanceof Error ? err.message : String(err);
    cb.setErrors([`Failed to serialize export bundle: ${msg}`]);
  }
}

/**
 * Run the Unreal Engine 5 export flow.
 *
 * Covers: ED-A-002 (clear stale state), ED-A-006 (fidelity type contract),
 * ED-A-011 (wrap serialization).
 */
export function runUnrealExport(
  project: WorldProject,
  cb: ExportCallbacks,
  env: ExportEnv = { downloadJson: defaultDownloadJson },
): void {
  // ED-A-002: clear stale errors/warnings/status before a new attempt
  cb.setErrors([]);
  cb.setWarnings([]);
  cb.setStatus('idle');

  const result = exportToUnreal(project);
  if (!result.success) {
    cb.setStatus('invalid');
    cb.setErrors(result.errors.map((e) => `[${e.path}] ${e.message}`));
    return;
  }

  cb.setWarnings(result.warnings);

  // ED-A-006: `UnrealExportResult.fidelity` is always present on success by
  // type contract (@world-forge/export-unreal/src/export.ts). No runtime
  // guard required once the discriminant has narrowed.

  try {
    const filename = `${project.id}-unreal-pack.json`;
    const url = env.downloadJson(filename, {
      contentPack: result.contentPack,
      fidelity: result.fidelity,
    });
    cb.setStatus('exported');
    cb.markExported();
    // ED-B-002: manual-download fallback — see runEngineExport for rationale.
    if (url && cb.setFallback) cb.setFallback({ href: url, filename });
  } catch (err) {
    cb.setStatus('invalid');
    const msg = err instanceof Error ? err.message : String(err);
    cb.setErrors([`Failed to serialize Unreal export bundle: ${msg}`]);
  }
}
