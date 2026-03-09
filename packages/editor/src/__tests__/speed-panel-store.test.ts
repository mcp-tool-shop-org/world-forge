import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage before importing the store
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
});

// Dynamic import so mock is in place
const { useSpeedPanelPins } = await import('../store/speed-panel-store.js');

describe('useSpeedPanelPins', () => {
  beforeEach(() => {
    storage.clear();
    useSpeedPanelPins.setState({ pinnedIds: [] });
  });

  it('togglePin adds and removes', () => {
    useSpeedPanelPins.getState().togglePin('edit-props');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['edit-props']);

    useSpeedPanelPins.getState().togglePin('edit-props');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual([]);
  });

  it('persists to localStorage', () => {
    useSpeedPanelPins.getState().togglePin('delete');
    const raw = storage.get('world-forge-speed-panel-pins');
    expect(raw).toBe(JSON.stringify(['delete']));
  });

  it('pinnedIds reflects current state', () => {
    useSpeedPanelPins.getState().togglePin('a');
    useSpeedPanelPins.getState().togglePin('b');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['a', 'b']);
    useSpeedPanelPins.getState().togglePin('a');
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['b']);
  });
});
