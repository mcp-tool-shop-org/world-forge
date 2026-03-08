// project-store.ts — WorldProject state with undo/redo

import { create } from 'zustand';
import type { WorldProject, Zone, ZoneConnection, District, EntityPlacement, Landmark, SpawnPoint } from '@world-forge/schema';

function createEmptyProject(): WorldProject {
  return {
    id: 'new-project',
    name: 'Untitled World',
    description: '',
    version: '0.1.0',
    genre: 'fantasy',
    tones: ['atmospheric'],
    difficulty: 'beginner',
    narratorTone: '',
    map: { id: 'map-1', name: 'Map', description: '', gridWidth: 40, gridHeight: 30, tileSize: 32 },
    zones: [],
    connections: [],
    districts: [],
    landmarks: [],
    dialogues: [],
    factionPresences: [],
    pressureHotspots: [],
    entityPlacements: [],
    itemPlacements: [],
    encounterAnchors: [],
    spawnPoints: [],
    craftingStations: [],
    marketNodes: [],
    tilesets: [],
    tileLayers: [],
    props: [],
    propPlacements: [],
    ambientLayers: [],
  };
}

interface ProjectState {
  project: WorldProject;
  dirty: boolean;
  undoStack: WorldProject[];
  redoStack: WorldProject[];

  // Actions
  loadProject: (p: WorldProject) => void;
  newProject: () => void;
  updateProject: (updater: (p: WorldProject) => WorldProject) => void;
  undo: () => void;
  redo: () => void;

  // Zone helpers
  addZone: (z: Zone) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  removeZone: (id: string) => void;

  // Connection helpers
  addConnection: (c: ZoneConnection) => void;
  removeConnection: (fromId: string, toId: string) => void;

  // District helpers
  addDistrict: (d: District) => void;
  updateDistrict: (id: string, updates: Partial<District>) => void;

  // Entity helpers
  addEntity: (e: EntityPlacement) => void;
  removeEntity: (entityId: string) => void;

  // Landmark helpers
  addLandmark: (l: Landmark) => void;

  // Spawn helpers
  addSpawnPoint: (s: SpawnPoint) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createEmptyProject(),
  dirty: false,
  undoStack: [],
  redoStack: [],

  loadProject: (p) => set({ project: p, dirty: false, undoStack: [], redoStack: [] }),
  newProject: () => set({ project: createEmptyProject(), dirty: false, undoStack: [], redoStack: [] }),

  updateProject: (updater) => {
    const { project, undoStack } = get();
    const newStack = [...undoStack.slice(-9), project];
    set({ project: updater(project), dirty: true, undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      project: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, project],
      dirty: true,
    });
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      project: next,
      undoStack: [...undoStack, project],
      redoStack: redoStack.slice(0, -1),
      dirty: true,
    });
  },

  addZone: (z) => get().updateProject((p) => ({
    ...p,
    zones: [...p.zones, z],
  })),

  updateZone: (id, updates) => get().updateProject((p) => ({
    ...p,
    zones: p.zones.map((z) => z.id === id ? { ...z, ...updates } : z),
  })),

  removeZone: (id) => get().updateProject((p) => ({
    ...p,
    zones: p.zones.filter((z) => z.id !== id),
    connections: p.connections.filter((c) => c.fromZoneId !== id && c.toZoneId !== id),
  })),

  addConnection: (c) => get().updateProject((p) => ({
    ...p,
    connections: [...p.connections, c],
    zones: p.zones.map((z) => {
      if (z.id === c.fromZoneId && !z.neighbors.includes(c.toZoneId)) {
        return { ...z, neighbors: [...z.neighbors, c.toZoneId] };
      }
      if (c.bidirectional && z.id === c.toZoneId && !z.neighbors.includes(c.fromZoneId)) {
        return { ...z, neighbors: [...z.neighbors, c.fromZoneId] };
      }
      return z;
    }),
  })),

  removeConnection: (fromId, toId) => get().updateProject((p) => ({
    ...p,
    connections: p.connections.filter((c) => !(c.fromZoneId === fromId && c.toZoneId === toId)),
  })),

  addDistrict: (d) => get().updateProject((p) => ({
    ...p,
    districts: [...p.districts, d],
  })),

  updateDistrict: (id, updates) => get().updateProject((p) => ({
    ...p,
    districts: p.districts.map((d) => d.id === id ? { ...d, ...updates } : d),
  })),

  addEntity: (e) => get().updateProject((p) => ({
    ...p,
    entityPlacements: [...p.entityPlacements, e],
  })),

  removeEntity: (entityId) => get().updateProject((p) => ({
    ...p,
    entityPlacements: p.entityPlacements.filter((e) => e.entityId !== entityId),
  })),

  addLandmark: (l) => get().updateProject((p) => ({
    ...p,
    landmarks: [...p.landmarks, l],
  })),

  addSpawnPoint: (s) => get().updateProject((p) => ({
    ...p,
    spawnPoints: [...p.spawnPoints, s],
  })),
}));
