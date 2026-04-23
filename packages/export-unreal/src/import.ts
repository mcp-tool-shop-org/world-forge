/**
 * import.ts — UnrealContentPack → WorldProject (reverse pipeline).
 *
 * Best-effort reconstruction. Some gameplay-only fields (progression trees,
 * build catalogs, dialogues) are not part of the Unreal content pack and
 * cannot be recovered — those are flagged as `dropped` in the fidelity report.
 */

import type {
  WorldProject, Zone, ZoneExit, Interactable,
  District, EntityPlacement, EntityRole,
  ZoneConnection, ParallaxLayer,
} from '@world-forge/schema';
import { DEFAULT_MODE } from '@world-forge/schema';
import type { UnrealContentPack } from './export.js';
import type { UnrealZoneDataAsset } from './convert-zones.js';
import type { UnrealDistrictDataAsset } from './convert-districts.js';
import type { UnrealActorSpawnEntry } from './convert-entities.js';
import type { UnrealLevelStreamingHint } from './convert-connections.js';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';

export interface UnrealImportResult {
  success: true;
  project: WorldProject;
  fidelity: FidelityReport;
}

export interface UnrealImportError {
  success: false;
  errors: string[];
}

export function importFromUnreal(pack: UnrealContentPack): UnrealImportResult | UnrealImportError {
  const fidelity: FidelityEntry[] = [];

  // Reconstruct a sensible tile size. Default is 100 cm/tile.
  const tileSizeCm = pack.Meta.TileSizeCm > 0 ? pack.Meta.TileSizeCm : 100;

  // Reconstruct the original pixel tile size. Older packs (pre UE-A-001 fix) did
  // not serialize SourceTileSizePx — in that case we fall back to 32 and flag
  // the loss so the importer is honest about it.
  let tileSizePx = 32;
  const rawTileSizePx = (pack.Meta as { SourceTileSizePx?: number }).SourceTileSizePx;
  if (typeof rawTileSizePx === 'number' && Number.isFinite(rawTileSizePx) && rawTileSizePx > 0) {
    tileSizePx = rawTileSizePx;
  } else {
    fidelity.push({
      level: 'dropped',
      domain: 'world',
      severity: 'warning',
      fieldPath: 'map.tileSize',
      message: 'Original pixel tile size not present on pack — defaulting to 32.',
      reason: 'UnrealPackMeta.SourceTileSizePx missing (pre UE-A-001 pack or hand-edited meta).',
    });
  }

  const zones: Zone[] = pack.Zones.map((z) => zoneFromUnreal(z, tileSizeCm, fidelity));
  const districts: District[] = pack.Districts.map(districtFromUnreal);
  const entityPlacements: EntityPlacement[] = pack.Actors.All.map((a) =>
    entityFromUnreal(a, tileSizeCm, fidelity),
  );
  const connections: ZoneConnection[] = pack.Connections.map(connectionFromUnreal);

  const project: WorldProject = {
    id: pack.Meta.Id,
    name: pack.Meta.Name,
    description: pack.Meta.Description,
    version: pack.Meta.Version,

    genre: '',
    tones: [],
    difficulty: '',
    narratorTone: '',
    mode: pack.WorldPartition.SourceMode ?? DEFAULT_MODE,

    author: pack.Meta.Author,
    license: pack.Meta.License,
    category: pack.Meta.Category,
    projectTags: pack.Meta.Tags,

    map: {
      id: `${pack.Meta.Id}-map`,
      name: pack.Meta.Name,
      description: pack.Meta.Description,
      gridWidth: Math.max(1, Math.round(pack.WorldPartition.ExtentCm.WidthCm / tileSizeCm)),
      gridHeight: Math.max(1, Math.round(pack.WorldPartition.ExtentCm.DepthCm / tileSizeCm)),
      tileSize: tileSizePx,
    },
    zones,
    connections,
    districts,
    landmarks: [],

    factionPresences: [],
    pressureHotspots: [],

    dialogues: [],

    progressionTrees: [],

    entityPlacements,
    itemPlacements: [],
    encounterAnchors: [],
    spawnPoints: [],
    craftingStations: [],
    marketNodes: [],

    tilesets: [],
    tileLayers: [],
    props: [],
    propPlacements: [],
    ambientLayers: [],
    assets: [],
    assetPacks: [],
  };

  // Flag fields that an UE5 pack never carries.
  fidelity.push({
    level: 'dropped',
    domain: 'dialogues',
    severity: 'warning',
    message: 'Dialogues not recoverable from Unreal pack — gameplay-only data.',
    reason: 'Unreal exporter does not serialize dialogue trees.',
  });

  return { success: true, project, fidelity: buildFidelityReport(fidelity) };
}

function zoneFromUnreal(u: UnrealZoneDataAsset, tileSizeCm: number, fidelity: FidelityEntry[]): Zone {
  const gridX = Math.round(u.OriginCm.X / tileSizeCm);
  const gridY = Math.round(-u.OriginCm.Y / tileSizeCm);

  const zone: Zone = {
    id: u.Id,
    name: u.DisplayName,
    tags: u.Tags.slice(),
    description: u.Description,
    gridX,
    gridY,
    gridWidth: u.GridWidthTiles,
    gridHeight: u.GridHeightTiles,
    neighbors: u.Neighbors.slice(),
    exits: u.Exits.map<ZoneExit>((e) => ({
      targetZoneId: e.TargetZoneId,
      label: e.Label,
      condition: e.Condition,
    })),
    light: u.Light,
    noise: u.Noise,
    hazards: u.Hazards.slice(),
    interactables: u.Interactables.map<Interactable>((i) => ({
      name: i.Name,
      type: i.Type as Interactable['type'],
      description: i.Description,
    })),
    parentDistrictId: u.ParentDistrictId,
    backgroundId: u.BackgroundAssetId,
    tilesetId: u.TilesetAssetId,
    skylineRef: u.SkylineAssetId,
  };

  if (u.ElevationCm !== 0 || u.ElevationRangeCm) {
    zone.elevation = u.ElevationCm / 100;
  }
  if (u.ElevationRangeCm) {
    zone.elevationRange = {
      floor: u.ElevationRangeCm.FloorCm / 100,
      ceiling: u.ElevationRangeCm.CeilingCm / 100,
    };
  }
  if (u.ParallaxLayers && u.ParallaxLayers.length > 0) {
    zone.parallaxLayers = u.ParallaxLayers.map<ParallaxLayer>((p) => ({
      id: p.Id,
      depth: p.Depth,
      assetRef: p.AssetRef,
      scrollFactor: p.ScrollFactor,
    }));
  }

  void fidelity;
  return zone;
}

function districtFromUnreal(u: UnrealDistrictDataAsset): District {
  return {
    id: u.Id,
    name: u.DisplayName,
    zoneIds: u.ZoneIds.slice(),
    tags: u.Tags.slice(),
    controllingFaction: u.ControllingFaction,
    baseMetrics: {
      commerce: u.BaseMetrics.Commerce,
      morale: u.BaseMetrics.Morale,
      safety: u.BaseMetrics.Safety,
      stability: u.BaseMetrics.Stability,
    },
    economyProfile: {
      supplyCategories: u.EconomyProfile.SupplyCategories.slice(),
      scarcityDefaults: { ...u.EconomyProfile.ScarcityDefaults },
    },
  };
}

function entityFromUnreal(u: UnrealActorSpawnEntry, tileSizeCm: number, fidelity: FidelityEntry[]): EntityPlacement {
  const gridX = Math.round(u.LocationCm.X / tileSizeCm);
  const gridY = Math.round(-u.LocationCm.Y / tileSizeCm);

  // Flag sub-grid placements: any actor whose cm location doesn't fall exactly
  // on a tile boundary will be snapped by the Math.round() above. The original
  // authored placement may have been fractional in UE and is lost on import.
  if (u.LocationCm.X % tileSizeCm !== 0 || u.LocationCm.Y % tileSizeCm !== 0) {
    fidelity.push({
      level: 'approximated',
      domain: 'entities',
      severity: 'info',
      entityId: u.ActorId,
      fieldPath: `entityPlacements.${u.ActorId}.gridX/gridY`,
      message: `Entity "${u.ActorId}" sub-grid placement (${u.LocationCm.X}, ${u.LocationCm.Y} cm) snapped to grid (${gridX}, ${gridY}).`,
      reason: `LocationCm not aligned to tileSizeCm=${tileSizeCm}; WorldProject grid is integer-only.`,
    });
  }

  if (!isEntityRole(u.Role)) {
    fidelity.push({
      level: 'approximated',
      domain: 'entities',
      severity: 'warning',
      entityId: u.ActorId,
      message: `Entity "${u.ActorId}" role "${u.Role}" not recognized — defaulting to "npc".`,
      reason: 'Role not in EntityRole union.',
    });
  }

  return {
    entityId: u.ActorId,
    name: u.DisplayName,
    zoneId: u.ZoneId,
    gridX,
    gridY,
    role: isEntityRole(u.Role) ? u.Role : 'npc',
    spawnCondition: u.SpawnCondition,
    factionId: u.FactionId,
    dialogueId: u.DialogueId,
    stats: u.Stats,
    resources: u.Resources,
    ai: u.AI ? { profileId: u.AI.ProfileId, goals: u.AI.Goals, fears: u.AI.Fears } : undefined,
    tags: u.Tags,
    custom: u.Custom,
    portraitId: u.PortraitAssetId,
    spriteId: u.SpriteAssetId,
  };
}

function connectionFromUnreal(u: UnrealLevelStreamingHint): ZoneConnection {
  return {
    fromZoneId: u.FromZoneId,
    toZoneId: u.ToZoneId,
    kind: u.Kind,
    bidirectional: u.Bidirectional,
    label: u.Label,
    condition: u.Condition,
  };
}

function isEntityRole(value: string): value is EntityRole {
  return value === 'npc' || value === 'enemy' || value === 'merchant'
    || value === 'quest-giver' || value === 'companion' || value === 'boss';
}
