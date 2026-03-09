// Canvas.tsx — main viewport with multi-select, box-select, drag-move, pan & zoom

import { useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore, getSelectionCount, getSelectedZoneId, getSelectedConnection, isSelected as isSel } from './store/editor-store.js';
import { getConnectionEndpoints, findConnectionAt, getKindStyle, connectionMidpoint } from './connection-lines.js';
import { centerOnZone, MIN_ZOOM, MAX_ZOOM } from './viewport.js';
import { findHitAt, findAllHitsAt, findAllInRect } from './hit-testing.js';
import { computeSnap, getNonSelectedEdges, computeResizeSnap, type SnapGuide } from './snap.js';
import { getHandles, findHandleAt, applyResize, HANDLE_SCREEN_RADIUS, type HandleKind, type ResizeResult } from './resize-handles.js';
import type { Zone } from '@world-forge/schema';

const ZOOM_STEP = 0.1;
const DRAG_THRESHOLD = 3; // screen pixels before drag-move activates

let nextZoneId = 1;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, addZone, addConnection, removeConnection, addEntity, addSpawnPoint, moveSelected, resizeZone, removeSelected, duplicateSelected } = useProjectStore();
  const {
    activeTool, showGrid, selection, hoveredZoneId,
    showConnections, showEntities, showLandmarks, showSpawns, showAmbient, snapToObjects,
    selectZone, selectEntity, selectLandmark, selectSpawn, selectConnection,
    selectedConnection,
    setSelectedZone, setHoveredZone, selectAll, clearSelection,
    connectionStart, setConnectionStart,
    viewport, setViewport, setShowSearch,
  } = useEditorStore();

  const tileSize = project.map.tileSize;
  const zonePaintStart = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const spaceHeld = useRef(false);
  const hasFitted = useRef(false);

  // Box-select state
  const boxSelect = useRef<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  // Drag-move state
  const dragMove = useRef<{
    startSX: number; startSY: number; startGX: number; startGY: number;
    active: boolean; lastDX: number; lastDY: number;
  } | null>(null);

  // Snap state for drag
  const activeGuides = useRef<SnapGuide[]>([]);
  const snapDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Resize state
  const resizeMove = useRef<{
    zoneId: string; handleKind: HandleKind;
    startSX: number; startSY: number; startGX: number; startGY: number;
    active: boolean; lastResult: ResizeResult | null;
  } | null>(null);
  const hoveredHandle = useRef<HandleKind | null>(null);
  const hoveredConnection = useRef<{ from: string; to: string } | null>(null);

  // Click-cycle state for overlapping objects
  const CYCLE_TOLERANCE = 4;
  const lastClickPos = useRef<{ sx: number; sy: number } | null>(null);
  const cycleIndex = useRef(0);

  // --- Coordinate conversion ---
  const screenToWorld = useCallback((screenX: number, screenY: number) => ({
    worldX: screenX / viewport.zoom + viewport.panX,
    worldY: screenY / viewport.zoom + viewport.panY,
  }), [viewport]);

  const screenToGrid = useCallback((screenX: number, screenY: number) => {
    const { worldX, worldY } = screenToWorld(screenX, screenY);
    return { gx: Math.floor(worldX / tileSize), gy: Math.floor(worldY / tileSize) };
  }, [screenToWorld, tileSize]);

  // --- Fit to content on first render ---
  useEffect(() => {
    if (hasFitted.current || project.zones.length === 0) return;
    hasFitted.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;
    if (cw === 0 || ch === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of project.zones) {
      minX = Math.min(minX, z.gridX * tileSize);
      minY = Math.min(minY, z.gridY * tileSize);
      maxX = Math.max(maxX, (z.gridX + z.gridWidth) * tileSize);
      maxY = Math.max(maxY, (z.gridY + z.gridHeight) * tileSize);
    }
    for (const ep of project.entityPlacements) {
      const zone = project.zones.find((z) => z.id === ep.zoneId);
      if (!zone) continue;
      const ex = (ep.gridX ?? zone.gridX + 2) * tileSize;
      const ey = (ep.gridY ?? zone.gridY + 2) * tileSize;
      minX = Math.min(minX, ex); minY = Math.min(minY, ey);
      maxX = Math.max(maxX, ex); maxY = Math.max(maxY, ey);
    }
    for (const lm of project.landmarks) {
      minX = Math.min(minX, lm.gridX * tileSize);
      minY = Math.min(minY, lm.gridY * tileSize);
      maxX = Math.max(maxX, lm.gridX * tileSize);
      maxY = Math.max(maxY, lm.gridY * tileSize);
    }
    for (const sp of project.spawnPoints) {
      minX = Math.min(minX, sp.gridX * tileSize);
      minY = Math.min(minY, sp.gridY * tileSize);
      maxX = Math.max(maxX, sp.gridX * tileSize);
      maxY = Math.max(maxY, sp.gridY * tileSize);
    }

    const pad = 64;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return;

    const zoom = Math.min(Math.max(Math.min(cw / bw, ch / bh), MIN_ZOOM), MAX_ZOOM);
    const panX = minX - (cw / zoom - bw) / 2;
    const panY = minY - (ch / zoom - bh) / 2;
    setViewport({ panX, panY, zoom });
  }, [project.zones.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Drawing ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { panX, panY, zoom } = viewport;
    ctx.setTransform(zoom, 0, 0, zoom, -panX * zoom, -panY * zoom);

    // Drag preview offset (grid cells → world pixels)
    const isDragging = dragMove.current?.active ?? false;
    const dragDX = isDragging ? snapDelta.current.dx : 0;
    const dragDY = isDragging ? snapDelta.current.dy : 0;

    // Resize preview state
    const isResizing = resizeMove.current?.active ?? false;
    const resizeResult = resizeMove.current?.lastResult;
    const resizeZoneId = resizeMove.current?.zoneId;

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1 / zoom;
      for (let x = 0; x <= project.map.gridWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tileSize, 0);
        ctx.lineTo(x * tileSize, project.map.gridHeight * tileSize);
        ctx.stroke();
      }
      for (let y = 0; y <= project.map.gridHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * tileSize);
        ctx.lineTo(project.map.gridWidth * tileSize, y * tileSize);
        ctx.stroke();
      }
    }

    // Connections (edge-anchored with visual states)
    if (showConnections) {
      // Build override map for drag/resize preview geometry
      const zoneOverrides = new Map<string, { gridX: number; gridY: number; gridWidth: number; gridHeight: number }>();
      for (const zone of project.zones) {
        if (isResizing && zone.id === resizeZoneId && resizeResult) {
          zoneOverrides.set(zone.id, resizeResult);
        } else if (isDragging && selection.zones.includes(zone.id)) {
          zoneOverrides.set(zone.id, { gridX: zone.gridX + dragDX, gridY: zone.gridY + dragDY, gridWidth: zone.gridWidth, gridHeight: zone.gridHeight });
        }
      }

      for (const conn of project.connections) {
        const endpoints = getConnectionEndpoints(conn, project.zones, tileSize, zoneOverrides);
        if (!endpoints) continue;

        const isHovered = hoveredConnection.current?.from === conn.fromZoneId && hoveredConnection.current?.to === conn.toZoneId;
        const isSelConn = selectedConnection?.from === conn.fromZoneId && selectedConnection?.to === conn.toZoneId;
        const kindStyle = getKindStyle(conn.kind);

        // Visual state
        if (isSelConn) {
          ctx.strokeStyle = '#58a6ff';
          ctx.lineWidth = 3 / zoom;
        } else if (isHovered) {
          ctx.strokeStyle = kindStyle.hoverColor;
          ctx.lineWidth = 2 / zoom;
        } else {
          ctx.strokeStyle = kindStyle.color;
          ctx.lineWidth = 1 / zoom;
        }

        // Dashing: condition overrides kind dash
        if (conn.condition && !isSelConn) {
          ctx.setLineDash([6 / zoom, 4 / zoom]);
        } else if (!isSelConn && kindStyle.dash) {
          ctx.setLineDash(kindStyle.dash.map((d) => d / zoom));
        }

        ctx.beginPath();
        ctx.moveTo(endpoints.fx, endpoints.fy);
        ctx.lineTo(endpoints.tx, endpoints.ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Arrowhead for non-bidirectional connections
        if (!conn.bidirectional) {
          const dx = endpoints.tx - endpoints.fx;
          const dy = endpoints.ty - endpoints.fy;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0) {
            const ux = dx / len;
            const uy = dy / len;
            const arrowSize = 8 / zoom;
            const ax = endpoints.tx;
            const ay = endpoints.ty;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - ux * arrowSize + uy * arrowSize * 0.5, ay - uy * arrowSize - ux * arrowSize * 0.5);
            ctx.lineTo(ax - ux * arrowSize - uy * arrowSize * 0.5, ay - uy * arrowSize + ux * arrowSize * 0.5);
            ctx.closePath();
            ctx.fillStyle = ctx.strokeStyle;
            ctx.fill();
          }
        }

        // Label at midpoint when zoomed in enough
        if (conn.label && zoom > 0.3) {
          const mid = connectionMidpoint(endpoints);
          const fontSize = Math.max(8, Math.min(12, 10 / zoom));
          ctx.save();
          ctx.font = `${fontSize / zoom}px 'Segoe UI', system-ui, sans-serif`;
          const textW = ctx.measureText(conn.label).width;
          const pad = 3 / zoom;
          ctx.fillStyle = 'rgba(13,17,23,0.85)';
          ctx.fillRect(mid.mx - textW / 2 - pad, mid.my - fontSize / zoom / 2 - pad, textW + pad * 2, fontSize / zoom + pad * 2);
          ctx.fillStyle = '#c9d1d9';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(conn.label, mid.mx, mid.my);
          ctx.restore();
        }
      }
    }

    // Zones
    const colors = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#20c997'];
    for (const zone of project.zones) {
      const selected = selection.zones.includes(zone.id);
      const isResizeTarget = isResizing && zone.id === resizeZoneId && resizeResult;
      const offX = selected && isDragging && !isResizeTarget ? dragDX : 0;
      const offY = selected && isDragging && !isResizeTarget ? dragDY : 0;
      const zx = isResizeTarget ? resizeResult.gridX : zone.gridX + offX;
      const zy = isResizeTarget ? resizeResult.gridY : zone.gridY + offY;
      const zw = isResizeTarget ? resizeResult.gridWidth : zone.gridWidth;
      const zh = isResizeTarget ? resizeResult.gridHeight : zone.gridHeight;
      const x = zx * tileSize;
      const y = zy * tileSize;
      const w = zw * tileSize;
      const h = zh * tileSize;

      const distIdx = project.districts.findIndex((d) => d.id === zone.parentDistrictId);
      const color = colors[distIdx % colors.length] ?? '#888';

      const hovered = zone.id === hoveredZoneId;

      ctx.fillStyle = selected ? color + '50' : hovered ? color + '30' : color + '10';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color + (selected ? 'ff' : hovered ? 'cc' : '80');
      ctx.lineWidth = (selected ? 3 : hovered ? 2 : 1) / zoom;
      ctx.strokeRect(x, y, w, h);

      // Zone label with dark background pill
      const fontSize = Math.max(9, Math.min(14, 11 / zoom));
      ctx.font = `${fontSize}px monospace`;
      const labelX = x + 4 / zoom;
      const labelY = y + (fontSize + 3) / zoom;
      const textWidth = ctx.measureText(zone.name).width;
      const labelPad = 2 / zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(labelX - labelPad, labelY - fontSize + labelPad, textWidth + labelPad * 2, fontSize + labelPad);
      ctx.fillStyle = selected ? '#fff' : '#ccc';
      ctx.fillText(zone.name, labelX, labelY);
    }

    // Entities
    if (showEntities) {
      for (const ep of project.entityPlacements) {
        const zone = project.zones.find((z) => z.id === ep.zoneId);
        if (!zone) continue;
        const selected = isSel(selection, 'entity', ep.entityId);
        const canDrag = selected && isDragging && ep.gridX != null && ep.gridY != null;
        const x = ((ep.gridX ?? zone.gridX + 2) + (canDrag ? dragDX : 0)) * tileSize;
        const y = ((ep.gridY ?? zone.gridY + 2) + (canDrag ? dragDY : 0)) * tileSize;
        const roleColors: Record<string, string> = {
          npc: '#4a9eff', enemy: '#ff4444', merchant: '#ffd700',
          'quest-giver': '#44ff44', companion: '#44ffaa', boss: '#ff2222',
        };
        ctx.fillStyle = roleColors[ep.role] ?? '#888';
        ctx.beginPath();
        const radius = (ep.role === 'boss' ? 8 : 5) / zoom;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        // Selection ring
        if (selected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / zoom;
          ctx.beginPath();
          ctx.arc(x, y, radius + 3 / zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#aaa';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText(ep.entityId, x + 10 / zoom, y + 3 / zoom);
      }
    }

    // Landmarks
    if (showLandmarks) {
      for (const lm of project.landmarks) {
        const zone = project.zones.find((z) => z.id === lm.zoneId);
        if (!zone) continue;
        const selected = isSel(selection, 'landmark', lm.id);
        const x = (lm.gridX + (selected && isDragging ? dragDX : 0)) * tileSize;
        const y = (lm.gridY + (selected && isDragging ? dragDY : 0)) * tileSize;
        const s = 6 / zoom;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 5 / 6, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 5 / 6, y);
        ctx.closePath();
        ctx.fill();
        // Selection ring
        if (selected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / zoom;
          ctx.beginPath();
          ctx.arc(x, y, s + 2 / zoom, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#ffd700';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText(lm.name, x + 8 / zoom, y + 3 / zoom);
      }
    }

    // Spawn points
    if (showSpawns) {
      for (const sp of project.spawnPoints) {
        const selected = isSel(selection, 'spawn', sp.id);
        const x = (sp.gridX + (selected && isDragging ? dragDX : 0)) * tileSize;
        const y = (sp.gridY + (selected && isDragging ? dragDY : 0)) * tileSize;
        const s = 4 / zoom;
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
        // Selection ring
        if (selected) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / zoom;
          ctx.strokeRect(x - s - 2 / zoom, y - s - 2 / zoom, s * 2 + 4 / zoom, s * 2 + 4 / zoom);
        }
        ctx.fillStyle = '#aaa';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText('SPAWN', x + 8 / zoom, y + 3 / zoom);
      }
    }

    // Ambient overlays
    if (showAmbient) {
      for (const al of project.ambientLayers) {
        for (const azId of al.zoneIds) {
          const zone = project.zones.find((z) => z.id === azId);
          if (!zone) continue;
          const x = zone.gridX * tileSize;
          const y = zone.gridY * tileSize;
          const w = zone.gridWidth * tileSize;
          const h = zone.gridHeight * tileSize;
          const color = al.color ?? '#888888';
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${r},${g},${b},${al.intensity * 0.3})`;
          ctx.fillRect(x, y, w, h);
        }
      }
    }

    // Resize handles (world-space, single zone selected)
    if (activeTool === 'select') {
      const singleZoneId = getSelectedZoneId(selection);
      if (singleZoneId) {
        const szone = project.zones.find((z) => z.id === singleZoneId);
        if (szone) {
          const hZone = isResizing && singleZoneId === resizeZoneId && resizeResult
            ? resizeResult
            : { gridX: szone.gridX, gridY: szone.gridY, gridWidth: szone.gridWidth, gridHeight: szone.gridHeight };
          const handles = getHandles(hZone);
          const hRadius = HANDLE_SCREEN_RADIUS / zoom;
          for (const h of handles) {
            const hx = h.gx * tileSize;
            const hy = h.gy * tileSize;
            ctx.beginPath();
            ctx.arc(hx, hy, hRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#4a9eff';
            ctx.lineWidth = 2 / zoom;
            ctx.stroke();
          }
        }
      }
    }

    // Snap guide lines (world-space) — drag and resize
    if ((isDragging || isResizing) && activeGuides.current.length > 0) {
      ctx.strokeStyle = 'rgba(0, 180, 255, 0.7)';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 4 / zoom]);
      for (const guide of activeGuides.current) {
        ctx.beginPath();
        if (guide.axis === 'x') {
          ctx.moveTo(guide.value * tileSize, guide.from * tileSize);
          ctx.lineTo(guide.value * tileSize, guide.to * tileSize);
        } else {
          ctx.moveTo(guide.from * tileSize, guide.value * tileSize);
          ctx.lineTo(guide.to * tileSize, guide.value * tileSize);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Reset transform for screen-space overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Box-select rectangle (screen-space)
    if (boxSelect.current) {
      const { startX, startY, curX, curY } = boxSelect.current;
      ctx.strokeStyle = 'rgba(74, 158, 255, 0.8)';
      ctx.fillStyle = 'rgba(74, 158, 255, 0.15)';
      ctx.lineWidth = 1;
      const rx = Math.min(startX, curX);
      const ry = Math.min(startY, curY);
      const rw = Math.abs(curX - startX);
      const rh = Math.abs(curY - startY);
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);
    }

    // Selection count badge (screen-space)
    const selCount = getSelectionCount(selection);
    if (selCount > 1) {
      const label = `${selCount} selected`;
      ctx.font = '11px monospace';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(8, 8, tw + 12, 20);
      ctx.fillStyle = '#58a6ff';
      ctx.fillText(label, 14, 22);
    }
  }, [project, showGrid, showConnections, showEntities, showLandmarks, showSpawns, showAmbient, selection, selectedConnection, hoveredZoneId, tileSize, viewport]);

  useEffect(() => {
    draw();
    const handle = () => draw();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [draw]);

  // --- Keyboard events ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
        return;
      }

      if (e.code === 'Escape') {
        clearSelection();
        dragMove.current = null;
        resizeMove.current = null;
        activeGuides.current = [];
        snapDelta.current = { dx: 0, dy: 0 };
        return;
      }

      // Ctrl/Cmd+K = open search
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyK') {
        e.preventDefault();
        setShowSearch(true);
        return;
      }

      // Ctrl/Cmd+D = duplicate selected
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyD') {
        e.preventDefault();
        if (getSelectionCount(selection) > 0) {
          const newSel = duplicateSelected(selection);
          selectAll(newSel, false);
        }
        return;
      }

      // Ctrl/Cmd+A = select all visible objects
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyA') {
        e.preventDefault();
        const zones = project.zones.map((z) => z.id);
        const entities = showEntities ? project.entityPlacements.map((e) => e.entityId) : [];
        const landmarks = showLandmarks ? project.landmarks.map((l) => l.id) : [];
        const spawns = showSpawns ? project.spawnPoints.map((s) => s.id) : [];
        selectAll({ zones, entities, landmarks, spawns }, false);
        return;
      }

      // Delete/Backspace = delete selected
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedConnection) {
          removeConnection(selectedConnection.from, selectedConnection.to);
          clearSelection();
          return;
        }
        const count = getSelectionCount(selection);
        if (count === 0) return;
        if (count > 3 && !confirm(`Delete ${count} objects?`)) return;
        removeSelected(selection);
        clearSelection();
        return;
      }

      // Arrow keys = nudge selected
      const arrowDirs: Record<string, [number, number]> = {
        ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      };
      const dir = arrowDirs[e.code];
      if (dir && getSelectionCount(selection) > 0) {
        e.preventDefault();
        const mult = e.shiftKey ? 5 : 1;
        moveSelected(selection, dir[0] * mult, dir[1] * mult);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selection, selectedConnection, project, showEntities, showLandmarks, showSpawns, clearSelection, selectAll, moveSelected, removeSelected, removeConnection, setShowSearch, duplicateSelected]);

  // --- Mouse coordinate helpers ---
  const getScreenXY = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { sx: e.clientX - rect.left, sy: e.clientY - rect.top };
  };

  const gridPos = (e: React.MouseEvent) => {
    const { sx, sy } = getScreenXY(e);
    return screenToGrid(sx, sy);
  };

  const findZoneAt = (gx: number, gy: number): Zone | undefined =>
    project.zones.find((z) =>
      gx >= z.gridX && gx < z.gridX + z.gridWidth &&
      gy >= z.gridY && gy < z.gridY + z.gridHeight,
    );

  const visibility = { showEntities, showLandmarks, showSpawns, showConnections };

  // --- Check if a hit result is already selected ---
  const hitIsSelected = (hit: { type: string; id: string } | null) => {
    if (!hit) return false;
    if (hit.type === 'connection') {
      const [from, to] = hit.id.split('::');
      return selectedConnection?.from === from && selectedConnection?.to === to;
    }
    const t = hit.type as 'zone' | 'entity' | 'landmark' | 'spawn';
    return isSel(selection, t, hit.id);
  };

  // --- Dispatch selection for a hit result ---
  const selectHit = (hit: { type: string; id: string }, additive: boolean) => {
    if (hit.type === 'connection') {
      const [from, to] = hit.id.split('::');
      selectConnection(from, to);
    } else if (hit.type === 'zone') selectZone(hit.id, additive);
    else if (hit.type === 'entity') selectEntity(hit.id, additive);
    else if (hit.type === 'landmark') selectLandmark(hit.id, additive);
    else if (hit.type === 'spawn') selectSpawn(hit.id, additive);
  };

  // --- Mouse handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Pan: middle mouse, right mouse, or space+left
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      return;
    }

    if (e.button !== 0) return;
    const { sx, sy } = getScreenXY(e);
    const { gx, gy } = screenToGrid(sx, sy);

    if (activeTool === 'select') {
      // Resize handle priority: check before body hit-testing
      const singleZoneId = getSelectedZoneId(selection);
      if (singleZoneId) {
        const szone = project.zones.find((z) => z.id === singleZoneId);
        if (szone) {
          const handleHit = findHandleAt(sx, sy, szone, tileSize, viewport);
          if (handleHit) {
            resizeMove.current = {
              zoneId: singleZoneId, handleKind: handleHit,
              startSX: sx, startSY: sy, startGX: gx, startGY: gy,
              active: false, lastResult: null,
            };
            return;
          }
        }
      }

      // Click-cycle: find all objects at this point, cycle on repeated clicks
      const allHits = findAllHitsAt(sx, sy, viewport, project, tileSize, visibility);
      let hit = allHits[0] ?? null;

      if (allHits.length > 1 && lastClickPos.current) {
        const dx = sx - lastClickPos.current.sx;
        const dy = sy - lastClickPos.current.sy;
        if (Math.sqrt(dx * dx + dy * dy) < CYCLE_TOLERANCE) {
          cycleIndex.current = (cycleIndex.current + 1) % allHits.length;
          hit = allHits[cycleIndex.current];
        } else {
          cycleIndex.current = 0;
        }
      } else {
        cycleIndex.current = 0;
      }
      lastClickPos.current = { sx, sy };

      if (hit) {
        if (e.shiftKey) {
          // Additive select — toggle, no drag
          selectHit(hit, true);
        } else if (hitIsSelected(hit)) {
          // Already selected — start drag tracking (don't change selection)
          dragMove.current = { startSX: sx, startSY: sy, startGX: gx, startGY: gy, active: false, lastDX: 0, lastDY: 0 };
        } else {
          // Not selected — replace selection, start drag tracking
          selectHit(hit, false);
          dragMove.current = { startSX: sx, startSY: sy, startGX: gx, startGY: gy, active: false, lastDX: 0, lastDY: 0 };
        }
      } else {
        // No hit — start box-select
        if (!e.shiftKey) clearSelection();
        boxSelect.current = { startX: sx, startY: sy, curX: sx, curY: sy };
      }
    } else if (activeTool === 'zone-paint') {
      zonePaintStart.current = { x: gx, y: gy };
    } else if (activeTool === 'connection') {
      const zone = findZoneAt(gx, gy);
      if (zone) {
        if (connectionStart) {
          if (connectionStart !== zone.id) {
            addConnection({ fromZoneId: connectionStart, toZoneId: zone.id, bidirectional: true });
          }
          setConnectionStart(null);
        } else {
          setConnectionStart(zone.id);
        }
      }
    } else if (activeTool === 'entity-place') {
      const zone = findZoneAt(gx, gy);
      if (zone) {
        addEntity({
          entityId: `entity-${Date.now()}`,
          zoneId: zone.id,
          gridX: gx, gridY: gy,
          role: 'npc',
        });
      }
    } else if (activeTool === 'spawn') {
      addSpawnPoint({
        id: `spawn-${Date.now()}`,
        zoneId: findZoneAt(gx, gy)?.id ?? '',
        gridX: gx, gridY: gy,
        isDefault: project.spawnPoints.length === 0,
      });
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
      return;
    }

    // Resize commit
    if (resizeMove.current?.active && resizeMove.current.lastResult) {
      resizeZone(resizeMove.current.zoneId, resizeMove.current.lastResult);
      resizeMove.current = null;
      activeGuides.current = [];
      draw();
      return;
    }
    resizeMove.current = null;

    // Drag-move commit
    if (dragMove.current?.active) {
      const dx = snapDelta.current.dx;
      const dy = snapDelta.current.dy;
      if (dx !== 0 || dy !== 0) {
        moveSelected(selection, dx, dy);
      }
      dragMove.current = null;
      activeGuides.current = [];
      snapDelta.current = { dx: 0, dy: 0 };
      draw();
      return;
    }
    dragMove.current = null;

    // Box-select commit
    if (boxSelect.current) {
      const { startX, startY, curX, curY } = boxSelect.current;
      const rect = { x1: startX, y1: startY, x2: curX, y2: curY };
      const result = findAllInRect(rect, viewport, project, tileSize, visibility);
      const hasItems = result.zones.length + result.entities.length + result.landmarks.length + result.spawns.length > 0;
      if (hasItems) {
        selectAll(result, e.shiftKey);
      }
      boxSelect.current = null;
      draw();
      return;
    }

    // Zone-paint commit
    if (activeTool === 'zone-paint' && zonePaintStart.current) {
      const { gx, gy } = gridPos(e);
      const sx = Math.min(zonePaintStart.current.x, gx);
      const sy = Math.min(zonePaintStart.current.y, gy);
      const w = Math.abs(gx - zonePaintStart.current.x) + 1;
      const h = Math.abs(gy - zonePaintStart.current.y) + 1;
      if (w >= 2 && h >= 2) {
        const id = `zone-${nextZoneId++}`;
        addZone({
          id,
          name: `Zone ${nextZoneId - 1}`,
          tags: [], description: '',
          gridX: sx, gridY: sy, gridWidth: w, gridHeight: h,
          neighbors: [], exits: [],
          light: 5, noise: 0, hazards: [], interactables: [],
        });
        setSelectedZone(id);
      }
      zonePaintStart.current = null;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current && panStart.current) {
      const dx = (e.clientX - panStart.current.x) / viewport.zoom;
      const dy = (e.clientY - panStart.current.y) / viewport.zoom;
      setViewport({
        panX: panStart.current.panX - dx,
        panY: panStart.current.panY - dy,
      });
      return;
    }

    const { sx, sy } = getScreenXY(e);

    // Resize tracking
    if (resizeMove.current) {
      if (!resizeMove.current.active) {
        const ddx = sx - resizeMove.current.startSX;
        const ddy = sy - resizeMove.current.startSY;
        if (Math.sqrt(ddx * ddx + ddy * ddy) >= DRAG_THRESHOLD) {
          resizeMove.current.active = true;
        }
      }
      if (resizeMove.current.active) {
        const { gx: curGX, gy: curGY } = screenToGrid(sx, sy);
        let rawDX = curGX - resizeMove.current.startGX;
        let rawDY = curGY - resizeMove.current.startGY;
        const zone = project.zones.find((z) => z.id === resizeMove.current!.zoneId);
        if (zone) {
          if (snapToObjects) {
            const candidates = getNonSelectedEdges(project, selection);
            const snapResult = computeResizeSnap(zone, resizeMove.current.handleKind, rawDX, rawDY, candidates);
            rawDX = snapResult.dx;
            rawDY = snapResult.dy;
            activeGuides.current = snapResult.guides;
          } else {
            activeGuides.current = [];
          }
          resizeMove.current.lastResult = applyResize(zone, resizeMove.current.handleKind, rawDX, rawDY);
        }
        draw();
      }
      return;
    }

    // Drag-move tracking
    if (dragMove.current) {
      if (!dragMove.current.active) {
        const ddx = sx - dragMove.current.startSX;
        const ddy = sy - dragMove.current.startSY;
        if (Math.sqrt(ddx * ddx + ddy * ddy) >= DRAG_THRESHOLD) {
          dragMove.current.active = true;
        }
      }
      if (dragMove.current.active) {
        const { gx: curGX, gy: curGY } = screenToGrid(sx, sy);
        const rawDX = curGX - dragMove.current.startGX;
        const rawDY = curGY - dragMove.current.startGY;
        if (snapToObjects) {
          const result = computeSnap(project, selection, rawDX, rawDY);
          snapDelta.current = { dx: result.dx, dy: result.dy };
          activeGuides.current = result.guides;
        } else {
          snapDelta.current = { dx: rawDX, dy: rawDY };
          activeGuides.current = [];
        }
        draw();
      }
      return;
    }

    // Box-select tracking
    if (boxSelect.current) {
      boxSelect.current.curX = sx;
      boxSelect.current.curY = sy;
      draw();
      return;
    }

    // Handle hover detection
    const singleZId = getSelectedZoneId(selection);
    if (singleZId && activeTool === 'select') {
      const sz = project.zones.find((z) => z.id === singleZId);
      if (sz) {
        hoveredHandle.current = findHandleAt(sx, sy, sz, tileSize, viewport);
      } else {
        hoveredHandle.current = null;
      }
    } else {
      hoveredHandle.current = null;
    }

    // Connection hover tracking
    if (showConnections && activeTool === 'select') {
      hoveredConnection.current = findConnectionAt(sx, sy, project.connections, project.zones, tileSize, viewport);
    } else {
      hoveredConnection.current = null;
    }

    // Hover tracking via hit-testing
    const hit = findHitAt(sx, sy, viewport, project, tileSize, visibility);
    setHoveredZone(hit?.type === 'zone' ? hit.id : null);
  };

  // --- Wheel zoom ---
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const worldX = sx / viewport.zoom + viewport.panX;
    const worldY = sy / viewport.zoom + viewport.panY;

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + delta));
    if (newZoom === viewport.zoom) return;

    const newPanX = worldX - sx / newZoom;
    const newPanY = worldY - sy / newZoom;
    setViewport({ panX: newPanX, panY: newPanY, zoom: newZoom });
  }, [viewport, setViewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // --- Double-click to center on zone ---
  const handleDoubleClick = (e: React.MouseEvent) => {
    const { gx, gy } = gridPos(e);
    const zone = findZoneAt(gx, gy);
    if (!zone) return;
    selectZone(zone.id, false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setViewport(centerOnZone(zone, tileSize, canvas.offsetWidth, canvas.offsetHeight));
  };

  // --- Cursor ---
  const handleCursors: Record<HandleKind, string> = {
    nw: 'nw-resize', n: 'n-resize', ne: 'ne-resize', e: 'e-resize',
    se: 'se-resize', s: 's-resize', sw: 'sw-resize', w: 'w-resize',
  };
  let cursor = 'crosshair';
  if (isPanning.current || spaceHeld.current) cursor = 'grabbing';
  else if (resizeMove.current?.active) cursor = handleCursors[resizeMove.current.handleKind];
  else if (dragMove.current?.active) cursor = 'grabbing';
  else if (boxSelect.current) cursor = 'crosshair';
  else if (hoveredHandle.current) cursor = handleCursors[hoveredHandle.current];
  else if (hoveredConnection.current) cursor = 'pointer';
  else if (activeTool === 'select') cursor = 'default';

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
