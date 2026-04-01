// ft003-ft004-ft005-ft013.test.ts — tests for FT-003 (undo labels), FT-004 (clipboard),
// FT-005 (context menu), FT-013 (macro feedback)

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldProject, Zone, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor, ZoneConnection } from '@world-forge/schema';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import type { ClipboardData } from '../store/editor-store.js';
import { pasteFromClipboard } from '../paste.js';
import { getContextMenuActions, SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';
import type { SpeedPanelMacro } from '../speed-panel-actions.js';
import { executeMacro, executeAction } from '../speed-panel-execute.js';
import type { ExecuteStores } from '../speed-panel-execute.js';
import type { HitResult } from '../hit-testing.js';
import { matchHotkey, HOTKEY_BINDINGS } from '../hotkeys.js';

function makeZone(id: string, x = 0, y = 0): Zone {
  return {
    id, name: `Zone ${id}`, description: '',
    gridX: x, gridY: y, gridWidth: 4, gridHeight: 4,
    tags: [], neighbors: [], exits: [],
    light: 1, noise: 0, hazards: [], interactables: [],
  };
}

function makeEntity(entityId: string, zoneId: string, x = 1, y = 1): EntityPlacement {
  return { entityId, name: `Entity ${entityId}`, zoneId, role: 'npc', gridX: x, gridY: y };
}

function makeLandmark(id: string, zoneId: string, x = 2, y = 2): Landmark {
  return { id, name: `Landmark ${id}`, zoneId, gridX: x, gridY: y, tags: [], interactionType: 'inspect' };
}

function makeSpawn(id: string, zoneId: string, x = 3, y = 3): SpawnPoint {
  return { id, zoneId, gridX: x, gridY: y, isDefault: false };
}

function makeEncounter(id: string, zoneId: string): EncounterAnchor {
  return { id, zoneId, encounterType: 'combat', enemyIds: [], probability: 1, cooldownTurns: 0, tags: [] };
}

// ──────────────────────────────────────────────────────────────────
// FT-003: Undo/Redo History Labels
// ──────────────────────────────────────────────────────────────────

describe('FT-003: Undo/Redo History Labels', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('getUndoLabel returns null when stack is empty', () => {
    expect(useProjectStore.getState().getUndoLabel()).toBeNull();
  });

  it('getRedoLabel returns null when stack is empty', () => {
    expect(useProjectStore.getState().getRedoLabel()).toBeNull();
  });

  it('getUndoCount returns 0 for fresh project', () => {
    expect(useProjectStore.getState().getUndoCount()).toBe(0);
  });

  it('getRedoCount returns 0 for fresh project', () => {
    expect(useProjectStore.getState().getRedoCount()).toBe(0);
  });

  it('addZone pushes "Add zone" label onto undo stack', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add zone');
    expect(useProjectStore.getState().getUndoCount()).toBe(1);
  });

  it('removeZone pushes "Delete zone" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().removeZone('z1');
    expect(useProjectStore.getState().getUndoLabel()).toBe('Delete zone');
    expect(useProjectStore.getState().getUndoCount()).toBe(2);
  });

  it('addConnection pushes "Add connection" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addZone(makeZone('z2', 5, 0));
    const conn: ZoneConnection = { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: false };
    useProjectStore.getState().addConnection(conn);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add connection');
  });

  it('removeConnection pushes "Delete connection" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addZone(makeZone('z2', 5, 0));
    const conn: ZoneConnection = { fromZoneId: 'z1', toZoneId: 'z2', bidirectional: false };
    useProjectStore.getState().addConnection(conn);
    useProjectStore.getState().removeConnection('z1', 'z2');
    expect(useProjectStore.getState().getUndoLabel()).toBe('Delete connection');
  });

  it('moveSelected pushes counted move label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addZone(makeZone('z2', 5, 0));
    useProjectStore.getState().moveSelected(
      { zones: ['z1', 'z2'], entities: [], landmarks: [], spawns: [], encounters: [] },
      1, 0,
    );
    expect(useProjectStore.getState().getUndoLabel()).toBe('Move 2 objects');
  });

  it('moveSelected uses singular for 1 object', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().moveSelected(
      { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] },
      1, 0,
    );
    expect(useProjectStore.getState().getUndoLabel()).toBe('Move 1 object');
  });

  it('removeSelected pushes counted delete label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().removeSelected(
      { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] },
    );
    expect(useProjectStore.getState().getUndoLabel()).toBe('Delete 1 object');
  });

  it('undo makes the action label available as redo label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    expect(useProjectStore.getState().getRedoLabel()).toBeNull();
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().getRedoLabel()).toBe('Add zone');
    expect(useProjectStore.getState().getRedoCount()).toBe(1);
  });

  it('redo makes the action label available as undo label again', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().undo();
    useProjectStore.getState().redo();
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add zone');
    expect(useProjectStore.getState().getRedoCount()).toBe(0);
  });

  it('updateProject with custom label stores it', () => {
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'Renamed' }), 'Rename project');
    expect(useProjectStore.getState().getUndoLabel()).toBe('Rename project');
  });

  it('updateProject without label defaults to "Edit"', () => {
    useProjectStore.getState().updateProject((p) => ({ ...p, name: 'X' }));
    expect(useProjectStore.getState().getUndoLabel()).toBe('Edit');
  });

  it('addEntity pushes "Add entity" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addEntity(makeEntity('e1', 'z1'));
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add entity');
  });

  it('addLandmark pushes "Add landmark" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addLandmark(makeLandmark('lm1', 'z1'));
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add landmark');
  });

  it('addSpawnPoint pushes "Add spawn point" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addSpawnPoint(makeSpawn('sp1', 'z1'));
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add spawn point');
  });

  it('addEncounter pushes "Add encounter" label', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useProjectStore.getState().addEncounter(makeEncounter('enc1', 'z1'));
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add encounter');
  });
});

// ──────────────────────────────────────────────────────────────────
// FT-004: Copy/Paste Infrastructure
// ──────────────────────────────────────────────────────────────────

describe('FT-004: Copy/Paste Infrastructure', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
    useEditorStore.getState().clearSelection();
    // Reset clipboard between tests (zustand is a singleton)
    useEditorStore.setState({ clipboard: null });
  });

  describe('clipboard in editor store', () => {
    it('clipboard starts as null', () => {
      expect(useEditorStore.getState().clipboard).toBeNull();
    });

    it('copySelection deep-clones selected zones into clipboard', () => {
      const z = makeZone('z1', 10, 20);
      useProjectStore.getState().addZone(z);
      useEditorStore.getState().selectZone('z1', false);
      useEditorStore.getState().copySelection(useProjectStore.getState().project);

      const clip = useEditorStore.getState().clipboard;
      expect(clip).not.toBeNull();
      expect(clip!.zones).toHaveLength(1);
      expect(clip!.zones[0].id).toBe('z1');
      expect(clip!.zones[0].gridX).toBe(10);
    });

    it('copySelection deep-clones selected entities', () => {
      const z = makeZone('z1');
      const e = makeEntity('e1', 'z1');
      useProjectStore.getState().addZone(z);
      useProjectStore.getState().addEntity(e);
      useEditorStore.getState().selectEntity('e1', false);
      useEditorStore.getState().copySelection(useProjectStore.getState().project);

      const clip = useEditorStore.getState().clipboard;
      expect(clip!.entities).toHaveLength(1);
      expect(clip!.entities[0].entityId).toBe('e1');
    });

    it('copySelection with empty selection does not set clipboard', () => {
      useEditorStore.getState().clearSelection();
      useEditorStore.getState().copySelection(useProjectStore.getState().project);
      expect(useEditorStore.getState().clipboard).toBeNull();
    });

    it('getClipboard returns current clipboard', () => {
      expect(useEditorStore.getState().getClipboard()).toBeNull();
      const z = makeZone('z1');
      useProjectStore.getState().addZone(z);
      useEditorStore.getState().selectZone('z1', false);
      useEditorStore.getState().copySelection(useProjectStore.getState().project);
      expect(useEditorStore.getState().getClipboard()).not.toBeNull();
    });
  });

  describe('pasteFromClipboard', () => {
    it('creates new zones with remapped IDs and offset positions', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [makeZone('z1', 5, 10)],
        entities: [], landmarks: [], spawns: [], encounters: [],
      };
      const result = pasteFromClipboard(clip, project);
      expect(result.project.zones).toHaveLength(1);
      expect(result.project.zones[0].id).not.toBe('z1');
      expect(result.project.zones[0].gridX).toBe(7); // 5 + default offset 2
      expect(result.project.zones[0].gridY).toBe(12);
      expect(result.project.zones[0].name).toBe('Zone z1 (paste)');
      expect(result.newIds).toHaveLength(1);
    });

    it('uses custom offset when provided', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [makeZone('z1', 0, 0)],
        entities: [], landmarks: [], spawns: [], encounters: [],
      };
      const result = pasteFromClipboard(clip, project, { dx: 10, dy: 5 });
      expect(result.project.zones[0].gridX).toBe(10);
      expect(result.project.zones[0].gridY).toBe(5);
    });

    it('remaps entity IDs and offsets positions', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [],
        entities: [makeEntity('e1', 'z1', 3, 4)],
        landmarks: [], spawns: [], encounters: [],
      };
      const result = pasteFromClipboard(clip, project);
      expect(result.project.entityPlacements).toHaveLength(1);
      expect(result.project.entityPlacements[0].entityId).not.toBe('e1');
      expect(result.project.entityPlacements[0].gridX).toBe(5); // 3 + 2
    });

    it('remaps landmark IDs', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [], entities: [],
        landmarks: [makeLandmark('lm1', 'z1', 1, 1)],
        spawns: [], encounters: [],
      };
      const result = pasteFromClipboard(clip, project);
      expect(result.project.landmarks).toHaveLength(1);
      expect(result.project.landmarks[0].id).not.toBe('lm1');
    });

    it('remaps spawn IDs', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [], entities: [], landmarks: [],
        spawns: [makeSpawn('sp1', 'z1')],
        encounters: [],
      };
      const result = pasteFromClipboard(clip, project);
      expect(result.project.spawnPoints).toHaveLength(1);
      expect(result.project.spawnPoints[0].id).not.toBe('sp1');
    });

    it('remaps encounter IDs', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [], entities: [], landmarks: [], spawns: [],
        encounters: [makeEncounter('enc1', 'z1')],
      };
      const result = pasteFromClipboard(clip, project);
      expect(result.project.encounterAnchors).toHaveLength(1);
      expect(result.project.encounterAnchors[0].id).not.toBe('enc1');
    });

    it('returns all new IDs', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [makeZone('z1')],
        entities: [makeEntity('e1', 'z1')],
        landmarks: [makeLandmark('lm1', 'z1')],
        spawns: [makeSpawn('sp1', 'z1')],
        encounters: [makeEncounter('enc1', 'z1')],
      };
      const result = pasteFromClipboard(clip, project);
      expect(result.newIds).toHaveLength(5);
    });

    it('does not mutate the original project', () => {
      const project = createEmptyProject();
      const zonesBefore = project.zones.length;
      const clip: ClipboardData = {
        zones: [makeZone('z1')],
        entities: [], landmarks: [], spawns: [], encounters: [],
      };
      pasteFromClipboard(clip, project);
      expect(project.zones.length).toBe(zonesBefore);
    });

    it('remaps zone references for entities when zone is in clipboard', () => {
      const project = createEmptyProject();
      const clip: ClipboardData = {
        zones: [makeZone('z1')],
        entities: [makeEntity('e1', 'z1')],
        landmarks: [], spawns: [], encounters: [],
      };
      const result = pasteFromClipboard(clip, project);
      // The entity's zoneId should point to the new zone ID, not 'z1'
      const newZoneId = result.project.zones[0].id;
      expect(result.project.entityPlacements[0].zoneId).toBe(newZoneId);
    });
  });

  describe('hotkey bindings include copy/paste', () => {
    it('Ctrl+C is registered', () => {
      const binding = HOTKEY_BINDINGS.find((b) => b.action === 'copy');
      expect(binding).toBeDefined();
      expect(binding!.key).toBe('KeyC');
      expect(binding!.ctrl).toBe(true);
    });

    it('Ctrl+V is registered', () => {
      const binding = HOTKEY_BINDINGS.find((b) => b.action === 'paste');
      expect(binding).toBeDefined();
      expect(binding!.key).toBe('KeyV');
      expect(binding!.ctrl).toBe(true);
    });

    it('matchHotkey recognizes Ctrl+C', () => {
      const e = { code: 'KeyC', ctrlKey: true, metaKey: false, shiftKey: false } as unknown as KeyboardEvent;
      expect(matchHotkey(e)).toBe('copy');
    });

    it('matchHotkey recognizes Ctrl+V', () => {
      const e = { code: 'KeyV', ctrlKey: true, metaKey: false, shiftKey: false } as unknown as KeyboardEvent;
      expect(matchHotkey(e)).toBe('paste');
    });
  });
});

// ─���────────────────────────────────────────────────────────────────
// FT-005: Context Menu Action Registry
// ──────────────────────────────────────────────────────────────────

describe('FT-005: Context Menu Action Registry', () => {
  const project = createEmptyProject();

  it('returns actions for null hit (empty canvas)', () => {
    const actions = getContextMenuActions(null, project);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.length).toBeLessThanOrEqual(7);
    // Should include global actions like new-zone, fit-content
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('new-zone');
  });

  it('returns zone-specific actions for zone hit', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const actions = getContextMenuActions(hit, project);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.length).toBeLessThanOrEqual(7);
    const ids = actions.map((a) => a.id);
    // Zone hit should show zone-context actions
    expect(ids).toContain('edit-props');
    expect(ids).toContain('delete');
    expect(ids).toContain('assign-district');
  });

  it('returns entity-specific actions for entity hit', () => {
    const hit: HitResult = { type: 'entity', id: 'e1' };
    const actions = getContextMenuActions(hit, project);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('edit-props');
    expect(ids).toContain('delete');
  });

  it('returns connection-specific actions for connection hit', () => {
    const hit: HitResult = { type: 'connection', id: 'z1::z2' };
    const actions = getContextMenuActions(hit, project);
    const ids = actions.map((a) => a.id);
    expect(ids).toContain('swap-direction');
  });

  it('never returns more than 7 actions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const actions = getContextMenuActions(hit, project);
    expect(actions.length).toBeLessThanOrEqual(7);
  });

  it('context actions come before global actions', () => {
    const hit: HitResult = { type: 'zone', id: 'z1' };
    const actions = getContextMenuActions(hit, project);
    const firstGlobalIdx = actions.findIndex((a) => a.category === 'global');
    const lastContextIdx = actions.map((a, i) => a.category === 'context' ? i : -1).filter((i) => i >= 0).pop();
    if (firstGlobalIdx >= 0 && lastContextIdx != null) {
      expect(lastContextIdx).toBeLessThan(firstGlobalIdx);
    }
  });
});

// ──────────────────────────────────────────────────────────────────
// FT-013: Macro Execution Feedback
// ──────────────────────────────────────────────────────────────────

describe('FT-013: Macro Execution Feedback', () => {
  function makeMockStores(project?: WorldProject): ExecuteStores {
    const p = project ?? createEmptyProject();
    return {
      selectZone: () => {},
      selectEntity: () => {},
      selectLandmark: () => {},
      selectSpawn: () => {},
      selectEncounter: () => {},
      selectConnection: () => {},
      clearSelection: () => {},
      setRightTab: () => {},
      setTool: () => {},
      setConnectionStart: () => {},
      setViewport: () => {},
      removeSelected: () => {},
      duplicateSelected: () => ({}),
      removeConnection: () => {},
      addConnection: () => {},
      project: p,
    };
  }

  it('successful macro returns step-by-step results', () => {
    const macro: SpeedPanelMacro = {
      id: 'test-macro',
      name: 'Test',
      steps: [{ actionId: 'new-zone' }, { actionId: 'fit-content' }],
    };
    const stores = makeMockStores();
    // Add a zone so fit-content has something
    stores.project = { ...stores.project, zones: [makeZone('z1')] };
    const result = executeMacro(macro, null, stores);

    expect(result.steps).toHaveLength(2);
    expect(result.totalSteps).toBe(2);
    expect(result.completedSteps).toBe(2);
    expect(result.steps[0]).toEqual({ action: 'new-zone', success: true });
    expect(result.steps[1]).toEqual({ action: 'fit-content', success: true });
  });

  it('failed macro includes step results up to failure', () => {
    const macro: SpeedPanelMacro = {
      id: 'bad-macro',
      name: 'Bad',
      steps: [
        { actionId: 'edit-props' },   // needs context, will fail with null
        { actionId: 'new-zone' },
      ],
    };
    const stores = makeMockStores();
    const result = executeMacro(macro, null, stores);

    expect(result.steps).toHaveLength(1);
    expect(result.totalSteps).toBe(2);
    expect(result.completedSteps).toBe(0);
    expect(result.abortedAt).toBe(0);
    expect(result.steps[0]).toEqual({ action: 'edit-props', success: false });
    expect(result.reason).toContain('edit-props');
  });

  it('empty macro returns zero steps', () => {
    const macro: SpeedPanelMacro = {
      id: 'empty',
      name: 'Empty',
      steps: [],
    };
    const stores = makeMockStores();
    const result = executeMacro(macro, null, stores);

    expect(result.steps).toHaveLength(0);
    expect(result.totalSteps).toBe(0);
    expect(result.completedSteps).toBe(0);
    expect(result.completed).toBe(0);
  });

  it('single-step successful macro has correct structure', () => {
    const macro: SpeedPanelMacro = {
      id: 'one-step',
      name: 'One',
      steps: [{ actionId: 'new-zone' }],
    };
    const stores = makeMockStores();
    const result = executeMacro(macro, null, stores);

    expect(result.steps).toHaveLength(1);
    expect(result.completedSteps).toBe(1);
    expect(result.totalSteps).toBe(1);
    expect(result.abortedAt).toBeUndefined();
  });

  it('macro with context-dependent action succeeds when context matches', () => {
    const macro: SpeedPanelMacro = {
      id: 'ctx-macro',
      name: 'Context',
      steps: [{ actionId: 'edit-props' }, { actionId: 'delete' }],
    };
    const stores = makeMockStores();
    const hit: HitResult = { type: 'zone', id: 'z1' };
    stores.project = { ...stores.project, zones: [makeZone('z1')] };
    const result = executeMacro(macro, hit, stores);

    expect(result.completedSteps).toBe(2);
    expect(result.steps.every((s) => s.success)).toBe(true);
  });
});
