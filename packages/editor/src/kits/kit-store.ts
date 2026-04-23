// kit-store.ts — Zustand CRUD for starter kits with localStorage persistence

import { create } from 'zustand';
import type { StarterKit } from './types.js';
import { BUILTIN_KITS } from './built-ins.js';
import type { AuthoringMode } from '@world-forge/schema';

const STORAGE_KEY = 'world-forge-kits';

/**
 * ED-A-012: monotonic counter used to disambiguate ids generated in the same
 * millisecond. `Date.now()` alone can collide under rapid batch imports (which
 * is exactly how importKit gets called for multi-kit bundles). Keeping a
 * module-scoped counter is the simplest always-unique fallback and works in
 * every JS runtime (no `crypto.randomUUID` dependency).
 */
let _kitIdCounter = 0;
function nextKitId(prefix: string): string {
  _kitIdCounter += 1;
  return `${prefix}-${Date.now()}-${_kitIdCounter}`;
}

interface StoredKits {
  kits: StarterKit[];
}

function persist(allKits: StarterKit[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      kits: allKits.filter((k) => !k.builtIn),
    }));
  } catch (e) {
    console.warn('Failed to save kits to localStorage:', e);
  }
}

function loadFromStorage(): StoredKits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kits: [] };
    return JSON.parse(raw) as StoredKits;
  } catch {
    console.warn('Corrupted kit data in localStorage — resetting');
    localStorage.removeItem(STORAGE_KEY);
    return { kits: [] };
  }
}

interface KitState {
  /** All starter kits: built-in + custom. */
  kits: StarterKit[];

  loadKits: () => void;

  // Kit CRUD (custom kits only)
  saveKit: (kit: Omit<StarterKit, 'id' | 'builtIn' | 'createdAt' | 'updatedAt'>) => StarterKit;
  updateKit: (id: string, updates: Partial<Omit<StarterKit, 'id' | 'builtIn'>>) => void;
  deleteKit: (id: string) => void;
  duplicateKit: (id: string) => StarterKit | undefined;

  /** Import a kit from a bundle. If replaceId is set and points to a custom kit, replaces it in-place. */
  importKit: (
    input: Omit<StarterKit, 'id' | 'builtIn' | 'createdAt' | 'updatedAt'>,
    replaceId?: string,
  ) => StarterKit;
}

export const useKitStore = create<KitState>((set, get) => ({
  kits: [...BUILTIN_KITS],

  loadKits: () => {
    const stored = loadFromStorage();
    set({ kits: [...BUILTIN_KITS, ...stored.kits] });
  },

  saveKit: (input) => {
    const now = new Date().toISOString();
    const kit: StarterKit = {
      ...structuredClone(input),
      id: `kit-${Date.now()}`,
      builtIn: false,
      source: input.source ?? 'local',
      createdAt: now,
      updatedAt: now,
    };
    const kits = [...get().kits, kit];
    set({ kits });
    persist(kits);
    return kit;
  },

  updateKit: (id, updates) => {
    const kits = get().kits.map((k) =>
      k.id === id && !k.builtIn
        ? { ...k, ...updates, updatedAt: new Date().toISOString() }
        : k,
    );
    set({ kits });
    persist(kits);
  },

  deleteKit: (id) => {
    const kits = get().kits.filter((k) => !(k.id === id && !k.builtIn));
    set({ kits });
    persist(kits);
  },

  duplicateKit: (id) => {
    const original = get().kits.find((k) => k.id === id);
    if (!original) return undefined;
    const now = new Date().toISOString();
    const copy: StarterKit = {
      ...structuredClone(original),
      id: `kit-${Date.now()}`,
      name: `${original.name} (copy)`,
      builtIn: false,
      source: original.builtIn ? undefined : original.source,
      createdAt: now,
      updatedAt: now,
    };
    const kits = [...get().kits, copy];
    set({ kits });
    persist(kits);
    return copy;
  },

  importKit: (input, replaceId) => {
    const now = new Date().toISOString();

    // Replace existing custom kit if replaceId targets one
    if (replaceId) {
      const existing = get().kits.find((k) => k.id === replaceId);
      if (existing && !existing.builtIn) {
        const updated: StarterKit = {
          ...structuredClone(input),
          id: replaceId,
          builtIn: false,
          createdAt: existing.createdAt,
          updatedAt: now,
        };
        const kits = get().kits.map((k) => (k.id === replaceId ? updated : k));
        set({ kits });
        persist(kits);
        return updated;
      }
    }

    // Import as new kit. ED-A-012: use a monotonic counter so same-ms imports
    // can't collide (previously `kit-<ts>-i` repeated on bulk imports).
    const kit: StarterKit = {
      ...structuredClone(input),
      id: nextKitId('kit-import'),
      builtIn: false,
      createdAt: now,
      updatedAt: now,
    };
    const kits = [...get().kits, kit];
    set({ kits });
    persist(kits);
    return kit;
  },
}));

/** Pure filter: keep kits matching the given mode. Returns all when mode is undefined. */
export function filterKitsByMode(kits: StarterKit[], mode: AuthoringMode | undefined): StarterKit[] {
  if (!mode) return kits;
  return kits.filter((k) => k.modes.includes(mode));
}
