// export-handlers.ts — pure logic for the Export / Export-Unreal flows.
//
// Extracted from `ExportModal.tsx` so the handler behaviour (clear-stale-state,
// success path, serialization-failure path) can be exercised by logic-level
// tests without mounting React. The modal consumes these via callbacks that
// wire into its local React state + `markExported` store action.

import type { WorldProject } from '@world-forge/schema';

export type ExportStatus = 'idle' | 'valid' | 'invalid' | 'exported' | 'exporting';

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
  downloadJson: (filename: string, data: unknown) => string | null | Promise<string | null>;
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
function clickDownloadBlob(filename: string, text: string): string | null {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  return url;
}

/** Stringify off the UI thread when Worker is available so Playwright can still see the download. */
export function stringifyOffMainThread(data: unknown): Promise<string> {
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return Promise.resolve(JSON.stringify(data));
  }
  return new Promise<string>((resolve, reject) => {
    const src = 'onmessage=function(e){try{postMessage(JSON.stringify(e.data))}catch(err){postMessage({__err:String(err)})}}';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const worker = new Worker(url);
    worker.onmessage = (e: MessageEvent) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      if (e.data && typeof e.data === 'object' && '__err' in e.data) {
        reject(new Error(String((e.data as { __err: string }).__err)));
        return;
      }
      resolve(e.data as string);
    };
    worker.onerror = (e) => {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(e.error ?? new Error('stringify worker failed'));
    };
    try {
      worker.postMessage(data);
    } catch (err) {
      worker.terminate();
      URL.revokeObjectURL(url);
      reject(err);
    }
  }).catch(() => JSON.stringify(data));
}

/** Sync download for kit/project bundles (small JSON). */
export function downloadJsonSync(filename: string, data: unknown): string | null {
  return clickDownloadBlob(filename, JSON.stringify(data));
}

export async function defaultDownloadJson(filename: string, data: unknown): Promise<string | null> {
  // Compact JSON + off-thread stringify: chapel Godot packs with a full
  // world.tscn used to freeze Chromium so the e2e download never fired.
  const text = await stringifyOffMainThread(data);
  return clickDownloadBlob(filename, text);
}

function failExport(cb: ExportCallbacks, message: string): void {
  cb.setStatus('invalid');
  cb.setErrors([message]);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function rewritePrefix(path: string, fromPrefix: string, toPrefix: string): string {
  if (!fromPrefix || path.startsWith(toPrefix)) return path;
  if (path.startsWith(fromPrefix)) return toPrefix + path.slice(fromPrefix.length);
  return path;
}

function normalizePrefix(prefix: string, fallback: string): string {
  const trimmed = prefix.trim() || fallback;
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/**
 * F-6fa18661: apply Godot Target Options to the content pack itself, not only
 * the sidecar exportSettings. includeWorldTscn:false drops worldSceneTscn;
 * scene prefixes rewrite entity/transition sceneTemplate paths.
 */
export function applyGodotUiOptions(
  contentPack: Record<string, unknown>,
  opts: GodotExportUIOptions,
): Record<string, unknown> {
  const pack: Record<string, unknown> = { ...contentPack };
  if (!opts.includeWorldTscn) {
    delete pack.worldSceneTscn;
  }
  const entityPrefix = normalizePrefix(opts.entityScenePrefix, DEFAULT_GODOT_OPTIONS.entityScenePrefix);
  const transitionPrefix = normalizePrefix(opts.transitionScenePrefix, DEFAULT_GODOT_OPTIONS.transitionScenePrefix);

  const entities = pack.entities as {
    all?: Array<Record<string, unknown>>;
    byZone?: Record<string, Array<Record<string, unknown>>>;
  } | undefined;
  if (entities) {
    const rewriteEntity = (e: Record<string, unknown>) => ({
      ...e,
      sceneTemplate: typeof e.sceneTemplate === 'string'
        ? rewritePrefix(e.sceneTemplate, 'res://entities/', entityPrefix)
        : e.sceneTemplate,
    });
    pack.entities = {
      ...entities,
      all: Array.isArray(entities.all) ? entities.all.map(rewriteEntity) : entities.all,
      byZone: entities.byZone
        ? Object.fromEntries(
          Object.entries(entities.byZone).map(([k, arr]) => [
            k,
            Array.isArray(arr) ? arr.map(rewriteEntity) : arr,
          ]),
        )
        : entities.byZone,
    };
  }

  if (Array.isArray(pack.transitions)) {
    pack.transitions = (pack.transitions as Array<Record<string, unknown>>).map((t) => ({
      ...t,
      sceneTemplate: typeof t.sceneTemplate === 'string'
        ? rewritePrefix(t.sceneTemplate, 'res://transitions/', transitionPrefix)
        : t.sceneTemplate,
    }));
  }

  pack.assetBindingMode = opts.assetBindingMode;
  return pack;
}

/**
 * F-6fa18661: apply Unreal Target Options to the pack. includeStreamingHints:false
 * drops Connections (the streaming-hint channel). blueprintPathPrefix is stamped
 * onto Meta and each actor so it is not sidecar-only.
 */
export function applyUnrealUiOptions(
  contentPack: Record<string, unknown>,
  opts: UnrealExportOptions,
): Record<string, unknown> {
  const pack: Record<string, unknown> = { ...contentPack };
  const meta = (pack.Meta && typeof pack.Meta === 'object')
    ? { ...(pack.Meta as Record<string, unknown>) }
    : {};
  meta.BlueprintPathPrefix = opts.blueprintPathPrefix;
  pack.Meta = meta;

  if (!opts.includeStreamingHints) {
    pack.Connections = [];
  }

  const actors = pack.Actors as {
    All?: Array<Record<string, unknown>>;
    ByZone?: Record<string, Array<Record<string, unknown>>>;
  } | undefined;
  if (actors) {
    const prefix = normalizePrefix(opts.blueprintPathPrefix, DEFAULT_UNREAL_OPTIONS.blueprintPathPrefix);
    const stamp = (a: Record<string, unknown>) => ({
      ...a,
      BlueprintPath: typeof a.BlueprintTag === 'string' ? `${prefix}${a.BlueprintTag}` : a.BlueprintPath,
    });
    pack.Actors = {
      ...actors,
      All: Array.isArray(actors.All) ? actors.All.map(stamp) : actors.All,
      ByZone: actors.ByZone
        ? Object.fromEntries(
          Object.entries(actors.ByZone).map(([k, arr]) => [
            k,
            Array.isArray(arr) ? arr.map(stamp) : arr,
          ]),
        )
        : actors.ByZone,
    };
  }
  return pack;
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
  // ED-A-001: clear stale errors/warnings/status before a new attempt.
  // F-3f598c61: 'idle' stays in the history so existing reset tests still
  // observe a wipe; 'exporting' is the in-flight status the modal renders.
  cb.setErrors([]);
  cb.setWarnings([]);
  cb.setStatus('idle');
  cb.setStatus('exporting');

  // F-38ec48e4: wrap the whole body (dynamic import + exporter + serialize)
  // so a chunk-load failure becomes setStatus('invalid') instead of an
  // unhandled rejection. This function never rejects.
  try {
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
      const url = await env.downloadJson(filename, bundle);
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
      failExport(cb, `Failed to serialize export bundle: ${errorMessage(err)}`);
    }
  } catch (err) {
    failExport(cb, `Failed to export: ${errorMessage(err)}`);
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
  cb.setStatus('exporting');

  try {
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
      const contentPack = applyUnrealUiOptions(
        result.contentPack as unknown as Record<string, unknown>,
        opts,
      );
      const bundle: Record<string, unknown> = {
        contentPack,
        fidelity: result.fidelity,
        exportSettings: {
          tileSizeCm: opts.tileSizeCm,
          blueprintPathPrefix: opts.blueprintPathPrefix,
          streamingHints: opts.includeStreamingHints,
          signing: 'disabled (CLI-only)',
        },
      };
      const url = await env.downloadJson(filename, bundle);
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
      failExport(cb, `Failed to serialize Unreal export bundle: ${errorMessage(err)}`);
    }
  } catch (err) {
    failExport(cb, `Failed to export: ${errorMessage(err)}`);
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
  cb.setStatus('exporting');

  try {
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
      const contentPack = applyGodotUiOptions(
        result.contentPack as unknown as Record<string, unknown>,
        opts,
      );
      const bundle: Record<string, unknown> = {
        contentPack,
        fidelity: result.fidelity,
        exportSettings: {
          entityScenePrefix: opts.entityScenePrefix,
          transitionScenePrefix: opts.transitionScenePrefix,
          includeWorldTscn: opts.includeWorldTscn,
          assetBindingMode: opts.assetBindingMode,
        },
      };
      const url = await env.downloadJson(filename, bundle);
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
      failExport(cb, `Failed to serialize Godot export bundle: ${errorMessage(err)}`);
    }
  } catch (err) {
    failExport(cb, `Failed to export: ${errorMessage(err)}`);
  }
}
