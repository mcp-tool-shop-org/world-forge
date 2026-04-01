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

/** Persist user-created presets (excluding built-ins) to localStorage. */
function persistUserPresets(regionPresets: RegionPreset[], encounterPresets: EncounterPreset[]): void {
  persist({
    regionPresets: userRegionPresets(regionPresets),
    encounterPresets: userEncounterPresets(encounterPresets),
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
      ...structuredClone(input),
      id: `region-preset-${Date.now()}`,
      builtIn: false,
    };
    const regionPresets = [...get().regionPresets, preset];
    set({ regionPresets });
    persistUserPresets(regionPresets, get().encounterPresets);
    return preset;
  },

  updateRegionPreset: (id, updates) => {
    const regionPresets = get().regionPresets.map((p) =>
      p.id === id && !p.builtIn ? { ...p, ...updates } : p,
    );
    set({ regionPresets });
    persistUserPresets(regionPresets, get().encounterPresets);
  },

  deleteRegionPreset: (id) => {
    const regionPresets = get().regionPresets.filter((p) => !(p.id === id && !p.builtIn));
    set({ regionPresets });
    persistUserPresets(regionPresets, get().encounterPresets);
  },

  duplicateRegionPreset: (id) => {
    const original = get().regionPresets.find((p) => p.id === id);
    if (!original) return undefined;
    const copy: RegionPreset = {
      ...structuredClone(original),
      id: `region-preset-${Date.now()}`,
      name: `${original.name} (copy)`,
      builtIn: false,
    };
    const regionPresets = [...get().regionPresets, copy];
    set({ regionPresets });
    persistUserPresets(regionPresets, get().encounterPresets);
    return copy;
  },

  // ── Encounter preset CRUD ───────────────────────────────────

  saveEncounterPreset: (input) => {
    const preset: EncounterPreset = {
      ...structuredClone(input),
      id: `encounter-preset-${Date.now()}`,
      builtIn: false,
    };
    const encounterPresets = [...get().encounterPresets, preset];
    set({ encounterPresets });
    persistUserPresets(get().regionPresets, encounterPresets);
    return preset;
  },

  updateEncounterPreset: (id, updates) => {
    const encounterPresets = get().encounterPresets.map((p) =>
      p.id === id && !p.builtIn ? { ...p, ...updates } : p,
    );
    set({ encounterPresets });
    persistUserPresets(get().regionPresets, encounterPresets);
  },

  deleteEncounterPreset: (id) => {
    const encounterPresets = get().encounterPresets.filter((p) => !(p.id === id && !p.builtIn));
    set({ encounterPresets });
    persistUserPresets(get().regionPresets, encounterPresets);
  },

  duplicateEncounterPreset: (id) => {
    const original = get().encounterPresets.find((p) => p.id === id);
    if (!original) return undefined;
    const copy: EncounterPreset = {
      ...structuredClone(original),
      id: `encounter-preset-${Date.now()}`,
      name: `${original.name} (copy)`,
      builtIn: false,
    };
    const encounterPresets = [...get().encounterPresets, copy];
    set({ encounterPresets });
    persistUserPresets(get().regionPresets, encounterPresets);
    return copy;
  },
}));
