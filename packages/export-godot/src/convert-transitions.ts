/**
 * convert-transitions.ts — TransitionEntity → Godot transition nodes.
 *
 * Transitions (elevators, warps, stairwells) become Area2D trigger zones
 * in the Godot scene that fire a signal when the player enters.
 */

import type { WorldProject, TransitionEntityType, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';
import { uniqueSiblingName } from './node-naming.js';

/** Godot scene template by transition type. */
const TYPE_TO_SCENE: Record<TransitionEntityType, string> = {
    elevator: 'res://transitions/elevator.tscn',
    warp: 'res://transitions/warp.tscn',
    transporter: 'res://transitions/transporter.tscn',
    'cargo-lift': 'res://transitions/cargo_lift.tscn',
    stairwell: 'res://transitions/stairwell.tscn',
};

export interface GodotTransitionNode {
    id: string;
    zoneId: string;
    targetZoneId: string;
    type: TransitionEntityType;
    /** Local position within zone (pixels). */
    localPosition: GodotVec2;
    /** Packed scene template reference. */
    sceneTemplate: string;
    label?: string;
    animation?: string;
    durationSeconds?: number;
    tags?: string[];
    nodeName: string;
}

export interface ConvertTransitionsResult {
    transitions: GodotTransitionNode[];
    fidelity: FidelityEntry[];
}

export function convertTransitions(project: WorldProject): ConvertTransitionsResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];
    const transitions: GodotTransitionNode[] = [];
    const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));
    const src = project.transitions ?? [];

    // Sibling names are unique within a zone's Transitions container, so
    // de-dup is scoped per zone. Hyphen/underscore ids (`a-b` vs `a_b`)
    // sanitize to the same token and must not silently collide.
    const seenByZone = new Map<string, Map<string, number>>();
    const uniqueNodeName = (zoneId: string, id: string): string => {
        let seen = seenByZone.get(zoneId);
        if (!seen) {
            seen = new Map<string, number>();
            seenByZone.set(zoneId, seen);
        }
        return uniqueSiblingName(seen, `Transition_${id}`, 'Transition');
    };

    for (const t of src) {
        const zone = zonesById.get(t.zoneId);
        if (!zone) {
            fidelity.push({
                level: 'dropped',
                domain: 'transitions',
                severity: 'error',
                entityId: t.id,
                fieldPath: `transitions.${t.id}.zoneId`,
                message: `Transition "${t.id}" dropped — zone "${t.zoneId}" not found.`,
                reason: 'Orphan zone reference.',
            });
            continue;
        }

        if (!zonesById.has(t.targetZoneId)) {
            fidelity.push({
                level: 'dropped',
                domain: 'transitions',
                severity: 'error',
                entityId: t.id,
                fieldPath: `transitions.${t.id}.targetZoneId`,
                message: `Transition "${t.id}" dropped — target zone "${t.targetZoneId}" not found.`,
                reason: 'Orphan target zone reference.',
            });
            continue;
        }

        let gridX = t.gridX;
        let gridY = t.gridY;

        if (gridX === undefined || gridY === undefined) {
            gridX = zone.gridX;
            gridY = zone.gridY;
            fidelity.push({
                level: 'approximated',
                domain: 'transitions',
                severity: 'warning',
                entityId: t.id,
                fieldPath: `transitions.${t.id}.position`,
                message: `Transition "${t.id}" position defaulted to zone origin — likely not the intended doorway; set gridX/gridY.`,
                reason: 'No gridX/gridY authored; zone origin is rarely the correct transition position.',
            });
        } else {
            fidelity.push({
                level: 'lossless',
                domain: 'transitions',
                severity: 'info',
                entityId: t.id,
                fieldPath: `transitions.${t.id}`,
                message: `Transition "${t.id}" (${t.type}) preserved.`,
                reason: 'Direct mapping to Godot Area2D trigger.',
            });
        }

        const localPosition = gridToGodot2D(gridX - zone.gridX, gridY - zone.gridY, tileSize);

        transitions.push({
            id: t.id,
            zoneId: t.zoneId,
            targetZoneId: t.targetZoneId,
            type: t.type,
            localPosition,
            sceneTemplate: TYPE_TO_SCENE[t.type],
            label: t.label,
            animation: t.animation,
            durationSeconds: t.durationSeconds,
            tags: t.tags?.slice(),
            nodeName: uniqueNodeName(t.zoneId, t.id),
        });
    }

    return { transitions, fidelity };
}
