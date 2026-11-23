// speed-panel-stores.ts — production ExecuteStores bag + close-on-success policy
// extracted from SpeedPanel so tests can assert the live bag (no jsdom).
//
// F-2a8f09c5: SpeedPanel previously built an ExecuteStores bag without
// mergeZones or selection, so the registered merge-zones action always
// returned { executed: false }. It also called closeSpeedPanel() *before*
// checking executed, so the panel vanished with no toast on a failed click.

import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { useModalStore } from '../store/modal-store.js';
import { usePresetStore } from '../presets/preset-store.js';
import { applyPresetFromSelection, savePresetFromSelection } from '../preset-actions.js';
import { saveProjectFile } from '../save-project.js';
import { pushToast } from '../ui/Toast.js';
import type { ExecuteStores } from '../speed-panel-execute.js';
import type { HotkeyContext } from '../command-registry.js';
import type { StepExecutionStores } from '../speed-panel-steps.js';

/** Live store bag SpeedPanel threads into executeAction / executeRegistryCommand / executeMacro. */
export function productionExecuteStores(): ExecuteStores {
  const editor = useEditorStore.getState();
  const project = useProjectStore.getState();
  return {
    selectZone: editor.selectZone,
    selectEntity: editor.selectEntity,
    selectLandmark: editor.selectLandmark,
    selectSpawn: editor.selectSpawn,
    selectEncounter: editor.selectEncounter,
    selectConnection: editor.selectConnection,
    selectKind: editor.selectKind,
    clearSelection: editor.clearSelection,
    setRightTab: editor.setRightTab,
    setRightCollapsed: editor.setRightCollapsed,
    setTool: editor.setTool,
    setConnectionStart: editor.setConnectionStart,
    setPendingConnectionKind: editor.setPendingConnectionKind,
    setViewport: editor.setViewport,
    selection: editor.selection,
    removeSelected: project.removeSelected,
    duplicateSelected: project.duplicateSelected,
    removeConnection: project.removeConnection,
    addConnection: project.addConnection,
    swapConnection: project.swapConnection,
    project: project.project,
    updateZone: project.updateZone,
    mergeZones: project.mergeZones,
  };
}

/** Live step-flow store bag used by C4 multi-step, scalar input, spatial pick, and replay flows. */
export function productionStepStores(): StepExecutionStores {
  const editor = useEditorStore.getState();
  const projectStore = useProjectStore.getState();
  const presetStore = usePresetStore.getState();
  return {
    project: projectStore.project,
    selection: editor.selection,
    selectedConnection: editor.selectedConnection,
    activeTool: editor.activeTool,
    regionPresets: presetStore.regionPresets,
    encounterPresets: presetStore.encounterPresets,
    updateProject: projectStore.updateProject,
    updateZone: projectStore.updateZone,
    addConnection: projectStore.addConnection,
    mergeZones: projectStore.mergeZones,
    applyRegionPreset: projectStore.applyRegionPreset,
    createEncounterFromPreset: projectStore.createEncounterFromPreset,
    selectZone: editor.selectZone,
    selectEncounter: editor.selectEncounter,
    selectAll: editor.selectAll,
    selectConnection: editor.selectConnection,
    clearSelection: editor.clearSelection,
    setTool: editor.setTool,
    setConnectionStart: editor.setConnectionStart,
    setPendingConnectionKind: editor.setPendingConnectionKind,
    setSpeedPanelPick: editor.setSpeedPanelPick,
    clearSpeedPanelPick: editor.clearSpeedPanelPick,
    setLastPanelAction: editor.setLastPanelAction,
  };
}

/** Live hotkey context so registry-wide commands invoked from SpeedPanel run cleanly. */
export function productionHotkeyContext(onSave?: () => void): HotkeyContext {
  const editor = useEditorStore.getState();
  const projectStore = useProjectStore.getState();
  return {
    selection: editor.selection,
    selectedConnection: editor.selectedConnection,
    project: projectStore.project,
    showEntities: editor.showEntities,
    showLandmarks: editor.showLandmarks,
    showSpawns: editor.showSpawns,
    showTown: editor.showTown,
    activeModal: useModalStore.getState().activeModal,
    showSearch: editor.showSearch,
    clearSelection: editor.clearSelection,
    selectAll: editor.selectAll,
    moveSelected: projectStore.moveSelected,
    removeSelected: projectStore.removeSelected,
    removeConnection: projectStore.removeConnection,
    duplicateSelected: projectStore.duplicateSelected,
    copySelection: editor.copySelection,
    pasteClipboard: () => {
      const newSel = useProjectStore.getState().pasteClipboard();
      if (newSel) useEditorStore.getState().selectAll(newSel, false);
    },
    undo: () => useProjectStore.getState().undo(),
    redo: () => useProjectStore.getState().redo(),
    setShowSearch: editor.setShowSearch,
    setRightTab: editor.setRightTab,
    setRightCollapsed: editor.setRightCollapsed,
    setTool: editor.setTool,
    showSpeedPanel: editor.showSpeedPanel,
    closeSpeedPanel: editor.closeSpeedPanel,
    setConnectionStart: editor.setConnectionStart,
    save: onSave ?? (() => {
      const p = useProjectStore.getState();
      void saveProjectFile(p.project, { markClean: p.markClean, toast: pushToast });
    }),
    applyPreset: () => {
      const ed = useEditorStore.getState();
      const ps = useProjectStore.getState();
      const res = applyPresetFromSelection(ps.project, ed.selection, {
        regionPresets: usePresetStore.getState().regionPresets,
        encounterPresets: usePresetStore.getState().encounterPresets,
        applyRegionPreset: ps.applyRegionPreset,
        createEncounterFromPreset: ps.createEncounterFromPreset,
        selectEncounter: ed.selectEncounter,
      });
      pushToast(res.message, res.ok ? 'success' : 'warning', 3000);
    },
    savePreset: () => {
      const ed = useEditorStore.getState();
      const ps = useProjectStore.getState();
      const res = savePresetFromSelection(ps.project, ed.selection, {
        saveRegionPreset: usePresetStore.getState().saveRegionPreset,
        saveEncounterPreset: usePresetStore.getState().saveEncounterPreset,
      });
      pushToast(res.message, res.ok ? 'success' : 'warning', 3000);
    },
  };
}

export type SpeedPanelExecuteOutcome = 'closed' | 'kept-open';

/**
 * Close the panel only after a successful execute. Failed actions keep the
 * panel open and optionally toast so the click is not a silent dismiss.
 */
export function formatSpeedPanelFailure(label: string, reason?: string): string {
  return `${label}: ${reason || 'could not be executed'}`;
}

export function handleSpeedPanelExecuteResult(
  result: { executed: boolean; reason?: string },
  actionId: string,
  deps: {
    closeSpeedPanel: () => void;
    addRecent: (id: string) => void;
    toast?: (message: string, kind?: 'warning' | 'error' | 'info' | 'success') => void;
    actionLabel?: string;
  },
): SpeedPanelExecuteOutcome {
  if (result.executed) {
    deps.addRecent(actionId);
    deps.closeSpeedPanel();
    return 'closed';
  }
  deps.toast?.(formatSpeedPanelFailure(deps.actionLabel ?? actionId, result.reason), 'warning');
  return 'kept-open';
}
