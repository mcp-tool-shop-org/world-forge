// export-handlers.ts — pure logic for the Export / Export-Unreal flows.
//
// Extracted from `ExportModal.tsx` so the handler behaviour (clear-stale-state,
// success path, serialization-failure path) can be exercised by logic-level
// tests without mounting React. The modal consumes these via callbacks that
// wire into its local React state + `markExported` store action.

import type { WorldProject } from '@world-forge/schema';

export type ExportStatus = 'idle' | 'valid' | 'invalid' | 'exported';

export type ExportTarget = 'ai-rpg' | 'unreal' | 'godot';

/** 10B: Per-target export options */
export interface AiRpgExportOptions {
  includeFidelityReport: boolean;
  includeBuildCatalog: boolean;
  includeDialogueProgression: boolean;
}

export interface UnrealExportOptions {
  tileSizeCm: number;
  blueprintPathPrefix: string;
  includeStreamingHints: boolean;
}

export interface GodotExportUIOptions {
  entityScenePrefix: string;
  transitionScenePrefix: string;
  includeWorldTscn: boolean;
  assetBindingMode: 'manual' | 'manifest';
}

export const DEFAULT_AI_RPG_OPTIONS: AiRpgExportOptions = {
  includeFidelityReport: true,
  includeBuildCatalog: true,
  includeDialogueProgression: true,
};

export const DEFAULT_UNREAL_OPTIONS: UnrealExportOptions = {
  tileSizeCm: 100,
  blueprintPathPrefix: '/Game/WorldForge/',
  includeStreamingHints: true,
};

export const DEFAULT_GODOT_OPTIONS: GodotExportUIOptions = {
  entityScenePrefix: 'res://entities/',
  transitionScenePrefix: 'res://transitions/',
  includeWorldTscn: true,
  assetBindingMode: 'manifest',
};

export interface ExportReceipt {
  target: ExportTarget;
  filename: string;
  timestamp: number;
  zones: number;
  entities: number;
  items: number;
  dialogues: number;
  trees: number;
  assets: number;
  warnings: number;
  fidelity: 'preserved' | 'approximated' | 'dropped';
  sizeEstimate: number; // rough byte size of the exported JSON
}

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
  /** 10A: Structured export receipt shown post-download. */
  addReceipt?: (receipt: ExportReceipt) => void;
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
export async function runEngineExport(
  project: WorldProject,
  cb: ExportCallbacks,
  env: ExportEnv = { downloadJson: defaultDownloadJson },
  opts: AiRpgExportOptions = DEFAULT_AI_RPG_OPTIONS,
): Promise<void> {
  // ED-A-001: clear stale errors/warnings/status before a new attempt
  cb.setErrors([]);
  cb.setWarnings([]);
  cb.setStatus('idle');

  const { exportToEngine } = await import('@world-forge/export-ai-rpg');
  const result = exportToEngine(project);
  if (!result.success) {
    cb.setStatus('invalid');
    cb.setErrors(result.errors.map((e) => `[${e.path}] ${e.message}`));
    return;
  }

  cb.setWarnings(result.warnings);

  try {
    const filename = `${project.id}-engine-pack.json`;
    // 10B: Apply AI RPG options to the bundle
    const contentPack = { ...result.contentPack };
    if (!opts.includeBuildCatalog) {
      delete (contentPack as Record<string, unknown>).buildCatalog;
    }
    if (!opts.includeDialogueProgression) {
      delete (contentPack as Record<string, unknown>).dialogues;
      delete (contentPack as Record<string, unknown>).progressionTrees;
    }
    const bundle: Record<string, unknown> = {
      contentPack,
      manifest: result.manifest,
      packMeta: result.packMeta,
    };
    if (result.assets) bundle.assets = result.assets;
    if (result.assetBindings) bundle.assetBindings = result.assetBindings;
    if (result.assetPacks) bundle.assetPacks = result.assetPacks;
    if (opts.includeFidelityReport) {
      bundle.fidelityReport = result.fidelity;
    }
    const url = env.downloadJson(filename, bundle);
    cb.setStatus('exported');
    cb.markExported();
    // ED-B-002: stash a manual-download URL so the modal can render a visible
    // "If nothing appears, click here" anchor. The browser popup-blocker can
    // swallow synthetic clicks silently.
    if (url && cb.setFallback) cb.setFallback({ href: url, filename });
    // 10A: emit structured receipt
    if (cb.addReceipt) {
      const s = result.fidelity.summary;
      const level = s.dropped > 0 ? 'dropped' : s.approximated > 0 ? 'approximated' : 'preserved';
      cb.addReceipt({
        target: 'ai-rpg',
        filename,
        timestamp: Date.now(),
        zones: project.zones.length,
        entities: project.entityPlacements.length,
        items: project.itemPlacements.length,
        dialogues: project.dialogues.length,
        trees: project.progressionTrees.length,
        assets: project.assets.length,
        warnings: result.warnings.length,
        fidelity: level,
        sizeEstimate: JSON.stringify(bundle).length,
      });
    }
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
export async function runUnrealExport(
  project: WorldProject,
  cb: ExportCallbacks,
  env: ExportEnv = { downloadJson: defaultDownloadJson },
  opts: UnrealExportOptions = DEFAULT_UNREAL_OPTIONS,
): Promise<void> {
  // ED-A-002: clear stale errors/warnings/status before a new attempt
  cb.setErrors([]);
  cb.setWarnings([]);
  cb.setStatus('idle');

  const { exportToUnreal } = await import('@world-forge/export-unreal');
  const result = exportToUnreal(project, {
    tileSizeCm: opts.tileSizeCm,
  });
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
    const bundle: Record<string, unknown> = {
      contentPack: result.contentPack,
      fidelity: result.fidelity,
      exportSettings: {
        tileSizeCm: opts.tileSizeCm,
        blueprintPathPrefix: opts.blueprintPathPrefix,
        streamingHints: opts.includeStreamingHints,
        signing: 'disabled (CLI-only)',
      },
    };
    const url = env.downloadJson(filename, bundle);
    cb.setStatus('exported');
    cb.markExported();
    // ED-B-002: manual-download fallback — see runEngineExport for rationale.
    if (url && cb.setFallback) cb.setFallback({ href: url, filename });
    // 10A: emit structured receipt with fidelity summary
    if (cb.addReceipt) {
      const s = result.fidelity.summary;
      const level = s.dropped > 0 ? 'dropped' : s.approximated > 0 ? 'approximated' : 'preserved';
      cb.addReceipt({
        target: 'unreal',
        filename,
        timestamp: Date.now(),
        zones: project.zones.length,
        entities: project.entityPlacements.length,
        items: project.itemPlacements.length,
        dialogues: project.dialogues.length,
        trees: project.progressionTrees.length,
        assets: project.assets.length,
        warnings: result.warnings.length,
        fidelity: level,
        sizeEstimate: JSON.stringify(bundle).length,
      });
    }
  } catch (err) {
    cb.setStatus('invalid');
    const msg = err instanceof Error ? err.message : String(err);
    cb.setErrors([`Failed to serialize Unreal export bundle: ${msg}`]);
  }
}

/**
 * Run the Godot 4 export flow.
 */
export async function runGodotExport(
  project: WorldProject,
  cb: ExportCallbacks,
  env: ExportEnv = { downloadJson: defaultDownloadJson },
  opts: GodotExportUIOptions = DEFAULT_GODOT_OPTIONS,
): Promise<void> {
  cb.setErrors([]);
  cb.setWarnings([]);
  cb.setStatus('idle');

  const { exportToGodot } = await import('@world-forge/export-godot');
  const result = exportToGodot(project);
  if (!result.success) {
    cb.setStatus('invalid');
    cb.setErrors(result.errors.map((e: { path: string; message: string }) => `[${e.path}] ${e.message}`));
    return;
  }

  cb.setWarnings(result.warnings);

  try {
    const filename = `${project.id}-godot-pack.json`;
    const bundle: Record<string, unknown> = {
      contentPack: result.contentPack,
      fidelity: result.fidelity,
      exportSettings: {
        entityScenePrefix: opts.entityScenePrefix,
        transitionScenePrefix: opts.transitionScenePrefix,
        includeWorldTscn: opts.includeWorldTscn,
        assetBindingMode: opts.assetBindingMode,
      },
    };
    const url = env.downloadJson(filename, bundle);
    cb.setStatus('exported');
    cb.markExported();
    if (url && cb.setFallback) cb.setFallback({ href: url, filename });
    // 10A: emit structured receipt with fidelity summary
    if (cb.addReceipt) {
      const s = result.fidelity.summary;
      const level = s.dropped > 0 ? 'dropped' : s.approximated > 0 ? 'approximated' : 'preserved';
      cb.addReceipt({
        target: 'godot',
        filename,
        timestamp: Date.now(),
        zones: project.zones.length,
        entities: project.entityPlacements.length,
        items: project.itemPlacements.length,
        dialogues: project.dialogues.length,
        trees: project.progressionTrees.length,
        assets: project.assets.length,
        warnings: result.warnings.length,
        fidelity: level,
        sizeEstimate: JSON.stringify(bundle).length,
      });
    }
  } catch (err) {
    cb.setStatus('invalid');
    const msg = err instanceof Error ? err.message : String(err);
    cb.setErrors([`Failed to serialize Godot export bundle: ${msg}`]);
  }
}
