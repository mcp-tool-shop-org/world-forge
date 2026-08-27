/**
 * convert-hazards.test.ts — F-c1f4acbd typed hazards → Unreal volume actors.
 */

import { describe, it, expect } from 'vitest';
import { convertHazards } from '../convert-hazards.js';
import { convertZones } from '../convert-zones.js';
import type { WorldProject, HazardDefinition, Zone, ZoneEntryGate } from '@world-forge/schema';

function zone(
  id: string,
  gridX: number,
  gridY: number,
  w: number,
  h: number,
  over: Partial<Zone> = {},
): Zone {
  return {
    id, name: id, tags: [], description: '',
    gridX, gridY, gridWidth: w, gridHeight: h,
    neighbors: [], exits: [], light: 0, noise: 0,
    hazards: [], interactables: [],
    ...over,
  } as unknown as Zone;
}
function proj(zones: Zone[], hazardDefinitions: HazardDefinition[] = []): WorldProject {
  return { map: { tileSize: 32 }, zones, hazardDefinitions } as unknown as WorldProject;
}
const hazard = (id: string, over: Partial<HazardDefinition> = {}): HazardDefinition =>
  ({ id, name: id, effects: [{ kind: 'damage', amount: 5, tickOn: 'turn-end' }], trigger: 'on-enter', tags: [], ...over });

describe('convertHazards', () => {
  it('emits a volume covering the zone with typed hazard metadata', () => {
    const { manifest } = convertHazards(proj(
      [zone('z1', 0, 0, 4, 2, { hazardRefs: ['lava'] })],
      [hazard('lava', { trigger: 'per-turn', moveCostDelta: 2, passable: 'flying-only', blocksVision: true })],
    ), 100);
    expect(manifest.Volumes).toHaveLength(1);
    expect(manifest.Volumes[0]).toMatchObject({
      HazardId: 'lava', ZoneId: 'z1',
      ExtentCm: { WidthCm: 400, DepthCm: 200, HeightCm: 100 },
      Trigger: 'per-turn', MoveCostDelta: 2, Passable: 'flying-only', BlocksVision: true,
    });
    expect(manifest.Definitions).toHaveLength(1);
    expect(manifest.Definitions[0].Id).toBe('lava');
  });

  it('encodes the effects union as typed UnrealHazardEffect entries', () => {
    const { manifest } = convertHazards(proj(
      [zone('z1', 0, 0, 2, 2, { hazardRefs: ['mix'] })],
      [hazard('mix', { effects: [
        { kind: 'damage', amount: 8, tickOn: 'turn-end', durationTicks: 3 },
        { kind: 'status', statusId: 'poison', chance: 0.5, stacking: 'refresh' },
        { kind: 'instakill' },
        { kind: 'ignite', igniteChance: 0.3 },
      ] })],
    ));
    expect(manifest.Volumes[0].Effects).toEqual([
      { Kind: 'damage', Amount: 8, TickOn: 'turn-end', DurationTicks: 3 },
      { Kind: 'status', StatusId: 'poison', Chance: 0.5, Stacking: 'refresh' },
      { Kind: 'instakill' },
      { Kind: 'ignite', IgniteChance: 0.3 },
    ]);
  });

  it('drops a hazardRef with no matching definition and warns', () => {
    const { manifest, fidelity } = convertHazards(proj(
      [zone('z1', 0, 0, 2, 2, { hazardRefs: ['ghost'] })],
      [hazard('lava')],
    ));
    expect(manifest.Volumes).toHaveLength(0);
    const dropped = fidelity.find((f) => f.level === 'dropped' && f.fieldPath === 'zones.hazardRefs');
    expect(dropped).toBeDefined();
    expect(dropped!.message).toContain('ghost');
  });
});

describe('convertZones — entryGate + hazardRefs + stratum (F-c1f4acbd / F-a05c69b8)', () => {
  it('passthrough EntryGate { Mode, Conditions, Reason } and HazardRefs', () => {
    const gate: ZoneEntryGate = {
      conditions: ['party-level:>=10', 'item:iron-key'],
      mode: 'hard',
      reason: 'Locked.',
    };
    const { zones, fidelity } = convertZones(proj([
      zone('z1', 0, 0, 2, 2, { entryGate: gate, hazardRefs: ['lava'] }),
    ]));
    expect(zones[0].EntryGate).toEqual({
      Mode: 'hard', Conditions: ['party-level:>=10', 'item:iron-key'], Reason: 'Locked.',
    });
    expect(zones[0].HazardRefs).toEqual(['lava']);
    expect(fidelity.some((f) => f.fieldPath === 'zones.z1.entryGate' && f.level === 'approximated')).toBe(true);
    expect(fidelity.some((f) => f.fieldPath === 'zones.z1.hazardRefs' && f.level === 'approximated')).toBe(true);
  });

  it('stamps StratumId + ZBand when the stratum resolves', () => {
    const p = {
      map: { tileSize: 32 },
      zones: [zone('z1', 0, 0, 2, 2, { stratumId: 'sky' })],
      strata: [{ id: 'sky', name: 'Sky', order: 2, tags: [] }],
    } as unknown as WorldProject;
    const { zones } = convertZones(p);
    expect(zones[0].StratumId).toBe('sky');
    expect(zones[0].ZBand).toBe(200);
  });

  it('does not stamp ZBand for a ghost stratumId', () => {
    const p = {
      map: { tileSize: 32 },
      zones: [zone('z1', 0, 0, 2, 2, { stratumId: 'ghost' })],
      strata: [{ id: 'sky', name: 'Sky', order: 2, tags: [] }],
    } as unknown as WorldProject;
    const { zones } = convertZones(p);
    expect(zones[0].StratumId).toBeUndefined();
    expect(zones[0].ZBand).toBeUndefined();
  });
});
