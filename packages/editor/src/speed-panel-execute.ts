// speed-panel-execute.ts — extracted action execution logic for the Speed Panel

import type { HitResult } from './hit-testing.js';
import type { SpeedPanelMacro, MacroExecutionResult } from './speed-panel-actions.js';
import type { WorldProject, ZoneConnection, Zone } from '@world-forge/schema';
import type { ViewportState } from './viewport.js';
import type { RightTab, EditorTool } from './store/editor-store.js';
import { frameBounds } from './viewport.js';

/** Bag of store methods needed by execute — keeps the function testable */
export interface ExecuteStores {
  // Selection
  selectZone: (id: string, additive: boolean) => void;
  selectEntity: (id: string, additive: boolean) => void;
  selectLandmark: (id: string, additive: boolean) => void;
  selectSpawn: (id: string, additive: boolean) => void;
  selectEncounter: (id: string, additive: boolean) => void;
  selectConnection: (fromId: string, toId: string) => void;
  clearSelection: () => void;

  // UI
  setRightTab: (tab: RightTab) => void;
  setTool: (tool: EditorTool) => void;
  setConnectionStart: (zoneId: string) => void;
  setViewport: (vp: ViewportState) => void;

  // Project mutations
  removeSelected: (sel: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }) => void;
  duplicateSelected: (sel: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }) => unknown;
  removeConnection: (fromId: string, toId: string) => void;
  addConnection: (conn: ZoneConnection) => void;
  /** ED-FT-005: update a single zone (used by the set-elevation speed action). */
  updateZone?: (zoneId: string, updates: Partial<Zone>) => void;
  /** ED-FT-005: optional prompt shim so tests can inject a deterministic value. */
  promptFn?: (message: string) => string | null;

  // Project data (read-only)
  project: WorldProject;
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
  return true;
}

function emptySelection() {
  return { zones: [] as string[], entities: [] as string[], landmarks: [] as string[], spawns: [] as string[], encounters: [] as string[] };
}

/**
 * Execute a single speed-panel action.
 * Returns { executed: true } if the action ran, { executed: false } if context mismatch.
 */
export function executeAction(
  actionId: string,
  context: HitResult | null,
  stores: ExecuteStores,
): { executed: boolean } {
  switch (actionId) {
    case 'edit-props':
      if (!context) return { executed: false };
      if (!selectFromContext(context, stores)) return { executed: false };
      stores.setRightTab('map');
      return { executed: true };

    case 'delete':
      if (!context) return { executed: false };
      if (context.type === 'connection') {
        const parsed = parseConnectionId(context.id);
        if (!parsed) return { executed: false };
        stores.removeConnection(parsed[0], parsed[1]);
      } else {
        selectFromContext(context, stores);
        const sel = emptySelection();
        const key = context.type === 'zone' ? 'zones' : context.type === 'entity' ? 'entities' : context.type === 'landmark' ? 'landmarks' : context.type === 'spawn' ? 'spawns' : 'encounters';
        sel[key] = [context.id];
        stores.removeSelected(sel);
      }
      stores.clearSelection();
      return { executed: true };

    case 'duplicate':
      if (!context || (context.type !== 'zone' && context.type !== 'entity' && context.type !== 'landmark')) {
        return { executed: false };
      }
      if (!selectFromContext(context, stores)) return { executed: false };
      {
        const sel = emptySelection();
        const key = context.type === 'zone' ? 'zones' : context.type === 'entity' ? 'entities' : 'landmarks';
        sel[key] = [context.id];
        stores.duplicateSelected(sel);
      }
      return { executed: true };

    case 'new-zone':
      stores.setTool('zone-paint');
      return { executed: true };

    case 'fit-content': {
      const tileSize = stores.project.map.tileSize;
      const items = stores.project.zones.map((z) => ({
        gridX: z.gridX, gridY: z.gridY, gridWidth: z.gridWidth, gridHeight: z.gridHeight,
      }));
      // TODO: 800x600 is a hardcoded fallback canvas size. Ideally this should
      // read the actual canvas element dimensions (e.g. from a canvasSize field
      // in ExecuteStores) so fit-content adapts to the user's window size.
      const vp = frameBounds(items, tileSize, 800, 600);
      if (vp) stores.setViewport(vp);
      return { executed: true };
    }

    case 'assign-district':
      if (context?.type !== 'zone') return { executed: false };
      stores.selectZone(context.id, false);
      stores.setRightTab('map');
      return { executed: true };

    case 'place-entity':
      if (context?.type !== 'zone') return { executed: false };
      stores.setTool('entity-place');
      return { executed: true };

    case 'connect-from':
      if (context?.type !== 'zone') return { executed: false };
      stores.setTool('connection');
      stores.setConnectionStart(context.id);
      return { executed: true };

    case 'swap-direction':
      if (context?.type !== 'connection') return { executed: false };
      {
        const parsed = parseConnectionId(context.id);
        if (!parsed) return { executed: false };
        const [from, to] = parsed;
        const conn = stores.project.connections.find(
          (c) => c.fromZoneId === from && c.toZoneId === to,
        );
        if (conn) {
          stores.removeConnection(from, to);
          stores.addConnection({ ...conn, fromZoneId: to, toZoneId: from });
        }
      }
      return { executed: true };

    case 'set-elevation': {
      if (context?.type !== 'zone') return { executed: false };
      if (!stores.updateZone) return { executed: false };
      const ask = stores.promptFn ?? ((msg) => (typeof globalThis.prompt === 'function' ? globalThis.prompt(msg) : null));
      const raw = ask(`Set elevation (meters) for zone ${context.id}. Leave blank to clear.`);
      if (raw == null) return { executed: false };
      const trimmed = raw.trim();
      let elevation: number | undefined;
      if (trimmed === '') {
        elevation = undefined;
      } else {
        const n = Number(trimmed);
        if (!Number.isFinite(n)) return { executed: false };
        elevation = n;
      }
      stores.updateZone(context.id, { elevation });
      return { executed: true };
    }

    default:
      return { executed: false };
  }
}

/**
 * Execute a macro — runs steps sequentially, each step = separate undo entry.
 * Aborts on first step that fails (context mismatch).
 * Returns step-by-step results for feedback UI.
 */
export function executeMacro(
  macro: SpeedPanelMacro,
  context: HitResult | null,
  stores: ExecuteStores,
): MacroExecutionResult {
  const total = macro.steps.length;
  const steps: MacroExecutionResult['steps'] = [];

  for (let i = 0; i < total; i++) {
    const result = executeAction(macro.steps[i].actionId, context, stores);
    steps.push({ action: macro.steps[i].actionId, success: result.executed });
    if (!result.executed) {
      return {
        completed: i, total,
        abortedAt: i,
        reason: `Step ${i + 1} (${macro.steps[i].actionId}) failed — context mismatch`,
        steps,
        totalSteps: total,
        completedSteps: i,
      };
    }
  }
  return { completed: total, total, steps, totalSteps: total, completedSteps: total };
}
