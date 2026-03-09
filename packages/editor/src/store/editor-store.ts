// editor-store.ts — editor UI state

import { create } from 'zustand';
import type { FidelityReport, ImportFormat } from '@world-forge/export-ai-rpg';
import type { WorldProject } from '@world-forge/schema';
import { DEFAULT_VIEWPORT } from '../viewport.js';
import type { ViewportState } from '../viewport.js';

export type EditorTool = 'select' | 'zone-paint' | 'connection' | 'entity-place' | 'landmark' | 'spawn';
export type RightTab = 'map' | 'player' | 'builds' | 'trees' | 'dialogue' | 'assets' | 'issues' | 'guide' | 'import-summary' | 'diff';
export type BuildsSubTab = 'config' | 'archetypes' | 'backgrounds' | 'traits' | 'disciplines' | 'combos';

/** Transient focus target set by validation click. Panels read and clear it. */
export interface FocusTarget {
  domain: string;
  subPath?: string;
  timestamp: number;
}

interface EditorState {
  activeTool: EditorTool;
  rightTab: RightTab;
  buildsSubTab: BuildsSubTab;
  focusTarget: FocusTarget | null;
  gridSnap: boolean;
  showGrid: boolean;
  showConnections: boolean;
  showEntities: boolean;
  showLandmarks: boolean;
  showSpawns: boolean;
  showBackgrounds: boolean;
  showAmbient: boolean;
  viewport: ViewportState;
  selectedZoneId: string | null;
  hoveredZoneId: string | null;
  selectedEntityId: string | null;
  connectionStart: string | null;
  checklistDismissed: boolean;
  hasExported: boolean;

  // Import fidelity tracking
  importFidelity: FidelityReport | null;
  importSourceFormat: ImportFormat | null;
  importSnapshot: WorldProject | null;

  setTool: (tool: EditorTool) => void;
  setRightTab: (tab: RightTab) => void;
  setBuildsSubTab: (tab: BuildsSubTab) => void;
  setFocusTarget: (target: FocusTarget | null) => void;
  setSelectedZone: (id: string | null) => void;
  setHoveredZone: (id: string | null) => void;
  setSelectedEntity: (id: string | null) => void;
  setConnectionStart: (id: string | null) => void;
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
  setImportFidelity: (report: FidelityReport, format: ImportFormat) => void;
  clearImportFidelity: () => void;
  setImportSnapshot: (project: WorldProject) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  rightTab: 'map',
  buildsSubTab: 'config',
  focusTarget: null,
  gridSnap: true,
  showGrid: true,
  showConnections: true,
  showEntities: true,
  showLandmarks: true,
  showSpawns: true,
  showBackgrounds: true,
  showAmbient: true,
  viewport: { panX: 0, panY: 0, zoom: 1 },
  selectedZoneId: null,
  hoveredZoneId: null,
  selectedEntityId: null,
  connectionStart: null,
  checklistDismissed: false,
  hasExported: false,
  importFidelity: null,
  importSourceFormat: null,
  importSnapshot: null,

  setTool: (tool) => set({ activeTool: tool, connectionStart: null }),
  setRightTab: (tab) => set({ rightTab: tab }),
  setBuildsSubTab: (tab) => set({ buildsSubTab: tab }),
  setFocusTarget: (target) => set({ focusTarget: target }),
  setSelectedZone: (id) => set({ selectedZoneId: id }),
  setHoveredZone: (id) => set({ hoveredZoneId: id }),
  setSelectedEntity: (id) => set({ selectedEntityId: id }),
  setConnectionStart: (id) => set({ connectionStart: id }),
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
  resetChecklist: () => set({ checklistDismissed: false, hasExported: false, rightTab: 'guide' }),
  setImportFidelity: (report, format) => set({ importFidelity: report, importSourceFormat: format }),
  clearImportFidelity: () => set({ importFidelity: null, importSourceFormat: null, importSnapshot: null }),
  setImportSnapshot: (project) => set({ importSnapshot: project }),
}));
