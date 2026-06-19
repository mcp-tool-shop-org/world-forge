/**
 * convert-gates.test.ts — zone entry gates → Godot zone metadata map.
 */

import { describe, it, expect } from 'vitest';
import { convertGates } from '../convert-gates.js';
import type { WorldProject, Zone, ZoneEntryGate } from '@world-forge/schema';

function zone(id: string, entryGate?: ZoneEntryGate): Zone {
  return { id, gridX: 0, gridY: 0, gridWidth: 2, gridHeight: 2, entryGate } as unknown as Zone;
}
function proj(zones: Zone[]): WorldProject {
  return { map: { tileSize: 32 }, zones } as unknown as WorldProject;
}

describe('convertGates', () => {
  it('maps a gated zone to its gate', () => {
    const { zoneGates } = convertGates(proj([
      zone('z1', { conditions: ['party-level:>=10', 'item:iron-key'], mode: 'hard', reason: 'Locked.' }),
    ]));
    expect(zoneGates['z1']).toEqual({
      zoneId: 'z1', conditions: ['party-level:>=10', 'item:iron-key'], mode: 'hard', reason: 'Locked.',
    });
  });

  it('omits zones with no gate', () => {
    const { zoneGates } = convertGates(proj([zone('z1'), zone('z2', { conditions: ['always'], mode: 'soft' })]));
    expect(zoneGates['z1']).toBeUndefined();
    expect(zoneGates['z2']).toBeDefined();
  });

  it('reports an approximated entry when gates export', () => {
    const { fidelity } = convertGates(proj([zone('z1', { conditions: ['always'], mode: 'hard' })]));
    expect(fidelity.some((f) => f.level === 'approximated' && f.fieldPath === 'zones.entryGate')).toBe(true);
  });

  it('returns nothing for a gate-free project', () => {
    const { zoneGates, fidelity } = convertGates(proj([zone('z1')]));
    expect(Object.keys(zoneGates)).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });
});
