// save-project.ts — File → Save with a confirmed write before markClean.
// F-95295187: the previous <a download> click + immediate revokeObjectURL +
// markClean/clearAutoSave could wipe the crash-recovery slot even when the
// browser blocked or aborted the download.

import type { WorldProject } from '@world-forge/schema';

export type SaveToastFn = (message: string, kind: 'success' | 'error' | 'warning' | 'info', durationMs?: number) => void;

interface FileWritable {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileHandleLike {
  name?: string;
  createWritable: () => Promise<FileWritable>;
}

export interface SaveProjectDeps {
  markClean: () => void;
  toast: SaveToastFn;
  /** Injected in tests; production reads `globalThis.showSaveFilePicker`. */
  showSaveFilePicker?: (opts: unknown) => Promise<FileHandleLike>;
  /** Injected in tests; production uses defaultDownloadViaAnchor. */
  downloadViaAnchor?: (json: string, filename: string) => Promise<boolean>;
  /**
   * F-8680d2f9: previously-chosen File System Access handle. When set and
   * `saveAs` is false, Skip the picker and overwrite that file.
   */
  existingHandle?: FileHandleLike | null;
  /** Force a new picker even if a handle is cached (Save As). */
  saveAs?: boolean;
  /** Called after a successful picker write so the next Save can reuse it. */
  onHandle?: (handle: FileHandleLike) => void;
}

/** F-8680d2f9: last picker handle. Module-level so App/hotkeys share it. */
let lastSaveHandle: FileHandleLike | null = null;

export function getSavedFileHandle(): FileHandleLike | null {
  return lastSaveHandle;
}

export function setSavedFileHandle(handle: FileHandleLike | null): void {
  lastSaveHandle = handle;
}

export function clearSavedFileHandle(): void {
  lastSaveHandle = null;
}

/**
 * Keep the blob URL alive past the click (Safari otherwise cancels) and
 * append the anchor so the download is a real navigation, not a detached
 * element. Resolves true once the click has been dispatched (or on `load`);
 * false if the environment can't download or the click errors.
 */
export function defaultDownloadViaAnchor(json: string, filename: string, holdMs = 1000, mimeType = 'application/json'): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        resolve(false);
        return;
      }
      const blob = new Blob([json], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        try { a.remove(); } catch { /* ignore */ }
        setTimeout(() => {
          try { URL.revokeObjectURL(url); } catch { /* ignore */ }
        }, holdMs);
        resolve(ok);
      };
      a.addEventListener('load', () => finish(true), { once: true });
      a.addEventListener('error', () => finish(false), { once: true });
      a.click();
      setTimeout(() => finish(true), holdMs);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Write `project` to disk. Only calls `markClean` (which also clears the
 * autosave slot) after the write is known to have succeeded. On failure or
 * user-cancel, leaves dirty=true and the autosave intact.
 */
export async function saveProjectFile(project: WorldProject, deps: SaveProjectDeps): Promise<boolean> {
  const filename = `${project.id}.json`;
  let json: string;
  try {
    json = JSON.stringify(project, null, 2);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    deps.toast(`Could not serialize project (${msg}). Auto-save was kept.`, 'error', 4000);
    return false;
  }

  const picker = deps.showSaveFilePicker
    ?? (globalThis as unknown as { showSaveFilePicker?: SaveProjectDeps['showSaveFilePicker'] }).showSaveFilePicker;

  const cached = deps.existingHandle !== undefined ? deps.existingHandle : lastSaveHandle;

  const writeHandle = async (handle: FileHandleLike): Promise<boolean> => {
    const writable = await handle.createWritable();
    await writable.write(json);
    await writable.close();
    lastSaveHandle = handle;
    deps.onHandle?.(handle);
    deps.markClean();
    deps.toast(`Saved as ${handle.name ?? filename}`, 'success', 2000);
    return true;
  };

  if (!deps.saveAs && cached && typeof cached.createWritable === 'function') {
    try {
      return await writeHandle(cached);
    } catch (err) {
      // Stale handle (file moved / permission dropped) — fall through to picker.
      lastSaveHandle = null;
      const msg = err instanceof Error ? err.message : String(err);
      deps.toast(`Saved file is no longer writable (${msg}). Pick a location.`, 'warning', 3000);
    }
  }

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        types: [{ description: 'World Forge project', accept: { 'application/json': ['.json'] } }],
      });
      return await writeHandle(handle);
    } catch (err) {
      const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
      // User dismissed the picker — not a write failure.
      if (name === 'AbortError') return false;
      const msg = err instanceof Error ? err.message : String(err);
      deps.toast(`Save failed: ${msg}. Auto-save was kept.`, 'error', 4000);
      return false;
    }
  }

  const download = deps.downloadViaAnchor ?? defaultDownloadViaAnchor;
  const ok = await download(json, filename);
  if (!ok) {
    deps.toast('Save failed — the download was blocked or aborted. Auto-save was kept.', 'error', 4000);
    return false;
  }
  deps.markClean();
  deps.toast(`Saved as ${filename}`, 'success', 2000);
  return true;
}
