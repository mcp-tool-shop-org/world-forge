// speed-panel-scope.ts — overlapping target scope chips, cycling, and canvas highlight geometry

import type { WorldProject } from '@world-forge/schema';
import { decodeTileHitId, type HitResult } from './hit-testing.js';
import { elevationDrawOffset, zoneElevationAt } from './tile-render.js';
import { collectTownMarkers } from './town-markers.js';
import type { ViewportState } from './viewport.js';

export interface ScopeChip {
  key: string;
  hit: HitResult | null;
  kindLabel: string;
  nameLabel: string;
  label: string;
}

export type ScopeTargetHighlight =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'circle'; x: number; y: number; radius: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number };

export interface CanvasDraw2DContext {
  save: () => void;
  restore: () => void;
  setLineDash: (segments: number[]) => void;
  beginPath: () => void;
  rect: (x: number, y: number, w: number, h: number) => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
}

/** Stable identifier string for a Speed Panel hit target or `'canvas'`. */
export function scopeChipKey(hit: HitResult | null): string {
  return hit ? `${hit.type}:${hit.id}` : 'canvas';
}

const KIND_LABELS: Record<HitResult['type'], string> = {
  zone: 'Zone',
  entity: 'Entity',
  landmark: 'Landmark',
  spawn: 'Spawn',
  encounter: 'Encounter',
  connection: 'Connection',
  item: 'Item',
  market: 'Market',
  building: 'Building',
  hub: 'Hub',
  stronghold: 'Stronghold',
  station: 'Station',
  prop: 'Prop',
  tile: 'Tile',
};

function parseConnectionKey(id: string): [string, string] | null {
  const sep = id.indexOf('::');
  if (sep <= 0) return null;
  const from = id.slice(0, sep);
  const to = id.slice(sep + 2);
  return to ? [from, to] : null;
}

/**
 * Resolve grid coordinates for a tile hit by looking up placement `id` across `project.tileLayers`
 * first (how painted tiles are stored), falling back to `decodeTileHitId` for composite IDs.
 */
export function resolveTileHitPosition(
  project: WorldProject,
  hitId: string,
): { gridX: number; gridY: number } | null {
  for (const layer of project.tileLayers ?? []) {
    const placement = layer.tiles.find((t) => t.id === hitId);
    if (placement) {
      return { gridX: placement.gridX, gridY: placement.gridY };
    }
  }
  const decoded = decodeTileHitId(hitId);
  return decoded ? { gridX: decoded.gridX, gridY: decoded.gridY } : null;
}

/** Resolve human-readable kind and name labels for any canvas hit or empty Canvas target. */
export function formatScopeTarget(
  hit: HitResult | null,
  project: WorldProject,
): { kindLabel: string; nameLabel: string; label: string } {
  if (!hit) {
    return { kindLabel: 'Canvas', nameLabel: '', label: 'Canvas' };
  }

  let kindLabel = KIND_LABELS[hit.type];
  let nameLabel = hit.id;

  switch (hit.type) {
    case 'zone': {
      nameLabel = project.zones.find((z) => z.id === hit.id)?.name || hit.id;
      break;
    }
    case 'entity': {
      const ep = project.entityPlacements.find((e) => e.entityId === hit.id);
      if (ep?.role === 'npc') kindLabel = 'NPC';
      nameLabel = ep?.name || hit.id;
      break;
    }
    case 'landmark': {
      nameLabel = project.landmarks.find((l) => l.id === hit.id)?.name || hit.id;
      break;
    }
    case 'spawn': {
      const sp = project.spawnPoints.find((s) => s.id === hit.id);
      const zoneName = sp ? project.zones.find((z) => z.id === sp.zoneId)?.name : undefined;
      nameLabel = zoneName || hit.id;
      break;
    }
    case 'encounter': {
      const enc = project.encounterAnchors.find((e) => e.id === hit.id);
      nameLabel = enc ? enc.encounterType : hit.id;
      break;
    }
    case 'connection': {
      const parsed = parseConnectionKey(hit.id);
      if (parsed) {
        const fromName = project.zones.find((z) => z.id === parsed[0])?.name || parsed[0];
        const toName = project.zones.find((z) => z.id === parsed[1])?.name || parsed[1];
        nameLabel = `${fromName} \u2192 ${toName}`;
      }
      break;
    }
    case 'item': {
      nameLabel = (project.itemPlacements ?? []).find((i) => i.itemId === hit.id)?.name || hit.id;
      break;
    }
    case 'prop': {
      const pl = (project.propPlacements ?? []).find((p) => p.id === hit.id);
      const def = pl ? (project.props ?? []).find((d) => d.id === pl.propId) : undefined;
      nameLabel = def?.name || pl?.propId || hit.id;
      break;
    }
    case 'tile': {
      const pos = resolveTileHitPosition(project, hit.id);
      if (pos) {
        nameLabel = `(${pos.gridX}, ${pos.gridY})`;
      }
      break;
    }
    case 'market': {
      const m = (project.marketNodes ?? []).find((n) => n.id === hit.id);
      const merchant = m?.merchantEntityId
        ? project.entityPlacements.find((e) => e.entityId === m.merchantEntityId)?.name
        : undefined;
      nameLabel = merchant || hit.id;
      break;
    }
    case 'building': {
      nameLabel = (project.buildings ?? []).find((b) => b.id === hit.id)?.name || hit.id;
      break;
    }
    case 'hub': {
      nameLabel = (project.hubs ?? []).find((h) => h.id === hit.id)?.name || hit.id;
      break;
    }
    case 'stronghold': {
      nameLabel = (project.strongholds ?? []).find((s) => s.id === hit.id)?.name || hit.id;
      break;
    }
    case 'station': {
      nameLabel = (project.craftingStations ?? []).find((s) => s.id === hit.id)?.stationType || hit.id;
      break;
    }
  }

  return { kindLabel, nameLabel, label: `${kindLabel}: ${nameLabel}` };
}

/**
 * Build ordered scope chips when 2+ objects overlap at the pointer (`findAllHitsAt` order + Canvas last).
 * Returns `[]` when 0 or 1 object is under the pointer so single-object openings show no chip row.
 */
export function buildScopeChips(hits: readonly HitResult[], project: WorldProject): ScopeChip[] {
  if (hits.length < 2) return [];
  const chips: ScopeChip[] = hits.map((hit) => {
    const info = formatScopeTarget(hit, project);
    return {
      key: scopeChipKey(hit),
      hit,
      ...info,
    };
  });
  chips.push({
    key: 'canvas',
    hit: null,
    kindLabel: 'Canvas',
    nameLabel: '',
    label: 'Canvas',
  });
  return chips;
}

/** Return the index of `activeContext` inside `chips`, or `-1` when absent so wrong chips are never marked active. */
export function findActiveScopeChipIndex(
  chips: readonly ScopeChip[],
  activeContext: HitResult | null,
): number {
  if (chips.length === 0) return -1;
  const key = scopeChipKey(activeContext);
  return chips.findIndex((c) => c.key === key);
}

/** Return the next or previous target along `chips` (wrapping cleanly at ends). */
export function cycleScopeChipIndex(
  chips: readonly ScopeChip[],
  activeContext: HitResult | null,
  direction: 1 | -1,
): HitResult | null {
  if (chips.length === 0) return activeContext;
  const cur = findActiveScopeChipIndex(chips, activeContext);
  if (cur < 0) {
    return (direction === 1 ? chips[0] : chips[chips.length - 1]).hit;
  }
  const next = (cur + direction + chips.length) % chips.length;
  return chips[next].hit;
}

/** Format the polite live-region string announced on panel open and scope switches. */
export function formatScopeTargetAnnouncement(
  target: HitResult | null,
  project: WorldProject,
  switched: boolean,
): string {
  const { label } = formatScopeTarget(target, project);
  return switched ? `Target switched to ${label}` : `Speed Panel target: ${label}`;
}

/** Compute world-pixel highlight geometry for the active Speed Panel target (no project mutation). */
export function computeScopeTargetHighlight(
  target: HitResult | null,
  project: WorldProject,
  tileSize: number,
): ScopeTargetHighlight | null {
  if (!target) return null;

  switch (target.type) {
    case 'zone': {
      const z = project.zones.find((zn) => zn.id === target.id);
      if (!z) return null;
      return {
        kind: 'rect',
        x: z.gridX * tileSize,
        y: z.gridY * tileSize,
        width: z.gridWidth * tileSize,
        height: z.gridHeight * tileSize,
      };
    }
    case 'entity': {
      const ep = project.entityPlacements.find((e) => e.entityId === target.id);
      const z = ep ? project.zones.find((zn) => zn.id === ep.zoneId) : undefined;
      if (!ep || !z) return null;
      return {
        kind: 'circle',
        x: (ep.gridX ?? z.gridX + 2) * tileSize,
        y: (ep.gridY ?? z.gridY + 2) * tileSize,
        radius: 14,
      };
    }
    case 'landmark': {
      const lm = project.landmarks.find((l) => l.id === target.id);
      if (!lm) return null;
      return {
        kind: 'circle',
        x: lm.gridX * tileSize,
        y: lm.gridY * tileSize,
        radius: 14,
      };
    }
    case 'spawn': {
      const sp = project.spawnPoints.find((s) => s.id === target.id);
      if (!sp) return null;
      return {
        kind: 'circle',
        x: sp.gridX * tileSize,
        y: sp.gridY * tileSize,
        radius: 14,
      };
    }
    case 'encounter': {
      const enc = project.encounterAnchors.find((e) => e.id === target.id);
      const z = enc ? project.zones.find((zn) => zn.id === enc.zoneId) : undefined;
      if (!z) return null;
      return {
        kind: 'circle',
        x: (z.gridX + z.gridWidth / 2) * tileSize,
        y: (z.gridY + z.gridHeight / 2) * tileSize,
        radius: 18,
      };
    }
    case 'item': {
      const ip = (project.itemPlacements ?? []).find((i) => i.itemId === target.id);
      const z = ip ? project.zones.find((zn) => zn.id === ip.zoneId) : undefined;
      if (!ip || !z) return null;
      return {
        kind: 'circle',
        x: (ip.gridX ?? z.gridX + 2) * tileSize,
        y: (ip.gridY ?? z.gridY + 2) * tileSize,
        radius: 12,
      };
    }
    case 'prop': {
      const pl = (project.propPlacements ?? []).find((p) => p.id === target.id);
      if (!pl) return null;
      const def = (project.props ?? []).find((d) => d.id === pl.propId);
      return {
        kind: 'rect',
        x: pl.gridX * tileSize,
        y: pl.gridY * tileSize,
        width: (def?.width ?? 1) * tileSize,
        height: (def?.height ?? 1) * tileSize,
      };
    }
    case 'tile': {
      const pos = resolveTileHitPosition(project, target.id);
      if (!pos) return null;
      return {
        kind: 'rect',
        x: pos.gridX * tileSize,
        y: pos.gridY * tileSize + elevationDrawOffset(zoneElevationAt(project.zones, pos.gridX, pos.gridY)),
        width: tileSize,
        height: tileSize,
      };
    }
    case 'connection': {
      const parsed = parseConnectionKey(target.id);
      if (!parsed) return null;
      const from = project.zones.find((z) => z.id === parsed[0]);
      const to = project.zones.find((z) => z.id === parsed[1]);
      if (!from || !to) return null;
      return {
        kind: 'line',
        x1: (from.gridX + from.gridWidth / 2) * tileSize,
        y1: (from.gridY + from.gridHeight / 2) * tileSize,
        x2: (to.gridX + to.gridWidth / 2) * tileSize,
        y2: (to.gridY + to.gridHeight / 2) * tileSize,
      };
    }
    case 'market':
    case 'station':
    case 'building':
    case 'hub':
    case 'stronghold': {
      const marker = collectTownMarkers(project, tileSize).find(
        (m) => m.type === target.type && m.id === target.id,
      );
      if (!marker) return null;
      if (marker.w != null && marker.h != null) {
        return { kind: 'rect', x: marker.x, y: marker.y, width: marker.w, height: marker.h };
      }
      return { kind: 'circle', x: marker.x, y: marker.y, radius: 14 };
    }
  }
}

/** Project a world-space target highlight into screen-space box coordinates for DOM overlay alignment. */
export function scopeHighlightToScreenBox(
  highlight: ScopeTargetHighlight,
  viewport: ViewportState,
): { left: number; top: number; width: number; height: number } {
  const toScreen = (wx: number, wy: number) => ({
    sx: (wx - viewport.panX) * viewport.zoom,
    sy: (wy - viewport.panY) * viewport.zoom,
  });

  if (highlight.kind === 'rect') {
    const p1 = toScreen(highlight.x, highlight.y);
    return {
      left: p1.sx - 2,
      top: p1.sy - 2,
      width: Math.max(8, highlight.width * viewport.zoom + 4),
      height: Math.max(8, highlight.height * viewport.zoom + 4),
    };
  }
  if (highlight.kind === 'circle') {
    const c = toScreen(highlight.x, highlight.y);
    const r = Math.max(10, highlight.radius * viewport.zoom);
    return {
      left: c.sx - r,
      top: c.sy - r,
      width: r * 2,
      height: r * 2,
    };
  }
  const a = toScreen(highlight.x1, highlight.y1);
  const b = toScreen(highlight.x2, highlight.y2);
  const minX = Math.min(a.sx, b.sx);
  const minY = Math.min(a.sy, b.sy);
  return {
    left: minX - 4,
    top: minY - 4,
    width: Math.max(8, Math.abs(b.sx - a.sx) + 8),
    height: Math.max(8, Math.abs(b.sy - a.sy) + 8),
  };
}

/** Paint a crisp ephemeral outline onto the 2D canvas for the active Speed Panel scope target. */
export function drawScopeTargetHighlight(
  ctx: CanvasDraw2DContext,
  highlight: ScopeTargetHighlight,
  zoom: number,
  color: string,
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3 / zoom;
  ctx.setLineDash([6 / zoom, 3 / zoom]);
  ctx.beginPath();
  if (highlight.kind === 'rect') {
    const pad = 2 / zoom;
    ctx.rect(highlight.x - pad, highlight.y - pad, highlight.width + pad * 2, highlight.height + pad * 2);
  } else if (highlight.kind === 'circle') {
    ctx.arc(highlight.x, highlight.y, highlight.radius / zoom, 0, Math.PI * 2);
  } else {
    ctx.moveTo(highlight.x1, highlight.y1);
    ctx.lineTo(highlight.x2, highlight.y2);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
