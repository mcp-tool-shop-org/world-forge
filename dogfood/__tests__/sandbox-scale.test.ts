// sandbox-scale.test.ts — regression coverage for F-4fd2946a.
//
// scaleForSandbox used a closed list of arrays (zones, landmarks, placements,
// …) and only remapped gridX/gridY/gridWidth/gridHeight. TransitionEntity.gridX
// and Building width/height were left at authored size inside a 3× map.

import { describe, it, expect } from 'vitest';
import { scaleForSandbox, SANDBOX_SCALE } from '../worlds/sandbox-scale.js';
import { saltRoadProject } from '../worlds/salt-road.js';

describe('scaleForSandbox (F-4fd2946a)', () => {
    it('is a 3× linear scale', () => {
        expect(SANDBOX_SCALE).toBe(3);
    });

    it('scales a transition at (4,7) and a 2×3 building to (12,21) and 6×9', () => {
        const zoneId = saltRoadProject.zones[0].id;
        const targetZoneId = saltRoadProject.zones[1]?.id ?? zoneId;
        const scaled = scaleForSandbox({
            ...saltRoadProject,
            transitions: [
                {
                    id: 'lift-test',
                    zoneId,
                    targetZoneId,
                    type: 'warp',
                    gridX: 4,
                    gridY: 7,
                },
            ],
            buildings: [
                {
                    id: 'bld-test',
                    name: 'Test Shop',
                    buildingType: 'shop',
                    gridX: 1,
                    gridY: 2,
                    width: 2,
                    height: 3,
                    tags: [],
                },
            ],
        });

        expect(scaled.transitions).toHaveLength(1);
        expect(scaled.transitions?.[0].gridX).toBe(12);
        expect(scaled.transitions?.[0].gridY).toBe(21);
        expect(scaled.buildings).toHaveLength(1);
        expect(scaled.buildings?.[0].width).toBe(6);
        expect(scaled.buildings?.[0].height).toBe(9);
        expect(scaled.buildings?.[0].gridX).toBe(3);
        expect(scaled.buildings?.[0].gridY).toBe(6);
    });
});
