import { describe, it, expect, vi } from 'vitest';
import { useEditorStore } from '../store/editor-store.js';
import { executeAction } from '../speed-panel-execute.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';

describe('F-04f58b32: pending connection kind', () => {
  it('stores pendingConnectionKind until the tool leaves connection', () => {
    useEditorStore.setState({ pendingConnectionKind: null, activeTool: 'select' });
    useEditorStore.getState().setPendingConnectionKind('secret');
    expect(useEditorStore.getState().pendingConnectionKind).toBe('secret');
    useEditorStore.getState().setTool('connection');
    expect(useEditorStore.getState().pendingConnectionKind).toBe('secret');
    useEditorStore.getState().setTool('select');
    expect(useEditorStore.getState().pendingConnectionKind).toBeNull();
  });

  it('add-secret-conn sets pending kind and connection tool', () => {
    const setPendingConnectionKind = vi.fn();
    const setTool = vi.fn();
    const setConnectionStart = vi.fn();
    const stores = {
      setPendingConnectionKind, setTool, setConnectionStart,
    };
    const result = executeAction('add-secret-conn', { type: 'zone', id: 'z1' }, stores as never);
    expect(result.executed).toBe(true);
    expect(setPendingConnectionKind).toHaveBeenCalledWith('secret');
    expect(setTool).toHaveBeenCalledWith('connection');
    expect(setConnectionStart).toHaveBeenCalledWith('z1');
    expect(SPEED_PANEL_ACTIONS.some((a) => a.id === 'add-secret-conn' && a.modeSuggested?.includes('dungeon'))).toBe(true);
  });
});
