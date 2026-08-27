// speed-panel-stores.test.ts — F-2a8f09c5 / class-fix F-024cb3eb
//
// SpeedPanel.tsx is a React component and this package has no jsdom, so the
// production bag is extracted to productionExecuteStores() which SpeedPanel
// actually calls. These tests assert the live bag includes mergeZones +
// selection (the gap execute-side tests never covered).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEditorStore } from '../../store/editor-store.js';
import { useProjectStore, createEmptyProject } from '../../store/project-store.js';
import { productionExecuteStores, handleSpeedPanelExecuteResult } from '../speed-panel-stores.js';

describe('productionExecuteStores (F-2a8f09c5)', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: createEmptyProject(),
      dirty: false,
      undoStack: [],
      redoStack: [],
    });
    useEditorStore.setState({
      selection: { zones: ['z1', 'z2'], entities: [], landmarks: [], spawns: [], encounters: [] },
    });
  });

  it('includes mergeZones and selection from the live stores', () => {
    const bag = productionExecuteStores();
    expect(bag).toHaveProperty('mergeZones');
    expect(bag).toHaveProperty('selection');
    expect(typeof bag.mergeZones).toBe('function');
    expect(bag.mergeZones).toBe(useProjectStore.getState().mergeZones);
    expect(bag.selection).toEqual(useEditorStore.getState().selection);
    expect(bag.selection?.zones).toEqual(['z1', 'z2']);
  });
});

describe('handleSpeedPanelExecuteResult (F-2a8f09c5)', () => {
  it('closes the panel and records recents only when executed is true', () => {
    const closeSpeedPanel = vi.fn();
    const addRecent = vi.fn();
    const toast = vi.fn();
    const outcome = handleSpeedPanelExecuteResult(
      { executed: true },
      'merge-zones',
      { closeSpeedPanel, addRecent, toast },
    );
    expect(outcome).toBe('closed');
    expect(closeSpeedPanel).toHaveBeenCalledTimes(1);
    expect(addRecent).toHaveBeenCalledWith('merge-zones');
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps the panel open and toasts when executed is false', () => {
    const closeSpeedPanel = vi.fn();
    const addRecent = vi.fn();
    const toast = vi.fn();
    const outcome = handleSpeedPanelExecuteResult(
      { executed: false },
      'merge-zones',
      { closeSpeedPanel, addRecent, toast },
    );
    expect(outcome).toBe('kept-open');
    expect(closeSpeedPanel).not.toHaveBeenCalled();
    expect(addRecent).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Action could not be executed', 'warning');
  });
});
