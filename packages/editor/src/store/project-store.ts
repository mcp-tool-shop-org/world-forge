// project-store.ts — WorldProject state with undo/redo

import { create } from 'zustand';
import type {
  WorldProject, Zone, ZoneConnection, District, EntityPlacement, Landmark, SpawnPoint,
  EncounterAnchor, FactionPresence, PressureHotspot,
  PlayerTemplate, BuildCatalogDefinition, ArchetypeDefinition, BackgroundDefinition,
  TraitDefinition, DisciplineDefinition, CrossDisciplineTitle, ClassEntanglement,
  ProgressionTreeDefinition, ProgressionNode,
  DialogueDefinition, DialogueNode, DialogueChoice,
  AssetEntry, AssetPack,
  AuthoringMode,
} from '@world-forge/schema';
import { DEFAULT_MODE } from '@world-forge/schema';
import { duplicateSelected as doDuplicate } from '../duplicate.js';
import { alignSelected as doAlign, distributeSelected as doDistribute, type AlignAxis, type DistributeAxis } from '../layout.js';
import type { ResizeResult } from '../resize-handles.js';
import type { RegionPreset, EncounterPreset } from '../presets/types.js';
import { getModeProfile } from '../mode-profiles.js';

export function createEmptyProject(mode?: AuthoringMode): WorldProject {
  const profile = getModeProfile(mode);
  return {
    id: 'new-project',
    name: 'Untitled World',
    description: '',
    version: '0.1.0',
    genre: 'fantasy',
    tones: ['atmospheric'],
    difficulty: 'beginner',
    narratorTone: '',
    mode: mode ?? DEFAULT_MODE,
    map: { id: 'map-1', name: 'Map', description: '', gridWidth: profile.grid.width, gridHeight: profile.grid.height, tileSize: profile.grid.tileSize },
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

/** Entry in the undo/redo stack: snapshot + human-readable label. */
export interface UndoEntry {
  project: WorldProject;
  label: string;
}

interface ProjectState {
  project: WorldProject;
  dirty: boolean;
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Actions
  loadProject: (p: WorldProject) => void;
  newProject: () => void;
  updateProject: (updater: (p: WorldProject) => WorldProject, label?: string) => void;
  undo: () => void;
  redo: () => void;

  // Undo/redo label accessors
  getUndoLabel: () => string | null;
  getRedoLabel: () => string | null;
  getUndoCount: () => number;
  getRedoCount: () => number;

  // Zone helpers
  addZone: (z: Zone) => void;
  updateZone: (id: string, updates: Partial<Zone>) => void;
  removeZone: (id: string) => void;
  resizeZone: (zoneId: string, result: ResizeResult) => void;

  // Connection helpers
  addConnection: (c: ZoneConnection) => void;
  updateConnection: (fromId: string, toId: string, updates: Partial<Pick<ZoneConnection, 'label' | 'kind' | 'bidirectional' | 'condition'>>) => void;
  removeConnection: (fromId: string, toId: string) => void;

  // District helpers
  addDistrict: (d: District) => void;
  updateDistrict: (id: string, updates: Partial<District>) => void;
  removeDistrict: (id: string) => void;

  // Encounter helpers
  addEncounter: (e: EncounterAnchor) => void;
  updateEncounter: (id: string, updates: Partial<EncounterAnchor>) => void;
  removeEncounter: (id: string) => void;

  // Faction helpers
  addFaction: (f: FactionPresence) => void;
  updateFaction: (factionId: string, updates: Partial<FactionPresence>) => void;
  removeFaction: (factionId: string) => void;

  // Pressure hotspot helpers
  addPressureHotspot: (h: PressureHotspot) => void;
  updatePressureHotspot: (id: string, updates: Partial<PressureHotspot>) => void;
  removePressureHotspot: (id: string) => void;

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
  moveSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }, dx: number, dy: number) => void;
  removeSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }) => void;
  duplicateSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }) => { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] };
  alignSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }, axis: AlignAxis) => void;
  distributeSelected: (selection: { zones: string[]; entities: string[]; landmarks: string[]; spawns: string[]; encounters: string[] }, axis: DistributeAxis) => void;

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

  // Preset apply helpers
  applyRegionPreset: (districtId: string, preset: RegionPreset, mode: 'merge' | 'overwrite') => void;
  createEncounterFromPreset: (zoneId: string, preset: EncounterPreset) => string;

  // Zone merge (FT-008)
  mergeZones: (zoneIds: string[]) => string | null;

  // Bulk entity spawner (FT-015)
  batchPlaceEntities: (config: { role: string; count: number; zoneId: string; pattern: 'grid' | 'random' | 'circle'; spacing: number }) => void;
}

/**
 * Maximum number of undo snapshots retained. When a new snapshot is pushed,
 * the oldest entries beyond this limit are silently discarded (truncated from
 * the front of the stack). Keeping this bounded prevents unbounded memory
 * growth in long editing sessions.
 */
const UNDO_DEPTH_LIMIT = 100;

function ensureBuildCatalog(p: WorldProject): BuildCatalogDefinition {
  return p.buildCatalog ?? {
    statBudget: 10, maxTraits: 3, requiredFlaws: 0,
    archetypes: [], backgrounds: [], traits: [],
    disciplines: [], crossTitles: [], entanglements: [],
  };
}

// ── Auto-save constants ──────────────────────────────────────
const AUTOSAVE_KEY = 'wf-autosave';
const AUTOSAVE_HISTORY_KEY = 'wf-autosave-history';
const AUTOSAVE_MAX_HISTORY = 3;
const AUTOSAVE_INTERVAL_MS = 30_000;
/**
 * ED-A-014: practical per-key localStorage limit. Most browsers cap the entire
 * origin at ~5 MB. A single project pushed past ~4.5 MB is a sign the shape has
 * grown beyond what auto-save can sustain; we skip the write and log once so
 * the failure is observable rather than silent.
 */
const AUTOSAVE_MAX_BYTES = 4.5 * 1024 * 1024;

interface AutoSaveEntry {
  project: WorldProject;
  timestamp: number;
}

/**
 * ED-A-007: last non-quota auto-save error message, exposed so the UI (modal or
 * future toast) can surface persistent failures. `null` when the latest attempt
 * succeeded or hasn't run yet.
 */
let _lastAutoSaveError: string | null = null;

/** Accessor for the last auto-save error (ED-A-007). */
export function getLastAutoSaveError(): string | null {
  return _lastAutoSaveError;
}

/** Clear the last auto-save error — call after the user acknowledges it. */
export function clearLastAutoSaveError(): void {
  _lastAutoSaveError = null;
}

/**
 * ED-B-008: tracks whether the most recent auto-save attempt was rejected by
 * the oversize guard. `true` means the project is too large for localStorage
 * and auto-save is currently suspended.
 */
let _oversize = false;
/**
 * ED-B-008: size (bytes) of the last successful serialization attempt. Useful
 * for surfacing "2.1 MB of 4.5 MB" or "4.8 MB — over limit" hints.
 */
let _lastSerializedBytes = 0;

/** ED-B-008: Auto-save health snapshot for the UI banner. */
export interface AutoSaveHealth {
  /** Last non-null error message, or null if the latest attempt was fine. */
  lastError: string | null;
  /** True when the oversize guard is actively suppressing auto-save. */
  oversize: boolean;
  /** Size of the last serialized payload (bytes). 0 if no attempt has run. */
  lastBytes: number;
  /** Fixed upper bound — the oversize threshold. */
  limitBytes: number;
}

/** ED-B-008: Snapshot auto-save health. Safe to call every render. */
export function getAutoSaveHealth(): AutoSaveHealth {
  return {
    lastError: _lastAutoSaveError,
    oversize: _oversize,
    lastBytes: _lastSerializedBytes,
    limitBytes: AUTOSAVE_MAX_BYTES,
  };
}

// ED-A-007 + ED-A-014: track single-emission console warnings so the log isn't
// flooded across 30s tick cycles.
let _warnedQuota = false;
let _warnedOversize = false;

/** Check whether recoverable auto-save data exists in localStorage. */
export function hasAutoSaveRecovery(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const entry: AutoSaveEntry = JSON.parse(raw);
    return entry != null && entry.project != null && typeof entry.timestamp === 'number';
  } catch {
    return false;
  }
}

/** Load the most recent auto-saved project (or null if none). */
export function recoverAutoSave(): WorldProject | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const entry: AutoSaveEntry = JSON.parse(raw);
    return entry?.project ?? null;
  } catch {
    return null;
  }
}

/** Remove all auto-save data from localStorage. */
export function clearAutoSave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
    localStorage.removeItem(AUTOSAVE_HISTORY_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Save the current project to localStorage auto-save slot.
 *
 * ED-A-007: Quota-exceeded errors are surfaced via `_lastAutoSaveError` AND a
 * one-time console.warn (so we don't flood the console on every 30s tick).
 * ED-A-014: If the serialized project size exceeds the practical per-origin
 * limit, we skip the setItem call entirely (and warn once).
 */
function writeAutoSave(project: WorldProject): void {
  const now = Date.now();
  const entry: AutoSaveEntry = { project, timestamp: now };
  let serialized: string;
  try {
    serialized = JSON.stringify(entry);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _lastAutoSaveError = `Auto-save skipped: could not serialize project (${msg}).`;
    return;
  }

  _lastSerializedBytes = serialized.length;

  // ED-A-014: oversize guard — don't even attempt the write. localStorage would
  // reject it with QuotaExceededError and we'd lose the history entry anyway.
  if (serialized.length > AUTOSAVE_MAX_BYTES) {
    if (!_warnedOversize) {
      console.warn(
        `[auto-save] project exceeds ${Math.round(AUTOSAVE_MAX_BYTES / 1024 / 1024)} MB ` +
        `(${Math.round(serialized.length / 1024 / 1024 * 10) / 10} MB); skipping auto-save. ` +
        `Use Export Project Bundle to preserve work.`,
      );
      _warnedOversize = true;
    }
    _lastAutoSaveError = 'Auto-save skipped: project is too large for local storage.';
    _oversize = true;
    return;
  }

  // ED-B-001: Transactional write. Snapshot the prior values of BOTH keys before
  // touching anything, so if either setItem throws (quota / disabled storage)
  // we can roll the pair back to a consistent state. Otherwise the project
  // could land while history stays stale — the user recovers a snapshot whose
  // undo stack doesn't match its canvas.
  let priorProject: string | null = null;
  let priorHistoryRaw: string | null = null;
  try {
    priorProject = localStorage.getItem(AUTOSAVE_KEY);
    priorHistoryRaw = localStorage.getItem(AUTOSAVE_HISTORY_KEY);
  } catch { /* ignore — we'll fail on the write below with a better message */ }

  // Pre-compute the new history payload up front so the second write is just
  // a string setItem with a known size.
  let history: AutoSaveEntry[] = [];
  if (priorHistoryRaw) {
    try {
      const parsed = JSON.parse(priorHistoryRaw);
      if (Array.isArray(parsed)) history = parsed;
    } catch { /* ignore malformed prior history */ }
  }
  history.push(entry);
  if (history.length > AUTOSAVE_MAX_HISTORY) {
    history = history.slice(history.length - AUTOSAVE_MAX_HISTORY);
  }
  let serializedHistory: string;
  try {
    serializedHistory = JSON.stringify(history);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    _lastAutoSaveError = `Auto-save skipped — could not serialize undo history (${msg}). Your canvas is safe; use File → Export Project Bundle to back up.`;
    return;
  }

  const rollbackProject = () => {
    try {
      if (priorProject != null) localStorage.setItem(AUTOSAVE_KEY, priorProject);
      else localStorage.removeItem(AUTOSAVE_KEY);
    } catch { /* best-effort — if rollback itself fails, we already reported the first failure */ }
  };

  // 1. Project write
  try {
    localStorage.setItem(AUTOSAVE_KEY, serialized);
  } catch (err) {
    surfaceAutoSaveFailure(err, 'project snapshot');
    return;
  }

  // 2. History write — on failure, roll back the project so both keys stay in sync.
  try {
    localStorage.setItem(AUTOSAVE_HISTORY_KEY, serializedHistory);
  } catch (err) {
    rollbackProject();
    surfaceAutoSaveFailure(err, 'undo history', /* afterRollback */ true);
    return;
  }

  // Success: clear prior error + reset warn flags so we'll warn again if the
  // user hits the same condition later.
  _lastAutoSaveError = null;
  _warnedQuota = false;
  _warnedOversize = false;
  _oversize = false;
}

/**
 * ED-B-001: shared error surface for the two-phase auto-save. `stage` names the
 * specific write that failed ("project snapshot" vs "undo history") so the
 * user-facing message can be specific rather than "something failed." When
 * `afterRollback` is true we add a line confirming the previous save is still
 * intact — that's the user's safety net after a mid-transaction failure.
 */
function surfaceAutoSaveFailure(err: unknown, stage: string, afterRollback = false): void {
  const msg = err instanceof Error ? err.message : String(err);
  const isQuota =
    err instanceof Error &&
    (err.name === 'QuotaExceededError' || /quota/i.test(err.message));
  if (isQuota && !_warnedQuota) {
    console.warn(
      `[auto-save] localStorage quota exceeded while writing ${stage}; ` +
      'auto-save suspended until space is freed. ' +
      'Use File → Export Project Bundle to preserve your work.',
    );
    _warnedQuota = true;
  } else if (!isQuota) {
    console.warn(`[auto-save] localStorage write failed on ${stage}: ${msg}`);
  }
  const rollbackNote = afterRollback
    ? ' Your previous auto-save is still intact.'
    : '';
  _lastAutoSaveError = isQuota
    ? `Auto-save paused — local storage is full (${stage}). Free space or export the project to keep saving.${rollbackNote}`
    : `Auto-save failed on ${stage}: ${msg}.${rollbackNote}`;
}

/**
 * ED-A-004: `_autoSaveTimer` is module-scoped so `startAutoSave` /
 * `stopAutoSave` can be called from anywhere (App mount, tests, teardown).
 *
 * Lifecycle contract:
 *   - Exactly one interval per process — `startAutoSave` is idempotent.
 *   - `stopAutoSave` MUST be called on app teardown (or between tests) to
 *     release the interval handle.
 *   - Calling `loadProject` / `newProject` resets the in-memory project but
 *     does NOT touch the timer; callers that reinitialize the store in-place
 *     should pair that with `stopAutoSave()` + `startAutoSave()` if they want
 *     a clean tick cadence.
 */
let _autoSaveTimer: ReturnType<typeof setInterval> | null = null;

/** Start the auto-save interval. Safe to call multiple times. */
export function startAutoSave(): void {
  if (_autoSaveTimer != null) return;
  _autoSaveTimer = setInterval(() => {
    const state = useProjectStore.getState();
    if (state.dirty) {
      writeAutoSave(state.project);
    }
  }, AUTOSAVE_INTERVAL_MS);
}

/** Stop the auto-save interval. Also used as the store/app teardown hook (ED-A-004). */
export function stopAutoSave(): void {
  if (_autoSaveTimer != null) {
    clearInterval(_autoSaveTimer);
    _autoSaveTimer = null;
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createEmptyProject(),
  dirty: false,
  undoStack: [],
  redoStack: [],

  loadProject: (p) => set({
    project: { ...p, assets: p.assets ?? [], assetPacks: p.assetPacks ?? [] },
    dirty: false, undoStack: [], redoStack: [],
  }),
  newProject: () => set({ project: createEmptyProject(), dirty: false, undoStack: [], redoStack: [] }),

  updateProject: (updater, label) => {
    const { project, undoStack } = get();
    const entry: UndoEntry = { project, label: label ?? 'Edit' };
    const newStack = [...undoStack.slice(-UNDO_DEPTH_LIMIT), entry];
    set({ project: updater(project), dirty: true, undoStack: newStack, redoStack: [] });
  },

  undo: () => {
    const { project, undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    // The current project becomes a redo entry; use the label from the undo entry being restored
    const redoEntry: UndoEntry = { project, label: prev.label };
    set({
      project: prev.project,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, redoEntry],
      dirty: true,
    });
  },

  redo: () => {
    const { project, undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    const undoEntry: UndoEntry = { project, label: next.label };
    set({
      project: next.project,
      undoStack: [...undoStack, undoEntry],
      redoStack: redoStack.slice(0, -1),
      dirty: true,
    });
  },

  // Undo/redo label accessors
  getUndoLabel: () => {
    const { undoStack } = get();
    return undoStack.length > 0 ? undoStack[undoStack.length - 1].label : null;
  },
  getRedoLabel: () => {
    const { redoStack } = get();
    return redoStack.length > 0 ? redoStack[redoStack.length - 1].label : null;
  },
  getUndoCount: () => get().undoStack.length,
  getRedoCount: () => get().redoStack.length,

  // Zone helpers
  addZone: (z) => get().updateProject((p) => ({ ...p, zones: [...p.zones, z] }), 'Add zone'),
  updateZone: (id, updates) => get().updateProject((p) => ({
    ...p, zones: p.zones.map((z) => z.id === id ? { ...z, ...updates } : z),
  }), 'Update zone'),
  removeZone: (id) => get().updateProject((p) => ({
    ...p,
    zones: p.zones.filter((z) => z.id !== id),
    connections: p.connections.filter((c) => c.fromZoneId !== id && c.toZoneId !== id),
  }), 'Delete zone'),
  resizeZone: (zoneId, result) => get().updateProject((p) => ({
    ...p, zones: p.zones.map((z) => z.id === zoneId ? { ...z, ...result } : z),
  }), 'Resize zone'),

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
  }), 'Add connection'),
  updateConnection: (fromId, toId, updates) => get().updateProject((p) => ({
    ...p, connections: p.connections.map((c) =>
      c.fromZoneId === fromId && c.toZoneId === toId ? { ...c, ...updates } : c),
  }), 'Update connection'),
  removeConnection: (fromId, toId) => get().updateProject((p) => ({
    ...p, connections: p.connections.filter((c) => !(c.fromZoneId === fromId && c.toZoneId === toId)),
  }), 'Delete connection'),

  // District helpers
  addDistrict: (d) => get().updateProject((p) => ({ ...p, districts: [...p.districts, d] }), 'Add district'),
  updateDistrict: (id, updates) => get().updateProject((p) => ({
    ...p, districts: p.districts.map((d) => d.id === id ? { ...d, ...updates } : d),
  }), 'Update district'),
  removeDistrict: (id) => get().updateProject((p) => ({
    ...p,
    districts: p.districts.filter((d) => d.id !== id),
    zones: p.zones.map((z) => z.parentDistrictId === id ? { ...z, parentDistrictId: undefined } : z),
  }), 'Delete district'),

  // Encounter helpers
  addEncounter: (e) => get().updateProject((p) => ({ ...p, encounterAnchors: [...p.encounterAnchors, e] }), 'Add encounter'),
  updateEncounter: (id, updates) => get().updateProject((p) => ({
    ...p, encounterAnchors: p.encounterAnchors.map((e) => e.id === id ? { ...e, ...updates } : e),
  }), 'Update encounter'),
  removeEncounter: (id) => get().updateProject((p) => ({
    ...p, encounterAnchors: p.encounterAnchors.filter((e) => e.id !== id),
  }), 'Delete encounter'),

  // Faction helpers
  addFaction: (f) => get().updateProject((p) => ({ ...p, factionPresences: [...p.factionPresences, f] })),
  updateFaction: (factionId, updates) => get().updateProject((p) => ({
    ...p, factionPresences: p.factionPresences.map((f) => f.factionId === factionId ? { ...f, ...updates } : f),
  })),
  removeFaction: (factionId) => get().updateProject((p) => ({
    ...p, factionPresences: p.factionPresences.filter((f) => f.factionId !== factionId),
  })),

  // Pressure hotspot helpers
  addPressureHotspot: (h) => get().updateProject((p) => ({ ...p, pressureHotspots: [...p.pressureHotspots, h] })),
  updatePressureHotspot: (id, updates) => get().updateProject((p) => ({
    ...p, pressureHotspots: p.pressureHotspots.map((h) => h.id === id ? { ...h, ...updates } : h),
  })),
  removePressureHotspot: (id) => get().updateProject((p) => ({
    ...p, pressureHotspots: p.pressureHotspots.filter((h) => h.id !== id),
  })),

  // Entity helpers
  addEntity: (e) => get().updateProject((p) => ({ ...p, entityPlacements: [...p.entityPlacements, e] }), 'Add entity'),
  updateEntity: (entityId, updates) => get().updateProject((p) => ({
    ...p, entityPlacements: p.entityPlacements.map((e) => e.entityId === entityId ? { ...e, ...updates } : e),
  }), 'Update entity'),
  removeEntity: (entityId) => get().updateProject((p) => ({
    ...p, entityPlacements: p.entityPlacements.filter((e) => e.entityId !== entityId),
  }), 'Delete entity'),

  // Landmark helpers
  addLandmark: (l) => get().updateProject((p) => ({ ...p, landmarks: [...p.landmarks, l] }), 'Add landmark'),
  updateLandmark: (id, updates) => get().updateProject((p) => ({
    ...p, landmarks: p.landmarks.map((l) => l.id === id ? { ...l, ...updates } : l),
  }), 'Update landmark'),
  removeLandmark: (id) => get().updateProject((p) => ({
    ...p, landmarks: p.landmarks.filter((l) => l.id !== id),
  }), 'Delete landmark'),

  // Spawn helpers
  addSpawnPoint: (s) => get().updateProject((p) => ({ ...p, spawnPoints: [...p.spawnPoints, s] }), 'Add spawn point'),
  updateSpawnPoint: (id, updates) => get().updateProject((p) => ({
    ...p, spawnPoints: p.spawnPoints.map((s) => s.id === id ? { ...s, ...updates } : s),
  }), 'Update spawn point'),
  removeSpawnPoint: (id) => get().updateProject((p) => ({
    ...p, spawnPoints: p.spawnPoints.filter((s) => s.id !== id),
  }), 'Delete spawn point'),

  // Batch helpers — single updateProject call for atomic undo
  moveSelected: (sel, dx, dy) => {
    const count = sel.zones.length + sel.entities.length + sel.landmarks.length + sel.spawns.length + sel.encounters.length;
    const label = `Move ${count} ${count === 1 ? 'object' : 'objects'}`;
    get().updateProject((p) => {
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
    }, label);
  },
  removeSelected: (sel) => {
    const count = sel.zones.length + sel.entities.length + sel.landmarks.length + sel.spawns.length + sel.encounters.length;
    const label = `Delete ${count} ${count === 1 ? 'object' : 'objects'}`;
    get().updateProject((p) => {
      const zSet = new Set(sel.zones);
      const eSet = new Set(sel.entities);
      const lSet = new Set(sel.landmarks);
      const sSet = new Set(sel.spawns);
      const encSet = new Set(sel.encounters);
      return {
        ...p,
        zones: p.zones.filter((z) => !zSet.has(z.id)),
        connections: p.connections.filter((c) => !zSet.has(c.fromZoneId) && !zSet.has(c.toZoneId)),
        districts: p.districts.map((d) => ({ ...d, zoneIds: d.zoneIds.filter((zid) => !zSet.has(zid)) })),
        entityPlacements: p.entityPlacements.filter((e) => !eSet.has(e.entityId) && !zSet.has(e.zoneId)),
        landmarks: p.landmarks.filter((l) => !lSet.has(l.id) && !zSet.has(l.zoneId)),
        spawnPoints: p.spawnPoints.filter((s) => !sSet.has(s.id) && !zSet.has(s.zoneId)),
        encounterAnchors: p.encounterAnchors.filter((e) => !encSet.has(e.id) && !zSet.has(e.zoneId)),
      };
    }, label);
  },
  duplicateSelected: (sel) => {
    const { project } = get();
    const { project: newProject, newSelection } = doDuplicate(project, sel);
    if (newProject === project) return { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] };
    const count = sel.zones.length + sel.entities.length + sel.landmarks.length + sel.spawns.length + sel.encounters.length;
    const label = `Duplicate ${count} ${count === 1 ? 'object' : 'objects'}`;
    get().updateProject(() => newProject, label);
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

  // ── Preset apply helpers ──────────────────────────────────────

  applyRegionPreset: (districtId, preset, mode) => get().updateProject((p) => {
    const district = p.districts.find((d) => d.id === districtId);
    if (!district) {
      console.warn(`applyRegionPreset: district "${districtId}" not found in project — preset was not applied.`);
      return p;
    }

    const isMerge = mode === 'merge';

    // Update district fields
    const updatedDistrict = { ...district };

    // Tags: merge appends unique, overwrite replaces
    if (isMerge) {
      const combined = new Set([...district.tags, ...preset.regionTags]);
      updatedDistrict.tags = [...combined];
    } else {
      updatedDistrict.tags = [...preset.regionTags];
    }

    // Controlling faction: merge only fills if empty
    if (!isMerge || !district.controllingFaction) {
      updatedDistrict.controllingFaction = preset.controllingFaction;
    }

    // Metrics: merge only fills default (0) values, overwrite replaces all
    const dm = district.baseMetrics;
    updatedDistrict.baseMetrics = {
      commerce: (!isMerge || dm.commerce === 0) && preset.baseMetrics.commerce != null ? preset.baseMetrics.commerce : dm.commerce,
      morale: (!isMerge || dm.morale === 0) && preset.baseMetrics.morale != null ? preset.baseMetrics.morale : dm.morale,
      safety: (!isMerge || dm.safety === 0) && preset.baseMetrics.safety != null ? preset.baseMetrics.safety : dm.safety,
      stability: (!isMerge || dm.stability === 0) && preset.baseMetrics.stability != null ? preset.baseMetrics.stability : dm.stability,
    };

    // Economy profile: merge only fills if categories/defaults are empty
    if (preset.economyProfile) {
      const existing = district.economyProfile;
      if (!isMerge) {
        updatedDistrict.economyProfile = {
          supplyCategories: preset.economyProfile.supplyCategories ?? existing.supplyCategories,
          scarcityDefaults: preset.economyProfile.scarcityDefaults ?? existing.scarcityDefaults,
        };
      } else {
        updatedDistrict.economyProfile = {
          supplyCategories: existing.supplyCategories.length === 0 && preset.economyProfile.supplyCategories
            ? preset.economyProfile.supplyCategories
            : existing.supplyCategories,
          scarcityDefaults: Object.keys(existing.scarcityDefaults).length === 0 && preset.economyProfile.scarcityDefaults
            ? preset.economyProfile.scarcityDefaults
            : existing.scarcityDefaults,
        };
      }
    }

    const districts = p.districts.map((d) => d.id === districtId ? updatedDistrict : d);

    // Faction presences: add new factions that don't already exist for this district
    let factionPresences = [...p.factionPresences];
    for (const fp of preset.factionPresences) {
      const exists = factionPresences.some(
        (f) => f.factionId === fp.factionId && f.districtIds.includes(districtId),
      );
      if (!exists) {
        // Check if faction already exists elsewhere — extend districtIds
        const existing = factionPresences.find((f) => f.factionId === fp.factionId);
        if (existing) {
          factionPresences = factionPresences.map((f) =>
            f.factionId === fp.factionId
              ? { ...f, districtIds: [...f.districtIds, districtId] }
              : f,
          );
        } else {
          factionPresences.push({
            factionId: fp.factionId,
            districtIds: [districtId],
            influence: fp.influence,
            alertLevel: fp.alertLevel,
            patrolRoutes: fp.patrolRoutes,
          });
        }
      }
    }

    // Pressure hotspots: add one per district zone (first zone only to avoid spam)
    let pressureHotspots = [...p.pressureHotspots];
    for (const ph of preset.pressureHotspots) {
      // Place in first zone of district that doesn't already have this pressure type
      const targetZone = district.zoneIds.find(
        (zid) => !pressureHotspots.some((h) => h.zoneId === zid && h.pressureType === ph.pressureType),
      );
      if (targetZone) {
        pressureHotspots.push({
          id: `hotspot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          zoneId: targetZone,
          pressureType: ph.pressureType,
          baseProbability: ph.baseProbability,
          tags: [...ph.tags],
        });
      }
    }

    return { ...p, districts, factionPresences, pressureHotspots };
  }),

  createEncounterFromPreset: (zoneId, preset) => {
    const id = `enc-${Date.now()}`;
    get().updateProject((p) => ({
      ...p,
      encounterAnchors: [...p.encounterAnchors, {
        id,
        zoneId,
        encounterType: preset.encounterType,
        enemyIds: [...preset.enemyIds],
        probability: preset.probability,
        cooldownTurns: preset.cooldownTurns,
        tags: [...preset.encounterTags],
      }],
    }));
    return id;
  },

  // ── FT-008: Zone Merge ─────────────────────────────────────────
  mergeZones: (zoneIds) => {
    if (zoneIds.length < 2) return null;
    const { project } = get();
    const zones = project.zones.filter((z) => zoneIds.includes(z.id));
    if (zones.length < 2) return null;

    const mergedId = `zone-merged-${Date.now()}`;
    const idSet = new Set(zoneIds);

    // Compute bounding box
    const minX = Math.min(...zones.map((z) => z.gridX));
    const minY = Math.min(...zones.map((z) => z.gridY));
    const maxX = Math.max(...zones.map((z) => z.gridX + z.gridWidth));
    const maxY = Math.max(...zones.map((z) => z.gridY + z.gridHeight));

    // Merge tags, hazards, interactables
    const allTags = [...new Set(zones.flatMap((z) => z.tags))];
    const allHazards = [...new Set(zones.flatMap((z) => z.hazards))];
    const allInteractables = zones.flatMap((z) => z.interactables);

    // External neighbors (not in merge set)
    const externalNeighbors = [...new Set(zones.flatMap((z) => z.neighbors).filter((n) => !idSet.has(n)))];

    const mergedZone: Zone = {
      id: mergedId,
      name: `Merged (${zones.map((z) => z.name).join(' + ')})`,
      description: zones.map((z) => z.description).filter(Boolean).join(' '),
      tags: allTags,
      gridX: minX,
      gridY: minY,
      gridWidth: maxX - minX,
      gridHeight: maxY - minY,
      neighbors: externalNeighbors,
      exits: zones.flatMap((z) => z.exits.filter((e) => !idSet.has(e.targetZoneId))),
      light: Math.round(zones.reduce((s, z) => s + z.light, 0) / zones.length),
      noise: Math.round(zones.reduce((s, z) => s + z.noise, 0) / zones.length),
      hazards: allHazards,
      interactables: allInteractables,
      parentDistrictId: zones.find((z) => z.parentDistrictId)?.parentDistrictId,
    };

    get().updateProject((p) => {
      // Remove old zones, add merged
      const newZones = [...p.zones.filter((z) => !idSet.has(z.id)), mergedZone];

      // Reassign entities, landmarks, spawns, encounters
      const entityPlacements = p.entityPlacements.map((e) =>
        idSet.has(e.zoneId) ? { ...e, zoneId: mergedId } : e);
      const landmarks = p.landmarks.map((l) =>
        idSet.has(l.zoneId) ? { ...l, zoneId: mergedId } : l);
      const spawnPoints = p.spawnPoints.map((s) =>
        idSet.has(s.zoneId) ? { ...s, zoneId: mergedId } : s);
      const encounterAnchors = p.encounterAnchors.map((e) =>
        idSet.has(e.zoneId) ? { ...e, zoneId: mergedId } : e);

      // Remove internal connections, repoint external ones
      const connections = p.connections
        .filter((c) => !(idSet.has(c.fromZoneId) && idSet.has(c.toZoneId)))
        .map((c) => ({
          ...c,
          fromZoneId: idSet.has(c.fromZoneId) ? mergedId : c.fromZoneId,
          toZoneId: idSet.has(c.toZoneId) ? mergedId : c.toZoneId,
        }))
        // Deduplicate connections that now point to same pair
        .filter((c, i, arr) => arr.findIndex((x) => x.fromZoneId === c.fromZoneId && x.toZoneId === c.toZoneId) === i);

      // Update districts
      const districts = p.districts.map((d) => {
        const hasOld = d.zoneIds.some((zid) => idSet.has(zid));
        if (!hasOld) return d;
        const filtered = d.zoneIds.filter((zid) => !idSet.has(zid));
        return { ...d, zoneIds: [...filtered, mergedId] };
      });

      return { ...p, zones: newZones, entityPlacements, landmarks, spawnPoints, encounterAnchors, connections, districts };
    }, `Merge ${zoneIds.length} zones`);

    return mergedId;
  },

  // ── FT-015: Bulk Entity Spawner ────────────────────────────────
  batchPlaceEntities: (config) => {
    const { project } = get();
    const zone = project.zones.find((z) => z.id === config.zoneId);
    if (!zone) return;

    const entities: EntityPlacement[] = [];
    for (let i = 0; i < config.count; i++) {
      let gx = zone.gridX;
      let gy = zone.gridY;

      if (config.pattern === 'grid') {
        const cols = Math.max(1, Math.floor(zone.gridWidth / Math.max(1, config.spacing)));
        const col = i % cols;
        const row = Math.floor(i / cols);
        gx = zone.gridX + col * config.spacing;
        gy = zone.gridY + row * config.spacing;
      } else if (config.pattern === 'random') {
        gx = zone.gridX + Math.floor(Math.random() * zone.gridWidth);
        gy = zone.gridY + Math.floor(Math.random() * zone.gridHeight);
      } else if (config.pattern === 'circle') {
        const cx = zone.gridX + zone.gridWidth / 2;
        const cy = zone.gridY + zone.gridHeight / 2;
        const radius = Math.min(zone.gridWidth, zone.gridHeight) / 2 - 1;
        const angle = (2 * Math.PI * i) / config.count;
        gx = Math.round(cx + radius * Math.cos(angle));
        gy = Math.round(cy + radius * Math.sin(angle));
      }

      entities.push({
        entityId: `entity-batch-${Date.now()}-${i}`,
        name: `${config.role} ${i + 1}`,
        zoneId: config.zoneId,
        gridX: gx,
        gridY: gy,
        role: config.role as EntityPlacement['role'],
      });
    }

    get().updateProject((p) => ({
      ...p,
      entityPlacements: [...p.entityPlacements, ...entities],
    }), `Place ${config.count} entities`);
  },
}));
