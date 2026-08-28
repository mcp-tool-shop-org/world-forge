/**
 * convert-hazards.ts — WorldProject typed hazards → Godot Area2D placements.
 *
 * A zone opts into hazards via `Zone.hazardRefs` (ids into hazardDefinitions).
 * Each (zone, hazard) pair exports as an Area2D covering the zone, with an inline
 * RectangleShape2D (collected in scene-builder, so it counts in load_steps) and
 * the hazard data as metadata. The pack ships `scripts/world_runtime.gd`
 * (F-54831eeb) which reads that metadata on `body_entered`. Refs with no
 * matching definition are dropped with a fidelity warning.
 */

import type { WorldProject, HazardEffect } from '@world-forge/schema';
import { formatDroppedIdentities, type FidelityEntry } from './fidelity.js';
import { resolveTileSize, type GodotVec2 } from './coordinate-transform.js';
import { sanitizeNodeName } from './node-naming.js';

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
    /** Compact effect encoding for metadata, e.g. "damage:5@turn-end:3t;status:poison@0.5:refresh". */
    effects: string;
    effectCount: number;
    /** Authored display name. */
    name?: string;
    tags?: string[];
    weatherConditions?: string[];
    immuneTags?: string[];
}

export interface ConvertHazardsResult {
    placements: GodotHazardPlacement[];
    fidelity: FidelityEntry[];
}

/** Compact, human-readable encoding of one effect for Godot metadata. */
function encodeEffect(e: HazardEffect): string {
    switch (e.kind) {
        case 'damage': {
            const pct = e.amountIsPercentMaxHp ? '%' : '';
            const duration = e.durationTicks !== undefined ? `:${e.durationTicks}t` : '';
            return `damage:${e.amount}${pct}@${e.tickOn}${duration}`;
        }
        case 'status': return `status:${e.statusId}@${e.chance}:${e.stacking}`;
        case 'instakill': return 'instakill';
        case 'ignite': return `ignite@${e.igniteChance}`;
    }
}

export function convertHazards(project: WorldProject): ConvertHazardsResult {
    const tileSize = resolveTileSize(project);
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
    const droppedRefs: string[] = [];

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
                droppedRefs.push(`zone "${z.id}" hazardId "${ref}"`);
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
                name: def.name,
                tags: def.tags.slice(),
                weatherConditions: def.weatherConditions?.slice(),
                immuneTags: def.immuneTags?.slice(),
            });
        }
    }

    if (droppedRefs.length > 0) {
        fidelity.push({
            level: 'dropped',
            domain: 'structures',
            severity: 'warning',
            fieldPath: 'zones.hazardRefs',
            message: `${droppedRefs.length} zone hazard ref(s) point to a hazardId with no matching definition — dropped: ${formatDroppedIdentities(droppedRefs)}.`,
            reason: 'A zone referenced a hazard that is not defined in hazardDefinitions.',
        });
    }
    if (placements.length > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'structures',
            severity: 'info',
            fieldPath: 'hazardDefinitions',
            message: `${placements.length} hazard placement(s) exported as Area2D regions (zone-sized collision) with hazard data as metadata; scripts/world_runtime.gd applies effects on body_entered.`,
            reason: 'Hazards are zone-scoped Area2D triggers; effect application (damage/status/etc.) is runtime-driven from the metadata + content pack.',
        });
    }

    return { placements, fidelity };
}
