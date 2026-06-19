/**
 * convert-structures.test.ts — town structures (buildings/hubs/strongholds) →
 * Godot node conversion.
 */

import { describe, it, expect } from 'vitest';
import { convertStructures } from '../convert-structures.js';
import type { WorldProject, Building, Hub, Stronghold, Zone } from '@world-forge/schema';

function zone(id: string, gridX: number, gridY: number, w: number, h: number): Zone {
  return { id, gridX, gridY, gridWidth: w, gridHeight: h } as unknown as Zone;
}
function proj(
  zones: Zone[],
  buildings: Building[] = [],
  hubs: Hub[] = [],
  strongholds: Stronghold[] = [],
  tileSize = 32,
): WorldProject {
  return { map: { tileSize }, zones, buildings, hubs, strongholds } as unknown as WorldProject;
}
const building = (id: string, over: Partial<Building> = {}): Building =>
  ({ id, name: id, buildingType: 'house', gridX: 3, gridY: 4, width: 2, height: 3, tags: [], ...over });
const hub = (id: string, over: Partial<Hub> = {}): Hub =>
  ({ id, name: id, zoneId: 'z1', hubType: 'town-center', serviceTypes: [], connectedZoneIds: [], tags: [], ...over });
const stronghold = (id: string, over: Partial<Stronghold> = {}): Stronghold =>
  ({ id, name: id, zoneId: 'z1', defenseLevel: 1, garrisonEntityIds: [], tags: [], ...over });

describe('convertStructures — buildings', () => {
  it('positions a building at its footprint origin and computes its pixel footprint', () => {
    const { buildings } = convertStructures(proj([], [building('b1')]));
    expect(buildings).toHaveLength(1);
    // origin = (3 * 32, 4 * 32) = (96, 128); footprint = (2 * 32, 3 * 32) = (64, 96)
    expect(buildings[0]).toMatchObject({
      id: 'b1', buildingType: 'house', position: { x: 96, y: 128 },
      footprint: { w: 64, h: 96 }, widthTiles: 2, heightTiles: 3,
    });
  });

  it('keeps a building even with no matching zone (absolute coordinates)', () => {
    const { buildings } = convertStructures(proj([], [building('b1', { zoneId: 'ghost' })]));
    expect(buildings).toHaveLength(1);
    expect(buildings[0].zoneId).toBe('ghost');
  });

  it('preserves the interior zone link', () => {
    const { buildings } = convertStructures(proj([], [building('b1', { interiorZoneId: 'inn-interior' })]));
    expect(buildings[0].interiorZoneId).toBe('inn-interior');
  });

  it('reports an approximated entry when buildings export', () => {
    const { fidelity } = convertStructures(proj([], [building('b1')]));
    expect(fidelity.some((f) => f.domain === 'structures' && f.level === 'approximated' && f.fieldPath === 'buildings')).toBe(true);
  });
});

describe('convertStructures — hubs', () => {
  it('positions a hub at its zone center + carries metadata', () => {
    const { hubs } = convertStructures(proj(
      [zone('z1', 0, 0, 4, 2)], [],
      [hub('h1', { hubType: 'market-square', serviceTypes: ['market', 'inn'], connectedZoneIds: ['z2'] })],
    ));
    // center = ((0 + 4/2) * 32, (0 + 2/2) * 32) = (64, 32)
    expect(hubs[0]).toMatchObject({
      id: 'h1', position: { x: 64, y: 32 }, hubType: 'market-square',
      serviceTypes: ['market', 'inn'], connectedZoneIds: ['z2'],
    });
  });

  it('drops a hub whose zone is missing and warns', () => {
    const { hubs, fidelity } = convertStructures(proj([], [], [hub('h1', { zoneId: 'ghost' })]));
    expect(hubs).toHaveLength(0);
    expect(fidelity.some((f) => f.domain === 'structures' && f.level === 'dropped')).toBe(true);
  });
});

describe('convertStructures — strongholds', () => {
  it('positions a stronghold at its zone center + carries metadata', () => {
    const { strongholds } = convertStructures(proj(
      [zone('z1', 2, 2, 2, 2)], [], [],
      [stronghold('s1', { factionId: 'iron-legion', defenseLevel: 5, garrisonEntityIds: ['npc-guard'] })],
    ));
    // center = ((2 + 1) * 32, (2 + 1) * 32) = (96, 96)
    expect(strongholds[0]).toMatchObject({
      id: 's1', position: { x: 96, y: 96 }, factionId: 'iron-legion',
      defenseLevel: 5, garrisonEntityIds: ['npc-guard'],
    });
  });

  it('drops a stronghold whose zone is missing and warns', () => {
    const { strongholds, fidelity } = convertStructures(proj([], [], [], [stronghold('s1', { zoneId: 'ghost' })]));
    expect(strongholds).toHaveLength(0);
    expect(fidelity.some((f) => f.domain === 'structures' && f.level === 'dropped')).toBe(true);
  });
});

describe('convertStructures — empty', () => {
  it('returns nothing for a structure-free project', () => {
    const { buildings, hubs, strongholds, fidelity } = convertStructures(proj([zone('z1', 0, 0, 1, 1)]));
    expect(buildings).toHaveLength(0);
    expect(hubs).toHaveLength(0);
    expect(strongholds).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });

  it('tolerates a legacy project missing the structure arrays', () => {
    const legacy = { map: { tileSize: 32 }, zones: [] } as unknown as WorldProject;
    expect(() => convertStructures(legacy)).not.toThrow();
  });
});
