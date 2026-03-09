// SpeedPanel.tsx — floating command palette triggered by double-right-click

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { useSpeedPanelPins } from '../store/speed-panel-store.js';
import { SPEED_PANEL_ACTIONS, filterActions } from '../speed-panel-actions.js';
import { frameBounds } from '../viewport.js';

export function SpeedPanel() {
  const { speedPanelPosition, speedPanelContext, closeSpeedPanel,
    selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection,
    setRightTab, setTool, setConnectionStart, setViewport, clearSelection } = useEditorStore();
  const { project, removeSelected, duplicateSelected, removeConnection, addConnection } = useProjectStore();
  const { pinnedIds, togglePin } = useSpeedPanelPins();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const { pinned, contextual } = useMemo(
    () => filterActions(SPEED_PANEL_ACTIONS, speedPanelContext, query, pinnedSet),
    [speedPanelContext, query, pinnedSet],
  );
  const allActions = useMemo(() => [...pinned, ...contextual], [pinned, contextual]);

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
    const pw = 240, ph = panelRef.current.offsetHeight || 320;
    let left = speedPanelPosition.x;
    let top = speedPanelPosition.y;
    if (left + pw > pRect.width) left = pRect.width - pw - 4;
    if (top + ph > pRect.height) top = pRect.height - ph - 4;
    if (left < 0) left = 4;
    if (top < 0) top = 4;
    setOffset({ left, top });
  }, [speedPanelPosition]);

  // Select hit from context
  const selectFromContext = useCallback(() => {
    const ctx = speedPanelContext;
    if (!ctx) return;
    if (ctx.type === 'connection') {
      const [from, to] = ctx.id.split('::');
      selectConnection(from, to);
    } else if (ctx.type === 'zone') selectZone(ctx.id, false);
    else if (ctx.type === 'entity') selectEntity(ctx.id, false);
    else if (ctx.type === 'landmark') selectLandmark(ctx.id, false);
    else if (ctx.type === 'spawn') selectSpawn(ctx.id, false);
    else if (ctx.type === 'encounter') selectEncounter(ctx.id, false);
  }, [speedPanelContext, selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection]);

  const execute = useCallback((actionId: string) => {
    const ctx = speedPanelContext;
    closeSpeedPanel();

    switch (actionId) {
      case 'edit-props':
        if (ctx) { selectFromContext(); setRightTab('map'); }
        break;
      case 'delete':
        if (ctx) {
          if (ctx.type === 'connection') {
            const [from, to] = ctx.id.split('::');
            removeConnection(from, to);
          } else {
            selectFromContext();
            // Build a minimal selection for removeSelected
            const sel = { zones: [] as string[], entities: [] as string[], landmarks: [] as string[], spawns: [] as string[], encounters: [] as string[] };
            const key = ctx.type === 'zone' ? 'zones' : ctx.type === 'entity' ? 'entities' : ctx.type === 'landmark' ? 'landmarks' : ctx.type === 'spawn' ? 'spawns' : 'encounters';
            sel[key] = [ctx.id];
            removeSelected(sel);
          }
          clearSelection();
        }
        break;
      case 'duplicate':
        if (ctx) {
          selectFromContext();
          const sel = { zones: [] as string[], entities: [] as string[], landmarks: [] as string[], spawns: [] as string[], encounters: [] as string[] };
          const key = ctx.type === 'zone' ? 'zones' : ctx.type === 'entity' ? 'entities' : ctx.type === 'landmark' ? 'landmarks' : 'spawns';
          sel[key] = [ctx.id];
          duplicateSelected(sel);
        }
        break;
      case 'new-zone':
        setTool('zone-paint');
        break;
      case 'fit-content': {
        const tileSize = project.map.tileSize;
        const items = project.zones.map((z) => ({ gridX: z.gridX, gridY: z.gridY, gridWidth: z.gridWidth, gridHeight: z.gridHeight }));
        const vp = frameBounds(items, tileSize, 800, 600);
        if (vp) setViewport(vp);
        break;
      }
      case 'assign-district':
        if (ctx?.type === 'zone') { selectZone(ctx.id, false); setRightTab('map'); }
        break;
      case 'place-entity':
        if (ctx?.type === 'zone') setTool('entity-place');
        break;
      case 'connect-from':
        if (ctx?.type === 'zone') { setTool('connection'); setConnectionStart(ctx.id); }
        break;
      case 'swap-direction':
        if (ctx?.type === 'connection') {
          const [from, to] = ctx.id.split('::');
          const conn = project.connections.find((c) => c.fromZoneId === from && c.toZoneId === to);
          if (conn) {
            removeConnection(from, to);
            addConnection({ ...conn, fromZoneId: to, toZoneId: from });
          }
        }
        break;
    }
  }, [speedPanelContext, closeSpeedPanel, selectFromContext, setRightTab, setTool, setConnectionStart, setViewport, clearSelection, removeSelected, duplicateSelected, removeConnection, addConnection, project, selectZone]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); closeSpeedPanel(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allActions.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && allActions[activeIdx]) { e.preventDefault(); execute(allActions[activeIdx].id); return; }
  };

  if (!speedPanelPosition) return null;

  return (
    <>
      {/* Backdrop — click to dismiss */}
      <div
        onClick={closeSpeedPanel}
        style={{ position: 'absolute', inset: 0, zIndex: 90 }}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        onKeyDown={handleKeyDown}
        style={{
          position: 'absolute',
          left: offset.left || speedPanelPosition.x,
          top: offset.top || speedPanelPosition.y,
          width: 240,
          maxHeight: 320,
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
        {/* Search input */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick action..."
          style={{
            background: '#0d1117', color: '#c9d1d9', border: 'none',
            borderBottom: '1px solid #30363d',
            padding: '8px 10px', fontSize: 12, outline: 'none',
          }}
        />
        {/* Actions */}
        <div style={{ overflow: 'auto', flex: 1 }}>
          {pinned.length > 0 && (
            <div style={{ padding: '4px 8px', fontSize: 10, color: '#8b949e', letterSpacing: 0.5 }}>PINNED</div>
          )}
          {pinned.map((a, i) => (
            <ActionRow key={a.id} action={a} active={i === activeIdx} isPinned onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)} />
          ))}
          {contextual.length > 0 && (
            <div style={{ padding: '4px 8px', fontSize: 10, color: '#8b949e', letterSpacing: 0.5 }}>
              {speedPanelContext ? speedPanelContext.type.toUpperCase() : 'CANVAS'}
            </div>
          )}
          {contextual.map((a, i) => (
            <ActionRow key={a.id} action={a} active={pinned.length + i === activeIdx} isPinned={false} onTogglePin={() => togglePin(a.id)} onExecute={() => execute(a.id)} />
          ))}
          {allActions.length === 0 && (
            <div style={{ padding: '12px 10px', fontSize: 12, color: '#484f58' }}>No actions</div>
          )}
        </div>
      </div>
    </>
  );
}

function ActionRow({ action, active, isPinned, onTogglePin, onExecute }: {
  action: { id: string; label: string; icon: string };
  active: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onExecute: () => void;
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
    </div>
  );
}
