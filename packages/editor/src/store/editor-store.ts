// editor-store.ts — editor UI state

import { create } from 'zustand';
import type { FidelityReport, ImportFormat } from '@world-forge/export-ai-rpg';
import type { WorldProject, Zone, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor } from '@world-forge/schema';
import { DEFAULT_VIEWPORT } from '../viewport.js';
import type { ViewportState } from '../viewport.js';
import type { HitResult } from '../hit-testing.js';

/** Deep-cloned selection data for clipboard operations. */
export interface ClipboardData {
  zones: Zone[];
  entities: EntityPlacement[];
  landmarks: Landmark[];
  spawns: SpawnPoint[];
  encounters: EncounterAnchor[];
}

export type EditorTool = 'select' | 'zone-paint' | 'connection' | 'entity-place' | 'landmark' | 'spawn' | 'encounter-place';
export type RightTab = 'map' | 'player' | 'builds' | 'trees' | 'dialogue' | 'assets' | 'issues' | 'deps' | 'review' | 'guide' | 'import-summary' | 'diff' | 'objects' | 'presets';
export type BuildsSubTab = 'config' | 'archetypes' | 'backgrounds' | 'traits' | 'disciplines' | 'combos';

/** Transient focus target set by validation click. Panels read and clear it. */
export interface FocusTarget {
  domain: string;
  subPath?: string;
  timestamp: number;
}

/** Multi-select state with typed ID arrays */
export interface SelectionSet {
  zones: string[];
  entities: string[];
  landmarks: string[];
  spawns: string[];
  encounters: string[];
}

const EMPTY_SELECTION: SelectionSet = { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] };

// --- Pure selection helpers (exported for tests & panels) ---

/** Returns the single selected zone ID, or null if 0 or 2+ zones selected */
export function getSelectedZoneId(sel: SelectionSet): string | null {
  return sel.zones.length === 1 ? sel.zones[0] : null;
}

/** Total count of all selected objects */
export function getSelectionCount(sel: SelectionSet): number {
  return sel.zones.length + sel.entities.length + sel.landmarks.length + sel.spawns.length + sel.encounters.length;
}

/** Check if a specific object is in the selection */
export function isSelected(sel: SelectionSet, type: 'zone' | 'entity' | 'landmark' | 'spawn' | 'encounter', id: string): boolean {
  const key = type === 'zone' ? 'zones' : type === 'entity' ? 'entities' : type === 'landmark' ? 'landmarks' : type === 'spawn' ? 'spawns' : 'encounters';
  return sel[key].includes(id);
}

/** Returns the selected connection, or null if none */
export function getSelectedConnection(state: { selectedConnection: { from: string; to: string } | null }): { from: string; to: string } | null {
  return state.selectedConnection;
}

function toggleInArray(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

interface EditorState {
  activeTool: EditorTool;
  rightTab: RightTab;
  buildsSubTab: BuildsSubTab;
  focusTarget: FocusTarget | null;
  gridSnap: boolean;
  snapToObjects: boolean;
  showGrid: boolean;
  showConnections: boolean;
  showEntities: boolean;
  showLandmarks: boolean;
  showSpawns: boolean;
  showBackgrounds: boolean;
  showAmbient: boolean;
  showMinimap: boolean;
  viewport: ViewportState;
  selection: SelectionSet;
  hoveredZoneId: string | null;
  selectedConnection: { from: string; to: string } | null;
  connectionStart: string | null;
  checklistDismissed: boolean;
  hasExported: boolean;
  activeKitId: string | null;

  // Import fidelity tracking
  importFidelity: FidelityReport | null;
  importSourceFormat: ImportFormat | null;
  importSnapshot: WorldProject | null;
  projectBundleSource: 'local' | 'imported' | null;
  setProjectBundleSource: (source: 'local' | 'imported' | null) => void;

  setTool: (tool: EditorTool) => void;
  setRightTab: (tab: RightTab) => void;
  setBuildsSubTab: (tab: BuildsSubTab) => void;
  setFocusTarget: (target: FocusTarget | null) => void;
  setSelection: (sel: SelectionSet) => void;
  clearSelection: () => void;
  selectZone: (id: string, additive: boolean) => void;
  selectEntity: (id: string, additive: boolean) => void;
  selectLandmark: (id: string, additive: boolean) => void;
  selectSpawn: (id: string, additive: boolean) => void;
  selectEncounter: (id: string, additive: boolean) => void;
  selectAll: (set: SelectionSet, additive: boolean) => void;
  /** Backward compat: set single zone selection (used by validation/export navigation) */
  setSelectedZone: (id: string | null) => void;
  selectConnection: (from: string, to: string) => void;
  setHoveredZone: (id: string | null) => void;
  setConnectionStart: (id: string | null) => void;
  toggleSnapToObjects: () => void;
  toggleGrid: () => void;
  toggleConnections: () => void;
  toggleEntities: () => void;
  toggleLandmarks: () => void;
  toggleSpawns: () => void;
  toggleBackgrounds: () => void;
  toggleAmbient: () => void;
  toggleMinimap: () => void;
  setViewport: (vp: Partial<ViewportState>) => void;
  resetViewport: () => void;
  dismissChecklist: () => void;
  markExported: () => void;
  resetChecklist: () => void;
  setActiveKitId: (id: string | null) => void;
  setImportFidelity: (report: FidelityReport, format: ImportFormat) => void;
  clearImportFidelity: () => void;
  setImportSnapshot: (project: WorldProject) => void;
  showSearch: boolean;
  setShowSearch: (show: boolean) => void;

  // Clipboard
  clipboard: ClipboardData | null;
  copySelection: (project: WorldProject) => void;
  getClipboard: () => ClipboardData | null;

  // Per-object visibility (FT-009)
  hiddenIds: Set<string>;
  toggleHidden: (id: string) => void;
  isHidden: (id: string) => boolean;
  showAll: () => void;
  hideSelected: () => void;

  // Performance stats overlay (FT-010)
  showPerfStats: boolean;
  togglePerfStats: () => void;

  // Speed panel (double-right-click command palette)
  showSpeedPanel: boolean;
  speedPanelPosition: { x: number; y: number } | null;
  speedPanelContext: HitResult | null;
  speedPanelEditMode: boolean;
  openSpeedPanel: (x: number, y: number, context: HitResult | null) => void;
  closeSpeedPanel: () => void;
  toggleSpeedPanelEditMode: () => void;
}

/**
 * ED-A-005: one-time warning flag for hidden-ids persistence failures. We
 * surface the first failure to the console so the user has a breadcrumb, then
 * fall silent so a broken localStorage doesn't flood the log on every toggle.
 */
let _warnedHiddenWrite = false;

export const useEditorStore = create<EditorState>((set, get) => ({
  activeTool: 'select',
  rightTab: 'map',
  buildsSubTab: 'config',
  focusTarget: null,
  gridSnap: true,
  snapToObjects: true,
  showGrid: true,
  showConnections: true,
  showEntities: true,
  showLandmarks: true,
  showSpawns: true,
  showBackgrounds: true,
  showAmbient: true,
  showMinimap: true,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  selection: { ...EMPTY_SELECTION },
  hoveredZoneId: null,
  selectedConnection: null,
  connectionStart: null,
  checklistDismissed: false,
  hasExported: false,
  activeKitId: null,
  importFidelity: null,
  importSourceFormat: null,
  importSnapshot: null,
  projectBundleSource: null,

  setTool: (tool) => set({ activeTool: tool, connectionStart: null }),
  setRightTab: (tab) => set({ rightTab: tab }),
  setBuildsSubTab: (tab) => set({ buildsSubTab: tab }),
  setFocusTarget: (target) => set({ focusTarget: target }),

  // Selection actions (all clear selectedConnection for mutual exclusion)
  setSelection: (sel) => set({ selection: sel, selectedConnection: null }),
  clearSelection: () => set({ selection: { ...EMPTY_SELECTION }, selectedConnection: null }),
  selectZone: (id, additive) => set((s) => ({
    selectedConnection: null,
    selection: additive
      ? { ...s.selection, zones: toggleInArray(s.selection.zones, id) }
      : { ...EMPTY_SELECTION, zones: [id] },
  })),
  selectEntity: (id, additive) => set((s) => ({
    selectedConnection: null,
    selection: additive
      ? { ...s.selection, entities: toggleInArray(s.selection.entities, id) }
      : { ...EMPTY_SELECTION, entities: [id] },
  })),
  selectLandmark: (id, additive) => set((s) => ({
    selectedConnection: null,
    selection: additive
      ? { ...s.selection, landmarks: toggleInArray(s.selection.landmarks, id) }
      : { ...EMPTY_SELECTION, landmarks: [id] },
  })),
  selectSpawn: (id, additive) => set((s) => ({
    selectedConnection: null,
    selection: additive
      ? { ...s.selection, spawns: toggleInArray(s.selection.spawns, id) }
      : { ...EMPTY_SELECTION, spawns: [id] },
  })),
  selectEncounter: (id, additive) => set((s) => ({
    selectedConnection: null,
    selection: additive
      ? { ...s.selection, encounters: toggleInArray(s.selection.encounters, id) }
      : { ...EMPTY_SELECTION, encounters: [id] },
  })),
  selectAll: (incoming, additive) => set((s) => ({
    selectedConnection: null,
    selection: additive ? {
      zones: [...new Set([...s.selection.zones, ...incoming.zones])],
      entities: [...new Set([...s.selection.entities, ...incoming.entities])],
      landmarks: [...new Set([...s.selection.landmarks, ...incoming.landmarks])],
      spawns: [...new Set([...s.selection.spawns, ...incoming.spawns])],
      encounters: [...new Set([...s.selection.encounters, ...incoming.encounters])],
    } : incoming,
  })),
  /** Backward compat: replaces selection with single zone (or clears if null) */
  setSelectedZone: (id) => set({ selectedConnection: null, selection: id ? { ...EMPTY_SELECTION, zones: [id] } : { ...EMPTY_SELECTION } }),
  /** Select a connection (clears object selection) */
  selectConnection: (from, to) => set({ selectedConnection: { from, to }, selection: { ...EMPTY_SELECTION } }),

  setHoveredZone: (id) => set({ hoveredZoneId: id }),
  setConnectionStart: (id) => set({ connectionStart: id }),
  toggleSnapToObjects: () => set((s) => ({ snapToObjects: !s.snapToObjects })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleConnections: () => set((s) => ({ showConnections: !s.showConnections })),
  toggleEntities: () => set((s) => ({ showEntities: !s.showEntities })),
  toggleLandmarks: () => set((s) => ({ showLandmarks: !s.showLandmarks })),
  toggleSpawns: () => set((s) => ({ showSpawns: !s.showSpawns })),
  toggleBackgrounds: () => set((s) => ({ showBackgrounds: !s.showBackgrounds })),
  toggleAmbient: () => set((s) => ({ showAmbient: !s.showAmbient })),
  toggleMinimap: () => set((s) => ({ showMinimap: !s.showMinimap })),
  setViewport: (vp) => set((s) => ({ viewport: { ...s.viewport, ...vp } })),
  resetViewport: () => set({ viewport: { ...DEFAULT_VIEWPORT } }),
  dismissChecklist: () => set({ checklistDismissed: true }),
  markExported: () => set({ hasExported: true }),
  resetChecklist: () => set({ checklistDismissed: false, hasExported: false, activeKitId: null, projectBundleSource: null, rightTab: 'guide' }),
  setProjectBundleSource: (source) => set({ projectBundleSource: source }),
  setActiveKitId: (id) => set({ activeKitId: id }),
  setImportFidelity: (report, format) => set({ importFidelity: report, importSourceFormat: format }),
  clearImportFidelity: () => set({ importFidelity: null, importSourceFormat: null, importSnapshot: null }),
  setImportSnapshot: (project) => set({ importSnapshot: project }),
  showSearch: false,
  setShowSearch: (show) => set({ showSearch: show }),

  clipboard: null,
  copySelection: (project) => set((s) => {
    const sel = s.selection;
    const zones = project.zones.filter((z) => sel.zones.includes(z.id)).map((z) => structuredClone(z));
    const entities = project.entityPlacements.filter((e) => sel.entities.includes(e.entityId)).map((e) => structuredClone(e));
    const landmarks = project.landmarks.filter((l) => sel.landmarks.includes(l.id)).map((l) => structuredClone(l));
    const spawns = project.spawnPoints.filter((sp) => sel.spawns.includes(sp.id)).map((sp) => structuredClone(sp));
    const encounters = project.encounterAnchors.filter((enc) => sel.encounters.includes(enc.id)).map((enc) => structuredClone(enc));
    if (zones.length + entities.length + landmarks.length + spawns.length + encounters.length === 0) return {};
    return { clipboard: { zones, entities, landmarks, spawns, encounters } };
  }),
  getClipboard: () => get().clipboard,

  // FT-009: Per-object visibility (persisted to localStorage)
  hiddenIds: (() => {
    try {
      const raw = localStorage.getItem('wf-hidden-ids');
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  })(),
  toggleHidden: (id) => set((s) => {
    const next = new Set(s.hiddenIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    // ED-A-005: Mirror the auto-save pattern — if persistence fails, surface a
    // one-time console.warn but never block the in-memory update. The user can
    // still hide/show this session; they just won't persist across reloads.
    try {
      localStorage.setItem('wf-hidden-ids', JSON.stringify([...next]));
    } catch (err) {
      if (!_warnedHiddenWrite) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[editor] could not persist hidden-ids to localStorage: ${msg}`);
        _warnedHiddenWrite = true;
      }
    }
    return { hiddenIds: next };
  }),
  isHidden: (id) => get().hiddenIds.has(id),
  showAll: () => {
    try { localStorage.removeItem('wf-hidden-ids'); } catch { /* ignore */ }
    set({ hiddenIds: new Set<string>() });
  },
  hideSelected: () => set((s) => {
    const sel = s.selection;
    const ids = [...sel.zones, ...sel.entities, ...sel.landmarks, ...sel.spawns, ...sel.encounters];
    if (ids.length === 0) return {};
    const next = new Set(s.hiddenIds);
    for (const id of ids) next.add(id);
    try { localStorage.setItem('wf-hidden-ids', JSON.stringify([...next])); } catch { /* ignore */ }
    return { hiddenIds: next };
  }),

  // FT-010: Performance stats overlay
  showPerfStats: false,
  togglePerfStats: () => set((s) => ({ showPerfStats: !s.showPerfStats })),

  showSpeedPanel: false,
  speedPanelPosition: null,
  speedPanelContext: null,
  speedPanelEditMode: false,
  openSpeedPanel: (x, y, context) => set({ showSpeedPanel: true, speedPanelPosition: { x, y }, speedPanelContext: context }),
  closeSpeedPanel: () => set({ showSpeedPanel: false, speedPanelPosition: null, speedPanelContext: null, speedPanelEditMode: false }),
  toggleSpeedPanelEditMode: () => set((s) => ({ speedPanelEditMode: !s.speedPanelEditMode })),
}));
