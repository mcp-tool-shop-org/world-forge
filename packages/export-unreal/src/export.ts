/**
 * export.ts — Full export pipeline: WorldProject → UnrealContentPack + fidelity report.
 *
 * Peer to `@world-forge/export-ai-rpg` but targeted at UE5 2.5D games. The two
 * exporters consume the same WorldProject but emit different content packs.
 */

import type { WorldProject, ValidationError } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

import { convertZones, type UnrealZoneDataAsset } from './convert-zones.js';
import { convertDistricts, type UnrealDistrictDataAsset } from './convert-districts.js';
import { convertEntities, type UnrealActorManifest } from './convert-entities.js';
import { convertConnections, type UnrealLevelStreamingHint } from './convert-connections.js';
import { convertWorldPartition, type UnrealWorldPartitionHint } from './convert-world-partition.js';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';
import { DEFAULT_TILE_SIZE_CM } from './coordinate-transform.js';

export interface UnrealPackMeta {
  Id: string;
  Name: string;
  Description: string;
  Version: string;
  Author?: string;
  License?: string;
  Category?: string;
  Tags?: string[];
  /** Source project id at export time — lets the UE5 loader detect stale packs. */
  SourceProjectId: string;
  /** Tile size in cm used for all coordinate transforms in this pack. */
  TileSizeCm: number;
}

export interface UnrealContentPack {
  Meta: UnrealPackMeta;
  Zones: UnrealZoneDataAsset[];
  Districts: UnrealDistrictDataAsset[];
  Actors: UnrealActorManifest;
  Connections: UnrealLevelStreamingHint[];
  WorldPartition: UnrealWorldPartitionHint;
}

export interface UnrealExportOptions {
  /** Override the default world scale (100 cm/tile). */
  tileSizeCm?: number;
}

export interface UnrealExportResult {
  success: true;
  contentPack: UnrealContentPack;
  warnings: string[];
  fidelity: FidelityReport;
}

export interface UnrealExportError {
  success: false;
  errors: ValidationError[];
}

export function exportToUnreal(
  project: WorldProject,
  options?: UnrealExportOptions,
): UnrealExportResult | UnrealExportError {
  const validation = validateProject(project);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const tileSizeCm = options?.tileSizeCm ?? DEFAULT_TILE_SIZE_CM;
  const warnings: string[] = [];
  const fidelityEntries: FidelityEntry[] = [];

  const zonesResult = convertZones(project, tileSizeCm);
  fidelityEntries.push(...zonesResult.fidelity);

  const districtsResult = convertDistricts(project);
  fidelityEntries.push(...districtsResult.fidelity);

  const entitiesResult = convertEntities(project, tileSizeCm);
  fidelityEntries.push(...entitiesResult.fidelity);

  const connectionsResult = convertConnections(project);
  fidelityEntries.push(...connectionsResult.fidelity);

  const worldPartition = convertWorldPartition(project, tileSizeCm);

  // Advisory warnings (non-fatal).
  if (project.entityPlacements.length === 0) {
    warnings.push('No entity placements — the exported world will spawn no actors.');
  }
  if (project.connections.length === 0 && project.zones.length > 1) {
    warnings.push('Multiple zones but no connections — UE5 loader cannot stream between them.');
  }
  if (project.zones.every((z) => z.elevation === undefined && z.elevationRange === undefined)) {
    warnings.push('No zone elevation authored — everything exports at Z=0. Fine for top-down, flat for 2.5D.');
  }
  if (project.zones.every((z) => !z.parallaxLayers || z.parallaxLayers.length === 0)) {
    warnings.push('No parallax layers authored — 2.5D backdrops will be bare.');
  }

  const contentPack: UnrealContentPack = {
    Meta: buildMeta(project, tileSizeCm),
    Zones: zonesResult.zones,
    Districts: districtsResult.districts,
    Actors: entitiesResult.manifest,
    Connections: connectionsResult.connections,
    WorldPartition: worldPartition,
  };

  return {
    success: true,
    contentPack,
    warnings,
    fidelity: buildFidelityReport(fidelityEntries),
  };
}

function buildMeta(project: WorldProject, tileSizeCm: number): UnrealPackMeta {
  return {
    Id: project.id,
    Name: project.name,
    Description: project.description,
    Version: project.version,
    Author: project.author,
    License: project.license,
    Category: project.category,
    Tags: project.projectTags,
    SourceProjectId: project.id,
    TileSizeCm: tileSizeCm,
  };
}
