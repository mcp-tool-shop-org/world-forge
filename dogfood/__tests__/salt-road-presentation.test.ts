// salt-road-presentation.test.ts — Salt Road carries the harbour occupancy
// the stage plays. Cells are copied from ai-rpg-stage
// fixtures/harbour-occupancy.json @ 839ad31; scaleForSandbox must not move them.

import { describe, it, expect } from 'vitest';
import { presentationAdvisories, validateProject } from '@world-forge/schema';
import { saltRoadProject } from '../worlds/salt-road.js';
import { scaleForSandbox } from '../worlds/sandbox-scale.js';

const OCCUPANCY_IDS = new Set([
    'player',
    'npc-corvane',
    'npc-halle',
    'npc-drell',
    'npc-tally-boy',
    'npc-stair-collector',
]);

const CHARACTERS = new Set(['merchant', 'elder', 'scribe', 'guard', 'child', 'fisherman']);

function cellInsideSpan(
    cell: readonly [number, number],
    anchor: readonly [number, number],
    span: number,
): boolean {
    const [cx, cy] = cell;
    const [ax, ay] = anchor;
    return cx >= ax && cx <= ax + span - 1 && cy >= ay && cy <= ay + span - 1;
}

describe('salt-road presentation', () => {
    const presentation = saltRoadProject.presentation;

    it('has no presentation advisories on the authored world', () => {
        expect(presentationAdvisories(saltRoadProject)).toEqual([]);
    });

    it('has no presentation advisories after scaleForSandbox', () => {
        expect(presentationAdvisories(scaleForSandbox(saltRoadProject))).toEqual([]);
    });

    it('does not put presentation on validateProject errors', () => {
        const presentationErrors = validateProject(saltRoadProject).errors
            .filter((e) => e.path.startsWith('presentation'));
        expect(presentationErrors).toEqual([]);
    });

    it('has exactly the six occupancy ids the sidecar names', () => {
        const occupancy = presentation?.occupancy ?? [];
        expect(occupancy).toHaveLength(6);
        expect(new Set(occupancy.map((row) => row.id))).toEqual(OCCUPANCY_IDS);
    });

    it('draws every non-player row in the zone the sim places them', () => {
        const occupancy = presentation?.occupancy ?? [];
        const placementZone = new Map(
            saltRoadProject.entityPlacements.map((p) => [p.entityId, p.zoneId]),
        );
        for (const row of occupancy) {
            if (row.id === 'player') continue;
            expect(row.zone).toBe(placementZone.get(row.id));
        }
    });

    it('uses only Foundry pack character ids', () => {
        for (const row of presentation?.occupancy ?? []) {
            expect(CHARACTERS.has(row.character)).toBe(true);
        }
    });

    it('anchors every authored zone and no other', () => {
        expect(new Set(Object.keys(presentation?.zoneCells ?? {})))
            .toEqual(new Set(saltRoadProject.zones.map((z) => z.id)));
    });

    it('gives Drell the only y_sort_proof, and it is front', () => {
        const occupancy = presentation?.occupancy ?? [];
        const withProof = occupancy.filter((row) => row.y_sort_proof !== undefined);
        expect(withProof).toHaveLength(1);
        expect(withProof[0].id).toBe('npc-drell');
        expect(withProof[0].y_sort_proof).toBe('front');
    });

    it('places every occupancy cell inside its zone span', () => {
        const span = presentation?.span ?? 0;
        const zoneCells = presentation?.zoneCells ?? {};
        for (const row of presentation?.occupancy ?? []) {
            const anchor = zoneCells[row.zone];
            expect(anchor, `no zoneCells anchor for ${row.zone}`).toBeDefined();
            expect(cellInsideSpan(row.cell, anchor, span)).toBe(true);
        }
    });
});
