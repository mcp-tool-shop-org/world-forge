// lifecycle-guards.test.ts — verify dirty-state guards on destructive transitions
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { confirmDiscard } from '../modal-guards.js';

// Provide window.confirm in Node test environment
beforeEach(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = { confirm: () => true };
  }
  useProjectStore.setState({
    project: createEmptyProject(),
    dirty: false,
    undoStack: [],
    redoStack: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lifecycle dirty guards', () => {
  it('confirmDiscard is called before destructive action when dirty', () => {
    const spy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const store = useProjectStore.getState();
    // Simulate dirty state
    useProjectStore.setState({ dirty: true });
    const dirty = useProjectStore.getState().dirty;

    // Guard pattern used in TemplateManager + App.tsx Load:
    //   if (dirty && !confirmDiscard()) return;
    let blocked = false;
    if (dirty && !confirmDiscard()) {
      blocked = true;
    }
    expect(blocked).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    // loadProject should NOT have been called
    expect(useProjectStore.getState().project.id).toBe('new-project');
  });

  it('confirmDiscard allows action when user confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    useProjectStore.setState({ dirty: true });
    const dirty = useProjectStore.getState().dirty;

    let blocked = false;
    if (dirty && !confirmDiscard()) {
      blocked = true;
    }
    expect(blocked).toBe(false);
  });

  it('no confirm dialog when project is clean', () => {
    const spy = vi.spyOn(window, 'confirm');
    useProjectStore.setState({ dirty: false });
    const dirty = useProjectStore.getState().dirty;

    let blocked = false;
    if (dirty && !confirmDiscard()) {
      blocked = true;
    }
    expect(blocked).toBe(false);
    // window.confirm should never be called on clean project
    expect(spy).not.toHaveBeenCalled();
  });

  it('loadProject resets dirty to false', () => {
    useProjectStore.setState({ dirty: true });
    expect(useProjectStore.getState().dirty).toBe(true);
    useProjectStore.getState().loadProject(createEmptyProject());
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('markClean sets dirty to false without clearing undo stack', () => {
    const store = useProjectStore.getState();
    // Make a change to populate undo stack
    store.updateProject((p) => ({ ...p, name: 'Changed' }), 'Rename');
    expect(useProjectStore.getState().dirty).toBe(true);
    expect(useProjectStore.getState().undoStack.length).toBe(1);

    useProjectStore.getState().markClean();
    expect(useProjectStore.getState().dirty).toBe(false);
    // Undo stack preserved
    expect(useProjectStore.getState().undoStack.length).toBe(1);
  });

  it('loadProject clears editor selection', () => {
    // Set up a non-empty selection
    useEditorStore.getState().selectZone('z1', false);
    useEditorStore.getState().selectEntity('e1', true);
    expect(useEditorStore.getState().selection.zones).toContain('z1');
    expect(useEditorStore.getState().selection.entities).toContain('e1');

    // loadProject should clear it
    useProjectStore.getState().loadProject(createEmptyProject());
    const sel = useEditorStore.getState().selection;
    expect(sel.zones).toHaveLength(0);
    expect(sel.entities).toHaveLength(0);
    expect(sel.landmarks).toHaveLength(0);
    expect(sel.spawns).toHaveLength(0);
    expect(sel.encounters).toHaveLength(0);
  });

  it('newProject clears editor selection', () => {
    useEditorStore.getState().selectZone('z1', false);
    expect(useEditorStore.getState().selection.zones).toContain('z1');

    useProjectStore.getState().newProject();
    const sel = useEditorStore.getState().selection;
    expect(sel.zones).toHaveLength(0);
    expect(sel.entities).toHaveLength(0);
  });
});
