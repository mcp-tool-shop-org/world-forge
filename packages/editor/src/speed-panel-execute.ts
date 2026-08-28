// speed-panel-execute.ts — extracted action execution logic for the Speed Panel

import type { HitResult } from './hit-testing.js';
import type { SpeedPanelMacro, MacroExecutionResult } from './speed-panel-actions.js';
import type { WorldProject, ZoneConnection, Zone, ConnectionKind } from '@world-forge/schema';
import { buildReviewSnapshot } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import type { RightTab, EditorTool, SelectionSet, SelectionKind } from './store/editor-store.js';
import { emptySelection, SELECTION_KIND_KEY } from './store/editor-store.js';
import type { EnrichedReviewSnapshot } from './panels/ReviewPanel.js';
import { reviewSnapshotToMarkdown, summaryFilename } from './review/export-summary.js';
import { frameBounds } from './viewport.js';
import { useEditorStore } from './store/editor-store.js';
import { useProjectStore } from './store/project-store.js';
import { pushToast } from './ui/Toast.js';
import { defaultDownloadViaAnchor } from './save-project.js';

/** Bag of store methods needed by execute — keeps the function testable */
export interface ExecuteStores {
  // Selection
  selectZone: (id: string, additive: boolean) => void;
  selectEntity: (id: string, additive: boolean) => void;
  selectLandmark: (id: string, additive: boolean) => void;
  selectSpawn: (id: string, additive: boolean) => void;
  selectEncounter: (id: string, additive: boolean) => void;
  selectConnection: (fromId: string, toId: string) => void;
  /** F-df71e70a / F-5515c044: optional so older test bags still type-check. */
  selectKind?: (type: SelectionKind, id: string, additive: boolean) => void;
  clearSelection: () => void;

  // UI
  setRightTab: (tab: RightTab) => void;
  setTool: (tool: EditorTool) => void;
  setConnectionStart: (zoneId: string) => void;
  /** F-04f58b32: optional so older test bags still type-check. */
  setPendingConnectionKind?: (kind: ConnectionKind | null) => void;
  setViewport: (vp: ViewportState) => void;

  // Project mutations
  removeSelected: (sel: SelectionSet) => void;
  duplicateSelected: (sel: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }) => unknown;
  removeConnection: (fromId: string, toId: string) => void;
  addConnection: (conn: ZoneConnection) => void;
  /** F-c8fa9fb6: atomic reverse. Optional so older test bags still type-check. */
  swapConnection?: (fromId: string, toId: string) => void;
  /** ED-FT-005: update a single zone (used by the set-elevation speed action). */
  updateZone?: (zoneId: string, updates: Partial<Zone>) => void;
  /** ED-FT-005: optional prompt shim so tests can inject a deterministic value. */
  promptFn?: (message: string) => string | null;
  /**
   * F-bdf856bf: merge 2+ zones into one (mirrors project-store's mergeZones,
   * FT-008). Optional because the current SpeedPanel.tsx caller does not
   * thread it through yet — the merge-zones case below fails closed
   * ({ executed: false }) rather than throwing or silently succeeding when
   * it's absent. Wiring SpeedPanel.tsx to pass
   * `useProjectStore.getState().mergeZones` here is a follow-up outside this
   * wave's editor-core domain (SpeedPanel.tsx lives under panels/**).
   */
  mergeZones?: (zoneIds: string[]) => string | null;
  /**
   * F-bdf856bf: the app's current multi-select, needed by merge-zones to
   * know WHICH zones to merge — a single right-click context is only ever
   * one zone. Optional so unit tests can omit it (fails closed). Production
   * bags from `buildExecuteStores()` always include both this and mergeZones.
   */
  selection?: SelectionSet;
  /**
   * F-bdf856bf: file-download side effect for export-summary, overridable so
   * tests can assert on it without a real DOM/Blob/URL. Defaults to a real
   * browser download when the caller (SpeedPanel.tsx) doesn't override it —
   * unlike mergeZones/selection above, export-summary needs nothing else
   * from the caller and works end-to-end today.
   */
  downloadFile?: (filename: string, content: string, mimeType: string) => void;
  /**
   * F-69d97784: live canvas size for fit-content. Falls back to 800×600 when
   * omitted (unit tests / callers that don't thread a canvas ref).
   */
  canvasSize?: { w: number; h: number };

  // Project data (read-only)
  project: WorldProject;
}

/**
 * F-8912e227: reuse save-project's held-URL downloader. Never revoke in the
 * same tick as click (Safari cancels). Toast if the click is blocked.
 */
function browserDownload(filename: string, content: string, mimeType: string): void {
  void defaultDownloadViaAnchor(content, filename, 1000, mimeType).then((ok) => {
    if (!ok) {
      pushToast('Download was blocked or aborted. Click Export in the top bar to try again.', 'error');
    }
  });
}

/**
 * F-dd0278b5: map ExecuteResult.reason tokens to a fix-it sentence.
 * Returns null for 'cancelled' so the caller skips the toast.
 * The token itself stays on ExecuteResult.reason for macros/tests.
 */
export function failReasonToUserMessage(actionId: string, reason: string): string | null {
  if (reason === 'cancelled') return null;
  if (reason === 'need at least 2 zones' || (actionId === 'merge-zones' && reason.startsWith('need'))) {
    return 'Select at least two zones, then Merge Zones again.';
  }
  switch (reason) {
    case 'context mismatch':
      return 'That action does not apply to the current selection.';
    case 'unknown action':
      return 'That action is not available.';
    case 'mergeZones not available':
      return 'Merge Zones is not available right now.';
    case 'invalid elevation':
      return 'Enter a number for elevation, or leave blank to clear.';
    case 'merge failed':
      return 'Could not merge those zones.';
    case 'updateZone not available':
      return 'Could not update the zone.';
    default:
      return `Could not run that action. ${reason}`;
  }
}

function parseConnectionId(id: string): [string, string] | null {
  const parts = id.split('::');
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

function selectFromContext(ctx: HitResult, stores: ExecuteStores): boolean {
  if (ctx.type === 'connection') {
    const parsed = parseConnectionId(ctx.id);
    if (!parsed) return false;
    stores.selectConnection(parsed[0], parsed[1]);
  } else if (ctx.type === 'zone') stores.selectZone(ctx.id, false);
  else if (ctx.type === 'entity') stores.selectEntity(ctx.id, false);
  else if (ctx.type === 'landmark') stores.selectLandmark(ctx.id, false);
  else if (ctx.type === 'spawn') stores.selectSpawn(ctx.id, false);
  else if (ctx.type === 'encounter') stores.selectEncounter(ctx.id, false);
  else if (stores.selectKind) stores.selectKind(ctx.type as SelectionKind, ctx.id, false);
  else return false;
  return true;
}

/**
 * F-ef5cce21: production ExecuteStores bag used by the canvas context menu
 * (and the same shape SpeedPanel should build). Reads live store state at
 * call time so mergeZones + selection are never a stale render snapshot.
 */
export function buildExecuteStores(canvasSize?: { w: number; h: number }): ExecuteStores {
  const editor = useEditorStore.getState();
  const proj = useProjectStore.getState();
  return {
    selectZone: editor.selectZone,
    selectEntity: editor.selectEntity,
    selectLandmark: editor.selectLandmark,
    selectSpawn: editor.selectSpawn,
    selectEncounter: editor.selectEncounter,
    selectKind: editor.selectKind,
    selectConnection: editor.selectConnection,
    clearSelection: editor.clearSelection,
    setRightTab: editor.setRightTab,
    setTool: editor.setTool,
    setConnectionStart: (id) => editor.setConnectionStart(id),
    setPendingConnectionKind: editor.setPendingConnectionKind,
    setViewport: (vp) => editor.setViewport(vp),
    removeSelected: proj.removeSelected,
    duplicateSelected: proj.duplicateSelected,
    removeConnection: proj.removeConnection,
    addConnection: proj.addConnection,
    swapConnection: proj.swapConnection,
    updateZone: proj.updateZone,
    mergeZones: proj.mergeZones,
    selection: editor.selection,
    canvasSize,
    project: proj.project,
  };
}

export interface ExecuteResult {
  executed: boolean;
  /** F-e57095f8: actual fail class ('unknown action', 'cancelled', …), not always 'context mismatch'. */
  reason?: string;
}

function fail(reason: string): ExecuteResult {
  return { executed: false, reason };
}

/**
 * Execute a single speed-panel action.
 * Returns { executed: true } if the action ran, { executed: false, reason } otherwise.
 */
export function executeAction(
  actionId: string,
  context: HitResult | null,
  stores: ExecuteStores,
): ExecuteResult {
  switch (actionId) {
    case 'edit-props':
      if (!context) return fail('context mismatch');
      if (!selectFromContext(context, stores)) return fail('context mismatch');
      stores.setRightTab('map');
      return { executed: true };

    case 'delete':
      if (!context) return fail('context mismatch');
      if (context.type === 'connection') {
        const parsed = parseConnectionId(context.id);
        if (!parsed) return fail('context mismatch');
        stores.removeConnection(parsed[0], parsed[1]);
      } else {
        selectFromContext(context, stores);
        const sel = emptySelection();
        const key = SELECTION_KIND_KEY[context.type as SelectionKind];
        if (!key) return fail('context mismatch');
        sel[key] = [context.id];
        stores.removeSelected(sel);
      }
      stores.clearSelection();
      return { executed: true };

    case 'duplicate':
      if (!context || (context.type !== 'zone' && context.type !== 'entity' && context.type !== 'landmark')) {
        return fail('context mismatch');
      }
      if (!selectFromContext(context, stores)) return fail('context mismatch');
      {
        const sel = emptySelection();
        const key = context.type === 'zone' ? 'zones' : context.type === 'entity' ? 'entities' : 'landmarks';
        sel[key] = [context.id];
        stores.duplicateSelected(sel);
      }
      return { executed: true };

    case 'new-zone':
      stores.setTool('zone-paint');
      return { executed: true };

    case 'fit-content': {
      const tileSize = stores.project.map.tileSize;
      const items = stores.project.zones.map((z) => ({
        gridX: z.gridX, gridY: z.gridY, gridWidth: z.gridWidth, gridHeight: z.gridHeight,
      }));
      const cw = stores.canvasSize?.w ?? 800;
      const ch = stores.canvasSize?.h ?? 600;
      const vp = frameBounds(items, tileSize, cw, ch);
      if (vp) stores.setViewport(vp);
      return { executed: true };
    }

    case 'assign-district':
      if (context?.type !== 'zone') return fail('context mismatch');
      stores.selectZone(context.id, false);
      stores.setRightTab('map');
      return { executed: true };

    case 'place-entity':
      if (context?.type !== 'zone') return fail('context mismatch');
      stores.setTool('entity-place');
      return { executed: true };

    case 'place-encounter':
      if (context?.type !== 'zone') return fail('context mismatch');
      stores.setTool('encounter-place');
      return { executed: true };

    case 'connect-from':
      if (context?.type !== 'zone') return fail('context mismatch');
      stores.setTool('connection');
      stores.setConnectionStart(context.id);
      return { executed: true };

    case 'add-secret-conn':
    case 'add-channel-conn':
    case 'add-warp-conn':
    case 'add-trail-conn': {
      if (context?.type !== 'zone') return fail('context mismatch');
      const kind: ConnectionKind =
        actionId === 'add-secret-conn' ? 'secret'
          : actionId === 'add-channel-conn' ? 'channel'
            : actionId === 'add-warp-conn' ? 'warp'
              : 'trail';
      stores.setPendingConnectionKind?.(kind);
      stores.setTool('connection');
      stores.setConnectionStart(context.id);
      return { executed: true };
    }

    case 'swap-direction':
      if (context?.type !== 'connection') return fail('context mismatch');
      {
        const parsed = parseConnectionId(context.id);
        if (!parsed) return fail('context mismatch');
        const [from, to] = parsed;
        if (stores.swapConnection) {
          stores.swapConnection(from, to);
        } else {
          const conn = stores.project.connections.find(
            (c) => c.fromZoneId === from && c.toZoneId === to,
          );
          if (conn) {
            stores.removeConnection(from, to);
            stores.addConnection({ ...conn, fromZoneId: to, toZoneId: from });
          }
        }
      }
      return { executed: true };

    case 'set-elevation': {
      if (context?.type !== 'zone') return fail('context mismatch');
      if (!stores.updateZone) return fail('updateZone not available');
      const ask = stores.promptFn ?? ((msg) => (typeof globalThis.prompt === 'function' ? globalThis.prompt(msg) : null));
      const raw = ask(`Set elevation (meters) for zone ${context.id}. Leave blank to clear.`);
      if (raw == null) return fail('cancelled');
      const trimmed = raw.trim();
      let elevation: number | undefined;
      if (trimmed === '') {
        elevation = undefined;
      } else {
        const n = Number(trimmed);
        if (!Number.isFinite(n)) return fail('invalid elevation');
        elevation = n;
      }
      stores.updateZone(context.id, { elevation });
      return { executed: true };
    }

    case 'merge-zones': {
      // F-bdf856bf: registered (FT-008) with a real backing implementation
      // (project-store's mergeZones) but no case here — every click
      // silently fell through to `default`. mergeZones/selection are
      // optional on ExecuteStores until SpeedPanel.tsx threads them through
      // (see the interface doc comment above); until then this fails closed
      // instead of pretending to succeed.
      if (!stores.mergeZones) return fail('mergeZones not available');
      const zoneIds = stores.selection?.zones ?? (context?.type === 'zone' ? [context.id] : []);
      if (zoneIds.length < 2) return fail('need at least 2 zones');
      const mergedId = stores.mergeZones(zoneIds);
      if (!mergedId) return fail('merge failed');
      return { executed: true };
    }

    case 'open-review':
      // F-bdf856bf: registered as a global action with no case — clicking it
      // silently did nothing. setRightTab is already required on
      // ExecuteStores (every caller provides it), so this is a full fix with
      // no caveats.
      stores.setRightTab('review');
      return { executed: true };

    case 'export-summary': {
      // F-bdf856bf: registered with a real backing implementation
      // (review/export-summary's reviewSnapshotToMarkdown) but no case here.
      // Builds the same Markdown a full Review-panel export produces, from
      // stores.project alone — no editor-session provenance (kit name,
      // import format) is available to a quick-action, so those optional
      // fields are simply omitted from the snapshot rather than faked.
      const snapshot: EnrichedReviewSnapshot = { ...buildReviewSnapshot(stores.project), hasExported: false };
      const markdown = reviewSnapshotToMarkdown(snapshot);
      const filename = summaryFilename(stores.project.name, 'md');
      const download = stores.downloadFile ?? browserDownload;
      download(filename, markdown, 'text/markdown');
      return { executed: true };
    }

    default:
      return fail('unknown action');
  }
}

/**
 * F-96d567c8: production canvas context-menu click. Toasts + console.warns
 * when executeAction returns executed:false so a no-op is observable.
 */
export function executeContextMenuAction(
  actionId: string,
  hit: HitResult | null,
  canvasSize?: { w: number; h: number },
): ExecuteResult {
  const result = executeAction(actionId, hit, buildExecuteStores(canvasSize));
  if (!result.executed) {
    const reason = result.reason ?? `Action "${actionId}" did not run`;
    console.warn(`[context-menu] action "${actionId}" did not execute (${reason}) for hit type ${hit?.type ?? 'none'}`);
    const message = failReasonToUserMessage(actionId, reason);
    if (message) pushToast(message, 'warning', 4000);
  }
  return result;
}

/**
 * Execute a macro — runs steps sequentially, each step = separate undo entry.
 * Aborts on first step that fails (context mismatch).
 * Returns step-by-step results for feedback UI.
 */
export function executeMacro(
  macro: SpeedPanelMacro,
  context: HitResult | null,
  stores: ExecuteStores,
): MacroExecutionResult {
  const total = macro.steps.length;
  const steps: MacroExecutionResult['steps'] = [];

  for (let i = 0; i < total; i++) {
    const result = executeAction(macro.steps[i].actionId, context, stores);
    steps.push({ action: macro.steps[i].actionId, success: result.executed });
    if (!result.executed) {
      return {
        completed: i, total,
        abortedAt: i,
        reason: `Step ${i + 1} (${macro.steps[i].actionId}) failed — ${result.reason ?? 'context mismatch'}`,
        steps,
        totalSteps: total,
        completedSteps: i,
      };
    }
  }
  return { completed: total, total, steps, totalSteps: total, completedSteps: total };
}
