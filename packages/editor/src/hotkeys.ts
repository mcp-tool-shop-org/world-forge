// hotkeys.ts — centralized keyboard shortcut dispatch

import type { WorldProject } from '@world-forge/schema';
import type { SelectionSet, RightTab } from './store/editor-store.js';
import { getSelectionCount } from './store/editor-store.js';

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
  { key: 'KeyD', ctrl: true, action: 'duplicate', label: 'Ctrl+D', description: 'Duplicate selected objects' },
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
];

/** Context passed from the editor to the hotkey dispatcher. */
export interface HotkeyContext {
  selection: SelectionSet;
  selectedConnection: { from: string; to: string } | null;
  project: WorldProject;
  showEntities: boolean;
  showLandmarks: boolean;
  showSpawns: boolean;
  // Actions
  clearSelection: () => void;
  selectAll: (sel: SelectionSet, append: boolean) => void;
  moveSelected: (sel: SelectionSet, dx: number, dy: number) => void;
  removeSelected: (sel: SelectionSet) => void;
  removeConnection: (from: string, to: string) => void;
  duplicateSelected: (sel: SelectionSet) => SelectionSet;
  setShowSearch: (show: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  showSpeedPanel: boolean;
  closeSpeedPanel: () => void;
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

    default:
      return { handled: false };
  }
}
