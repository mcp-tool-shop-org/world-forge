// SpeedPanel.tsx — floating pointer-anchored command palette with Four-Band layout & tiered search

import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';
import {
  COMMAND_REGISTRY,
  type CommandBadge,
} from '../command-registry.js';
import { HOTKEY_BINDINGS } from '../hotkeys.js';
import {
  SPEED_PANEL_ACTIONS,
} from '../speed-panel-actions.js';
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
} from './speed-panel-stores.js';
import {
  SP_HEADING_IDS,
  buildNavigableEntries,
  buildPinRowHandlers,
  catalogueGroupHeadingId,
  clampActiveIndex,
  commandGlyph,
  computeEdgeClampedOffset,
  customGroupHeadingId,
  dispatchSpeedPanelKeyAction,
  executeSpeedPanelMacro,
  executeSpeedPanelRow,
  splitHighlightSegments,
  type NavEntry,
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
}

export function SpeedPanel({
  onSave,
  initialQuery = '',
  initialExpandedMacro = null,
  initialMacroStatus = null,
  initialCollapsedGroups = [],
}: SpeedPanelProps) {
  const {
    speedPanelPosition,
    speedPanelContext,
    closeSpeedPanel,
    speedPanelEditMode,
    toggleSpeedPanelEditMode,
    selection,
    selectedConnection,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cmdCtx = useMemo(
    () => ({
      hit: speedPanelContext,
      selection,
      selectedConnection,
      project,
    }),
    [speedPanelContext, selection, selectedConnection, project],
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
      }),
    [cmdCtx, query, pinnedIds, frecency, recentIds, adaptiveHistory, groups, macros, project.mode, showRecents],
  );

  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

  const allNavigable: NavEntry[] = useMemo(
    () => buildNavigableEntries(view, collapsedGroups),
    [view, collapsedGroups],
  );

  // Auto-focus without scrolling viewport on mount
  useEffect(() => { inputRef.current?.focus({ preventScroll: true }); }, []);

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

  const execute = useCallback((row: PaletteRow) => {
    executeSpeedPanelRow(row, {
      context: speedPanelContext,
      query,
      executeCommand: executeRegistryCommand,
      stores: productionExecuteStores(),
      hotkeyCtx: productionHotkeyContext(onSave),
      closeSpeedPanel,
      recordCommandUsage,
      pushToast,
    });
  }, [speedPanelContext, onSave, closeSpeedPanel, recordCommandUsage, query]);

  const runMacro = useCallback((macro: Parameters<typeof executeSpeedPanelMacro>[0]) => {
    executeSpeedPanelMacro(macro, {
      context: speedPanelContext,
      runMacroSteps: executeMacro,
      stores: productionExecuteStores(),
      setMacroStatus,
      recordCommandUsage,
      closeSpeedPanel,
    });
  }, [speedPanelContext, recordCommandUsage, closeSpeedPanel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    dispatchSpeedPanelKeyAction(e, {
      view,
      allNavigable,
      activeIdx,
      closeSpeedPanel,
      reorderPin,
      setActiveIdx,
      execute,
      runMacro,
    });
  };

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
        {/* Header: ARIA combobox input + edit toggle */}
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
                              const action = COMMAND_REGISTRY.find((c) => c.id === step.actionId);
                              return (
                                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--wf-text-primary)', padding: '1px 0' }}>
                                  <span style={{ color: 'var(--wf-text-muted)', width: 14 }}>{si + 1}.</span>
                                  <span style={{ flex: 1 }}>{action?.title ?? step.actionId}</span>
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
                      />
                    );
                  })}
                </div>
              )}

              {/* === BAND 4: MODE SUGGESTIONS, CUSTOM GROUPS, & CANONICAL CATALOGUE === */}
              <div data-testid="wf-sp-band-4" role="presentation">
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
                        aria-label={g.group.name}
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
        <CommandBadgeLabel badge={badge} />
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
