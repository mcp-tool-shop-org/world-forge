// editor-store.ts — editor UI state

import { create } from 'zustand';
import type { FidelityReport, ImportFormat } from '@world-forge/export-ai-rpg';
import type { WorldProject } from '@world-forge/schema';
import { DEFAULT_VIEWPORT } from '../viewport.js';
import type { ViewportState } from '../viewport.js';
import type { HitResult } from '../hit-testing.js';

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

  // Speed panel (double-right-click command palette)
  showSpeedPanel: boolean;
  speedPanelPosition: { x: number; y: number } | null;
  speedPanelContext: HitResult | null;
  speedPanelEditMode: boolean;
  openSpeedPanel: (x: number, y: number, context: HitResult | null) => void;
  closeSpeedPanel: () => void;
  toggleSpeedPanelEditMode: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
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

  showSpeedPanel: false,
  speedPanelPosition: null,
  speedPanelContext: null,
  speedPanelEditMode: false,
  openSpeedPanel: (x, y, context) => set({ showSpeedPanel: true, speedPanelPosition: { x, y }, speedPanelContext: context }),
  closeSpeedPanel: () => set({ showSpeedPanel: false, speedPanelPosition: null, speedPanelContext: null, speedPanelEditMode: false }),
  toggleSpeedPanelEditMode: () => set((s) => ({ speedPanelEditMode: !s.speedPanelEditMode })),
}));
