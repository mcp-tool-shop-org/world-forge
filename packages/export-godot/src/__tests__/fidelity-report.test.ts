/**
 * fidelity-report.test.ts — Wave B-1.5 Godot-export fidelity honesty.
 *
 * Locks the corrected fidelity reporting: parallax is no longer claimed as a
 * lossless ParallaxBackground mapping, position-default fallbacks warn instead
 * of whispering info, and the unknown-role generic fallback is guarded (it was
 * flagged as "falls back to nothing" — it does not).
 */

import { describe, it, expect } from 'vitest';
import { convertZones } from '../convert-zones.js';
import { convertTransitions } from '../convert-transitions.js';
import { convertItems } from '../convert-items.js';
import { convertEntities } from '../convert-entities.js';
import type { WorldProject } from '@world-forge/schema';

function makeZone(over: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'z1', name: 'Z1', description: '', tags: [],
        gridX: 0, gridY: 0, gridWidth: 5, gridHeight: 3,
        light: 1, noise: 0, hazards: [], neighbors: [], exits: [], interactables: [],
        ...over,
    };
}

function makeProject(over: Record<string, unknown> = {}): WorldProject {
    return {
        map: { tileSize: 32, gridWidth: 100, gridHeight: 100 },
        zones: [makeZone()],
        entityPlacements: [],
        itemPlacements: [],
        transitions: [],
        connections: [],
        ...over,
    } as unknown as WorldProject;
}

describe('Godot fidelity reporting (Wave B-1.5)', () => {
    it('reports parallax as approximated metadata, not a false lossless ParallaxBackground mapping', () => {
        const project = makeProject({ zones: [makeZone({ parallaxLayers: [{ assetId: 'a', factor: 0.5 }] })] });
        const { fidelity } = convertZones(project);
        const parallax = fidelity.find((f) => f.fieldPath?.endsWith('.parallaxLayers'));
        expect(parallax).toBeDefined();
        expect(parallax!.level).toBe('approximated');
        expect(parallax!.message).not.toMatch(/mapped to ParallaxBackground/i);
    });

    it('warns (not info) when a transition position defaults to the zone origin', () => {
        const project = makeProject({
            transitions: [{ id: 't1', zoneId: 'z1', targetZoneId: 'z1', type: 'stairwell' }],
        });
        const { fidelity } = convertTransitions(project);
        const pos = fidelity.find((f) => f.fieldPath === 'transitions.t1.position');
        expect(pos?.severity).toBe('warning');
    });

    it('warns (not info) when an item position defaults to the zone origin', () => {
        const project = makeProject({
            itemPlacements: [{ itemId: 'i1', zoneId: 'z1', hidden: false }],
        });
        const { fidelity } = convertItems(project);
        const pos = fidelity.find((f) => f.fieldPath === 'itemPlacements.i1.position');
        expect(pos?.severity).toBe('warning');
    });

    it('warns (not info) when an entity position defaults to the zone origin', () => {
        const project = makeProject({
            entityPlacements: [{ entityId: 'e1', zoneId: 'z1', role: 'npc', name: 'E1' }],
        });
        const { fidelity } = convertEntities(project);
        const pos = fidelity.find((f) => f.fieldPath === 'entityPlacements.e1.position');
        expect(pos?.severity).toBe('warning');
    });

    it('maps a known entity role to its Godot scene template', () => {
        const project = makeProject({
            entityPlacements: [{ entityId: 'e1', zoneId: 'z1', role: 'merchant', gridX: 1, gridY: 1, name: 'M' }],
        });
        const { manifest } = convertEntities(project);
        expect(manifest.all[0].sceneTemplate).toBe('res://entities/merchant/merchant.tscn');
    });

    it('falls back to the generic scene WITH a warning for an unknown role — not to nothing', () => {
        const project = makeProject({
            entityPlacements: [{ entityId: 'e1', zoneId: 'z1', role: 'unknown-role', gridX: 1, gridY: 1, name: 'U' }],
        });
        const { manifest, fidelity } = convertEntities(project);
        expect(manifest.all[0].sceneTemplate).toBe('res://entities/npc/npc_generic.tscn');
        const roleWarn = fidelity.find((f) => f.fieldPath === 'entityPlacements.e1.role');
        expect(roleWarn?.severity).toBe('warning');
    });
});
