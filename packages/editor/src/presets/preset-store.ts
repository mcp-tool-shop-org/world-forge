// preset-store.ts — Zustand CRUD for region and encounter presets with localStorage persistence

import { create } from 'zustand';
import type { RegionPreset, EncounterPreset } from './types.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from './built-ins.js';

const STORAGE_KEY = 'world-forge-presets';

interface StoredPresets {
  regionPresets: RegionPreset[];
  encounterPresets: EncounterPreset[];
}

export class StoragePersistError extends Error {
  constructor(message = 'Failed to save presets to localStorage') {
    super(message);
    this.name = 'StoragePersistError';
  }
}

let _presetIdCounter = 0;
function nextPresetId(prefix: string): string {
  _presetIdCounter += 1;
  return `${prefix}-${Date.now()}-${_presetIdCounter}`;
}

function persist(data: StoredPresets): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.warn('Failed to save presets to localStorage:', e);
    return false;
  }
}

function loadFromStorage(): StoredPresets {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { regionPresets: [], encounterPresets: [] };
    const parsed: unknown = JSON.parse(raw);
    // F-6cf2e4a4: valid JSON missing arrays (or null) used to crash loadPresets.
    if (
      !parsed || typeof parsed !== 'object'
      || !Array.isArray((parsed as StoredPresets).regionPresets)
      || !Array.isArray((parsed as StoredPresets).encounterPresets)
    ) {
      console.warn('Corrupted preset data in localStorage — resetting');
      localStorage.removeItem(STORAGE_KEY);
      return { regionPresets: [], encounterPresets: [] };
    }
    return {
      regionPresets: (parsed as StoredPresets).regionPresets,
      encounterPresets: (parsed as StoredPresets).encounterPresets,
    };
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
function persistUserPresets(regionPresets: RegionPreset[], encounterPresets: EncounterPreset[]): boolean {
  return persist({
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
      id: nextPresetId('region-preset'),
      builtIn: false,
    };
    const prev = get().regionPresets;
    const regionPresets = [...prev, preset];
    set({ regionPresets });
    if (!persistUserPresets(regionPresets, get().encounterPresets)) {
      set({ regionPresets: prev });
      throw new StoragePersistError();
    }
    return preset;
  },

  updateRegionPreset: (id, updates) => {
    const prev = get().regionPresets;
    const regionPresets = prev.map((p) =>
      p.id === id && !p.builtIn ? { ...p, ...updates } : p,
    );
    set({ regionPresets });
    if (!persistUserPresets(regionPresets, get().encounterPresets)) {
      set({ regionPresets: prev });
      throw new StoragePersistError();
    }
  },

  deleteRegionPreset: (id) => {
    const prev = get().regionPresets;
    const regionPresets = prev.filter((p) => !(p.id === id && !p.builtIn));
    set({ regionPresets });
    if (!persistUserPresets(regionPresets, get().encounterPresets)) {
      set({ regionPresets: prev });
      throw new StoragePersistError();
    }
  },

  duplicateRegionPreset: (id) => {
    const original = get().regionPresets.find((p) => p.id === id);
    if (!original) return undefined;
    const copy: RegionPreset = {
      ...structuredClone(original),
      id: nextPresetId('region-preset'),
      name: `${original.name} (copy)`,
      builtIn: false,
    };
    const prev = get().regionPresets;
    const regionPresets = [...prev, copy];
    set({ regionPresets });
    if (!persistUserPresets(regionPresets, get().encounterPresets)) {
      set({ regionPresets: prev });
      throw new StoragePersistError();
    }
    return copy;
  },

  // ── Encounter preset CRUD ───────────────────────────────────

  saveEncounterPreset: (input) => {
    const preset: EncounterPreset = {
      ...structuredClone(input),
      id: nextPresetId('encounter-preset'),
      builtIn: false,
    };
    const prev = get().encounterPresets;
    const encounterPresets = [...prev, preset];
    set({ encounterPresets });
    if (!persistUserPresets(get().regionPresets, encounterPresets)) {
      set({ encounterPresets: prev });
      throw new StoragePersistError();
    }
    return preset;
  },

  updateEncounterPreset: (id, updates) => {
    const prev = get().encounterPresets;
    const encounterPresets = prev.map((p) =>
      p.id === id && !p.builtIn ? { ...p, ...updates } : p,
    );
    set({ encounterPresets });
    if (!persistUserPresets(get().regionPresets, encounterPresets)) {
      set({ encounterPresets: prev });
      throw new StoragePersistError();
    }
  },

  deleteEncounterPreset: (id) => {
    const prev = get().encounterPresets;
    const encounterPresets = prev.filter((p) => !(p.id === id && !p.builtIn));
    set({ encounterPresets });
    if (!persistUserPresets(get().regionPresets, encounterPresets)) {
      set({ encounterPresets: prev });
      throw new StoragePersistError();
    }
  },

  duplicateEncounterPreset: (id) => {
    const original = get().encounterPresets.find((p) => p.id === id);
    if (!original) return undefined;
    const copy: EncounterPreset = {
      ...structuredClone(original),
      id: nextPresetId('encounter-preset'),
      name: `${original.name} (copy)`,
      builtIn: false,
    };
    const prev = get().encounterPresets;
    const encounterPresets = [...prev, copy];
    set({ encounterPresets });
    if (!persistUserPresets(get().regionPresets, encounterPresets)) {
      set({ encounterPresets: prev });
      throw new StoragePersistError();
    }
    return copy;
  },
}));
