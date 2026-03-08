import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import type { WorldProject } from '../project.js';
import { minimalProject } from './fixtures/minimal.js';
import { chapelProject } from './fixtures/chapel-authored.js';
import { invalidOrphanProject } from './fixtures/invalid-orphan.js';

describe('validateProject', () => {
  it('accepts a valid minimal project', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects project with no spawn points', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'spawnPoints')).toBe(true);
  });

  it('rejects orphaned zone neighbor references', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('neighbors') && e.message.includes('zone-nonexistent'),
    )).toBe(true);
  });

  it('rejects district referencing nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('districts') && e.message.includes('zone-missing'),
    )).toBe(true);
  });

  it('rejects entity placement in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('entityPlacements') && e.message.includes('zone-void'),
    )).toBe(true);
  });

  it('rejects item placement in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('itemPlacements') && e.message.includes('zone-void'),
    )).toBe(true);
  });

  it('rejects connection referencing nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path === 'connections' && e.message.includes('zone-ghost'),
    )).toBe(true);
  });

  it('rejects landmark in nonexistent zone', () => {
    const result = validateProject(invalidOrphanProject);
    expect(result.errors.some((e) =>
      e.path.includes('landmarks') && e.message.includes('zone-phantom'),
    )).toBe(true);
  });

  it('detects duplicate zone IDs', () => {
    const duped = {
      ...minimalProject,
      zones: [minimalProject.zones[0], { ...minimalProject.zones[1], id: minimalProject.zones[0].id }],
    };
    const result = validateProject(duped);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate zone ID'))).toBe(true);
  });

  it('detects asymmetrical neighbors', () => {
    const asymmetric = {
      ...minimalProject,
      zones: [
        minimalProject.zones[0],
        { ...minimalProject.zones[1], neighbors: [] },  // cellar doesn't list entrance back
      ],
    };
    const result = validateProject(asymmetric);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('does not list'))).toBe(true);
  });

  // --- Dialogue validation ---

  it('accepts valid dialogues', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
  });

  it('rejects dialogue with missing entry node', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'nonexistent',
        nodes: { hello: { id: 'hello', speaker: 'NPC', text: 'Hi' } },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('entry node') && e.message.includes('nonexistent'))).toBe(true);
  });

  it('rejects dialogue with broken nextNodeId in choice', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: {
            id: 'start', speaker: 'NPC', text: 'Hello',
            choices: [{ id: 'c1', text: 'Go', nextNodeId: 'ghost-node' }],
          },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-node'))).toBe(true);
  });

  it('rejects dialogue with broken auto-advance nextNodeId', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: { id: 'start', speaker: 'NPC', text: 'Hello', nextNodeId: 'missing' },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('auto-advances') && e.message.includes('missing'))).toBe(true);
  });

  it('detects unreachable dialogue nodes', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [{
        id: 'dlg-bad', speakers: ['npc'], entryNodeId: 'start',
        nodes: {
          start: { id: 'start', speaker: 'NPC', text: 'Hello' },
          orphan: { id: 'orphan', speaker: 'NPC', text: 'Nobody reaches me' },
        },
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('unreachable') && e.message.includes('orphan'))).toBe(true);
  });

  it('rejects entity dialogueId referencing nonexistent dialogue', () => {
    const bad: WorldProject = {
      ...minimalProject,
      dialogues: [],
      entityPlacements: [
        { entityId: 'npc-1', zoneId: 'zone-entrance', role: 'npc', dialogueId: 'dlg-ghost' },
      ],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('dlg-ghost'))).toBe(true);
  });

  it('detects duplicate dialogue IDs', () => {
    const dlg = {
      id: 'dlg-dupe', speakers: ['npc'], entryNodeId: 'start',
      nodes: { start: { id: 'start', speaker: 'NPC', text: 'Hi' } },
    };
    const bad: WorldProject = { ...minimalProject, dialogues: [dlg, dlg] };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate dialogue ID'))).toBe(true);
  });

  // --- Player template validation ---

  it('accepts valid player template', () => {
    const result = validateProject(minimalProject);
    expect(result.valid).toBe(true);
  });

  it('rejects player template with invalid spawn point', () => {
    const bad: WorldProject = {
      ...minimalProject,
      playerTemplate: { ...minimalProject.playerTemplate!, spawnPointId: 'sp-nonexistent' },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'playerTemplate.spawnPointId')).toBe(true);
  });

  it('rejects player template with nonexistent starting inventory item', () => {
    const bad: WorldProject = {
      ...minimalProject,
      playerTemplate: { ...minimalProject.playerTemplate!, startingInventory: ['ghost-item'] },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-item'))).toBe(true);
  });

  it('rejects player template with nonexistent equipment item', () => {
    const bad: WorldProject = {
      ...minimalProject,
      playerTemplate: { ...minimalProject.playerTemplate!, startingEquipment: { weapon: 'phantom-sword' } },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('phantom-sword'))).toBe(true);
  });

  // --- Build catalog validation ---

  it('accepts valid build catalog (chapel)', () => {
    const result = validateProject(chapelProject);
    expect(result.valid).toBe(true);
  });

  it('rejects duplicate archetype IDs', () => {
    const bad: WorldProject = {
      ...chapelProject,
      buildCatalog: {
        ...chapelProject.buildCatalog!,
        archetypes: [chapelProject.buildCatalog!.archetypes[0], chapelProject.buildCatalog!.archetypes[0]],
      },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate archetype ID'))).toBe(true);
  });

  it('rejects archetype referencing nonexistent progression tree', () => {
    const bad: WorldProject = {
      ...chapelProject,
      buildCatalog: {
        ...chapelProject.buildCatalog!,
        archetypes: [{ ...chapelProject.buildCatalog!.archetypes[0], progressionTreeId: 'tree-ghost' }],
      },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('tree-ghost'))).toBe(true);
  });

  it('rejects cross-title referencing nonexistent archetype', () => {
    const bad: WorldProject = {
      ...chapelProject,
      buildCatalog: {
        ...chapelProject.buildCatalog!,
        crossTitles: [{ archetypeId: 'no-such', disciplineId: 'shadow-step', title: 'Test', tags: [] }],
      },
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('no-such'))).toBe(true);
  });

  // --- Progression tree validation ---

  it('rejects duplicate progression tree IDs', () => {
    const bad: WorldProject = {
      ...chapelProject,
      progressionTrees: [chapelProject.progressionTrees[0], chapelProject.progressionTrees[0]],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Duplicate progression tree ID'))).toBe(true);
  });

  it('rejects node requiring nonexistent node', () => {
    const bad: WorldProject = {
      ...minimalProject,
      progressionTrees: [{
        id: 'tree-bad', name: 'Bad Tree', currency: 'xp',
        nodes: [
          { id: 'root', name: 'Root', cost: 5, effects: [] },
          { id: 'child', name: 'Child', cost: 10, requires: ['ghost-node'], effects: [] },
        ],
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('ghost-node'))).toBe(true);
  });

  it('rejects tree with no root nodes', () => {
    const bad: WorldProject = {
      ...minimalProject,
      progressionTrees: [{
        id: 'tree-cycle', name: 'Cycle Tree', currency: 'xp',
        nodes: [
          { id: 'a', name: 'A', cost: 5, requires: ['b'], effects: [] },
          { id: 'b', name: 'B', cost: 5, requires: ['a'], effects: [] },
        ],
      }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('no root nodes'))).toBe(true);
  });
});
