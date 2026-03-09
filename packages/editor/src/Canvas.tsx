// Canvas.tsx — main viewport with zone interaction, pan & zoom

import { useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore } from './store/editor-store.js';
import { centerOnZone, MIN_ZOOM, MAX_ZOOM } from './viewport.js';
import type { Zone } from '@world-forge/schema';

const ZOOM_STEP = 0.1;

let nextZoneId = 1;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, addZone, addConnection, updateZone, addEntity, addSpawnPoint } = useProjectStore();
  const {
    activeTool, showGrid, selectedZoneId, hoveredZoneId,
    showConnections, showEntities, showLandmarks, showSpawns, showAmbient,
    setSelectedZone, setHoveredZone, connectionStart, setConnectionStart,
    viewport, setViewport,
  } = useEditorStore();

  const tileSize = project.map.tileSize;
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const isPanning = useRef(false);
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const spaceHeld = useRef(false);
  const hasFitted = useRef(false);

  // --- Coordinate conversion (inline, no viewport.ts dependency for Canvas) ---
  const screenToWorld = useCallback((screenX: number, screenY: number) => ({
    worldX: screenX / viewport.zoom + viewport.panX,
    worldY: screenY / viewport.zoom + viewport.panY,
  }), [viewport]);

  const screenToGrid = useCallback((screenX: number, screenY: number) => {
    const { worldX, worldY } = screenToWorld(screenX, screenY);
    return {
      gx: Math.floor(worldX / tileSize),
      gy: Math.floor(worldY / tileSize),
    };
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

    // Compute content bounds
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

    // Apply viewport transform — all drawing below is in world coordinates
    const { panX, panY, zoom } = viewport;
    ctx.setTransform(zoom, 0, 0, zoom, -panX * zoom, -panY * zoom);

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

    // Connections
    if (showConnections) {
      ctx.lineWidth = 1 / zoom;
      for (const conn of project.connections) {
        const from = project.zones.find((z) => z.id === conn.fromZoneId);
        const to = project.zones.find((z) => z.id === conn.toZoneId);
        if (!from || !to) continue;
        const fx = (from.gridX + from.gridWidth / 2) * tileSize;
        const fy = (from.gridY + from.gridHeight / 2) * tileSize;
        const tx = (to.gridX + to.gridWidth / 2) * tileSize;
        const ty = (to.gridY + to.gridHeight / 2) * tileSize;
        ctx.strokeStyle = conn.condition ? 'rgba(255,170,0,0.6)' : 'rgba(136,136,136,0.6)';
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }

    // Zones
    const colors = ['#4a9eff', '#ff6b6b', '#51cf66', '#ffd43b', '#cc5de8', '#20c997'];
    for (const zone of project.zones) {
      const x = zone.gridX * tileSize;
      const y = zone.gridY * tileSize;
      const w = zone.gridWidth * tileSize;
      const h = zone.gridHeight * tileSize;

      const distIdx = project.districts.findIndex((d) => d.id === zone.parentDistrictId);
      const color = colors[distIdx % colors.length] ?? '#888';

      const isSelected = zone.id === selectedZoneId;
      const isHovered = zone.id === hoveredZoneId;

      // Fill — stronger states for selection & hover
      ctx.fillStyle = isSelected ? color + '50' : isHovered ? color + '30' : color + '10';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color + (isSelected ? 'ff' : isHovered ? 'cc' : '80');
      ctx.lineWidth = (isSelected ? 3 : isHovered ? 2 : 1) / zoom;
      ctx.strokeRect(x, y, w, h);

      // Zone label with dark background pill for readability
      const fontSize = Math.max(9, Math.min(14, 11 / zoom));
      ctx.font = `${fontSize}px monospace`;
      const labelX = x + 4 / zoom;
      const labelY = y + (fontSize + 3) / zoom;
      const textWidth = ctx.measureText(zone.name).width;
      const pad = 2 / zoom;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(labelX - pad, labelY - fontSize + pad, textWidth + pad * 2, fontSize + pad);
      ctx.fillStyle = isSelected ? '#fff' : '#ccc';
      ctx.fillText(zone.name, labelX, labelY);
    }

    // Entities
    if (showEntities) {
      for (const ep of project.entityPlacements) {
        const zone = project.zones.find((z) => z.id === ep.zoneId);
        if (!zone) continue;
        const x = (ep.gridX ?? zone.gridX + 2) * tileSize;
        const y = (ep.gridY ?? zone.gridY + 2) * tileSize;
        const roleColors: Record<string, string> = {
          npc: '#4a9eff', enemy: '#ff4444', merchant: '#ffd700',
          'quest-giver': '#44ff44', companion: '#44ffaa', boss: '#ff2222',
        };
        ctx.fillStyle = roleColors[ep.role] ?? '#888';
        ctx.beginPath();
        const radius = (ep.role === 'boss' ? 8 : 5) / zoom;
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
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
        const x = lm.gridX * tileSize;
        const y = lm.gridY * tileSize;
        const s = 6 / zoom;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(x, y - s);
        ctx.lineTo(x + s * 5 / 6, y);
        ctx.lineTo(x, y + s);
        ctx.lineTo(x - s * 5 / 6, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.font = `${9 / zoom}px monospace`;
        ctx.fillText(lm.name, x + 8 / zoom, y + 3 / zoom);
      }
    }

    // Spawn points
    if (showSpawns) {
      for (const sp of project.spawnPoints) {
        const x = sp.gridX * tileSize;
        const y = sp.gridY * tileSize;
        const s = 4 / zoom;
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(x - s, y - s, s * 2, s * 2);
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

    // Reset transform for any screen-space overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [project, showGrid, showConnections, showEntities, showLandmarks, showSpawns, showAmbient, selectedZoneId, hoveredZoneId, tileSize, viewport]);

  useEffect(() => {
    draw();
    const handle = () => draw();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [draw]);

  // --- Keyboard events for spacebar pan ---
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        spaceHeld.current = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceHeld.current = false;
      }
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

  // --- Mouse handlers ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle mouse or space+left = pan
    if (e.button === 1 || (e.button === 0 && spaceHeld.current)) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY };
      return;
    }

    if (e.button !== 0) return;
    const { gx, gy } = gridPos(e);

    if (activeTool === 'select') {
      const zone = findZoneAt(gx, gy);
      setSelectedZone(zone?.id ?? null);
    } else if (activeTool === 'zone-paint') {
      dragStart.current = { x: gx, y: gy };
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
          gridX: gx,
          gridY: gy,
          role: 'npc',
        });
      }
    } else if (activeTool === 'spawn') {
      addSpawnPoint({
        id: `spawn-${Date.now()}`,
        zoneId: findZoneAt(gx, gy)?.id ?? '',
        gridX: gx,
        gridY: gy,
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
    if (activeTool === 'zone-paint' && dragStart.current) {
      const { gx, gy } = gridPos(e);
      const sx = Math.min(dragStart.current.x, gx);
      const sy = Math.min(dragStart.current.y, gy);
      const w = Math.abs(gx - dragStart.current.x) + 1;
      const h = Math.abs(gy - dragStart.current.y) + 1;
      if (w >= 2 && h >= 2) {
        const id = `zone-${nextZoneId++}`;
        addZone({
          id,
          name: `Zone ${nextZoneId - 1}`,
          tags: [],
          description: '',
          gridX: sx, gridY: sy, gridWidth: w, gridHeight: h,
          neighbors: [], exits: [],
          light: 5, noise: 0, hazards: [], interactables: [],
        });
        setSelectedZone(id);
      }
      dragStart.current = null;
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
    const { gx, gy } = gridPos(e);
    const zone = findZoneAt(gx, gy);
    setHoveredZone(zone?.id ?? null);
  };

  // --- Wheel zoom ---
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // World point under cursor before zoom
    const worldX = sx / viewport.zoom + viewport.panX;
    const worldY = sy / viewport.zoom + viewport.panY;

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, viewport.zoom + delta));
    if (newZoom === viewport.zoom) return;

    // Keep world point under cursor stationary
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
    setSelectedZone(zone.id);
    const canvas = canvasRef.current;
    if (!canvas) return;
    setViewport(centerOnZone(zone, tileSize, canvas.offsetWidth, canvas.offsetHeight));
  };

  const cursor = isPanning.current || spaceHeld.current ? 'grabbing' : 'crosshair';

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    />
  );
}
