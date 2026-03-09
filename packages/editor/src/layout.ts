// layout.ts — pure layout math for align & distribute operations

import type { WorldProject } from '@world-forge/schema';
import type { SelectionSet } from './store/editor-store.js';

export type AlignAxis = 'left' | 'center-h' | 'right' | 'top' | 'center-v' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface ObjectBound {
  type: 'zone' | 'entity' | 'landmark' | 'spawn';
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

// Entity fallback offset when gridX/gridY are not set (matches renderer convention)
const ENTITY_FALLBACK_OFFSET = 2;

/** Compute bounding rects for all selected objects in grid coordinates. */
export function getSelectionBounds(
  project: WorldProject,
  selection: SelectionSet,
): ObjectBound[] {
  const bounds: ObjectBound[] = [];

  for (const zid of selection.zones) {
    const z = project.zones.find((zone) => zone.id === zid);
    if (!z) continue;
    bounds.push({
      type: 'zone', id: z.id,
      left: z.gridX, top: z.gridY,
      right: z.gridX + z.gridWidth, bottom: z.gridY + z.gridHeight,
    });
  }

  for (const eid of selection.entities) {
    const e = project.entityPlacements.find((ep) => ep.entityId === eid);
    if (!e) continue;
    let gx = e.gridX;
    let gy = e.gridY;
    if (gx == null || gy == null) {
      const zone = project.zones.find((z) => z.id === e.zoneId);
      gx = (zone?.gridX ?? 0) + ENTITY_FALLBACK_OFFSET;
      gy = (zone?.gridY ?? 0) + ENTITY_FALLBACK_OFFSET;
    }
    bounds.push({ type: 'entity', id: e.entityId, left: gx, top: gy, right: gx, bottom: gy });
  }

  for (const lid of selection.landmarks) {
    const l = project.landmarks.find((lm) => lm.id === lid);
    if (!l) continue;
    bounds.push({ type: 'landmark', id: l.id, left: l.gridX, top: l.gridY, right: l.gridX, bottom: l.gridY });
  }

  for (const sid of selection.spawns) {
    const s = project.spawnPoints.find((sp) => sp.id === sid);
    if (!s) continue;
    bounds.push({ type: 'spawn', id: s.id, left: s.gridX, top: s.gridY, right: s.gridX, bottom: s.gridY });
  }

  return bounds;
}

/** Apply per-object deltas to the project. Materializes entity positions if needed. */
function applyDeltas(
  project: WorldProject,
  deltas: Map<string, { dx: number; dy: number }>,
  selection: SelectionSet,
): WorldProject {
  const zSet = new Set(selection.zones);
  const eSet = new Set(selection.entities);
  const lSet = new Set(selection.landmarks);
  const sSet = new Set(selection.spawns);

  return {
    ...project,
    zones: project.zones.map((z) => {
      if (!zSet.has(z.id)) return z;
      const d = deltas.get(`zone:${z.id}`);
      if (!d || (d.dx === 0 && d.dy === 0)) return z;
      return { ...z, gridX: Math.round(z.gridX + d.dx), gridY: Math.round(z.gridY + d.dy) };
    }),
    entityPlacements: project.entityPlacements.map((e) => {
      if (!eSet.has(e.entityId)) return e;
      const d = deltas.get(`entity:${e.entityId}`);
      if (!d) return e;
      // Materialize position if not explicitly set
      let gx = e.gridX;
      let gy = e.gridY;
      if (gx == null || gy == null) {
        const zone = project.zones.find((z) => z.id === e.zoneId);
        gx = (zone?.gridX ?? 0) + ENTITY_FALLBACK_OFFSET;
        gy = (zone?.gridY ?? 0) + ENTITY_FALLBACK_OFFSET;
      }
      if (d.dx === 0 && d.dy === 0 && e.gridX != null) return e;
      return { ...e, gridX: Math.round(gx + d.dx), gridY: Math.round(gy + d.dy) };
    }),
    landmarks: project.landmarks.map((l) => {
      if (!lSet.has(l.id)) return l;
      const d = deltas.get(`landmark:${l.id}`);
      if (!d || (d.dx === 0 && d.dy === 0)) return l;
      return { ...l, gridX: Math.round(l.gridX + d.dx), gridY: Math.round(l.gridY + d.dy) };
    }),
    spawnPoints: project.spawnPoints.map((s) => {
      if (!sSet.has(s.id)) return s;
      const d = deltas.get(`spawn:${s.id}`);
      if (!d || (d.dx === 0 && d.dy === 0)) return s;
      return { ...s, gridX: Math.round(s.gridX + d.dx), gridY: Math.round(s.gridY + d.dy) };
    }),
  };
}

/** Align all selected objects along an axis. Returns unchanged project if < 2 objects. */
export function alignSelected(
  project: WorldProject,
  selection: SelectionSet,
  axis: AlignAxis,
): WorldProject {
  const bounds = getSelectionBounds(project, selection);
  if (bounds.length < 2) return project;

  // Compute anchor from selection extremes
  let anchor: number;
  switch (axis) {
    case 'left':
      anchor = Math.min(...bounds.map((b) => b.left));
      break;
    case 'right':
      anchor = Math.max(...bounds.map((b) => b.right));
      break;
    case 'top':
      anchor = Math.min(...bounds.map((b) => b.top));
      break;
    case 'bottom':
      anchor = Math.max(...bounds.map((b) => b.bottom));
      break;
    case 'center-h': {
      const minL = Math.min(...bounds.map((b) => b.left));
      const maxR = Math.max(...bounds.map((b) => b.right));
      anchor = (minL + maxR) / 2;
      break;
    }
    case 'center-v': {
      const minT = Math.min(...bounds.map((b) => b.top));
      const maxB = Math.max(...bounds.map((b) => b.bottom));
      anchor = (minT + maxB) / 2;
      break;
    }
  }

  // Compute per-object deltas
  const deltas = new Map<string, { dx: number; dy: number }>();
  for (const b of bounds) {
    let dx = 0;
    let dy = 0;
    switch (axis) {
      case 'left':     dx = anchor - b.left; break;
      case 'right':    dx = anchor - b.right; break;
      case 'top':      dy = anchor - b.top; break;
      case 'bottom':   dy = anchor - b.bottom; break;
      case 'center-h': dx = anchor - (b.left + b.right) / 2; break;
      case 'center-v': dy = anchor - (b.top + b.bottom) / 2; break;
    }
    deltas.set(`${b.type}:${b.id}`, { dx, dy });
  }

  return applyDeltas(project, deltas, selection);
}

/** Distribute selected objects evenly along an axis. Returns unchanged if < 3 objects. */
export function distributeSelected(
  project: WorldProject,
  selection: SelectionSet,
  axis: DistributeAxis,
): WorldProject {
  const bounds = getSelectionBounds(project, selection);
  if (bounds.length < 3) return project;

  // Sort by center along the distribution axis
  const sorted = [...bounds].sort((a, b) => {
    const ca = axis === 'horizontal'
      ? (a.left + a.right) / 2
      : (a.top + a.bottom) / 2;
    const cb = axis === 'horizontal'
      ? (b.left + b.right) / 2
      : (b.top + b.bottom) / 2;
    return ca - cb;
  });

  // Compute evenly spaced centers between first and last
  const firstCenter = axis === 'horizontal'
    ? (sorted[0].left + sorted[0].right) / 2
    : (sorted[0].top + sorted[0].bottom) / 2;
  const lastCenter = axis === 'horizontal'
    ? (sorted[sorted.length - 1].left + sorted[sorted.length - 1].right) / 2
    : (sorted[sorted.length - 1].top + sorted[sorted.length - 1].bottom) / 2;
  const gap = (lastCenter - firstCenter) / (sorted.length - 1);

  const deltas = new Map<string, { dx: number; dy: number }>();
  for (let i = 0; i < sorted.length; i++) {
    const b = sorted[i];
    const currentCenter = axis === 'horizontal'
      ? (b.left + b.right) / 2
      : (b.top + b.bottom) / 2;
    const targetCenter = firstCenter + gap * i;
    const delta = targetCenter - currentCenter;
    const dx = axis === 'horizontal' ? delta : 0;
    const dy = axis === 'vertical' ? delta : 0;
    deltas.set(`${b.type}:${b.id}`, { dx, dy });
  }

  return applyDeltas(project, deltas, selection);
}
