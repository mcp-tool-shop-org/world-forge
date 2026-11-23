// SpeedPanel.tsx — floating pointer-anchored command palette with Four-Band layout & tiered search

import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { notifySpeedPanelLoadWarnings, useSpeedPanelPins } from '../store/speed-panel-store.js';
import {
  COMMAND_REGISTRY,
  type CommandBadge,
} from '../command-registry.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import {
  SPEED_PANEL_ACTIONS,
} from '../speed-panel-actions.js';
import { getMacroStepCommandId, type SpeedPanelMacro } from '../speed-panel-actions.js';
import {
  buildSpeedPanelView,
  type PaletteRow,
  type SearchedPaletteRow,
} from '../speed-panel-layout.js';
import type { MatchedText } from '../speed-panel-search.js';
import { executeRegistryCommand, executeMacro } from '../speed-panel-execute.js';
import {
  productionExecuteStores,
  productionHotkeyContext,
  productionStepStores,
} from './speed-panel-stores.js';
import {
  buildQuickFixStepView,
  getProblemsForObject,
  type QuickFixFlowState,
} from '../speed-panel-quick-fix.js';
import {
  createRepeatLastCommand,
  type StepChoiceOption,
  type StepStackState,
} from '../speed-panel-steps.js';
import {
  SP_HEADING_IDS,
  buildMacroReplaceStepView,
  buildNavigableEntries,
  buildPinRowHandlers,
  catalogueGroupHeadingId,
  clampActiveIndex,
  commandGlyph,
  computeEdgeClampedOffset,
  createSpeedPanelCallbacks,
  customGroupHeadingId,
  filterStepOptions,
  splitHighlightSegments,
  submitCreateMacroState,
  toggleCreateMacroSelection,
  type CreateMacroViewState,
  type MacroReplaceFlowState,
  type NavEntry,
  type ScalarPillState,
} from '../speed-panel-ui.js';
import { pushToast } from '../ui/Toast.js';
import { EmptyState } from './shared.js';

const SECTION_STYLE: React.CSSProperties = {
  padding: 'var(--wf-space-1) var(--wf-space-2)',
  fontSize: 10,
  color: 'var(--wf-text-muted)',
  letterSpacing: 0.5,
  textTransform: 'uppercase',
};

export interface SpeedPanelProps {
  onSave?: () => void;
  initialQuery?: string;
  initialExpandedMacro?: string | null;
  initialMacroStatus?: string | null;
  initialCollapsedGroups?: readonly string[];
  initialStepFlow?: StepStackState | null;
  initialScalarPill?: ScalarPillState | null;
  initialCreateMacroState?: CreateMacroViewState | null;
  initialMacroReplaceFlow?: MacroReplaceFlowState | null;
  initialQuickFixFlow?: QuickFixFlowState | null;
}

export function SpeedPanel({
  onSave,
  initialQuery = '',
  initialExpandedMacro = null,
  initialMacroStatus = null,
  initialCollapsedGroups = [],
  initialStepFlow = null,
  initialScalarPill = null,
  initialCreateMacroState = null,
  initialMacroReplaceFlow = null,
  initialQuickFixFlow = null,
}: SpeedPanelProps) {
  const {
    speedPanelPosition,
    speedPanelContext,
    closeSpeedPanel,
    speedPanelEditMode,
    toggleSpeedPanelEditMode,
    selection,
    selectedConnection,
    lastPanelAction,
    recentPanelActions,
  } = useEditorStore();
  const { project } = useProjectStore();
  const {
    pinnedIds,
    togglePin,
    reorderPin,
    recordCommandUsage,
    recentIds,
    frecency,
    adaptiveHistory,
    showRecents,
    groups,
    addGroup,
    updateGroup,
    removeGroup,
    removeActionFromGroup,
    macros,
    addMacro,
    updateMacro,
    removeMacro,
    addStepToMacro,
    removeStepFromMacro,
    reorderMacroStep,
  } = useSpeedPanelPins();

  const [query, setQuery] = useState(initialQuery);
  const [activeIdx, setActiveIdx] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(initialCollapsedGroups));
  const [expandedMacro, setExpandedMacro] = useState<string | null>(initialExpandedMacro);
  const [macroStatus, setMacroStatus] = useState<string | null>(initialMacroStatus);
  const [dragPinIndex, setDragPinIndex] = useState<number | null>(null);
  const [stepFlow, setStepFlow] = useState<StepStackState | null>(initialStepFlow);
  const [stepFilter, setStepFilter] = useState('');
  const [stepActiveIdx, setStepActiveIdx] = useState(0);
  const [stepInputDraft, setStepInputDraft] = useState(() => {
    const last = initialStepFlow?.steps[initialStepFlow.steps.length - 1];
    return last?.kind === 'input' ? last.value : '';
  });
  const [scalarPill, setScalarPill] = useState<ScalarPillState | null>(initialScalarPill);
  const [createMacroState, setCreateMacroState] = useState<CreateMacroViewState | null>(initialCreateMacroState);
  const [macroReplaceFlow, setMacroReplaceFlow] = useState<MacroReplaceFlowState | null>(initialMacroReplaceFlow);
  const [quickFixFlow, setQuickFixFlow] = useState<QuickFixFlowState | null>(initialQuickFixFlow);
  const inputRef = useRef<HTMLInputElement>(null);
  const stepInputRef = useRef<HTMLInputElement>(null);
  const scalarPillRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cmdCtx = useMemo(
    () => ({
      hit: speedPanelContext,
      selection,
      selectedConnection,
      project,
      supportsSpatialPick: true,
    }),
    [speedPanelContext, selection, selectedConnection, project],
  );

  const repeatCommand = useMemo(
    () => (lastPanelAction ? createRepeatLastCommand(lastPanelAction) : null),
    [lastPanelAction],
  );

  const quickFixProblems = useMemo(
    () => (speedPanelPosition && speedPanelContext ? getProblemsForObject(project, speedPanelContext) : []),
    [speedPanelPosition, project, speedPanelContext],
  );

  const view = useMemo(
    () =>
      buildSpeedPanelView(COMMAND_REGISTRY, cmdCtx, query, {
        pinnedIds,
        frecency,
        recentIds,
        adaptiveHistory,
        groups,
        macros,
        mode: project.mode,
        showRecents,
        hotkeyBindings: HOTKEY_BINDINGS,
        repeatCommand,
        quickFixProblems,
      }),
    [cmdCtx, query, pinnedIds, frecency, recentIds, adaptiveHistory, groups, macros, project.mode, showRecents, repeatCommand, quickFixProblems],
  );

  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const allNavigable: NavEntry[] = useMemo(
    () => buildNavigableEntries(view, collapsedGroups),
    [view, collapsedGroups],
  );

  // Auto-focus without scrolling viewport on mount, and surface any deferred macro load warnings once
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
    notifySpeedPanelLoadWarnings(pushToast);
  }, []);

  // Clamp active index when list changes
  useEffect(() => {
    setActiveIdx((prev) => clampActiveIndex(prev, allNavigable.length));
  }, [allNavigable.length]);

  useEffect(() => { setActiveIdx(0); }, [query]);

  // Keep active descendant scrolled into view even under zoom
  useEffect(() => {
    const active = allNavigable[activeIdx];
    if (!active || typeof document === 'undefined') return;
    document.getElementById(active.domId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIdx, allNavigable]);

  // Edge clamping
  const [offset, setOffset] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  useEffect(() => {
    if (!panelRef.current || !speedPanelPosition) return;
    const parent = panelRef.current.parentElement;
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    setOffset(
      computeEdgeClampedOffset(
        speedPanelPosition,
        panelRef.current.offsetWidth || 260,
        panelRef.current.offsetHeight || 420,
        pRect.width,
        pRect.height,
      ),
    );
  }, [speedPanelPosition]);

  const currentStep = stepFlow ? stepFlow.steps[stepFlow.steps.length - 1] ?? null : null;
  const filteredStepOptions = useMemo(
    () => (currentStep?.kind === 'choice' ? filterStepOptions(currentStep.options, stepFilter) : []),
    [currentStep, stepFilter],
  );

  useEffect(() => {
    if (currentStep?.kind === 'input') {
      setStepInputDraft(currentStep.value);
    }
    stepInputRef.current?.focus({ preventScroll: true });
  }, [stepFlow?.steps.length, currentStep?.stepId]);

  useEffect(() => {
    if (scalarPill) {
      scalarPillRef.current?.focus({ preventScroll: true });
      scalarPillRef.current?.select?.();
    }
  }, [scalarPill !== null]);

  const replaceView = useMemo(
    () => (macroReplaceFlow ? buildMacroReplaceStepView(macroReplaceFlow) : null),
    [macroReplaceFlow],
  );
  const filteredReplaceOptions = useMemo(
    () => (replaceView && macroReplaceFlow ? filterStepOptions(replaceView.currentPrompt.options, macroReplaceFlow.filter) : []),
    [replaceView, macroReplaceFlow],
  );

  const quickFixView = useMemo(
    () => (quickFixFlow ? buildQuickFixStepView(quickFixFlow) : null),
    [quickFixFlow],
  );
  const quickFixCurrentStep = quickFixView
    ? quickFixView.stepStack.steps[quickFixView.stepStack.steps.length - 1]
    : null;
  const filteredQuickFixOptions = useMemo(
    () =>
      quickFixCurrentStep?.kind === 'choice' && quickFixFlow
        ? filterStepOptions(quickFixCurrentStep.options, quickFixFlow.filter)
        : [],
    [quickFixCurrentStep, quickFixFlow],
  );

  const {
    execute,
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
  } = createSpeedPanelCallbacks({
    context: speedPanelContext,
    selection,
    zones: project.zones,
    query,
    view,
    allNavigable,
    activeIdx,
    lastPanelAction,
    stepFlow,
    filteredStepOptions,
    stepActiveIdx,
    stepFilter,
    stepInputDraft,
    scalarPill,
    scalarPillRef,
    recentPanelActions,
    createMacroState,
    setCreateMacroState,
    addMacro,
    macroReplaceFlow,
    setMacroReplaceFlow,
    quickFixFlow,
    setQuickFixFlow,
    executeCommand: executeRegistryCommand,
    runMacroSteps: executeMacro,
    stores: productionExecuteStores(),
    stepStores: productionStepStores(),
    hotkeyCtx: productionHotkeyContext(onSave),
    closeSpeedPanel,
    setActiveIdx,
    reorderPin,
    setStepFlow,
    setStepFilter,
    setStepActiveIdx,
    setScalarPill,
    setMacroStatus,
    recordCommandUsage,
    pushToast,
    refocusSearch: () => queueMicrotask(() => inputRef.current?.focus({ preventScroll: true })),
  });

  const toggleGroupCollapse = (id: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleNewGroup = () => {
    const id = 'g-' + Date.now();
    addGroup({ id, name: 'New Group', actionIds: [] });
  };

  const handleNewMacro = () => {
    const id = 'm-' + Date.now();
    addMacro({ id, name: 'New Macro', steps: [] });
    setExpandedMacro(id);
  };

  if (!speedPanelPosition) return null;

  const activeDomId = allNavigable[activeIdx]?.domId;
  let navIdx = 0;

  return (
    <>
      {/* Backdrop — click to dismiss */}
      <div
        onClick={closeSpeedPanel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ position: 'absolute', inset: 0, zIndex: 'var(--wf-z-speed)' as unknown as number }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        data-testid="wf-speed-panel"
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          left: offset.left || speedPanelPosition.x,
          top: offset.top || speedPanelPosition.y,
          width: 'calc(var(--wf-sidebar-width) + var(--wf-space-6))',
          maxHeight: 'min(80vh, calc(var(--wf-space-6) * 18))',
          background: 'var(--wf-bg-panel)',
          border: '1px solid var(--wf-border-default)',
          borderRadius: 6,
          boxShadow: 'var(--wf-shadow-panel)',
          zIndex: 'calc(var(--wf-z-speed) + 1)' as unknown as number,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header: Create macro / Missing-ID replacement / Step breadcrumb / Root combobox */}
        {createMacroState ? (
          <SpeedPanelCreateMacroView
            state={createMacroState}
            setState={setCreateMacroState}
            onSaveMacro={(state) =>
              submitCreateMacroState(state, {
                addMacro,
                setCreateMacroState,
                setMacroStatus,
                refocusSearch: () => queueMicrotask(() => inputRef.current?.focus({ preventScroll: true })),
              })
            }
            onBack={() => {
              setCreateMacroState(null);
              queueMicrotask(() => inputRef.current?.focus({ preventScroll: true }));
            }}
            onCancel={() => {
              setCreateMacroState(null);
              closeSpeedPanel();
            }}
          />
        ) : replaceView && macroReplaceFlow ? (
          <SpeedPanelStepView
            stepFlow={replaceView.stepStack}
            currentStep={replaceView.stepStack.steps[0]}
            stepFilter={macroReplaceFlow.filter}
            setStepFilter={(v) => setMacroReplaceFlow({ ...macroReplaceFlow, filter: v, activeIdx: 0 })}
            filteredOptions={filteredReplaceOptions}
            activeIdx={macroReplaceFlow.activeIdx}
            stepInputDraft=""
            stepInputRef={stepInputRef}
            onBack={onStepBackReplace}
            onCancel={() => {
              setMacroReplaceFlow(null);
              closeSpeedPanel();
            }}
            onSelectOption={onSelectReplaceOption}
          />
        ) : quickFixView && quickFixCurrentStep && quickFixFlow ? (
          <SpeedPanelStepView
            stepFlow={quickFixView.stepStack}
            currentStep={quickFixCurrentStep}
            stepFilter={quickFixFlow.filter}
            setStepFilter={(v) => setQuickFixFlow({ ...quickFixFlow, filter: v, activeIdx: 0 })}
            filteredOptions={filteredQuickFixOptions}
            activeIdx={quickFixFlow.activeIdx}
            stepInputDraft=""
            stepInputRef={stepInputRef}
            onBack={onStepBackQuickFix}
            onCancel={() => {
              setQuickFixFlow(null);
              closeSpeedPanel();
            }}
            onSelectOption={onSelectQuickFixOption}
          />
        ) : stepFlow && currentStep ? (
          <SpeedPanelStepView
            stepFlow={stepFlow}
            currentStep={currentStep}
            stepFilter={stepFilter}
            setStepFilter={(v) => { setStepFilter(v); setStepActiveIdx(0); }}
            filteredOptions={filteredStepOptions}
            activeIdx={stepActiveIdx}
            stepInputDraft={stepInputDraft}
            setStepInputDraft={(v) => {
              setStepInputDraft(v);
              if (stepFlow.error) setStepFlow({ ...stepFlow, error: null });
            }}
            stepInputRef={stepInputRef}
            onBack={onStepBack}
            onCancel={closeSpeedPanel}
            onSelectOption={onSelectStepOption}
            onSubmitInput={onSubmitStep}
          />
        ) : (
          <>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--wf-border-default)' }}>
          <input
            ref={inputRef}
            data-testid="wf-speed-panel-search"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="wf-speed-listbox"
            aria-activedescendant={activeDomId}
            aria-label="Search Speed Panel actions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick action..."
            style={{
              background: 'var(--wf-bg-app)', color: 'var(--wf-text-primary)', border: 'none',
              padding: 'var(--wf-space-2) var(--wf-space-3)', fontSize: 12, outline: 'none', flex: 1, minWidth: 0,
            }}
          />
          <button
            type="button"
            onClick={toggleSpeedPanelEditMode}
            title={speedPanelEditMode ? 'Exit edit mode' : 'Edit favorites & groups'}
            aria-label={speedPanelEditMode ? 'Exit edit mode' : 'Edit favorites & groups'}
            aria-pressed={speedPanelEditMode}
            style={{
              background: speedPanelEditMode ? 'var(--wf-bg-hover)' : 'transparent',
              border: 'none', color: speedPanelEditMode ? 'var(--wf-text-primary)' : 'var(--wf-text-muted)',
              cursor: 'pointer', padding: '0 var(--wf-space-2)', fontSize: 12,
            }}
          >
            {'\u270E'}
          </button>
        </div>

        {/* Macro status banner */}
        {macroStatus && (
          <div style={{ padding: 'var(--wf-space-1) var(--wf-space-2)', fontSize: 10, color: 'var(--wf-danger-text)', background: 'var(--wf-danger-bg, color-mix(in srgb, var(--wf-danger) 18%, var(--wf-bg-panel)))', borderBottom: '1px solid var(--wf-border-default)' }}>
            {macroStatus}
            <button
              type="button"
              onClick={() => setMacroStatus(null)}
              aria-label="Dismiss macro status"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 6, color: 'var(--wf-text-muted)', padding: 0, fontSize: 10 }}
            >{'\u2715'}</button>
          </div>
        )}

        {/* Scrollable body */}
        <div
          id="wf-speed-listbox"
          role="listbox"
          aria-label={speedPanelContext ? `Speed Panel — ${speedPanelContext.type}` : 'Speed Panel — Canvas'}
          style={{ overflow: 'auto', flex: 1 }}
        >
          {view.kind === 'unsearched' ? (
            <>
              {/* === BAND 1: FIXED CONTEXT DECK === */}
              <div data-testid="wf-sp-band-1" role="group" aria-labelledby={SP_HEADING_IDS.band1}>
                <div id={SP_HEADING_IDS.band1} role="presentation" style={SECTION_STYLE}>
                  {speedPanelContext ? `${view.deckKey} DECK` : 'CANVAS DECK'}
                </div>
                {view.quickFix && (() => {
                  const qf = view.quickFix;
                  const idx = navIdx++;
                  return (
                    <div
                      id="wf-sp-opt-quick-fix"
                      data-testid="wf-sp-quick-fix-row"
                      role="option"
                      aria-selected={idx === activeIdx}
                      onClick={() => onOpenQuickFix(qf)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--wf-space-2)',
                        padding: 'var(--wf-space-1) var(--wf-space-2)',
                        cursor: 'pointer',
                        fontSize: 12,
                        background: idx === activeIdx ? 'var(--wf-bg-hover)' : 'color-mix(in srgb, var(--wf-warning) 10%, transparent)',
                        color: 'var(--wf-text-primary)',
                        borderBottom: '1px solid var(--wf-border-default)',
                      }}
                    >
                      <span aria-hidden="true" style={{ fontSize: 13, width: 16, textAlign: 'center', color: 'var(--wf-warning)' }}>!</span>
                      <span style={{ flex: 1, fontWeight: 600 }}>{qf.label}</span>
                      <span
                        data-testid="wf-sp-quick-fix-count"
                        style={{
                          fontSize: 10,
                          padding: '0 6px',
                          borderRadius: 10,
                          background: 'color-mix(in srgb, var(--wf-warning) 20%, var(--wf-bg-control))',
                          color: 'var(--wf-warning)',
                        }}
                      >
                        {qf.countLabel}
                      </span>
                    </div>
                  );
                })()}
                {view.band1Deck.map((row, i) => {
                  const idx = navIdx++;
                  const domId = `wf-sp-opt-b1-${i}-${row.command.id}`;
                  return (
                    <CommandRow
                      key={domId}
                      domId={domId}
                      row={row}
                      active={idx === activeIdx}
                      isPinned={pinnedIdSet.has(row.command.id)}
                      onTogglePin={togglePin}
                      onExecute={execute}
                    />
                  );
                })}
              </div>

              {/* === BAND 2: PINNED & MACROS === */}
              {(view.band2Pinned.length > 0 || view.band2Macros.length > 0 || speedPanelEditMode) && (
                <div data-testid="wf-sp-band-2" role="group" aria-labelledby={SP_HEADING_IDS.band2}>
                  <div id={SP_HEADING_IDS.band2} role="presentation" style={SECTION_STYLE}>PINNED</div>
                  {view.band2Pinned.map((row, i) => {
                    const idx = navIdx++;
                    const domId = `wf-sp-opt-b2-${i}-${row.command.id}`;
                    const storeIdx = row.pinIndex;
                    const prevStoreIdx = i > 0 ? view.band2Pinned[i - 1].pinIndex : undefined;
                    const nextStoreIdx = i < view.band2Pinned.length - 1 ? view.band2Pinned[i + 1].pinIndex : undefined;
                    const pinHandlers = buildPinRowHandlers({
                      storeIdx,
                      prevStoreIdx,
                      nextStoreIdx,
                      dragPinIndex,
                      setDragPinIndex,
                      reorderPin,
                    });
                    return (
                      <CommandRow
                        key={domId}
                        domId={domId}
                        testIdPrefix="wf-sp-pin"
                        row={row}
                        active={idx === activeIdx}
                        isPinned
                        onTogglePin={togglePin}
                        onExecute={execute}
                        editMode={speedPanelEditMode}
                        draggable={!speedPanelEditMode && storeIdx !== undefined}
                        {...pinHandlers}
                        {...scalarPropsFor(row, domId)}
                      />
                    );
                  })}

                  {view.band2Macros.map((m) => {
                    const idx = navIdx++;
                    const domId = `wf-sp-opt-macro-${m.id}`;
                    const isExpanded = expandedMacro === m.id && speedPanelEditMode;
                    return (
                      <div key={domId} role="presentation">
                        <div
                          id={domId}
                          role="option"
                          aria-selected={idx === activeIdx}
                          onClick={() => { if (!speedPanelEditMode) runMacro(m); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--wf-space-2)',
                            padding: 'var(--wf-space-1) var(--wf-space-2)', cursor: 'pointer', fontSize: 12,
                            background: idx === activeIdx ? 'var(--wf-bg-hover)' : 'transparent',
                            color: 'var(--wf-text-primary)',
                          }}
                        >
                          <span style={{ color: 'var(--wf-success-text)', fontSize: 10, flexShrink: 0 }}>{'\u25B6'}</span>
                          {speedPanelEditMode ? (
                            <input
                              value={m.name}
                              aria-label={`Macro name for ${m.name}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateMacro(m.id, { name: e.target.value })}
                              style={{ background: 'transparent', border: '1px solid var(--wf-border-default)', color: 'var(--wf-text-primary)', fontSize: 12, padding: '1px 4px', flex: 1, outline: 'none', minWidth: 0 }}
                            />
                          ) : (
                            <span style={{ flex: 1 }}>{m.name}</span>
                          )}
                          <span style={{ color: 'var(--wf-text-muted)', fontSize: 9 }}>{m.steps.length} step{m.steps.length !== 1 ? 's' : ''}</span>
                          {speedPanelEditMode && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setExpandedMacro(isExpanded ? null : m.id); }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--wf-text-muted)', fontSize: 10, padding: 0 }}
                                title="Edit steps"
                                aria-label={isExpanded ? `Collapse steps for ${m.name}` : `Edit steps for ${m.name}`}
                                aria-expanded={isExpanded}
                              >{isExpanded ? '\u25BC' : '\u25B6'}</button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeMacro(m.id); }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--wf-danger-text)', fontSize: 10, padding: 0 }}
                                title="Delete macro"
                                aria-label={`Delete macro ${m.name}`}
                              >{'\u2715'}</button>
                            </>
                          )}
                        </div>
                        {isExpanded && (
                          <div role="presentation" style={{ padding: '2px 16px 4px', borderLeft: '2px solid var(--wf-border-default)', marginLeft: 12 }}>
                            {m.steps.map((step, si) => {
                              const stepCmdId = getMacroStepCommandId(step);
                              const action = COMMAND_REGISTRY.find((c) => c.id === stepCmdId);
                              return (
                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--wf-text-primary)', padding: '1px 0' }}>
                                  <span style={{ color: 'var(--wf-text-muted)', width: 14 }}>{si + 1}.</span>
                                  <span style={{ flex: 1 }}>{action?.title ?? stepCmdId}</span>
                                  <button
                                    type="button"
                                    onClick={() => si > 0 && reorderMacroStep(m.id, si, si - 1)}
                                    disabled={si === 0}
                                    aria-label={`Move step ${si + 1} up`}
                                    style={{ background: 'transparent', border: 'none', color: si > 0 ? 'var(--wf-text-muted)' : 'var(--wf-border-default)', cursor: si > 0 ? 'pointer' : 'default', fontSize: 8, padding: 0 }}
                                  >{'\u25B2'}</button>
                                  <button
                                    type="button"
                                    onClick={() => si < m.steps.length - 1 && reorderMacroStep(m.id, si, si + 1)}
                                    disabled={si === m.steps.length - 1}
                                    aria-label={`Move step ${si + 1} down`}
                                    style={{ background: 'transparent', border: 'none', color: si < m.steps.length - 1 ? 'var(--wf-text-muted)' : 'var(--wf-border-default)', cursor: si < m.steps.length - 1 ? 'pointer' : 'default', fontSize: 8, padding: 0 }}
                                  >{'\u25BC'}</button>
                                  <button
                                    type="button"
                                    onClick={() => removeStepFromMacro(m.id, si)}
                                    aria-label={`Remove step ${si + 1}`}
                                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--wf-danger-text)', fontSize: 10, padding: 0 }}
                                  >{'\u2715'}</button>
                                </div>
                              );
                            })}
                            <select
                              value=""
                              onChange={(e) => { if (e.target.value) addStepToMacro(m.id, e.target.value); }}
                              style={{ background: 'var(--wf-bg-app)', color: 'var(--wf-text-muted)', border: '1px solid var(--wf-border-default)', fontSize: 10, padding: '2px', width: '100%', marginTop: 2, borderRadius: 2 }}
                            >
                              <option value="">+ Add step...</option>
                              {SPEED_PANEL_ACTIONS.filter((a) => a.macroSafe).map((a) => (
                                <option key={a.id} value={a.id}>{a.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {speedPanelEditMode && (
                    <div role="presentation" style={{ padding: '2px 8px' }}>
                      <button
                        type="button"
                        onClick={handleNewMacro}
                        style={{ background: 'transparent', border: '1px dashed var(--wf-border-default)', color: 'var(--wf-text-muted)', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 3, width: '100%' }}
                      >+ New Macro</button>
                    </div>
                  )}
                </div>
              )}

              {/* === REPEAT LAST ACTION HERE (AFTER FIXED BAND 1/2 SLOTS) === */}
              {view.repeatLastRow && (() => {
                const idx = navIdx++;
                return (
                  <div data-testid="wf-sp-repeat-last" style={{ borderTop: '1px solid var(--wf-border-subtle)', borderBottom: '1px solid var(--wf-border-subtle)' }}>
                    <CommandRow
                      domId="wf-sp-opt-repeat-last"
                      testIdPrefix="wf-sp-repeat"
                      row={view.repeatLastRow}
                      active={idx === activeIdx}
                      isPinned={false}
                      onTogglePin={togglePin}
                      onExecute={execute}
                    />
                  </div>
                );
              })()}

              {/* === BAND 3: FRECENCY RECENTS (UP TO 3, TOGGLEABLE IN OPTIONS) === */}
              {view.band3Recents.length > 0 && (
                <div data-testid="wf-sp-band-3" role="group" aria-labelledby={SP_HEADING_IDS.band3}>
                  <div id={SP_HEADING_IDS.band3} role="presentation" style={SECTION_STYLE}>RECENT</div>
                  {view.band3Recents.map((row, i) => {
                    const idx = navIdx++;
                    const domId = `wf-sp-opt-b3-${i}-${row.command.id}`;
                    return (
                      <CommandRow
                        key={domId}
                        domId={domId}
                        row={row}
                        active={idx === activeIdx}
                        isPinned={pinnedIdSet.has(row.command.id)}
                        onTogglePin={togglePin}
                        onExecute={execute}
                        {...scalarPropsFor(row, domId)}
                      />
                    );
                  })}
                </div>
              )}

              {/* === BAND 4: SAVED UNPINNED MACROS, MODE SUGGESTIONS, CUSTOM GROUPS, & CANONICAL CATALOGUE === */}
              <div data-testid="wf-sp-band-4" role="presentation">
                {view.band4Macros && view.band4Macros.length > 0 && (
                  <div data-testid="wf-sp-band-4-macros" role="group" aria-labelledby={SP_HEADING_IDS.band4Macros}>
                    <div id={SP_HEADING_IDS.band4Macros} role="presentation" style={SECTION_STYLE}>MACROS</div>
                    {view.band4Macros.map((m) => {
                      const idx = navIdx++;
                      const domId = `wf-sp-opt-b4-macro-${m.id}`;
                      return (
                        <div
                          key={domId}
                          id={domId}
                          role="option"
                          aria-selected={idx === activeIdx}
                          onClick={() => runMacro(m)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--wf-space-2)',
                            padding: 'var(--wf-space-1) var(--wf-space-2)', cursor: 'pointer', fontSize: 12,
                            background: idx === activeIdx ? 'var(--wf-bg-hover)' : 'transparent',
                            color: 'var(--wf-text-primary)',
                          }}
                        >
                          <span style={{ color: 'var(--wf-success-text)', fontSize: 10, flexShrink: 0 }}>{'\u25B6'}</span>
                          <span style={{ flex: 1 }}>{m.name}</span>
                          <span style={{ color: 'var(--wf-text-muted)', fontSize: 9 }}>{m.steps.length} step{m.steps.length !== 1 ? 's' : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {view.band4ModeSuggested.length > 0 && (
                  <div data-testid="wf-sp-band-4-mode" role="group" aria-labelledby={SP_HEADING_IDS.band4Mode}>
                    <div id={SP_HEADING_IDS.band4Mode} role="presentation" style={SECTION_STYLE}>MODE SUGGESTED</div>
                    {view.band4ModeSuggested.map((row, i) => {
                      const idx = navIdx++;
                      const domId = `wf-sp-opt-ms-${i}-${row.command.id}`;
                      return (
                        <CommandRow
                          key={domId}
                          domId={domId}
                          row={row}
                          active={idx === activeIdx}
                          isPinned={pinnedIdSet.has(row.command.id)}
                          onTogglePin={togglePin}
                          onExecute={execute}
                        />
                      );
                    })}
                  </div>
                )}

                {view.band4CustomGroups.map((g) => {
                  const collapsed = collapsedGroups.has(g.group.id);
                  const headingId = customGroupHeadingId(g.group.id);
                  return (
                    <div key={'grp-' + g.group.id} role="group" aria-labelledby={headingId}>
                      <div
                        id={headingId}
                        role="presentation"
                        style={{ ...SECTION_STYLE, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => toggleGroupCollapse(g.group.id)}
                      >
                        <span style={{ marginRight: 4, fontSize: 8 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
                        {speedPanelEditMode ? (
                          <input
                            value={g.group.name}
                            aria-label={`Group name for ${g.group.name}`}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateGroup(g.group.id, { name: e.target.value })}
                            style={{ background: 'transparent', border: '1px solid var(--wf-border-default)', color: 'var(--wf-text-primary)', fontSize: 10, padding: '1px 4px', flex: 1, outline: 'none', minWidth: 0 }}
                          />
                        ) : (
                          <span style={{ flex: 1 }}>{g.group.name}</span>
                        )}
                        {speedPanelEditMode && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeGroup(g.group.id); }}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--wf-danger-text)', fontSize: 10, marginLeft: 4, padding: 0 }}
                            title="Delete group"
                            aria-label={`Delete group ${g.group.name}`}
                          >{'\u2715'}</button>
                        )}
                      </div>
                      {!collapsed && g.rows.map((row, i) => {
                        const idx = navIdx++;
                        const domId = `wf-sp-opt-cg-${g.group.id}-${i}-${row.command.id}`;
                        return (
                          <CommandRow
                            key={domId}
                            domId={domId}
                            row={row}
                            active={idx === activeIdx}
                            isPinned={pinnedIdSet.has(row.command.id)}
                            onTogglePin={togglePin}
                            onExecute={execute}
                            groupEditMode={speedPanelEditMode}
                            onRemoveFromGroup={() => removeActionFromGroup(g.group.id, row.command.id)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
                {speedPanelEditMode && (
                  <div role="presentation" style={{ padding: '2px 8px' }}>
                    <button
                      type="button"
                      onClick={handleNewGroup}
                      style={{ background: 'transparent', border: '1px dashed var(--wf-border-default)', color: 'var(--wf-text-muted)', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 3, width: '100%' }}
                    >+ New Group</button>
                  </div>
                )}

                {view.band4Catalogue.map((sec) => {
                  const headingId = catalogueGroupHeadingId(sec.group);
                  return (
                    <div key={'cat-' + sec.group} data-testid={`wf-sp-cat-${sec.group}`} role="group" aria-labelledby={headingId}>
                      <div id={headingId} role="presentation" style={SECTION_STYLE}>{sec.group}</div>
                      {sec.rows.map((row, i) => {
                        const idx = navIdx++;
                        const domId = `wf-sp-opt-cat-${sec.group}-${i}-${row.command.id}`;
                        return (
                          <CommandRow
                            key={domId}
                            domId={domId}
                            row={row}
                            active={idx === activeIdx}
                            isPinned={pinnedIdSet.has(row.command.id)}
                            onTogglePin={togglePin}
                            onExecute={execute}
                            {...scalarPropsFor(row, domId)}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {/* === SEARCHED: ENABLED RESULTS WITH HIGHLIGHT === */}
              {view.enabled.map((row, i) => {
                const idx = navIdx++;
                const domId = `wf-sp-opt-hit-${i}-${row.command.id}`;
                return (
                  <CommandRow
                    key={domId}
                    domId={domId}
                    row={row}
                    matchRanges={row.matchRanges}
                    matchedKeyword={row.matchedKeyword}
                    active={idx === activeIdx}
                    isPinned={pinnedIdSet.has(row.command.id)}
                    onTogglePin={togglePin}
                    onExecute={execute}
                    {...scalarPropsFor(row, domId)}
                  />
                );
              })}

              {/* === SEARCHED: MACROS === */}
              {view.macros.length > 0 && (
                <div role="group" aria-labelledby={SP_HEADING_IDS.searchMacros}>
                  <div id={SP_HEADING_IDS.searchMacros} role="presentation" style={SECTION_STYLE}>MACROS</div>
                  {view.macros.map((m) => {
                    const idx = navIdx++;
                    const domId = `wf-sp-opt-macro-${m.id}`;
                    return (
                      <div
                        key={domId}
                        id={domId}
                        role="option"
                        aria-selected={idx === activeIdx}
                        onClick={() => runMacro(m)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--wf-space-2)',
                          padding: 'var(--wf-space-1) var(--wf-space-2)', cursor: 'pointer', fontSize: 12,
                          background: idx === activeIdx ? 'var(--wf-bg-hover)' : 'transparent',
                          color: 'var(--wf-text-primary)',
                        }}
                      >
                        <span style={{ color: 'var(--wf-success-text)', fontSize: 10, flexShrink: 0 }}>{'\u25B6'}</span>
                        <span style={{ flex: 1 }}>{m.name}</span>
                        <span style={{ color: 'var(--wf-text-muted)', fontSize: 9 }}>{m.steps.length} step{m.steps.length !== 1 ? 's' : ''}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* === SEARCHED: UNAVAILABLE HERE (NEVER HIDDEN) === */}
              {view.unavailable.length > 0 && (
                <div data-testid="wf-sp-unavailable-group" role="group" aria-labelledby={SP_HEADING_IDS.unavailable}>
                  <div id={SP_HEADING_IDS.unavailable} role="presentation" style={SECTION_STYLE}>Unavailable here</div>
                  {view.unavailable.map((row, i) => {
                    const idx = navIdx++;
                    const domId = `wf-sp-opt-unavail-${i}-${row.command.id}`;
                    return (
                      <CommandRow
                        key={domId}
                        domId={domId}
                        testIdPrefix="wf-sp-unavailable"
                        row={row}
                        matchRanges={row.matchRanges}
                        matchedKeyword={row.matchedKeyword}
                        active={idx === activeIdx}
                        isPinned={pinnedIdSet.has(row.command.id)}
                        onTogglePin={togglePin}
                        onExecute={execute}
                      />
                    );
                  })}
                </div>
              )}

              {allNavigable.length === 0 && (
                <div role="presentation">
                  <EmptyState
                    title="No actions"
                    description="Nothing matches this query. Try another search or press Esc."
                    icon={'\u2630'}
                  />
                </div>
              )}
            </>
          )}
        </div>
          </>
        )}
      </div>
    </>
  );
}

export function HighlightedText({ text, ranges }: { text: string; ranges?: Array<[number, number]> }) {
  if (!ranges || ranges.length === 0) {
    return <>{text}</>;
  }
  const parts = splitHighlightSegments(text, ranges);
  return (
    <>
      {parts.map((p, i) =>
        p.matched ? (
          <mark
            key={i}
            data-testid="wf-sp-highlight"
            style={{
              background: 'color-mix(in srgb, var(--wf-accent) 26%, transparent)',
              color: 'var(--wf-text-primary)',
              fontWeight: 600,
              borderRadius: 2,
              padding: '0 1px',
            }}
          >
            {p.str}
          </mark>
        ) : (
          <Fragment key={i}>{p.str}</Fragment>
        ),
      )}
    </>
  );
}

export function CommandBadgeLabel({ badge }: { badge: CommandBadge | null }) {
  if (!badge) return null;
  if (badge.kind === 'shortcut') {
    return (
      <kbd
        data-testid="wf-sp-badge"
        style={{
          fontSize: 10,
          color: 'var(--wf-text-muted)',
          background: 'var(--wf-bg-app)',
          border: '1px solid var(--wf-border-subtle, var(--wf-border-default))',
          borderRadius: 3,
          padding: '0 4px',
          flexShrink: 0,
        }}
      >
        {badge.text}
      </kbd>
    );
  }
  return (
    <span
      data-testid="wf-sp-badge"
      style={{
        fontSize: 9,
        color: 'var(--wf-text-muted)',
        flexShrink: 0,
        maxWidth: 110,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
      title={badge.text}
    >
      {badge.text}
    </span>
  );
}

function CommandRow({
  domId,
  testIdPrefix,
  row,
  matchRanges,
  matchedKeyword,
  active,
  isPinned,
  onTogglePin,
  onExecute,
  editMode,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  groupEditMode,
  onRemoveFromGroup,
  scalarPill,
  scalarPillRef,
  onScalarPillOpen,
  onScalarPillChange,
  onScalarPillKeyDown,
}: {
  domId: string;
  testIdPrefix?: string;
  row: PaletteRow | SearchedPaletteRow;
  matchRanges?: Array<[number, number]>;
  matchedKeyword?: MatchedText;
  active: boolean;
  isPinned: boolean;
  onTogglePin: (commandId: string) => void;
  onExecute: (row: PaletteRow) => void;
  editMode?: boolean;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  groupEditMode?: boolean;
  onRemoveFromGroup?: () => void;
  scalarPill?: ScalarPillState | null;
  scalarPillRef?: React.RefObject<HTMLInputElement | null>;
  onScalarPillOpen?: () => void;
  onScalarPillChange?: (value: string) => void;
  onScalarPillKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const { command, badge, disabledReason } = row;
  const label = command.label ?? command.title;
  const isDisabled = disabledReason !== null;
  const reasonId = isDisabled ? `${domId}-reason` : undefined;

  return (
    <div
      id={domId}
      data-testid={testIdPrefix ? `${testIdPrefix}-${command.id}` : `wf-sp-row-${command.id}`}
      role="option"
      aria-selected={active}
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-describedby={reasonId}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => onExecute(row)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        padding: 'var(--wf-space-1) var(--wf-space-2)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        fontSize: 12,
        background: active ? 'var(--wf-bg-hover)' : 'transparent',
        color: isDisabled ? 'var(--wf-text-muted)' : 'var(--wf-text-primary)',
        opacity: isDisabled ? 0.72 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--wf-space-2)', minWidth: 0 }}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onTogglePin(command.id); }}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 11,
            color: isPinned ? 'var(--wf-warning)' : 'var(--wf-text-muted)', userSelect: 'none', flexShrink: 0, padding: 0,
          }}
          title={isPinned ? 'Unpin' : 'Pin'}
          aria-label={isPinned ? `Unpin ${label}` : `Pin ${label}`}
          aria-pressed={isPinned}
        >
          {isPinned ? '\u2605' : '\u2606'}
        </button>
        <span style={{ color: 'var(--wf-text-muted)', fontSize: 14, width: 20, textAlign: 'center', flexShrink: 0 }}>
          {commandGlyph(command)}
        </span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <HighlightedText text={label} ranges={matchRanges} />
        </span>
        {scalarPill ? (
          <input
            ref={scalarPillRef}
            data-testid="wf-sp-scalar-pill"
            aria-label="Elevation value in meters"
            value={scalarPill.value}
            placeholder="e.g. -5"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onScalarPillChange?.(e.target.value)}
            onKeyDown={onScalarPillKeyDown}
            style={{
              width: 72,
              padding: '1px 5px',
              fontSize: 11,
              background: 'var(--wf-bg-app)',
              color: 'var(--wf-text-primary)',
              border: `1px solid ${scalarPill.error ? 'var(--wf-danger)' : 'var(--wf-accent)'}`,
              borderRadius: 3,
              outline: 'none',
            }}
          />
        ) : onScalarPillOpen ? (
          <button
            type="button"
            data-testid="wf-sp-scalar-hint"
            onClick={(e) => { e.stopPropagation(); onScalarPillOpen(); }}
            title="Press Tab to edit value inline"
            style={{
              fontSize: 9,
              color: 'var(--wf-text-muted)',
              background: 'var(--wf-bg-app)',
              border: '1px solid var(--wf-border-default)',
              borderRadius: 3,
              padding: '0 4px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Tab: Value
          </button>
        ) : (
          <CommandBadgeLabel badge={badge} />
        )}
        {editMode && isPinned && (
          <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
              disabled={!onMoveUp}
              style={{
                background: 'transparent', border: 'none', color: onMoveUp ? 'var(--wf-text-muted)' : 'var(--wf-border-default)',
                cursor: onMoveUp ? 'pointer' : 'default', fontSize: 10, padding: '0 2px',
              }}
              title="Move up"
              aria-label={`Move ${label} up`}
            >{'\u25B2'}</button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
              disabled={!onMoveDown}
              style={{
                background: 'transparent', border: 'none', color: onMoveDown ? 'var(--wf-text-muted)' : 'var(--wf-border-default)',
                cursor: onMoveDown ? 'pointer' : 'default', fontSize: 10, padding: '0 2px',
              }}
              title="Move down"
              aria-label={`Move ${label} down`}
            >{'\u25BC'}</button>
          </span>
        )}
        {groupEditMode && onRemoveFromGroup && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(); }}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--wf-danger-text)', fontSize: 10, flexShrink: 0, padding: 0 }}
            title="Remove from group"
            aria-label={`Remove ${label} from group`}
          >{'\u2715'}</button>
        )}
      </div>
      {scalarPill?.error && (
        <div
          role="alert"
          data-testid="wf-sp-scalar-error"
          style={{ paddingLeft: 42, fontSize: 10, color: 'var(--wf-danger-text)' }}
        >
          {scalarPill.error}
        </div>
      )}
      {(matchedKeyword || isDisabled) && (
        <div
          id={reasonId}
          data-testid={isDisabled ? 'wf-sp-disabled-reason' : undefined}
          style={{
            paddingLeft: 42,
            fontSize: 10,
            color: 'var(--wf-text-muted)',
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {matchedKeyword && (
            <span>
              Matches <HighlightedText text={matchedKeyword.text} ranges={matchedKeyword.ranges} />
            </span>
          )}
          {isDisabled && <span>{disabledReason}</span>}
        </div>
      )}
    </div>
  );
}

/** Export compatibility pill for encounter types and encounter presets inside multi-step pickers. */
export function StepExportBadge({ badge }: { badge: StepChoiceOption['badge'] }) {
  if (!badge) return null;
  const colorMap: Record<NonNullable<StepChoiceOption['badge']>['tone'], string> = {
    native: 'var(--wf-success-text, #4ade80)',
    mapped: 'var(--wf-info, #60a5fa)',
    dropped: 'var(--wf-warning, #fbbf24)',
    blocked: 'var(--wf-danger-text, #f87171)',
    neutral: 'var(--wf-text-muted)',
  };
  return (
    <span
      data-testid="wf-sp-export-badge"
      data-tone={badge.tone}
      title={badge.title ?? badge.text}
      style={{
        fontSize: 9,
        padding: '1px 5px',
        borderRadius: 3,
        border: `1px solid ${colorMap[badge.tone]}`,
        color: colorMap[badge.tone],
        flexShrink: 0,
        whiteSpace: 'nowrap',
      }}
    >
      {badge.text}
    </span>
  );
}

/** Inline breadcrumb-based sub-step view rendered directly inside the Speed Panel. */
export function SpeedPanelStepView({
  stepFlow,
  currentStep,
  stepFilter,
  setStepFilter,
  filteredOptions,
  activeIdx,
  stepInputDraft,
  setStepInputDraft,
  stepInputRef,
  onBack,
  onCancel,
  onSelectOption,
  onSubmitInput,
}: {
  stepFlow: StepStackState;
  currentStep: StepStackState['steps'][number];
  stepFilter: string;
  setStepFilter: (v: string) => void;
  filteredOptions: readonly StepChoiceOption[];
  activeIdx: number;
  stepInputDraft: string;
  setStepInputDraft?: (v: string) => void;
  stepInputRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onCancel: () => void;
  onSelectOption: (opt: StepChoiceOption) => void;
  onSubmitInput?: () => void;
}) {
  return (
    <div data-testid="wf-sp-step-view" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div
        data-testid="wf-sp-step-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 'var(--wf-space-1) var(--wf-space-2)',
          borderBottom: '1px solid var(--wf-border-default)',
          background: 'var(--wf-bg-elevated, var(--wf-bg-app))',
        }}
      >
        <button
          type="button"
          data-testid="wf-sp-step-back"
          aria-label="Back"
          onClick={onBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--wf-text-muted)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '2px 4px',
          }}
        >
          {'\u2190'}
        </button>
        <span style={{ fontSize: 11, color: 'var(--wf-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stepFlow.commandLabel} {'\u203A'} <strong style={{ color: 'var(--wf-text-primary)' }}>{currentStep.title}</strong>
        </span>
        <button
          type="button"
          aria-label="Cancel step flow"
          onClick={onCancel}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--wf-text-muted)',
            cursor: 'pointer',
            fontSize: 11,
            padding: '2px 4px',
          }}
        >
          Esc
        </button>
      </div>

      {currentStep.kind === 'choice' ? (
        <>
          <div style={{ borderBottom: '1px solid var(--wf-border-subtle)' }}>
            <input
              ref={stepInputRef}
              data-testid="wf-sp-step-filter"
              aria-label={currentStep.title}
              value={stepFilter}
              placeholder={currentStep.placeholder}
              onChange={(e) => setStepFilter(e.target.value)}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                background: 'var(--wf-bg-app)',
                color: 'var(--wf-text-primary)',
                border: 'none',
                padding: 'var(--wf-space-2) var(--wf-space-3)',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </div>
          <div
            role="listbox"
            aria-label={currentStep.title}
            style={{ maxHeight: 260, overflow: 'auto' }}
          >
            {filteredOptions.map((opt, i) => (
              <div
                key={opt.id}
                role="option"
                data-testid={`wf-sp-step-opt-${opt.id}`}
                aria-selected={i === activeIdx}
                onClick={() => onSelectOption(opt)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: 'var(--wf-space-1) var(--wf-space-2)',
                  cursor: 'pointer',
                  fontSize: 12,
                  background: i === activeIdx ? 'var(--wf-bg-hover)' : 'transparent',
                  color: opt.kind === 'create' ? 'var(--wf-accent, #60a5fa)' : 'var(--wf-text-primary)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                  <StepExportBadge badge={opt.badge} />
                </div>
                {opt.description && (
                  <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{opt.description}</span>
                )}
              </div>
            ))}
            {filteredOptions.length === 0 && (
              <div style={{ padding: 'var(--wf-space-2)', fontSize: 11, color: 'var(--wf-text-muted)' }}>
                No matching options
              </div>
            )}
          </div>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitInput?.();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 'var(--wf-space-2)' }}
        >
          <label style={{ fontSize: 11, color: 'var(--wf-text-muted)', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span>{currentStep.label}</span>
            <input
              ref={stepInputRef}
              data-testid="wf-sp-step-input"
              aria-label={currentStep.label}
              value={stepInputDraft}
              placeholder={currentStep.placeholder}
              onChange={(e) => setStepInputDraft?.(e.target.value)}
              style={{
                background: 'var(--wf-bg-app)',
                color: 'var(--wf-text-primary)',
                border: `1px solid ${stepFlow.error ? 'var(--wf-danger)' : 'var(--wf-border-default)'}`,
                borderRadius: 4,
                padding: '6px 8px',
                fontSize: 12,
                outline: 'none',
              }}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button
              type="button"
              onClick={onBack}
              style={{
                background: 'transparent',
                border: '1px solid var(--wf-border-default)',
                color: 'var(--wf-text-muted)',
                borderRadius: 4,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Back
            </button>
            <button
              type="submit"
              data-testid="wf-sp-step-confirm"
              style={{
                background: 'var(--wf-accent, #2563eb)',
                border: 'none',
                color: '#fff',
                borderRadius: 4,
                padding: '4px 10px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              Apply
            </button>
          </div>
        </form>
      )}

      {stepFlow.error && (
        <div
          role="alert"
          data-testid="wf-sp-step-error"
          style={{
            margin: '0 var(--wf-space-2) var(--wf-space-2)',
            padding: '4px 8px',
            fontSize: 11,
            color: 'var(--wf-danger-text)',
            background: 'color-mix(in srgb, var(--wf-danger) 14%, var(--wf-bg-app))',
            border: '1px solid var(--wf-danger)',
            borderRadius: 4,
          }}
        >
          {stepFlow.error}
        </div>
      )}
    </div>
  );
}

/** Inline view for "Create Macro from Recent Actions…" inside Speed Panel. */
function SpeedPanelCreateMacroView({
  state,
  setState,
  onSaveMacro,
  onBack,
  onCancel,
}: {
  state: CreateMacroViewState;
  setState: (next: CreateMacroViewState | null) => void;
  onSaveMacro: (state: CreateMacroViewState) => SpeedPanelMacro | null;
  onBack: () => void;
  onCancel: () => void;
}) {
  return (
    <div data-testid="wf-sp-create-macro-view" style={{ padding: 'var(--wf-space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--wf-space-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--wf-space-1)', borderBottom: '1px solid var(--wf-border-default)', paddingBottom: 'var(--wf-space-1)' }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to Speed Panel"
          style={{ background: 'transparent', border: 'none', color: 'var(--wf-text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
        >{'\u2190'}</button>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--wf-text-primary)', flex: 1 }}>
          Create Macro from Recent Actions
        </span>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel create macro"
          style={{ background: 'transparent', border: 'none', color: 'var(--wf-text-muted)', cursor: 'pointer', fontSize: 12, padding: '2px 4px' }}
        >{'\u2715'}</button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSaveMacro(state);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--wf-space-2)' }}
      >
        <input
          autoFocus
          data-testid="wf-sp-create-macro-name"
          aria-label="Macro name"
          placeholder="Macro name..."
          value={state.name}
          onChange={(e) => setState({ ...state, name: e.target.value, error: null })}
          style={{
            background: 'var(--wf-bg-app)',
            color: 'var(--wf-text-primary)',
            border: `1px solid ${state.error ? 'var(--wf-danger)' : 'var(--wf-border-default)'}`,
            borderRadius: 4,
            padding: '5px 8px',
            fontSize: 12,
            outline: 'none',
          }}
        />

        <div data-testid="wf-sp-create-macro-list" style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {state.entries.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', padding: '6px 4px' }}>
              No recent replayable actions recorded in this session yet.
            </div>
          ) : (
            state.entries.map((entry, idx) => (
              <label
                key={entry.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                  color: 'var(--wf-text-primary)', cursor: 'pointer', padding: '2px 4px',
                }}
              >
                <input
                  type="checkbox"
                  data-testid={`wf-sp-recent-action-${idx}`}
                  checked={state.selectedIds.includes(entry.id)}
                  onChange={() => setState(toggleCreateMacroSelection(state, entry.id))}
                />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</span>
                <span style={{ fontSize: 9, color: 'var(--wf-text-muted)' }}>{entry.commandId}</span>
              </label>
            ))
          )}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--wf-text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            data-testid="wf-sp-create-macro-pin"
            checked={state.pinToPanel}
            onChange={(e) => setState({ ...state, pinToPanel: e.target.checked })}
          />
          Pin to Speed Panel
        </label>

        {state.error && (
          <div role="alert" data-testid="wf-sp-create-macro-error" style={{ fontSize: 11, color: 'var(--wf-danger-text)' }}>
            {state.error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ background: 'transparent', border: '1px solid var(--wf-border-default)', color: 'var(--wf-text-muted)', borderRadius: 4, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
          >Cancel</button>
          <button
            type="submit"
            data-testid="wf-sp-create-macro-save"
            style={{ background: 'var(--wf-accent)', border: 'none', color: 'var(--wf-bg-app)', borderRadius: 4, fontSize: 11, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}
          >Save Macro</button>
        </div>
      </form>
    </div>
  );
}
