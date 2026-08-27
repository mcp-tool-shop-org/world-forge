// batch-zone-delete.test.ts — F-4342e70c
//
// Batch-delete of selected zones must match removeZone/removeSelected: only
// the zones (plus connections / district membership) go away. Unselected
// zone-attached objects become orphans, not cascade-wiped.

import { describe, it, expect } from 'vitest';
import { createEmptyProject } from '../../store/project-store.js';
import type { Zone, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor, ItemPlacement, PropPlacement, District } from '@world-forge/schema';
import { deleteSelectedZonesOnly, batchDeleteConfirmMessage } from '../batch-zone-delete.js';
import { BatchZoneActions } from '../BatchZoneActions.js';
import { SelectionActionsPanel } from '../SelectionActionsPanel.js';

function makeZone(id: string): Zone {
  return {
    id, name: `Zone ${id}`, description: '', tags: [],
    gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
    neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
  };
}

function makeEntity(entityId: string, zoneId: string): EntityPlacement {
  return { entityId, name: `Entity ${entityId}`, zoneId, role: 'npc', gridX: 1, gridY: 1 };
}

function makeLandmark(id: string, zoneId: string): Landmark {
  return { id, name: `Landmark ${id}`, zoneId, gridX: 2, gridY: 2, tags: [], interactionType: 'inspect' };
}

function makeSpawn(id: string, zoneId: string): SpawnPoint {
  return { id, zoneId, gridX: 1, gridY: 1, isDefault: false };
}

function makeEncounter(id: string, zoneId: string): EncounterAnchor {
  return { id, zoneId, encounterType: 'ambush', enemyIds: [], probability: 0.5, cooldownTurns: 3, tags: [] };
}

function makeItem(itemId: string, zoneId: string): ItemPlacement {
  return { itemId, zoneId, hidden: false };
}

function makeProp(id: string, zoneId: string): PropPlacement {
  return { id, propId: 'prop-1', gridX: 0, gridY: 0, zoneId };
}

function makeDistrict(id: string, zoneIds: string[]): District {
  return {
    id, name: id, zoneIds, tags: [],
    baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
  };
}

describe('deleteSelectedZonesOnly (F-4342e70c)', () => {
  it('leaves unselected zone-attached objects as orphans', () => {
    const project = createEmptyProject();
    project.zones = [makeZone('z1'), makeZone('z2'), makeZone('z3')];
    project.connections = [
      { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true },
      { fromZoneId: 'z2', toZoneId: 'z3', bidirectional: false },
    ];
    project.districts = [makeDistrict('d1', ['z1', 'z2', 'z3'])];
    project.entityPlacements = [makeEntity('e1', 'z1'), makeEntity('e2', 'z1'), makeEntity('e-keep', 'z3')];
    project.landmarks = [makeLandmark('l1', 'z1'), makeLandmark('l2', 'z2')];
    project.spawnPoints = [makeSpawn('s1', 'z1')];
    project.encounterAnchors = [makeEncounter('enc1', 'z1'), makeEncounter('enc2', 'z2')];
    project.itemPlacements = [makeItem('i1', 'z1')];
    project.propPlacements = [makeProp('p1', 'z2')];

    const next = deleteSelectedZonesOnly(project, ['z1', 'z2']);

    expect(next.zones.map((z) => z.id)).toEqual(['z3']);
    expect(next.connections).toEqual([]);
    expect(next.districts[0].zoneIds).toEqual(['z3']);

    // Attached objects SURVIVE as orphans — they were not in the selection.
    expect(next.entityPlacements.map((e) => e.entityId).sort()).toEqual(['e-keep', 'e1', 'e2']);
    expect(next.landmarks.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
    expect(next.spawnPoints.map((s) => s.id)).toEqual(['s1']);
    expect(next.encounterAnchors.map((e) => e.id).sort()).toEqual(['enc1', 'enc2']);
    expect(next.itemPlacements.map((i) => i.itemId)).toEqual(['i1']);
    expect(next.propPlacements.map((p) => p.id)).toEqual(['p1']);

    const zoneIds = new Set(next.zones.map((z) => z.id));
    expect(zoneIds.has('z1')).toBe(false);
    expect(zoneIds.has(next.entityPlacements.find((e) => e.entityId === 'e1')!.zoneId)).toBe(false);
    expect(zoneIds.has(next.landmarks.find((l) => l.id === 'l1')!.zoneId)).toBe(false);
  });
});

describe('batchDeleteConfirmMessage (F-4342e70c)', () => {
  it('does not claim the mutation cannot be undone', () => {
    expect(batchDeleteConfirmMessage(3)).toBe('Delete 3 zones?');
    expect(batchDeleteConfirmMessage(3)).not.toMatch(/cannot be undone/i);
  });
});

describe('BatchZoneActions re-export (F-4342e70c)', () => {
  it('is SelectionActionsPanel so the cascade-wipe path cannot be remounted', () => {
    expect(BatchZoneActions).toBe(SelectionActionsPanel);
  });
});
