/**
 * convert-hazards.ts — WorldProject typed hazards → Godot Area2D placements.
 *
 * A zone opts into hazards via `Zone.hazardRefs` (ids into hazardDefinitions).
 * Each (zone, hazard) pair exports as an Area2D covering the zone, with an inline
 * RectangleShape2D (collected in scene-builder, so it counts in load_steps) and
 * the hazard data as metadata. The runtime reads the metadata on `body_entered`
 * to apply effects (Godot research: Area2D + body_entered + metadata is the
 * textureless, self-contained hazard hook). Refs with no matching definition are
 * dropped with a fidelity warning.
 */

import type { WorldProject, HazardEffect } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

export interface GodotHazardPlacement {
    nodeName: string;
    hazardId: string;
    zoneId: string;
    /** Area2D position — the zone center (the rect is centered on the CollisionShape2D). */
    position: GodotVec2;
    /** Collision rect size in pixels (the zone's extent). */
    size: { w: number; h: number };
    trigger: string;
    moveCostDelta: number;
    passable: string;
    blocksVision: boolean;
    /** Compact effect encoding for metadata, e.g. "damage:5@turn-end;status:poison@0.5". */
    effects: string;
    effectCount: number;
}

export interface ConvertHazardsResult {
    placements: GodotHazardPlacement[];
    fidelity: FidelityEntry[];
}

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@]/g, '_').replace(/\s+/g, '_');
}

/** Compact, human-readable encoding of one effect for Godot metadata. */
function encodeEffect(e: HazardEffect): string {
    switch (e.kind) {
        case 'damage': return `damage:${e.amount}${e.amountIsPercentMaxHp ? '%' : ''}@${e.tickOn}`;
        case 'status': return `status:${e.statusId}@${e.chance}`;
        case 'instakill': return 'instakill';
        case 'ignite': return `ignite@${e.igniteChance}`;
    }
}

export function convertHazards(project: WorldProject): ConvertHazardsResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];

    const hazardById = new Map((project.hazardDefinitions ?? []).map((h) => [h.id, h]));

    const seen = new Map<string, number>();
    const uniqueName = (base: string): string => {
        const safe = sanitizeNodeName(base) || 'Node';
        const n = seen.get(safe) ?? 0;
        seen.set(safe, n + 1);
        return n === 0 ? safe : `${safe}_${n + 1}`;
    };

    const placements: GodotHazardPlacement[] = [];
    let dropped = 0;

    for (const z of project.zones) {
        const refs = z.hazardRefs ?? [];
        if (refs.length === 0) continue;
        const center: GodotVec2 = {
            x: (z.gridX + z.gridWidth / 2) * tileSize,
            y: (z.gridY + z.gridHeight / 2) * tileSize,
        };
        const size = { w: Math.max(1, z.gridWidth * tileSize), h: Math.max(1, z.gridHeight * tileSize) };
        for (const ref of refs) {
            const def = hazardById.get(ref);
            if (!def) {
                dropped++;
                continue;
            }
            placements.push({
                nodeName: uniqueName(`Hazard_${z.id}_${def.id}`),
                hazardId: def.id,
                zoneId: z.id,
                position: center,
                size,
                trigger: def.trigger,
                moveCostDelta: def.moveCostDelta ?? 0,
                passable: def.passable ?? 'yes',
                blocksVision: def.blocksVision ?? false,
                effects: def.effects.map(encodeEffect).join(';'),
                effectCount: def.effects.length,
            });
        }
    }

    if (dropped > 0) {
        fidelity.push({
            level: 'dropped',
            domain: 'structures',
            severity: 'warning',
            fieldPath: 'zones.hazardRefs',
            message: `${dropped} zone hazard ref(s) point to a hazardId with no matching definition — dropped.`,
            reason: 'A zone referenced a hazard that is not defined in hazardDefinitions.',
        });
    }
    if (placements.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'structures',
            severity: 'info',
            fieldPath: 'hazardDefinitions',
            message: `${placements.length} hazard placement(s) exported as Area2D regions (zone-sized collision) with hazard data as metadata; the runtime applies effects on body_entered.`,
            reason: 'Hazards are zone-scoped Area2D triggers; effect application (damage/status/etc.) is runtime-driven from the metadata + content pack.',
        });
    }

    return { placements, fidelity };
}
