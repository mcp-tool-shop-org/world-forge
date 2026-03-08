import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import type { WorldProject } from '../project.js';
import { minimalProject } from './fixtures/minimal.js';
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
});
