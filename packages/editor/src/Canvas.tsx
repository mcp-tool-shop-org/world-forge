// Canvas.tsx — main viewport with multi-select, box-select, drag-move, pan & zoom

import { useRef, useEffect, useCallback, useState } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore, getSelectionCount, getSelectedZoneId, getSelectedConnection, isSelected as isSel } from './store/editor-store.js';
import { getConnectionEndpoints, findConnectionAt, getKindStyle, connectionMidpoint } from './connection-lines.js';
import { centerOnZone, MIN_ZOOM, MAX_ZOOM } from './viewport.js';
import { findHitAt, findAllHitsAt, findAllInRect } from './hit-testing.js';
import { computeSnap, getNonSelectedEdges, computeResizeSnap, type SnapGuide } from './snap.js';
import { getHandles, findHandleAt, applyResize, HANDLE_SCREEN_RADIUS, type HandleKind, type ResizeResult } from './resize-handles.js';
import type { Zone, Tileset, TileDefinition } from '@world-forge/schema';
import { dispatchHotkey, type HotkeyContext } from './hotkeys.js';
import { getModeProfile, getDefaultConnectionKind, generateZoneName } from './mode-profiles.js';
import { SPEED_PANEL_ACTIONS } from './speed-panel-actions.js';
import { fallbackTileColor } from './tile-render.js';

const ZOOM_STEP = 0.1;
const DRAG_THRESHOLD = 3; // screen pixels before drag-move activates

/** FT-021: When selection exceeds this count, use simplified outline-only rendering */
export const LARGE_SELECTION_THRESHOLD = 50;
const DBL_RIGHT_INTERVAL = 300; // ms between right-clicks for speed panel
const DBL_RIGHT_RADIUS = 5;     // px proximity for double-right-click

// EU-012: nextZoneId is a monotonic counter used only for generating unique zone IDs
// within a session. It does not need resetting on project load because zone IDs are
// prefixed with a timestamp (Date.now()), making collisions effectively impossible.
let nextZoneId = 1;

/**
 * EUB-012: Generate a unique zone ID using timestamp + monotonic counter.
 * Contract: each call returns a globally unique string within this session.
 * Format: "zone-{timestamp}-{counter}" — collision-free because counter is monotonic.
 */
export function generateZoneId(): string {
  return `zone-${Date.now()}-${nextZoneId++}`;
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, addZone, addConnection, removeConnection, addEntity, addEncounter, addSpawnPoint, moveSelected, resizeZone, removeSelected, duplicateSelected } = useProjectStore();
  const {
    activeTool, showGrid, selection, hoveredZoneId,
    showConnections, showEntities, showLandmarks, showSpawns, showTiles, showAmbient, snapToObjects,
    selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection,
    selectedConnection,
    setSelectedZone, setHoveredZone, selectAll, clearSelection,
    connectionStart, setConnectionStart,
    viewport, setViewport, setShowSearch, setRightTab,
    openSpeedPanel, showSpeedPanel, closeSpeedPanel,
    hiddenIds, showPerfStats, showElevation, setTool,
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

  // Double-right-click detection for speed panel
  const rightClickTracker = useRef<{ time: number; sx: number; sy: number } | null>(null);
  const panButton = useRef(-1);
  const panStartScreen = useRef<{ sx: number; sy: number } | null>(null);

  // FT-005: Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; actions: { id: string; label: string; icon: string }[] } | null>(null);

  // FT-007: Connection preview — track cursor position during connection tool
  const connectionCursor = useRef<{ sx: number; sy: number } | null>(null);

  // FT-014: Minimap toggle from editor store
  const showMinimap = useEditorStore((s) => s.showMinimap);

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
  }, [project.zones.length]); // eslint-disable-line react-hooks/exhaustive-deps -- fit-to-content only runs once on first render; re-running on every dep change would fight user panning

  // --- Drawing ---
  // B-2: tileset image cache for the tile render pass. Keyed by imagePath; an
  // entry stays loaded:false (→ colored-rect fallback) until the browser finishes
  // decoding, at which point we bump a tick to force exactly one redraw.
  const tileImages = useRef<Map<string, { img: HTMLImageElement; loaded: boolean }>>(new Map());
  const [tileImageTick, setTileImageTick] = useState(0);
  const getTileImage = useCallback((path: string): HTMLImageElement | null => {
    let entry = tileImages.current.get(path);
    if (!entry) {
      const img = new Image();
      entry = { img, loaded: false };
      tileImages.current.set(path, entry);
      img.onload = () => { entry!.loaded = true; setTileImageTick((t) => t + 1); };
      img.onerror = () => { /* leave unloaded → colored-rect fallback */ };
      img.src = path;
    }
    return entry.loaded ? entry.img : null;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderStart = performance.now();

    // Perf: build zone lookup map once per frame — O(n) vs O(n²) per-entity/landmark/encounter
    const zoneMap = new Map(project.zones.map((z) => [z.id, z]));

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { panX, panY, zoom } = viewport;
    ctx.setTransform(zoom, 0, 0, zoom, -panX * zoom, -panY * zoom);

    // FT-010: Viewport culling bounds (world coordinates with margin)
    const cullMargin = 64; // px margin in world space
    const vpLeft = panX - cullMargin;
    const vpTop = panY - cullMargin;
    const vpRight = panX + canvas.width / zoom + cullMargin;
    const vpBottom = panY + canvas.height / zoom + cullMargin;

    /** Returns true if a world-space AABB is within (or overlaps) the viewport. */
    const inViewport = (wx: number, wy: number, ww: number, wh: number) =>
      wx + ww > vpLeft && wx < vpRight && wy + wh > vpTop && wy < vpBottom;

    /** Returns true if a world-space point is within the viewport. */
    const pointInViewport = (wx: number, wy: number) =>
      wx > vpLeft && wx < vpRight && wy > vpTop && wy < vpBottom;

    let visibleCount = 0;
    let totalCount = 0;

    // Drag preview offset (grid cells → world pixels)
    const isDragging = dragMove.current?.active ?? false;
    const dragDX = isDragging ? snapDelta.current.dx : 0;
    const dragDY = isDragging ? snapDelta.current.dy : 0;

    // FT-021: When more than 50 objects are selected, use simplified selection rendering
    // (outline rectangles only) to avoid per-object highlight overhead on large selections.
    const selTotal = getSelectionCount(selection);
    const simplifiedSelection = selTotal > LARGE_SELECTION_THRESHOLD;

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

    // Tile layers — ground art beneath the authoring overlays. Image-backed when
    // a tileset declares an imagePath (sliced by row/col from its sprite sheet),
    // colored-rect fallback otherwise (mirrors renderer-2d's TileLayerRenderer
    // scheme). Unknown tile ids are skipped. Drawn over the grid, under zones.
    if (showTiles && (project.tileLayers?.length ?? 0) > 0) {
      const tileLookup = new Map<string, { def: TileDefinition; tileset: Tileset }>();
      for (const ts of project.tilesets ?? []) {
        for (const t of ts.tiles) tileLookup.set(t.id, { def: t, tileset: ts });
      }
      const sortedLayers = [...project.tileLayers].sort((a, b) => a.zIndex - b.zIndex);
      const prevSmoothing = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false; // crisp pixel-art tile scaling
      for (const layer of sortedLayers) {
        for (const placement of layer.tiles) {
          const entry = tileLookup.get(placement.tileId);
          if (!entry) continue; // tile id not in any loaded tileset
          totalCount++;
          const dx = placement.gridX * tileSize;
          const dy = placement.gridY * tileSize;
          if (!inViewport(dx, dy, tileSize, tileSize)) continue;
          visibleCount++;
          const { def, tileset } = entry;
          const img = tileset.imagePath ? getTileImage(tileset.imagePath) : null;
          ctx.globalAlpha = def.opacity;
          if (img) {
            ctx.drawImage(
              img,
              def.col * tileset.tileWidth, def.row * tileset.tileHeight, tileset.tileWidth, tileset.tileHeight,
              dx, dy, tileSize, tileSize,
            );
          } else {
            ctx.fillStyle = fallbackTileColor(def.tags);
            ctx.fillRect(dx, dy, tileSize, tileSize);
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.imageSmoothingEnabled = prevSmoothing;
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
        const endpoints = getConnectionEndpoints(conn, project.zones, tileSize, zoneOverrides, zoneMap);
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
      totalCount++;
      // FT-009: skip hidden zones
      if (hiddenIds.has(zone.id)) continue;
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

      // FT-010: viewport culling
      if (!inViewport(x, y, w, h)) continue;
      visibleCount++;

      const distIdx = project.districts.findIndex((d) => d.id === zone.parentDistrictId);
      const color = colors[distIdx % colors.length] ?? '#888';

      const hovered = zone.id === hoveredZoneId;

      // FT-021: simplified selection rendering for large selections
      if (selected && simplifiedSelection) {
        ctx.fillStyle = color + '10';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2 / zoom;
        ctx.strokeRect(x, y, w, h);
      } else {
        ctx.fillStyle = selected ? color + '50' : hovered ? color + '30' : color + '10';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = color + (selected ? 'ff' : hovered ? 'cc' : '80');
        ctx.lineWidth = (selected ? 3 : hovered ? 2 : 1) / zoom;
        ctx.strokeRect(x, y, w, h);
      }

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

      // ED-FT-003: elevation badge (e.g. "+12m" or "-4m..+8m"). Shown only when
      // the layer toggle is on and the zone carries elevation data. The renderer
      // agent will extend ZoneOverlayRenderer with fuller visualization (tint,
      // dashed outline, drop-shadow) in Wave 2; this gives authors an immediate
      // cue today.
      if (showElevation && (zone.elevation != null || zone.elevationRange != null)) {
        let text = '';
        if (zone.elevationRange) {
          const { floor, ceiling } = zone.elevationRange;
          text = `${floor}m\u2192${ceiling}m`;
        } else if (zone.elevation != null) {
          const sign = zone.elevation >= 0 ? '+' : '';
          text = `${sign}${zone.elevation}m`;
        }
        if (text) {
          const badgeFont = Math.max(8, Math.min(12, 10 / zoom));
          ctx.font = `${badgeFont}px monospace`;
          const tw = ctx.measureText(text).width;
          const bpad = 3 / zoom;
          const bx = x + w - tw - bpad * 2 - 2 / zoom;
          const by = y + 2 / zoom;
          ctx.fillStyle = 'rgba(88, 166, 255, 0.35)';
          ctx.fillRect(bx, by, tw + bpad * 2, badgeFont + bpad);
          ctx.fillStyle = '#e6f0ff';
          ctx.fillText(text, bx + bpad, by + badgeFont);
        }
      }
    }

    // District name labels at zone centroids
    if (zoom > 0.25) {
      for (const d of project.districts) {
        if (d.zoneIds.length === 0) continue;
        const dzones = d.zoneIds.map((zid) => zoneMap.get(zid)).filter(Boolean);
        if (dzones.length === 0) continue;
        let sumX = 0, sumY = 0;
        for (const z of dzones) {
          sumX += (z!.gridX + z!.gridWidth / 2) * tileSize;
          sumY += (z!.gridY + z!.gridHeight / 2) * tileSize;
        }
        const cx = sumX / dzones.length;
        const cy = sumY / dzones.length;
        const fs = Math.max(16, 24 / zoom);
        ctx.font = `bold ${fs}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(200,200,200,0.15)';
        ctx.fillText(d.name, cx, cy);
        ctx.textAlign = 'start';
      }
    }

    // Entities
    if (showEntities) {
      for (const ep of project.entityPlacements) {
        totalCount++;
        if (hiddenIds.has(ep.entityId)) continue;
        const zone = zoneMap.get(ep.zoneId);
        if (!zone) continue;
        const selected = isSel(selection, 'entity', ep.entityId);
        const canDrag = selected && isDragging && ep.gridX != null && ep.gridY != null;
        const x = ((ep.gridX ?? zone.gridX + 2) + (canDrag ? dragDX : 0)) * tileSize;
        const y = ((ep.gridY ?? zone.gridY + 2) + (canDrag ? dragDY : 0)) * tileSize;
        if (!pointInViewport(x, y)) continue;
        visibleCount++;
        const roleColors: Record<string, string> = {
          npc: '#4a9eff', enemy: '#ff4444', merchant: '#ffd700',
          'quest-giver': '#44ff44', companion: '#44ffaa', boss: '#ff2222',
        };
        ctx.fillStyle = roleColors[ep.role] ?? '#888';
        ctx.beginPath();
        const radius = (ep.role === 'boss' ? 8 : 5) / zoom;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        // Selection ring (FT-021: simplified = outline rect instead of ring for large selections)
        if (selected) {
          if (simplifiedSelection) {
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 1.5 / zoom;
            const r2 = radius + 3 / zoom;
            ctx.strokeRect(x - r2, y - r2, r2 * 2, r2 * 2);
          } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.arc(x, y, radius + 3 / zoom, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#aaa';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText(ep.entityId, x + 10 / zoom, y + 3 / zoom);
      }
    }

    // Landmarks
    if (showLandmarks) {
      for (const lm of project.landmarks) {
        totalCount++;
        if (hiddenIds.has(lm.id)) continue;
        const zone = zoneMap.get(lm.zoneId);
        if (!zone) continue;
        const selected = isSel(selection, 'landmark', lm.id);
        const x = (lm.gridX + (selected && isDragging ? dragDX : 0)) * tileSize;
        const y = (lm.gridY + (selected && isDragging ? dragDY : 0)) * tileSize;
        if (!pointInViewport(x, y)) continue;
        visibleCount++;
        const s = 6 / zoom;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 5 / 6, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 5 / 6, y);
        ctx.closePath();
        ctx.fill();
        // Selection ring (FT-021: simplified = outline rect for large selections)
        if (selected) {
          if (simplifiedSelection) {
            ctx.strokeStyle = '#58a6ff';
            ctx.lineWidth = 1.5 / zoom;
            const r2 = s + 2 / zoom;
            ctx.strokeRect(x - r2, y - r2, r2 * 2, r2 * 2);
          } else {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2 / zoom;
            ctx.beginPath();
            ctx.arc(x, y, s + 2 / zoom, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
        ctx.fillStyle = '#ffd700';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText(lm.name, x + 8 / zoom, y + 3 / zoom);
      }
    }

    // Spawn points
    if (showSpawns) {
      for (const sp of project.spawnPoints) {
        totalCount++;
        if (hiddenIds.has(sp.id)) continue;
        const selected = isSel(selection, 'spawn', sp.id);
        const x = (sp.gridX + (selected && isDragging ? dragDX : 0)) * tileSize;
        const y = (sp.gridY + (selected && isDragging ? dragDY : 0)) * tileSize;
        if (!pointInViewport(x, y)) continue;
        visibleCount++;
        const s = 4 / zoom;
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
        // Selection ring (FT-021: simplified = thin outline for large selections)
        if (selected) {
          ctx.strokeStyle = simplifiedSelection ? '#58a6ff' : '#fff';
          ctx.lineWidth = (simplifiedSelection ? 1.5 : 2) / zoom;
          ctx.strokeRect(x - s - 2 / zoom, y - s - 2 / zoom, s * 2 + 4 / zoom, s * 2 + 4 / zoom);
        }
        ctx.fillStyle = '#aaa';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText('SPAWN', x + 8 / zoom, y + 3 / zoom);
      }
    }

    // Encounter anchors (red diamond at zone center)
    for (const enc of project.encounterAnchors) {
      totalCount++;
      if (hiddenIds.has(enc.id)) continue;
      const zone = zoneMap.get(enc.zoneId);
      if (!zone) continue;
      const selected = isSel(selection, 'encounter', enc.id);
      const cx = (zone.gridX + zone.gridWidth / 2) * tileSize;
      const cy = (zone.gridY + zone.gridHeight / 2) * tileSize;
      if (!pointInViewport(cx, cy)) continue;
      visibleCount++;
      // Offset multiple encounters in same zone
      const sameZone = project.encounterAnchors.filter((e) => e.zoneId === enc.zoneId);
      const idx = sameZone.indexOf(enc);
      const ox = (idx - (sameZone.length - 1) / 2) * 8 / zoom;
      const s = 6 / zoom;
      // Color by encounter type
      const typeColor = enc.encounterType === 'boss' ? '#f85149'
        : enc.encounterType === 'ambush' ? '#d29922'
        : enc.encounterType === 'patrol' ? '#8b8422'
        : '#da3633';
      ctx.fillStyle = typeColor;
      ctx.beginPath();
      ctx.moveTo(cx + ox, cy - s);
      ctx.lineTo(cx + ox + s, cy);
      ctx.lineTo(cx + ox, cy + s);
      ctx.lineTo(cx + ox - s, cy);
      ctx.closePath();
      ctx.fill();
      // Selection ring
      if (selected) {
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
      }
      // Type label at zoom > 0.4
      if (zoom > 0.4) {
        ctx.fillStyle = '#ccc';
        ctx.font = `${8 / zoom}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(enc.encounterType, cx + ox, cy + s + 10 / zoom);
        ctx.textAlign = 'start';
      }
    }

    // Ambient overlays
    if (showAmbient) {
      for (const al of project.ambientLayers) {
        for (const azId of al.zoneIds) {
          const zone = zoneMap.get(azId);
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
        const szone = zoneMap.get(singleZoneId);
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

    // FT-007: Connection preview line while in connection tool
    if (activeTool === 'connection' && connectionStart && connectionCursor.current) {
      const sourceZone = zoneMap.get(connectionStart);
      if (sourceZone) {
        const srcCx = (sourceZone.gridX + sourceZone.gridWidth / 2) * tileSize;
        const srcCy = (sourceZone.gridY + sourceZone.gridHeight / 2) * tileSize;
        const curWorld = {
          x: connectionCursor.current.sx / zoom + panX,
          y: connectionCursor.current.sy / zoom + panY,
        };
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        ctx.beginPath();
        ctx.moveTo(srcCx, srcCy);
        ctx.lineTo(curWorld.x, curWorld.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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

    // FT-010: Performance stats overlay
    if (showPerfStats) {
      const renderMs = (performance.now() - renderStart).toFixed(1);
      const lines = [
        `Visible: ${visibleCount} / ${totalCount}`,
        `Render: ${renderMs}ms`,
        `Zoom: ${(zoom * 100).toFixed(0)}%`,
      ];
      ctx.font = '10px monospace';
      const statsY = selCount > 1 ? 36 : 8;
      const lineH = 14;
      const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width));
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(8, statsY, maxW + 12, lines.length * lineH + 6);
      ctx.fillStyle = '#8b949e';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 14, statsY + 14 + i * lineH);
      }
    }
  // EU-007: All deps are reactive store slices or props that affect rendering.
  // project = zone/entity/connection data; show* = layer toggles; selection/hoveredZoneId = highlight state;
  // tileSize = grid scale; viewport = pan/zoom transform. All are necessary to redraw correctly.
  }, [project, showGrid, showConnections, showEntities, showLandmarks, showSpawns, showTiles, showAmbient, selection, selectedConnection, hoveredZoneId, tileSize, viewport, activeTool, connectionStart, hiddenIds, showPerfStats, showElevation, getTileImage, tileImageTick]);

  useEffect(() => {
    draw();
    const handle = () => draw();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [draw]);

  // EU-014: Reset drag state refs on unmount to prevent stale state if component remounts
  useEffect(() => {
    return () => {
      dragMove.current = null;
      resizeMove.current = null;
      boxSelect.current = null;
      zonePaintStart.current = null;
      isPanning.current = false;
      panStart.current = null;
      spaceHeld.current = false;
      activeGuides.current = [];
      snapDelta.current = { dx: 0, dy: 0 };
    };
  }, []);

  // --- Keyboard events (delegated to hotkeys.ts) ---
  // ED-A-003 / ED-A-010: Keep the handler identity stable so we register window
  // listeners exactly ONCE (not every render). Latest store/prop values flow
  // through a ref, and zustand actions are read via `getState()` at call time —
  // both are stable, so the effect's dep array is empty and listeners never
  // thrash during re-render storms.
  const hotkeyCtxRef = useRef<HotkeyContext | null>(null);
  const contextMenuRef = useRef(contextMenu);
  contextMenuRef.current = contextMenu;

  // ED-A-010: HotkeyContext object was previously constructed inline in the effect
  // on every dep change. Now it's rebuilt once per render into a ref — no listener
  // churn, and dispatchHotkey() always sees current values.
  hotkeyCtxRef.current = {
    selection, selectedConnection, project,
    showEntities, showLandmarks, showSpawns,
    clearSelection, selectAll, moveSelected, removeSelected, removeConnection,
    duplicateSelected, setShowSearch, setRightTab, setTool,
    showSpeedPanel, closeSpeedPanel,
    copySelection: useEditorStore.getState().copySelection,
    pasteClipboard: () => { /* paste handled by project-store when available */ },
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Space handled locally (depends on ref)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
        return;
      }

      // FT-005: Escape closes context menu
      if (e.key === 'Escape' && contextMenuRef.current) {
        setContextMenu(null);
        return;
      }

      // Delegate to centralized dispatch — pull latest ctx from ref so the
      // handler reflects current selection/project without re-binding.
      const ctx = hotkeyCtxRef.current;
      if (!ctx) return;
      const result = dispatchHotkey(e, ctx);
      if (result.handled && result.action === 'escape') {
        // Also clear canvas-local drag state
        dragMove.current = null;
        resizeMove.current = null;
        activeGuides.current = [];
        snapDelta.current = { dx: 0, dy: 0 };
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
  }, []);

  // --- Mouse coordinate helpers ---
  const getScreenXY = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { sx: 0, sy: 0 };
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

  // FT-009: Filter hidden objects from hit test results
  const filterHidden = useCallback((hits: import('./hit-testing.js').HitResult[]): import('./hit-testing.js').HitResult[] =>
    hits.filter((h) => !hiddenIds.has(h.id)), [hiddenIds]);
  const filterHitSingle = useCallback((hit: import('./hit-testing.js').HitResult | null): import('./hit-testing.js').HitResult | null =>
    hit && !hiddenIds.has(hit.id) ? hit : null, [hiddenIds]);

  // --- Check if a hit result is already selected ---
  const hitIsSelected = (hit: { type: string; id: string } | null) => {
    if (!hit) return false;
    if (hit.type === 'connection') {
      const [from, to] = hit.id.split('::');
      return selectedConnection?.from === from && selectedConnection?.to === to;
    }
    const t = hit.type as 'zone' | 'entity' | 'landmark' | 'spawn' | 'encounter';
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
    else if (hit.type === 'encounter') selectEncounter(hit.id, additive);
  };

  // --- Mouse handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // FT-005: Close context menu on any click
    if (contextMenu) setContextMenu(null);

    // Pan: middle mouse, right mouse, or space+left
    if (e.button === 1 || e.button === 2 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      isPanning.current = true;
      panButton.current = e.button;
      panStart.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      if (e.button === 2) {
        const { sx, sy } = getScreenXY(e);
        panStartScreen.current = { sx, sy };
      }
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
      const allHits = filterHidden(findAllHitsAt(sx, sy, viewport, project, tileSize, visibility));
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
            addConnection({ fromZoneId: connectionStart, toZoneId: zone.id, bidirectional: true, kind: getDefaultConnectionKind(project.mode) });
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
          role: getModeProfile(project.mode).defaultEntityRole as 'npc' | 'enemy' | 'merchant' | 'boss' | 'companion',
        });
      }
    } else if (activeTool === 'spawn') {
      // EUB-011: reject spawn creation if no zone found at click position
      const spawnZone = findZoneAt(gx, gy);
      if (!spawnZone) {
        console.warn('[Canvas] Spawn rejected: no zone at click position', { gx, gy });
        return;
      }
      addSpawnPoint({
        id: `spawn-${Date.now()}`,
        zoneId: spawnZone.id,
        gridX: gx, gridY: gy,
        isDefault: project.spawnPoints.length === 0,
      });
    } else if (activeTool === 'encounter-place') {
      const zone = findZoneAt(gx, gy);
      if (zone) {
        addEncounter({
          id: `enc-${Date.now()}`,
          zoneId: zone.id,
          encounterType: getModeProfile(project.mode).encounterTypes[0],
          enemyIds: [],
          probability: 0.5,
          cooldownTurns: 3,
          tags: [],
        });
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const wasRight = panButton.current === 2;
      isPanning.current = false;
      panButton.current = -1;

      // Double-right-click detection: if right-click released with no drag
      if (wasRight && panStartScreen.current) {
        const { sx, sy } = getScreenXY(e);
        const dx = sx - panStartScreen.current.sx;
        const dy = sy - panStartScreen.current.sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        panStartScreen.current = null;

        if (dist < DBL_RIGHT_RADIUS) {
          const now = Date.now();
          const prev = rightClickTracker.current;
          if (prev && (now - prev.time) < DBL_RIGHT_INTERVAL &&
              Math.sqrt((sx - prev.sx) ** 2 + (sy - prev.sy) ** 2) < DBL_RIGHT_RADIUS) {
            // Double-right-click detected — open speed panel
            rightClickTracker.current = null;
            setContextMenu(null); // close any open context menu
            const hit = filterHitSingle(findHitAt(sx, sy, viewport, project, tileSize, visibility));
            openSpeedPanel(sx, sy, hit);
          } else {
            rightClickTracker.current = { time: now, sx, sy };
            // FT-005: Single right-click — show context menu after a delay to distinguish from double
            const clickSx = sx;
            const clickSy = sy;
            setTimeout(() => {
              // Only show if not consumed by a double-right-click
              if (rightClickTracker.current && rightClickTracker.current.time === now) {
                const hit = filterHitSingle(findHitAt(clickSx, clickSy, viewport, project, tileSize, visibility));
                const actions = SPEED_PANEL_ACTIONS
                  .filter((a) => a.contextFilter(hit))
                  .slice(0, 7)
                  .map((a) => ({ id: a.id, label: a.label, icon: a.icon }));
                if (actions.length > 0) {
                  setContextMenu({ x: clickSx, y: clickSy, actions });
                }
              }
            }, DBL_RIGHT_INTERVAL + 20);
          }
        } else {
          rightClickTracker.current = null;
        }
      }

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
      const rawResult = findAllInRect(rect, viewport, project, tileSize, visibility);
      // FT-009: filter hidden objects from box-select
      const result = {
        zones: rawResult.zones.filter((id) => !hiddenIds.has(id)),
        entities: rawResult.entities.filter((id) => !hiddenIds.has(id)),
        landmarks: rawResult.landmarks.filter((id) => !hiddenIds.has(id)),
        spawns: rawResult.spawns.filter((id) => !hiddenIds.has(id)),
        encounters: rawResult.encounters.filter((id) => !hiddenIds.has(id)),
      };
      const hasItems = result.zones.length + result.entities.length + result.landmarks.length + result.spawns.length + result.encounters.length > 0;
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
        const id = generateZoneId();
        // FT-024: Use generateZoneName for mode-aware auto-naming
        const zoneIndex = project.zones.length + 1;
        addZone({
          id,
          name: generateZoneName(project.mode ?? 'dungeon', zoneIndex),
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

    // FT-007: Connection cursor tracking for preview line
    if (activeTool === 'connection' && connectionStart) {
      connectionCursor.current = { sx, sy };
      draw();
    } else {
      connectionCursor.current = null;
    }

    // Hover tracking via hit-testing
    const hit = filterHitSingle(findHitAt(sx, sy, viewport, project, tileSize, visibility));
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

  // --- Double-click to open details for clicked object ---
  const handleDoubleClick = (e: React.MouseEvent) => {
    const { sx, sy } = getScreenXY(e);
    const hit = filterHitSingle(findHitAt(sx, sy, viewport, project, tileSize, visibility));
    const canvas = canvasRef.current;

    if (!hit) {
      clearSelection();
      return;
    }

    // Select the object and switch to map tab so the properties panel appears
    switch (hit.type) {
      case 'zone': {
        selectZone(hit.id, false);
        const zone = project.zones.find((z) => z.id === hit.id);
        if (zone && canvas) setViewport(centerOnZone(zone, tileSize, canvas.offsetWidth, canvas.offsetHeight));
        break;
      }
      case 'encounter': {
        selectEncounter(hit.id, false);
        const enc = project.encounterAnchors.find((a) => a.id === hit.id);
        const zone = enc ? project.zones.find((z) => z.id === enc.zoneId) : null;
        if (zone && canvas) setViewport(centerOnZone(zone, tileSize, canvas.offsetWidth, canvas.offsetHeight));
        break;
      }
      case 'entity':
        selectEntity(hit.id, false);
        break;
      case 'landmark':
        selectLandmark(hit.id, false);
        break;
      case 'spawn':
        selectSpawn(hit.id, false);
        break;
      case 'connection': {
        const [from, to] = hit.id.split('::');
        selectConnection(from, to);
        break;
      }
    }
    setRightTab('map');
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

  // FT-014: Minimap rendering
  const minimapWidth = 200;
  const minimapHeight = 150;
  const renderMinimap = () => {
    if (!showMinimap || project.zones.length === 0) return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cw = canvas.offsetWidth;
    const ch = canvas.offsetHeight;

    // Compute world bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const z of project.zones) {
      minX = Math.min(minX, z.gridX);
      minY = Math.min(minY, z.gridY);
      maxX = Math.max(maxX, z.gridX + z.gridWidth);
      maxY = Math.max(maxY, z.gridY + z.gridHeight);
    }
    if (!isFinite(minX)) return null;
    const pad = 2;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const bw = maxX - minX;
    const bh = maxY - minY;
    if (bw <= 0 || bh <= 0) return null;
    const scale = Math.min(minimapWidth / bw, minimapHeight / bh);

    const distColors = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#20c997'];

    // Viewport rectangle in grid coords
    const vpLeft = viewport.panX / tileSize;
    const vpTop = viewport.panY / tileSize;
    const vpW = cw / (viewport.zoom * tileSize);
    const vpH = ch / (viewport.zoom * tileSize);

    const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const gridX = mx / scale + minX;
      const gridY = my / scale + minY;
      const newPanX = (gridX - vpW / 2) * tileSize;
      const newPanY = (gridY - vpH / 2) * tileSize;
      setViewport({ panX: newPanX, panY: newPanY });
    };

    return (
      <div
        onClick={handleMinimapClick}
        style={{
          position: 'absolute', bottom: 8, right: 8,
          width: minimapWidth, height: minimapHeight,
          background: 'rgba(13,17,23,0.85)',
          border: '1px solid #30363d', borderRadius: 4,
          cursor: 'pointer', overflow: 'hidden',
        }}
      >
        {project.zones.map((z) => {
          const distIdx = project.districts.findIndex((d) => d.id === z.parentDistrictId);
          const color = distColors[distIdx % distColors.length] ?? '#888';
          return (
            <div key={z.id} style={{
              position: 'absolute',
              left: (z.gridX - minX) * scale,
              top: (z.gridY - minY) * scale,
              width: z.gridWidth * scale,
              height: z.gridHeight * scale,
              background: color + '40',
              border: `1px solid ${color}80`,
            }} />
          );
        })}
        {/* Viewport rectangle */}
        <div style={{
          position: 'absolute',
          left: (vpLeft - minX) * scale,
          top: (vpTop - minY) * scale,
          width: vpW * scale,
          height: vpH * scale,
          border: '1.5px solid rgba(255,255,255,0.6)',
          background: 'rgba(255,255,255,0.08)',
          pointerEvents: 'none',
        }} />
      </div>
    );
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="World map canvas"
        tabIndex={0}
        style={{ width: '100%', height: '100%', cursor }}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* FT-005: Right-click context menu */}
      {contextMenu && (
        <div
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top: contextMenu.y,
            background: '#1c2128',
            border: '1px solid #30363d',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            padding: '4px 0',
            zIndex: 100,
            minWidth: 160,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {contextMenu.actions.map((action) => (
            <div
              key={action.id}
              onClick={() => {
                setContextMenu(null);
                // Dispatch action via speed panel execute if available
                // For now, just close. The speed-panel-execute module handles execution.
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#30363d'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                color: '#c9d1d9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontSize: 11, width: 20, textAlign: 'center', color: '#8b949e' }}>{action.icon}</span>
              <span>{action.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* FT-014: Minimap overlay */}
      {renderMinimap()}
    </div>
  );
}
