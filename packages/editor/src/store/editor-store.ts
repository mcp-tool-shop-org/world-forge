// editor-store.ts — editor UI state

import { create } from 'zustand';

export type EditorTool = 'select' | 'zone-paint' | 'connection' | 'entity-place' | 'landmark' | 'spawn';
export type RightTab = 'map' | 'player' | 'builds' | 'trees' | 'dialogue' | 'issues' | 'guide';
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
  zoom: number;
  selectedZoneId: string | null;
  hoveredZoneId: string | null;
  selectedEntityId: string | null;
  connectionStart: string | null;
  checklistDismissed: boolean;
  hasExported: boolean;

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
  setZoom: (z: number) => void;
  dismissChecklist: () => void;
  markExported: () => void;
  resetChecklist: () => void;
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
  zoom: 1,
  selectedZoneId: null,
  hoveredZoneId: null,
  selectedEntityId: null,
  connectionStart: null,
  checklistDismissed: false,
  hasExported: false,

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
  setZoom: (z) => set({ zoom: z }),
  dismissChecklist: () => set({ checklistDismissed: true }),
  markExported: () => set({ hasExported: true }),
  resetChecklist: () => set({ checklistDismissed: false, hasExported: false, rightTab: 'guide' }),
}));
