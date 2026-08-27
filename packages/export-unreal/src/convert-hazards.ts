/**
 * convert-hazards.ts — WorldProject typed hazards → Unreal volume actors.
 *
 * A zone opts into hazards via `Zone.hazardRefs` (ids into hazardDefinitions).
 * Each (zone, hazard) pair exports as a volume covering the zone, with trigger /
 * effects / passability / vision / weather as typed fields the UE5 loader can
 * bind to an overlap actor. Refs with no matching definition are dropped with
 * a fidelity warning (Godot convert-hazards drop-unknown-ref contract).
 *
 * Definitions themselves also land on the manifest so hazardDefinitions
 * round-trips even when no zone currently references them.
 */

import type { WorldProject, HazardEffect, HazardDefinition } from '@world-forge/schema';
import { formatDroppedIdentities, type FidelityEntry } from './fidelity.js';
import {
  gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
  type UnrealVec3,
} from './coordinate-transform.js';

export type UnrealHazardEffect =
  | {
      Kind: 'damage';
      Amount: number;
      AmountIsPercentMaxHp?: boolean;
      TickOn: string;
      DurationTicks?: number;
    }
  | { Kind: 'status'; StatusId: string; Chance: number; Stacking: string }
  | { Kind: 'instakill' }
  | { Kind: 'ignite'; IgniteChance: number };

export interface UnrealHazardDefinition {
  Id: string;
  Name: string;
  Effects: UnrealHazardEffect[];
  Trigger: string;
  MoveCostDelta: number;
  Passable: string;
  BlocksVision: boolean;
  WeatherConditions?: string[];
  ImmuneTags?: string[];
  Tags: string[];
}

export interface UnrealHazardVolume {
  Id: string;
  HazardId: string;
  ZoneId: string;
  OriginCm: UnrealVec3;
  ExtentCm: { WidthCm: number; DepthCm: number; HeightCm: number };
  Trigger: string;
  MoveCostDelta: number;
  Passable: string;
  BlocksVision: boolean;
  Effects: UnrealHazardEffect[];
  Name?: string;
  Tags?: string[];
  WeatherConditions?: string[];
  ImmuneTags?: string[];
}

export interface UnrealHazardManifest {
  Volumes: UnrealHazardVolume[];
  Definitions: UnrealHazardDefinition[];
}

export interface ConvertHazardsResult {
  manifest: UnrealHazardManifest;
  fidelity: FidelityEntry[];
}

export function encodeHazardEffect(e: HazardEffect): UnrealHazardEffect {
  switch (e.kind) {
    case 'damage': {
      const out: UnrealHazardEffect = {
        Kind: 'damage',
        Amount: e.amount,
        TickOn: e.tickOn,
      };
      if (e.amountIsPercentMaxHp) out.AmountIsPercentMaxHp = true;
      if (e.durationTicks !== undefined) out.DurationTicks = e.durationTicks;
      return out;
    }
    case 'status':
      return { Kind: 'status', StatusId: e.statusId, Chance: e.chance, Stacking: e.stacking };
    case 'instakill':
      return { Kind: 'instakill' };
    case 'ignite':
      return { Kind: 'ignite', IgniteChance: e.igniteChance };
    default: {
      const _never: never = e;
      void _never;
      return { Kind: 'instakill' };
    }
  }
}

function definitionToUnreal(def: HazardDefinition): UnrealHazardDefinition {
  const out: UnrealHazardDefinition = {
    Id: def.id,
    Name: def.name,
    Effects: (def.effects ?? []).map(encodeHazardEffect),
    Trigger: def.trigger,
    MoveCostDelta: def.moveCostDelta ?? 0,
    Passable: def.passable ?? 'yes',
    BlocksVision: def.blocksVision ?? false,
    Tags: Array.isArray(def.tags) ? def.tags.slice() : [],
  };
  if (def.weatherConditions) out.WeatherConditions = def.weatherConditions.slice();
  if (def.immuneTags) out.ImmuneTags = def.immuneTags.slice();
  return out;
}

export function convertHazards(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertHazardsResult {
  const fidelity: FidelityEntry[] = [];
  const defsIn = project.hazardDefinitions ?? [];
  const hazardById = new Map(defsIn.map((h) => [h.id, h]));
  const definitions = defsIn.map(definitionToUnreal);

  const volumes: UnrealHazardVolume[] = [];
  const droppedRefs: string[] = [];
  const gatedZones = new Set<string>();

  for (const z of project.zones ?? []) {
    const refs = Array.isArray(z.hazardRefs) ? z.hazardRefs : [];
    if (refs.length === 0) continue;
    const origin = gridToUnrealAxis(z.gridX, z.gridY, tileSizeCm, z.elevation ?? 0);
    const extent = {
      WidthCm: Math.max(1, z.gridWidth) * tileSizeCm,
      DepthCm: Math.max(1, z.gridHeight) * tileSizeCm,
      HeightCm: tileSizeCm,
    };
    for (const ref of refs) {
      const def = hazardById.get(ref);
      if (!def) {
        droppedRefs.push(`zone "${z.id}" hazardId "${ref}"`);
        continue;
      }
      gatedZones.add(z.id);
      const uDef = definitionToUnreal(def);
      volumes.push({
        Id: `Hazard_${z.id}_${def.id}`,
        HazardId: def.id,
        ZoneId: z.id,
        OriginCm: origin,
        ExtentCm: extent,
        Trigger: uDef.Trigger,
        MoveCostDelta: uDef.MoveCostDelta,
        Passable: uDef.Passable,
        BlocksVision: uDef.BlocksVision,
        Effects: uDef.Effects,
        Name: def.name,
        Tags: uDef.Tags,
        WeatherConditions: uDef.WeatherConditions,
        ImmuneTags: uDef.ImmuneTags,
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
  if (volumes.length > 0) {
    fidelity.push({
      level: 'approximated',
      domain: 'structures',
      severity: 'info',
      fieldPath: 'hazardDefinitions',
      message: `${volumes.length} hazard volume(s) exported covering ${gatedZones.size} zone(s); the UE5 loader applies effects on overlap from the typed payload.`,
      reason: 'Hazards are zone-scoped volume actors; effect application (damage/status/etc.) is runtime-driven from the pack + content.',
    });
  } else if (definitions.length > 0) {
    fidelity.push({
      level: 'lossless',
      domain: 'structures',
      severity: 'info',
      fieldPath: 'hazardDefinitions',
      message: `${definitions.length} hazard definition(s) passed through with no zone volumes (no hazardRefs bound).`,
      reason: 'Typed definitions round-trip as UnrealHazardDefinition entries even when no zone currently references them.',
    });
  }

  return { manifest: { Volumes: volumes, Definitions: definitions }, fidelity };
}
