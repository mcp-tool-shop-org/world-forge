// remove-selected-orphans.test.ts
//
// Regression for F-df80d913 (CRITICAL).
//
// removeSelected (the Delete-key / multi-select delete path) used to
// cascade-hard-delete entityPlacements/landmarks/spawnPoints/encounterAnchors
// attached to any zone being deleted, even when those objects were NOT part
// of the user's selection. removeZone (the single-zone-delete action)
// deliberately does NOT cascade — it only cleans `connections` and leaves
// dependents as orphans — and orphans.ts states that as an explicit,
// documented design principle: "we do NOT silently clean up orphans on zone
// delete. That would erase the user's work. Instead we surface them as
// first-class, selectable, repairable rows so the user decides."
//
// removeSelected violated that principle for the exact same conceptual
// operation (delete a zone) reached via a different UI path, and did so with
// NO confirmation for small selections: hotkeys.ts's delete handler only
// confirms when the EXPLICIT selection count exceeds 3, which has no idea
// about the hidden cascade — selecting one zone with 5 entities + 3
// landmarks + 2 encounters placed in it silently removed 11 objects.
//
// The fix makes removeSelected's zone-deletion behavior match removeZone's:
// only remove what was explicitly selected; zone-attached items not in the
// selection become orphans (dangling zoneId), not silently destroyed.

import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { Zone, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor } from '@world-forge/schema';

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

describe('removeSelected — zone deletion does not cascade to unselected attached objects (F-df80d913)', () => {
  beforeEach(() => {
    const project = createEmptyProject();
    project.zones = [makeZone('z1'), makeZone('z2')];
    project.entityPlacements = [makeEntity('e1', 'z1'), makeEntity('e2', 'z1'), makeEntity('e-other', 'z2')];
    project.landmarks = [makeLandmark('l1', 'z1'), makeLandmark('l2', 'z1')];
    project.spawnPoints = [makeSpawn('s1', 'z1')];
    project.encounterAnchors = [makeEncounter('enc1', 'z1'), makeEncounter('enc2', 'z1')];
    useProjectStore.setState({ project, dirty: false, undoStack: [], redoStack: [] });
  });

  it('deleting ONLY a zone (nothing else selected) removes the zone but leaves its 7 attached objects as orphans', () => {
    useProjectStore.getState().removeSelected({
      zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [],
    });

    const { project } = useProjectStore.getState();
    expect(project.zones.map((z) => z.id)).toEqual(['z2']);

    // The attached objects SURVIVE — they are now orphans (zoneId points at
    // a zone that no longer exists), not deleted.
    expect(project.entityPlacements.map((e) => e.entityId).sort()).toEqual(['e-other', 'e1', 'e2'].sort());
    expect(project.landmarks.map((l) => l.id).sort()).toEqual(['l1', 'l2']);
    expect(project.spawnPoints.map((s) => s.id)).toEqual(['s1']);
    expect(project.encounterAnchors.map((e) => e.id).sort()).toEqual(['enc1', 'enc2']);

    // And they are genuinely orphaned — their zoneId no longer resolves.
    const zoneIds = new Set(project.zones.map((z) => z.id));
    expect(zoneIds.has('z1')).toBe(false);
    for (const e of project.entityPlacements.filter((e) => e.entityId !== 'e-other')) {
      expect(zoneIds.has(e.zoneId)).toBe(false);
    }
  });

  it('matches removeZone byte-for-byte: both leave the same 7 objects behind as orphans', () => {
    const viaRemoveSelected = createEmptyProject();
    viaRemoveSelected.zones = [makeZone('z1'), makeZone('z2')];
    viaRemoveSelected.entityPlacements = [makeEntity('e1', 'z1')];
    viaRemoveSelected.landmarks = [makeLandmark('l1', 'z1')];
    viaRemoveSelected.spawnPoints = [makeSpawn('s1', 'z1')];
    viaRemoveSelected.encounterAnchors = [makeEncounter('enc1', 'z1')];
    useProjectStore.setState({ project: viaRemoveSelected, dirty: false, undoStack: [], redoStack: [] });
    useProjectStore.getState().removeSelected({ zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] });
    const afterRemoveSelected = useProjectStore.getState().project;

    const viaRemoveZone = createEmptyProject();
    viaRemoveZone.zones = [makeZone('z1'), makeZone('z2')];
    viaRemoveZone.entityPlacements = [makeEntity('e1', 'z1')];
    viaRemoveZone.landmarks = [makeLandmark('l1', 'z1')];
    viaRemoveZone.spawnPoints = [makeSpawn('s1', 'z1')];
    viaRemoveZone.encounterAnchors = [makeEncounter('enc1', 'z1')];
    useProjectStore.setState({ project: viaRemoveZone, dirty: false, undoStack: [], redoStack: [] });
    useProjectStore.getState().removeZone('z1');
    const afterRemoveZone = useProjectStore.getState().project;

    expect(afterRemoveSelected.entityPlacements).toEqual(afterRemoveZone.entityPlacements);
    expect(afterRemoveSelected.landmarks).toEqual(afterRemoveZone.landmarks);
    expect(afterRemoveSelected.spawnPoints).toEqual(afterRemoveZone.spawnPoints);
    expect(afterRemoveSelected.encounterAnchors).toEqual(afterRemoveZone.encounterAnchors);
    expect(afterRemoveSelected.zones).toEqual(afterRemoveZone.zones);
  });

  it('an EXPLICITLY selected entity in the deleted zone is still removed (only the cascade is gone, not direct deletion)', () => {
    useProjectStore.getState().removeSelected({
      zones: ['z1'], entities: ['e1'], landmarks: [], spawns: [], encounters: [],
    });
    const { project } = useProjectStore.getState();
    expect(project.entityPlacements.map((e) => e.entityId)).not.toContain('e1');
    // e2 was NOT selected — it survives as an orphan, same as before.
    expect(project.entityPlacements.map((e) => e.entityId)).toContain('e2');
  });

  it('deleting entities/landmarks/spawns/encounters directly (no zone in the selection) still works exactly as before', () => {
    useProjectStore.getState().removeSelected({
      zones: [], entities: ['e1'], landmarks: ['l1'], spawns: ['s1'], encounters: ['enc1'],
    });
    const { project } = useProjectStore.getState();
    expect(project.entityPlacements.map((e) => e.entityId)).toEqual(['e2', 'e-other']);
    expect(project.landmarks.map((l) => l.id)).toEqual(['l2']);
    expect(project.spawnPoints).toEqual([]);
    expect(project.encounterAnchors.map((e) => e.id)).toEqual(['enc2']);
    // Zones are untouched.
    expect(project.zones.map((z) => z.id)).toEqual(['z1', 'z2']);
  });

  it('is undoable: undo restores the zone AND the caller can see the orphans were never actually deleted in the first place', () => {
    useProjectStore.getState().removeSelected({ zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] });
    expect(useProjectStore.getState().project.zones.map((z) => z.id)).toEqual(['z2']);

    useProjectStore.getState().undo();
    const { project } = useProjectStore.getState();
    expect(project.zones.map((z) => z.id).sort()).toEqual(['z1', 'z2']);
    expect(project.entityPlacements).toHaveLength(3);
    expect(project.landmarks).toHaveLength(2);
  });
});
