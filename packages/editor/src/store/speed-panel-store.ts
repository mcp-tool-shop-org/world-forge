// speed-panel-store.ts — persisted pinned actions for the Speed Panel

import { create } from 'zustand';

const STORAGE_KEY = 'world-forge-speed-panel-pins';

function loadPins(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePins(pins: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

interface SpeedPanelPinState {
  pinnedIds: string[];
  togglePin: (actionId: string) => void;
}

export const useSpeedPanelPins = create<SpeedPanelPinState>((set) => ({
  pinnedIds: loadPins(),
  togglePin: (actionId) => set((s) => {
    const next = s.pinnedIds.includes(actionId)
      ? s.pinnedIds.filter((id) => id !== actionId)
      : [...s.pinnedIds, actionId];
    savePins(next);
    return { pinnedIds: next };
  }),
}));
