import { describe, it, expect, beforeEach } from 'vitest';
import { useEditorStore } from '../store/editor-store.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';

describe('editor-store — prop tool state', () => {
  beforeEach(() => {
    useEditorStore.setState({ activePropId: null, showProps: true, activeTool: 'select' });
  });

  it('tracks the active prop definition', () => {
    useEditorStore.getState().setActiveProp('prop-def-1');
    expect(useEditorStore.getState().activePropId).toBe('prop-def-1');
    useEditorStore.getState().setActiveProp(null);
    expect(useEditorStore.getState().activePropId).toBeNull();
  });

  it('toggles the Props layer (default on)', () => {
    expect(useEditorStore.getState().showProps).toBe(true);
    useEditorStore.getState().toggleProps();
    expect(useEditorStore.getState().showProps).toBe(false);
    useEditorStore.getState().toggleProps();
    expect(useEditorStore.getState().showProps).toBe(true);
  });

  it('supports the prop-place tool', () => {
    useEditorStore.getState().setTool('prop-place');
    expect(useEditorStore.getState().activeTool).toBe('prop-place');
  });
});

describe('hotkeys', () => {
  it('binds O to the prop-place tool', () => {
    const b = HOTKEY_BINDINGS.find((x) => x.key === 'KeyO');
    expect(b?.action).toBe('tool-prop');
  });
});
