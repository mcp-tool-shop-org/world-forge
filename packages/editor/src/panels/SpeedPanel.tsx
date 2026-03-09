// SpeedPanel.tsx — floating command palette triggered by double-right-click
// Sections: PINNED → GROUPS → RECENTS → MACROS → CONTEXTUAL

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';
import { SPEED_PANEL_ACTIONS, filterActions, type SpeedPanelAction, type GroupedActions, type SpeedPanelMacro } from '../speed-panel-actions.js';
import { executeAction, executeMacro, type ExecuteStores } from '../speed-panel-execute.js';

const SECTION_STYLE: React.CSSProperties = { padding: '4px 8px', fontSize: 10, color: '#8b949e', letterSpacing: 0.5 };

export function SpeedPanel() {
  const { speedPanelPosition, speedPanelContext, closeSpeedPanel, speedPanelEditMode, toggleSpeedPanelEditMode,
    selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection,
    setRightTab, setTool, setConnectionStart, setViewport, clearSelection } = useEditorStore();
  const { project, removeSelected, duplicateSelected, removeConnection, addConnection } = useProjectStore();
  const { pinnedIds, togglePin, reorderPin, addRecent, recentIds,
    groups, addGroup, updateGroup, removeGroup, addActionToGroup, removeActionFromGroup,
    macros, addMacro, updateMacro, removeMacro, addStepToMacro, removeStepFromMacro, reorderMacroStep,
  } = useSpeedPanelPins();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [expandedMacro, setExpandedMacro] = useState<string | null>(null);
  const [macroStatus, setMacroStatus] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterActions(SPEED_PANEL_ACTIONS, speedPanelContext, query, pinnedIds, recentIds, groups, macros, project.mode),
    [speedPanelContext, query, pinnedIds, recentIds, groups, macros, project.mode],
  );

  // Build flat navigable list: pinned actions + group actions (uncollapsed) + recents + contextual
  const allNavigable = useMemo(() => {
    const items: Array<{ type: 'action'; action: SpeedPanelAction } | { type: 'macro'; macro: SpeedPanelMacro }> = [];
    for (const a of filtered.pinned) items.push({ type: 'action', action: a });
    for (const g of filtered.groups) {
      if (!collapsedGroups.has(g.group.id)) {
        for (const a of g.actions) items.push({ type: 'action', action: a });
      }
    }
    for (const a of filtered.recents) items.push({ type: 'action', action: a });
    for (const m of filtered.macros) items.push({ type: 'macro', macro: m });
    for (const a of filtered.modeSuggested) items.push({ type: 'action', action: a });
    for (const a of filtered.contextual) items.push({ type: 'action', action: a });
    return items;
  }, [filtered, collapsedGroups]);

  // Auto-focus
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Clamp active index
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Edge clamping
  const [offset, setOffset] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  useEffect(() => {
    if (!panelRef.current || !speedPanelPosition) return;
    const parent = panelRef.current.parentElement;
    if (!parent) return;
    const pRect = parent.getBoundingClientRect();
    const pw = 240, ph = panelRef.current.offsetHeight || 400;
    let left = speedPanelPosition.x;
    let top = speedPanelPosition.y;
    if (left + pw > pRect.width) left = pRect.width - pw - 4;
    if (top + ph > pRect.height) top = pRect.height - ph - 4;
    if (left < 0) left = 4;
    if (top < 0) top = 4;
    setOffset({ left, top });
  }, [speedPanelPosition]);

  // Build the stores bag for executeAction
  const stores: ExecuteStores = useMemo(() => ({
    selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection,
    clearSelection, setRightTab, setTool, setConnectionStart, setViewport,
    removeSelected, duplicateSelected, removeConnection, addConnection, project,
  }), [selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection,
    clearSelection, setRightTab, setTool, setConnectionStart, setViewport,
    removeSelected, duplicateSelected, removeConnection, addConnection, project]);

  const execute = useCallback((actionId: string) => {
    closeSpeedPanel();
    const result = executeAction(actionId, speedPanelContext, stores);
    if (result.executed) {
      addRecent(actionId);
    }
  }, [speedPanelContext, closeSpeedPanel, stores, addRecent]);

  const runMacro = useCallback((macro: SpeedPanelMacro) => {
    const result = executeMacro(macro, speedPanelContext, stores);
    if (result.abortedAt !== undefined) {
      setMacroStatus(`Macro "${macro.name}" aborted at step ${result.abortedAt! + 1}: ${result.reason}`);
    } else {
      addRecent('macro:' + macro.id);
      closeSpeedPanel();
    }
  }, [speedPanelContext, stores, addRecent, closeSpeedPanel]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeSpeedPanel(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allNavigable.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && allNavigable[activeIdx]) {
      e.preventDefault();
      const item = allNavigable[activeIdx];
      if (item.type === 'action') execute(item.action.id);
      else runMacro(item.macro);
      return;
    }
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

  // Track running navigation index
  let navIdx = 0;

  return (
    <>
      {/* Backdrop — click to dismiss */}
      <div onClick={closeSpeedPanel} style={{ position: 'absolute', inset: 0, zIndex: 90 }} />
      {/* Panel */}
      <div
        ref={panelRef}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          left: offset.left || speedPanelPosition.x,
          top: offset.top || speedPanelPosition.y,
          width: 240,
          maxHeight: 400,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 6,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          zIndex: 91,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header: search + edit toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid #30363d' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Quick action..."
            style={{
              background: '#0d1117', color: '#c9d1d9', border: 'none',
              padding: '8px 10px', fontSize: 12, outline: 'none', flex: 1, minWidth: 0,
            }}
          />
          <button
            onClick={toggleSpeedPanelEditMode}
            title={speedPanelEditMode ? 'Exit edit mode' : 'Edit favorites & groups'}
            style={{
              background: speedPanelEditMode ? '#30363d' : 'transparent',
              border: 'none', color: speedPanelEditMode ? '#f0f6fc' : '#8b949e',
              cursor: 'pointer', padding: '0 8px', fontSize: 12,
            }}
          >
            {'\u270E'}
          </button>
        </div>

        {/* Macro status banner */}
        {macroStatus && (
          <div style={{ padding: '4px 8px', fontSize: 10, color: '#f85149', background: '#1c1107', borderBottom: '1px solid #30363d' }}>
            {macroStatus}
            <span onClick={() => setMacroStatus(null)} style={{ cursor: 'pointer', marginLeft: 6, color: '#8b949e' }}>{'\u2715'}</span>
          </div>
        )}

        {/* Scrollable body */}
        <div style={{ overflow: 'auto', flex: 1 }}>

          {/* === PINNED === */}
          {filtered.pinned.length > 0 && <div style={SECTION_STYLE}>PINNED</div>}
          {filtered.pinned.map((a, i) => {
            const idx = navIdx++;
            return (
              <ActionRow
                key={'p-' + a.id} action={a} active={idx === activeIdx} isPinned
                onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)}
                editMode={speedPanelEditMode}
                onMoveUp={i > 0 ? () => reorderPin(i, i - 1) : undefined}
                onMoveDown={i < filtered.pinned.length - 1 ? () => reorderPin(i, i + 1) : undefined}
              />
            );
          })}

          {/* === GROUPS === */}
          {filtered.groups.map((g) => {
            const collapsed = collapsedGroups.has(g.group.id);
            return (
              <div key={'grp-' + g.group.id}>
                <div style={{ ...SECTION_STYLE, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => toggleGroupCollapse(g.group.id)}>
                  <span style={{ marginRight: 4, fontSize: 8 }}>{collapsed ? '\u25B6' : '\u25BC'}</span>
                  {speedPanelEditMode ? (
                    <input
                      value={g.group.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateGroup(g.group.id, { name: e.target.value })}
                      style={{ background: 'transparent', border: '1px solid #30363d', color: '#c9d1d9', fontSize: 10, padding: '1px 4px', flex: 1, outline: 'none', minWidth: 0 }}
                    />
                  ) : (
                    <span style={{ flex: 1 }}>{g.group.name}</span>
                  )}
                  {speedPanelEditMode && (
                    <span
                      onClick={(e) => { e.stopPropagation(); removeGroup(g.group.id); }}
                      style={{ cursor: 'pointer', color: '#f85149', fontSize: 10, marginLeft: 4 }}
                      title="Delete group"
                    >{'\u2715'}</span>
                  )}
                </div>
                {!collapsed && g.actions.map((a) => {
                  const idx = navIdx++;
                  return (
                    <ActionRow
                      key={'ga-' + g.group.id + '-' + a.id} action={a} active={idx === activeIdx} isPinned={false}
                      onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)}
                      editMode={false}
                      groupEditMode={speedPanelEditMode}
                      onRemoveFromGroup={() => removeActionFromGroup(g.group.id, a.id)}
                    />
                  );
                })}
              </div>
            );
          })}
          {speedPanelEditMode && (
            <div style={{ padding: '2px 8px' }}>
              <button
                onClick={handleNewGroup}
                style={{ background: 'transparent', border: '1px dashed #30363d', color: '#8b949e', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 3, width: '100%' }}
              >+ New Group</button>
            </div>
          )}

          {/* === RECENTS === */}
          {filtered.recents.length > 0 && <div style={SECTION_STYLE}>RECENT</div>}
          {filtered.recents.map((a) => {
            const idx = navIdx++;
            return (
              <ActionRow
                key={'r-' + a.id} action={a} active={idx === activeIdx} isPinned={false}
                onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)}
                editMode={false}
              />
            );
          })}

          {/* === MACROS === */}
          {filtered.macros.length > 0 && <div style={SECTION_STYLE}>MACROS</div>}
          {filtered.macros.map((m) => {
            const idx = navIdx++;
            const isExpanded = expandedMacro === m.id && speedPanelEditMode;
            return (
              <div key={'m-' + m.id}>
                <div
                  onClick={() => { if (!speedPanelEditMode) runMacro(m); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '5px 8px', cursor: 'pointer', fontSize: 12,
                    background: idx === activeIdx ? '#30363d' : 'transparent',
                    color: idx === activeIdx ? '#f0f6fc' : '#c9d1d9',
                  }}
                >
                  <span style={{ color: '#3fb950', fontSize: 10, flexShrink: 0 }}>{'\u25B6'}</span>
                  {speedPanelEditMode ? (
                    <input
                      value={m.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateMacro(m.id, { name: e.target.value })}
                      style={{ background: 'transparent', border: '1px solid #30363d', color: '#c9d1d9', fontSize: 12, padding: '1px 4px', flex: 1, outline: 'none', minWidth: 0 }}
                    />
                  ) : (
                    <span style={{ flex: 1 }}>{m.name}</span>
                  )}
                  <span style={{ color: '#8b949e', fontSize: 9 }}>{m.steps.length} step{m.steps.length !== 1 ? 's' : ''}</span>
                  {speedPanelEditMode && (
                    <>
                      <span
                        onClick={(e) => { e.stopPropagation(); setExpandedMacro(isExpanded ? null : m.id); }}
                        style={{ cursor: 'pointer', color: '#8b949e', fontSize: 10 }}
                        title="Edit steps"
                      >{isExpanded ? '\u25BC' : '\u25B6'}</span>
                      <span
                        onClick={(e) => { e.stopPropagation(); removeMacro(m.id); }}
                        style={{ cursor: 'pointer', color: '#f85149', fontSize: 10 }}
                        title="Delete macro"
                      >{'\u2715'}</span>
                    </>
                  )}
                </div>
                {/* Step editor (edit mode only) */}
                {isExpanded && (
                  <div style={{ padding: '2px 16px 4px', borderLeft: '2px solid #30363d', marginLeft: 12 }}>
                    {m.steps.map((step, si) => {
                      const action = SPEED_PANEL_ACTIONS.find((a) => a.id === step.actionId);
                      return (
                        <div key={si} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#c9d1d9', padding: '1px 0' }}>
                          <span style={{ color: '#8b949e', width: 14 }}>{si + 1}.</span>
                          <span style={{ flex: 1 }}>{action?.label ?? step.actionId}</span>
                          <button
                            onClick={() => si > 0 && reorderMacroStep(m.id, si, si - 1)}
                            disabled={si === 0}
                            style={{ background: 'transparent', border: 'none', color: si > 0 ? '#8b949e' : '#30363d', cursor: si > 0 ? 'pointer' : 'default', fontSize: 8, padding: 0 }}
                          >{'\u25B2'}</button>
                          <button
                            onClick={() => si < m.steps.length - 1 && reorderMacroStep(m.id, si, si + 1)}
                            disabled={si === m.steps.length - 1}
                            style={{ background: 'transparent', border: 'none', color: si < m.steps.length - 1 ? '#8b949e' : '#30363d', cursor: si < m.steps.length - 1 ? 'pointer' : 'default', fontSize: 8, padding: 0 }}
                          >{'\u25BC'}</button>
                          <span
                            onClick={() => removeStepFromMacro(m.id, si)}
                            style={{ cursor: 'pointer', color: '#f85149', fontSize: 10 }}
                          >{'\u2715'}</span>
                        </div>
                      );
                    })}
                    {/* Add step — only macroSafe actions */}
                    <select
                      value=""
                      onChange={(e) => { if (e.target.value) addStepToMacro(m.id, e.target.value); }}
                      style={{ background: '#0d1117', color: '#8b949e', border: '1px solid #30363d', fontSize: 10, padding: '2px', width: '100%', marginTop: 2, borderRadius: 2 }}
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
            <div style={{ padding: '2px 8px' }}>
              <button
                onClick={handleNewMacro}
                style={{ background: 'transparent', border: '1px dashed #30363d', color: '#8b949e', cursor: 'pointer', fontSize: 10, padding: '2px 6px', borderRadius: 3, width: '100%' }}
              >+ New Macro</button>
            </div>
          )}

          {/* === MODE SUGGESTIONS === */}
          {filtered.modeSuggested.length > 0 && <div style={SECTION_STYLE}>MODE</div>}
          {filtered.modeSuggested.map((a) => {
            const idx = navIdx++;
            return (
              <ActionRow
                key={'ms-' + a.id} action={a} active={idx === activeIdx} isPinned={false}
                onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)}
                editMode={false}
              />
            );
          })}

          {/* === CONTEXTUAL === */}
          {filtered.contextual.length > 0 && (
            <div style={SECTION_STYLE}>
              {speedPanelContext ? speedPanelContext.type.toUpperCase() : 'CANVAS'}
            </div>
          )}
          {filtered.contextual.map((a) => {
            const idx = navIdx++;
            return (
              <ActionRow
                key={'c-' + a.id} action={a} active={idx === activeIdx} isPinned={false}
                onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)}
                editMode={false}
              />
            );
          })}

          {allNavigable.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 12, color: '#484f58' }}>No actions</div>
          )}
        </div>
      </div>
    </>
  );
}

function ActionRow({ action, active, isPinned, onTogglePin, onExecute, editMode, onMoveUp, onMoveDown, groupEditMode, onRemoveFromGroup }: {
  action: { id: string; label: string; icon: string };
  active: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onExecute: () => void;
  editMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  groupEditMode?: boolean;
  onRemoveFromGroup?: () => void;
}) {
  return (
    <div
      onClick={onExecute}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', cursor: 'pointer', fontSize: 12,
        background: active ? '#30363d' : 'transparent',
        color: active ? '#f0f6fc' : '#c9d1d9',
      }}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        style={{ cursor: 'pointer', fontSize: 11, color: isPinned ? '#ffd700' : '#484f58', userSelect: 'none', flexShrink: 0 }}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        {isPinned ? '\u2605' : '\u2606'}
      </span>
      <span style={{ color: '#8b949e', fontSize: 10, width: 20, textAlign: 'center', flexShrink: 0 }}>{action.icon}</span>
      <span style={{ flex: 1 }}>{action.label}</span>
      {editMode && isPinned && (
        <span style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp?.(); }}
            disabled={!onMoveUp}
            style={{
              background: 'transparent', border: 'none', color: onMoveUp ? '#8b949e' : '#30363d',
              cursor: onMoveUp ? 'pointer' : 'default', fontSize: 10, padding: '0 2px',
            }}
            title="Move up"
          >{'\u25B2'}</button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown?.(); }}
            disabled={!onMoveDown}
            style={{
              background: 'transparent', border: 'none', color: onMoveDown ? '#8b949e' : '#30363d',
              cursor: onMoveDown ? 'pointer' : 'default', fontSize: 10, padding: '0 2px',
            }}
            title="Move down"
          >{'\u25BC'}</button>
        </span>
      )}
      {groupEditMode && onRemoveFromGroup && (
        <span
          onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(); }}
          style={{ cursor: 'pointer', color: '#f85149', fontSize: 10, flexShrink: 0 }}
          title="Remove from group"
        >{'\u2715'}</span>
      )}
    </div>
  );
}
