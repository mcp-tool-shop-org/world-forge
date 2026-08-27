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

/**
 * F-76d031d9: save/duplicate used `kit-${Date.now()}` which collides in the
 * same millisecond. Digit-only suffix keeps the existing `/^kit-\d+$/` shape
 * that kit-store tests lock, while the counter makes two same-ms writes unique.
 */
function nextSavedKitId(): string {
  _kitIdCounter += 1;
  return `kit-${Date.now()}${String(_kitIdCounter).padStart(4, '0')}`;
}

interface StoredKits {
  kits: StarterKit[];
}

/** Thrown when localStorage persist fails after an in-memory write is rolled back. */
export class StoragePersistError extends Error {
  constructor(message = 'Failed to save kits to localStorage') {
    super(message);
    this.name = 'StoragePersistError';
  }
}

function persist(allKits: StarterKit[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      kits: allKits.filter((k) => !k.builtIn),
    }));
    return true;
  } catch (e) {
    console.warn('Failed to save kits to localStorage:', e);
    return false;
  }
}

function loadFromStorage(): StoredKits {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { kits: [] };
    const parsed: unknown = JSON.parse(raw);
    // F-6cf2e4a4: valid JSON missing `kits` (or kits: null) used to crash
    // loadKits via `[...stored.kits]` on boot. Reset like the corrupt-JSON path.
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as StoredKits).kits)) {
      console.warn('Corrupted kit data in localStorage — resetting');
      localStorage.removeItem(STORAGE_KEY);
      return { kits: [] };
    }
    return { kits: (parsed as StoredKits).kits };
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
      id: nextSavedKitId(),
      builtIn: false,
      source: input.source ?? 'local',
      createdAt: now,
      updatedAt: now,
    };
    const prev = get().kits;
    const kits = [...prev, kit];
    set({ kits });
    if (!persist(kits)) {
      set({ kits: prev });
      throw new StoragePersistError();
    }
    return kit;
  },

  updateKit: (id, updates) => {
    const prev = get().kits;
    const kits = prev.map((k) =>
      k.id === id && !k.builtIn
        ? { ...k, ...updates, updatedAt: new Date().toISOString() }
        : k,
    );
    set({ kits });
    if (!persist(kits)) {
      set({ kits: prev });
      throw new StoragePersistError();
    }
  },

  deleteKit: (id) => {
    const prev = get().kits;
    const kits = prev.filter((k) => !(k.id === id && !k.builtIn));
    set({ kits });
    if (!persist(kits)) {
      set({ kits: prev });
      throw new StoragePersistError();
    }
  },

  duplicateKit: (id) => {
    const original = get().kits.find((k) => k.id === id);
    if (!original) return undefined;
    const now = new Date().toISOString();
    const copy: StarterKit = {
      ...structuredClone(original),
      id: nextSavedKitId(),
      name: `${original.name} (copy)`,
      builtIn: false,
      source: original.builtIn ? undefined : original.source,
      createdAt: now,
      updatedAt: now,
    };
    const prev = get().kits;
    const kits = [...prev, copy];
    set({ kits });
    if (!persist(kits)) {
      set({ kits: prev });
      throw new StoragePersistError();
    }
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
        const prev = get().kits;
        const kits = prev.map((k) => (k.id === replaceId ? updated : k));
        set({ kits });
        if (!persist(kits)) {
          set({ kits: prev });
          throw new StoragePersistError();
        }
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
    const prev = get().kits;
    const kits = [...prev, kit];
    set({ kits });
    if (!persist(kits)) {
      set({ kits: prev });
      throw new StoragePersistError();
    }
    return kit;
  },
}));

/** Pure filter: keep kits matching the given mode. Returns all when mode is undefined. */
export function filterKitsByMode(kits: StarterKit[], mode: AuthoringMode | undefined): StarterKit[] {
  if (!mode) return kits;
  return kits.filter((k) => k.modes.includes(mode));
}
