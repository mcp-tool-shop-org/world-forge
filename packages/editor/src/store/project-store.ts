// project-store.ts — WorldProject state with undo/redo

import { create } from 'zustand';
import type {
  WorldProject, Zone, ZoneConnection, District, EntityPlacement, Landmark, SpawnPoint,
  PlayerTemplate, BuildCatalogDefinition, ArchetypeDefinition, BackgroundDefinition,
  TraitDefinition, DisciplineDefinition, CrossDisciplineTitle, ClassEntanglement,
  ProgressionTreeDefinition, ProgressionNode,
  DialogueDefinition, DialogueNode, DialogueChoice,
  AssetEntry, AssetPack,
} from '@world-forge/schema';
import { duplicateSelected as doDuplicate } from '../duplicate.js';
import { alignSelected as doAlign, distributeSelected as doDistribute, type AlignAxis, type DistributeAxis } from '../layout.js';

export function createEmptyProject(): WorldProject {
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
    progressionTrees: [],
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
    assets: [],
    assetPacks: [],
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
  updateEntity: (entityId: string, updates: Partial<EntityPlacement>) => void;
  removeEntity: (entityId: string) => void;

  // Landmark helpers
  addLandmark: (l: Landmark) => void;
  updateLandmark: (id: string, updates: Partial<Landmark>) => void;
  removeLandmark: (id: string) => void;

  // Spawn helpers
  addSpawnPoint: (s: SpawnPoint) => void;
  updateSpawnPoint: (id: string, updates: Partial<SpawnPoint>) => void;
  removeSpawnPoint: (id: string) => void;

  // Batch helpers (multi-select operations)
  moveSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[] }, dx: number, dy: number) => void;
  removeSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[] }) => void;
  duplicateSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[] }) => { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[] };
  alignSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[] }, axis: AlignAxis) => void;
  distributeSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[] }, axis: DistributeAxis) => void;

  // Player template helpers
  setPlayerTemplate: (t: PlayerTemplate) => void;
  updatePlayerTemplate: (updates: Partial<PlayerTemplate>) => void;

  // Build catalog helpers
  setBuildCatalog: (c: BuildCatalogDefinition) => void;
  updateBuildCatalogConfig: (updates: Partial<Pick<BuildCatalogDefinition, 'statBudget' | 'maxTraits' | 'requiredFlaws'>>) => void;
  addArchetype: (a: ArchetypeDefinition) => void;
  updateArchetype: (id: string, updates: Partial<ArchetypeDefinition>) => void;
  removeArchetype: (id: string) => void;
  addBackground: (b: BackgroundDefinition) => void;
  updateBackground: (id: string, updates: Partial<BackgroundDefinition>) => void;
  removeBackground: (id: string) => void;
  addTrait: (t: TraitDefinition) => void;
  updateTrait: (id: string, updates: Partial<TraitDefinition>) => void;
  removeTrait: (id: string) => void;
  addDiscipline: (d: DisciplineDefinition) => void;
  updateDiscipline: (id: string, updates: Partial<DisciplineDefinition>) => void;
  removeDiscipline: (id: string) => void;
  addCrossTitle: (ct: CrossDisciplineTitle) => void;
  removeCrossTitle: (archetypeId: string, disciplineId: string) => void;
  addEntanglement: (e: ClassEntanglement) => void;
  removeEntanglement: (id: string) => void;

  // Progression tree helpers
  addProgressionTree: (t: ProgressionTreeDefinition) => void;
  updateProgressionTree: (id: string, updates: Partial<ProgressionTreeDefinition>) => void;
  removeProgressionTree: (id: string) => void;
  addProgressionNode: (treeId: string, node: ProgressionNode) => void;
  updateProgressionNode: (treeId: string, nodeId: string, updates: Partial<ProgressionNode>) => void;
  removeProgressionNode: (treeId: string, nodeId: string) => void;

  // Asset helpers
  addAsset: (a: AssetEntry) => void;
  updateAsset: (id: string, updates: Partial<AssetEntry>) => void;
  removeAsset: (id: string) => void;

  // Asset pack helpers
  addAssetPack: (p: AssetPack) => void;
  updateAssetPack: (id: string, updates: Partial<AssetPack>) => void;
  removeAssetPack: (id: string) => void;

  // Dialogue helpers
  addDialogue: (d: DialogueDefinition) => void;
  updateDialogue: (id: string, updates: Partial<DialogueDefinition>) => void;
  removeDialogue: (id: string) => void;
  addDialogueNode: (dialogueId: string, node: DialogueNode) => void;
  updateDialogueNode: (dialogueId: string, nodeId: string, updates: Partial<DialogueNode>) => void;
  removeDialogueNode: (dialogueId: string, nodeId: string) => void;
}

function ensureBuildCatalog(p: WorldProject): BuildCatalogDefinition {
  return p.buildCatalog ?? {
    statBudget: 10, maxTraits: 3, requiredFlaws: 0,
    archetypes: [], backgrounds: [], traits: [],
    disciplines: [], crossTitles: [], entanglements: [],
  };
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

  // Zone helpers
  addZone: (z) => get().updateProject((p) => ({ ...p, zones: [...p.zones, z] })),
  updateZone: (id, updates) => get().updateProject((p) => ({
    ...p, zones: p.zones.map((z) => z.id === id ? { ...z, ...updates } : z),
  })),
  removeZone: (id) => get().updateProject((p) => ({
    ...p,
    zones: p.zones.filter((z) => z.id !== id),
    connections: p.connections.filter((c) => c.fromZoneId !== id && c.toZoneId !== id),
  })),

  // Connection helpers
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
    ...p, connections: p.connections.filter((c) => !(c.fromZoneId === fromId && c.toZoneId === toId)),
  })),

  // District helpers
  addDistrict: (d) => get().updateProject((p) => ({ ...p, districts: [...p.districts, d] })),
  updateDistrict: (id, updates) => get().updateProject((p) => ({
    ...p, districts: p.districts.map((d) => d.id === id ? { ...d, ...updates } : d),
  })),

  // Entity helpers
  addEntity: (e) => get().updateProject((p) => ({ ...p, entityPlacements: [...p.entityPlacements, e] })),
  updateEntity: (entityId, updates) => get().updateProject((p) => ({
    ...p, entityPlacements: p.entityPlacements.map((e) => e.entityId === entityId ? { ...e, ...updates } : e),
  })),
  removeEntity: (entityId) => get().updateProject((p) => ({
    ...p, entityPlacements: p.entityPlacements.filter((e) => e.entityId !== entityId),
  })),

  // Landmark helpers
  addLandmark: (l) => get().updateProject((p) => ({ ...p, landmarks: [...p.landmarks, l] })),
  updateLandmark: (id, updates) => get().updateProject((p) => ({
    ...p, landmarks: p.landmarks.map((l) => l.id === id ? { ...l, ...updates } : l),
  })),
  removeLandmark: (id) => get().updateProject((p) => ({
    ...p, landmarks: p.landmarks.filter((l) => l.id !== id),
  })),

  // Spawn helpers
  addSpawnPoint: (s) => get().updateProject((p) => ({ ...p, spawnPoints: [...p.spawnPoints, s] })),
  updateSpawnPoint: (id, updates) => get().updateProject((p) => ({
    ...p, spawnPoints: p.spawnPoints.map((s) => s.id === id ? { ...s, ...updates } : s),
  })),
  removeSpawnPoint: (id) => get().updateProject((p) => ({
    ...p, spawnPoints: p.spawnPoints.filter((s) => s.id !== id),
  })),

  // Batch helpers — single updateProject call for atomic undo
  moveSelected: (sel, dx, dy) => get().updateProject((p) => {
    const zSet = new Set(sel.zones);
    const eSet = new Set(sel.entities);
    const lSet = new Set(sel.landmarks);
    const sSet = new Set(sel.spawns);
    return {
      ...p,
      zones: p.zones.map((z) => zSet.has(z.id) ? { ...z, gridX: z.gridX + dx, gridY: z.gridY + dy } : z),
      entityPlacements: p.entityPlacements.map((e) => eSet.has(e.entityId) && e.gridX != null && e.gridY != null
        ? { ...e, gridX: e.gridX + dx, gridY: e.gridY + dy } : e),
      landmarks: p.landmarks.map((l) => lSet.has(l.id) ? { ...l, gridX: l.gridX + dx, gridY: l.gridY + dy } : l),
      spawnPoints: p.spawnPoints.map((s) => sSet.has(s.id) ? { ...s, gridX: s.gridX + dx, gridY: s.gridY + dy } : s),
    };
  }),
  removeSelected: (sel) => get().updateProject((p) => {
    const zSet = new Set(sel.zones);
    const eSet = new Set(sel.entities);
    const lSet = new Set(sel.landmarks);
    const sSet = new Set(sel.spawns);
    return {
      ...p,
      zones: p.zones.filter((z) => !zSet.has(z.id)),
      connections: p.connections.filter((c) => !zSet.has(c.fromZoneId) && !zSet.has(c.toZoneId)),
      districts: p.districts.map((d) => ({ ...d, zoneIds: d.zoneIds.filter((zid) => !zSet.has(zid)) })),
      entityPlacements: p.entityPlacements.filter((e) => !eSet.has(e.entityId) && !zSet.has(e.zoneId)),
      landmarks: p.landmarks.filter((l) => !lSet.has(l.id) && !zSet.has(l.zoneId)),
      spawnPoints: p.spawnPoints.filter((s) => !sSet.has(s.id) && !zSet.has(s.zoneId)),
    };
  }),
  duplicateSelected: (sel) => {
    const { project, undoStack } = get();
    const { project: newProject, newSelection } = doDuplicate(project, sel);
    if (newProject === project) return { zones: [], entities: [], landmarks: [], spawns: [] };
    const newStack = [...undoStack.slice(-9), project];
    set({ project: newProject, dirty: true, undoStack: newStack, redoStack: [] });
    return newSelection;
  },
  alignSelected: (sel, axis) => get().updateProject((p) => doAlign(p, sel, axis)),
  distributeSelected: (sel, axis) => get().updateProject((p) => doDistribute(p, sel, axis)),

  // Player template helpers
  setPlayerTemplate: (t) => get().updateProject((p) => ({ ...p, playerTemplate: t })),
  updatePlayerTemplate: (updates) => get().updateProject((p) => ({
    ...p, playerTemplate: p.playerTemplate ? { ...p.playerTemplate, ...updates } : undefined,
  })),

  // Build catalog helpers
  setBuildCatalog: (c) => get().updateProject((p) => ({ ...p, buildCatalog: c })),
  updateBuildCatalogConfig: (updates) => get().updateProject((p) => ({
    ...p, buildCatalog: { ...ensureBuildCatalog(p), ...updates },
  })),
  addArchetype: (a) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, archetypes: [...cat.archetypes, a] } };
  }),
  updateArchetype: (id, updates) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, archetypes: cat.archetypes.map((a) => a.id === id ? { ...a, ...updates } : a) } };
  }),
  removeArchetype: (id) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, archetypes: cat.archetypes.filter((a) => a.id !== id) } };
  }),
  addBackground: (b) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, backgrounds: [...cat.backgrounds, b] } };
  }),
  updateBackground: (id, updates) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, backgrounds: cat.backgrounds.map((b) => b.id === id ? { ...b, ...updates } : b) } };
  }),
  removeBackground: (id) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, backgrounds: cat.backgrounds.filter((b) => b.id !== id) } };
  }),
  addTrait: (t) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, traits: [...cat.traits, t] } };
  }),
  updateTrait: (id, updates) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, traits: cat.traits.map((t) => t.id === id ? { ...t, ...updates } : t) } };
  }),
  removeTrait: (id) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, traits: cat.traits.filter((t) => t.id !== id) } };
  }),
  addDiscipline: (d) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, disciplines: [...cat.disciplines, d] } };
  }),
  updateDiscipline: (id, updates) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, disciplines: cat.disciplines.map((d) => d.id === id ? { ...d, ...updates } : d) } };
  }),
  removeDiscipline: (id) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, disciplines: cat.disciplines.filter((d) => d.id !== id) } };
  }),
  addCrossTitle: (ct) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, crossTitles: [...cat.crossTitles, ct] } };
  }),
  removeCrossTitle: (archetypeId, disciplineId) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, crossTitles: cat.crossTitles.filter((ct) => !(ct.archetypeId === archetypeId && ct.disciplineId === disciplineId)) } };
  }),
  addEntanglement: (e) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, entanglements: [...cat.entanglements, e] } };
  }),
  removeEntanglement: (id) => get().updateProject((p) => {
    const cat = ensureBuildCatalog(p);
    return { ...p, buildCatalog: { ...cat, entanglements: cat.entanglements.filter((e) => e.id !== id) } };
  }),

  // Progression tree helpers
  addProgressionTree: (t) => get().updateProject((p) => ({ ...p, progressionTrees: [...p.progressionTrees, t] })),
  updateProgressionTree: (id, updates) => get().updateProject((p) => ({
    ...p, progressionTrees: p.progressionTrees.map((t) => t.id === id ? { ...t, ...updates } : t),
  })),
  removeProgressionTree: (id) => get().updateProject((p) => ({
    ...p, progressionTrees: p.progressionTrees.filter((t) => t.id !== id),
  })),
  addProgressionNode: (treeId, node) => get().updateProject((p) => ({
    ...p, progressionTrees: p.progressionTrees.map((t) =>
      t.id === treeId ? { ...t, nodes: [...t.nodes, node] } : t),
  })),
  updateProgressionNode: (treeId, nodeId, updates) => get().updateProject((p) => ({
    ...p, progressionTrees: p.progressionTrees.map((t) =>
      t.id === treeId ? { ...t, nodes: t.nodes.map((n) => n.id === nodeId ? { ...n, ...updates } : n) } : t),
  })),
  removeProgressionNode: (treeId, nodeId) => get().updateProject((p) => ({
    ...p, progressionTrees: p.progressionTrees.map((t) =>
      t.id === treeId ? { ...t, nodes: t.nodes.filter((n) => n.id !== nodeId) } : t),
  })),

  // Asset helpers
  addAsset: (a) => get().updateProject((p) => ({ ...p, assets: [...p.assets, a] })),
  updateAsset: (id, updates) => get().updateProject((p) => ({
    ...p, assets: p.assets.map((a) => a.id === id ? { ...a, ...updates } : a),
  })),
  removeAsset: (id) => get().updateProject((p) => ({
    ...p,
    assets: p.assets.filter((a) => a.id !== id),
    zones: p.zones.map((z) => ({
      ...z,
      backgroundId: z.backgroundId === id ? undefined : z.backgroundId,
      tilesetId: z.tilesetId === id ? undefined : z.tilesetId,
    })),
    entityPlacements: p.entityPlacements.map((e) => ({
      ...e,
      portraitId: e.portraitId === id ? undefined : e.portraitId,
      spriteId: e.spriteId === id ? undefined : e.spriteId,
    })),
    itemPlacements: p.itemPlacements.map((i) => ({
      ...i,
      iconId: i.iconId === id ? undefined : i.iconId,
    })),
    landmarks: p.landmarks.map((l) => ({
      ...l,
      iconId: l.iconId === id ? undefined : l.iconId,
    })),
  })),

  // Asset pack helpers
  addAssetPack: (pack) => get().updateProject((p) => ({ ...p, assetPacks: [...p.assetPacks, pack] })),
  updateAssetPack: (id, updates) => get().updateProject((p) => ({
    ...p, assetPacks: p.assetPacks.map((pk) => pk.id === id ? { ...pk, ...updates } : pk),
  })),
  removeAssetPack: (id) => get().updateProject((p) => ({
    ...p,
    assetPacks: p.assetPacks.filter((pk) => pk.id !== id),
    assets: p.assets.map((a) => a.packId === id ? { ...a, packId: undefined } : a),
  })),

  // Dialogue helpers
  addDialogue: (d) => get().updateProject((p) => ({ ...p, dialogues: [...p.dialogues, d] })),
  updateDialogue: (id, updates) => get().updateProject((p) => ({
    ...p, dialogues: p.dialogues.map((d) => d.id === id ? { ...d, ...updates } : d),
  })),
  removeDialogue: (id) => get().updateProject((p) => ({
    ...p, dialogues: p.dialogues.filter((d) => d.id !== id),
  })),
  addDialogueNode: (dialogueId, node) => get().updateProject((p) => ({
    ...p, dialogues: p.dialogues.map((d) =>
      d.id === dialogueId ? { ...d, nodes: { ...d.nodes, [node.id]: node } } : d),
  })),
  updateDialogueNode: (dialogueId, nodeId, updates) => get().updateProject((p) => ({
    ...p, dialogues: p.dialogues.map((d) =>
      d.id === dialogueId ? { ...d, nodes: { ...d.nodes, [nodeId]: { ...d.nodes[nodeId], ...updates } } } : d),
  })),
  removeDialogueNode: (dialogueId, nodeId) => get().updateProject((p) => ({
    ...p, dialogues: p.dialogues.map((d) => {
      if (d.id !== dialogueId) return d;
      const { [nodeId]: _, ...rest } = d.nodes;
      return { ...d, nodes: rest };
    }),
  })),
}));
