import { describe, it, expect } from 'vitest';
import { validateProject } from '@world-forge/schema';
import { AUTHORING_MODES } from '@world-forge/schema';
import { MODE_STARTERS, createProjectFromModeStarter } from '../templates/registry.js';
import { getModeProfile } from '../mode-profiles.js';

describe('MODE_STARTERS', () => {
  it('has exactly 7 entries (one per mode)', () => {
    expect(MODE_STARTERS.length).toBe(7);
  });

  it('covers all 7 authoring modes', () => {
    const modes = MODE_STARTERS.map((s) => s.mode).sort();
    expect(modes).toEqual([...AUTHORING_MODES].sort());
  });

  it('all starter IDs are unique', () => {
    const ids = MODE_STARTERS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(MODE_STARTERS)('mode starter: $name ($mode)', (starter) => {
  it('validates cleanly', () => {
    const result = validateProject(starter.project);
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it('has correct mode field', () => {
    expect(starter.project.mode).toBe(starter.mode);
  });

  it('has >= 3 zones', () => {
    expect(starter.project.zones.length).toBeGreaterThanOrEqual(3);
  });

  it('has >= 1 connection', () => {
    expect(starter.project.connections.length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 1 district', () => {
    expect(starter.project.districts.length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 1 spawn point', () => {
    expect(starter.project.spawnPoints.length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 2 entity placements', () => {
    expect(starter.project.entityPlacements.length).toBeGreaterThanOrEqual(2);
  });

  it('has >= 1 encounter anchor', () => {
    expect(starter.project.encounterAnchors.length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 2 item placements', () => {
    expect(starter.project.itemPlacements.length).toBeGreaterThanOrEqual(2);
  });

  it('has a player template', () => {
    expect(starter.project.playerTemplate).toBeDefined();
  });

  it('has a build catalog', () => {
    expect(starter.project.buildCatalog).toBeDefined();
  });

  it('has >= 1 dialogue', () => {
    expect(starter.project.dialogues.length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 1 faction presence', () => {
    expect(starter.project.factionPresences.length).toBeGreaterThanOrEqual(1);
  });

  it('has >= 1 pressure hotspot', () => {
    expect(starter.project.pressureHotspots.length).toBeGreaterThanOrEqual(1);
  });

  it('uses mode-native connection kinds', () => {
    const profile = getModeProfile(starter.mode);
    const allowedKinds = profile.connectionKinds;
    for (const conn of starter.project.connections) {
      if (conn.kind) {
        expect(allowedKinds).toContain(conn.kind);
      }
    }
  });

  it('uses mode-appropriate grid dimensions', () => {
    const profile = getModeProfile(starter.mode);
    expect(starter.project.map.gridWidth).toBe(profile.grid.width);
    expect(starter.project.map.gridHeight).toBe(profile.grid.height);
    expect(starter.project.map.tileSize).toBe(profile.grid.tileSize);
  });

  it('has non-empty description', () => {
    expect(starter.description.length).toBeGreaterThan(0);
  });
});

describe('createProjectFromModeStarter', () => {
  it('produces a valid project with custom name', () => {
    const starter = MODE_STARTERS[0];
    const project = createProjectFromModeStarter('My Dungeon', starter);
    expect(project.name).toBe('My Dungeon');
    expect(project.id).toMatch(/^project-\d+$/);
    expect(validateProject(project)).toEqual({ valid: true, errors: [] });
  });

  it('deep-clones (no shared references)', () => {
    const starter = MODE_STARTERS[0];
    const p1 = createProjectFromModeStarter('A', starter);
    const p2 = createProjectFromModeStarter('B', starter);
    p1.zones[0].name = 'MODIFIED';
    expect(p2.zones[0].name).not.toBe('MODIFIED');
    expect(starter.project.zones[0].name).not.toBe('MODIFIED');
  });

  it('uses starter name when no name provided', () => {
    const starter = MODE_STARTERS[0];
    const project = createProjectFromModeStarter('', starter);
    expect(project.name).toBe(starter.name);
  });
});
