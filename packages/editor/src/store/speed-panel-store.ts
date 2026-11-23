// speed-panel-store.ts — persisted pinned actions, recents, frecency, adaptive history, groups, macros

import { create } from 'zustand';
import { COMMAND_REGISTRY } from '../command-registry.js';
import type { SpeedPanelGroup, SpeedPanelMacro } from '../speed-panel-actions.js';
import {
  bumpAdaptiveHistory,
  bumpFrecency,
  computeDecayedAdaptiveScore,
  normalizeSearchQuery,
  type AdaptiveHistoryEntry,
  type FrecencyEntry,
} from '../speed-panel-search.js';

// -- localStorage keys --
const PINS_KEY = 'world-forge-speed-panel-pins';
const RECENTS_KEY = 'world-forge-speed-panel-recents';
const GROUPS_KEY = 'world-forge-speed-panel-groups';
const MACROS_KEY = 'world-forge-speed-panel-macros';
export const SPEED_PANEL_STATE_V2_KEY = 'wf.speedPanel.v2';

const MAX_RECENTS = 5;
export const MAX_ADAPTIVE_HISTORY = 200;
/** F-e57095f8: drop persisted macro steps whose actionId is no longer registered. */
const KNOWN_ACTION_IDS = new Set(COMMAND_REGISTRY.map((c) => c.id));

export interface SpeedPanelStateV2 {
  version: 2;
  pinnedIds: string[];
  recentIds: string[];
  frecency: Record<string, FrecencyEntry>;
  adaptiveHistory: Record<string, AdaptiveHistoryEntry>;
  groups: SpeedPanelGroup[];
  macros: SpeedPanelMacro[];
  showRecents: boolean;
}

export function loadJson<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    // F-9f500bd2: valid JSON of the wrong type (object/string/null) used to
    // pass the parse catch and then throw from pinnedIds.includes / groups.map.
    if (!isValid(parsed)) return fallback;
    return parsed;
  } catch { return fallback; }
}

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

let _warnedSpeedPanelWrite = false;

function saveJson(key: string, value: unknown) {
  // F-a4323dfa: quota/SecurityError must not throw out of the zustand setter
  // (that aborted the in-memory update). Warn once, keep memory state.
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (!_warnedSpeedPanelWrite) {
      console.warn('Failed to persist speed-panel state to localStorage:', e);
      _warnedSpeedPanelWrite = true;
    }
  }
}

function sanitizeGroups(raw: unknown): SpeedPanelGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((g): g is SpeedPanelGroup =>
      isPlainObject(g) &&
      typeof g.id === 'string' &&
      typeof g.name === 'string' &&
      isStringArray(g.actionIds),
    )
    .map((g) => ({ id: g.id, name: g.name, actionIds: [...g.actionIds] }));
}

function sanitizeMacros(raw: unknown): SpeedPanelMacro[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is SpeedPanelMacro =>
      isPlainObject(m) &&
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      Array.isArray(m.steps),
    )
    .map((m) => ({
      ...m,
      steps: m.steps.filter((s) => s && typeof s.actionId === 'string' && KNOWN_ACTION_IDS.has(s.actionId)),
    }));
}

function sanitizeFrecency(raw: unknown): Record<string, FrecencyEntry> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, FrecencyEntry> = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (
      isPlainObject(entry) &&
      typeof entry.score === 'number' &&
      Number.isFinite(entry.score) &&
      entry.score > 0 &&
      typeof entry.lastUsedAt === 'number' &&
      Number.isFinite(entry.lastUsedAt) &&
      typeof entry.count === 'number' &&
      Number.isFinite(entry.count)
    ) {
      out[id] = { score: entry.score, lastUsedAt: entry.lastUsedAt, count: entry.count };
    }
  }
  return out;
}

/** Evict the lowest decayed-score entries when query history exceeds `maxEntries`. */
export function pruneAdaptiveHistory(
  history: Readonly<Record<string, AdaptiveHistoryEntry>>,
  nowMs = Date.now(),
  maxEntries = MAX_ADAPTIVE_HISTORY,
): Record<string, AdaptiveHistoryEntry> {
  if (maxEntries <= 0) return {};
  const entries = Object.entries(history);
  if (entries.length <= maxEntries) {
    return { ...history };
  }
  entries.sort(([, a], [, b]) => {
    const scoreDiff = computeDecayedAdaptiveScore(b, nowMs) - computeDecayedAdaptiveScore(a, nowMs);
    if (scoreDiff !== 0) return scoreDiff;
    return b.lastUsedAt - a.lastUsedAt;
  });
  const out: Record<string, AdaptiveHistoryEntry> = {};
  for (const [query, entry] of entries.slice(0, maxEntries)) {
    out[query] = entry;
  }
  return out;
}

function sanitizeAdaptiveHistory(raw: unknown, nowMs = Date.now()): Record<string, AdaptiveHistoryEntry> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, AdaptiveHistoryEntry> = {};
  for (const [query, entry] of Object.entries(raw)) {
    if (
      isPlainObject(entry) &&
      typeof entry.commandId === 'string' &&
      typeof entry.score === 'number' &&
      Number.isFinite(entry.score) &&
      entry.score > 0 &&
      typeof entry.lastUsedAt === 'number' &&
      Number.isFinite(entry.lastUsedAt)
    ) {
      out[query] = {
        commandId: entry.commandId,
        score: entry.score,
        lastUsedAt: entry.lastUsedAt,
      };
    }
  }
  return pruneAdaptiveHistory(out, nowMs);
}

function seedFrecencyFromRecents(
  recentIds: readonly string[],
  nowMs: number,
): Record<string, FrecencyEntry> {
  const frecency: Record<string, FrecencyEntry> = {};
  for (let i = 0; i < recentIds.length; i++) {
    const id = recentIds[i];
    if (!frecency[id]) {
      frecency[id] = {
        score: Math.max(0.25, recentIds.length - i),
        lastUsedAt: nowMs - i,
        count: 1,
      };
    }
  }
  return frecency;
}

/**
 * Load persisted v2 Speed Panel state from `wf.speedPanel.v2`, or perform a
 * lossless migration from the legacy pre-v2 `world-forge-speed-panel-*` keys.
 * If any individual v2 field fails validation, fall back to its legacy key
 * rather than discarding intact legacy data.
 */
export function loadSpeedPanelStateV2(nowMs = Date.now()): SpeedPanelStateV2 {
  const v2Raw = loadJson<Record<string, unknown> | null>(SPEED_PANEL_STATE_V2_KEY, null, isPlainObject);
  if (v2Raw && v2Raw.version === 2) {
    const pinnedIds = isStringArray(v2Raw.pinnedIds)
      ? [...v2Raw.pinnedIds]
      : loadJson<string[]>(PINS_KEY, [], isStringArray);
    const recentIds = isStringArray(v2Raw.recentIds)
      ? [...v2Raw.recentIds]
      : loadJson<string[]>(RECENTS_KEY, [], isStringArray);
    const groups = isArray(v2Raw.groups)
      ? sanitizeGroups(v2Raw.groups)
      : sanitizeGroups(loadJson<unknown[]>(GROUPS_KEY, [], isArray));
    const macros = isArray(v2Raw.macros)
      ? sanitizeMacros(v2Raw.macros)
      : sanitizeMacros(loadJson<unknown[]>(MACROS_KEY, [], isArray));
    const frecency = isPlainObject(v2Raw.frecency)
      ? sanitizeFrecency(v2Raw.frecency)
      : seedFrecencyFromRecents(recentIds, nowMs);
    return {
      version: 2,
      pinnedIds,
      recentIds,
      frecency,
      adaptiveHistory: sanitizeAdaptiveHistory(v2Raw.adaptiveHistory, nowMs),
      groups,
      macros,
      showRecents: typeof v2Raw.showRecents === 'boolean' ? v2Raw.showRecents : true,
    };
  }

  // Lossless migration from legacy keys
  const pinnedIds = loadJson<string[]>(PINS_KEY, [], isStringArray);
  const recentIds = loadJson<string[]>(RECENTS_KEY, [], isStringArray);
  const groups = sanitizeGroups(loadJson<unknown[]>(GROUPS_KEY, [], isArray));
  const macros = sanitizeMacros(loadJson<unknown[]>(MACROS_KEY, [], isArray));

  return {
    version: 2,
    pinnedIds,
    recentIds,
    frecency: seedFrecencyFromRecents(recentIds, nowMs),
    adaptiveHistory: {},
    groups,
    macros,
    showRecents: true,
  };
}

function snapshotV2(s: {
  pinnedIds: string[];
  recentIds: string[];
  frecency: Record<string, FrecencyEntry>;
  adaptiveHistory: Record<string, AdaptiveHistoryEntry>;
  groups: SpeedPanelGroup[];
  macros: SpeedPanelMacro[];
  showRecents: boolean;
}): SpeedPanelStateV2 {
  return {
    version: 2,
    pinnedIds: s.pinnedIds,
    recentIds: s.recentIds,
    frecency: s.frecency,
    adaptiveHistory: s.adaptiveHistory,
    groups: s.groups,
    macros: s.macros,
    showRecents: s.showRecents,
  };
}

// -- Store interface --

export interface SpeedPanelPinState {
  // Pins
  pinnedIds: string[];
  togglePin: (actionId: string) => void;
  reorderPin: (fromIndex: number, toIndex: number) => void;

  // Recents & Frecency
  recentIds: string[];
  frecency: Record<string, FrecencyEntry>;
  adaptiveHistory: Record<string, AdaptiveHistoryEntry>;
  showRecents: boolean;
  addRecent: (id: string, nowMs?: number) => void;
  recordCommandUsage: (commandId: string, query?: string, nowMs?: number) => void;
  setShowRecents: (show: boolean) => void;

  // Groups
  groups: SpeedPanelGroup[];
  addGroup: (group: SpeedPanelGroup) => void;
  updateGroup: (id: string, patch: Partial<Omit<SpeedPanelGroup, 'id'>>) => void;
  removeGroup: (id: string) => void;
  addActionToGroup: (groupId: string, actionId: string) => void;
  removeActionFromGroup: (groupId: string, actionId: string) => void;

  // Macros
  macros: SpeedPanelMacro[];
  addMacro: (macro: SpeedPanelMacro) => void;
  updateMacro: (id: string, patch: Partial<Omit<SpeedPanelMacro, 'id'>>) => void;
  removeMacro: (id: string) => void;
  addStepToMacro: (macroId: string, actionId: string) => void;
  removeStepFromMacro: (macroId: string, stepIndex: number) => void;
  reorderMacroStep: (macroId: string, fromIndex: number, toIndex: number) => void;
}

const initialV2 = loadSpeedPanelStateV2();

export const useSpeedPanelPins = create<SpeedPanelPinState>((set) => ({
  // -- Pins --
  pinnedIds: initialV2.pinnedIds,

  togglePin: (actionId) => set((s) => {
    const pinnedIds = s.pinnedIds.includes(actionId)
      ? s.pinnedIds.filter((id) => id !== actionId)
      : [...s.pinnedIds, actionId];
    saveJson(PINS_KEY, pinnedIds);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, pinnedIds }));
    return { pinnedIds };
  }),

  reorderPin: (fromIndex, toIndex) => set((s) => {
    const arr = [...s.pinnedIds];
    if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return s;
    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);
    saveJson(PINS_KEY, arr);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, pinnedIds: arr }));
    return { pinnedIds: arr };
  }),

  // -- Recents, Frecency & Adaptive History --
  recentIds: initialV2.recentIds,
  frecency: initialV2.frecency,
  adaptiveHistory: initialV2.adaptiveHistory,
  showRecents: initialV2.showRecents,

  addRecent: (id, nowMs = Date.now()) => set((s) => {
    const deduped = s.recentIds.filter((r) => r !== id);
    const recentIds = [id, ...deduped].slice(0, MAX_RECENTS);
    const frecency = {
      ...s.frecency,
      [id]: bumpFrecency(s.frecency[id], nowMs),
    };
    saveJson(RECENTS_KEY, recentIds);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, recentIds, frecency }));
    return { recentIds, frecency };
  }),

  recordCommandUsage: (commandId, query = '', nowMs = Date.now()) => set((s) => {
    const deduped = s.recentIds.filter((r) => r !== commandId);
    const recentIds = [commandId, ...deduped].slice(0, MAX_RECENTS);
    const frecency = {
      ...s.frecency,
      [commandId]: bumpFrecency(s.frecency[commandId], nowMs),
    };
    const norm = normalizeSearchQuery(query);
    const adaptiveHistory = norm
      ? pruneAdaptiveHistory(
          { ...s.adaptiveHistory, [norm]: bumpAdaptiveHistory(s.adaptiveHistory[norm], commandId, nowMs) },
          nowMs,
        )
      : s.adaptiveHistory;
    saveJson(RECENTS_KEY, recentIds);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, recentIds, frecency, adaptiveHistory }));
    return { recentIds, frecency, adaptiveHistory };
  }),

  setShowRecents: (showRecents) => set((s) => {
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, showRecents }));
    return { showRecents };
  }),

  // -- Groups --
  groups: initialV2.groups,

  addGroup: (group) => set((s) => {
    const groups = [...s.groups, group];
    saveJson(GROUPS_KEY, groups);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, groups }));
    return { groups };
  }),

  updateGroup: (id, patch) => set((s) => {
    const groups = s.groups.map((g) => g.id === id ? { ...g, ...patch } : g);
    saveJson(GROUPS_KEY, groups);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, groups }));
    return { groups };
  }),

  removeGroup: (id) => set((s) => {
    const groups = s.groups.filter((g) => g.id !== id);
    saveJson(GROUPS_KEY, groups);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, groups }));
    return { groups };
  }),

  addActionToGroup: (groupId, actionId) => set((s) => {
    const groups = s.groups.map((g) => {
      if (g.id !== groupId || g.actionIds.includes(actionId)) return g;
      return { ...g, actionIds: [...g.actionIds, actionId] };
    });
    saveJson(GROUPS_KEY, groups);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, groups }));
    return { groups };
  }),

  removeActionFromGroup: (groupId, actionId) => set((s) => {
    const groups = s.groups.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, actionIds: g.actionIds.filter((id) => id !== actionId) };
    });
    saveJson(GROUPS_KEY, groups);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, groups }));
    return { groups };
  }),

  // -- Macros --
  macros: initialV2.macros,

  addMacro: (macro) => set((s) => {
    const macros = [...s.macros, macro];
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, macros }));
    return { macros };
  }),

  updateMacro: (id, patch) => set((s) => {
    const macros = s.macros.map((m) => m.id === id ? { ...m, ...patch } : m);
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, macros }));
    return { macros };
  }),

  removeMacro: (id) => set((s) => {
    const macros = s.macros.filter((m) => m.id !== id);
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, macros }));
    return { macros };
  }),

  addStepToMacro: (macroId, actionId) => set((s) => {
    const macros = s.macros.map((m) => {
      if (m.id !== macroId) return m;
      return { ...m, steps: [...m.steps, { actionId }] };
    });
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, macros }));
    return { macros };
  }),

  removeStepFromMacro: (macroId, stepIndex) => set((s) => {
    const macros = s.macros.map((m) => {
      if (m.id !== macroId) return m;
      const steps = m.steps.filter((_, i) => i !== stepIndex);
      return { ...m, steps };
    });
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, macros }));
    return { macros };
  }),

  reorderMacroStep: (macroId, fromIndex, toIndex) => set((s) => {
    const macros = s.macros.map((m) => {
      if (m.id !== macroId) return m;
      const steps = [...m.steps];
      if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex >= steps.length) return m;
      const [step] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, step);
      return { ...m, steps };
    });
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...s, macros }));
    return { macros };
  }),
}));
