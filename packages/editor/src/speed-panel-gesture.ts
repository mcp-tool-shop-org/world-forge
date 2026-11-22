// speed-panel-gesture.ts — pure state machines and guards for Speed Panel opening triggers

import type { WorldProject } from '@world-forge/schema';
import type { HitResult } from './hit-testing.js';
import type { SelectionSet } from './store/editor-store.js';
import { getConnectionEndpoints } from './connection-lines.js';
import type { ModalId } from './store/modal-store.js';
import type { ViewportState } from './viewport.js';
import {
  normalizeTriggerKeyCode,
  resolveGestureThresholds,
  type ResolvedGestureThresholds,
  type SpeedPanelOptions,
} from './store/speed-panel-options-store.js';

export interface ActiveRightPress {
  startSX: number;
  startSY: number;
  pointerId: number;
  pointerType: string;
  dragged: boolean;
}

export interface LastRightClick {
  time: number;
  sx: number;
  sy: number;
}

export interface RightClickGestureState {
  active: ActiveRightPress | null;
  lastClick: LastRightClick | null;
}

export function createInitialRightClickGestureState(): RightClickGestureState {
  return { active: null, lastClick: null };
}

export function isMacPlatform(platform?: string, userAgent?: string): boolean {
  const plat = platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '');
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return /mac/i.test(plat) || /macintosh|mac os x/i.test(ua);
}

/** True when the pointer event represents a secondary/context-click press (RMB, or Ctrl+click on macOS). */
export function isRightClickPointer(
  e: { button: number; ctrlKey?: boolean },
  isMac: boolean,
): boolean {
  return e.button === 2 || (isMac && e.button === 0 && Boolean(e.ctrlKey));
}

export function beginRightPointer(
  state: RightClickGestureState,
  event: { sx: number; sy: number; pointerId: number; pointerType?: string },
): RightClickGestureState {
  return {
    ...state,
    active: {
      startSX: event.sx,
      startSY: event.sy,
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      dragged: false,
    },
  };
}

export function moveRightPointer(
  state: RightClickGestureState,
  event: { sx: number; sy: number; pointerId: number },
  options: SpeedPanelOptions,
): { state: RightClickGestureState; isDragging: boolean; thresholds: ResolvedGestureThresholds } {
  const active = state.active;
  if (!active || active.pointerId !== event.pointerId) {
    return {
      state,
      isDragging: false,
      thresholds: resolveGestureThresholds(options, active?.pointerType),
    };
  }
  const thresholds = resolveGestureThresholds(options, active.pointerType);
  const dist = Math.hypot(event.sx - active.startSX, event.sy - active.startSY);
  const dragged = active.dragged || dist > thresholds.driftPx;
  if (dragged === active.dragged) {
    return { state, isDragging: dragged, thresholds };
  }
  return {
    state: {
      ...state,
      active: { ...active, dragged: true },
    },
    isDragging: true,
    thresholds,
  };
}

export type RightClickEndOutcome =
  | { kind: 'ignore'; state: RightClickGestureState }
  | { kind: 'drag-end'; state: RightClickGestureState }
  | { kind: 'open-compact-menu'; x: number; y: number; state: RightClickGestureState }
  | { kind: 'keep-compact-menu'; x: number; y: number; state: RightClickGestureState }
  | { kind: 'open-speed-panel'; x: number; y: number; state: RightClickGestureState };

export function endRightPointer(
  state: RightClickGestureState,
  event: { sx: number; sy: number; pointerId: number; pointerType?: string; now: number },
  options: SpeedPanelOptions,
): RightClickEndOutcome {
  const active = state.active;
  if (!active || active.pointerId !== event.pointerId) {
    return { kind: 'ignore', state };
  }

  const pointerType = event.pointerType || active.pointerType;
  const thresholds = resolveGestureThresholds(options, pointerType);
  const pressDrift = Math.hypot(event.sx - active.startSX, event.sy - active.startSY);

  if (active.dragged || pressDrift > thresholds.driftPx) {
    return {
      kind: 'drag-end',
      state: { active: null, lastClick: null },
    };
  }

  const prev = state.lastClick;
  if (prev) {
    const elapsed = event.now - prev.time;
    const interDist = Math.hypot(event.sx - prev.sx, event.sy - prev.sy);
    if (elapsed <= thresholds.windowMs && interDist <= thresholds.radiusPx) {
      if (options.doubleRightClickEnabled) {
        return {
          kind: 'open-speed-panel',
          x: prev.sx,
          y: prev.sy,
          state: { active: null, lastClick: null },
        };
      }
      return {
        kind: 'keep-compact-menu',
        x: prev.sx,
        y: prev.sy,
        state: {
          active: null,
          lastClick: { time: event.now, sx: event.sx, sy: event.sy },
        },
      };
    }
  }

  return {
    kind: 'open-compact-menu',
    x: event.sx,
    y: event.sy,
    state: {
      active: null,
      lastClick: { time: event.now, sx: event.sx, sy: event.sy },
    },
  };
}

export interface KeyTriggerEventLike {
  code?: string;
  key?: string;
  keyCode?: number;
  repeat?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  target?: unknown;
}

export interface KeyTriggerEnv {
  options: SpeedPanelOptions;
  pointerOverCanvas: boolean;
  canvasFocused: boolean;
  activeModal: ModalId;
  showSearch: boolean;
  showSpeedPanel: boolean;
  activeElement?: unknown;
}

function isTextEntryElement(node: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const el = node as {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
  };
  const tag = el.tagName?.toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  if (typeof el.getAttribute === 'function') {
    const ce = el.getAttribute('contenteditable');
    if (ce !== null && ce !== 'false') return true;
  }
  return false;
}

/** Decide whether a keydown event should open the Speed Panel. */
export function shouldTriggerSpeedPanelKey(
  e: KeyTriggerEventLike,
  env: KeyTriggerEnv,
): boolean {
  if (!env.options.keyTriggerEnabled) return false;
  if (env.activeModal != null || env.showSearch || env.showSpeedPanel) return false;
  if (!env.pointerOverCanvas && !env.canvasFocused) return false;
  if (e.repeat) return false;
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return false;
  if (e.isComposing || e.key === 'Dead' || e.keyCode === 229) return false;
  if (isTextEntryElement(e.target) || isTextEntryElement(env.activeElement)) return false;

  const eventCode =
    (e.code ? normalizeTriggerKeyCode(e.code) : null) ??
    (e.key ? normalizeTriggerKeyCode(e.key) : null);
  return eventCode === env.options.triggerKey;
}

function gridToScreenPoint(
  gx: number,
  gy: number,
  tileSize: number,
  viewport: ViewportState,
): { sx: number; sy: number } {
  return {
    sx: (gx * tileSize - viewport.panX) * viewport.zoom,
    sy: (gy * tileSize - viewport.panY) * viewport.zoom,
  };
}

function clampAnchor(
  sx: number,
  sy: number,
  canvasSize: { w: number; h: number },
): { sx: number; sy: number } {
  const maxW = Math.max(16, canvasSize.w - 8);
  const maxH = Math.max(16, canvasSize.h - 8);
  return {
    sx: Math.min(maxW, Math.max(8, sx)),
    sy: Math.min(maxH, Math.max(8, sy)),
  };
}

/**
 * Compute Speed Panel anchor and target hit when triggered from keyboard focus on canvas
 * without a pointer hovering over the canvas: selected object centroid/hit, or canvas centre.
 */
export function getKeyboardSpeedPanelAnchor(
  canvasSize: { w: number; h: number },
  selection: SelectionSet,
  selectedConnection: { from: string; to: string } | null,
  project: WorldProject,
  viewport: ViewportState,
  tileSize: number,
): { sx: number; sy: number; hit: HitResult | null } {
  if (selectedConnection) {
    const endpoints = getConnectionEndpoints(
      { fromZoneId: selectedConnection.from, toZoneId: selectedConnection.to, bidirectional: true },
      project.zones,
      tileSize,
    );
    if (endpoints) {
      const mx = (endpoints.fx + endpoints.tx) / 2;
      const my = (endpoints.fy + endpoints.ty) / 2;
      const clamped = clampAnchor(
        (mx - viewport.panX) * viewport.zoom,
        (my - viewport.panY) * viewport.zoom,
        canvasSize,
      );
      return {
        ...clamped,
        hit: { type: 'connection', id: `${selectedConnection.from}::${selectedConnection.to}` },
      };
    }
  }

  if (selection.entities.length > 0) {
    const ent = project.entityPlacements.find((e) => e.entityId === selection.entities[0]);
    if (ent) {
      const zone = project.zones.find((z) => z.id === ent.zoneId);
      const gx = (ent.gridX ?? (zone ? zone.gridX + 2 : 0)) + 0.5;
      const gy = (ent.gridY ?? (zone ? zone.gridY + 2 : 0)) + 0.5;
      const pt = gridToScreenPoint(gx, gy, tileSize, viewport);
      return { ...clampAnchor(pt.sx, pt.sy, canvasSize), hit: { type: 'entity', id: ent.entityId } };
    }
  }

  if (selection.landmarks.length > 0) {
    const lm = project.landmarks.find((l) => l.id === selection.landmarks[0]);
    if (lm) {
      const pt = gridToScreenPoint(lm.gridX + 0.5, lm.gridY + 0.5, tileSize, viewport);
      return { ...clampAnchor(pt.sx, pt.sy, canvasSize), hit: { type: 'landmark', id: lm.id } };
    }
  }

  if (selection.spawns.length > 0) {
    const sp = project.spawnPoints.find((s) => s.id === selection.spawns[0]);
    if (sp) {
      const pt = gridToScreenPoint(sp.gridX + 0.5, sp.gridY + 0.5, tileSize, viewport);
      return { ...clampAnchor(pt.sx, pt.sy, canvasSize), hit: { type: 'spawn', id: sp.id } };
    }
  }

  if (selection.encounters.length > 0) {
    const enc = project.encounterAnchors.find((e) => e.id === selection.encounters[0]);
    if (enc) {
      const zone = project.zones.find((z) => z.id === enc.zoneId);
      const gx = zone ? zone.gridX + zone.gridWidth / 2 : 0;
      const gy = zone ? zone.gridY + zone.gridHeight / 2 : 0;
      const pt = gridToScreenPoint(gx, gy, tileSize, viewport);
      return { ...clampAnchor(pt.sx, pt.sy, canvasSize), hit: { type: 'encounter', id: enc.id } };
    }
  }

  if (selection.zones.length > 0) {
    const zone = project.zones.find((z) => z.id === selection.zones[0]);
    if (zone) {
      const pt = gridToScreenPoint(
        zone.gridX + zone.gridWidth / 2,
        zone.gridY + zone.gridHeight / 2,
        tileSize,
        viewport,
      );
      return { ...clampAnchor(pt.sx, pt.sy, canvasSize), hit: { type: 'zone', id: zone.id } };
    }
  }

  return {
    sx: Math.round(canvasSize.w / 2),
    sy: Math.round(canvasSize.h / 2),
    hit: null,
  };
}
