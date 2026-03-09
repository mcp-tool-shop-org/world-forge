// snap.ts — pure snap computation for object-to-object snapping during drag

import type { WorldProject } from '@world-forge/schema';
import type { SelectionSet } from './store/editor-store.js';
import { getSelectionBounds, type ObjectBound } from './layout.js';

/** A visual guide line to render during snap */
export interface SnapGuide {
  axis: 'x' | 'y';
  value: number;        // grid coordinate where guide sits
  from: number;         // perpendicular start (grid coord)
  to: number;           // perpendicular end (grid coord)
}

/** Result of snap computation */
export interface SnapResult {
  dx: number;           // adjusted delta (replaces raw dx)
  dy: number;           // adjusted delta
  guides: SnapGuide[];  // lines to render
}

/** A snap-able edge from a non-selected object */
interface SnapEdge {
  axis: 'x' | 'y';
  value: number;
  extent: [number, number]; // perpendicular extent for guide rendering
}

export const SNAP_RADIUS = 1; // grid cells

// Entity fallback offset (matches layout.ts)
const ENTITY_FALLBACK_OFFSET = 2;

/** Collect snap candidate edges from all non-selected objects. */
export function getNonSelectedEdges(
  project: WorldProject,
  selection: SelectionSet,
): SnapEdge[] {
  const edges: SnapEdge[] = [];
  const zSet = new Set(selection.zones);
  const eSet = new Set(selection.entities);
  const lSet = new Set(selection.landmarks);
  const sSet = new Set(selection.spawns);

  for (const z of project.zones) {
    if (zSet.has(z.id)) continue;
    const l = z.gridX;
    const r = z.gridX + z.gridWidth;
    const t = z.gridY;
    const b = z.gridY + z.gridHeight;
    const cx = (l + r) / 2;
    const cy = (t + b) / 2;
    // X-axis edges (vertical lines) with Y extent
    edges.push({ axis: 'x', value: l, extent: [t, b] });
    edges.push({ axis: 'x', value: r, extent: [t, b] });
    edges.push({ axis: 'x', value: cx, extent: [t, b] });
    // Y-axis edges (horizontal lines) with X extent
    edges.push({ axis: 'y', value: t, extent: [l, r] });
    edges.push({ axis: 'y', value: b, extent: [l, r] });
    edges.push({ axis: 'y', value: cy, extent: [l, r] });
  }

  for (const ep of project.entityPlacements) {
    if (eSet.has(ep.entityId)) continue;
    let gx = ep.gridX;
    let gy = ep.gridY;
    if (gx == null || gy == null) {
      const zone = project.zones.find((z) => z.id === ep.zoneId);
      gx = (zone?.gridX ?? 0) + ENTITY_FALLBACK_OFFSET;
      gy = (zone?.gridY ?? 0) + ENTITY_FALLBACK_OFFSET;
    }
    edges.push({ axis: 'x', value: gx, extent: [gy, gy] });
    edges.push({ axis: 'y', value: gy, extent: [gx, gx] });
  }

  for (const lm of project.landmarks) {
    if (lSet.has(lm.id)) continue;
    edges.push({ axis: 'x', value: lm.gridX, extent: [lm.gridY, lm.gridY] });
    edges.push({ axis: 'y', value: lm.gridY, extent: [lm.gridX, lm.gridX] });
  }

  for (const sp of project.spawnPoints) {
    if (sSet.has(sp.id)) continue;
    edges.push({ axis: 'x', value: sp.gridX, extent: [sp.gridY, sp.gridY] });
    edges.push({ axis: 'y', value: sp.gridY, extent: [sp.gridX, sp.gridX] });
  }

  return edges;
}

/** Compute snapped delta and guide lines for a drag operation. */
export function computeSnap(
  project: WorldProject,
  selection: SelectionSet,
  rawDX: number,
  rawDY: number,
): SnapResult {
  const bounds = getSelectionBounds(project, selection);
  if (bounds.length === 0) return { dx: rawDX, dy: rawDY, guides: [] };

  // Group bounding box
  const groupLeft = Math.min(...bounds.map((b) => b.left));
  const groupRight = Math.max(...bounds.map((b) => b.right));
  const groupTop = Math.min(...bounds.map((b) => b.top));
  const groupBottom = Math.max(...bounds.map((b) => b.bottom));

  // Tentative position after raw delta
  const tentLeft = groupLeft + rawDX;
  const tentRight = groupRight + rawDX;
  const tentCenterX = (tentLeft + tentRight) / 2;
  const tentTop = groupTop + rawDY;
  const tentBottom = groupBottom + rawDY;
  const tentCenterY = (tentTop + tentBottom) / 2;

  // Selection edges for matching
  const selXEdges = [
    { value: tentLeft, extent: [tentTop, tentBottom] as [number, number] },
    { value: tentRight, extent: [tentTop, tentBottom] as [number, number] },
    { value: tentCenterX, extent: [tentTop, tentBottom] as [number, number] },
  ];
  const selYEdges = [
    { value: tentTop, extent: [tentLeft, tentRight] as [number, number] },
    { value: tentBottom, extent: [tentLeft, tentRight] as [number, number] },
    { value: tentCenterY, extent: [tentLeft, tentRight] as [number, number] },
  ];

  const candidates = getNonSelectedEdges(project, selection);
  const guides: SnapGuide[] = [];

  // Find best X snap
  let bestXDist = Infinity;
  let snapAdjustX = 0;
  let bestXGuide: SnapGuide | null = null;

  for (const sel of selXEdges) {
    for (const cand of candidates) {
      if (cand.axis !== 'x') continue;
      const dist = Math.abs(sel.value - cand.value);
      if (dist <= SNAP_RADIUS && dist < bestXDist) {
        bestXDist = dist;
        snapAdjustX = cand.value - sel.value;
        bestXGuide = {
          axis: 'x',
          value: cand.value,
          from: Math.min(sel.extent[0], cand.extent[0]),
          to: Math.max(sel.extent[1], cand.extent[1]),
        };
      }
    }
  }

  // Find best Y snap
  let bestYDist = Infinity;
  let snapAdjustY = 0;
  let bestYGuide: SnapGuide | null = null;

  for (const sel of selYEdges) {
    for (const cand of candidates) {
      if (cand.axis !== 'y') continue;
      const dist = Math.abs(sel.value - cand.value);
      if (dist <= SNAP_RADIUS && dist < bestYDist) {
        bestYDist = dist;
        snapAdjustY = cand.value - sel.value;
        bestYGuide = {
          axis: 'y',
          value: cand.value,
          from: Math.min(sel.extent[0], cand.extent[0]),
          to: Math.max(sel.extent[1], cand.extent[1]),
        };
      }
    }
  }

  if (bestXGuide) guides.push(bestXGuide);
  if (bestYGuide) guides.push(bestYGuide);

  return {
    dx: rawDX + snapAdjustX,
    dy: rawDY + snapAdjustY,
    guides,
  };
}
