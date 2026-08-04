// paste-wiring.test.ts — F-6c8800aa: Ctrl+V paste was completely dead in the shipped
// editor. hotkeys.ts correctly registered Ctrl+V -> 'paste' and dispatched to
// ctx.pasteClipboard(), and the pure pasteFromClipboard() function in paste.ts was
// fully implemented and unit-tested — but the ONLY production wiring, Canvas.tsx's
// `pasteClipboard: () => { /* paste handled by project-store when available */ }`,
// was a hardcoded no-op. Every existing test (ft003-ft004-ft005-ft013.test.ts) called
// the pure function directly or asserted the hotkey MATCHES — none of them dispatched
// the real 'paste' action end-to-end and checked the project actually changed, so the
// dead wiring was invisible to the suite.
//
// This file also covers the neighbor/exit remapping bug in paste.ts that was dormant
// only because paste never ran (see the F-bcf7996f note in the fix description):
// the original single-pass implementation assigned a new ID to each zone in the SAME
// `.map()` pass that remapped its `neighbors`/`exits`, so a same-batch cross-reference
// to a zone appearing LATER in the array silently resolved to `undefined` (filtered
// out) purely because of array order.
//
// Canvas.tsx is a React component with no jsdom/@testing-library/react in this
// repo's vitest setup (see keyboard-listener-stability.test.ts's own note on this),
// so — same pattern as that file and mouseup-gesture-recovery.test.ts — the
// end-to-end tests below reproduce Canvas.tsx's wiring closure verbatim rather than
// mounting Canvas. `makeWiredCtx` MUST be kept byte-for-byte equivalent to the
// closure installed on `hotkeyCtxRef.current.pasteClipboard` in Canvas.tsx.

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import type { SelectionSet } from '../store/editor-store.js';
import { dispatchHotkey, type HotkeyContext } from '../hotkeys.js';
import { pasteFromClipboard } from '../paste.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';

const emptySel: SelectionSet = { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] };

function ctrlV(): KeyboardEvent {
  return {
    code: 'KeyV', ctrlKey: true, metaKey: false, shiftKey: false, repeat: false,
    target: { tagName: 'DIV' },
    preventDefault: () => {},
  } as unknown as KeyboardEvent;
}

/**
 * Mirrors Canvas.tsx's hotkeyCtxRef construction EXACTLY:
 *   copySelection: useEditorStore.getState().copySelection,
 *   pasteClipboard: () => {
 *     const newSel = useProjectStore.getState().pasteClipboard();
 *     if (newSel) selectAll(newSel, false);
 *   },
 * `selection`/`project` are re-read fresh per call so this reflects live store state,
 * exactly like the ref rebuilt every render in Canvas.tsx.
 */
function makeWiredCtx(overrides: Partial<HotkeyContext> = {}): HotkeyContext {
  return {
    selection: useEditorStore.getState().selection,
    selectedConnection: null,
    project: useProjectStore.getState().project,
    showEntities: true, showLandmarks: true, showSpawns: true,
    activeModal: null,
    showSearch: false,
    clearSelection: () => useEditorStore.getState().clearSelection(),
    selectAll: (sel, additive) => useEditorStore.getState().selectAll(sel, additive),
    moveSelected: () => {},
    removeSelected: () => {},
    removeConnection: () => {},
    duplicateSelected: () => emptySel,
    copySelection: useEditorStore.getState().copySelection,
    pasteClipboard: () => {
      const newSel = useProjectStore.getState().pasteClipboard();
      if (newSel) useEditorStore.getState().selectAll(newSel, false);
    },
    setShowSearch: () => {},
    setRightTab: () => {},
    setTool: () => {},
    showSpeedPanel: false,
    closeSpeedPanel: () => {},
    ...overrides,
  };
}

describe('F-6c8800aa: Ctrl+V paste — real end-to-end wiring', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProject(structuredClone(chapelProject));
    useEditorStore.getState().clearSelection();
    useEditorStore.setState({ clipboard: null });
  });

  it('control: an empty clipboard is a safe no-op (no crash, no project change, no history entry)', () => {
    expect(useEditorStore.getState().getClipboard()).toBeNull();
    const beforeCount = useProjectStore.getState().project.zones.length;

    const ctx = makeWiredCtx();
    const result = dispatchHotkey(ctrlV(), ctx);

    expect(result.handled).toBe(true);
    expect(useProjectStore.getState().project.zones.length).toBe(beforeCount);
    expect(useProjectStore.getState().getUndoLabel()).toBeNull();
  });

  it('copying a zone then dispatching the real Ctrl+V hotkey actually adds the pasted zone to the project', () => {
    useEditorStore.getState().selectZone('chapel-entrance', false);
    useEditorStore.getState().copySelection(useProjectStore.getState().project);
    expect(useEditorStore.getState().getClipboard()).not.toBeNull(); // control: copy still works

    const beforeCount = useProjectStore.getState().project.zones.length;
    const ctx = makeWiredCtx();
    const result = dispatchHotkey(ctrlV(), ctx);

    expect(result.handled).toBe(true);
    // This is the crux of F-6c8800aa: today Canvas.tsx's pasteClipboard is a
    // hardcoded no-op, so nothing is added and this stays equal to beforeCount.
    const zonesAfter = useProjectStore.getState().project.zones;
    expect(zonesAfter.length).toBe(beforeCount + 1);
    const pasted = zonesAfter.find((z) => z.name === 'Chapel Entrance (paste)');
    expect(pasted).toBeDefined();
    expect(pasted!.id).not.toBe('chapel-entrance');
  });

  it('the pasted zone is selected afterward (mirrors the Ctrl+D auto-select UX)', () => {
    useEditorStore.getState().selectZone('chapel-entrance', false);
    useEditorStore.getState().copySelection(useProjectStore.getState().project);

    const ctx = makeWiredCtx();
    dispatchHotkey(ctrlV(), ctx);

    const sel = useEditorStore.getState().selection;
    expect(sel.zones).toHaveLength(1);
    const pastedId = sel.zones[0];
    expect(pastedId).not.toBe('chapel-entrance');
    expect(useProjectStore.getState().project.zones.find((z) => z.id === pastedId)).toBeDefined();
  });

  it('paste is a single undoable action — one undo fully restores the pre-paste project', () => {
    useEditorStore.getState().selectZone('chapel-entrance', false);
    useEditorStore.getState().copySelection(useProjectStore.getState().project);
    const beforeCount = useProjectStore.getState().project.zones.length;

    const ctx = makeWiredCtx();
    dispatchHotkey(ctrlV(), ctx);
    expect(useProjectStore.getState().project.zones.length).toBe(beforeCount + 1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Paste 1 object');

    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.zones.length).toBe(beforeCount);
  });

  it('pasting multiple selected objects labels the undo entry with the correct count', () => {
    useEditorStore.getState().selectZone('chapel-entrance', false);
    useEditorStore.getState().selectZone('chapel-nave', true);
    useEditorStore.getState().copySelection(useProjectStore.getState().project);

    const ctx = makeWiredCtx();
    dispatchHotkey(ctrlV(), ctx);

    expect(useProjectStore.getState().getUndoLabel()).toBe('Paste 2 objects');
  });
});

describe('F-6c8800aa (paste.ts internals): neighbor/exit remapping is order-independent', () => {
  // chapelProject.zones order is [chapel-entrance, chapel-nave, chapel-alcove,
  // vestry-door, crypt-chamber]. chapel-entrance's OWN neighbors/exits reference
  // chapel-nave, which appears LATER in that array — exactly the forward-reference
  // shape that broke under the original single-pass implementation.

  it('preserves a same-batch neighbor link regardless of clipboard array order', () => {
    const clip = {
      zones: [chapelProject.zones[0], chapelProject.zones[1]], // chapel-entrance, chapel-nave
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    const result = pasteFromClipboard(clip, createEmptyProject());
    const newEntrance = result.project.zones.find((z) => z.name === 'Chapel Entrance (paste)')!;
    const newNave = result.project.zones.find((z) => z.name === 'Chapel Nave (paste)')!;
    expect(newEntrance).toBeDefined();
    expect(newNave).toBeDefined();
    // The bug: this used to be [] because chapel-nave hadn't been assigned a new
    // ID yet at the point chapel-entrance's neighbors were remapped.
    expect(newEntrance.neighbors).toEqual([newNave.id]);
  });

  it('preserves a same-batch zone exit target regardless of clipboard array order', () => {
    const clip = {
      zones: [chapelProject.zones[0], chapelProject.zones[1]],
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    const result = pasteFromClipboard(clip, createEmptyProject());
    const newEntrance = result.project.zones.find((z) => z.name === 'Chapel Entrance (paste)')!;
    const newNave = result.project.zones.find((z) => z.name === 'Chapel Nave (paste)')!;
    expect(newEntrance.exits).toHaveLength(1);
    // Before the fix this stayed 'chapel-nave' (the OLD id) because exits were
    // never remapped at all.
    expect(newEntrance.exits[0].targetZoneId).toBe(newNave.id);
    expect(newEntrance.exits[0].label).toBe('Through the doors');
  });

  it('control: a neighbor pointing outside the pasted batch is dropped, not left dangling', () => {
    const clip = {
      zones: [chapelProject.zones[1]], // chapel-nave alone; its neighbors are NOT in this clipboard
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    const result = pasteFromClipboard(clip, createEmptyProject());
    const newNave = result.project.zones.find((z) => z.name === 'Chapel Nave (paste)')!;
    expect(newNave.neighbors).toEqual([]);
  });

  it('an exit pointing outside the pasted batch is dropped, not left pointing at a foreign zone', () => {
    const clip = {
      zones: [chapelProject.zones[1]], // chapel-nave alone; its exits target zones NOT in this clipboard
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    const result = pasteFromClipboard(clip, createEmptyProject());
    const newNave = result.project.zones.find((z) => z.name === 'Chapel Nave (paste)')!;
    // Before the fix, exits passed through unmodified (still 3, still pointing at
    // the ORIGINAL chapel-alcove/vestry-door/chapel-entrance ids) instead of being
    // filtered down like neighbors already were.
    expect(newNave.exits).toEqual([]);
  });

  it('control: newSelection reports exactly the pasted zone ids', () => {
    const clip = {
      zones: [chapelProject.zones[0], chapelProject.zones[1]],
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    const result = pasteFromClipboard(clip, createEmptyProject());
    expect(result.newSelection.zones).toHaveLength(2);
    expect(result.newSelection.zones).toEqual(result.newIds.filter((id) => id.startsWith('zone-')));
  });
});
