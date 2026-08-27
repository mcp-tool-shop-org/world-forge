// speed-panel-stores.ts — production ExecuteStores bag + close-on-success policy
// extracted from SpeedPanel so tests can assert the live bag (no jsdom).
//
// F-2a8f09c5: SpeedPanel previously built an ExecuteStores bag without
// mergeZones or selection, so the registered merge-zones action always
// returned { executed: false }. It also called closeSpeedPanel() *before*
// checking executed, so the panel vanished with no toast on a failed click.

import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import type { ExecuteStores } from '../speed-panel-execute.js';

/** Live store bag SpeedPanel threads into executeAction / executeMacro. */
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
    clearSelection: editor.clearSelection,
    setRightTab: editor.setRightTab,
    setTool: editor.setTool,
    setConnectionStart: editor.setConnectionStart,
    setViewport: editor.setViewport,
    selection: editor.selection,
    removeSelected: project.removeSelected,
    duplicateSelected: project.duplicateSelected,
    removeConnection: project.removeConnection,
    addConnection: project.addConnection,
    project: project.project,
    updateZone: project.updateZone,
    mergeZones: project.mergeZones,
  };
}

export type SpeedPanelExecuteOutcome = 'closed' | 'kept-open';

/**
 * Close the panel only after a successful execute. Failed actions keep the
 * panel open and optionally toast so the click is not a silent dismiss.
 */
export function handleSpeedPanelExecuteResult(
  result: { executed: boolean },
  actionId: string,
  deps: {
    closeSpeedPanel: () => void;
    addRecent: (id: string) => void;
    toast?: (message: string, kind?: 'warning' | 'error' | 'info' | 'success') => void;
  },
): SpeedPanelExecuteOutcome {
  if (result.executed) {
    deps.addRecent(actionId);
    deps.closeSpeedPanel();
    return 'closed';
  }
  deps.toast?.('Action could not be executed', 'warning');
  return 'kept-open';
}
