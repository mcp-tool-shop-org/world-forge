// speed-panel-ui.ts — pure view-model, key-routing, clamping, and execution helpers for SpeedPanel

import type { EditorCommand, HotkeyContext } from './command-registry.js';
import type { HitResult } from './hit-testing.js';
import type { MacroExecutionResult, SpeedPanelMacro } from './speed-panel-actions.js';
import type { ExecuteResult, ExecuteStores } from './speed-panel-execute.js';
import type { PaletteRow, SpeedPanelView } from './speed-panel-layout.js';
import { formatSpeedPanelFailure, handleSpeedPanelExecuteResult } from './panels/speed-panel-stores.js';
import {
  advanceStepChoice,
  openCommandStepFlow,
  popPanelStep,
  replayLastPanelAction,
  resolveTargetZoneIds,
  submitStepInput,
  type StepChoiceOption,
  type StepExecutionStores,
  type StepStackState,
} from './speed-panel-steps.js';
import type { LastPanelAction, SelectionSet } from './store/editor-store.js';
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
    if (view.repeatLastRow) {
      items.push({ kind: 'row', domId: 'wf-sp-opt-repeat-last', row: view.repeatLastRow });
    }
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
  | { type: 'open-scalar-pill'; commandId: string; domId?: string }
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

  if (e.key === 'Tab' && !inSecondaryInput && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const active = allNavigable[activeIdx];
    if (active?.kind === 'row' && active.row.command.id === 'set-elevation' && active.row.disabledReason === null) {
      return { type: 'open-scalar-pill', commandId: 'set-elevation', domId: active.domId };
    }
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
    openScalarPill?: (commandId: string, domId?: string) => void;
  },
): SpeedPanelKeyAction['type'] {
  const action = resolveSpeedPanelKeyAction(e, deps.view, deps.allNavigable, deps.activeIdx);
  switch (action.type) {
    case 'close':
      e.stopPropagation();
      deps.closeSpeedPanel();
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
    deps.stepStores.setLastPanelAction({
      commandId: cmd.id,
      label: actionLabel,
      timestamp: Date.now(),
    });
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
      recordCommandUsage: deps.recordCommandUsage,
      closeSpeedPanel: deps.closeSpeedPanel,
    });

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
      closeSpeedPanel: deps.closeSpeedPanel,
      reorderPin: deps.reorderPin,
      setActiveIdx: deps.setActiveIdx,
      execute,
      runMacro,
      openScalarPill,
    });
  };

  return {
    execute,
    openScalarPill,
    onSelectStepOption,
    onSubmitStep,
    onStepBack,
    runMacro,
    scalarPropsFor,
    handleKeyDown,
  };
}
