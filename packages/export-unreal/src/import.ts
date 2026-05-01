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
  ValidationError,
} from '@world-forge/schema';
import { DEFAULT_MODE } from '@world-forge/schema';
import type { UnrealContentPack, UnrealPackMeta } from './export.js';
import { UNREAL_PACK_FORMAT_VERSION } from './export.js';
import { migratePack, parseSemVer, compareSemVer, type MigrationWarning } from './migrations.js';
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
  errors: ValidationError[];
}

/**
 * UE-B-006 / UE-FT-008 seam: version-aware import dispatcher. Routes a pack to
 * the correct deserializer based on `pack.Meta.FormatVersion`. Today there is
 * only one deserializer (`deserializeV1`), but adding a V2 import path means
 * registering it here — no changes to call sites, no refactor of the body of
 * this file.
 *
 * Dispatch is by semver major. Unknown majors fall through to V1 with a
 * fidelity warning; UE-FT-008 will swap the fallback to an explicit error.
 */
type PackDeserializer = (pack: UnrealContentPack) => UnrealImportResult | UnrealImportError;

const V1_DESERIALIZER: PackDeserializer = (pack) => deserializeV1(pack);

/**
 * UE-B-006 / UE-FT-008: registered version dispatchers. Keys are semver
 * majors (`'1'`, `'2'`, ...). A major bump means the pack's structure has
 * changed in a way the v1 deserializer can't read — register a new entry
 * here that normalizes the new shape back into the V1 code path, or writes
 * its own deserializer.
 *
 * Minor-version differences within the same major are handled by
 * `migratePack` BEFORE dispatch, so a single major-keyed deserializer sees
 * a Meta already rewritten to the current minor.
 */
const VERSION_DISPATCHERS: Record<string, PackDeserializer> = {
  '1': V1_DESERIALIZER,
};

export function importFromUnreal(pack: UnrealContentPack): UnrealImportResult | UnrealImportError {
  // UE-B-006 / UE-FT-008: version-aware dispatch. Steps:
  //   1. Extract FormatVersion from Meta.
  //   2. If parseable, run `migratePack` to rewrite older minors up to the
  //      current version (or capture forward-compat warnings / hard errors).
  //   3. Dispatch by semver major. Unknown majors are rejected with a clear
  //      error naming the version.
  //   4. If FormatVersion is missing / unparseable, fall through to V1 (legacy
  //      behavior — keeps pre-UE-A-001 packs loadable with a fidelity warning
  //      already emitted by deserializeV1).
  const metaUnknown: unknown = pack?.Meta;
  const formatVersion = typeof metaUnknown === 'object' && metaUnknown !== null
    ? (metaUnknown as { FormatVersion?: unknown }).FormatVersion
    : undefined;
  const parsed = parseSemVer(formatVersion);
  if (!parsed) {
    // Legacy / hand-edited pack — fall through to V1 dispatcher. deserializeV1
    // will push a `dropped` fidelity entry flagging the guess.
    return V1_DESERIALIZER(pack);
  }

  const current = parseSemVer(UNREAL_PACK_FORMAT_VERSION);
  // `current` is a constant; if it ever fails to parse it's a programmer bug,
  // not user input — fall through to V1 rather than throw.
  if (!current) return V1_DESERIALIZER(pack);

  const sameMajor = compareSemVer(parsed, current).sameMajor;
  let migrated: UnrealPackMeta = pack.Meta;
  let migrationWarnings: MigrationWarning[] = [];
  if (sameMajor) {
    const result = migratePack(pack.Meta, UNREAL_PACK_FORMAT_VERSION);
    if ('code' in result) {
      return {
        success: false,
        errors: [{ path: 'Meta.FormatVersion', message: `Migration failed (${result.code}): ${result.message}` }],
      };
    }
    migrated = result.meta;
    migrationWarnings = result.warnings;
  }

  const major = String(parsed.major);
  const deserializer = VERSION_DISPATCHERS[major];
  if (!deserializer) {
    return {
      success: false,
      errors: [{
        path: 'Meta.FormatVersion',
        message: `Unsupported pack FormatVersion "${pack.Meta.FormatVersion}" (major ${major}). ` +
          `This loader supports major ${current.major}.x. Re-export the pack with a compatible exporter ` +
          `or update the loader.`,
      }],
    };
  }

  // Dispatch with the migrated Meta swapped in so deserializers always see the
  // current minor's shape.
  const packForDispatch: UnrealContentPack = migrated === pack.Meta
    ? pack
    : { ...pack, Meta: migrated };
  const result = deserializer(packForDispatch);

  // Thread forward-compat warnings into the fidelity report. They're info-
  // level: loading succeeded, but the caller should know a newer-minor pack
  // may have fields this loader ignored.
  if (result.success && migrationWarnings.length > 0) {
    for (const w of migrationWarnings) {
      result.fidelity.entries.push({
        level: 'dropped',
        domain: 'world',
        severity: 'warning',
        fieldPath: 'Meta.FormatVersion',
        message: w.message,
        reason: `Pack at ${w.fromVersion}, loader at ${w.toVersion} — forward-compat load.`,
      });
    }
  }

  return result;
}

function deserializeV1(pack: UnrealContentPack): UnrealImportResult | UnrealImportError {
  const fidelity: FidelityEntry[] = [];

  // Reconstruct a sensible tile size. Default is 100 cm/tile.
  // UE-B-003: if the pack claims a bad TileSizeCm, don't silently downshift —
  // emit a `dropped` fidelity entry so the loader/user knows we fell back.
  const rawTileSizeCm = pack.Meta.TileSizeCm;
  const tileSizeCm = Number.isFinite(rawTileSizeCm) && rawTileSizeCm > 0 ? rawTileSizeCm : 100;
  if (!(Number.isFinite(rawTileSizeCm) && rawTileSizeCm > 0)) {
    fidelity.push({
      level: 'dropped',
      domain: 'world',
      severity: 'warning',
      fieldPath: 'Meta.TileSizeCm',
      message: `Pack TileSizeCm is invalid (${String(rawTileSizeCm)}) — falling back to 100 cm/tile.`,
      reason: 'TileSizeCm must be a positive finite number; using default scale for import.',
    });
  }

  // Reconstruct the original pixel tile size. Older packs (pre UE-A-001 fix) did
  // not serialize SourceTileSizePx — in that case we fall back to 32 and flag
  // the loss so the importer is honest about it.
  //
  // UE-A-001: Meta may have been hand-edited or come from an older pack format,
  // so we cannot trust its shape. Use a runtime type guard instead of a cast.
  // This prepares for UE-FT-008 (schema versioning) where pack.Meta structure
  // evolves and version-aware deserialization needs a safe extraction point.
  let tileSizePx = 32;
  const rawTileSizePx = readOptionalPositiveNumber(pack.Meta, 'SourceTileSizePx');
  if (rawTileSizePx !== undefined) {
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

  // UE-B-004: single consolidated fidelity entry covering every WorldProject
  // field an Unreal pack cannot round-trip. Previously only `dialogues` was
  // flagged, hiding 17+ other dropped fields. One source of truth — when the
  // parity contract changes, update both this list and the parity test.
  fidelity.push({
    level: 'dropped',
    domain: 'world',
    severity: 'warning',
    message:
      'Several WorldProject fields are not recoverable from an Unreal pack: ' +
      UNREAL_UNRECOVERABLE_FIELDS.join(', ') + '.',
    reason:
      'The Unreal exporter is a lossy projection tuned for UE5 runtime — gameplay, ' +
      'authoring, and flavor fields are owned by the UE5 project, not this pack.',
  });

  return { success: true, project, fidelity: buildFidelityReport(fidelity) };
}

/**
 * Every WorldProject field an Unreal content pack cannot round-trip on import.
 * Kept in sync with `KNOWN_DROPPED` in the parity test — any schema change that
 * adds a gameplay/flavor field should land here too.
 */
const UNREAL_UNRECOVERABLE_FIELDS: ReadonlyArray<string> = [
  'dialogues',
  'progressionTrees',
  'playerTemplate',
  'buildCatalog',
  'itemPlacements',
  'encounterAnchors',
  'spawnPoints',
  'craftingStations',
  'marketNodes',
  'landmarks',
  'factionPresences',
  'pressureHotspots',
  'tilesets',
  'tileLayers',
  'props',
  'propPlacements',
  'ambientLayers',
  'assets',
  'assetPacks',
  'genre',
  'tones',
  'difficulty',
  'narratorTone',
];

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
  //
  // UE-B-012: use epsilon comparison on the modulo. Strict inequality fired on
  // floating-point drift (e.g. a tile-aligned value that round-tripped through
  // cm conversions and came back as 100.0000000001). The `((m % s) + s) % s`
  // form normalizes negative locations so the distance-to-boundary is always
  // non-negative.
  const SUBGRID_EPSILON_CM = 0.001;
  const xOffset = Math.abs(((u.LocationCm.X % tileSizeCm) + tileSizeCm) % tileSizeCm);
  const yOffset = Math.abs(((u.LocationCm.Y % tileSizeCm) + tileSizeCm) % tileSizeCm);
  const xOffAligned = xOffset > SUBGRID_EPSILON_CM && (tileSizeCm - xOffset) > SUBGRID_EPSILON_CM;
  const yOffAligned = yOffset > SUBGRID_EPSILON_CM && (tileSizeCm - yOffset) > SUBGRID_EPSILON_CM;
  if (xOffAligned || yOffAligned) {
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

/**
 * UE-A-001: safely extract a positive finite number from an unknown-shaped meta
 * object without an unsafe cast. Returns undefined if the field is missing,
 * the wrong type, non-finite, or non-positive.
 *
 * Prefer this over `(meta as { X?: number }).X` for any field whose presence
 * may vary across pack-format versions.
 */
function readOptionalPositiveNumber(
  meta: unknown,
  field: string,
): number | undefined {
  if (typeof meta !== 'object' || meta === null) return undefined;
  const record = meta as Record<string, unknown>;
  const value = record[field];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  return undefined;
}
