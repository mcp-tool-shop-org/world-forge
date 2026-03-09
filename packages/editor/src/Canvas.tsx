// Canvas.tsx — main viewport with zone interaction

import { useRef, useEffect, useCallback } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore } from './store/editor-store.js';
import type { Zone } from '@world-forge/schema';

let nextZoneId = 1;

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { project, addZone, addConnection, updateZone, addEntity, addSpawnPoint } = useProjectStore();
  const {
    activeTool, showGrid, selectedZoneId, hoveredZoneId,
    showConnections, showEntities, showLandmarks, showSpawns, showAmbient,
    setSelectedZone, setHoveredZone, connectionStart, setConnectionStart,
  } = useEditorStore();

  const tileSize = project.map.tileSize;
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
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
      ctx.lineWidth = 1;
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

      ctx.fillStyle = isSelected ? color + '40' : isHovered ? color + '20' : color + '10';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color + (isSelected ? 'ff' : '80');
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(x, y, w, h);

      ctx.fillStyle = '#ccc';
      ctx.font = '11px monospace';
      ctx.fillText(zone.name, x + 4, y + 14);
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
        ctx.arc(x, y, ep.role === 'boss' ? 8 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#aaa';
        ctx.font = '9px monospace';
        ctx.fillText(ep.entityId, x + 10, y + 3);
      }
    }

    // Landmarks
    if (showLandmarks) {
      for (const lm of project.landmarks) {
        const zone = project.zones.find((z) => z.id === lm.zoneId);
        if (!zone) continue;
        const x = lm.gridX * tileSize;
        const y = lm.gridY * tileSize;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#ffd700';
        ctx.font = '9px monospace';
        ctx.fillText(lm.name, x + 8, y + 3);
      }
    }

    // Spawn points
    if (showSpawns) {
      for (const sp of project.spawnPoints) {
        const x = sp.gridX * tileSize;
        const y = sp.gridY * tileSize;
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.fillStyle = '#aaa';
        ctx.font = '9px monospace';
        ctx.fillText('SPAWN', x + 8, y + 3);
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
  }, [project, showGrid, showConnections, showEntities, showLandmarks, showSpawns, showAmbient, selectedZoneId, hoveredZoneId, tileSize]);

  useEffect(() => {
    draw();
    const handle = () => draw();
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, [draw]);

  const gridPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      gx: Math.floor((e.clientX - rect.left) / tileSize),
      gy: Math.floor((e.clientY - rect.top) / tileSize),
    };
  };

  const findZoneAt = (gx: number, gy: number): Zone | undefined =>
    project.zones.find((z) =>
      gx >= z.gridX && gx < z.gridX + z.gridWidth &&
      gy >= z.gridY && gy < z.gridY + z.gridHeight,
    );

  const handleMouseDown = (e: React.MouseEvent) => {
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
    const { gx, gy } = gridPos(e);
    const zone = findZoneAt(gx, gy);
    setHoveredZone(zone?.id ?? null);
  };

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    />
  );
}
