// preset-store.ts — Zustand CRUD for region and encounter presets with localStorage persistence

import { create } from 'zustand';
import type { RegionPreset, EncounterPreset } from './types.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from './built-ins.js';

const STORAGE_KEY = 'world-forge-presets';

interface StoredPresets {
  regionPresets: RegionPreset[];
  encounterPresets: EncounterPreset[];
}

function persist(data: StoredPresets): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save presets to localStorage:', e);
  }
}

function loadFromStorage(): StoredPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { regionPresets: [], encounterPresets: [] };
    return JSON.parse(raw) as StoredPresets;
  } catch {
    console.warn('Corrupted preset data in localStorage — resetting');
    localStorage.removeItem(STORAGE_KEY);
    return { regionPresets: [], encounterPresets: [] };
  }
}

interface PresetState {
  /** All region presets: built-in + user. */
  regionPresets: RegionPreset[];
  /** All encounter presets: built-in + user. */
  encounterPresets: EncounterPreset[];

  loadPresets: () => void;

  // Region preset CRUD (user presets only)
  saveRegionPreset: (preset: Omit<RegionPreset, 'id' | 'builtIn'>) => RegionPreset;
  updateRegionPreset: (id: string, updates: Partial<Omit<RegionPreset, 'id' | 'builtIn'>>) => void;
  deleteRegionPreset: (id: string) => void;
  duplicateRegionPreset: (id: string) => RegionPreset | undefined;

  // Encounter preset CRUD (user presets only)
  saveEncounterPreset: (preset: Omit<EncounterPreset, 'id' | 'builtIn'>) => EncounterPreset;
  updateEncounterPreset: (id: string, updates: Partial<Omit<EncounterPreset, 'id' | 'builtIn'>>) => void;
  deleteEncounterPreset: (id: string) => void;
  duplicateEncounterPreset: (id: string) => EncounterPreset | undefined;
}

function userRegionPresets(all: RegionPreset[]): RegionPreset[] {
  return all.filter((p) => !p.builtIn);
}

function userEncounterPresets(all: EncounterPreset[]): EncounterPreset[] {
  return all.filter((p) => !p.builtIn);
}

function persistState(state: PresetState): void {
  persist({
    regionPresets: userRegionPresets(state.regionPresets),
    encounterPresets: userEncounterPresets(state.encounterPresets),
  });
}

export const usePresetStore = create<PresetState>((set, get) => ({
  regionPresets: [...BUILTIN_REGION_PRESETS],
  encounterPresets: [...BUILTIN_ENCOUNTER_PRESETS],

  loadPresets: () => {
    const stored = loadFromStorage();
    set({
      regionPresets: [...BUILTIN_REGION_PRESETS, ...stored.regionPresets],
      encounterPresets: [...BUILTIN_ENCOUNTER_PRESETS, ...stored.encounterPresets],
    });
  },

  // ── Region preset CRUD ──────────────────────────────────────

  saveRegionPreset: (input) => {
    const preset: RegionPreset = {
      ...JSON.parse(JSON.stringify(input)),
      id: `region-preset-${Date.now()}`,
      builtIn: false,
    };
    const regionPresets = [...get().regionPresets, preset];
    set({ regionPresets });
    persistState({ ...get(), regionPresets });
    return preset;
  },

  updateRegionPreset: (id, updates) => {
    const regionPresets = get().regionPresets.map((p) =>
      p.id === id && !p.builtIn ? { ...p, ...updates } : p,
    );
    set({ regionPresets });
    persistState({ ...get(), regionPresets });
  },

  deleteRegionPreset: (id) => {
    const regionPresets = get().regionPresets.filter((p) => !(p.id === id && !p.builtIn));
    set({ regionPresets });
    persistState({ ...get(), regionPresets });
  },

  duplicateRegionPreset: (id) => {
    const original = get().regionPresets.find((p) => p.id === id);
    if (!original) return undefined;
    const copy: RegionPreset = {
      ...JSON.parse(JSON.stringify(original)),
      id: `region-preset-${Date.now()}`,
      name: `${original.name} (copy)`,
      builtIn: false,
    };
    const regionPresets = [...get().regionPresets, copy];
    set({ regionPresets });
    persistState({ ...get(), regionPresets });
    return copy;
  },

  // ── Encounter preset CRUD ───────────────────────────────────

  saveEncounterPreset: (input) => {
    const preset: EncounterPreset = {
      ...JSON.parse(JSON.stringify(input)),
      id: `encounter-preset-${Date.now()}`,
      builtIn: false,
    };
    const encounterPresets = [...get().encounterPresets, preset];
    set({ encounterPresets });
    persistState({ ...get(), encounterPresets });
    return preset;
  },

  updateEncounterPreset: (id, updates) => {
    const encounterPresets = get().encounterPresets.map((p) =>
      p.id === id && !p.builtIn ? { ...p, ...updates } : p,
    );
    set({ encounterPresets });
    persistState({ ...get(), encounterPresets });
  },

  deleteEncounterPreset: (id) => {
    const encounterPresets = get().encounterPresets.filter((p) => !(p.id === id && !p.builtIn));
    set({ encounterPresets });
    persistState({ ...get(), encounterPresets });
  },

  duplicateEncounterPreset: (id) => {
    const original = get().encounterPresets.find((p) => p.id === id);
    if (!original) return undefined;
    const copy: EncounterPreset = {
      ...JSON.parse(JSON.stringify(original)),
      id: `encounter-preset-${Date.now()}`,
      name: `${original.name} (copy)`,
      builtIn: false,
    };
    const encounterPresets = [...get().encounterPresets, copy];
    set({ encounterPresets });
    persistState({ ...get(), encounterPresets });
    return copy;
  },
}));
