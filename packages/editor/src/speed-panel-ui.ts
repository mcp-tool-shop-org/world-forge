// speed-panel-ui.ts — pure view-model, key-routing, clamping, and execution helpers for SpeedPanel

import type { EditorCommand, HotkeyContext } from './command-registry.js';
import type { HitResult } from './hit-testing.js';
import type { MacroExecutionResult, SpeedPanelMacro } from './speed-panel-actions.js';
import type { ExecuteResult, ExecuteStores } from './speed-panel-execute.js';
import type { PaletteRow, SpeedPanelView } from './speed-panel-layout.js';
import { formatSpeedPanelFailure, handleSpeedPanelExecuteResult } from './panels/speed-panel-stores.js';

export const SPEED_GLYPH: Readonly<Record<string, string>> = {
  'new-zone': '+',
  'fit-content': '\u25A1',
  'edit-props': '\u270E',
  delete: '\u2715',
  duplicate: '\u2398',
  'assign-district': '\u25A6',
  'place-entity': '\u25C9',
  'place-encounter': '\u25C7',
  'connect-from': '\u2192',
  'swap-direction': '\u21C4',
  'merge-zones': '\u29C9',
  'set-elevation': '\u2191',
  'open-review': '\u2630',
  'export-summary': '\u2913',
  search: '\u2315',
  save: '\u2913',
  copy: '\u2398',
  paste: '\u2399',
  undo: '\u21B6',
  redo: '\u21B7',
  'select-all': '\u25A3',
  escape: '\u2715',
  'nudge-up': '\u2191',
  'nudge-down': '\u2193',
  'nudge-left': '\u2190',
  'nudge-right': '\u2192',
  'open-details': '\u270E',
  'apply-preset': '\u25C6',
  'save-preset': '\u25C7',
};

export const SP_HEADING_IDS = {
  band1: 'wf-sp-heading-band-1',
  band2: 'wf-sp-heading-band-2',
  band3: 'wf-sp-heading-band-3',
  band4Mode: 'wf-sp-heading-band-4-mode',
  searchMacros: 'wf-sp-heading-search-macros',
  unavailable: 'wf-sp-heading-unavailable',
} as const;

export function customGroupHeadingId(groupId: string): string {
  return `wf-sp-heading-cg-${groupId}`;
}

export function catalogueGroupHeadingId(groupName: string): string {
  return `wf-sp-heading-cat-${groupName}`;
}

/** Return the 16px display glyph for a command in the Speed Panel. */
export function commandGlyph(cmd: EditorCommand): string {
  return SPEED_GLYPH[cmd.id] ?? cmd.icon ?? cmd.toolIcon ?? '\u25CB';
}

export interface NavEntryAction {
  kind: 'row';
  domId: string;
  row: PaletteRow;
  isPinnedCopy?: boolean;
  visiblePinIndex?: number;
}

export interface NavEntryMacro {
  kind: 'macro';
  domId: string;
  macro: SpeedPanelMacro;
}

export type NavEntry = NavEntryAction | NavEntryMacro;

/** Flatten visible selectable rows and macros in exact keyboard navigation order. */
export function buildNavigableEntries(
  view: SpeedPanelView,
  collapsedGroups: ReadonlySet<string>,
): NavEntry[] {
  const items: NavEntry[] = [];
  if (view.kind === 'unsearched') {
    view.band1Deck.forEach((row, i) => {
      items.push({ kind: 'row', domId: `wf-sp-opt-b1-${i}-${row.command.id}`, row });
    });
    view.band2Pinned.forEach((row, i) => {
      items.push({
        kind: 'row',
        domId: `wf-sp-opt-b2-${i}-${row.command.id}`,
        row,
        isPinnedCopy: true,
        visiblePinIndex: i,
      });
    });
    view.band2Macros.forEach((macro) => {
      items.push({ kind: 'macro', domId: `wf-sp-opt-macro-${macro.id}`, macro });
    });
    view.band3Recents.forEach((row, i) => {
      items.push({ kind: 'row', domId: `wf-sp-opt-b3-${i}-${row.command.id}`, row });
    });
    view.band4ModeSuggested.forEach((row, i) => {
      items.push({ kind: 'row', domId: `wf-sp-opt-ms-${i}-${row.command.id}`, row });
    });
    view.band4CustomGroups.forEach((g) => {
      if (!collapsedGroups.has(g.group.id)) {
        g.rows.forEach((row, i) => {
          items.push({ kind: 'row', domId: `wf-sp-opt-cg-${g.group.id}-${i}-${row.command.id}`, row });
        });
      }
    });
    view.band4Catalogue.forEach((sec) => {
      sec.rows.forEach((row, i) => {
        items.push({ kind: 'row', domId: `wf-sp-opt-cat-${sec.group}-${i}-${row.command.id}`, row });
      });
    });
  } else {
    view.enabled.forEach((row, i) => {
      items.push({ kind: 'row', domId: `wf-sp-opt-hit-${i}-${row.command.id}`, row });
    });
    view.macros.forEach((macro) => {
      items.push({ kind: 'macro', domId: `wf-sp-opt-macro-${macro.id}`, macro });
    });
    view.unavailable.forEach((row, i) => {
      items.push({ kind: 'row', domId: `wf-sp-opt-unavail-${i}-${row.command.id}`, row });
    });
  }
  return items;
}

/** Clamp `activeIdx` back into `[0, length)` after list length shrinks. */
export function clampActiveIndex(prev: number, length: number): number {
  if (length === 0) return 0;
  return prev >= length ? 0 : prev;
}

/** Clamp panel top-left coordinates inside parent bounds with a 4 px inset margin. */
export function computeEdgeClampedOffset(
  pos: { x: number; y: number },
  panelWidth: number,
  panelHeight: number,
  parentWidth: number,
  parentHeight: number,
): { left: number; top: number } {
  let left = pos.x;
  let top = pos.y;
  if (left + panelWidth > parentWidth) left = parentWidth - panelWidth - 4;
  if (top + panelHeight > parentHeight) top = parentHeight - panelHeight - 4;
  if (left < 0) left = 4;
  if (top < 0) top = 4;
  return { left, top };
}

/** Split `text` into matched and unmatched spans using sorted `[start, end)` character ranges. */
export function splitHighlightSegments(
  text: string,
  ranges?: ReadonlyArray<[number, number]>,
): Array<{ str: string; matched: boolean }> {
  if (!ranges || ranges.length === 0) {
    return [{ str: text, matched: false }];
  }
  const parts: Array<{ str: string; matched: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ranges) {
    const s = Math.max(cursor, Math.min(text.length, start));
    const e = Math.max(s, Math.min(text.length, end));
    if (s > cursor) parts.push({ str: text.slice(cursor, s), matched: false });
    if (e > s) parts.push({ str: text.slice(s, e), matched: true });
    cursor = e;
  }
  if (cursor < text.length) {
    parts.push({ str: text.slice(cursor), matched: false });
  }
  return parts;
}

/**
 * Return true when an event target is an editable field or `<select>` inside the
 * panel other than the primary Speed Panel search box (`wf-speed-panel-search`).
 */
export function isNonSearchTextInput(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
    dataset?: { testid?: string };
  };
  if (el.isContentEditable === true) return true;
  const tag = typeof el.tagName === 'string' ? el.tagName.toUpperCase() : '';
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag === 'INPUT') {
    const testId =
      (typeof el.getAttribute === 'function' ? el.getAttribute('data-testid') : null) ??
      el.dataset?.testid ??
      null;
    return testId !== 'wf-speed-panel-search';
  }
  return false;
}

export interface SpeedPanelKeyEventLike {
  key: string;
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: unknown;
}

export type SpeedPanelKeyAction =
  | { type: 'none' }
  | { type: 'close' }
  | { type: 'consumed' }
  | { type: 'reorder-pin'; fromPinIndex: number; toPinIndex: number; nextActiveIdx: number }
  | { type: 'exec-row'; row: PaletteRow }
  | { type: 'exec-macro'; macro: SpeedPanelMacro }
  | { type: 'set-active'; nextActiveIdx: number };

/** Pure keyboard router for SpeedPanel. Keeps shortcuts dead while editing group/macro inputs. */
export function resolveSpeedPanelKeyAction(
  e: SpeedPanelKeyEventLike,
  view: SpeedPanelView,
  allNavigable: readonly NavEntry[],
  activeIdx: number,
): SpeedPanelKeyAction {
  if (e.key === 'Escape') {
    return { type: 'close' };
  }

  const inSecondaryInput = isNonSearchTextInput(e.target);

  // Band 2 Pin Reorder via Alt+Up / Alt+Down
  if (!inSecondaryInput && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const active = allNavigable[activeIdx];
    if (
      view.kind === 'unsearched' &&
      active?.kind === 'row' &&
      active.isPinnedCopy &&
      active.row.pinIndex !== undefined &&
      active.visiblePinIndex !== undefined
    ) {
      const vi = active.visiblePinIndex;
      if (e.key === 'ArrowUp' && vi > 0) {
        const targetPinIndex = view.band2Pinned[vi - 1].pinIndex;
        if (targetPinIndex !== undefined) {
          return {
            type: 'reorder-pin',
            fromPinIndex: active.row.pinIndex,
            toPinIndex: targetPinIndex,
            nextActiveIdx: Math.max(0, activeIdx - 1),
          };
        }
      } else if (e.key === 'ArrowDown' && vi < view.band2Pinned.length - 1) {
        const targetPinIndex = view.band2Pinned[vi + 1].pinIndex;
        if (targetPinIndex !== undefined) {
          return {
            type: 'reorder-pin',
            fromPinIndex: active.row.pinIndex,
            toPinIndex: targetPinIndex,
            nextActiveIdx: activeIdx + 1,
          };
        }
      }
      return { type: 'consumed' };
    }
  }

  // Band 1 Ordinal Quick-Execute via Alt+1..Alt+5 when unsearched
  if (
    !inSecondaryInput &&
    view.kind === 'unsearched' &&
    e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.shiftKey
  ) {
    const m = /^Digit([1-5])$/.exec(e.code) ?? /^([1-5])$/.exec(e.key);
    if (m) {
      const slot = Number(m[1]) - 1;
      const target = view.band1Deck[slot];
      if (target) {
        return { type: 'exec-row', row: target };
      }
    }
  }

  if (!inSecondaryInput && e.key === 'ArrowDown') {
    return {
      type: 'set-active',
      nextActiveIdx: allNavigable.length > 0 ? Math.min(activeIdx + 1, allNavigable.length - 1) : 0,
    };
  }

  if (!inSecondaryInput && e.key === 'ArrowUp') {
    return {
      type: 'set-active',
      nextActiveIdx: allNavigable.length > 0 ? Math.max(activeIdx - 1, 0) : 0,
    };
  }

  if (e.key === 'Enter' && allNavigable[activeIdx]) {
    const tag = (e.target as { tagName?: string } | null)?.tagName?.toUpperCase();
    if (tag === 'BUTTON' || inSecondaryInput) return { type: 'none' };
    const item = allNavigable[activeIdx];
    return item.kind === 'row'
      ? { type: 'exec-row', row: item.row }
      : { type: 'exec-macro', macro: item.macro };
  }

  return { type: 'none' };
}

/** Resolve source pin index during HTML5 pin drag-and-drop. */
export function resolvePinDropSourceIndex(
  dragPinIndex: number | null,
  transferText: string | undefined,
  targetStoreIdx: number,
): number | null {
  const from = dragPinIndex ?? (transferText !== undefined && transferText !== '' ? Number(transferText) : NaN);
  return Number.isInteger(from) && from !== targetStoreIdx ? from : null;
}

export interface SpeedPanelKeyDispatchEvent extends SpeedPanelKeyEventLike {
  preventDefault: () => void;
  stopPropagation: () => void;
}

/** Route a panel keydown event and execute its resolved Speed Panel action. */
export function dispatchSpeedPanelKeyAction(
  e: SpeedPanelKeyDispatchEvent,
  deps: {
    view: SpeedPanelView;
    allNavigable: readonly NavEntry[];
    activeIdx: number;
    closeSpeedPanel: () => void;
    reorderPin: (fromIndex: number, toIndex: number) => void;
    setActiveIdx: (nextIdx: number) => void;
    execute: (row: PaletteRow) => void;
    runMacro: (macro: SpeedPanelMacro) => void;
  },
): SpeedPanelKeyAction['type'] {
  const action = resolveSpeedPanelKeyAction(e, deps.view, deps.allNavigable, deps.activeIdx);
  switch (action.type) {
    case 'close':
      e.stopPropagation();
      deps.closeSpeedPanel();
      return action.type;
    case 'reorder-pin':
      e.preventDefault();
      e.stopPropagation();
      deps.reorderPin(action.fromPinIndex, action.toPinIndex);
      deps.setActiveIdx(action.nextActiveIdx);
      return action.type;
    case 'consumed':
      e.preventDefault();
      e.stopPropagation();
      return action.type;
    case 'set-active':
      e.preventDefault();
      e.stopPropagation();
      deps.setActiveIdx(action.nextActiveIdx);
      return action.type;
    case 'exec-row':
      e.preventDefault();
      e.stopPropagation();
      deps.execute(action.row);
      return action.type;
    case 'exec-macro':
      e.preventDefault();
      e.stopPropagation();
      deps.runMacro(action.macro);
      return action.type;
    case 'none':
      return action.type;
  }
}

export interface PinDragEventLike {
  preventDefault: () => void;
  dataTransfer?: {
    setData?: (format: string, data: string) => void;
    getData?: (format: string) => string;
  } | null;
}

/** Build drag-and-drop and edit-mode move handlers for a Band 2 pinned command row. */
export function buildPinRowHandlers(params: {
  storeIdx: number | undefined;
  prevStoreIdx: number | undefined;
  nextStoreIdx: number | undefined;
  dragPinIndex: number | null;
  setDragPinIndex: (idx: number | null) => void;
  reorderPin: (fromIndex: number, toIndex: number) => void;
}): {
  onDragStart?: (e: PinDragEventLike) => void;
  onDragOver?: (e: PinDragEventLike) => void;
  onDrop?: (e: PinDragEventLike) => void;
  onDragEnd: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
} {
  const { storeIdx, prevStoreIdx, nextStoreIdx, dragPinIndex, setDragPinIndex, reorderPin } = params;
  return {
    onDragStart: storeIdx !== undefined
      ? (e) => {
          setDragPinIndex(storeIdx);
          e.dataTransfer?.setData?.('text/plain', String(storeIdx));
        }
      : undefined,
    onDragOver: storeIdx !== undefined
      ? (e) => {
          if (dragPinIndex !== null) e.preventDefault();
        }
      : undefined,
    onDrop: storeIdx !== undefined
      ? (e) => {
          e.preventDefault();
          const from = resolvePinDropSourceIndex(dragPinIndex, e.dataTransfer?.getData?.('text/plain'), storeIdx);
          if (from !== null) reorderPin(from, storeIdx);
          setDragPinIndex(null);
        }
      : undefined,
    onDragEnd: () => setDragPinIndex(null),
    onMoveUp: storeIdx !== undefined && prevStoreIdx !== undefined ? () => reorderPin(storeIdx, prevStoreIdx) : undefined,
    onMoveDown: storeIdx !== undefined && nextStoreIdx !== undefined ? () => reorderPin(storeIdx, nextStoreIdx) : undefined,
  };
}

/** Execute a palette row (or toast its blocked reason) and record frecency/adaptive usage. */
export function executeSpeedPanelRow(
  row: PaletteRow,
  deps: {
    context: HitResult | null;
    query: string;
    executeCommand: (
      commandId: string,
      context: HitResult | null,
      stores: ExecuteStores,
      hotkeyCtx?: HotkeyContext,
    ) => ExecuteResult;
    stores: ExecuteStores;
    hotkeyCtx: HotkeyContext;
    closeSpeedPanel: () => void;
    recordCommandUsage: (commandId: string, query: string) => void;
    pushToast: (message: string, kind?: 'warning' | 'error' | 'info' | 'success') => void;
  },
): 'blocked' | 'closed' | 'kept-open' | 'error' {
  const cmd = row.command;
  const actionLabel = cmd.label ?? cmd.title;
  if (row.disabledReason !== null) {
    deps.pushToast(formatSpeedPanelFailure(actionLabel, row.disabledReason), 'warning');
    return 'blocked';
  }
  try {
    const result = deps.executeCommand(cmd.id, deps.context, deps.stores, deps.hotkeyCtx);
    return handleSpeedPanelExecuteResult(result, cmd.id, {
      closeSpeedPanel: deps.closeSpeedPanel,
      addRecent: (id) => deps.recordCommandUsage(id, deps.query),
      toast: deps.pushToast,
      actionLabel,
    });
  } catch (err) {
    console.error(`[SpeedPanel] Action "${cmd.id}" threw an error:`, err);
    const reason = err instanceof Error ? err.message : String(err);
    deps.pushToast(formatSpeedPanelFailure(actionLabel, reason), 'error');
    return 'error';
  }
}

/** Execute a Speed Panel macro and either report the aborted step or record usage and close. */
export function executeSpeedPanelMacro(
  macro: SpeedPanelMacro,
  deps: {
    context: HitResult | null;
    runMacroSteps: (
      macro: SpeedPanelMacro,
      context: HitResult | null,
      stores: ExecuteStores,
    ) => MacroExecutionResult;
    stores: ExecuteStores;
    setMacroStatus: (status: string | null) => void;
    recordCommandUsage: (commandId: string, query: string) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  const result = deps.runMacroSteps(macro, deps.context, deps.stores);
  if (result.abortedAt !== undefined) {
    deps.setMacroStatus(`Macro "${macro.name}" aborted at step ${result.abortedAt + 1}: ${result.reason}`);
    return false;
  }
  deps.recordCommandUsage('macro:' + macro.id, '');
  deps.closeSpeedPanel();
  return true;
}
