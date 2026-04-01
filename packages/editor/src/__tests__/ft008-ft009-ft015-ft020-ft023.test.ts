// ft008-ft009-ft015-ft020-ft023.test.ts — tests for Zone Merge, Per-Object Visibility,
// Bulk Entity Spawner, Layout Templates, Dialogue Templates

import { describe, it, expect, beforeEach } from 'vitest';
import type { WorldProject, Zone, ZoneConnection, EntityPlacement, Landmark, SpawnPoint, EncounterAnchor, District } from '@world-forge/schema';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';
import { LAYOUT_TEMPLATES } from '../templates/layout-templates.js';
import { DIALOGUE_TEMPLATES } from '../templates/dialogue-templates.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeZone(id: string, x = 0, y = 0, w = 4, h = 4, districtId?: string): Zone {
  return {
    id, name: `Zone ${id}`, description: '',
    gridX: x, gridY: y, gridWidth: w, gridHeight: h,
    tags: ['tag-' + id], neighbors: [], exits: [],
    light: 5, noise: 2, hazards: [], interactables: [],
    parentDistrictId: districtId,
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

function makeConnection(from: string, to: string): ZoneConnection {
  return { fromZoneId: from, toZoneId: to, bidirectional: true, kind: 'passage' };
}

function makeDistrict(id: string, zoneIds: string[]): District {
  return {
    id, name: `District ${id}`, zoneIds, tags: [],
    baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
  };
}

function setupProject(p: Partial<WorldProject>): void {
  const base = createEmptyProject();
  useProjectStore.getState().loadProject({ ...base, ...p });
}

// ── FT-008: Zone Merge ───────────────────────────────────────────

describe('FT-008: Zone Merge', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('mergeZones returns null for fewer than 2 zones', () => {
    setupProject({ zones: [makeZone('z1')] });
    const result = useProjectStore.getState().mergeZones(['z1']);
    expect(result).toBeNull();
  });

  it('mergeZones returns null for empty array', () => {
    const result = useProjectStore.getState().mergeZones([]);
    expect(result).toBeNull();
  });

  it('merges two zones into one with correct bounding box', () => {
    setupProject({
      zones: [makeZone('z1', 0, 0, 4, 4), makeZone('z2', 6, 2, 4, 4)],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2']);
    expect(mergedId).toBeTruthy();
    const p = useProjectStore.getState().project;
    expect(p.zones).toHaveLength(1);
    const merged = p.zones[0];
    expect(merged.id).toBe(mergedId);
    expect(merged.gridX).toBe(0);
    expect(merged.gridY).toBe(0);
    expect(merged.gridWidth).toBe(10); // max(0+4, 6+4) - min(0, 6) = 10 - 0
    expect(merged.gridHeight).toBe(6); // max(0+4, 2+4) - min(0, 2) = 6 - 0
  });

  it('reassigns entities to the merged zone', () => {
    setupProject({
      zones: [makeZone('z1', 0, 0), makeZone('z2', 8, 0)],
      entityPlacements: [makeEntity('e1', 'z1'), makeEntity('e2', 'z2')],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const p = useProjectStore.getState().project;
    expect(p.entityPlacements.every((e) => e.zoneId === mergedId)).toBe(true);
  });

  it('reassigns landmarks to the merged zone', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0)],
      landmarks: [makeLandmark('lm1', 'z1'), makeLandmark('lm2', 'z2')],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const p = useProjectStore.getState().project;
    expect(p.landmarks.every((l) => l.zoneId === mergedId)).toBe(true);
  });

  it('reassigns spawns to the merged zone', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0)],
      spawnPoints: [makeSpawn('sp1', 'z1')],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const p = useProjectStore.getState().project;
    expect(p.spawnPoints[0].zoneId).toBe(mergedId);
  });

  it('reassigns encounters to the merged zone', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0)],
      encounterAnchors: [makeEncounter('enc1', 'z2')],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const p = useProjectStore.getState().project;
    expect(p.encounterAnchors[0].zoneId).toBe(mergedId);
  });

  it('removes internal connections between merged zones', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0)],
      connections: [makeConnection('z1', 'z2')],
    });
    useProjectStore.getState().mergeZones(['z1', 'z2']);
    const p = useProjectStore.getState().project;
    expect(p.connections).toHaveLength(0);
  });

  it('repoints external connections to the merged zone', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0), makeZone('z3', 16, 0)],
      connections: [makeConnection('z1', 'z2'), makeConnection('z2', 'z3')],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const p = useProjectStore.getState().project;
    expect(p.connections).toHaveLength(1);
    expect(p.connections[0].fromZoneId).toBe(mergedId);
    expect(p.connections[0].toZoneId).toBe('z3');
  });

  it('updates district zoneIds to reference merged zone', () => {
    const dist = makeDistrict('d1', ['z1', 'z2', 'z3']);
    setupProject({
      zones: [makeZone('z1', 0, 0, 4, 4, 'd1'), makeZone('z2', 8, 0, 4, 4, 'd1'), makeZone('z3', 16, 0, 4, 4, 'd1')],
      districts: [dist],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const p = useProjectStore.getState().project;
    expect(p.districts[0].zoneIds).toContain(mergedId);
    expect(p.districts[0].zoneIds).toContain('z3');
    expect(p.districts[0].zoneIds).not.toContain('z1');
    expect(p.districts[0].zoneIds).not.toContain('z2');
  });

  it('creates an undo entry with correct label', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0)],
    });
    useProjectStore.getState().mergeZones(['z1', 'z2']);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Merge 2 zones');
  });

  it('merges tags from all source zones', () => {
    setupProject({
      zones: [makeZone('z1'), makeZone('z2', 8, 0)],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2'])!;
    const merged = useProjectStore.getState().project.zones.find((z) => z.id === mergedId)!;
    expect(merged.tags).toContain('tag-z1');
    expect(merged.tags).toContain('tag-z2');
  });
});

// ── FT-008: merge-zones speed panel action ───────────────────────

describe('FT-008: merge-zones speed panel action', () => {
  it('merge-zones action exists in SPEED_PANEL_ACTIONS', () => {
    const action = SPEED_PANEL_ACTIONS.find((a) => a.id === 'merge-zones');
    expect(action).toBeDefined();
    expect(action!.label).toBe('Merge Zones');
  });

  it('merge-zones context filter matches zone hits', () => {
    const action = SPEED_PANEL_ACTIONS.find((a) => a.id === 'merge-zones')!;
    expect(action.contextFilter({ type: 'zone', id: 'z1' })).toBe(true);
    expect(action.contextFilter(null)).toBe(false);
    expect(action.contextFilter({ type: 'entity', id: 'e1' })).toBe(false);
  });
});

// ── FT-009: Per-Object Visibility ────────────────────────────────

describe('FT-009: Per-Object Visibility', () => {
  beforeEach(() => {
    useEditorStore.getState().showAll();
  });

  it('hiddenIds starts empty', () => {
    expect(useEditorStore.getState().hiddenIds.size).toBe(0);
  });

  it('toggleHidden adds and removes IDs', () => {
    useEditorStore.getState().toggleHidden('obj-1');
    expect(useEditorStore.getState().isHidden('obj-1')).toBe(true);
    useEditorStore.getState().toggleHidden('obj-1');
    expect(useEditorStore.getState().isHidden('obj-1')).toBe(false);
  });

  it('showAll clears all hidden IDs', () => {
    useEditorStore.getState().toggleHidden('obj-1');
    useEditorStore.getState().toggleHidden('obj-2');
    expect(useEditorStore.getState().hiddenIds.size).toBe(2);
    useEditorStore.getState().showAll();
    expect(useEditorStore.getState().hiddenIds.size).toBe(0);
  });

  it('hideSelected hides all items in current selection', () => {
    useEditorStore.getState().setSelection({
      zones: ['z1', 'z2'],
      entities: ['e1'],
      landmarks: [],
      spawns: [],
      encounters: [],
    });
    useEditorStore.getState().hideSelected();
    const state = useEditorStore.getState();
    expect(state.isHidden('z1')).toBe(true);
    expect(state.isHidden('z2')).toBe(true);
    expect(state.isHidden('e1')).toBe(true);
  });

  it('hideSelected does nothing with empty selection', () => {
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().hideSelected();
    expect(useEditorStore.getState().hiddenIds.size).toBe(0);
  });

  it('isHidden returns false for non-hidden IDs', () => {
    expect(useEditorStore.getState().isHidden('nonexistent')).toBe(false);
  });
});

// ── FT-015: Bulk Entity Spawner ──────────────────────────────────

describe('FT-015: Bulk Entity Spawner', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('places entities in grid pattern', () => {
    setupProject({ zones: [makeZone('z1', 0, 0, 10, 10)] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'npc', count: 4, zoneId: 'z1', pattern: 'grid', spacing: 2,
    });
    const p = useProjectStore.getState().project;
    expect(p.entityPlacements).toHaveLength(4);
    expect(p.entityPlacements[0].role).toBe('npc');
    expect(p.entityPlacements[0].name).toBe('npc 1');
    expect(p.entityPlacements[3].name).toBe('npc 4');
  });

  it('places entities in random pattern within zone bounds', () => {
    const z = makeZone('z1', 5, 5, 10, 10);
    setupProject({ zones: [z] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'enemy', count: 10, zoneId: 'z1', pattern: 'random', spacing: 1,
    });
    const p = useProjectStore.getState().project;
    expect(p.entityPlacements).toHaveLength(10);
    for (const e of p.entityPlacements) {
      expect(e.gridX).toBeGreaterThanOrEqual(5);
      expect(e.gridX).toBeLessThan(15);
      expect(e.gridY).toBeGreaterThanOrEqual(5);
      expect(e.gridY).toBeLessThan(15);
    }
  });

  it('places entities in circle pattern', () => {
    setupProject({ zones: [makeZone('z1', 0, 0, 20, 20)] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'merchant', count: 4, zoneId: 'z1', pattern: 'circle', spacing: 1,
    });
    const p = useProjectStore.getState().project;
    expect(p.entityPlacements).toHaveLength(4);
    // First entity should be at rightmost point of circle
    const cx = 10, cy = 10;
    expect(p.entityPlacements[0].gridX).toBeGreaterThan(cx);
  });

  it('does nothing for nonexistent zone', () => {
    setupProject({ zones: [] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'npc', count: 5, zoneId: 'nonexistent', pattern: 'grid', spacing: 1,
    });
    expect(useProjectStore.getState().project.entityPlacements).toHaveLength(0);
  });

  it('creates undo entry with correct label', () => {
    setupProject({ zones: [makeZone('z1', 0, 0, 10, 10)] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'npc', count: 6, zoneId: 'z1', pattern: 'grid', spacing: 2,
    });
    expect(useProjectStore.getState().getUndoLabel()).toBe('Place 6 entities');
  });

  it('auto-increments entity names', () => {
    setupProject({ zones: [makeZone('z1', 0, 0, 10, 10)] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'guard', count: 3, zoneId: 'z1', pattern: 'grid', spacing: 2,
    });
    const names = useProjectStore.getState().project.entityPlacements.map((e) => e.name);
    expect(names).toEqual(['guard 1', 'guard 2', 'guard 3']);
  });

  it('assigns all entities to the correct zone', () => {
    setupProject({ zones: [makeZone('z1', 0, 0, 10, 10)] });
    useProjectStore.getState().batchPlaceEntities({
      role: 'npc', count: 5, zoneId: 'z1', pattern: 'random', spacing: 1,
    });
    const allInZone = useProjectStore.getState().project.entityPlacements.every((e) => e.zoneId === 'z1');
    expect(allInZone).toBe(true);
  });
});

// ── FT-020: Layout Templates ─────────────────────────────────────

describe('FT-020: Layout Templates', () => {
  it('exports 6 layout templates', () => {
    expect(LAYOUT_TEMPLATES).toHaveLength(6);
  });

  it('has 3 dungeon templates', () => {
    const dungeons = LAYOUT_TEMPLATES.filter((t) => t.category === 'dungeon');
    expect(dungeons).toHaveLength(3);
  });

  it('has 3 district templates', () => {
    const districts = LAYOUT_TEMPLATES.filter((t) => t.category === 'district');
    expect(districts).toHaveLength(3);
  });

  it('each template has unique id', () => {
    const ids = LAYOUT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const tmpl of [
    'dungeon-small-room-set',
    'dungeon-corridor-complex',
    'dungeon-boss-arena',
    'district-city-block',
    'district-market-square',
    'district-harbor-front',
  ]) {
    it(`template "${tmpl}" generates a project with 3-5 zones and connections`, () => {
      const template = LAYOUT_TEMPLATES.find((t) => t.id === tmpl)!;
      const project = template.generate();
      expect(project.zones!.length).toBeGreaterThanOrEqual(3);
      expect(project.zones!.length).toBeLessThanOrEqual(5);
      expect(project.connections!.length).toBeGreaterThanOrEqual(2);
    });

    it(`template "${tmpl}" generates at least one district`, () => {
      const template = LAYOUT_TEMPLATES.find((t) => t.id === tmpl)!;
      const project = template.generate();
      expect(project.districts!.length).toBeGreaterThanOrEqual(1);
    });
  }

  it('Small Room Set has 4 zones', () => {
    const tmpl = LAYOUT_TEMPLATES.find((t) => t.id === 'dungeon-small-room-set')!;
    expect(tmpl.generate().zones).toHaveLength(4);
  });

  it('Corridor Complex has 5 zones', () => {
    const tmpl = LAYOUT_TEMPLATES.find((t) => t.id === 'dungeon-corridor-complex')!;
    expect(tmpl.generate().zones).toHaveLength(5);
  });

  it('Boss Arena has 3 zones', () => {
    const tmpl = LAYOUT_TEMPLATES.find((t) => t.id === 'dungeon-boss-arena')!;
    expect(tmpl.generate().zones).toHaveLength(3);
  });
});

// ── FT-020: Layout Templates in registry ─────────────────────────

describe('FT-020: Layout Templates registry', () => {
  it('LAYOUT_TEMPLATES is re-exported from registry', async () => {
    const { LAYOUT_TEMPLATES: fromRegistry } = await import('../templates/registry.js');
    expect(fromRegistry).toBe(LAYOUT_TEMPLATES);
  });
});

// ── FT-023: Dialogue Templates ───────────────────────────────────

describe('FT-023: Dialogue Templates', () => {
  it('exports 5 dialogue templates', () => {
    expect(DIALOGUE_TEMPLATES).toHaveLength(5);
  });

  it('each template has unique id', () => {
    const ids = DIALOGUE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each template has a label and category', () => {
    for (const t of DIALOGUE_TEMPLATES) {
      expect(t.label).toBeTruthy();
      expect(t.category).toBeTruthy();
    }
  });

  for (const tmplId of ['greeting', 'quest-giver', 'merchant', 'warning', 'farewell']) {
    it(`"${tmplId}" template generates a valid DialogueDefinition`, () => {
      const tmpl = DIALOGUE_TEMPLATES.find((t) => t.id === tmplId)!;
      const dialogue = tmpl.generate();
      expect(dialogue.id).toBeTruthy();
      expect(dialogue.speakers.length).toBeGreaterThanOrEqual(1);
      expect(dialogue.entryNodeId).toBeTruthy();
      expect(dialogue.nodes[dialogue.entryNodeId]).toBeDefined();
    });

    it(`"${tmplId}" template has 2-4 nodes with branches`, () => {
      const tmpl = DIALOGUE_TEMPLATES.find((t) => t.id === tmplId)!;
      const dialogue = tmpl.generate();
      const nodeCount = Object.keys(dialogue.nodes).length;
      expect(nodeCount).toBeGreaterThanOrEqual(2);
      expect(nodeCount).toBeLessThanOrEqual(5);
    });

    it(`"${tmplId}" template generates unique IDs on each call`, () => {
      const tmpl = DIALOGUE_TEMPLATES.find((t) => t.id === tmplId)!;
      const d1 = tmpl.generate();
      const d2 = tmpl.generate();
      expect(d1.id).not.toBe(d2.id);
    });
  }

  it('covers all expected categories', () => {
    const categories = new Set(DIALOGUE_TEMPLATES.map((t) => t.category));
    expect(categories.has('social')).toBe(true);
    expect(categories.has('quest')).toBe(true);
    expect(categories.has('commerce')).toBe(true);
    expect(categories.has('warning')).toBe(true);
  });
});
