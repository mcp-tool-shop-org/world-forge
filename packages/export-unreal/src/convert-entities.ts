// convert-entities.ts — EntityPlacement → ActorSpawnManifest entries

import type { WorldProject, EntityRole, Zone } from '@world-forge/schema';
import { gridToUnrealAxis, DEFAULT_TILE_SIZE_CM, type UnrealVec3 } from './coordinate-transform.js';
import type { FidelityEntry } from './fidelity.js';

/**
 * UE5 side is expected to resolve `BlueprintTag` to a `BlueprintClass` via a
 * data-table lookup. We tag by role so the mapping stays loader-side.
 */
export type UnrealBlueprintTag =
  | 'BP_NPC_Generic'
  | 'BP_Enemy_Generic'
  | 'BP_Merchant'
  | 'BP_QuestGiver'
  | 'BP_Companion'
  | 'BP_Boss';

const ROLE_TO_BP_TAG: Record<EntityRole, UnrealBlueprintTag> = {
  npc: 'BP_NPC_Generic',
  enemy: 'BP_Enemy_Generic',
  merchant: 'BP_Merchant',
  'quest-giver': 'BP_QuestGiver',
  companion: 'BP_Companion',
  boss: 'BP_Boss',
};

/** Safe fallback tag used when a role is not in `ROLE_TO_BP_TAG`. */
const FALLBACK_BP_TAG: UnrealBlueprintTag = 'BP_NPC_Generic';

export interface UnrealActorSpawnEntry {
  ActorId: string;
  DisplayName?: string;
  ZoneId: string;
  LocationCm: UnrealVec3;
  BlueprintTag: UnrealBlueprintTag;
  Role: EntityRole;
  FactionId?: string;
  DialogueId?: string;
  SpawnCondition?: string;
  Tags?: string[];
  Custom?: Record<string, string>;
  Stats?: Record<string, number>;
  Resources?: Record<string, number>;
  AI?: { ProfileId?: string; Goals?: string[]; Fears?: string[] };
  PortraitAssetId?: string;
  SpriteAssetId?: string;
}

export interface UnrealActorManifest {
  /** Actor spawns grouped by zone id for per-level streaming. */
  ByZone: Record<string, UnrealActorSpawnEntry[]>;
  /** Flat list for callers that want a single iteration. */
  All: UnrealActorSpawnEntry[];
}

export interface ConvertEntitiesResult {
  manifest: UnrealActorManifest;
  fidelity: FidelityEntry[];
}

export function convertEntities(project: WorldProject, tileSizeCm: number = DEFAULT_TILE_SIZE_CM): ConvertEntitiesResult {
  const fidelity: FidelityEntry[] = [];
  const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));
  const byZone: Record<string, UnrealActorSpawnEntry[]> = {};
  const all: UnrealActorSpawnEntry[] = [];

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
      continue;
    }

    const gridX = placement.gridX ?? zone.gridX;
    const gridY = placement.gridY ?? zone.gridY;
    const elevationMeters = zone.elevation ?? 0;

    if (placement.gridX === undefined || placement.gridY === undefined) {
      fidelity.push({
        level: 'approximated',
        domain: 'entities',
        severity: 'info',
        entityId: placement.entityId,
        fieldPath: `entityPlacements.${placement.entityId}.gridX/gridY`,
        message: `Entity "${placement.entityId}" placed at zone origin — no explicit grid coords.`,
        reason: 'Defaulted to parent zone gridX/gridY.',
      });
    }

    const mappedTag: UnrealBlueprintTag | undefined = ROLE_TO_BP_TAG[placement.role];
    let blueprintTag: UnrealBlueprintTag;
    if (mappedTag === undefined) {
      blueprintTag = FALLBACK_BP_TAG;
      fidelity.push({
        level: 'approximated',
        domain: 'entities',
        severity: 'warning',
        entityId: placement.entityId,
        fieldPath: `entityPlacements.${placement.entityId}.role`,
        message: `Entity "${placement.entityId}" has unknown role "${String(placement.role)}" — defaulted BlueprintTag to "${FALLBACK_BP_TAG}".`,
        reason: 'Role has no mapping in ROLE_TO_BP_TAG.',
      });
    } else {
      blueprintTag = mappedTag;
    }

    const entry: UnrealActorSpawnEntry = {
      ActorId: placement.entityId,
      DisplayName: placement.name,
      ZoneId: placement.zoneId,
      LocationCm: gridToUnrealAxis(gridX, gridY, tileSizeCm, elevationMeters),
      BlueprintTag: blueprintTag,
      Role: placement.role,
      FactionId: placement.factionId,
      DialogueId: placement.dialogueId,
      SpawnCondition: placement.spawnCondition,
      Tags: placement.tags,
      Custom: placement.custom,
      Stats: scalarRecord(placement.stats),
      Resources: scalarRecord(placement.resources),
      AI: placement.ai
        ? { ProfileId: placement.ai.profileId, Goals: placement.ai.goals, Fears: placement.ai.fears }
        : undefined,
      PortraitAssetId: placement.portraitId,
      SpriteAssetId: placement.spriteId,
    };

    all.push(entry);
    (byZone[placement.zoneId] ??= []).push(entry);
  }

  return { manifest: { ByZone: byZone, All: all }, fidelity };
}

function scalarRecord(source?: Record<string, number | undefined>): Record<string, number> | undefined {
  if (!source) return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === 'number') out[k] = v;
  }
  return Object.keys(out).length === 0 ? undefined : out;
}
