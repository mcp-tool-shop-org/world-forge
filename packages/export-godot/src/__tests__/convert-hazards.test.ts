/**
 * convert-hazards.test.ts — typed hazards → Godot Area2D placements.
 */

import { describe, it, expect } from 'vitest';
import { convertHazards } from '../convert-hazards.js';
import type { WorldProject, HazardDefinition, Zone } from '@world-forge/schema';

function zone(id: string, gridX: number, gridY: number, w: number, h: number, hazardRefs?: string[]): Zone {
  return { id, gridX, gridY, gridWidth: w, gridHeight: h, hazardRefs } as unknown as Zone;
}
function proj(zones: Zone[], hazardDefinitions: HazardDefinition[] = [], tileSize = 32): WorldProject {
  return { map: { tileSize }, zones, hazardDefinitions } as unknown as WorldProject;
}
const hazard = (id: string, over: Partial<HazardDefinition> = {}): HazardDefinition =>
  ({ id, name: id, effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-end' }], trigger: 'on-enter', tags: [], ...over });

describe('convertHazards', () => {
  it('emits an Area2D placement covering the zone, with hazard metadata', () => {
    const { placements } = convertHazards(proj(
      [zone('z1', 0, 0, 4, 2, ['lava'])],
      [hazard('lava', { trigger: 'per-turn', moveCostDelta: 2, passable: 'flying-only', blocksVision: true })],
    ));
    expect(placements).toHaveLength(1);
    // center = ((0+4/2)*32, (0+2/2)*32) = (64, 32); size = (4*32, 2*32) = (128, 64)
    expect(placements[0]).toMatchObject({
      hazardId: 'lava', zoneId: 'z1', position: { x: 64, y: 32 }, size: { w: 128, h: 64 },
      trigger: 'per-turn', moveCostDelta: 2, passable: 'flying-only', blocksVision: true,
    });
  });

  it('encodes the effects union compactly for metadata', () => {
    const { placements } = convertHazards(proj(
      [zone('z1', 0, 0, 2, 2, ['mix'])],
      [hazard('mix', { effects: [
        { kind: 'damage', amount: 8, tickOn: 'turn-start' },
        { kind: 'status', statusId: 'poison', chance: 0.5, stacking: 'refresh' },
        { kind: 'instakill' },
        { kind: 'ignite', igniteChance: 0.3 },
      ] })],
    ));
    expect(placements[0].effectCount).toBe(4);
    expect(placements[0].effects).toBe('damage:8@turn-start;status:poison@0.5;instakill;ignite@0.3');
  });

  it('emits one Area2D per (zone, hazardRef) pair', () => {
    const { placements } = convertHazards(proj(
      [zone('z1', 0, 0, 2, 2, ['a', 'b'])],
      [hazard('a'), hazard('b')],
    ));
    expect(placements.map((p) => p.hazardId).sort()).toEqual(['a', 'b']);
  });

  it('drops a hazardRef with no matching definition and warns', () => {
    const { placements, fidelity } = convertHazards(proj([zone('z1', 0, 0, 2, 2, ['ghost'])], [hazard('lava')]));
    expect(placements).toHaveLength(0);
    expect(fidelity.some((f) => f.level === 'dropped' && f.fieldPath === 'zones.hazardRefs')).toBe(true);
  });

  it('reports an approximated entry when hazards export', () => {
    const { fidelity } = convertHazards(proj([zone('z1', 0, 0, 2, 2, ['lava'])], [hazard('lava')]));
    expect(fidelity.some((f) => f.level === 'approximated' && f.fieldPath === 'hazardDefinitions')).toBe(true);
  });

  it('returns nothing for a hazard-free project', () => {
    const { placements, fidelity } = convertHazards(proj([zone('z1', 0, 0, 1, 1)]));
    expect(placements).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });

  it('tolerates a legacy project missing hazard arrays', () => {
    const legacy = { map: { tileSize: 32 }, zones: [] } as unknown as WorldProject;
    expect(() => convertHazards(legacy)).not.toThrow();
  });
});
