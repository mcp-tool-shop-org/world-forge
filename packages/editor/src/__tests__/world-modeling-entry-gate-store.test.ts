import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { Zone, WorldProject } from '@world-forge/schema';

const store = () => useProjectStore.getState();
const zone = (id: string, over: Partial<Zone> = {}): Zone =>
  ({ id, name: id, tags: [], description: '', gridX: 0, gridY: 0, gridWidth: 2, gridHeight: 2, neighbors: [], exits: [], light: 1, noise: 0, hazards: [], interactables: [], ...over });

function projectWithZones(zones: Zone[]): WorldProject {
  return { ...createEmptyProject(), zones };
}

beforeEach(() => {
  useProjectStore.setState({ project: projectWithZones([zone('z1')]), undoStack: [], redoStack: [], dirty: false });
});

describe('world-modeling store — zone entry gate', () => {
  it('sets and clears a zone entry gate with the documented undo labels', () => {
    store().setZoneEntryGate('z1', { conditions: ['party-level:>=10'], mode: 'hard', reason: 'Too dangerous for a weak party.' });
    expect(store().project.zones[0].entryGate).toMatchObject({ conditions: ['party-level:>=10'], mode: 'hard' });
    expect(store().getUndoLabel()).toBe('Set zone entry gate');

    store().setZoneEntryGate('z1', undefined);
    expect(store().project.zones[0].entryGate).toBeUndefined();
    expect(store().getUndoLabel()).toBe('Clear zone entry gate');
  });

  it('updates an existing gate by replacing it', () => {
    store().setZoneEntryGate('z1', { conditions: ['always'], mode: 'soft' });
    store().setZoneEntryGate('z1', { conditions: ['item:iron-key', 'flag:met-king'], mode: 'hard' });
    expect(store().project.zones[0].entryGate).toMatchObject({ conditions: ['item:iron-key', 'flag:met-king'], mode: 'hard' });
  });
});
