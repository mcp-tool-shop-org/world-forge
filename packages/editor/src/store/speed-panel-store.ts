// speed-panel-store.ts — persisted pinned actions, recents, groups, macros for the Speed Panel

import { create } from 'zustand';
import type { SpeedPanelGroup, SpeedPanelMacro, MacroStep } from '../speed-panel-actions.js';

// -- localStorage keys --
const PINS_KEY = 'world-forge-speed-panel-pins';
const RECENTS_KEY = 'world-forge-speed-panel-recents';
const GROUPS_KEY = 'world-forge-speed-panel-groups';
const MACROS_KEY = 'world-forge-speed-panel-macros';

const MAX_RECENTS = 5;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
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
  pinnedIds: loadJson<string[]>(PINS_KEY, []),

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
  recentIds: loadJson<string[]>(RECENTS_KEY, []),

  addRecent: (id) => set((s) => {
    const deduped = s.recentIds.filter((r) => r !== id);
    const next = [id, ...deduped].slice(0, MAX_RECENTS);
    saveJson(RECENTS_KEY, next);
    return { recentIds: next };
  }),

  // -- Groups --
  groups: loadJson<SpeedPanelGroup[]>(GROUPS_KEY, []),

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
  macros: loadJson<SpeedPanelMacro[]>(MACROS_KEY, []),

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
