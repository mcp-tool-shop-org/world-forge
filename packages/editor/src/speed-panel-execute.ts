// speed-panel-execute.ts — extracted action execution logic for the Speed Panel

import type { HitResult } from './hit-testing.js';
import type { SpeedPanelMacro, MacroExecutionResult } from './speed-panel-actions.js';
import {
  getCommandById,
  type ExecuteResult,
  type ExecuteStores,
  type HotkeyContext,
} from './command-registry.js';
import { useEditorStore } from './store/editor-store.js';
import { useProjectStore } from './store/project-store.js';
import { pushToast } from './ui/Toast.js';
import { defaultDownloadViaAnchor } from './save-project.js';

export type { ExecuteStores, ExecuteResult };

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
    setRightCollapsed: editor.setRightCollapsed,
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

/**
 * Execute a single speed-panel action through the central command registry.
 * Returns { executed: true } if the action ran, { executed: false, reason } otherwise.
 */
export function executeAction(
  actionId: string,
  context: HitResult | null,
  stores: ExecuteStores,
): ExecuteResult {
  const cmd = getCommandById(actionId);
  if (!cmd || !cmd.surfaces.includes('speed-panel')) {
    return { executed: false, reason: 'unknown action' };
  }
  const effectiveStores = stores.downloadFile ? stores : { ...stores, downloadFile: browserDownload };
  const result = cmd.run({
    hit: context,
    stores: effectiveStores,
    selection: stores.selection,
    project: stores.project,
  });
  return result.reason !== undefined
    ? { executed: result.executed, reason: result.reason }
    : { executed: result.executed };
}

/**
 * Execute any command in `COMMAND_REGISTRY` from the Speed Panel, enforcing `when`
 * and `disabledReason` preconditions before dispatching `cmd.run`.
 */
export function executeRegistryCommand(
  commandId: string,
  context: HitResult | null,
  stores: ExecuteStores,
  hotkeyCtx?: HotkeyContext,
): ExecuteResult {
  const cmd = getCommandById(commandId);
  if (!cmd) {
    return { executed: false, reason: 'unknown action' };
  }
  const effectiveStores = stores.downloadFile ? stores : { ...stores, downloadFile: browserDownload };
  const cmdCtx = {
    hit: context,
    stores: effectiveStores,
    selection: stores.selection,
    selectedConnection: hotkeyCtx?.selectedConnection ?? null,
    project: stores.project,
    ...(hotkeyCtx ? { hotkeyCtx } : {}),
  };
  const allowed = cmd.when(cmdCtx);
  const preReason = cmd.disabledReason(cmdCtx);
  if (!allowed || preReason !== null) {
    return { executed: false, reason: preReason ?? 'Not available in this context' };
  }
  const result = cmd.run(cmdCtx);
  return result.reason !== undefined
    ? { executed: result.executed, reason: result.reason }
    : { executed: result.executed };
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
