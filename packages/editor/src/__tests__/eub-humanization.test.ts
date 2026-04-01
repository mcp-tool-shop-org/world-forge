// Tests for EUB humanization dogfood findings
import { describe, it, expect, vi } from 'vitest';
import { buildSearchIndex } from '../panels/SearchOverlay.js';
import { emptyStateMessage } from '../panels/ObjectListPanel.js';
import { getOrderedKinds } from '../panels/ConnectionProperties.js';
import { generateZoneId } from '../Canvas.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import type { WorldProject } from '@world-forge/schema';

// Helper: create a minimal project for testing
function minimalProject(): WorldProject {
  return structuredClone(SAMPLE_WORLDS[0].project);
}

// EUB-008: buildSearchIndex warns when parent zone is missing for entity/landmark/spawn
describe('EUB-008: buildSearchIndex warns on orphaned children', () => {
  it('warns when entity references missing zone', () => {
    const project = minimalProject();
    // Add an entity referencing a non-existent zone
    project.entityPlacements.push({
      entityId: 'orphan-entity',
      zoneId: 'deleted-zone-999',
      role: 'npc',
    } as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildSearchIndex(project);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Entity "orphan-entity" references missing zone'),
    );
    warnSpy.mockRestore();
  });

  it('warns when landmark references missing zone', () => {
    const project = minimalProject();
    project.landmarks.push({
      id: 'orphan-landmark',
      zoneId: 'deleted-zone-999',
      name: 'Lost Marker',
      gridX: 0, gridY: 0,
    } as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildSearchIndex(project);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Landmark "orphan-landmark" references missing zone'),
    );
    warnSpy.mockRestore();
  });

  it('warns when spawn references missing zone', () => {
    const project = minimalProject();
    project.spawnPoints.push({
      id: 'orphan-spawn',
      zoneId: 'deleted-zone-999',
      gridX: 0, gridY: 0,
      isDefault: false,
    } as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    buildSearchIndex(project);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Spawn "orphan-spawn" references missing zone'),
    );
    warnSpy.mockRestore();
  });

  it('does not warn when parent zone exists', () => {
    const project = minimalProject();
    // Ensure at least one entity with a valid zone
    if (project.entityPlacements.length > 0) {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      buildSearchIndex(project);
      // Should not have warned about missing zones for existing data
      const orphanWarns = warnSpy.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('references missing zone'),
      );
      expect(orphanWarns).toHaveLength(0);
      warnSpy.mockRestore();
    }
  });
});

// EUB-012: generateZoneId produces unique IDs
describe('EUB-012: generateZoneId utility', () => {
  it('returns unique IDs on successive calls', () => {
    const id1 = generateZoneId();
    const id2 = generateZoneId();
    expect(id1).not.toBe(id2);
  });

  it('starts with zone- prefix', () => {
    const id = generateZoneId();
    expect(id).toMatch(/^zone-\d+-\d+$/);
  });
});

// EUB-005: getOrderedKinds still works
describe('EUB-005: connection kind ordering', () => {
  it('returns preferred and other kinds', () => {
    const result = getOrderedKinds('dungeon');
    expect(result.preferred.length).toBeGreaterThan(0);
    expect(result.preferred.length + result.other.length).toBe(12); // all 12 connection kinds
  });

  it('handles undefined mode', () => {
    const result = getOrderedKinds(undefined);
    expect(result.preferred.length + result.other.length).toBe(12);
  });
});

// EUB-014: ObjectListPanel emptyStateMessage
describe('EUB-014: ObjectListPanel emptyStateMessage', () => {
  it('returns mode-appropriate message', () => {
    const msg = emptyStateMessage('dungeon');
    expect(msg).toContain('Zone tool');
  });

  it('handles undefined mode', () => {
    const msg = emptyStateMessage(undefined);
    expect(msg).toContain('Zone tool');
  });
});
