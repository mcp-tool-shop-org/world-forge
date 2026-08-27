// speed-panel-store.ts — persisted pinned actions, recents, groups, macros for the Speed Panel

import { create } from 'zustand';
import { SPEED_PANEL_ACTIONS, type SpeedPanelGroup, type SpeedPanelMacro } from '../speed-panel-actions.js';

// -- localStorage keys --
const PINS_KEY = 'world-forge-speed-panel-pins';
const RECENTS_KEY = 'world-forge-speed-panel-recents';
const GROUPS_KEY = 'world-forge-speed-panel-groups';
const MACROS_KEY = 'world-forge-speed-panel-macros';

const MAX_RECENTS = 5;
/** F-e57095f8: drop persisted macro steps whose actionId is no longer registered. */
const KNOWN_ACTION_IDS = new Set(SPEED_PANEL_ACTIONS.map((a) => a.id));

export function loadJson<T>(key: string, fallback: T, isValid: (v: unknown) => v is T): T {
  try {
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

let _warnedSpeedPanelWrite = false;

function saveJson(key: string, value: unknown) {
  // F-a4323dfa: quota/SecurityError must not throw out of the zustand setter
  // (that aborted the in-memory update). Warn once, keep memory state.
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    if (!_warnedSpeedPanelWrite) {
      console.warn('Failed to persist speed-panel state to localStorage:', e);
      _warnedSpeedPanelWrite = true;
    }
  }
}

function loadMacros(): SpeedPanelMacro[] {
  const parsed = loadJson<unknown[]>(MACROS_KEY, [], isArray);
  return parsed
    .filter((m): m is SpeedPanelMacro =>
      !!m && typeof m === 'object' && typeof (m as SpeedPanelMacro).id === 'string' && Array.isArray((m as SpeedPanelMacro).steps),
    )
    .map((m) => ({
      ...m,
      steps: m.steps.filter((s) => s && KNOWN_ACTION_IDS.has(s.actionId)),
    }));
}

// -- Store interface --

export interface SpeedPanelPinState {
  // Pins
  pinnedIds: string[];
  togglePin: (actionId: string) => void;
  reorderPin: (fromIndex: number, toIndex: number) => void;

  // Recents
  recentIds: string[];
  addRecent: (id: string) => void;

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

export const useSpeedPanelPins = create<SpeedPanelPinState>((set) => ({
  // -- Pins --
  pinnedIds: loadJson<string[]>(PINS_KEY, [], isStringArray),

  togglePin: (actionId) => set((s) => {
    const next = s.pinnedIds.includes(actionId)
      ? s.pinnedIds.filter((id) => id !== actionId)
      : [...s.pinnedIds, actionId];
    saveJson(PINS_KEY, next);
    return { pinnedIds: next };
  }),

  reorderPin: (fromIndex, toIndex) => set((s) => {
    const arr = [...s.pinnedIds];
    if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return s;
    const [item] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, item);
    saveJson(PINS_KEY, arr);
    return { pinnedIds: arr };
  }),

  // -- Recents --
  recentIds: loadJson<string[]>(RECENTS_KEY, [], isStringArray),

  addRecent: (id) => set((s) => {
    const deduped = s.recentIds.filter((r) => r !== id);
    const next = [id, ...deduped].slice(0, MAX_RECENTS);
    saveJson(RECENTS_KEY, next);
    return { recentIds: next };
  }),

  // -- Groups --
  groups: loadJson<SpeedPanelGroup[]>(GROUPS_KEY, [], isArray as (v: unknown) => v is SpeedPanelGroup[]),

  addGroup: (group) => set((s) => {
    const next = [...s.groups, group];
    saveJson(GROUPS_KEY, next);
    return { groups: next };
  }),

  updateGroup: (id, patch) => set((s) => {
    const next = s.groups.map((g) => g.id === id ? { ...g, ...patch } : g);
    saveJson(GROUPS_KEY, next);
    return { groups: next };
  }),

  removeGroup: (id) => set((s) => {
    const next = s.groups.filter((g) => g.id !== id);
    saveJson(GROUPS_KEY, next);
    return { groups: next };
  }),

  addActionToGroup: (groupId, actionId) => set((s) => {
    const next = s.groups.map((g) => {
      if (g.id !== groupId || g.actionIds.includes(actionId)) return g;
      return { ...g, actionIds: [...g.actionIds, actionId] };
    });
    saveJson(GROUPS_KEY, next);
    return { groups: next };
  }),

  removeActionFromGroup: (groupId, actionId) => set((s) => {
    const next = s.groups.map((g) => {
      if (g.id !== groupId) return g;
      return { ...g, actionIds: g.actionIds.filter((id) => id !== actionId) };
    });
    saveJson(GROUPS_KEY, next);
    return { groups: next };
  }),

  // -- Macros --
  macros: loadMacros(),

  addMacro: (macro) => set((s) => {
    const next = [...s.macros, macro];
    saveJson(MACROS_KEY, next);
    return { macros: next };
  }),

  updateMacro: (id, patch) => set((s) => {
    const next = s.macros.map((m) => m.id === id ? { ...m, ...patch } : m);
    saveJson(MACROS_KEY, next);
    return { macros: next };
  }),

  removeMacro: (id) => set((s) => {
    const next = s.macros.filter((m) => m.id !== id);
    saveJson(MACROS_KEY, next);
    return { macros: next };
  }),

  addStepToMacro: (macroId, actionId) => set((s) => {
    const next = s.macros.map((m) => {
      if (m.id !== macroId) return m;
      return { ...m, steps: [...m.steps, { actionId }] };
    });
    saveJson(MACROS_KEY, next);
    return { macros: next };
  }),

  removeStepFromMacro: (macroId, stepIndex) => set((s) => {
    const next = s.macros.map((m) => {
      if (m.id !== macroId) return m;
      const steps = m.steps.filter((_, i) => i !== stepIndex);
      return { ...m, steps };
    });
    saveJson(MACROS_KEY, next);
    return { macros: next };
  }),

  reorderMacroStep: (macroId, fromIndex, toIndex) => set((s) => {
    const next = s.macros.map((m) => {
      if (m.id !== macroId) return m;
      const steps = [...m.steps];
      if (fromIndex < 0 || fromIndex >= steps.length || toIndex < 0 || toIndex >= steps.length) return m;
      const [step] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, step);
      return { ...m, steps };
    });
    saveJson(MACROS_KEY, next);
    return { macros: next };
  }),
}));
