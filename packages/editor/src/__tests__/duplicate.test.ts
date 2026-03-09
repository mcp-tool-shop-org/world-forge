import { describe, it, expect } from 'vitest';
import { duplicateSelected, type SelectionSet } from '../duplicate.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';

// Use Chapel Threshold as base project
const project = chapelProject;
const empty: SelectionSet = { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] };

describe('duplicateSelected', () => {
  // 1. Empty selection returns unchanged project
  it('returns unchanged project for empty selection', () => {
    const result = duplicateSelected(project, empty);
    expect(result.project).toBe(project); // reference equality — no clone
    expect(result.newSelection).toEqual(empty);
  });

  // 2. Single zone duplicate: new ID, (copy) suffix, offset position, original still exists
  it('duplicates a single zone with (copy) suffix and offset position', () => {
    const sel: SelectionSet = { ...empty, zones: ['chapel-entrance'] };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    expect(newSelection.zones).toHaveLength(1);
    const newId = newSelection.zones[0];
    expect(newId).not.toBe('chapel-entrance');

    // Original zone still present
    const original = p.zones.find(z => z.id === 'chapel-entrance');
    expect(original).toBeDefined();
    expect(original!.gridX).toBe(10);
    expect(original!.gridY).toBe(0);

    // Duplicated zone has (copy) suffix and offset
    const dupe = p.zones.find(z => z.id === newId);
    expect(dupe).toBeDefined();
    expect(dupe!.name).toBe('Chapel Entrance (copy)');
    expect(dupe!.gridX).toBe(10 + 2);
    expect(dupe!.gridY).toBe(0 + 2);

    // Total zone count increased by 1
    expect(p.zones.length).toBe(project.zones.length + 1);
  });

  // 3. Zone + entity in that zone: entity zoneId remapped to new zone
  it('remaps entity zoneId to new zone when zone is co-selected', () => {
    const sel: SelectionSet = {
      zones: ['chapel-entrance'],
      entities: ['suspicious-pilgrim'],
      landmarks: [],
      spawns: [],
      encounters: [],
    };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    const newEntity = p.entityPlacements.find(e => e.entityId === newSelection.entities[0]);
    expect(newEntity).toBeDefined();
    // The entity's zoneId should be remapped to the new zone, not the original
    expect(newEntity!.zoneId).toBe(newSelection.zones[0]);
    expect(newEntity!.zoneId).not.toBe('chapel-entrance');
  });

  // 4. Connections between two duplicated zones are remapped; connections to non-duplicated zones are dropped
  it('remaps connections between duplicated zones and drops connections to non-duplicated zones', () => {
    // Select chapel-entrance and chapel-nave — they share a connection
    // chapel-nave also connects to chapel-alcove and vestry-door, which are NOT selected
    const sel: SelectionSet = {
      zones: ['chapel-entrance', 'chapel-nave'],
      entities: [],
      landmarks: [],
      spawns: [],
      encounters: [],
    };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    // Original connections are unchanged
    expect(p.connections.filter(c =>
      c.fromZoneId === 'chapel-entrance' || c.toZoneId === 'chapel-entrance',
    ).length).toBeGreaterThan(0);

    // New connections only between the two new zone IDs
    const [newEntrance, newNave] = newSelection.zones;
    const newConns = p.connections.filter(c =>
      (c.fromZoneId === newEntrance && c.toZoneId === newNave) ||
      (c.fromZoneId === newNave && c.toZoneId === newEntrance),
    );
    // The original has entrance->nave, so exactly 1 new connection
    expect(newConns).toHaveLength(1);
    expect(newConns[0].bidirectional).toBe(true);

    // No connections from new zones to old zones
    const crossConns = p.connections.filter(c =>
      (newSelection.zones.includes(c.fromZoneId) && !newSelection.zones.includes(c.toZoneId)) ||
      (!newSelection.zones.includes(c.fromZoneId) && newSelection.zones.includes(c.toZoneId)),
    );
    expect(crossConns).toHaveLength(0);
  });

  // 5. Spawn duplicate: isDefault is always false
  it('sets isDefault to false on duplicated spawn points', () => {
    const sel: SelectionSet = { ...empty, spawns: ['chapel-spawn'] };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    // Original spawn is still default
    const original = p.spawnPoints.find(s => s.id === 'chapel-spawn');
    expect(original!.isDefault).toBe(true);

    // Duplicated spawn is NOT default
    const dupe = p.spawnPoints.find(s => s.id === newSelection.spawns[0]);
    expect(dupe).toBeDefined();
    expect(dupe!.isDefault).toBe(false);
    expect(dupe!.gridX).toBe(15 + 2);
    expect(dupe!.gridY).toBe(5 + 2);
  });

  // 6. Zone in a district: new zone added to same district's zoneIds
  it('adds duplicated zone to the same district', () => {
    const sel: SelectionSet = { ...empty, zones: ['chapel-entrance'] };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    const district = p.districts.find(d => d.id === 'chapel-grounds');
    expect(district).toBeDefined();
    // Original zones still present
    expect(district!.zoneIds).toContain('chapel-entrance');
    // New zone added
    expect(district!.zoneIds).toContain(newSelection.zones[0]);
  });

  // 7. Landmark duplicate: offset position, remapped zoneId
  it('duplicates landmark with offset and remaps zoneId when zone is co-selected', () => {
    const sel: SelectionSet = {
      zones: ['chapel-nave'],
      entities: [],
      landmarks: ['altar-landmark'],
      spawns: [],
      encounters: [],
    };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    const dupe = p.landmarks.find(l => l.id === newSelection.landmarks[0]);
    expect(dupe).toBeDefined();
    expect(dupe!.gridX).toBe(20 + 2);
    expect(dupe!.gridY).toBe(15 + 2);
    // zoneId remapped to the new zone
    expect(dupe!.zoneId).toBe(newSelection.zones[0]);
    expect(dupe!.zoneId).not.toBe('chapel-nave');
  });

  // 8. Multiple zones: all get unique IDs
  it('gives each duplicated zone a unique ID', () => {
    const sel: SelectionSet = {
      zones: ['chapel-entrance', 'chapel-nave', 'chapel-alcove'],
      entities: [],
      landmarks: [],
      spawns: [],
      encounters: [],
    };
    const { newSelection } = duplicateSelected(project, sel);

    expect(newSelection.zones).toHaveLength(3);
    const unique = new Set(newSelection.zones);
    expect(unique.size).toBe(3);

    // None match original IDs
    for (const id of newSelection.zones) {
      expect(id).not.toBe('chapel-entrance');
      expect(id).not.toBe('chapel-nave');
      expect(id).not.toBe('chapel-alcove');
    }
  });

  // 9. Entity without zone co-selected: keeps original zoneId
  it('keeps original zoneId when entity zone is not co-selected', () => {
    const sel: SelectionSet = {
      zones: [],
      entities: ['brother-aldric'],
      landmarks: [],
      spawns: [],
      encounters: [],
    };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    const dupe = p.entityPlacements.find(e => e.entityId === newSelection.entities[0]);
    expect(dupe).toBeDefined();
    // Brother Aldric is in chapel-nave; zone not selected, so zoneId stays
    expect(dupe!.zoneId).toBe('chapel-nave');
  });

  // 10. newSelection contains exactly the new IDs
  it('newSelection contains exactly the IDs of duplicated objects', () => {
    const sel: SelectionSet = {
      zones: ['chapel-entrance', 'chapel-nave'],
      entities: ['suspicious-pilgrim'],
      landmarks: ['altar-landmark'],
      spawns: ['chapel-spawn'],
      encounters: [],
    };
    const { project: p, newSelection } = duplicateSelected(project, sel);

    // Correct counts
    expect(newSelection.zones).toHaveLength(2);
    expect(newSelection.entities).toHaveLength(1);
    expect(newSelection.landmarks).toHaveLength(1);
    expect(newSelection.spawns).toHaveLength(1);

    // All new IDs actually exist in the result project
    for (const zid of newSelection.zones) {
      expect(p.zones.find(z => z.id === zid)).toBeDefined();
    }
    for (const eid of newSelection.entities) {
      expect(p.entityPlacements.find(e => e.entityId === eid)).toBeDefined();
    }
    for (const lid of newSelection.landmarks) {
      expect(p.landmarks.find(l => l.id === lid)).toBeDefined();
    }
    for (const sid of newSelection.spawns) {
      expect(p.spawnPoints.find(s => s.id === sid)).toBeDefined();
    }

    // None of the new IDs match any original IDs
    for (const zid of newSelection.zones) {
      expect(sel.zones).not.toContain(zid);
    }
    for (const eid of newSelection.entities) {
      expect(sel.entities).not.toContain(eid);
    }
    for (const lid of newSelection.landmarks) {
      expect(sel.landmarks).not.toContain(lid);
    }
    for (const sid of newSelection.spawns) {
      expect(sel.spawns).not.toContain(sid);
    }
  });
});
