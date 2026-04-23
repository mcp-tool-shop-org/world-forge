// convert-zones.ts — WorldProject zones → Unreal UZoneDataAsset JSON entries

import type { WorldProject, Zone, ParallaxLayer } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import { elevationToZ, gridToUnrealAxis, DEFAULT_TILE_SIZE_CM, type UnrealVec3 } from './coordinate-transform.js';

/**
 * A Primary Data Asset JSON shape the UE5 loader (Blueprint or C++) can consume.
 * Field names use PascalCase to line up with Unreal's property naming.
 */
export interface UnrealZoneDataAsset {
  /** Primary asset id. Matches WorldProject Zone.id for round-trip. */
  Id: string;
  DisplayName: string;
  Description: string;
  Tags: string[];
  /** Origin of the zone's bounding box in Unreal cm (world space, Z-up, Y-flipped). */
  OriginCm: UnrealVec3;
  /** Tile-grid size in tile units (retained for UE5 grid-aware systems). */
  GridWidthTiles: number;
  GridHeightTiles: number;
  /** Bounding extent in Unreal cm on the gameplay plane. */
  ExtentCm: { WidthCm: number; DepthCm: number };
  /** Elevation in Unreal cm (Z). Defaults to 0 when not authored. */
  ElevationCm: number;
  /** Vertical span for multi-level zones, in Unreal cm. */
  ElevationRangeCm?: { FloorCm: number; CeilingCm: number };
  Light: number;
  Noise: number;
  Hazards: string[];
  Neighbors: string[];
  Exits: Array<{ TargetZoneId: string; Label: string; Condition?: string }>;
  Interactables: Array<{ Name: string; Type: string; Description?: string }>;
  ParentDistrictId?: string;
  BackgroundAssetId?: string;
  TilesetAssetId?: string;
  SkylineAssetId?: string;
  ParallaxLayers?: UnrealParallaxLayer[];

  // ── Sky / lighting metadata (UE-FT-002) ─────────────────────
  SkyAtmosphereAssetId?: string;
  DirectionalLightYaw?: number;
  DirectionalLightPitch?: number;
  SkyLightIntensity?: number;
  TimeOfDayKey?: string;

  // ── Collision channel (UE-FT-003) ───────────────────────────
  CollisionChannel?: 'walkable' | 'water' | 'hazard' | 'void' | 'custom';

  // ── Physics overrides (SCH-FT-006 passthrough) ──────────────
  GravityCmPerSec2?: number;
  GravityDirection?: 'down' | 'up' | 'none';
  PhysicsMode?: string;
}

export interface UnrealParallaxLayer {
  Id: string;
  Depth: number;
  AssetRef: string;
  ScrollFactor: number;
}

export interface ConvertZonesResult {
  zones: UnrealZoneDataAsset[];
  fidelity: FidelityEntry[];
}

export function convertZones(project: WorldProject, tileSizeCm: number = DEFAULT_TILE_SIZE_CM): ConvertZonesResult {
  const tileSize = project.map.tileSize;
  const fidelity: FidelityEntry[] = [];
  const zones: UnrealZoneDataAsset[] = project.zones.map((z) => convertZone(z, tileSize, tileSizeCm, fidelity));
  return { zones, fidelity };
}

function convertZone(z: Zone, tileSize: number, tileSizeCm: number, fidelity: FidelityEntry[]): UnrealZoneDataAsset {
  const elevationMeters = z.elevation ?? 0;
  const origin = gridToUnrealAxis(z.gridX, z.gridY, tileSizeCm, elevationMeters);
  const widthCm = z.gridWidth * tileSizeCm;
  const depthCm = z.gridHeight * tileSizeCm;

  const asset: UnrealZoneDataAsset = {
    Id: z.id,
    DisplayName: z.name,
    Description: z.description,
    Tags: z.tags.slice(),
    OriginCm: origin,
    GridWidthTiles: z.gridWidth,
    GridHeightTiles: z.gridHeight,
    ExtentCm: { WidthCm: widthCm, DepthCm: depthCm },
    ElevationCm: elevationToZ(elevationMeters),
    Light: z.light,
    Noise: z.noise,
    Hazards: z.hazards.slice(),
    Neighbors: z.neighbors.slice(),
    Exits: z.exits.map((e) => ({
      TargetZoneId: e.targetZoneId,
      Label: e.label,
      Condition: e.condition,
    })),
    Interactables: z.interactables.map((i) => ({
      Name: i.name,
      Type: i.type,
      Description: i.description,
    })),
    ParentDistrictId: z.parentDistrictId,
    BackgroundAssetId: z.backgroundId,
    TilesetAssetId: z.tilesetId,
    SkylineAssetId: z.skylineRef,
  };

  if (z.elevationRange) {
    asset.ElevationRangeCm = {
      FloorCm: elevationToZ(z.elevationRange.floor),
      CeilingCm: elevationToZ(z.elevationRange.ceiling),
    };
  }

  if (z.parallaxLayers && z.parallaxLayers.length > 0) {
    asset.ParallaxLayers = z.parallaxLayers.map((p) => convertParallaxLayer(p));
    fidelity.push({
      level: 'lossless',
      domain: 'parallax',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.parallaxLayers`,
      message: `Zone "${z.id}" parallax layers preserved.`,
      reason: `${z.parallaxLayers.length} layer(s) mapped 1:1 to UnrealParallaxLayer.`,
    });
  }

  if (z.skylineRef) {
    fidelity.push({
      level: 'lossless',
      domain: 'skyline',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.skylineRef`,
      message: `Zone "${z.id}" skyline ref preserved.`,
      reason: 'Mapped to SkylineAssetId.',
    });
  }

  if (z.elevation !== undefined || z.elevationRange) {
    fidelity.push({
      level: 'lossless',
      domain: 'elevation',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.elevation`,
      message: `Zone "${z.id}" elevation preserved.`,
      reason: 'Converted metres → UE cm via elevationToZ.',
    });
  }

  // ── UE-FT-002: sky / lighting ────────────────────────────────
  const hasSkyData =
    z.skyAtmosphereRef !== undefined ||
    z.directionalLightYaw !== undefined ||
    z.directionalLightPitch !== undefined ||
    z.skyLightIntensity !== undefined ||
    z.timeOfDay !== undefined;

  if (z.skyAtmosphereRef !== undefined) asset.SkyAtmosphereAssetId = z.skyAtmosphereRef;
  if (z.directionalLightYaw !== undefined) asset.DirectionalLightYaw = z.directionalLightYaw;
  if (z.directionalLightPitch !== undefined) asset.DirectionalLightPitch = z.directionalLightPitch;
  if (z.skyLightIntensity !== undefined) asset.SkyLightIntensity = z.skyLightIntensity;
  if (z.timeOfDay !== undefined) asset.TimeOfDayKey = z.timeOfDay;

  if (hasSkyData) {
    fidelity.push({
      level: 'lossless',
      domain: 'lighting',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.sky`,
      message: `Zone "${z.id}" sky/lighting metadata preserved.`,
      reason: 'Mapped 1:1 to SkyAtmosphereAssetId / DirectionalLight* / SkyLightIntensity / TimeOfDayKey.',
    });
  }

  // ── UE-FT-003: collision channel (with hazard inference) ─────
  if (z.collisionType !== undefined) {
    asset.CollisionChannel = z.collisionType;
    fidelity.push({
      level: 'lossless',
      domain: 'collision',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.collisionType`,
      message: `Zone "${z.id}" collision channel preserved.`,
      reason: 'Mapped to CollisionChannel 1:1.',
    });
  } else if (z.hazards.length > 0) {
    asset.CollisionChannel = 'hazard';
    fidelity.push({
      level: 'approximated',
      domain: 'collision',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.collisionType`,
      message: `Zone "${z.id}" has hazards but no collisionType — inferred CollisionChannel="hazard".`,
      reason: `${z.hazards.length} hazard(s) present; no explicit collisionType authored.`,
    });
  }

  // ── Gravity + physicsMode passthrough (SCH-FT-006) ───────────
  const hasPhysicsData =
    z.gravityOverride !== undefined ||
    z.gravityDirection !== undefined ||
    z.physicsMode !== undefined;

  if (z.gravityOverride !== undefined) {
    // gravityOverride is m/s²; UE uses cm/s² for gravity scale. Convert so
    // loaders get a value in their native unit.
    asset.GravityCmPerSec2 = z.gravityOverride * 100;
  }
  if (z.gravityDirection !== undefined) asset.GravityDirection = z.gravityDirection;
  if (z.physicsMode !== undefined) asset.PhysicsMode = z.physicsMode;

  if (hasPhysicsData) {
    fidelity.push({
      level: 'lossless',
      domain: 'physics',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.physics`,
      message: `Zone "${z.id}" physics overrides preserved.`,
      reason: 'Mapped gravityOverride (m/s² → cm/s²), gravityDirection, physicsMode.',
    });
  }

  // tileSize retained via ExtentCm + origin; void to keep the arg used.
  void tileSize;

  return asset;
}

function convertParallaxLayer(p: ParallaxLayer): UnrealParallaxLayer {
  return {
    Id: p.id,
    Depth: p.depth,
    AssetRef: p.assetRef,
    ScrollFactor: p.scrollFactor,
  };
}
