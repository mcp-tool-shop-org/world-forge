/**
 * convert-transitions.ts — TransitionEntity → Godot transition nodes.
 *
 * Transitions (elevators, warps, stairwells) become Area2D trigger zones
 * in the Godot scene that fire a signal when the player enters.
 */

import type { WorldProject, TransitionEntity, TransitionEntityType, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

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

    for (const t of src) {
        const zone = zonesById.get(t.zoneId);
        let gridX = t.gridX;
        let gridY = t.gridY;

        if (gridX === undefined || gridY === undefined) {
            gridX = zone?.gridX ?? 0;
            gridY = zone?.gridY ?? 0;
            fidelity.push({
                level: 'approximated',
                domain: 'transitions',
                severity: 'info',
                entityId: t.id,
                fieldPath: `transitions.${t.id}.position`,
                message: `Transition "${t.id}" position defaulted to zone origin.`,
                reason: 'No gridX/gridY authored.',
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

        const zoneOriginX = zone?.gridX ?? 0;
        const zoneOriginY = zone?.gridY ?? 0;
        const localPosition = gridToGodot2D(gridX - zoneOriginX, gridY - zoneOriginY, tileSize);

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
            nodeName: `Transition_${t.id.replace(/[^a-zA-Z0-9_]/g, '_')}`,
        });
    }

    return { transitions, fidelity };
}
