// context-menu-wiring.test.ts — F-ef5cce21: the canvas right-click context menu
// was fully built (FT-005: SPEED_PANEL_ACTIONS filtered into labeled Delete/
// Duplicate/Edit/Merge/Swap items) but the item onClick only called
// setContextMenu(null) with an explicit "For now, just close. The
// speed-panel-execute module handles execution." comment. executeAction was
// never imported. Double-right-click SpeedPanel does call executeAction; this
// single-right-click path did not. Existing FT-005 tests only asserted
// SPEED_PANEL_ACTIONS.contextFilter / getContextMenuActions contents — they
// never dispatched a menu click — so the dead wiring was invisible to the
// suite, exactly like paste-wiring.test.ts describes for F-6c8800aa.
//
// Canvas.tsx is a React component with no jsdom/@testing-library/react in this
// repo's vitest setup (see paste-wiring.test.ts / keyboard-listener-stability),
// so the tests below reproduce Canvas.tsx's onClick closure verbatim rather
// than mounting Canvas. `onContextMenuItemClick` MUST be kept equivalent to:
//   executeAction(action.id, contextMenu.hit, buildExecuteStores());
//   setContextMenu(null);

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { executeAction, buildExecuteStores } from '../speed-panel-execute.js';
import type { HitResult } from '../hit-testing.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';

/**
 * Mirrors Canvas.tsx's context-menu item onClick EXACTLY:
 *   executeAction(action.id, contextMenu.hit, buildExecuteStores());
 *   setContextMenu(null);
 * Closing the menu is a React setState we don't have here; execution is the
 * load-bearing half (the previous implementation did the close and skipped this).
 */
function onContextMenuItemClick(actionId: string, hit: HitResult | null): { executed: boolean } {
  return executeAction(actionId, hit, buildExecuteStores());
}

describe('F-ef5cce21: canvas context menu — real onClick wiring', () => {
  beforeEach(() => {
    useProjectStore.getState().loadProject(structuredClone(chapelProject));
    useEditorStore.getState().clearSelection();
  });

  it('production bag includes mergeZones + selection (same ExecuteStores SpeedPanel should build)', () => {
    const bag = buildExecuteStores();
    expect(typeof bag.mergeZones).toBe('function');
    expect(bag.selection).toBeDefined();
    expect(bag.selection!.zones).toEqual([]);
    expect(bag.project.id).toBe('chapel-threshold');
  });

  it('Delete on a zone hit actually removes the zone from the project', () => {
    const beforeCount = useProjectStore.getState().project.zones.length;
    expect(useProjectStore.getState().project.zones.find((z) => z.id === 'chapel-entrance')).toBeDefined();

    const hit: HitResult = { type: 'zone', id: 'chapel-entrance' };
    const result = onContextMenuItemClick('delete', hit);

    expect(result.executed).toBe(true);
    const after = useProjectStore.getState().project;
    expect(after.zones.find((z) => z.id === 'chapel-entrance')).toBeUndefined();
    expect(after.zones.length).toBe(beforeCount - 1);
  });

  it('Duplicate on a zone hit actually adds a copy to the project', () => {
    const beforeCount = useProjectStore.getState().project.zones.length;

    const hit: HitResult = { type: 'zone', id: 'chapel-entrance' };
    const result = onContextMenuItemClick('duplicate', hit);

    expect(result.executed).toBe(true);
    const after = useProjectStore.getState().project;
    expect(after.zones.length).toBe(beforeCount + 1);
    const copy = after.zones.find((z) => z.name === 'Chapel Entrance (copy)');
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe('chapel-entrance');
    expect(after.zones.find((z) => z.id === 'chapel-entrance')).toBeDefined();
  });

  it('Delete on a connection hit actually removes that connection', () => {
    const beforeCount = useProjectStore.getState().project.connections.length;
    const hit: HitResult = { type: 'connection', id: 'chapel-entrance::chapel-nave' };
    const result = onContextMenuItemClick('delete', hit);

    expect(result.executed).toBe(true);
    const after = useProjectStore.getState().project.connections;
    expect(after.length).toBe(beforeCount - 1);
    expect(after.find((c) => c.fromZoneId === 'chapel-entrance' && c.toZoneId === 'chapel-nave')).toBeUndefined();
  });
});
