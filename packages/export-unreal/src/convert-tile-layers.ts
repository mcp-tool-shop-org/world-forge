/**
 * convert-tile-layers.ts — WorldProject tile layers → Unreal cell + collision payload.
 *
 * F-9615478f: UnrealZoneDataAsset.TilesetAssetId is not enough for a loader to
 * reconstruct the gameplay plane. This converter emits per-layer cells
 * (GridX/Y, TileId, AtlasCol/Row, Walkable, optional Color/Opacity) plus
 * CollisionBoxes from !walkable tiles. When a zone exceeds HISM_TILE_THRESHOLD
 * tiles, HISM instance transforms are attached (UE-FT-006).
 *
 * Color-only tilesets (no imagePath) use the same editor/renderer-2d tag→color
 * table as Godot convert-tile-layers.ts. Unknown tile ids are dropped.
 */

import type { WorldProject, Zone } from '@world-forge/schema';
import { formatDroppedIdentities, type FidelityEntry } from './fidelity.js';
import {
  gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
  type UnrealVec3,
} from './coordinate-transform.js';

/** Instanced-mesh hint threshold — UE-FT-006 ships when a zone has this many tiles or more. */
export const HISM_TILE_THRESHOLD = 50;

/**
 * Editor / renderer-2d tag→color table for tilesets with no imagePath.
 * Precedence: wall > water > door > floor. Keep in lockstep with
 * packages/editor/src/tile-render.ts `fallbackTileColor`.
 */
export function fallbackTileColor(tags: readonly string[]): string {
  if (tags.includes('wall')) return '#555555';
  if (tags.includes('water')) return '#2244aa';
  if (tags.includes('door')) return '#886622';
  return '#333333';
}

export interface UnrealTileCell {
  GridX: number;
  GridY: number;
  TileId: string;
  TilesetId: string;
  AtlasCol: number;
  AtlasRow: number;
  Walkable: boolean;
  /** Tag-derived CSS hex for !imageBacked placements. */
  Color?: string;
  /** TileDefinition.opacity for color-only placements (0–1). */
  Opacity?: number;
  ZoneId?: string;
}

export interface UnrealCollisionBox {
  OriginCm: UnrealVec3;
  ExtentCm: { WidthCm: number; DepthCm: number; HeightCm: number };
  Source: 'tile' | 'prop';
  TileId?: string;
  PropId?: string;
  ZoneId?: string;
}

export interface UnrealHismCluster {
  ZoneId: string;
  TileId: string;
  InstanceTransforms: UnrealVec3[];
}

export interface UnrealTileLayer {
  Id: string;
  Name: string;
  ZIndex: number;
  Cells: UnrealTileCell[];
  CollisionBoxes: UnrealCollisionBox[];
  TileCount: number;
  ImageBacked: boolean;
}

export interface UnrealTileManifest {
  Layers: UnrealTileLayer[];
  CollisionBoxes: UnrealCollisionBox[];
  HismClusters: UnrealHismCluster[];
}

export interface ConvertTileLayersResult {
  manifest: UnrealTileManifest;
  fidelity: FidelityEntry[];
}

function zoneForCell(zones: readonly Zone[], gridX: number, gridY: number): Zone | undefined {
  for (const z of zones) {
    if (
      gridX >= z.gridX && gridX < z.gridX + z.gridWidth &&
      gridY >= z.gridY && gridY < z.gridY + z.gridHeight
    ) {
      return z;
    }
  }
  return undefined;
}

export function convertTileLayers(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertTileLayersResult {
  const fidelity: FidelityEntry[] = [];
  const tilesets = Array.isArray(project.tilesets) ? project.tilesets : [];
  const zones = Array.isArray(project.zones) ? project.zones : [];

  const tileIndex = new Map<string, {
    tilesetId: string; atlasCol: number; atlasRow: number; imageBacked: boolean;
    walkable: boolean; tags: string[]; opacity: number;
  }>();
  for (const ts of tilesets) {
    const imageBacked = !!ts.imagePath;
    const tiles = Array.isArray(ts.tiles) ? ts.tiles : [];
    for (const t of tiles) {
      tileIndex.set(t.id, {
        tilesetId: ts.id,
        atlasCol: t.col,
        atlasRow: t.row,
        imageBacked,
        walkable: t.walkable,
        tags: Array.isArray(t.tags) ? t.tags : [],
        opacity: Number.isFinite(t.opacity) ? t.opacity : 1,
      });
    }
  }

  const layers: UnrealTileLayer[] = [];
  const allCollision: UnrealCollisionBox[] = [];
  const cellsByZone = new Map<string, UnrealTileCell[]>();

  const layerList = Array.isArray(project.tileLayers) ? project.tileLayers : [];
  for (const layer of layerList) {
    const cells: UnrealTileCell[] = [];
    const collision: UnrealCollisionBox[] = [];
    let tileCount = 0;
    const droppedTileIds: string[] = [];
    const placements = Array.isArray(layer.tiles) ? layer.tiles : [];
    let imageBacked = false;

    for (const placement of placements) {
      const def = tileIndex.get(placement.tileId);
      if (!def) {
        droppedTileIds.push(`tileId "${placement.tileId}"`);
        continue;
      }
      tileCount++;
      if (def.imageBacked) imageBacked = true;

      const zone = zoneForCell(zones, placement.gridX, placement.gridY);
      const cell: UnrealTileCell = {
        GridX: placement.gridX,
        GridY: placement.gridY,
        TileId: placement.tileId,
        TilesetId: def.tilesetId,
        AtlasCol: def.atlasCol,
        AtlasRow: def.atlasRow,
        Walkable: def.walkable,
        ZoneId: zone?.id,
      };
      if (!def.imageBacked) {
        cell.Color = fallbackTileColor(def.tags);
        cell.Opacity = def.opacity;
      }
      cells.push(cell);

      if (zone) {
        const bucket = cellsByZone.get(zone.id) ?? [];
        bucket.push(cell);
        cellsByZone.set(zone.id, bucket);
      }

      if (!def.walkable) {
        const box: UnrealCollisionBox = {
          OriginCm: gridToUnrealAxis(placement.gridX, placement.gridY, tileSizeCm, zone?.elevation ?? 0),
          ExtentCm: { WidthCm: tileSizeCm, DepthCm: tileSizeCm, HeightCm: tileSizeCm },
          Source: 'tile',
          TileId: placement.tileId,
          ZoneId: zone?.id,
        };
        collision.push(box);
        allCollision.push(box);
      }
    }

    layers.push({
      Id: layer.id,
      Name: layer.name,
      ZIndex: layer.zIndex,
      Cells: cells,
      CollisionBoxes: collision,
      TileCount: tileCount,
      ImageBacked: imageBacked,
    });

    if (droppedTileIds.length > 0) {
      fidelity.push({
        level: 'dropped',
        domain: 'tiles',
        severity: 'warning',
        entityId: layer.id,
        fieldPath: `tileLayers.${layer.id}.tiles`,
        message: `${droppedTileIds.length} tile placement(s) in layer "${layer.id}" reference tile ids not found in any tileset — dropped: ${formatDroppedIdentities(droppedTileIds)}.`,
        reason: 'A placement\'s tileId did not resolve to a TileDefinition; the cell cannot be exported.',
      });
    }

    if (tileCount > 0 && imageBacked) {
      fidelity.push({
        level: 'lossless',
        domain: 'tiles',
        severity: 'info',
        entityId: layer.id,
        fieldPath: `tileLayers.${layer.id}`,
        message: `Layer "${layer.id}" exported ${cells.length} cell(s) with atlas coords + walkable collision.`,
        reason: 'Image-backed tilesets bake GridX/Y, TileId, AtlasCol/Row, Walkable onto the pack.',
      });
    } else if (tileCount > 0) {
      fidelity.push({
        level: 'approximated',
        domain: 'tiles',
        severity: 'info',
        entityId: layer.id,
        fieldPath: `tileLayers.${layer.id}`,
        message: `Layer "${layer.id}" (${tileCount} tile(s)) exported as color-only cells (tag→color table); tileset(s) have no texture.`,
        reason: 'Color-only tilesets carry Color/Opacity so a loader can reconstruct the grid the editor shows.',
      });
    }
  }

  const hismClusters: UnrealHismCluster[] = [];
  for (const [zoneId, zoneCells] of cellsByZone) {
    if (zoneCells.length < HISM_TILE_THRESHOLD) continue;
    const byTile = new Map<string, UnrealTileCell[]>();
    for (const c of zoneCells) {
      const bucket = byTile.get(c.TileId) ?? [];
      bucket.push(c);
      byTile.set(c.TileId, bucket);
    }
    const zone = zones.find((z) => z.id === zoneId);
    for (const [tileId, group] of byTile) {
      hismClusters.push({
        ZoneId: zoneId,
        TileId: tileId,
        InstanceTransforms: group.map((c) =>
          gridToUnrealAxis(c.GridX, c.GridY, tileSizeCm, zone?.elevation ?? 0),
        ),
      });
    }
    fidelity.push({
      level: 'approximated',
      domain: 'tiles',
      severity: 'info',
      entityId: zoneId,
      fieldPath: `tiles.hism.${zoneId}`,
      message: `Zone "${zoneId}" has ${zoneCells.length} tile(s) (≥ ${HISM_TILE_THRESHOLD}) — emitted ${hismClusters.filter((h) => h.ZoneId === zoneId).length} HISM cluster(s) (UE-FT-006).`,
      reason: 'Instanced-mesh hints for the UE5 loader when a zone exceeds the HISM tile threshold.',
    });
  }

  return {
    manifest: {
      Layers: layers,
      CollisionBoxes: allCollision,
      HismClusters: hismClusters,
    },
    fidelity,
  };
}
