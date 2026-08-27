/**
 * convert-props.ts — WorldProject prop placements → Unreal actor payload.
 *
 * F-9615478f: props were KNOWN_DROPPED with "Blueprint catalogs". The pack now
 * emits each resolved placement (LocationCm, footprint, Walkable, Interactable)
 * plus a CollisionBox when PropDefinition.walkable is false, so the UE5 loader
 * can reconstruct interior blockers the editor shows.
 *
 * Orphan placements (propId not in any definition) are dropped with a warning.
 */

import type { WorldProject } from '@world-forge/schema';
import { formatDroppedIdentities, type FidelityEntry } from './fidelity.js';
import {
  gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
  type UnrealVec3,
} from './coordinate-transform.js';
import type { UnrealCollisionBox } from './convert-tile-layers.js';

export interface UnrealPropActor {
  Id: string;
  PropId: string;
  DisplayName: string;
  LocationCm: UnrealVec3;
  WidthTiles: number;
  HeightTiles: number;
  Walkable: boolean;
  Interactable: boolean;
  ImagePath?: string;
  ZoneId?: string;
  Tags: string[];
  CollisionBox?: UnrealCollisionBox;
}

export interface UnrealPropManifest {
  Actors: UnrealPropActor[];
  CollisionBoxes: UnrealCollisionBox[];
}

export interface ConvertPropsResult {
  manifest: UnrealPropManifest;
  fidelity: FidelityEntry[];
}

export function convertProps(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertPropsResult {
  const fidelity: FidelityEntry[] = [];
  const defs = new Map((project.props ?? []).map((p) => [p.id, p]));
  const zoneById = new Map((project.zones ?? []).map((z) => [z.id, z]));

  const actors: UnrealPropActor[] = [];
  const collision: UnrealCollisionBox[] = [];
  const droppedIds: string[] = [];

  for (const pl of project.propPlacements ?? []) {
    const def = defs.get(pl.propId);
    if (!def) {
      droppedIds.push(`placement "${pl.id}" (propId "${pl.propId}")`);
      continue;
    }
    const zone = pl.zoneId ? zoneById.get(pl.zoneId) : undefined;
    const location = gridToUnrealAxis(pl.gridX, pl.gridY, tileSizeCm, zone?.elevation ?? 0);
    const actor: UnrealPropActor = {
      Id: pl.id,
      PropId: pl.propId,
      DisplayName: def.name,
      LocationCm: location,
      WidthTiles: def.width,
      HeightTiles: def.height,
      Walkable: def.walkable,
      Interactable: def.interactable,
      ImagePath: def.imagePath,
      ZoneId: pl.zoneId,
      Tags: Array.isArray(def.tags) ? def.tags.slice() : [],
    };
    if (!def.walkable) {
      const box: UnrealCollisionBox = {
        OriginCm: location,
        ExtentCm: {
          WidthCm: Math.max(1, def.width) * tileSizeCm,
          DepthCm: Math.max(1, def.height) * tileSizeCm,
          HeightCm: tileSizeCm,
        },
        Source: 'prop',
        PropId: def.id,
        ZoneId: pl.zoneId,
      };
      actor.CollisionBox = box;
      collision.push(box);
    }
    actors.push(actor);
  }

  if (droppedIds.length > 0) {
    const listed = formatDroppedIdentities(droppedIds);
    const message = droppedIds.length === 1
      ? `Prop ${droppedIds[0]} dropped — no PropDefinition.`
      : `${droppedIds.length} prop placement(s) dropped — no PropDefinition: ${listed}.`;
    fidelity.push({
      level: 'dropped',
      domain: 'props',
      severity: 'warning',
      fieldPath: 'propPlacements',
      message,
      reason: 'A PropPlacement.propId did not resolve to a PropDefinition; the actor cannot be emitted.',
    });
  }
  if (actors.length > 0) {
    fidelity.push({
      level: 'approximated',
      domain: 'props',
      severity: 'info',
      fieldPath: 'propPlacements',
      message: `${actors.length} prop(s) exported with LocationCm + walkable collision; the UE5 loader binds meshes from ImagePath / Blueprint catalogs.`,
      reason: 'Props ship as placed actors with footprint + Walkable; mesh binding is a runtime step.',
    });
  }

  return { manifest: { Actors: actors, CollisionBoxes: collision }, fidelity };
}
