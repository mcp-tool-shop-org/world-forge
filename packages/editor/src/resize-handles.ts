// resize-handles.ts — pure math for zone resize handles
// Pattern: layout.ts, snap.ts — no React/store deps

export type HandleKind = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export interface ResizeHandle {
  kind: HandleKind;
  /** Grid coordinate of handle center (fractional for edge midpoints). */
  gx: number;
  gy: number;
}

export interface HandleAxes {
  movesLeft: boolean;
  movesRight: boolean;
  movesTop: boolean;
  movesBottom: boolean;
}

export interface ResizeResult {
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
}

/** Minimum zone dimension in grid cells (matches zone-paint constraint). */
export const MIN_ZONE_SIZE = 2;

/** Screen-pixel radius for handle rendering and hit detection. */
export const HANDLE_SCREEN_RADIUS = 6;

type ZoneRect = { gridX: number; gridY: number; gridWidth: number; gridHeight: number };

const AXES: Record<HandleKind, HandleAxes> = {
  nw: { movesLeft: true, movesRight: false, movesTop: true, movesBottom: false },
  n:  { movesLeft: false, movesRight: false, movesTop: true, movesBottom: false },
  ne: { movesLeft: false, movesRight: true, movesTop: true, movesBottom: false },
  e:  { movesLeft: false, movesRight: true, movesTop: false, movesBottom: false },
  se: { movesLeft: false, movesRight: true, movesTop: false, movesBottom: true },
  s:  { movesLeft: false, movesRight: false, movesTop: false, movesBottom: true },
  sw: { movesLeft: true, movesRight: false, movesTop: false, movesBottom: true },
  w:  { movesLeft: true, movesRight: false, movesTop: false, movesBottom: false },
};

/** Which edges a handle kind controls. */
export function getHandleAxes(kind: HandleKind): HandleAxes {
  return AXES[kind];
}

/**
 * Compute 8 handle positions for a zone in grid coordinates.
 * Corners sit at zone corner grid points; edge midpoints may be fractional.
 */
export function getHandles(zone: ZoneRect): ResizeHandle[] {
  const { gridX: x, gridY: y, gridWidth: w, gridHeight: h } = zone;
  const r = x + w;   // right
  const b = y + h;   // bottom
  const mx = x + w / 2;
  const my = y + h / 2;

  return [
    { kind: 'nw', gx: x,  gy: y  },
    { kind: 'n',  gx: mx, gy: y  },
    { kind: 'ne', gx: r,  gy: y  },
    { kind: 'e',  gx: r,  gy: my },
    { kind: 'se', gx: r,  gy: b  },
    { kind: 's',  gx: mx, gy: b  },
    { kind: 'sw', gx: x,  gy: b  },
    { kind: 'w',  gx: x,  gy: my },
  ];
}

/**
 * Apply a raw grid delta to a zone via a specific handle, clamped to MIN_ZONE_SIZE.
 * Returns the new zone geometry.
 */
export function applyResize(zone: ZoneRect, kind: HandleKind, rawDX: number, rawDY: number): ResizeResult {
  const axes = AXES[kind];
  let { gridX, gridY, gridWidth, gridHeight } = zone;

  if (axes.movesLeft) {
    const maxDX = gridWidth - MIN_ZONE_SIZE;
    const dx = Math.min(rawDX, maxDX);
    gridX += dx;
    gridWidth -= dx;
  } else if (axes.movesRight) {
    const minDX = MIN_ZONE_SIZE - gridWidth;
    const dx = Math.max(rawDX, minDX);
    gridWidth += dx;
  }

  if (axes.movesTop) {
    const maxDY = gridHeight - MIN_ZONE_SIZE;
    const dy = Math.min(rawDY, maxDY);
    gridY += dy;
    gridHeight -= dy;
  } else if (axes.movesBottom) {
    const minDY = MIN_ZONE_SIZE - gridHeight;
    const dy = Math.max(rawDY, minDY);
    gridHeight += dy;
  }

  return { gridX, gridY, gridWidth, gridHeight };
}

/**
 * Find the handle under a screen-space point. Returns the kind or null.
 * Checks all 8 handles using HANDLE_SCREEN_RADIUS in screen pixels.
 */
export function findHandleAt(
  screenX: number,
  screenY: number,
  zone: ZoneRect,
  tileSize: number,
  viewport: { panX: number; panY: number; zoom: number },
): HandleKind | null {
  const handles = getHandles(zone);
  const { panX, panY, zoom } = viewport;

  for (const h of handles) {
    const wx = h.gx * tileSize;
    const wy = h.gy * tileSize;
    const sx = (wx - panX) * zoom;
    const sy = (wy - panY) * zoom;
    const dx = screenX - sx;
    const dy = screenY - sy;
    if (Math.sqrt(dx * dx + dy * dy) < HANDLE_SCREEN_RADIUS) {
      return h.kind;
    }
  }

  return null;
}
