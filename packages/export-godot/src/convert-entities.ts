/**
 * convert-entities.ts — EntityPlacement → Godot scene instance entries.
 *
 * Each entity becomes a child node in the zone scene. Godot convention:
 * - NPCs → Node2D with attached script (res://entities/<role>/<entityId>.tscn)
 * - Enemies → CharacterBody2D or similar
 * - Role determines the scene template reference
 */

import type { WorldProject, EntityPlacement, EntityRole, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { gridToGodot2D, DEFAULT_TILE_SIZE_PX, type GodotVec2 } from './coordinate-transform.js';

/** Godot scene template path pattern by role. */
export type GodotSceneTemplate =
    | 'res://entities/npc/npc_generic.tscn'
    | 'res://entities/enemy/enemy_generic.tscn'
    | 'res://entities/merchant/merchant.tscn'
    | 'res://entities/quest_giver/quest_giver.tscn'
    | 'res://entities/companion/companion.tscn'
    | 'res://entities/boss/boss.tscn';

const ROLE_TO_SCENE: Record<EntityRole, GodotSceneTemplate> = {
    npc: 'res://entities/npc/npc_generic.tscn',
    enemy: 'res://entities/enemy/enemy_generic.tscn',
    merchant: 'res://entities/merchant/merchant.tscn',
    'quest-giver': 'res://entities/quest_giver/quest_giver.tscn',
    companion: 'res://entities/companion/companion.tscn',
    boss: 'res://entities/boss/boss.tscn',
};

const FALLBACK_SCENE: GodotSceneTemplate = 'res://entities/npc/npc_generic.tscn';

export interface GodotEntityInstance {
    /** Unique instance name in the scene tree. */
    nodeName: string;
    /** The packed scene this instance derives from. */
    sceneTemplate: GodotSceneTemplate;
    entityId: string;
    displayName?: string;
    zoneId: string;
    /** Position relative to zone origin (pixels, Y-down). */
    localPosition: GodotVec2;
    role: EntityRole;
    factionId?: string;
    dialogueId?: string;
    spawnCondition?: string;
    tags: string[];
    custom?: Record<string, string>;
    stats?: Record<string, number>;
    resources?: Record<string, number>;
    ai?: { profileId?: string; goals?: string[]; fears?: string[] };
    portraitAssetId?: string;
    spriteAssetId?: string;
}

export interface GodotDroppedEntity {
    entityId: string;
    zoneId: string;
    reason: string;
}

export interface GodotEntityManifest {
    /** Entities grouped by zone ID (for per-zone scene composition). */
    byZone: Record<string, GodotEntityInstance[]>;
    /** Flat list of all valid instances. */
    all: GodotEntityInstance[];
    /** Entities that couldn't be converted. */
    dropped: GodotDroppedEntity[];
    incomplete: boolean;
}

export interface ConvertEntitiesResult {
    manifest: GodotEntityManifest;
    fidelity: FidelityEntry[];
}

export function convertEntities(project: WorldProject): ConvertEntitiesResult {
    const tileSize = project.map.tileSize || DEFAULT_TILE_SIZE_PX;
    const fidelity: FidelityEntry[] = [];
    const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));
    const byZone: Record<string, GodotEntityInstance[]> = {};
    const all: GodotEntityInstance[] = [];
    const dropped: GodotDroppedEntity[] = [];

    for (const placement of project.entityPlacements) {
        const zone = zonesById.get(placement.zoneId);
        if (!zone) {
            fidelity.push({
                level: 'dropped',
                domain: 'entities',
                severity: 'error',
                entityId: placement.entityId,
                fieldPath: `entityPlacements.${placement.entityId}.zoneId`,
                message: `Entity "${placement.entityId}" dropped — zone "${placement.zoneId}" not found.`,
                reason: 'Orphan zone reference.',
            });
            dropped.push({ entityId: placement.entityId, zoneId: placement.zoneId, reason: `Zone "${placement.zoneId}" not found.` });
            continue;
        }

        // Position: prefer authored gridX/Y, fall back to zone origin.
        const gridX = placement.gridX ?? zone.gridX;
        const gridY = placement.gridY ?? zone.gridY;

        if (placement.gridX === undefined || placement.gridY === undefined) {
            fidelity.push({
                level: 'approximated',
                domain: 'entities',
                severity: 'warning',
                entityId: placement.entityId,
                fieldPath: `entityPlacements.${placement.entityId}.position`,
                message: `Entity "${placement.entityId}" position defaulted to zone "${zone.id}" origin — set gridX/gridY to place it precisely.`,
                reason: 'No gridX/gridY authored; zone origin is rarely the intended entity position.',
            });
        }

        // Compute local position relative to zone origin.
        const localPosition = gridToGodot2D(gridX - zone.gridX, gridY - zone.gridY, tileSize);

        const sceneTemplate = ROLE_TO_SCENE[placement.role] ?? FALLBACK_SCENE;
        if (!(placement.role in ROLE_TO_SCENE)) {
            fidelity.push({
                level: 'approximated',
                domain: 'entities',
                severity: 'warning',
                entityId: placement.entityId,
                fieldPath: `entityPlacements.${placement.entityId}.role`,
                message: `Entity "${placement.entityId}" role "${placement.role}" has no Godot scene template — defaulted to npc_generic.`,
                reason: 'Unknown role mapped to generic fallback.',
            });
        }

        const instance: GodotEntityInstance = {
            nodeName: sanitizeNodeName(placement.name ?? placement.entityId),
            sceneTemplate,
            entityId: placement.entityId,
            displayName: placement.name,
            zoneId: placement.zoneId,
            localPosition,
            role: placement.role,
            factionId: placement.factionId,
            dialogueId: placement.dialogueId,
            spawnCondition: placement.spawnCondition,
            tags: placement.tags?.slice() ?? [],
            custom: placement.custom ? { ...placement.custom } : undefined,
            portraitAssetId: placement.portraitId,
            spriteAssetId: placement.spriteId,
        };

        // Convert stats/resources to flat records for Godot export metadata.
        if (placement.stats) {
            instance.stats = { ...placement.stats } as unknown as Record<string, number>;
        }
        if (placement.resources) {
            instance.resources = { ...placement.resources } as unknown as Record<string, number>;
        }
        if (placement.ai) {
            instance.ai = {
                profileId: placement.ai.profileId,
                goals: placement.ai.goals?.slice(),
                fears: placement.ai.fears?.slice(),
            };
        }

        all.push(instance);
        if (!byZone[placement.zoneId]) byZone[placement.zoneId] = [];
        byZone[placement.zoneId].push(instance);
    }

    return {
        manifest: { byZone, all, dropped, incomplete: dropped.length > 0 },
        fidelity,
    };
}

function sanitizeNodeName(name: string): string {
    return name.replace(/[/@\s]/g, '_').replace(/^(\d)/, '_$1');
}
