// command-registry.ts — single declarative command registry for the editor

import type { HitResult } from './hit-testing.js';
import type { AuthoringMode, WorldProject, ZoneConnection, Zone, ConnectionKind } from '@world-forge/schema';
import { buildReviewSnapshot } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import { frameBounds } from './viewport.js';
import {
  emptySelection,
  getSelectionCount,
  SELECTION_KIND_KEY,
  type EditorTool,
  type RightTab,
  type SelectionKind,
  type SelectionSet,
} from './store/editor-store.js';
import type { ModalId } from './store/modal-store.js';
import type { EnrichedReviewSnapshot } from './panels/ReviewPanel.js';
import { reviewSnapshotToMarkdown, summaryFilename } from './review/export-summary.js';

/** Closed icon enum so the palette/context menu can style a 16px glyph from tokens. */
export type SpeedPanelIconId =
  | 'plus'
  | 'fit'
  | 'edit'
  | 'delete'
  | 'duplicate'
  | 'district'
  | 'entity'
  | 'connect'
  | 'swap'
  | 'merge'
  | 'elevation'
  | 'review'
  | 'summary'
  | 'encounter'
  | 'connect-secret'
  | 'connect-channel'
  | 'connect-warp'
  | 'connect-trail';

/** Geometric glyphs — not emoji, not 1–3 letter codes. */
export const SPEED_PANEL_ICON_GLYPH: Record<SpeedPanelIconId, string> = {
  plus: '+',
  fit: '\u25F1',
  edit: '\u270E',
  delete: '\u2715',
  duplicate: '\u29C9',
  district: '\u25A6',
  entity: '\u25C9',
  connect: '\u2192',
  swap: '\u21C4',
  merge: '\u22C8',
  elevation: '\u25B2',
  review: '\u2611',
  summary: '\u25A4',
  encounter: '\u25C7',
  'connect-secret': '\u2726',
  'connect-channel': '\u2248',
  'connect-warp': '\u29C1',
  'connect-trail': '\u2198',
};

/** Bag of store methods needed by execute — keeps action execution testable without DOM mounts. */
export interface ExecuteStores {
  selectZone: (id: string, additive: boolean) => void;
  selectEntity: (id: string, additive: boolean) => void;
  selectLandmark: (id: string, additive: boolean) => void;
  selectSpawn: (id: string, additive: boolean) => void;
  selectEncounter: (id: string, additive: boolean) => void;
  selectConnection: (fromId: string, toId: string) => void;
  selectKind?: (type: SelectionKind, id: string, additive: boolean) => void;
  clearSelection: () => void;

  setRightTab: (tab: RightTab) => void;
  setRightCollapsed?: (collapsed: boolean) => void;
  setTool: (tool: EditorTool) => void;
  setConnectionStart: (zoneId: string) => void;
  setPendingConnectionKind?: (kind: ConnectionKind | null) => void;
  setViewport: (vp: ViewportState) => void;

  removeSelected: (sel: SelectionSet) => void;
  duplicateSelected: (sel: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }) => unknown;
  removeConnection: (fromId: string, toId: string) => void;
  addConnection: (conn: ZoneConnection) => void;
  swapConnection?: (fromId: string, toId: string) => void;
  updateZone?: (zoneId: string, updates: Partial<Zone>) => void;
  promptFn?: (message: string) => string | null;
  mergeZones?: (zoneIds: string[]) => string | null;
  selection?: SelectionSet;
  downloadFile?: (filename: string, content: string, mimeType: string) => void;
  canvasSize?: { w: number; h: number };

  project: WorldProject;
}

export interface ExecuteResult {
  executed: boolean;
  reason?: string;
}

export interface HotkeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  action: string;
  label: string;
  description: string;
}

/** Context passed from the editor to the hotkey dispatcher. */
export interface HotkeyContext {
  selection: SelectionSet;
  selectedConnection: { from: string; to: string } | null;
  project: WorldProject;
  showEntities: boolean;
  showLandmarks: boolean;
  showSpawns: boolean;
  showTown?: boolean;
  activeModal: ModalId;
  showSearch: boolean;
  clearSelection: () => void;
  selectAll: (sel: SelectionSet, append: boolean) => void;
  moveSelected: (sel: SelectionSet, dx: number, dy: number) => void;
  removeSelected: (sel: SelectionSet) => void;
  removeConnection: (from: string, to: string) => void;
  duplicateSelected: (sel: SelectionSet) => SelectionSet;
  copySelection?: (project: WorldProject) => void;
  pasteClipboard?: () => void;
  undo?: () => void;
  redo?: () => void;
  setShowSearch: (show: boolean) => void;
  setRightTab: (tab: RightTab) => void;
  setRightCollapsed?: (collapsed: boolean) => void;
  setTool: (tool: EditorTool) => void;
  showSpeedPanel: boolean;
  closeSpeedPanel: () => void;
  save?: () => void;
  applyPreset?: () => void;
  savePreset?: () => void;
  setConnectionStart?: (zoneId: string | null) => void;
}

export type HotkeyResult =
  | { handled: true; action: string }
  | { handled: false };

export type CommandCategory =
  | 'author'
  | 'connect'
  | 'populate'
  | 'inspect'
  | 'view'
  | 'export'
  | 'edit'
  | 'selection'
  | 'tools';

export type CommandSurface = 'speed-panel' | 'context-menu' | 'hotkey' | 'tool-palette';

export interface CommandContext {
  hit?: HitResult | null;
  stores?: ExecuteStores;
  selection?: SelectionSet;
  selectedConnection?: { from: string; to: string } | null;
  project?: WorldProject;
  hotkeyCtx?: HotkeyContext;
  event?: KeyboardEvent;
  setTool?: (tool: EditorTool) => void;
  /** True when caller supports canvas-delegated spatial picking for incomplete selections. */
  supportsSpatialPick?: boolean;
}

export interface CommandRunResult {
  executed: boolean;
  reason?: string;
  handled?: boolean;
  action?: string;
}

export interface HotkeyBindingSpec {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  label: string;
  description: string;
  order: number;
}

export interface EditorCommand {
  id: string;
  title: string;
  category: CommandCategory;
  keywords: readonly string[];
  surfaces: readonly CommandSurface[];
  when: (ctx: CommandContext) => boolean;
  disabledReason: (ctx: CommandContext) => string | null;
  hotkeyId?: string;
  /** Where this command lives in the editor UI when it has no bound hotkey. */
  uiPath?: string;
  run: (ctx: CommandContext) => CommandRunResult;
  // Speed Panel / Context Menu metadata
  label?: string;
  icon?: string;
  iconId?: SpeedPanelIconId;
  description?: string;
  speedPanelCategory?: 'context' | 'global';
  macroSafe?: boolean;
  modeSuggested?: AuthoringMode[];
  // Hotkey metadata
  hotkeyBindings?: readonly HotkeyBindingSpec[];
  // Tool Palette metadata
  tool?: EditorTool;
  toolLabel?: string;
  toolKey?: string;
  toolIcon?: string;
}

export type ContextDeckKey =
  | 'zone'
  | 'entity'
  | 'connection'
  | 'landmark'
  | 'spawn'
  | 'encounter'
  | 'item'
  | 'empty';

/**
 * Fixed 4–5 slot context decks for Band 1 (Four-Band Ordering).
 * Slot order for each target type never shifts with recency, frequency, or mode.
 * Zone uses the default deck: Inspect Properties, Connect From Zone,
 * Place Entity Here, Place Encounter Here, Duplicate Zone.
 */
export const CONTEXT_DECKS: Readonly<Record<ContextDeckKey, readonly string[]>> = {
  zone: ['edit-props', 'connect-from', 'place-entity', 'place-encounter', 'duplicate'],
  entity: ['edit-props', 'duplicate', 'delete', 'tool-entity'],
  connection: ['edit-props', 'swap-direction', 'delete', 'tool-connection'],
  landmark: ['edit-props', 'duplicate', 'delete', 'tool-landmark'],
  spawn: ['edit-props', 'delete', 'tool-spawn', 'tool-select'],
  encounter: ['edit-props', 'delete', 'tool-encounter', 'tool-select'],
  item: ['edit-props', 'delete', 'tool-item', 'tool-select'],
  empty: ['new-zone', 'fit-content', 'tool-entity', 'open-review', 'export-summary'],
};

export const CATALOGUE_GROUPS = ['Author', 'Connect', 'Populate', 'Inspect', 'View', 'Export'] as const;
export type CatalogueGroup = (typeof CATALOGUE_GROUPS)[number];

const CATEGORY_TO_CATALOGUE_GROUP: Record<CommandCategory, CatalogueGroup> = {
  author: 'Author',
  edit: 'Author',
  connect: 'Connect',
  populate: 'Populate',
  inspect: 'Inspect',
  selection: 'Inspect',
  view: 'View',
  tools: 'View',
  export: 'Export',
};

const CONTEXT_MENU_LIMIT = 7;

function fail(reason: string): CommandRunResult {
  return { executed: false, handled: false, reason };
}

function parseConnectionId(id: string): [string, string] | null {
  const parts = id.split('::');
  if (parts.length !== 2) return null;
  return [parts[0], parts[1]];
}

function selectFromContext(ctx: HitResult, stores: ExecuteStores): boolean {
  if (ctx.type === 'connection') {
    const parsed = parseConnectionId(ctx.id);
    if (!parsed) return false;
    stores.selectConnection(parsed[0], parsed[1]);
  } else if (ctx.type === 'zone') stores.selectZone(ctx.id, false);
  else if (ctx.type === 'entity') stores.selectEntity(ctx.id, false);
  else if (ctx.type === 'landmark') stores.selectLandmark(ctx.id, false);
  else if (ctx.type === 'spawn') stores.selectSpawn(ctx.id, false);
  else if (ctx.type === 'encounter') stores.selectEncounter(ctx.id, false);
  else if (stores.selectKind) stores.selectKind(ctx.type as SelectionKind, ctx.id, false);
  else return false;
  return true;
}

const hasDuplicateHit = (h: HitResult | null) =>
  h?.type === 'zone' || h?.type === 'entity' || h?.type === 'landmark';

function effectiveHit(ctx: CommandContext): HitResult | null {
  return ctx.hit ?? null;
}

function effectiveSelection(ctx: CommandContext): SelectionSet | undefined {
  return ctx.hotkeyCtx?.selection ?? ctx.selection ?? ctx.stores?.selection;
}

function effectiveConnection(ctx: CommandContext): { from: string; to: string } | null {
  return ctx.hotkeyCtx?.selectedConnection ?? ctx.selectedConnection ?? null;
}

function hasAnyTarget(ctx: CommandContext): boolean {
  if (ctx.hit !== undefined) return ctx.hit !== null;
  if (effectiveConnection(ctx) !== null) return true;
  const sel = effectiveSelection(ctx);
  return sel ? getSelectionCount(sel) > 0 : false;
}

function runTypedConnection(kind: ConnectionKind, ctx: CommandContext): CommandRunResult {
  const { hit, stores } = ctx;
  if (!stores || hit?.type !== 'zone') return fail('context mismatch');
  stores.setPendingConnectionKind?.(kind);
  stores.setTool('connection');
  stores.setConnectionStart(hit.id);
  return { executed: true };
}

function createTypedConnectionCommand(spec: {
  id: string;
  label: string;
  iconId: SpeedPanelIconId;
  description: string;
  keywords: readonly string[];
  uiPath?: string;
  modeSuggested: AuthoringMode[];
  kind: ConnectionKind;
}): EditorCommand {
  return {
    id: spec.id,
    title: spec.label,
    label: spec.label,
    category: 'connect',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: spec.keywords,
    ...(spec.uiPath ? { uiPath: spec.uiPath } : {}),
    icon: SPEED_PANEL_ICON_GLYPH[spec.iconId],
    iconId: spec.iconId,
    description: spec.description,
    speedPanelCategory: 'context',
    macroSafe: false,
    modeSuggested: spec.modeSuggested,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => (effectiveHit(ctx)?.type === 'zone' ? null : 'Select or target a zone'),
    run: (ctx) => runTypedConnection(spec.kind, ctx),
  };
}

function createNudgeCommand(spec: {
  id: string;
  title: string;
  key: string;
  label: string;
  description: string;
  keywords: readonly string[];
  order: number;
  dx: number;
  dy: number;
}): EditorCommand {
  return {
    id: spec.id,
    title: spec.title,
    category: 'edit',
    surfaces: ['hotkey'],
    keywords: spec.keywords,
    hotkeyId: spec.id,
    hotkeyBindings: [{
      key: spec.key,
      label: spec.label,
      description: spec.description,
      order: spec.order,
    }],
    when: (ctx) => {
      const sel = effectiveSelection(ctx);
      return sel ? getSelectionCount(sel) > 0 : false;
    },
    disabledReason: (ctx) => {
      const sel = effectiveSelection(ctx);
      return sel && getSelectionCount(sel) > 0 ? null : 'Select at least one object to nudge';
    },
    run: (ctx) => {
      const hctx = ctx.hotkeyCtx;
      if (!hctx || getSelectionCount(hctx.selection) === 0) return { executed: false, handled: false };
      ctx.event?.preventDefault();
      const mult = ctx.event?.shiftKey ? 5 : 1;
      hctx.moveSelected(hctx.selection, spec.dx * mult, spec.dy * mult);
      return { executed: true, handled: true, action: spec.id };
    },
  };
}

function createToolCommand(spec: {
  id: string;
  title: string;
  tool: EditorTool;
  toolLabel: string;
  toolKey: string;
  toolIcon: string;
  key: string;
  description: string;
  keywords: readonly string[];
  order: number;
}): EditorCommand {
  return {
    id: spec.id,
    title: spec.title,
    category: 'tools',
    surfaces: ['hotkey', 'tool-palette'],
    keywords: spec.keywords,
    hotkeyId: spec.id,
    uiPath: `Tool Palette \u2192 ${spec.toolLabel}`,
    tool: spec.tool,
    toolLabel: spec.toolLabel,
    toolKey: spec.toolKey,
    toolIcon: spec.toolIcon,
    hotkeyBindings: [{
      key: spec.key,
      label: spec.toolKey,
      description: spec.description,
      order: spec.order,
    }],
    when: () => true,
    disabledReason: () => null,
    run: (ctx) => {
      const setToolFn = ctx.hotkeyCtx?.setTool ?? ctx.stores?.setTool ?? ctx.setTool;
      if (!setToolFn) return fail('setTool unavailable');
      setToolFn(spec.tool);
      return { executed: true, handled: true, action: spec.id };
    },
  };
}

const TOOL_COMMANDS: readonly EditorCommand[] = [
  createToolCommand({ id: 'tool-select',     title: 'Select Tool',          tool: 'select',          toolLabel: 'Select',    toolKey: 'V', toolIcon: '\u25C7', key: 'KeyV', description: 'Switch to Select tool',          keywords: ['pointer', 'cursor', 'pick', 'move', 'drag'],                      order: 19 }),
  createToolCommand({ id: 'tool-zone',       title: 'Zone Tool',            tool: 'zone-paint',      toolLabel: 'Zone',      toolKey: 'Z', toolIcon: '\u25A6', key: 'KeyZ', description: 'Switch to Zone tool',            keywords: ['area', 'region', 'paint', 'draw', 'brush'],                       order: 20 }),
  createToolCommand({ id: 'tool-connection', title: 'Connection Tool',      tool: 'connection',      toolLabel: 'Connect',   toolKey: 'C', toolIcon: '\u2194', key: 'KeyC', description: 'Switch to Connection tool',      keywords: ['link', 'wire', 'path', 'exit', 'passage'],                        order: 21 }),
  createToolCommand({ id: 'tool-entity',     title: 'Entity Tool',          tool: 'entity-place',    toolLabel: 'Entity',    toolKey: 'E', toolIcon: '\u25C9', key: 'KeyE', description: 'Switch to Entity tool',          keywords: ['character', 'unit', 'spawnable', 'actor'],                        order: 22 }),
  createToolCommand({ id: 'tool-landmark',   title: 'Landmark Tool',        tool: 'landmark',        toolLabel: 'Landmark',  toolKey: 'L', toolIcon: '\u25B2', key: 'KeyL', description: 'Switch to Landmark tool',        keywords: ['poi', 'monument', 'altar', 'shrine', 'statue'],                   order: 23 }),
  createToolCommand({ id: 'tool-spawn',      title: 'Spawn Tool',           tool: 'spawn',           toolLabel: 'Spawn',     toolKey: 'S', toolIcon: '\u2605', key: 'KeyS', description: 'Switch to Spawn tool',           keywords: ['start', 'entry', 'player', 'origin', 'waypoint'],                 order: 24 }),
  createToolCommand({ id: 'tool-tile',       title: 'Tile Paint Tool',      tool: 'tile-paint',      toolLabel: 'Tiles',     toolKey: 'T', toolIcon: '\u25A3', key: 'KeyT', description: 'Switch to Tile Paint tool',      keywords: ['floor', 'ground', 'terrain', 'terrain brush', 'paint'],           order: 25 }),
  createToolCommand({ id: 'tool-prop',       title: 'Prop Place Tool',      tool: 'prop-place',      toolLabel: 'Prop',      toolKey: 'O', toolIcon: '\u25A2', key: 'KeyO', description: 'Switch to Prop Place tool',      keywords: ['furniture', 'crate', 'barrel', 'decor', 'object'],                order: 26 }),
  createToolCommand({ id: 'tool-encounter',  title: 'Encounter Place Tool', tool: 'encounter-place', toolLabel: 'Encounter', toolKey: 'N', toolIcon: '\u2694', key: 'KeyN', description: 'Switch to Encounter Place tool', keywords: ['skirmish', 'monster', 'wave', 'trap', 'danger'],                  order: 27 }),
  createToolCommand({ id: 'tool-item',       title: 'Item Place Tool',      tool: 'item-place',      toolLabel: 'Item',      toolKey: 'I', toolIcon: '\u2726', key: 'KeyI', description: 'Switch to Item Place tool',      keywords: ['loot', 'chest', 'treasure', 'pickup', 'potion', 'weapon'],        order: 28 }),
];

/**
 * Single declarative registry of all Speed Panel, right-click context menu,
 * keyboard hotkey, and Tool Palette commands in the editor.
 */
export const COMMAND_REGISTRY: readonly EditorCommand[] = [
  // -- Speed Panel + Context Menu (preserves exact SPEED_PANEL_ACTIONS order) --
  {
    id: 'new-zone',
    title: 'New Zone',
    label: 'New Zone',
    category: 'author',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['room', 'chamber', 'location', 'box', 'create zone', 'add zone'],
    uiPath: 'Tool Palette \u2192 Zone',
    icon: SPEED_PANEL_ICON_GLYPH.plus,
    iconId: 'plus',
    description: 'Paint a new zone on the canvas',
    speedPanelCategory: 'global',
    macroSafe: false,
    when: (ctx) => effectiveHit(ctx) === null,
    disabledReason: (ctx) => (effectiveHit(ctx) === null ? null : 'Only available on empty canvas'),
    run: ({ stores }) => {
      if (!stores) return fail('stores unavailable');
      stores.setTool('zone-paint');
      return { executed: true };
    },
  },
  {
    id: 'fit-content',
    title: 'Fit to Content',
    label: 'Fit to Content',
    category: 'view',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['frame', 'zoom', 'reset view', 'center', 'overview'],
    uiPath: 'Tool Palette \u2192 Fit',
    icon: SPEED_PANEL_ICON_GLYPH.fit,
    iconId: 'fit',
    description: 'Zoom the viewport to fit the whole map',
    speedPanelCategory: 'global',
    macroSafe: true,
    when: (ctx) => effectiveHit(ctx) === null,
    disabledReason: (ctx) => (effectiveHit(ctx) === null ? null : 'Only available on empty canvas'),
    run: ({ stores }) => {
      if (!stores) return fail('stores unavailable');
      const tileSize = stores.project.map.tileSize;
      const items = stores.project.zones.map((z) => ({
        gridX: z.gridX, gridY: z.gridY, gridWidth: z.gridWidth, gridHeight: z.gridHeight,
      }));
      const cw = stores.canvasSize?.w ?? 800;
      const ch = stores.canvasSize?.h ?? 600;
      const vp = frameBounds(items, tileSize, cw, ch);
      if (vp) stores.setViewport(vp);
      return { executed: true };
    },
  },
  {
    id: 'edit-props',
    title: 'Edit Properties',
    label: 'Edit Properties',
    category: 'inspect',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['inspect', 'rename', 'stats', 'attributes', 'fields', 'inspector'],
    uiPath: 'Right Sidebar \u2192 Map',
    icon: SPEED_PANEL_ICON_GLYPH.edit,
    iconId: 'edit',
    description: 'Open properties for the selected object',
    speedPanelCategory: 'context',
    macroSafe: true,
    when: (ctx) => hasAnyTarget(ctx),
    disabledReason: (ctx) => (hasAnyTarget(ctx) ? null : 'Select or target an object to inspect properties'),
    run: (ctx) => {
      if (!ctx.stores || !ctx.hit) return fail('context mismatch');
      if (!selectFromContext(ctx.hit, ctx.stores)) return fail('context mismatch');
      ctx.stores.setRightTab('map');
      ctx.stores.setRightCollapsed?.(false);
      return { executed: true };
    },
  },
  {
    id: 'delete',
    title: 'Delete',
    label: 'Delete',
    category: 'edit',
    surfaces: ['speed-panel', 'context-menu', 'hotkey'],
    keywords: ['remove', 'erase', 'destroy', 'trash', 'clear'],
    icon: SPEED_PANEL_ICON_GLYPH.delete,
    iconId: 'delete',
    description: 'Remove the selected object',
    speedPanelCategory: 'context',
    macroSafe: true,
    hotkeyId: 'delete',
    hotkeyBindings: [
      { key: 'Delete', label: 'Del', description: 'Delete selected objects', order: 9 },
      { key: 'Backspace', label: 'Backspace', description: 'Delete selected objects', order: 10 },
    ],
    when: (ctx) => hasAnyTarget(ctx),
    disabledReason: (ctx) => (hasAnyTarget(ctx) ? null : 'Select or target an object to delete'),
    run: (ctx) => {
      if (ctx.stores) {
        const hit = ctx.hit;
        if (!hit) return fail('context mismatch');
        if (hit.type === 'connection') {
          const parsed = parseConnectionId(hit.id);
          if (!parsed) return fail('context mismatch');
          ctx.stores.removeConnection(parsed[0], parsed[1]);
        } else {
          selectFromContext(hit, ctx.stores);
          const sel = emptySelection();
          const key = SELECTION_KIND_KEY[hit.type as SelectionKind];
          if (!key) return fail('context mismatch');
          sel[key] = [hit.id];
          ctx.stores.removeSelected(sel);
        }
        ctx.stores.clearSelection();
        return { executed: true };
      }
      if (ctx.hotkeyCtx) {
        const hctx = ctx.hotkeyCtx;
        if (hctx.selectedConnection) {
          hctx.removeConnection(hctx.selectedConnection.from, hctx.selectedConnection.to);
          hctx.clearSelection();
          return { executed: true, handled: true, action: 'delete' };
        }
        const count = getSelectionCount(hctx.selection);
        if (count === 0) return { executed: true, handled: true, action: 'delete' };
        if (count > 3 && typeof confirm !== 'undefined' && !confirm(`Delete ${count} objects?`)) {
          return { executed: true, handled: true, action: 'delete' };
        }
        hctx.removeSelected(hctx.selection);
        hctx.clearSelection();
        return { executed: true, handled: true, action: 'delete' };
      }
      return fail('stores unavailable');
    },
  },
  {
    id: 'duplicate',
    title: 'Duplicate',
    label: 'Duplicate',
    category: 'edit',
    surfaces: ['speed-panel', 'context-menu', 'hotkey'],
    keywords: ['clone', 'copy nearby', 'repeat'],
    icon: SPEED_PANEL_ICON_GLYPH.duplicate,
    iconId: 'duplicate',
    description: 'Copy the selected object nearby',
    speedPanelCategory: 'context',
    macroSafe: true,
    hotkeyId: 'duplicate',
    hotkeyBindings: [
      { key: 'KeyD', ctrl: true, label: 'Ctrl+D', description: 'Duplicate selected objects', order: 4 },
    ],
    when: (ctx) => {
      if (ctx.hit !== undefined) return hasDuplicateHit(ctx.hit);
      const sel = effectiveSelection(ctx);
      return sel ? getSelectionCount(sel) > 0 : false;
    },
    disabledReason: (ctx) => {
      if (ctx.hit !== undefined) {
        return hasDuplicateHit(ctx.hit) ? null : 'Only zones, entities, and landmarks can be duplicated';
      }
      const sel = effectiveSelection(ctx);
      return sel && getSelectionCount(sel) > 0 ? null : 'Select at least one object to duplicate';
    },
    run: (ctx) => {
      if (ctx.stores) {
        const hit = ctx.hit;
        if (!hit || !hasDuplicateHit(hit)) return fail('context mismatch');
        if (!selectFromContext(hit, ctx.stores)) return fail('context mismatch');
        const sel = emptySelection();
        const key = hit.type === 'zone' ? 'zones' : hit.type === 'entity' ? 'entities' : 'landmarks';
        sel[key] = [hit.id];
        ctx.stores.duplicateSelected(sel);
        return { executed: true };
      }
      if (ctx.hotkeyCtx) {
        const hctx = ctx.hotkeyCtx;
        ctx.event?.preventDefault();
        if (getSelectionCount(hctx.selection) > 0) {
          const newSel = hctx.duplicateSelected(hctx.selection);
          hctx.selectAll(newSel, false);
        }
        return { executed: true, handled: true, action: 'duplicate' };
      }
      return fail('stores unavailable');
    },
  },
  {
    id: 'assign-district',
    title: 'Assign District',
    label: 'Assign District',
    category: 'author',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['ward', 'neighborhood', 'faction', 'territory', 'lock', 'party'],
    uiPath: 'Right Sidebar \u2192 Map \u2192 District',
    icon: SPEED_PANEL_ICON_GLYPH.district,
    iconId: 'district',
    description: 'Set this zone\u2019s parent district',
    speedPanelCategory: 'context',
    macroSafe: true,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => (effectiveHit(ctx)?.type === 'zone' ? null : 'Target a zone to assign a district'),
    run: ({ hit, stores }) => {
      if (!stores || hit?.type !== 'zone') return fail('context mismatch');
      stores.selectZone(hit.id, false);
      stores.setRightTab('map');
      return { executed: true };
    },
  },
  {
    id: 'place-entity',
    title: 'Place Entity Here',
    label: 'Place Entity Here',
    category: 'populate',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['npc', 'merchant', 'recruit', 'villager', 'companion', 'shopkeeper', 'vendor'],
    uiPath: 'Tool Palette \u2192 Entity',
    icon: SPEED_PANEL_ICON_GLYPH.entity,
    iconId: 'entity',
    description: 'Drop an entity inside this zone',
    speedPanelCategory: 'context',
    macroSafe: false,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => (effectiveHit(ctx)?.type === 'zone' ? null : 'Target a zone to place an entity'),
    run: ({ hit, stores }) => {
      if (!stores || hit?.type !== 'zone') return fail('context mismatch');
      stores.setTool('entity-place');
      return { executed: true };
    },
  },
  {
    id: 'place-encounter',
    title: 'Place Encounter Here',
    label: 'Place Encounter Here',
    category: 'populate',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['foe', 'boss', 'fight', 'combat', 'battle', 'ambush', 'patrol', 'mob'],
    uiPath: 'Tool Palette \u2192 Encounter',
    icon: SPEED_PANEL_ICON_GLYPH.encounter,
    iconId: 'encounter',
    description: 'Drop an encounter anchor inside this zone',
    speedPanelCategory: 'context',
    macroSafe: false,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => (effectiveHit(ctx)?.type === 'zone' ? null : 'Target a zone to place an encounter'),
    run: ({ hit, stores }) => {
      if (!stores || hit?.type !== 'zone') return fail('context mismatch');
      stores.setTool('encounter-place');
      return { executed: true };
    },
  },
  {
    id: 'connect-from',
    title: 'Connect From Here',
    label: 'Connect From Here',
    category: 'connect',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['door', 'stairs', 'passage', 'gate', 'portal', 'road', 'route'],
    uiPath: 'Tool Palette \u2192 Connect',
    icon: SPEED_PANEL_ICON_GLYPH.connect,
    iconId: 'connect',
    description: 'Start a connection from this zone',
    speedPanelCategory: 'context',
    macroSafe: false,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => (effectiveHit(ctx)?.type === 'zone' ? null : 'Target a zone to start a connection'),
    run: ({ hit, stores }) => {
      if (!stores || hit?.type !== 'zone') return fail('context mismatch');
      stores.setTool('connection');
      stores.setConnectionStart(hit.id);
      return { executed: true };
    },
  },
  {
    id: 'swap-direction',
    title: 'Swap Direction',
    label: 'Swap Direction',
    category: 'connect',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['reverse', 'flip', 'invert', 'one-way', 'bidirectional'],
    uiPath: 'Right Sidebar \u2192 Map \u2192 Swap Direction',
    icon: SPEED_PANEL_ICON_GLYPH.swap,
    iconId: 'swap',
    description: 'Reverse this connection\u2019s direction',
    speedPanelCategory: 'context',
    macroSafe: true,
    when: (ctx) => effectiveHit(ctx)?.type === 'connection',
    disabledReason: (ctx) => (effectiveHit(ctx)?.type === 'connection' ? null : 'Target a connection to reverse it'),
    run: ({ hit, stores }) => {
      if (!stores || hit?.type !== 'connection') return fail('context mismatch');
      const parsed = parseConnectionId(hit.id);
      if (!parsed) return fail('context mismatch');
      const [from, to] = parsed;
      if (stores.swapConnection) {
        stores.swapConnection(from, to);
      } else {
        const conn = stores.project.connections.find(
          (c) => c.fromZoneId === from && c.toZoneId === to,
        );
        if (conn) {
          stores.removeConnection(from, to);
          stores.addConnection({ ...conn, fromZoneId: to, toZoneId: from });
        }
      }
      return { executed: true };
    },
  },
  createTypedConnectionCommand({
    id: 'add-secret-conn',
    label: 'Draw Secret Connection',
    iconId: 'connect-secret',
    description: 'Start a secret connection from this zone',
    keywords: ['hidden door', 'trapdoor', 'secret passage', 'concealed'],
    modeSuggested: ['dungeon', 'interior'],
    kind: 'secret',
  }),
  createTypedConnectionCommand({
    id: 'add-channel-conn',
    label: 'Draw Channel Connection',
    iconId: 'connect-channel',
    description: 'Start a channel connection from this zone',
    keywords: ['sea lane', 'waterway', 'strait', 'voyage', 'ocean'],
    modeSuggested: ['ocean'],
    kind: 'channel',
  }),
  createTypedConnectionCommand({
    id: 'add-warp-conn',
    label: 'Draw Warp Connection',
    iconId: 'connect-warp',
    description: 'Start a warp connection from this zone',
    keywords: ['hyperspace', 'jumpgate', 'ftl', 'starlane', 'space'],
    modeSuggested: ['space'],
    kind: 'warp',
  }),
  createTypedConnectionCommand({
    id: 'add-trail-conn',
    label: 'Draw Trail Connection',
    iconId: 'connect-trail',
    description: 'Start a trail connection from this zone',
    keywords: ['footpath', 'track', 'wilderness path', 'forest trail'],
    modeSuggested: ['wilderness'],
    kind: 'trail',
  }),
  {
    id: 'merge-zones',
    title: 'Merge Zones',
    label: 'Merge Zones',
    category: 'author',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['combine', 'join', 'unite', 'weld'],
    icon: SPEED_PANEL_ICON_GLYPH.merge,
    iconId: 'merge',
    description: 'Combine this zone with another selected zone',
    speedPanelCategory: 'context',
    macroSafe: true,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => {
      if (effectiveHit(ctx)?.type !== 'zone') return 'Target a zone';
      if (ctx.stores && !ctx.stores.mergeZones) return 'mergeZones not available';
      const selZones = effectiveSelection(ctx)?.zones;
      if (selZones && selZones.length >= 2) return null;
      if (ctx.supportsSpatialPick && (ctx.project?.zones.length ?? 0) >= 2) return null;
      return 'Select at least 2 zones to merge';
    },
    run: ({ hit, stores }) => {
      if (!stores) return fail('stores unavailable');
      if (!stores.mergeZones) return fail('mergeZones not available');
      const zoneIds = stores.selection?.zones ?? (hit?.type === 'zone' ? [hit.id] : []);
      if (zoneIds.length < 2) return fail('need at least 2 zones');
      const mergedId = stores.mergeZones(zoneIds);
      if (!mergedId) return fail('merge failed');
      return { executed: true };
    },
  },
  {
    id: 'set-elevation',
    title: 'Set Elevation',
    label: 'Set Elevation',
    category: 'author',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['basement', 'cliff', 'stratum', 'height', 'altitude', 'floor', 'depth'],
    uiPath: 'Right Sidebar \u2192 Map \u2192 Elevation',
    icon: SPEED_PANEL_ICON_GLYPH.elevation,
    iconId: 'elevation',
    description: 'Set this zone\u2019s elevation',
    speedPanelCategory: 'context',
    macroSafe: false,
    when: (ctx) => effectiveHit(ctx)?.type === 'zone',
    disabledReason: (ctx) => {
      if (effectiveHit(ctx)?.type !== 'zone') return 'Target a zone to set elevation';
      if (ctx.stores && !ctx.stores.updateZone) return 'updateZone not available';
      return null;
    },
    run: ({ hit, stores }) => {
      if (!stores || hit?.type !== 'zone') return fail('context mismatch');
      if (!stores.updateZone) return fail('updateZone not available');
      const ask = stores.promptFn ?? ((msg) => (typeof globalThis.prompt === 'function' ? globalThis.prompt(msg) : null));
      const raw = ask(`Set elevation (meters) for zone ${hit.id}. Leave blank to clear.`);
      if (raw == null) return fail('cancelled');
      const trimmed = raw.trim();
      let elevation: number | undefined;
      if (trimmed === '') {
        elevation = undefined;
      } else {
        const n = Number(trimmed);
        if (!Number.isFinite(n)) return fail('invalid elevation');
        elevation = n;
      }
      stores.updateZone(hit.id, { elevation });
      return { executed: true };
    },
  },
  {
    id: 'open-review',
    title: 'Open Review',
    label: 'Open Review',
    category: 'view',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['audit', 'checklist', 'readiness', 'health', 'validate'],
    uiPath: 'Right Sidebar \u2192 Review',
    icon: SPEED_PANEL_ICON_GLYPH.review,
    iconId: 'review',
    description: 'Open the project review panel',
    speedPanelCategory: 'global',
    macroSafe: true,
    when: (ctx) => effectiveHit(ctx) === null,
    disabledReason: (ctx) => (effectiveHit(ctx) === null ? null : 'Only available on empty canvas'),
    run: ({ stores }) => {
      if (!stores) return fail('stores unavailable');
      stores.setRightTab('review');
      return { executed: true };
    },
  },
  {
    id: 'export-summary',
    title: 'Export Summary',
    label: 'Export Summary',
    category: 'export',
    surfaces: ['speed-panel', 'context-menu'],
    keywords: ['markdown', 'download', 'brief', 'output', 'share'],
    uiPath: 'Right Sidebar \u2192 Review \u2192 Export MD',
    icon: SPEED_PANEL_ICON_GLYPH.summary,
    iconId: 'summary',
    description: 'Show a summary of the last export',
    speedPanelCategory: 'global',
    macroSafe: true,
    when: (ctx) => effectiveHit(ctx) === null,
    disabledReason: (ctx) => (effectiveHit(ctx) === null ? null : 'Only available on empty canvas'),
    run: ({ stores }) => {
      if (!stores) return fail('stores unavailable');
      if (!stores.downloadFile) return fail('downloadFile unavailable');
      const snapshot: EnrichedReviewSnapshot = { ...buildReviewSnapshot(stores.project), hasExported: false };
      const markdown = reviewSnapshotToMarkdown(snapshot);
      const filename = summaryFilename(stores.project.name, 'md');
      stores.downloadFile(filename, markdown, 'text/markdown');
      return { executed: true };
    },
  },

  // -- Non-tool Hotkey-only Commands --
  {
    id: 'search',
    title: 'Open Search Overlay',
    category: 'view',
    surfaces: ['hotkey'],
    keywords: ['find', 'lookup', 'jump', 'filter world', 'query'],
    hotkeyId: 'search',
    hotkeyBindings: [{ key: 'KeyK', ctrl: true, label: 'Ctrl+K', description: 'Open search overlay', order: 0 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.setShowSearch(true);
      return { executed: true, handled: true, action: 'search' };
    },
  },
  {
    id: 'save',
    title: 'Save Project',
    category: 'export',
    surfaces: ['hotkey'],
    keywords: ['write', 'persist', 'file', 'store'],
    hotkeyId: 'save',
    hotkeyBindings: [{ key: 'KeyS', ctrl: true, label: 'Ctrl+S', description: 'Save project', order: 1 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.save?.();
      return { executed: true, handled: true, action: 'save' };
    },
  },
  {
    id: 'copy',
    title: 'Copy Selected Objects',
    category: 'edit',
    surfaces: ['hotkey'],
    keywords: ['yank', 'clipboard'],
    hotkeyId: 'copy',
    hotkeyBindings: [{ key: 'KeyC', ctrl: true, label: 'Ctrl+C', description: 'Copy selected objects', order: 2 }],
    when: (ctx) => {
      const sel = effectiveSelection(ctx);
      return sel ? getSelectionCount(sel) > 0 : false;
    },
    disabledReason: (ctx) => {
      const sel = effectiveSelection(ctx);
      return sel && getSelectionCount(sel) > 0 ? null : 'Select at least one object to copy';
    },
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx || getSelectionCount(hotkeyCtx.selection) === 0) return { executed: false, handled: false };
      event?.preventDefault();
      hotkeyCtx.copySelection?.(hotkeyCtx.project);
      return { executed: true, handled: true, action: 'copy' };
    },
  },
  {
    id: 'paste',
    title: 'Paste from Clipboard',
    category: 'edit',
    surfaces: ['hotkey'],
    keywords: ['insert', 'yank', 'clipboard'],
    hotkeyId: 'paste',
    hotkeyBindings: [{ key: 'KeyV', ctrl: true, label: 'Ctrl+V', description: 'Paste from clipboard', order: 3 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.pasteClipboard?.();
      return { executed: true, handled: true, action: 'paste' };
    },
  },
  {
    id: 'undo',
    title: 'Undo Last Action',
    category: 'edit',
    surfaces: ['hotkey'],
    keywords: ['revert', 'rollback', 'history', 'step back'],
    hotkeyId: 'undo',
    hotkeyBindings: [{ key: 'KeyZ', ctrl: true, label: 'Ctrl+Z', description: 'Undo last action', order: 5 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.undo?.();
      return { executed: true, handled: true, action: 'undo' };
    },
  },
  {
    id: 'redo',
    title: 'Redo Last Undone Action',
    category: 'edit',
    surfaces: ['hotkey'],
    keywords: ['reapply', 'forward', 'history'],
    hotkeyId: 'redo',
    hotkeyBindings: [
      { key: 'KeyZ', ctrl: true, shift: true, label: 'Ctrl+Shift+Z', description: 'Redo last undone action', order: 6 },
      { key: 'KeyY', ctrl: true, label: 'Ctrl+Y', description: 'Redo last undone action', order: 7 },
    ],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.redo?.();
      return { executed: true, handled: true, action: 'redo' };
    },
  },
  {
    id: 'select-all',
    title: 'Select All Visible Objects',
    category: 'selection',
    surfaces: ['hotkey'],
    keywords: ['pick all', 'highlight all', 'everything'],
    hotkeyId: 'select-all',
    hotkeyBindings: [{ key: 'KeyA', ctrl: true, label: 'Ctrl+A', description: 'Select all visible objects', order: 8 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      const zones = hotkeyCtx.project.zones.map((z) => z.id);
      const entities = hotkeyCtx.showEntities ? hotkeyCtx.project.entityPlacements.map((ent) => ent.entityId) : [];
      const landmarks = hotkeyCtx.showLandmarks ? hotkeyCtx.project.landmarks.map((l) => l.id) : [];
      const spawns = hotkeyCtx.showSpawns ? hotkeyCtx.project.spawnPoints.map((s) => s.id) : [];
      const encounters = hotkeyCtx.project.encounterAnchors.map((enc) => enc.id);
      const items = (hotkeyCtx.project.itemPlacements ?? []).map((i) => i.itemId);
      const showTown = hotkeyCtx.showTown !== false;
      const markets = showTown ? (hotkeyCtx.project.marketNodes ?? []).map((m) => m.id) : [];
      const stations = showTown ? (hotkeyCtx.project.craftingStations ?? []).map((s) => s.id) : [];
      const buildings = showTown ? (hotkeyCtx.project.buildings ?? []).map((b) => b.id) : [];
      const hubs = showTown ? (hotkeyCtx.project.hubs ?? []).map((h) => h.id) : [];
      const strongholds = showTown ? (hotkeyCtx.project.strongholds ?? []).map((s) => s.id) : [];
      hotkeyCtx.selectAll({ zones, entities, landmarks, spawns, encounters, items, markets, stations, buildings, hubs, strongholds }, false);
      return { executed: true, handled: true, action: 'select-all' };
    },
  },
  {
    id: 'escape',
    title: 'Clear Selection and Cancel',
    category: 'selection',
    surfaces: ['hotkey'],
    keywords: ['deselect', 'abort', 'dismiss'],
    hotkeyId: 'escape',
    hotkeyBindings: [{ key: 'Escape', label: 'Esc', description: 'Clear selection and cancel drag', order: 11 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      if (hotkeyCtx.showSpeedPanel) { hotkeyCtx.closeSpeedPanel(); }
      else { hotkeyCtx.clearSelection(); }
      hotkeyCtx.setConnectionStart?.(null);
      return { executed: true, handled: true, action: 'escape' };
    },
  },
  createNudgeCommand({ id: 'nudge-up',    title: 'Nudge Selection Up',    key: 'ArrowUp',    label: 'Up',    description: 'Nudge selected up (Shift for 5x)',    keywords: ['move north', 'shift up'],    order: 12, dx: 0,  dy: -1 }),
  createNudgeCommand({ id: 'nudge-down',  title: 'Nudge Selection Down',  key: 'ArrowDown',  label: 'Down',  description: 'Nudge selected down (Shift for 5x)',  keywords: ['move south', 'shift down'],  order: 13, dx: 0,  dy: 1 }),
  createNudgeCommand({ id: 'nudge-left',  title: 'Nudge Selection Left',  key: 'ArrowLeft',  label: 'Left',  description: 'Nudge selected left (Shift for 5x)',  keywords: ['move west', 'shift left'],   order: 14, dx: -1, dy: 0 }),
  createNudgeCommand({ id: 'nudge-right', title: 'Nudge Selection Right', key: 'ArrowRight', label: 'Right', description: 'Nudge selected right (Shift for 5x)', keywords: ['move east', 'shift right'],  order: 15, dx: 1,  dy: 0 }),
  {
    id: 'open-details',
    title: 'Open Details',
    category: 'inspect',
    surfaces: ['hotkey'],
    keywords: ['sidebar', 'map tab', 'focus inspector'],
    hotkeyId: 'open-details',
    hotkeyBindings: [{ key: 'Enter', label: 'Enter', description: 'Open details for selected object', order: 16 }],
    when: (ctx) => hasAnyTarget(ctx),
    disabledReason: (ctx) => (hasAnyTarget(ctx) ? null : 'Select an object to inspect details'),
    run: ({ hit, stores, hotkeyCtx, event }) => {
      if (!hotkeyCtx && !stores) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      if (hit && stores && (!hotkeyCtx || getSelectionCount(hotkeyCtx.selection) === 0)) {
        selectFromContext(hit, stores);
      }
      (hotkeyCtx ?? stores)?.setRightTab('map');
      (hotkeyCtx ?? stores)?.setRightCollapsed?.(false);
      return { executed: true, handled: true, action: 'open-details' };
    },
  },
  {
    id: 'apply-preset',
    title: 'Apply Preset',
    category: 'author',
    surfaces: ['hotkey'],
    keywords: ['template', 'biome', 'style', 'pattern'],
    hotkeyId: 'apply-preset',
    hotkeyBindings: [{ key: 'KeyP', label: 'P', description: 'Apply preset to selected district or zone', order: 17 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.applyPreset?.();
      hotkeyCtx.setRightTab('presets');
      return { executed: true, handled: true, action: 'apply-preset' };
    },
  },
  {
    id: 'save-preset',
    title: 'Save Selection as Preset',
    category: 'author',
    surfaces: ['hotkey'],
    keywords: ['kit', 'capture template', 'store preset', 'reusable'],
    hotkeyId: 'save-preset',
    hotkeyBindings: [{ key: 'KeyP', shift: true, label: 'Shift+P', description: 'Save current selection as preset', order: 18 }],
    when: () => true,
    disabledReason: () => null,
    run: ({ hotkeyCtx, event }) => {
      if (!hotkeyCtx) return fail('hotkeyCtx unavailable');
      event?.preventDefault();
      hotkeyCtx.savePreset?.();
      hotkeyCtx.setRightTab('presets');
      return { executed: true, handled: true, action: 'save-preset' };
    },
  },

  // -- 10 Tool-switch Commands (unified hotkey + ToolPalette) --
  ...TOOL_COMMANDS,
];

const COMMAND_BY_ID = new Map<string, EditorCommand>(
  COMMAND_REGISTRY.map((cmd) => [cmd.id, cmd]),
);

const CONTEXT_DECK_HIT_MAP: Record<HitResult['type'], ContextDeckKey> = {
  zone: 'zone',
  entity: 'entity',
  connection: 'connection',
  landmark: 'landmark',
  spawn: 'spawn',
  encounter: 'encounter',
  item: 'item',
  prop: 'item',
  tile: 'item',
  market: 'item',
  building: 'item',
  hub: 'item',
  stronghold: 'item',
  station: 'item',
};

/** Resolve a canvas HitResult into one of the 8 canonical Band 1 context-deck keys. */
export function getContextDeckKey(hit: HitResult | null | undefined): ContextDeckKey {
  if (!hit) return 'empty';
  return CONTEXT_DECK_HIT_MAP[hit.type] ?? 'empty';
}

/** Return the fixed, ordered 4–5 slot Band 1 context deck for `hit`. */
export function getContextDeckCommands(hit: HitResult | null | undefined): EditorCommand[] {
  const key = getContextDeckKey(hit);
  const ids = CONTEXT_DECKS[key];
  const cmds: EditorCommand[] = [];
  for (const id of ids) {
    const cmd = COMMAND_BY_ID.get(id);
    if (cmd) cmds.push(cmd);
  }
  return cmds;
}

/** Return the fixed canonical Band 4 Catalogue group for `cmd`. */
export function getCommandCatalogueGroup(cmd: EditorCommand): CatalogueGroup {
  return CATEGORY_TO_CATALOGUE_GROUP[cmd.category];
}

export interface CommandBadge {
  kind: 'shortcut' | 'location';
  text: string;
}

/**
 * Look up the live keybinding label(s) for `cmd` from the active hotkey binding table.
 * Never returns hardcoded strings independent of the hotkey table.
 */
export function getCommandShortcutLabel(
  cmd: EditorCommand,
  bindings?: readonly HotkeyBinding[],
): string | null {
  const table = bindings ?? getHotkeyBindingsFromRegistry();
  const labels = table.filter((b) => b.action === cmd.id).map((b) => b.label);
  if (labels.length === 0) return null;
  return labels[0];
}

/**
 * Return the right-side hint badge for a palette row: live shortcut from `bindings`
 * when bound, or editor location (`uiPath`) when unbound.
 */
export function getCommandBadge(
  cmd: EditorCommand,
  bindings?: readonly HotkeyBinding[],
): CommandBadge | null {
  const shortcut = getCommandShortcutLabel(cmd, bindings);
  if (shortcut) return { kind: 'shortcut', text: shortcut };
  if (cmd.uiPath) return { kind: 'location', text: cmd.uiPath };
  return null;
}

/** Look up any registered command by ID. */
export function getCommandById(id: string): EditorCommand | undefined {
  return COMMAND_BY_ID.get(id);
}

/** Return all commands belonging to the given UI/input surface. */
export function getCommandsForSurface(surface: CommandSurface): EditorCommand[] {
  return COMMAND_REGISTRY.filter((cmd) => cmd.surfaces.includes(surface));
}

/** Look up a Speed Panel command by ID (in `speed-panel` surface). */
export function getSpeedPanelCommands(): EditorCommand[] {
  return getCommandsForSurface('speed-panel');
}

/** Return up to 7 context-menu commands matching `hit`, prioritizing `context` before `global`. */
export function getContextMenuCommands(hit: HitResult | null): EditorCommand[] {
  const matching = COMMAND_REGISTRY.filter(
    (cmd) => cmd.surfaces.includes('context-menu') && cmd.when({ hit }),
  );
  const sorted = [...matching].sort((a, b) => {
    const ac = a.speedPanelCategory ?? 'context';
    const bc = b.speedPanelCategory ?? 'context';
    if (ac === 'context' && bc !== 'context') return -1;
    if (ac !== 'context' && bc === 'context') return 1;
    return 0;
  });
  return sorted.slice(0, CONTEXT_MENU_LIMIT);
}

/** Return all tool-palette tool commands in exact toolbar order. */
export function getToolPaletteCommands(): EditorCommand[] {
  return getCommandsForSurface('tool-palette');
}

export interface ToolPaletteEntry {
  commandId: string;
  id: EditorTool;
  label: string;
  key: string;
  icon: string;
}

/** Typed projection of tool-palette commands for UI consumption without non-null assertions. */
export function getToolPaletteEntries(): ToolPaletteEntry[] {
  const entries: ToolPaletteEntry[] = [];
  for (const cmd of getToolPaletteCommands()) {
    if (cmd.tool && cmd.toolLabel && cmd.toolKey && cmd.toolIcon) {
      entries.push({
        commandId: cmd.id,
        id: cmd.tool,
        label: cmd.toolLabel,
        key: cmd.toolKey,
        icon: cmd.toolIcon,
      });
    }
  }
  return entries;
}

/** Reconstruct all registered hotkey bindings in exact base-table order. */
export function getHotkeyBindingsFromRegistry(): HotkeyBinding[] {
  const entries: Array<{ order: number; binding: HotkeyBinding }> = [];
  for (const cmd of COMMAND_REGISTRY) {
    if (!cmd.surfaces.includes('hotkey') || !cmd.hotkeyBindings) continue;
    for (const spec of cmd.hotkeyBindings) {
      const binding: HotkeyBinding = {
        key: spec.key,
        ...(spec.ctrl ? { ctrl: true } : {}),
        ...(spec.shift ? { shift: true } : {}),
        action: cmd.id,
        label: spec.label,
        description: spec.description,
      };
      entries.push({ order: spec.order, binding });
    }
  }
  entries.sort((a, b) => a.order - b.order);
  return entries.map((e) => e.binding);
}

/** Execute a command by ID against the provided context. */
export function runCommand(id: string, ctx: CommandContext): CommandRunResult {
  const cmd = COMMAND_BY_ID.get(id);
  if (!cmd) return { executed: false, handled: false, reason: 'unknown action' };
  return cmd.run(ctx);
}
