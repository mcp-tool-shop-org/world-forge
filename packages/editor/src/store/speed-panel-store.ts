// speed-panel-store.ts — persisted pinned actions, recents, frecency, adaptive history, groups, macros

import { create } from 'zustand';
import { COMMAND_REGISTRY } from '../command-registry.js';
import type { MacroStep, SpeedPanelGroup, SpeedPanelMacro } from '../speed-panel-actions.js';
import type { LastPanelActionParams } from './editor-store.js';
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
export const MAX_IMPORTED_PINS = 32;
export const MAX_IMPORTED_MACROS = 32;
export const MAX_MACRO_STEPS = 16;
/** F-e57095f8: drop persisted macro steps whose actionId is no longer registered. */
export const KNOWN_ACTION_IDS = new Set(COMMAND_REGISTRY.map((c) => c.id));

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

/** Validate and clone serialized macro step arguments reusing `LastPanelActionParams`. */
export function sanitizeMacroStepArgs(raw: unknown): LastPanelActionParams | undefined {
  if (!isPlainObject(raw) || typeof raw.kind !== 'string') return undefined;
  switch (raw.kind) {
    case 'assign-district':
      return typeof raw.districtId === 'string' && raw.districtId.length > 0
        ? { kind: 'assign-district', districtId: raw.districtId }
        : undefined;
    case 'apply-region-preset':
      return typeof raw.presetId === 'string' &&
        raw.presetId.length > 0 &&
        (raw.applyMode === 'merge' || raw.applyMode === 'overwrite')
        ? { kind: 'apply-region-preset', presetId: raw.presetId, applyMode: raw.applyMode }
        : undefined;
    case 'apply-encounter-preset':
      return typeof raw.presetId === 'string' && raw.presetId.length > 0
        ? { kind: 'apply-encounter-preset', presetId: raw.presetId }
        : undefined;
    case 'place-encounter':
      return typeof raw.encounterType === 'string' && raw.encounterType.length > 0
        ? { kind: 'place-encounter', encounterType: raw.encounterType }
        : undefined;
    case 'set-elevation': {
      if (raw.elevation === undefined) {
        return { kind: 'set-elevation', elevation: undefined };
      }
      if (typeof raw.elevation === 'number' && Number.isFinite(raw.elevation)) {
        return { kind: 'set-elevation', elevation: raw.elevation };
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Validate and filter pinned command IDs against the command registry, recording dropped unknown IDs. */
export function sanitizePins(raw: unknown, warnings?: string[]): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!KNOWN_ACTION_IDS.has(item)) {
      warnings?.push(`Unknown pinned Speed Panel command dropped: ${item}`);
      continue;
    }
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  if (out.length > MAX_IMPORTED_PINS) {
    warnings?.push(`Trimmed Speed Panel pins to ${MAX_IMPORTED_PINS} (dropped ${out.length - MAX_IMPORTED_PINS})`);
    return out.slice(0, MAX_IMPORTED_PINS);
  }
  return out;
}

/**
 * Sanitize persisted or bundled Speed Panel macros while keeping legacy `{ actionId }` steps
 * intact and dropping steps with unknown command IDs.
 */
export function sanitizeMacros(raw: unknown, warnings?: string[]): SpeedPanelMacro[] {
  if (!Array.isArray(raw)) return [];
  const validMacros = raw
    .filter((m): m is SpeedPanelMacro =>
      isPlainObject(m) &&
      typeof m.id === 'string' &&
      typeof m.name === 'string' &&
      Array.isArray(m.steps),
    )
    .map((m) => {
      const steps: MacroStep[] = [];
      for (const rawStep of m.steps as unknown[]) {
        if (!isPlainObject(rawStep)) continue;
        const actionId =
          typeof rawStep.actionId === 'string'
            ? rawStep.actionId
            : typeof rawStep.commandId === 'string'
              ? rawStep.commandId
              : null;
        if (!actionId || !KNOWN_ACTION_IDS.has(actionId)) {
          warnings?.push(`Unknown macro step command dropped from "${m.name}": ${actionId ?? 'invalid'}`);
          continue;
        }
        const args = rawStep.args !== undefined ? sanitizeMacroStepArgs(rawStep.args) : undefined;
        if (rawStep.args !== undefined && args === undefined) {
          warnings?.push(`Dropped malformed macro step args in "${m.name}" (${actionId})`);
        }
        const step: MacroStep = {
          actionId,
          ...(typeof rawStep.commandId === 'string' && KNOWN_ACTION_IDS.has(rawStep.commandId)
            ? { commandId: rawStep.commandId }
            : {}),
          ...(args ? { args } : {}),
        };
        steps.push(step);
      }
      if (steps.length > MAX_MACRO_STEPS) {
        warnings?.push(`Trimmed steps in macro "${m.name}" to ${MAX_MACRO_STEPS} (dropped ${steps.length - MAX_MACRO_STEPS})`);
        steps.splice(MAX_MACRO_STEPS);
      }
      return {
        ...m,
        steps,
        ...(typeof m.pinned === 'boolean' ? { pinned: m.pinned } : {}),
      };
    });
  if (validMacros.length > MAX_IMPORTED_MACROS) {
    warnings?.push(`Trimmed Speed Panel macros to ${MAX_IMPORTED_MACROS} (dropped ${validMacros.length - MAX_IMPORTED_MACROS})`);
    return validMacros.slice(0, MAX_IMPORTED_MACROS);
  }
  return validMacros;
}

function macroContentKey(m: Pick<SpeedPanelMacro, 'steps' | 'pinned'>): string {
  return JSON.stringify({
    pinned: m.pinned !== false,
    steps: m.steps.map((s) => ({
      id: s.commandId ?? s.actionId,
      args: s.args ?? null,
    })),
  });
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

/** Evict the lowest decayed-score entries when query history exceeds `maxEntries`, keeping `pinnedKey` if present. */
export function pruneAdaptiveHistory(
  history: Readonly<Record<string, AdaptiveHistoryEntry>>,
  nowMs = Date.now(),
  maxEntries = MAX_ADAPTIVE_HISTORY,
  pinnedKey?: string,
): Record<string, AdaptiveHistoryEntry> {
  if (maxEntries <= 0) return {};
  const entries = Object.entries(history);
  if (entries.length <= maxEntries) {
    return { ...history };
  }
  const hasPinned = pinnedKey !== undefined && Object.hasOwn(history, pinnedKey);
  const rest = hasPinned ? entries.filter(([q]) => q !== pinnedKey) : entries;
  rest.sort(([, a], [, b]) => {
    const scoreDiff = computeDecayedAdaptiveScore(b, nowMs) - computeDecayedAdaptiveScore(a, nowMs);
    if (scoreDiff !== 0) return scoreDiff;
    return b.lastUsedAt - a.lastUsedAt;
  });
  const out: Record<string, AdaptiveHistoryEntry> = {};
  if (hasPinned && pinnedKey !== undefined) {
    out[pinnedKey] = history[pinnedKey];
  }
  const keepCount = hasPinned ? Math.max(0, maxEntries - 1) : maxEntries;
  for (const [query, entry] of rest.slice(0, keepCount)) {
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

export interface MergeKitPresetsResult {
  addedPins: string[];
  addedMacros: SpeedPanelMacro[];
  renamedMacros: Array<{ from: string; to: string }>;
  warnings: string[];
}

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
  mergeKitPresets: (
    presets: { pins?: readonly string[]; macros?: readonly SpeedPanelMacro[] },
    kitName: string,
  ) => MergeKitPresetsResult;
}

const initialV2 = loadSpeedPanelStateV2();

export const useSpeedPanelPins = create<SpeedPanelPinState>((set, get) => ({
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
          MAX_ADAPTIVE_HISTORY,
          norm,
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

  mergeKitPresets: (presets, kitName) => {
    const warnings: string[] = [];
    const validPins = sanitizePins(presets.pins ?? [], warnings);
    const validMacros = sanitizeMacros(presets.macros ?? [], warnings);

    const state = get();
    const existingPinSet = new Set(state.pinnedIds);
    const addedPins = validPins.filter((id) => !existingPinSet.has(id));
    const pinnedIds = [...state.pinnedIds, ...addedPins];

    const existingNames = new Set(state.macros.map((m) => m.name.trim().toLowerCase()));
    const existingIds = new Set(state.macros.map((m) => m.id));
    const addedMacros: SpeedPanelMacro[] = [];
    const renamedMacros: Array<{ from: string; to: string }> = [];

    for (const incoming of validMacros) {
      const suffixLabel = kitName.trim() || 'Kit';
      const baseLower = incoming.name.trim().toLowerCase();
      const kitPrefix = `${baseLower} (${suffixLabel.toLowerCase()}`;
      const incomingKey = macroContentKey(incoming);
      const alreadyMerged = [...state.macros, ...addedMacros].some((existing) => {
        if (macroContentKey(existing) !== incomingKey) return false;
        const exLower = existing.name.trim().toLowerCase();
        return exLower === baseLower || exLower === `${kitPrefix})` || exLower.startsWith(`${kitPrefix} `);
      });
      if (alreadyMerged) continue;

      let nextId = incoming.id;
      let idSuffix = 2;
      while (existingIds.has(nextId)) {
        nextId = `${incoming.id}-${idSuffix}`;
        idSuffix += 1;
      }
      existingIds.add(nextId);

      let nextName = incoming.name;
      if (existingNames.has(nextName.trim().toLowerCase())) {
        let candidate = `${incoming.name} (${suffixLabel})`;
        let n = 2;
        while (existingNames.has(candidate.trim().toLowerCase())) {
          candidate = `${incoming.name} (${suffixLabel} ${n})`;
          n += 1;
        }
        renamedMacros.push({ from: incoming.name, to: candidate });
        nextName = candidate;
      }
      existingNames.add(nextName.trim().toLowerCase());

      const cloned: SpeedPanelMacro = {
        ...incoming,
        id: nextId,
        name: nextName,
        steps: incoming.steps.map((st) => ({
          actionId: st.actionId,
          ...(st.commandId ? { commandId: st.commandId } : {}),
          ...(st.args ? { args: { ...st.args } } : {}),
        })),
      };
      addedMacros.push(cloned);
    }

    const macros = [...state.macros, ...addedMacros];
    saveJson(PINS_KEY, pinnedIds);
    saveJson(MACROS_KEY, macros);
    saveJson(SPEED_PANEL_STATE_V2_KEY, snapshotV2({ ...state, pinnedIds, macros }));
    set({ pinnedIds, macros });
    return { addedPins, addedMacros, renamedMacros, warnings };
  },
}));
