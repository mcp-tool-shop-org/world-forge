// speed-panel-ui.ts — pure view-model, key-routing, clamping, and execution helpers for SpeedPanel

import type { EditorCommand, HotkeyContext } from './command-registry.js';
import type { HitResult } from './hit-testing.js';
import type { MacroExecutionResult, SpeedPanelMacro } from './speed-panel-actions.js';
import type { ExecuteResult, ExecuteStores } from './speed-panel-execute.js';
import type { PaletteRow, SpeedPanelView } from './speed-panel-layout.js';
import { formatSpeedPanelFailure, handleSpeedPanelExecuteResult } from './panels/speed-panel-stores.js';
import {
  createMacroFromRecentEntries,
  executeMacroAtomic,
  validateMacroExecution,
  type MacroExecutionStores,
  type MacroMissingRefPrompt,
  type MacroReplacementMap,
} from './speed-panel-macros.js';
import {
  buildQuickFixStepView,
  openQuickFixFlow,
  selectQuickFixOption,
  stepBackQuickFixFlow,
  type QuickFixFlowState,
  type QuickFixRowView,
  type QuickFixSelectStores,
} from './speed-panel-quick-fix.js';
import {
  advanceStepChoice,
  formatMergeZonesUndoLabel,
  openCommandStepFlow,
  popPanelStep,
  replayLastPanelAction,
  resolveTargetZoneIds,
  submitStepInput,
  type StepChoiceOption,
  type StepExecutionStores,
  type StepStackState,
} from './speed-panel-steps.js';
import {
  emptySelection,
  isReplayableSessionAction,
  MAX_RECENT_PANEL_ACTIONS,
  type LastPanelAction,
  type SelectionSet,
  type SessionActionLogEntry,
} from './store/editor-store.js';
import type { WorldProject } from '@world-forge/schema';

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
  'create-macro-from-recent': '\u229E',
};

export const SP_HEADING_IDS = {
  band1: 'wf-sp-heading-band-1',
  band2: 'wf-sp-heading-band-2',
  band3: 'wf-sp-heading-band-3',
  band4Macros: 'wf-sp-heading-band-4-macros',
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

export interface NavEntryQuickFix {
  kind: 'quick-fix';
  domId: string;
  quickFix: QuickFixRowView;
}

export type NavEntry = NavEntryAction | NavEntryMacro | NavEntryQuickFix;

/** Flatten visible selectable rows and macros in exact keyboard navigation order. */
export function buildNavigableEntries(
  view: SpeedPanelView,
  collapsedGroups: ReadonlySet<string>,
): NavEntry[] {
  const items: NavEntry[] = [];
  if (view.kind === 'unsearched') {
    if (view.quickFix) {
      items.push({ kind: 'quick-fix', domId: 'wf-sp-opt-quick-fix', quickFix: view.quickFix });
    }
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
    if (view.repeatLastRow) {
      items.push({ kind: 'row', domId: 'wf-sp-opt-repeat-last', row: view.repeatLastRow });
    }
    view.band3Recents.forEach((row, i) => {
      items.push({ kind: 'row', domId: `wf-sp-opt-b3-${i}-${row.command.id}`, row });
    });
    view.band4Macros?.forEach((macro) => {
      items.push({ kind: 'macro', domId: `wf-sp-opt-b4-macro-${macro.id}`, macro });
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

/** Return the initial active navigation index (skipping optional Quick Fix at 0 so Band 1 slot 1 starts highlighted). */
export function getInitialActiveIndex(allNavigable: readonly NavEntry[]): number {
  return allNavigable.length > 1 && allNavigable[0]?.kind === 'quick-fix' ? 1 : 0;
}

/** Adjust `activeIdx` when the optional Quick Fix row at 0 appears or disappears while open. */
export function reconcileActiveIndexOnQuickFixChange(
  prevIdx: number,
  hadQuickFix: boolean,
  hasQuickFix: boolean,
  nextLength: number,
): number {
  if (nextLength <= 0) return 0;
  let shifted = prevIdx;
  if (hadQuickFix && !hasQuickFix) {
    shifted = prevIdx > 0 ? prevIdx - 1 : 0;
  } else if (!hadQuickFix && hasQuickFix) {
    shifted = prevIdx + 1;
  }
  return Math.min(Math.max(0, shifted), nextLength - 1);
}

/** Clamp `activeIdx` back into `[0, length)` after list length shrinks. */
export function clampActiveIndex(prev: number, length: number, fallback = 0): number {
  if (length === 0) return 0;
  return prev >= length ? Math.min(Math.max(0, fallback), length - 1) : prev;
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

/**
 * Return true when an event target is a Speed Panel scope chip button (`data-scope-chip="true"`
 * or `data-testid="wf-sp-scope-chip-*"`), allowing `Tab` / `Shift+Tab` to leave the chip row cleanly.
 */
export function isScopeChipElement(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const el = target as {
    getAttribute?: (name: string) => string | null;
    dataset?: { scopeChip?: string; testid?: string };
  };
  const scopeAttr =
    (typeof el.getAttribute === 'function' ? el.getAttribute('data-scope-chip') : null) ??
    el.dataset?.scopeChip ??
    null;
  if (scopeAttr === 'true') return true;
  const testId =
    (typeof el.getAttribute === 'function' ? el.getAttribute('data-testid') : null) ??
    el.dataset?.testid ??
    null;
  return typeof testId === 'string' && testId.startsWith('wf-sp-scope-chip-');
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
  | { type: 'cycle-scope'; direction: 1 | -1 }
  | { type: 'open-scalar-pill'; commandId: string; domId?: string }
  | { type: 'reorder-pin'; fromPinIndex: number; toPinIndex: number; nextActiveIdx: number }
  | { type: 'exec-row'; row: PaletteRow }
  | { type: 'exec-macro'; macro: SpeedPanelMacro }
  | { type: 'open-quick-fix'; quickFix: QuickFixRowView }
  | { type: 'set-active'; nextActiveIdx: number };

/** Pure keyboard router for SpeedPanel. Keeps shortcuts dead while editing group/macro inputs. */
export function resolveSpeedPanelKeyAction(
  e: SpeedPanelKeyEventLike,
  view: SpeedPanelView,
  allNavigable: readonly NavEntry[],
  activeIdx: number,
  options?: { query?: string; hasScopeChips?: boolean },
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

  const inScopeChip = isScopeChipElement(e.target);

  if (e.key === 'Tab' && !inSecondaryInput && !inScopeChip && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const active = allNavigable[activeIdx];
    if (active?.kind === 'row' && active.row.command.id === 'set-elevation' && active.row.disabledReason === null) {
      return { type: 'open-scalar-pill', commandId: 'set-elevation', domId: active.domId };
    }
  }

  if (
    e.key === 'Tab' &&
    !inSecondaryInput &&
    !inScopeChip &&
    !e.ctrlKey &&
    !e.altKey &&
    !e.metaKey &&
    options?.hasScopeChips &&
    (options.query ?? '').trim() === ''
  ) {
    return { type: 'cycle-scope', direction: e.shiftKey ? -1 : 1 };
  }

  if (e.key === 'Enter' && allNavigable[activeIdx]) {
    const tag = (e.target as { tagName?: string } | null)?.tagName?.toUpperCase();
    if (tag === 'BUTTON' || inSecondaryInput) return { type: 'none' };
    const item = allNavigable[activeIdx];
    if (item.kind === 'quick-fix') {
      return { type: 'open-quick-fix', quickFix: item.quickFix };
    }
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
    query?: string;
    hasScopeChips?: boolean;
    cycleScope?: (direction: 1 | -1) => void;
    closeSpeedPanel: () => void;
    reorderPin: (fromIndex: number, toIndex: number) => void;
    setActiveIdx: (nextIdx: number) => void;
    execute: (row: PaletteRow) => void;
    runMacro: (macro: SpeedPanelMacro) => void;
    openScalarPill?: (commandId: string, domId?: string) => void;
    openQuickFix?: (quickFix: QuickFixRowView) => void;
  },
): SpeedPanelKeyAction['type'] {
  const action = resolveSpeedPanelKeyAction(e, deps.view, deps.allNavigable, deps.activeIdx, {
    query: deps.query,
    hasScopeChips: deps.hasScopeChips,
  });
  switch (action.type) {
    case 'close':
      e.stopPropagation();
      deps.closeSpeedPanel();
      return action.type;
    case 'cycle-scope':
      e.preventDefault();
      e.stopPropagation();
      deps.cycleScope?.(action.direction);
      return action.type;
    case 'open-scalar-pill':
      e.preventDefault();
      e.stopPropagation();
      deps.openScalarPill?.(action.commandId, action.domId);
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
    case 'open-quick-fix':
      e.preventDefault();
      e.stopPropagation();
      deps.openQuickFix?.(action.quickFix);
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

export interface CreateMacroViewState {
  entries: SessionActionLogEntry[];
  selectedIds: string[];
  name: string;
  pinToPanel: boolean;
  error: string | null;
}

/** Build initial state for inline "Create Macro from Recent Actions…" panel view. */
export function openCreateMacroState(entries: readonly SessionActionLogEntry[]): CreateMacroViewState {
  const replayable = entries
    .filter((e) => isReplayableSessionAction(e.commandId, e.args))
    .slice(0, MAX_RECENT_PANEL_ACTIONS);
  return {
    entries: replayable,
    selectedIds: replayable.map((e) => e.id),
    name: '',
    pinToPanel: true,
    error: null,
  };
}

/** Toggle selection of a single session log entry inside the inline macro creator. */
export function toggleCreateMacroSelection(
  state: CreateMacroViewState,
  entryId: string,
): CreateMacroViewState {
  const exists = state.selectedIds.includes(entryId);
  return {
    ...state,
    selectedIds: exists
      ? state.selectedIds.filter((id) => id !== entryId)
      : [...state.selectedIds, entryId],
    error: null,
  };
}

/** Validate and save the created macro to `useSpeedPanelPins`, preserving pane focus cleanly. */
export function submitCreateMacroState(
  state: CreateMacroViewState,
  deps: {
    addMacro: (macro: SpeedPanelMacro) => void;
    setCreateMacroState: (next: CreateMacroViewState | null) => void;
    setMacroStatus: (status: string | null) => void;
    refocusSearch?: () => void;
  },
): SpeedPanelMacro | null {
  const res = createMacroFromRecentEntries(
    state.name,
    state.entries,
    new Set(state.selectedIds),
    { pinned: state.pinToPanel },
  );
  if (!res.ok) {
    deps.setCreateMacroState({ ...state, error: res.error });
    return null;
  }
  deps.addMacro(res.macro);
  deps.setCreateMacroState(null);
  deps.setMacroStatus(`Saved macro "${res.macro.name}"`);
  deps.refocusSearch?.();
  return res.macro;
}

export interface MacroReplaceFlowState {
  macro: SpeedPanelMacro;
  context: HitResult | null;
  missingRefs: MacroMissingRefPrompt[];
  currentIndex: number;
  replacements: MacroReplacementMap;
  filter: string;
  activeIdx: number;
}

/** Project the active missing-reference prompt into a `StepStackState` so SpeedPanelStepView can render it. */
export function buildMacroReplaceStepView(flow: MacroReplaceFlowState): {
  stepStack: StepStackState;
  currentPrompt: MacroMissingRefPrompt;
} {
  const currentPrompt = flow.missingRefs[flow.currentIndex];
  return {
    currentPrompt,
    stepStack: {
      commandId: 'macro:' + flow.macro.id,
      commandLabel: flow.macro.name,
      context: flow.context,
      targetZoneIds: [],
      steps: [
        {
          kind: 'choice',
          stepId: 'macro-replace-ref',
          title: currentPrompt.title,
          placeholder: 'Filter replacement\u2026',
          options: currentPrompt.options,
        },
      ],
      error: null,
    },
  };
}

/** Advance or finish the inline macro missing-ID replacement prompt flow. */
export function selectMacroReplacementOption(
  flow: MacroReplaceFlowState,
  option: StepChoiceOption,
  deps: {
    stores: ExecuteStores;
    runMacroSteps: (
      macro: SpeedPanelMacro,
      context: HitResult | null,
      stores: ExecuteStores,
      replacements?: MacroReplacementMap,
    ) => MacroExecutionResult;
    setMacroReplaceFlow: (next: MacroReplaceFlowState | null) => void;
    setMacroStatus: (status: string | null) => void;
    recordCommandUsage: (id: string, query: string) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  const prompt = flow.missingRefs[flow.currentIndex];
  if (!prompt) return false;
  const nextReplacements: MacroReplacementMap =
    prompt.key === 'target-zone'
      ? { ...flow.replacements, targetZoneId: option.id }
      : {
          ...flow.replacements,
          byStepKey: { ...(flow.replacements.byStepKey ?? {}), [prompt.key]: option.id },
        };

  if (flow.currentIndex + 1 < flow.missingRefs.length) {
    deps.setMacroReplaceFlow({
      ...flow,
      currentIndex: flow.currentIndex + 1,
      replacements: nextReplacements,
      filter: '',
      activeIdx: 0,
    });
    return false;
  }

  deps.setMacroReplaceFlow(null);
  const result = deps.stores.updateProject
    ? executeMacroAtomic(
        flow.macro,
        flow.context,
        { ...deps.stores, updateProject: deps.stores.updateProject } as MacroExecutionStores,
        nextReplacements,
      )
    : deps.runMacroSteps(flow.macro, flow.context, deps.stores, nextReplacements);

  if (result.abortedAt !== undefined) {
    deps.setMacroStatus(`Macro "${flow.macro.name}" aborted at step ${result.abortedAt + 1}: ${result.reason}`);
    return false;
  }
  deps.recordCommandUsage('macro:' + flow.macro.id, '');
  deps.closeSpeedPanel();
  return true;
}

/** Step back within the macro missing-ID replacement prompt flow or return cleanly to the root palette. */
export function stepBackMacroReplaceFlow(
  flow: MacroReplaceFlowState,
  deps: {
    setMacroReplaceFlow: (next: MacroReplaceFlowState | null) => void;
    refocusSearch?: () => void;
  },
): void {
  if (flow.currentIndex <= 0) {
    deps.setMacroReplaceFlow(null);
    deps.refocusSearch?.();
    return;
  }
  deps.setMacroReplaceFlow({
    ...flow,
    currentIndex: flow.currentIndex - 1,
    filter: '',
    activeIdx: 0,
  });
}

/** Execute a Speed Panel macro and either open replacement prompts, report failure, or commit and close. */
export function executeSpeedPanelMacro(
  macro: SpeedPanelMacro,
  deps: {
    context: HitResult | null;
    runMacroSteps: (
      macro: SpeedPanelMacro,
      context: HitResult | null,
      stores: ExecuteStores,
      replacements?: MacroReplacementMap,
    ) => MacroExecutionResult;
    stores: ExecuteStores;
    setMacroStatus: (status: string | null) => void;
    setMacroReplaceFlow?: (next: MacroReplaceFlowState | null) => void;
    recordCommandUsage: (commandId: string, query: string) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  if (deps.stores.updateProject) {
    const validation = validateMacroExecution(
      macro,
      deps.stores.project,
      deps.stores.regionPresets ?? [],
      deps.stores.encounterPresets ?? [],
      deps.context,
      deps.stores.selection ?? emptySelection(),
    );
    if (!validation.ok) {
      if (validation.missingRefs.length > 0 && deps.setMacroReplaceFlow) {
        deps.setMacroReplaceFlow({
          macro,
          context: deps.context,
          missingRefs: validation.missingRefs,
          currentIndex: 0,
          replacements: {},
          filter: '',
          activeIdx: 0,
        });
        return false;
      }
      deps.setMacroStatus(`Macro "${macro.name}": ${validation.error ?? 'cannot execute in this context'}`);
      return false;
    }
  }
  const result = deps.runMacroSteps(macro, deps.context, deps.stores);
  if (result.abortedAt !== undefined) {
    deps.setMacroStatus(`Macro "${macro.name}" aborted at step ${result.abortedAt + 1}: ${result.reason}`);
    return false;
  }
  deps.recordCommandUsage('macro:' + macro.id, '');
  deps.closeSpeedPanel();
  return true;
}

/** Filter active choice-step options case-insensitively by label or description, keeping `+ Create` visible. */
export function filterStepOptions(
  options: readonly StepChoiceOption[],
  filterQuery: string,
): StepChoiceOption[] {
  const q = filterQuery.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter(
    (opt) =>
      opt.kind === 'create' ||
      opt.label.toLowerCase().includes(q) ||
      (opt.description?.toLowerCase().includes(q) ?? false) ||
      (opt.badge?.text.toLowerCase().includes(q) ?? false),
  );
}

export type StepKeyAction =
  | { type: 'none' }
  | { type: 'cancel' }
  | { type: 'back' }
  | { type: 'set-active'; nextIdx: number }
  | { type: 'choose'; option: StepChoiceOption }
  | { type: 'submit-input' };

/** Pure keyboard router while inside an active C4 panel step. */
export function resolveStepKeyAction(
  e: SpeedPanelKeyEventLike,
  flow: StepStackState,
  filteredOptions: readonly StepChoiceOption[],
  activeStepIdx: number,
  stepFilter: string,
): StepKeyAction {
  const current = flow.steps[flow.steps.length - 1];
  if (!current) return { type: 'none' };
  if (e.key === 'Escape') {
    return { type: 'cancel' };
  }
  if (e.altKey && e.key === 'ArrowLeft') {
    return { type: 'back' };
  }
  if (e.key === 'Backspace' && stepFilter === '') {
    return { type: 'back' };
  }
  if (current.kind === 'choice') {
    if (e.key === 'ArrowDown') {
      return {
        type: 'set-active',
        nextIdx: filteredOptions.length > 0 ? (activeStepIdx + 1) % filteredOptions.length : 0,
      };
    }
    if (e.key === 'ArrowUp') {
      return {
        type: 'set-active',
        nextIdx: filteredOptions.length > 0
          ? (activeStepIdx - 1 + filteredOptions.length) % filteredOptions.length
          : 0,
      };
    }
    if (e.key === 'Enter' && filteredOptions[activeStepIdx]) {
      return { type: 'choose', option: filteredOptions[activeStepIdx] };
    }
  } else if (e.key === 'Enter') {
    return { type: 'submit-input' };
  }
  return { type: 'none' };
}

/** Dispatch keyboard navigation inside a multi-step view cleanly. */
export function dispatchStepKeyAction(
  e: SpeedPanelKeyDispatchEvent,
  deps: {
    flow: StepStackState;
    filteredOptions: readonly StepChoiceOption[];
    activeStepIdx: number;
    stepFilter: string;
    onCancel: () => void;
    onBack: () => void;
    onSetActiveIdx: (idx: number) => void;
    onSelectOption: (opt: StepChoiceOption) => void;
    onSubmitInput: () => void;
  },
): StepKeyAction['type'] {
  const action = resolveStepKeyAction(e, deps.flow, deps.filteredOptions, deps.activeStepIdx, deps.stepFilter);
  switch (action.type) {
    case 'cancel':
      e.preventDefault();
      e.stopPropagation();
      deps.onCancel();
      return action.type;
    case 'back':
      e.preventDefault();
      e.stopPropagation();
      deps.onBack();
      return action.type;
    case 'set-active':
      e.preventDefault();
      e.stopPropagation();
      deps.onSetActiveIdx(action.nextIdx);
      return action.type;
    case 'choose':
      e.preventDefault();
      e.stopPropagation();
      deps.onSelectOption(action.option);
      return action.type;
    case 'submit-input':
      e.preventDefault();
      e.stopPropagation();
      deps.onSubmitInput();
      return action.type;
    case 'none':
      return action.type;
  }
}

/**
 * Unified C4 Speed Panel row executor:
 * - Intercepts `repeat-last` (replay recorded parameterized/direct action)
 * - Opens inline multi-step flows or canvas spatial pick sessions
 * - Otherwise executes direct registry command and records `lastPanelAction`.
 */
export function executeSpeedPanelRowOrStep(
  row: PaletteRow,
  deps: {
    context: HitResult | null;
    query: string;
    lastPanelAction: LastPanelAction | null;
    executeCommand: (
      commandId: string,
      context: HitResult | null,
      stores: ExecuteStores,
      hotkeyCtx?: HotkeyContext,
    ) => ExecuteResult;
    stores: ExecuteStores;
    stepStores: StepExecutionStores;
    hotkeyCtx: HotkeyContext;
    closeSpeedPanel: () => void;
    setStepFlow: (flow: StepStackState | null) => void;
    setStepFilter: (value: string) => void;
    setStepActiveIdx: (idx: number) => void;
    onOpenCreateMacro?: () => void;
    recordCommandUsage: (commandId: string, query: string) => void;
    pushToast: (message: string, kind?: 'warning' | 'error' | 'info' | 'success') => void;
  },
): 'blocked' | 'steps' | 'pick' | 'closed' | 'kept-open' | 'error' {
  const cmd = row.command;
  const actionLabel = cmd.label ?? cmd.title;

  if (row.disabledReason !== null) {
    deps.pushToast(formatSpeedPanelFailure(actionLabel, row.disabledReason), 'warning');
    return 'blocked';
  }

  if (cmd.id === 'create-macro-from-recent') {
    deps.onOpenCreateMacro?.();
    return 'kept-open';
  }

  if (cmd.id === 'repeat-last') {
    if (!deps.lastPanelAction) {
      deps.pushToast('No recent Speed Panel action to repeat.', 'warning');
      return 'blocked';
    }
    const replay = replayLastPanelAction(deps.lastPanelAction, deps.context, deps.stepStores, {
      executeStores: deps.stores,
      hotkeyCtx: deps.hotkeyCtx,
      executeDirect: deps.executeCommand,
    });
    if (replay.status === 'pick') {
      deps.stepStores.setSpeedPanelPick(replay.pick);
      deps.recordCommandUsage(deps.lastPanelAction.commandId, deps.query);
      deps.closeSpeedPanel();
      return 'pick';
    }
    if (replay.status === 'error') {
      deps.pushToast(replay.message, 'warning');
      return 'kept-open';
    }
    deps.stepStores.recordSessionAction?.({
      commandId: deps.lastPanelAction.commandId,
      label: deps.lastPanelAction.label,
      timestamp: Date.now(),
      ...(deps.lastPanelAction.params ? { args: deps.lastPanelAction.params } : {}),
    });
    deps.recordCommandUsage(deps.lastPanelAction.commandId, deps.query);
    deps.closeSpeedPanel();
    return 'closed';
  }

  const opened = openCommandStepFlow(cmd.id, deps.context, deps.stepStores);
  if (opened.kind === 'steps') {
    deps.setStepFilter('');
    deps.setStepActiveIdx(0);
    deps.setStepFlow(opened.flow);
    return 'steps';
  }
  if (opened.kind === 'pick') {
    deps.stepStores.setSpeedPanelPick(opened.pick);
    deps.closeSpeedPanel();
    return 'pick';
  }
  if (opened.kind === 'blocked') {
    deps.pushToast(formatSpeedPanelFailure(actionLabel, opened.reason), 'warning');
    return 'blocked';
  }

  if (cmd.id === 'merge-zones' && deps.stepStores.selection.zones.length >= 2) {
    const selectedZoneIds = [...deps.stepStores.selection.zones];
    const mergeLabel = formatMergeZonesUndoLabel(selectedZoneIds, deps.stepStores.project);
    const mergedId = deps.stepStores.mergeZones(selectedZoneIds, mergeLabel);
    if (!mergedId) {
      deps.pushToast(formatSpeedPanelFailure(actionLabel, 'Could not merge zones'), 'warning');
      return 'blocked';
    }
    deps.stepStores.selectZone(mergedId, false);
    deps.stepStores.setLastPanelAction({
      commandId: 'merge-zones',
      label: mergeLabel,
      timestamp: Date.now(),
    });
    deps.recordCommandUsage('merge-zones', deps.query);
    deps.closeSpeedPanel();
    return 'closed';
  }

  const outcome = executeSpeedPanelRow(row, {
    context: deps.context,
    query: deps.query,
    executeCommand: deps.executeCommand,
    stores: deps.stores,
    hotkeyCtx: deps.hotkeyCtx,
    closeSpeedPanel: deps.closeSpeedPanel,
    recordCommandUsage: deps.recordCommandUsage,
    pushToast: deps.pushToast,
  });
  if (outcome === 'closed') {
    const finished = {
      commandId: cmd.id,
      label: actionLabel,
      timestamp: Date.now(),
    };
    deps.stepStores.setLastPanelAction(finished);
    deps.stepStores.recordSessionAction?.(finished);
  }
  return outcome;
}

/** Handle clicking or confirming an option inside an active C4 panel step. */
export function handleStepChoiceSelect(
  flow: StepStackState,
  option: StepChoiceOption,
  deps: {
    query: string;
    stepFilter?: string;
    stepStores: StepExecutionStores;
    setStepFlow: (next: StepStackState | null) => void;
    setStepFilter: (v: string) => void;
    setStepActiveIdx: (idx: number) => void;
    recordCommandUsage: (id: string, q: string) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  const res = advanceStepChoice(flow, option, deps.stepStores, deps.stepFilter);
  if (!res.done) {
    deps.setStepFilter('');
    deps.setStepActiveIdx(0);
    deps.setStepFlow(res.flow);
    return false;
  }
  deps.stepStores.setLastPanelAction(res.lastAction);
  deps.recordCommandUsage(res.commandId, deps.query);
  deps.setStepFlow(null);
  deps.closeSpeedPanel();
  return true;
}

/** Handle submitting the inline text/scalar input of the active C4 step. */
export function handleStepInputSubmit(
  flow: StepStackState,
  value: string,
  deps: {
    query: string;
    stepStores: StepExecutionStores;
    setStepFlow: (next: StepStackState | null) => void;
    recordCommandUsage: (id: string, q: string) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  const res = submitStepInput(flow, value, deps.stepStores);
  if (!res.done) {
    deps.setStepFlow(res.flow);
    return false;
  }
  deps.stepStores.setLastPanelAction(res.lastAction);
  deps.recordCommandUsage(res.commandId, deps.query);
  deps.setStepFlow(null);
  deps.closeSpeedPanel();
  return true;
}

/** Step Back one level or exit multi-step mode cleanly back to root palette. */
export function stepBackOrRoot(
  flow: StepStackState,
  deps: {
    setStepFlow: (next: StepStackState | null) => void;
    setStepFilter: (v: string) => void;
    setStepActiveIdx: (idx: number) => void;
  },
): void {
  deps.setStepFilter('');
  deps.setStepActiveIdx(0);
  deps.setStepFlow(popPanelStep(flow));
}

export interface ScalarPillState {
  commandId: 'set-elevation';
  domId?: string;
  targetZoneIds: string[];
  value: string;
  error: string | null;
}

/** Commit an inline `Tab`-activated scalar elevation pill value cleanly with validation and single undo. */
export function submitScalarPill(
  pill: ScalarPillState,
  deps: {
    query: string;
    stepStores: StepExecutionStores;
    setScalarPill: (next: ScalarPillState | null) => void;
    recordCommandUsage: (id: string, q: string) => void;
    closeSpeedPanel: () => void;
  },
): boolean {
  const res = submitStepInput(
    {
      commandId: pill.commandId,
      commandLabel: 'Set Elevation',
      context: null,
      targetZoneIds: pill.targetZoneIds,
      steps: [
        {
          kind: 'input',
          stepId: 'set-elevation',
          title: 'Set Elevation (m)',
          label: 'Elevation',
          placeholder: 'e.g. -5',
          value: pill.value,
          allowEmpty: true,
        },
      ],
      error: null,
    },
    pill.value,
    deps.stepStores,
  );
  if (!res.done) {
    deps.setScalarPill({ ...pill, error: res.flow.error });
    return false;
  }
  deps.stepStores.setLastPanelAction(res.lastAction);
  deps.recordCommandUsage('set-elevation', deps.query);
  deps.setScalarPill(null);
  deps.closeSpeedPanel();
  return true;
}

/** Route keys inside an inline `Tab` scalar pill (`Enter` commits, `Escape`/`Tab` returns to list). */
export function handleScalarPillKeyDown(
  e: { key: string; preventDefault: () => void; stopPropagation: () => void },
  pill: ScalarPillState,
  deps: {
    query: string;
    stepStores: StepExecutionStores;
    setScalarPill: (next: ScalarPillState | null) => void;
    recordCommandUsage: (id: string, q: string) => void;
    closeSpeedPanel: () => void;
    refocusSearch: () => void;
  },
): 'submit' | 'dismiss' | 'none' {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    submitScalarPill(pill, deps);
    return 'submit';
  }
  if (e.key === 'Escape' || e.key === 'Tab') {
    e.preventDefault();
    e.stopPropagation();
    deps.setScalarPill(null);
    deps.refocusSearch();
    return 'dismiss';
  }
  return 'none';
}

/** Build all interactive callbacks for `<SpeedPanel>` so JSX remains thin and handlers are directly testable. */
export function createSpeedPanelCallbacks<TRef = { current: { focus?: (opts?: { preventScroll?: boolean }) => void } | null }>(deps: {
  context: HitResult | null;
  selection: SelectionSet;
  zones: WorldProject['zones'];
  query: string;
  view: SpeedPanelView;
  allNavigable: readonly NavEntry[];
  activeIdx: number;
  lastPanelAction: LastPanelAction | null;
  stepFlow: StepStackState | null;
  filteredStepOptions: readonly StepChoiceOption[];
  stepActiveIdx: number;
  stepFilter: string;
  stepInputDraft: string;
  scalarPill: ScalarPillState | null;
  scalarPillRef: TRef;
  recentPanelActions?: readonly SessionActionLogEntry[];
  createMacroState?: CreateMacroViewState | null;
  setCreateMacroState?: (next: CreateMacroViewState | null) => void;
  addMacro?: (macro: SpeedPanelMacro) => void;
  macroReplaceFlow?: MacroReplaceFlowState | null;
  setMacroReplaceFlow?: (next: MacroReplaceFlowState | null) => void;
  quickFixFlow?: QuickFixFlowState | null;
  setQuickFixFlow?: (next: QuickFixFlowState | null) => void;
  hasScopeChips?: boolean;
  cycleScope?: (direction: 1 | -1) => void;
  executeCommand: (
    commandId: string,
    context: HitResult | null,
    stores: ExecuteStores,
    hotkeyCtx?: HotkeyContext,
  ) => ExecuteResult;
  runMacroSteps: (
    macro: SpeedPanelMacro,
    context: HitResult | null,
    stores: ExecuteStores,
    replacements?: MacroReplacementMap,
  ) => MacroExecutionResult;
  stores: ExecuteStores;
  stepStores: StepExecutionStores;
  hotkeyCtx: HotkeyContext;
  closeSpeedPanel: () => void;
  setActiveIdx: (idx: number) => void;
  reorderPin: (fromIndex: number, toIndex: number) => void;
  setStepFlow: (next: StepStackState | null) => void;
  setStepFilter: (v: string) => void;
  setStepActiveIdx: (idx: number) => void;
  setScalarPill: (updater: ScalarPillState | null | ((prev: ScalarPillState | null) => ScalarPillState | null)) => void;
  setMacroStatus: (status: string | null) => void;
  recordCommandUsage: (id: string, q: string) => void;
  pushToast: (message: string, kind?: 'warning' | 'error' | 'info' | 'success') => void;
  refocusSearch: () => void;
}) {
  const onOpenCreateMacro = () => {
    deps.setMacroStatus(null);
    deps.setCreateMacroState?.(openCreateMacroState(deps.recentPanelActions ?? []));
  };

  const execute = (row: PaletteRow) =>
    executeSpeedPanelRowOrStep(row, {
      context: deps.context,
      query: deps.query,
      lastPanelAction: deps.lastPanelAction,
      executeCommand: deps.executeCommand,
      stores: deps.stores,
      stepStores: deps.stepStores,
      hotkeyCtx: deps.hotkeyCtx,
      closeSpeedPanel: deps.closeSpeedPanel,
      setStepFlow: deps.setStepFlow,
      setStepFilter: deps.setStepFilter,
      setStepActiveIdx: deps.setStepActiveIdx,
      onOpenCreateMacro,
      recordCommandUsage: deps.recordCommandUsage,
      pushToast: deps.pushToast,
    });

  const openScalarPill = (commandId: string, domId?: string) => {
    if (commandId !== 'set-elevation') return;
    const zoneIds = resolveTargetZoneIds(deps.context, deps.selection);
    if (zoneIds.length === 0) return;
    const zone = deps.zones.find((z) => z.id === zoneIds[0]);
    deps.setScalarPill({
      commandId: 'set-elevation',
      domId,
      targetZoneIds: zoneIds,
      value: zone?.elevation !== undefined ? String(zone.elevation) : '',
      error: null,
    });
  };

  const onSelectStepOption = (option: StepChoiceOption) => {
    if (!deps.stepFlow) return;
    handleStepChoiceSelect(deps.stepFlow, option, {
      query: deps.query,
      stepFilter: deps.stepFilter,
      stepStores: deps.stepStores,
      setStepFlow: deps.setStepFlow,
      setStepFilter: deps.setStepFilter,
      setStepActiveIdx: deps.setStepActiveIdx,
      recordCommandUsage: deps.recordCommandUsage,
      closeSpeedPanel: deps.closeSpeedPanel,
    });
  };

  const onSubmitStep = () => {
    if (!deps.stepFlow) return;
    handleStepInputSubmit(deps.stepFlow, deps.stepInputDraft, {
      query: deps.query,
      stepStores: deps.stepStores,
      setStepFlow: deps.setStepFlow,
      recordCommandUsage: deps.recordCommandUsage,
      closeSpeedPanel: deps.closeSpeedPanel,
    });
  };

  const onStepBack = () => {
    if (!deps.stepFlow) return;
    stepBackOrRoot(deps.stepFlow, {
      setStepFlow: deps.setStepFlow,
      setStepFilter: deps.setStepFilter,
      setStepActiveIdx: deps.setStepActiveIdx,
    });
    if (deps.stepFlow.steps.length <= 1) {
      deps.refocusSearch();
    }
  };

  const runMacro = (macro: SpeedPanelMacro) =>
    executeSpeedPanelMacro(macro, {
      context: deps.context,
      runMacroSteps: deps.runMacroSteps,
      stores: deps.stores,
      setMacroStatus: deps.setMacroStatus,
      setMacroReplaceFlow: deps.setMacroReplaceFlow,
      recordCommandUsage: deps.recordCommandUsage,
      closeSpeedPanel: deps.closeSpeedPanel,
    });

  const onSelectReplaceOption = (option: StepChoiceOption) => {
    if (!deps.macroReplaceFlow || !deps.setMacroReplaceFlow) return;
    selectMacroReplacementOption(deps.macroReplaceFlow, option, {
      stores: deps.stores,
      runMacroSteps: deps.runMacroSteps,
      setMacroReplaceFlow: deps.setMacroReplaceFlow,
      setMacroStatus: deps.setMacroStatus,
      recordCommandUsage: deps.recordCommandUsage,
      closeSpeedPanel: deps.closeSpeedPanel,
    });
  };

  const onStepBackReplace = () => {
    if (!deps.macroReplaceFlow || !deps.setMacroReplaceFlow) return;
    stepBackMacroReplaceFlow(deps.macroReplaceFlow, {
      setMacroReplaceFlow: deps.setMacroReplaceFlow,
      refocusSearch: deps.refocusSearch,
    });
  };

  const onOpenQuickFix = (quickFix: QuickFixRowView) => {
    if (!deps.context || !deps.setQuickFixFlow) return;
    deps.setQuickFixFlow(openQuickFixFlow(deps.context, quickFix.problems, deps.stores.project));
  };

  const onSelectQuickFixOption = (option: StepChoiceOption) => {
    if (!deps.quickFixFlow || !deps.setQuickFixFlow || !deps.stores.updateProject) return;
    selectQuickFixOption(deps.quickFixFlow, option, {
      stores: deps.stores as QuickFixSelectStores & {
        updateProject: (updater: (p: WorldProject) => WorldProject, label?: string) => void;
      },
      setQuickFixFlow: deps.setQuickFixFlow,
      closeSpeedPanel: deps.closeSpeedPanel,
    });
  };

  const onStepBackQuickFix = () => {
    if (!deps.quickFixFlow || !deps.setQuickFixFlow) return;
    stepBackQuickFixFlow(deps.quickFixFlow, {
      setQuickFixFlow: deps.setQuickFixFlow,
      refocusSearch: deps.refocusSearch,
    });
  };

  const scalarPropsFor = (row: PaletteRow, domId: string) => {
    if (row.command.id !== 'set-elevation' || row.disabledReason !== null) return {};
    const activeHere = deps.scalarPill !== null && (!deps.scalarPill.domId || deps.scalarPill.domId === domId);
    return {
      scalarPill: activeHere ? deps.scalarPill : null,
      scalarPillRef: activeHere ? deps.scalarPillRef : undefined,
      onScalarPillOpen: () => openScalarPill('set-elevation', domId),
      onScalarPillChange: (val: string) =>
        deps.setScalarPill((prev) => (prev ? { ...prev, value: val, error: null } : null)),
      onScalarPillKeyDown: (e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
        if (!deps.scalarPill) return;
        handleScalarPillKeyDown(e, deps.scalarPill, {
          query: deps.query,
          stepStores: deps.stepStores,
          setScalarPill: (next) => deps.setScalarPill(next),
          recordCommandUsage: deps.recordCommandUsage,
          closeSpeedPanel: deps.closeSpeedPanel,
          refocusSearch: deps.refocusSearch,
        });
      },
    };
  };

  const handleKeyDown = (e: SpeedPanelKeyDispatchEvent) => {
    if (deps.createMacroState) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        deps.setCreateMacroState?.(null);
        deps.closeSpeedPanel();
      }
      return;
    }
    if (deps.macroReplaceFlow && deps.setMacroReplaceFlow) {
      const replaceFlow = deps.macroReplaceFlow;
      const setMacroReplaceFlow = deps.setMacroReplaceFlow;
      const replaceView = buildMacroReplaceStepView(replaceFlow);
      const filteredReplaceOptions = filterStepOptions(
        replaceView.currentPrompt.options,
        replaceFlow.filter,
      );
      dispatchStepKeyAction(e, {
        flow: replaceView.stepStack,
        filteredOptions: filteredReplaceOptions,
        activeStepIdx: replaceFlow.activeIdx,
        stepFilter: replaceFlow.filter,
        onCancel: () => {
          setMacroReplaceFlow(null);
          deps.closeSpeedPanel();
        },
        onBack: onStepBackReplace,
        onSetActiveIdx: (idx) => {
          setMacroReplaceFlow({ ...replaceFlow, activeIdx: idx });
        },
        onSelectOption: onSelectReplaceOption,
        onSubmitInput: () => {},
      });
      return;
    }
    if (deps.quickFixFlow && deps.setQuickFixFlow) {
      const qfFlow = deps.quickFixFlow;
      const setQuickFixFlow = deps.setQuickFixFlow;
      const qfView = buildQuickFixStepView(qfFlow);
      const activeStep = qfView.stepStack.steps[qfView.stepStack.steps.length - 1];
      const options = activeStep?.kind === 'choice' ? activeStep.options : [];
      const filteredQfOptions = filterStepOptions(options, qfFlow.filter);
      dispatchStepKeyAction(e, {
        flow: qfView.stepStack,
        filteredOptions: filteredQfOptions,
        activeStepIdx: qfFlow.activeIdx,
        stepFilter: qfFlow.filter,
        onCancel: () => {
          setQuickFixFlow(null);
          deps.closeSpeedPanel();
        },
        onBack: onStepBackQuickFix,
        onSetActiveIdx: (idx) => {
          setQuickFixFlow({ ...qfFlow, activeIdx: idx });
        },
        onSelectOption: onSelectQuickFixOption,
        onSubmitInput: () => {},
      });
      return;
    }
    if (deps.stepFlow) {
      const currentStep = deps.stepFlow.steps[deps.stepFlow.steps.length - 1];
      const activeText = currentStep?.kind === 'input' ? deps.stepInputDraft : deps.stepFilter;
      dispatchStepKeyAction(e, {
        flow: deps.stepFlow,
        filteredOptions: deps.filteredStepOptions,
        activeStepIdx: deps.stepActiveIdx,
        stepFilter: activeText,
        onCancel: deps.closeSpeedPanel,
        onBack: onStepBack,
        onSetActiveIdx: deps.setStepActiveIdx,
        onSelectOption: onSelectStepOption,
        onSubmitInput: onSubmitStep,
      });
      return;
    }
    dispatchSpeedPanelKeyAction(e, {
      view: deps.view,
      allNavigable: deps.allNavigable,
      activeIdx: deps.activeIdx,
      query: deps.query,
      hasScopeChips: deps.hasScopeChips,
      cycleScope: deps.cycleScope,
      closeSpeedPanel: deps.closeSpeedPanel,
      reorderPin: deps.reorderPin,
      setActiveIdx: deps.setActiveIdx,
      execute,
      runMacro,
      openScalarPill,
      openQuickFix: onOpenQuickFix,
    });
  };

  return {
    execute,
    openScalarPill,
    onSelectStepOption,
    onSubmitStep,
    onStepBack,
    runMacro,
    onSelectReplaceOption,
    onStepBackReplace,
    onOpenQuickFix,
    onSelectQuickFixOption,
    onStepBackQuickFix,
    scalarPropsFor,
    handleKeyDown,
  };
}
