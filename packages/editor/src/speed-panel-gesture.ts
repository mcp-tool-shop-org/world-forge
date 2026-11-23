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
  isMacCtrlClick: boolean;
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

/** True when the event is a macOS Ctrl+click secondary press/release. */
export function isMacCtrlClickPointer(
  e: { button?: number; ctrlKey?: boolean },
  isMac: boolean,
): boolean {
  return isMac && (e.button ?? 0) === 0 && Boolean(e.ctrlKey);
}

/** True when the pointer event represents a secondary/context-click press (RMB, or Ctrl+click on macOS). */
export function isRightClickPointer(
  e: { button: number; ctrlKey?: boolean },
  isMac: boolean,
): boolean {
  return e.button === 2 || isMacCtrlClickPointer(e, isMac);
}

/** True when the button that started a right-click gesture is still held according to PointerEvent.buttons. */
export function isRightPointerStillPressed(active: ActiveRightPress, buttons: number): boolean {
  return active.isMacCtrlClick ? (buttons & 1) !== 0 : (buttons & 2) !== 0;
}

/**
 * True when mouseup must not run left-button commit logic (drag/resize/box-select/zone-paint):
 * right mouse button or the matching left-button release of a macOS Ctrl+click press.
 */
export function shouldIgnoreLeftMouseUp(
  e: { button?: number; ctrlKey?: boolean },
  _isMac: boolean,
  activeMacCtrlPress: boolean,
): boolean {
  const button = e.button ?? 0;
  if (button === 2) return true;
  if (button === 0 && activeMacCtrlPress) return true;
  return false;
}

export function beginRightPointer(
  state: RightClickGestureState,
  event: { sx: number; sy: number; pointerId: number; pointerType?: string; isMacCtrlClick?: boolean },
): RightClickGestureState {
  return {
    ...state,
    active: {
      startSX: event.sx,
      startSY: event.sy,
      pointerId: event.pointerId,
      pointerType: event.pointerType || 'mouse',
      dragged: false,
      isMacCtrlClick: Boolean(event.isMacCtrlClick),
    },
  };
}

export function moveRightPointer(
  state: RightClickGestureState,
  event: { sx: number; sy: number; pointerId: number; buttons?: number },
  options: SpeedPanelOptions,
): { state: RightClickGestureState; isDragging: boolean; cancelled: boolean; thresholds: ResolvedGestureThresholds } {
  const active = state.active;
  if (!active || active.pointerId !== event.pointerId) {
    return {
      state,
      isDragging: false,
      cancelled: false,
      thresholds: resolveGestureThresholds(options, active?.pointerType),
    };
  }
  const thresholds = resolveGestureThresholds(options, active.pointerType);
  if (typeof event.buttons === 'number' && !isRightPointerStillPressed(active, event.buttons)) {
    return {
      state: { ...state, active: null },
      isDragging: false,
      cancelled: true,
      thresholds,
    };
  }
  const dist = Math.hypot(event.sx - active.startSX, event.sy - active.startSY);
  const dragged = active.dragged || dist > thresholds.driftPx;
  if (dragged === active.dragged) {
    return { state, isDragging: dragged, cancelled: false, thresholds };
  }
  return {
    state: {
      ...state,
      active: { ...active, dragged: true },
    },
    isDragging: true,
    cancelled: false,
    thresholds,
  };
}

export function computeRightPanViewport(
  panStart: { x: number; y: number; panX: number; panY: number },
  clientX: number,
  clientY: number,
  zoom: number,
): { panX: number; panY: number } {
  return {
    panX: panStart.panX - (clientX - panStart.x) / zoom,
    panY: panStart.panY - (clientY - panStart.y) / zoom,
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

export interface CanvasKeyTriggerEnv {
  options: SpeedPanelOptions;
  pointerOverCanvas: boolean;
  canvasFocusedNow: boolean;
  lastPointerRegion: 'none' | 'canvas' | 'other';
  lastCanvasFocusStamp: number;
  lastPointerStamp: number;
  activeModal: ModalId;
  showSearch: boolean;
  showSpeedPanel: boolean;
  activeElement?: unknown;
}

export type CanvasKeyTriggerDecision =
  | { trigger: false }
  | { trigger: true; source: 'pointer' | 'keyboard' };

/** Evaluate Canvas keyboard focus/hover recency and key guards for opening the Speed Panel. */
export function resolveCanvasKeyTriggerDecision(
  e: KeyTriggerEventLike,
  env: CanvasKeyTriggerEnv,
): CanvasKeyTriggerDecision {
  const allowCanvasFocused =
    env.canvasFocusedNow &&
    (env.lastPointerRegion !== 'other' || env.lastCanvasFocusStamp >= env.lastPointerStamp);

  if (
    !shouldTriggerSpeedPanelKey(e, {
      options: env.options,
      pointerOverCanvas: env.pointerOverCanvas,
      canvasFocused: allowCanvasFocused,
      activeModal: env.activeModal,
      showSearch: env.showSearch,
      showSpeedPanel: env.showSpeedPanel,
      activeElement: env.activeElement,
    })
  ) {
    return { trigger: false };
  }
  return { trigger: true, source: env.pointerOverCanvas ? 'pointer' : 'keyboard' };
}

export type CanvasContextMenuDecision =
  | { kind: 'handled-in-press' }
  | { kind: 'suppress' }
  | { kind: 'consume-suppressed' }
  | { kind: 'open'; sx: number; sy: number };

/** Resolve whether a canvas `contextmenu` event should be suppressed or open the compact menu. */
export function resolveCanvasContextMenu(params: {
  hasActiveRightGesture: boolean;
  isRightPointerEvent: boolean;
  suppressNext: boolean;
  clientX: number;
  clientY: number;
  rect: { left: number; top: number; width: number; height: number } | null;
  lastPointer: { sx: number; sy: number };
}): CanvasContextMenuDecision {
  if (params.hasActiveRightGesture) return { kind: 'handled-in-press' };
  if (params.isRightPointerEvent) return { kind: 'suppress' };
  if (params.suppressNext) return { kind: 'consume-suppressed' };
  if (!params.rect) return { kind: 'suppress' };

  let sx = params.clientX - params.rect.left;
  let sy = params.clientY - params.rect.top;
  const offCanvas =
    (params.clientX === 0 && params.clientY === 0) ||
    sx < 0 ||
    sy < 0 ||
    sx > params.rect.width ||
    sy > params.rect.height;
  if (offCanvas) {
    sx = params.lastPointer.sx;
    sy = params.lastPointer.sy;
  }
  return { kind: 'open', sx, sy };
}

export type RightPointerEndDispatch =
  | { action: 'none' }
  | { action: 'open-speed-panel'; x: number; y: number; prevHit: HitResult | null | undefined }
  | { action: 'open-compact-menu'; x: number; y: number };

/** Map an endRightPointer outcome to the canvas UI side effect without duplicating menu/panel branching. */
export function resolveRightPointerEndEffect(
  outcome: RightClickEndOutcome,
  hasOpenContextMenu: boolean,
  prevHit: HitResult | null | undefined,
): RightPointerEndDispatch {
  if (outcome.kind === 'drag-end' || outcome.kind === 'ignore') {
    return { action: 'none' };
  }
  if (outcome.kind === 'open-speed-panel') {
    return { action: 'open-speed-panel', x: outcome.x, y: outcome.y, prevHit };
  }
  if (outcome.kind === 'keep-compact-menu') {
    return hasOpenContextMenu
      ? { action: 'none' }
      : { action: 'open-compact-menu', x: outcome.x, y: outcome.y };
  }
  return { action: 'open-compact-menu', x: outcome.x, y: outcome.y };
}

/** True when a DOM event target sits inside either the canvas element or the open context menu. */
export function isNodeInsideCanvasOrMenu<TNode>(
  canvasEl: { contains: (node: TNode) => boolean } | null,
  contextMenuEl: { contains: (node: TNode) => boolean } | null,
  targetNode: TNode,
): boolean {
  return Boolean(
    canvasEl &&
      targetNode &&
      (targetNode === (canvasEl as unknown) || canvasEl.contains(targetNode) || contextMenuEl?.contains(targetNode)),
  );
}

export interface CanvasContextMenuState<TAction = { id: string; label: string; icon: string }> {
  x: number;
  y: number;
  actions: TAction[];
  hit: HitResult | null;
}

export interface CanvasRightPointerHandlerDeps {
  isMacPlatform: () => boolean;
  getScreenXY: (e: { clientX: number; clientY: number }) => { sx: number; sy: number };
  getViewport: () => ViewportState;
  setViewport: (vp: Partial<ViewportState>) => void;
  getOptions: () => SpeedPanelOptions;
  findFilteredHitAt: (sx: number, sy: number) => HitResult | null;
  getMenuActionsForHit: (hit: HitResult | null) => Array<{ id: string; label: string; icon: string }>;
  getContextMenu: () => CanvasContextMenuState | null;
  setContextMenu: (menu: CanvasContextMenuState | null) => void;
  openSpeedPanel: (x: number, y: number, hit: HitResult | null) => void;
  getGestureState: () => RightClickGestureState;
  setGestureState: (state: RightClickGestureState) => void;
  getRightPanStart: () => { x: number; y: number; panX: number; panY: number } | null;
  setRightPanStart: (pan: { x: number; y: number; panX: number; panY: number } | null) => void;
  getLastRightMoveEvent: () => unknown;
  setLastRightMoveEvent: (evt: unknown) => void;
  setSuppressNextLeftMouseUp: (v: boolean) => void;
  setSuppressNextCanvasContextMenu: (v: boolean) => void;
  getContextMenuHandledInPress: () => boolean;
  setContextMenuHandledInPress: (v: boolean) => void;
  setLastPointer: (pt: { sx: number; sy: number }) => void;
  getLastPointer: () => { sx: number; sy: number };
  setPointerOverCanvas: (v: boolean) => void;
  getPointerOverCanvas: () => boolean;
  setLastPointerRegion: (region: 'none' | 'canvas' | 'other') => void;
  getLastPointerRegion: () => 'none' | 'canvas' | 'other';
  setLastPointerStamp: (t: number) => void;
  getLastPointerStamp: () => number;
  getLastCanvasFocusStamp: () => number;
  getCanvasFocusedNow: () => boolean;
  getCanvasSize: () => { w: number; h: number };
  getEditorEnv: () => {
    activeModal: ModalId;
    showSearch: boolean;
    showSpeedPanel: boolean;
    activeElement?: unknown;
    selection: SelectionSet;
    selectedConnection: { from: string; to: string } | null;
    project: WorldProject;
    tileSize: number;
  };
  nowMs?: () => number;
  perfNowMs?: () => number;
}

/**
 * Create the production Canvas right-pointer & Speed Panel key-trigger handlers.
 * Exported here so both `<Canvas>` and real-handler unit suites share the exact code path.
 */
export function createCanvasRightPointerHandlers(deps: CanvasRightPointerHandlerDeps) {
  const nowFn = deps.nowMs ?? (() => Date.now());
  const perfNowFn = deps.perfNowMs ?? (() => performance.now());

  const openObjectContextMenu = (sx: number, sy: number) => {
    const hit = deps.findFilteredHitAt(sx, sy);
    const actions = deps.getMenuActionsForHit(hit);
    if (actions.length > 0) {
      deps.setContextMenu({ x: sx, y: sy, actions, hit });
    }
  };

  const upgradeContextMenuToSpeedPanel = () => {
    const menu = deps.getContextMenu();
    if (!menu) return;
    const { x, y, hit } = menu;
    deps.setContextMenu(null);
    deps.setGestureState(createInitialRightClickGestureState());
    deps.openSpeedPanel(x, y, hit);
  };

  const startRightPointer = (e: {
    button: number;
    ctrlKey?: boolean;
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType?: string;
    preventDefault: () => void;
  }): boolean => {
    const mac = deps.isMacPlatform();
    if (!isRightClickPointer(e, mac)) return false;
    e.preventDefault();
    const macCtrl = isMacCtrlClickPointer(e, mac);
    deps.setSuppressNextLeftMouseUp(macCtrl);
    deps.setContextMenuHandledInPress(false);
    const { sx, sy } = deps.getScreenXY(e);
    deps.setLastPointer({ sx, sy });
    deps.setPointerOverCanvas(true);
    deps.setLastPointerRegion('canvas');
    deps.setLastPointerStamp(perfNowFn());
    deps.setGestureState(
      beginRightPointer(deps.getGestureState(), {
        sx,
        sy,
        pointerId: e.pointerId,
        pointerType: e.pointerType,
        isMacCtrlClick: macCtrl,
      }),
    );
    const vp = deps.getViewport();
    deps.setRightPanStart({ x: e.clientX, y: e.clientY, panX: vp.panX, panY: vp.panY });
    return true;
  };

  const moveRightPointerHandler = (
    e: { clientX: number; clientY: number; pointerId: number; buttons?: number },
  ): boolean => {
    if (deps.getLastRightMoveEvent() === e) {
      return deps.getGestureState().active?.pointerId === e.pointerId;
    }
    deps.setLastRightMoveEvent(e);
    if (deps.getGestureState().active?.pointerId !== e.pointerId) {
      return false;
    }
    const { sx, sy } = deps.getScreenXY(e);
    const moved = moveRightPointer(
      deps.getGestureState(),
      { sx, sy, pointerId: e.pointerId, buttons: e.buttons },
      deps.getOptions(),
    );
    deps.setGestureState(moved.state);
    if (moved.cancelled) {
      deps.setRightPanStart(null);
      deps.setSuppressNextLeftMouseUp(false);
      return false;
    }
    const panStart = deps.getRightPanStart();
    if (moved.isDragging && panStart) {
      if (deps.getContextMenu()) deps.setContextMenu(null);
      deps.setViewport(computeRightPanViewport(panStart, e.clientX, e.clientY, deps.getViewport().zoom));
    }
    return true;
  };

  const finishRightPointer = (e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    pointerType?: string;
  }): boolean => {
    if (deps.getGestureState().active?.pointerId !== e.pointerId) return false;
    if (!deps.getContextMenuHandledInPress()) {
      deps.setSuppressNextCanvasContextMenu(true);
    }
    deps.setContextMenuHandledInPress(false);

    const { sx, sy } = deps.getScreenXY(e);
    const outcome = endRightPointer(
      deps.getGestureState(),
      { sx, sy, pointerId: e.pointerId, pointerType: e.pointerType, now: nowFn() },
      deps.getOptions(),
    );
    deps.setGestureState(outcome.state);
    deps.setRightPanStart(null);

    const currentMenu = deps.getContextMenu();
    const effect = resolveRightPointerEndEffect(outcome, Boolean(currentMenu), currentMenu?.hit);
    if (effect.action === 'open-speed-panel') {
      deps.setContextMenu(null);
      const hit = effect.prevHit !== undefined ? effect.prevHit : deps.findFilteredHitAt(effect.x, effect.y);
      deps.openSpeedPanel(effect.x, effect.y, hit);
    } else if (effect.action === 'open-compact-menu') {
      openObjectContextMenu(effect.x, effect.y);
    }
    return true;
  };

  const handleSpeedPanelKeyTrigger = (e: KeyTriggerEventLike & { preventDefault: () => void; stopPropagation: () => void }): boolean => {
    const env = deps.getEditorEnv();
    const decision = resolveCanvasKeyTriggerDecision(e, {
      options: deps.getOptions(),
      pointerOverCanvas: deps.getPointerOverCanvas(),
      canvasFocusedNow: deps.getCanvasFocusedNow(),
      lastPointerRegion: deps.getLastPointerRegion(),
      lastCanvasFocusStamp: deps.getLastCanvasFocusStamp(),
      lastPointerStamp: deps.getLastPointerStamp(),
      activeModal: env.activeModal,
      showSearch: env.showSearch,
      showSpeedPanel: env.showSpeedPanel,
      activeElement: env.activeElement,
    });
    if (!decision.trigger) return false;

    e.preventDefault();
    e.stopPropagation();
    deps.setContextMenu(null);
    deps.setGestureState(createInitialRightClickGestureState());

    if (decision.source === 'pointer') {
      const { sx, sy } = deps.getLastPointer();
      const hit = deps.findFilteredHitAt(sx, sy);
      deps.openSpeedPanel(sx, sy, hit);
      return true;
    }

    const anchor = getKeyboardSpeedPanelAnchor(
      deps.getCanvasSize(),
      env.selection,
      env.selectedConnection,
      env.project,
      deps.getViewport(),
      env.tileSize,
    );
    deps.openSpeedPanel(anchor.sx, anchor.sy, anchor.hit);
    return true;
  };

  return {
    openObjectContextMenu,
    upgradeContextMenuToSpeedPanel,
    startRightPointer,
    moveRightPointerHandler,
    finishRightPointer,
    handleSpeedPanelKeyTrigger,
  };
}

export interface CanvasRightPointerRefs {
  canvasEl: () => { clientWidth: number; clientHeight: number } | null;
  rightClickGesture: { current: RightClickGestureState };
  rightPanStart: { current: { x: number; y: number; panX: number; panY: number } | null };
  lastRightMoveEvent: { current: unknown };
  suppressNextLeftMouseUp: { current: boolean };
  suppressNextCanvasContextMenu: { current: boolean };
  contextMenuHandledInPress: { current: boolean };
  lastPointer: { current: { sx: number; sy: number } };
  pointerOverCanvas: { current: boolean };
  lastPointerRegion: { current: 'none' | 'canvas' | 'other' };
  lastPointerStamp: { current: number };
  lastCanvasFocusStamp: { current: number };
  contextMenu: { current: CanvasContextMenuState | null };
  setContextMenu: (menu: CanvasContextMenuState | null) => void;
  getViewport: () => ViewportState;
  setViewport: (vp: Partial<ViewportState>) => void;
  getOptions: () => SpeedPanelOptions;
  getScreenXY: (e: { clientX: number; clientY: number }) => { sx: number; sy: number };
  findFilteredHitAt: (sx: number, sy: number) => HitResult | null;
  getMenuActionsForHit: (hit: HitResult | null) => Array<{ id: string; label: string; icon: string }>;
  openSpeedPanel: (x: number, y: number, hit: HitResult | null) => void;
  getEditorEnv: CanvasRightPointerHandlerDeps['getEditorEnv'];
  isMacPlatformFn?: () => boolean;
}

/** Adapt mutable Canvas refs directly into `createCanvasRightPointerHandlers` without per-render closure boilerplate. */
export function buildCanvasRightPointerHandlersFromRefs(refs: CanvasRightPointerRefs) {
  return createCanvasRightPointerHandlers({
    isMacPlatform: refs.isMacPlatformFn ?? isMacPlatform,
    getScreenXY: refs.getScreenXY,
    getViewport: refs.getViewport,
    setViewport: refs.setViewport,
    getOptions: refs.getOptions,
    findFilteredHitAt: refs.findFilteredHitAt,
    getMenuActionsForHit: refs.getMenuActionsForHit,
    getContextMenu: () => refs.contextMenu.current,
    setContextMenu: refs.setContextMenu,
    openSpeedPanel: refs.openSpeedPanel,
    getGestureState: () => refs.rightClickGesture.current,
    setGestureState: (s) => { refs.rightClickGesture.current = s; },
    getRightPanStart: () => refs.rightPanStart.current,
    setRightPanStart: (p) => { refs.rightPanStart.current = p; },
    getLastRightMoveEvent: () => refs.lastRightMoveEvent.current,
    setLastRightMoveEvent: (evt) => { refs.lastRightMoveEvent.current = evt; },
    setSuppressNextLeftMouseUp: (v) => { refs.suppressNextLeftMouseUp.current = v; },
    setSuppressNextCanvasContextMenu: (v) => { refs.suppressNextCanvasContextMenu.current = v; },
    getContextMenuHandledInPress: () => refs.contextMenuHandledInPress.current,
    setContextMenuHandledInPress: (v) => { refs.contextMenuHandledInPress.current = v; },
    setLastPointer: (pt) => { refs.lastPointer.current = pt; },
    getLastPointer: () => refs.lastPointer.current,
    setPointerOverCanvas: (v) => { refs.pointerOverCanvas.current = v; },
    getPointerOverCanvas: () => refs.pointerOverCanvas.current,
    setLastPointerRegion: (r) => { refs.lastPointerRegion.current = r; },
    getLastPointerRegion: () => refs.lastPointerRegion.current,
    setLastPointerStamp: (t) => { refs.lastPointerStamp.current = t; },
    getLastPointerStamp: () => refs.lastPointerStamp.current,
    getLastCanvasFocusStamp: () => refs.lastCanvasFocusStamp.current,
    getCanvasFocusedNow: () => {
      const el = refs.canvasEl();
      return Boolean(el && typeof document !== 'undefined' && (document.activeElement as unknown) === el);
    },
    getCanvasSize: () => {
      const el = refs.canvasEl();
      return { w: el?.clientWidth ?? 800, h: el?.clientHeight ?? 600 };
    },
    getEditorEnv: refs.getEditorEnv,
  });
}
