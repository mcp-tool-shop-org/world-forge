/**
 * convert-transitions.test.ts — TransitionEntity → Area2D.
 *
 * F-7a98b80b: orphan zoneIds were still pushed (then filtered out of the
 * scene with no dropped fidelity), and hyphen/underscore ids collided.
 */

import { describe, it, expect } from 'vitest';
import { convertTransitions } from '../convert-transitions.js';
import type { WorldProject, TransitionEntity, Zone } from '@world-forge/schema';

function zone(id: string): Zone {
    return { id, gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4 } as unknown as Zone;
}
function proj(zones: Zone[], transitions: TransitionEntity[]): WorldProject {
    return { map: { tileSize: 32 }, zones, transitions } as unknown as WorldProject;
}

describe('convertTransitions', () => {
    it('drops an orphan zoneId with a dropped fidelity error (does not push a lossless node)', () => {
        const { transitions, fidelity } = convertTransitions(proj(
            [zone('z1')],
            [{ id: 't1', zoneId: 'ghost', targetZoneId: 'z1', type: 'stairwell', gridX: 1, gridY: 1 }],
        ));
        expect(transitions).toHaveLength(0);
        expect(fidelity.some((f) => f.level === 'dropped' && f.fieldPath === 'transitions.t1.zoneId')).toBe(true);
        expect(fidelity.some((f) => f.level === 'lossless')).toBe(false);
    });

    it('uniquifies hyphen/underscore ids that sanitize to the same node name', () => {
        const { transitions } = convertTransitions(proj(
            [zone('z1')],
            [
                { id: 'a-b', zoneId: 'z1', targetZoneId: 'z1', type: 'warp', gridX: 1, gridY: 1 },
                { id: 'a_b', zoneId: 'z1', targetZoneId: 'z1', type: 'warp', gridX: 2, gridY: 2 },
            ],
        ));
        expect(transitions.map((t) => t.nodeName)).toEqual(['Transition_a_b', 'Transition_a_b_2']);
        expect(new Set(transitions.map((t) => t.nodeName)).size).toBe(2);
    });
});
