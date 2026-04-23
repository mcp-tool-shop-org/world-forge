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
import { convertParallax, type UnrealParallaxManifest } from './convert-parallax.js';
import { convertTransitions, type UnrealTransitionEntity } from './convert-transitions.js';
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
  /** Original pixel tile size from WorldProject.map.tileSize — preserved for lossless round-trip. */
  SourceTileSizePx: number;
  /**
   * Pack format version (semver). Distinct from `Version` (the project's iteration version).
   * Loaders should check this to detect pack-format breakage independently of project
   * content changes. Bumped only when the UnrealContentPack *structure* changes.
   */
  FormatVersion: string;
}

/**
 * Current Unreal content-pack format version. Bumped when the structure of
 * UnrealContentPack changes in a way that a loader must know about. This is
 * NOT the project version.
 */
export const UNREAL_PACK_FORMAT_VERSION = '1.0.0';

export interface UnrealContentPack {
  Meta: UnrealPackMeta;
  Zones: UnrealZoneDataAsset[];
  Districts: UnrealDistrictDataAsset[];
  Actors: UnrealActorManifest;
  Connections: UnrealLevelStreamingHint[];
  WorldPartition: UnrealWorldPartitionHint;
  /** UE-FT-004: one actor entry per parallax layer across all zones. */
  Parallax: UnrealParallaxManifest;
  /** SCH-FT-004 passthrough: placed transition entities with presentation metadata. */
  Transitions: UnrealTransitionEntity[];
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
  // UE-B-001: guard bad `tileSizeCm` up front with the same contract the CLI uses.
  // This keeps API callers from ever entering a converter with a broken scale.
  const rawTileSizeCm = options?.tileSizeCm;
  if (rawTileSizeCm !== undefined && (!Number.isFinite(rawTileSizeCm) || rawTileSizeCm <= 0)) {
    return {
      success: false,
      errors: [
        {
          path: 'options.tileSizeCm',
          message: `tileSizeCm must be a positive finite number (got "${String(rawTileSizeCm)}").`,
        },
      ],
    };
  }

  const validation = validateProject(project);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const tileSizeCm = rawTileSizeCm ?? DEFAULT_TILE_SIZE_CM;
  const warnings: string[] = [];
  const fidelityEntries: FidelityEntry[] = [];

  // UE-B-005: wrap converter calls in a single try/catch so a converter bug
  // surfaces as a structured ValidationError rather than a raw exception on
  // the public API. CLI already has an outer catch; this keeps API callers safe.
  let zonesResult: ReturnType<typeof convertZones>;
  let districtsResult: ReturnType<typeof convertDistricts>;
  let entitiesResult: ReturnType<typeof convertEntities>;
  let connectionsResult: ReturnType<typeof convertConnections>;
  let worldPartitionResult: ReturnType<typeof convertWorldPartition>;
  let parallaxResult: ReturnType<typeof convertParallax>;
  let transitionsResult: ReturnType<typeof convertTransitions>;
  try {
    zonesResult = convertZones(project, tileSizeCm);
    districtsResult = convertDistricts(project);
    entitiesResult = convertEntities(project, tileSizeCm);
    connectionsResult = convertConnections(project);
    worldPartitionResult = convertWorldPartition(project, tileSizeCm);
    parallaxResult = convertParallax(project, tileSizeCm);
    transitionsResult = convertTransitions(project, tileSizeCm);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [
        {
          path: 'converter',
          message: `Converter failed: ${message}. Report this as a bug.`,
        },
      ],
    };
  }

  fidelityEntries.push(...zonesResult.fidelity);
  fidelityEntries.push(...districtsResult.fidelity);
  fidelityEntries.push(...entitiesResult.fidelity);
  fidelityEntries.push(...connectionsResult.fidelity);
  fidelityEntries.push(...worldPartitionResult.fidelity);
  fidelityEntries.push(...parallaxResult.fidelity);
  fidelityEntries.push(...transitionsResult.fidelity);
  const worldPartition = worldPartitionResult.hint;

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
    Parallax: parallaxResult.manifest,
    Transitions: transitionsResult.transitions,
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
    SourceTileSizePx: project.map.tileSize,
    FormatVersion: UNREAL_PACK_FORMAT_VERSION,
  };
}
