// editor-store.ts — editor UI state

import { create } from 'zustand';

export type EditorTool = 'select' | 'zone-paint' | 'connection' | 'entity-place' | 'landmark' | 'spawn';

interface EditorState {
  activeTool: EditorTool;
  gridSnap: boolean;
  showGrid: boolean;
  showConnections: boolean;
  showEntities: boolean;
  zoom: number;
  selectedZoneId: string | null;
  hoveredZoneId: string | null;
  selectedEntityId: string | null;
  connectionStart: string | null;

  setTool: (tool: EditorTool) => void;
  setSelectedZone: (id: string | null) => void;
  setHoveredZone: (id: string | null) => void;
  setSelectedEntity: (id: string | null) => void;
  setConnectionStart: (id: string | null) => void;
  toggleGrid: () => void;
  toggleConnections: () => void;
  toggleEntities: () => void;
  setZoom: (z: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeTool: 'select',
  gridSnap: true,
  showGrid: true,
  showConnections: true,
  showEntities: true,
  zoom: 1,
  selectedZoneId: null,
  hoveredZoneId: null,
  selectedEntityId: null,
  connectionStart: null,

  setTool: (tool) => set({ activeTool: tool, connectionStart: null }),
  setSelectedZone: (id) => set({ selectedZoneId: id }),
  setHoveredZone: (id) => set({ hoveredZoneId: id }),
  setSelectedEntity: (id) => set({ selectedEntityId: id }),
  setConnectionStart: (id) => set({ connectionStart: id }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleConnections: () => set((s) => ({ showConnections: !s.showConnections })),
  toggleEntities: () => set((s) => ({ showEntities: !s.showEntities })),
  setZoom: (z) => set({ zoom: z }),
}));
