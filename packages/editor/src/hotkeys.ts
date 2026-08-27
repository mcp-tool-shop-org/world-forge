// hotkeys.ts — centralized keyboard shortcut dispatch

import type { WorldProject } from '@world-forge/schema';
import type { SelectionSet, RightTab, EditorTool } from './store/editor-store.js';
import { getSelectionCount } from './store/editor-store.js';
import type { ModalId } from './store/modal-store.js';

export interface HotkeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  action: string;
  label: string;
  description: string;
}

export const HOTKEY_BINDINGS: HotkeyBinding[] = [
  { key: 'KeyK', ctrl: true, action: 'search', label: 'Ctrl+K', description: 'Open search overlay' },
  { key: 'KeyC', ctrl: true, action: 'copy', label: 'Ctrl+C', description: 'Copy selected objects' },
  { key: 'KeyV', ctrl: true, action: 'paste', label: 'Ctrl+V', description: 'Paste from clipboard' },
  { key: 'KeyD', ctrl: true, action: 'duplicate', label: 'Ctrl+D', description: 'Duplicate selected objects' },
  { key: 'KeyZ', ctrl: true, action: 'undo', label: 'Ctrl+Z', description: 'Undo last action' },
  { key: 'KeyZ', ctrl: true, shift: true, action: 'redo', label: 'Ctrl+Shift+Z', description: 'Redo last undone action' },
  { key: 'KeyY', ctrl: true, action: 'redo', label: 'Ctrl+Y', description: 'Redo last undone action' },
  { key: 'KeyA', ctrl: true, action: 'select-all', label: 'Ctrl+A', description: 'Select all visible objects' },
  { key: 'Delete', action: 'delete', label: 'Del', description: 'Delete selected objects' },
  { key: 'Backspace', action: 'delete', label: 'Backspace', description: 'Delete selected objects' },
  { key: 'Escape', action: 'escape', label: 'Esc', description: 'Clear selection and cancel drag' },
  { key: 'ArrowUp', action: 'nudge-up', label: 'Up', description: 'Nudge selected up (Shift for 5x)' },
  { key: 'ArrowDown', action: 'nudge-down', label: 'Down', description: 'Nudge selected down (Shift for 5x)' },
  { key: 'ArrowLeft', action: 'nudge-left', label: 'Left', description: 'Nudge selected left (Shift for 5x)' },
  { key: 'ArrowRight', action: 'nudge-right', label: 'Right', description: 'Nudge selected right (Shift for 5x)' },
  { key: 'Enter', action: 'open-details', label: 'Enter', description: 'Open details for selected object' },
  { key: 'KeyP', action: 'apply-preset', label: 'P', description: 'Open preset browser for selection' },
  { key: 'KeyP', shift: true, action: 'save-preset', label: 'Shift+P', description: 'Save current selection as preset' },
  // Tool switching — matches labels shown in ToolPalette
  { key: 'KeyV', action: 'tool-select', label: 'V', description: 'Switch to Select tool' },
  { key: 'KeyZ', action: 'tool-zone', label: 'Z', description: 'Switch to Zone tool' },
  { key: 'KeyC', action: 'tool-connection', label: 'C', description: 'Switch to Connection tool' },
  { key: 'KeyE', action: 'tool-entity', label: 'E', description: 'Switch to Entity tool' },
  { key: 'KeyL', action: 'tool-landmark', label: 'L', description: 'Switch to Landmark tool' },
  { key: 'KeyS', action: 'tool-spawn', label: 'S', description: 'Switch to Spawn tool' },
  { key: 'KeyT', action: 'tool-tile', label: 'T', description: 'Switch to Tile Paint tool' },
  { key: 'KeyO', action: 'tool-prop', label: 'O', description: 'Switch to Prop Place tool' },
];

/** Return a flat list of all registered hotkeys for display in a guide panel. */
export function getHotkeyList(): { key: string; label: string; description: string }[] {
  return HOTKEY_BINDINGS.map((b) => ({ key: b.key, label: b.label, description: b.description }));
}

/** Context passed from the editor to the hotkey dispatcher. */
export interface HotkeyContext {
  selection: SelectionSet;
  selectedConnection: { from: string; to: string } | null;
  project: WorldProject;
  showEntities: boolean;
  showLandmarks: boolean;
  showSpawns: boolean;
  /**
   * F-340b4aff: id of the currently-open modal (Export/Import/Template
   * Manager/Save Template/Save Kit), or `null` when none is open. Mirrors
   * `useModalStore.getState().activeModal`.
   */
  activeModal: ModalId;
  /**
   * F-340b4aff: whether the Ctrl+K search overlay is currently open. Mirrors
   * `useEditorStore.getState().showSearch`.
   */
  showSearch: boolean;
  // Actions
  clearSelection: () => void;
  selectAll: (sel: SelectionSet, append: boolean) => void;
  moveSelected: (sel: SelectionSet, dx: number, dy: number) => void;
  removeSelected: (sel: SelectionSet) => void;
  removeConnection: (from: string, to: string) => void;
  duplicateSelected: (sel: SelectionSet) => SelectionSet;
  copySelection?: (project: WorldProject) => void;
  pasteClipboard?: () => void;
  /** F-f2564ffa: undo/redo — optional so existing test bags still type-check. */
  undo?: () => void;
  redo?: () => void;
  setShowSearch: (show: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  setTool: (tool: EditorTool) => void;
  showSpeedPanel: boolean;
  closeSpeedPanel: () => void;
  /**
   * F-eb7fc5ef: Escape must drop an in-progress connection, not only the
   * SelectionSet. Optional so older test bags still type-check.
   */
  setConnectionStart?: (zoneId: string | null) => void;
}

export type HotkeyResult =
  | { handled: true; action: string }
  | { handled: false };

/**
 * Match an incoming keyboard event against hotkey bindings.
 * Returns the matching action string or null.
 */
export function matchHotkey(e: KeyboardEvent): string | null {
  const ctrl = e.ctrlKey || e.metaKey;
  const shift = e.shiftKey;

  for (const binding of HOTKEY_BINDINGS) {
    if (binding.key !== e.code) continue;
    if (binding.ctrl && !ctrl) continue;
    if (!binding.ctrl && ctrl) continue;
    if (binding.shift && !shift) continue;
    if (!binding.shift && shift && binding.key !== 'Delete' && binding.key !== 'Backspace' && !binding.key.startsWith('Arrow')) continue;
    return binding.action;
  }
  return null;
}

/**
 * Dispatch a hotkey action. Returns whether it was handled.
 * Space and key-up events are handled separately by Canvas (they depend on refs).
 */
export function dispatchHotkey(e: KeyboardEvent, ctx: HotkeyContext): HotkeyResult {
  // F-340b4aff: never mutate the canvas while a modal or the search overlay
  // is open — those surfaces sit visually on top of the canvas, so an
  // "invisible" hotkey (Delete, Ctrl+A, tool switches, ...) would silently
  // mutate content the user can't see. This is defense-in-depth: Canvas.tsx's
  // keydown handler already checks live store state before calling
  // dispatchHotkey at all; this second gate protects any future caller that
  // forgets to (and keeps this behavior directly unit-testable here).
  if (ctx.activeModal != null || ctx.showSearch) {
    return { handled: false };
  }

  // Input-safe guard
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return { handled: false };
  }

  const action = matchHotkey(e);
  if (!action) return { handled: false };

  switch (action) {
    case 'search':
      e.preventDefault();
      ctx.setShowSearch(true);
      return { handled: true, action };

    case 'copy': {
      // F-ef6c82dc: only swallow Ctrl+C when there is something to copy;
      // otherwise let the browser copy selected non-input text (e.g. project name).
      if (getSelectionCount(ctx.selection) === 0) return { handled: false };
      e.preventDefault();
      if (ctx.copySelection) ctx.copySelection(ctx.project);
      return { handled: true, action };
    }

    case 'paste': {
      e.preventDefault();
      if (ctx.pasteClipboard) ctx.pasteClipboard();
      return { handled: true, action };
    }

    case 'duplicate': {
      e.preventDefault();
      if (getSelectionCount(ctx.selection) > 0) {
        const newSel = ctx.duplicateSelected(ctx.selection);
        ctx.selectAll(newSel, false);
      }
      return { handled: true, action };
    }

    case 'select-all': {
      e.preventDefault();
      const zones = ctx.project.zones.map((z) => z.id);
      const entities = ctx.showEntities ? ctx.project.entityPlacements.map((ent) => ent.entityId) : [];
      const landmarks = ctx.showLandmarks ? ctx.project.landmarks.map((l) => l.id) : [];
      const spawns = ctx.showSpawns ? ctx.project.spawnPoints.map((s) => s.id) : [];
      const encounters = ctx.project.encounterAnchors.map((enc) => enc.id);
      ctx.selectAll({ zones, entities, landmarks, spawns, encounters }, false);
      return { handled: true, action };
    }

    case 'delete': {
      if (ctx.selectedConnection) {
        ctx.removeConnection(ctx.selectedConnection.from, ctx.selectedConnection.to);
        ctx.clearSelection();
        return { handled: true, action };
      }
      const count = getSelectionCount(ctx.selection);
      if (count === 0) return { handled: true, action };
      if (count > 3 && typeof confirm !== 'undefined' && !confirm(`Delete ${count} objects?`)) {
        return { handled: true, action };
      }
      ctx.removeSelected(ctx.selection);
      ctx.clearSelection();
      return { handled: true, action };
    }

    case 'escape':
      if (ctx.showSpeedPanel) { ctx.closeSpeedPanel(); }
      else { ctx.clearSelection(); }
      // F-eb7fc5ef: connectionStart is store state (not a Canvas drag ref),
      // so the advertised Esc-to-cancel must clear it even when a speed panel
      // was closed. setTool() is otherwise the only production clear.
      ctx.setConnectionStart?.(null);
      return { handled: true, action };

    case 'nudge-up':
    case 'nudge-down':
    case 'nudge-left':
    case 'nudge-right': {
      if (getSelectionCount(ctx.selection) === 0) return { handled: false };
      e.preventDefault();
      const mult = e.shiftKey ? 5 : 1;
      const dirs: Record<string, [number, number]> = {
        'nudge-up': [0, -1], 'nudge-down': [0, 1],
        'nudge-left': [-1, 0], 'nudge-right': [1, 0],
      };
      const [dx, dy] = dirs[action];
      ctx.moveSelected(ctx.selection, dx * mult, dy * mult);
      return { handled: true, action };
    }

    case 'open-details': {
      e.preventDefault();
      // Switch to map tab to show properties for current selection
      ctx.setRightTab('map');
      return { handled: true, action };
    }

    case 'apply-preset': {
      e.preventDefault();
      ctx.setRightTab('presets');
      return { handled: true, action };
    }

    case 'save-preset': {
      e.preventDefault();
      ctx.setRightTab('presets');
      return { handled: true, action };
    }

    case 'undo': {
      e.preventDefault();
      ctx.undo?.();
      return { handled: true, action };
    }

    case 'redo': {
      e.preventDefault();
      ctx.redo?.();
      return { handled: true, action };
    }

    case 'tool-select':    { ctx.setTool('select');       return { handled: true, action }; }
    case 'tool-zone':      { ctx.setTool('zone-paint');   return { handled: true, action }; }
    case 'tool-connection':{ ctx.setTool('connection');    return { handled: true, action }; }
    case 'tool-entity':    { ctx.setTool('entity-place'); return { handled: true, action }; }
    case 'tool-landmark':  { ctx.setTool('landmark');     return { handled: true, action }; }
    case 'tool-spawn':     { ctx.setTool('spawn');        return { handled: true, action }; }
    case 'tool-tile':      { ctx.setTool('tile-paint');   return { handled: true, action }; }
    case 'tool-prop':      { ctx.setTool('prop-place');   return { handled: true, action }; }

    default:
      return { handled: false };
  }
}

/**
 * F-6c1fa8ce: Space is the standard activation key for focused buttons /
 * links / menuitems. The canvas pan-on-Space chord is only legal when the
 * event is not targeting an activating control.
 */
export function isActivatingControl(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
    closest?: (selector: string) => { tagName?: string } | null;
  };
  const tag = el.tagName;
  if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') return true;
  if (el.isContentEditable) return true;
  const role = typeof el.getAttribute === 'function' ? el.getAttribute('role') : null;
  if (role === 'button' || role === 'menuitem' || role === 'tab' || role === 'link') return true;
  try {
    if (typeof el.closest === 'function' && el.closest('button, [role="button"], a[href], [role="menuitem"], [role="tab"]')) {
      return true;
    }
  } catch { /* closest may throw on non-Element test doubles */ }
  return false;
}

/**
 * F-6c1fa8ce: only arm Space-to-pan when focus is on the canvas (or body/root
 * with nothing else focused). Never preventDefault Space for INPUT/TEXTAREA/
 * SELECT (existing skip) or for buttons / [role=button] / links / contentEditable.
 */
export function shouldArmSpacePan(
  target: EventTarget | null,
  activeElement: { tagName?: string } | null,
  canvas: object | null,
): boolean {
  const tag = (target as { tagName?: string } | null)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (isActivatingControl(target)) return false;
  if (isActivatingControl(activeElement as EventTarget | null)) return false;
  if (!activeElement) return true;
  const activeTag = activeElement.tagName;
  if (!activeTag || activeTag === 'BODY' || activeTag === 'HTML') return true;
  if (canvas && activeElement === canvas) return true;
  const contains = (canvas as { contains?: (node: unknown) => boolean } | null)?.contains;
  if (typeof contains === 'function' && contains.call(canvas, activeElement)) return true;
  return false;
}
