/**
 * import.ts — UnrealContentPack → WorldProject (reverse pipeline).
 *
 * Best-effort reconstruction. Some gameplay-only fields (progression trees,
 * build catalogs, dialogues) are not part of the Unreal content pack and
 * cannot be recovered — those are flagged as `dropped` in the fidelity report.
 */

import type {
  WorldProject, Zone, ZoneExit, Interactable, ZoneEntryGate,
  District, EntityPlacement, EntityRole,
  ZoneConnection, ConnectionKind, ParallaxLayer,
  TransitionEntity, TransitionEntityType,
  ValidationError, AuthoringMode,
  Stratum, StratumLink,
  HazardDefinition, HazardEffect,
  Tileset, TileLayer, TileDefinition,
  PropDefinition, PropPlacement, SpawnPoint,
} from '@world-forge/schema';
import { DEFAULT_MODE, isValidMode, VALID_CONNECTION_KINDS } from '@world-forge/schema';
import { KNOWN_DROPPED } from './field-coverage.js';
import type { UnrealContentPack, UnrealPackMeta } from './export.js';
import { UNREAL_PACK_FORMAT_VERSION } from './export.js';
import { migratePack, parseSemVer, compareSemVer, type MigrationWarning } from './migrations.js';
import type { UnrealZoneDataAsset, UnrealEntryGate } from './convert-zones.js';
import type { UnrealDistrictDataAsset } from './convert-districts.js';
import type { UnrealActorSpawnEntry } from './convert-entities.js';
import type { UnrealLevelStreamingHint } from './convert-connections.js';
import type { UnrealTransitionEntity } from './convert-transitions.js';
import type { UnrealStrataManifest, UnrealStratum, UnrealStratumLink } from './convert-strata.js';
import type { UnrealTileManifest, UnrealTileLayer, UnrealTileCell } from './convert-tile-layers.js';
import type { UnrealPropManifest, UnrealPropActor } from './convert-props.js';
import type {
  UnrealHazardManifest, UnrealHazardDefinition, UnrealHazardEffect,
} from './convert-hazards.js';
import type { UnrealPlayerStart } from './convert-spawn-points.js';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';
import { unrealAxisToGrid, zToElevationMeters } from './coordinate-transform.js';

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

/**
 * Every WorldProject field an Unreal content pack cannot round-trip on import.
 * DERIVED from KNOWN_DROPPED (F-a9c3a595) so tsc + FIELD_COVERAGE own both
 * sides. Do not put `transitions` here — they are in the pack and round-trip
 * (EXPORT-UNREAL-A-001); they are classified `covered`, not dropped.
 */
const UNREAL_UNRECOVERABLE_FIELDS: ReadonlyArray<string> = Object.keys(KNOWN_DROPPED);

function deserializeV1(pack: UnrealContentPack): UnrealImportResult | UnrealImportError {
  try {
    return deserializeV1Unchecked(pack);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [{
        path: 'pack',
        message: `Failed to deserialize Unreal pack: ${message}`,
      }],
    };
  }
}

function deserializeV1Unchecked(pack: UnrealContentPack): UnrealImportResult | UnrealImportError {
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

  const zoneList = Array.isArray(pack.Zones) ? pack.Zones : [];
  const districtList = Array.isArray(pack.Districts) ? pack.Districts : [];
  const actorList = Array.isArray(pack.Actors?.All) ? pack.Actors.All : [];
  const connectionList = Array.isArray(pack.Connections) ? pack.Connections : [];
  const transitionList = Array.isArray(pack.Transitions) ? pack.Transitions : [];
  const strataManifest: UnrealStrataManifest = pack.Strata && typeof pack.Strata === 'object'
    ? pack.Strata
    : { Strata: [], Links: [] };
  const tilesManifest: UnrealTileManifest = pack.Tiles && typeof pack.Tiles === 'object'
    ? pack.Tiles
    : { Layers: [], CollisionBoxes: [], HismClusters: [] };
  const propsManifest: UnrealPropManifest = pack.Props && typeof pack.Props === 'object'
    ? pack.Props
    : { Actors: [], CollisionBoxes: [] };
  const hazardsManifest: UnrealHazardManifest = pack.Hazards && typeof pack.Hazards === 'object'
    ? pack.Hazards
    : { Volumes: [], Definitions: [] };

  const zones: Zone[] = zoneList.map((z) => zoneFromUnreal(z, tileSizeCm, fidelity));
  const districts: District[] = districtList.map((d) => districtFromUnreal(d, fidelity));
  const entityPlacements: EntityPlacement[] = actorList.map((a) =>
    entityFromUnreal(a, tileSizeCm, fidelity),
  );
  const connections: ZoneConnection[] = connectionList.map((c) => connectionFromUnreal(c, fidelity));

  // F-c6b6426f: convert-transitions.ts maps each TransitionEntity 1:1 into
  // pack.Transitions and marks the mapping lossless; this importer used to
  // never read that array, so every elevator/warp/lift vanished on import.
  // Inverse of convertTransition: LocationCm → gridX/gridY via unrealAxisToGrid;
  // Type/Label/Animation/DurationSeconds/Tags passthrough. Guard Type the
  // same way PhysicsMode is guarded — a hand-edited pack can carry anything.
  const transitions: TransitionEntity[] = [];
  for (const u of transitionList) {
    const recovered = transitionFromUnreal(u, tileSizeCm, fidelity);
    if (recovered) transitions.push(recovered);
  }

  // Guard for pre-WorldPartition packs — fall back to sensible defaults so
  // old exports don't crash the import pipeline.
  const wp = pack.WorldPartition;
  let wpMode: AuthoringMode = DEFAULT_MODE;
  const rawMode = wp?.SourceMode;
  if (rawMode !== undefined && rawMode !== null) {
    if (typeof rawMode === 'string' && isValidMode(rawMode)) {
      wpMode = rawMode;
    } else {
      fidelity.push({
        level: 'approximated',
        domain: 'world-partition',
        severity: 'warning',
        fieldPath: 'WorldPartition.SourceMode',
        message: `Pack WorldPartition.SourceMode "${String(rawMode)}" is not a valid AuthoringMode — defaulting to "${DEFAULT_MODE}".`,
        reason: 'SourceMode is not one of dungeon/interior/district/world/ocean/space/wilderness.',
      });
    }
  }
  const wpWidthCm = wp?.ExtentCm?.WidthCm ?? tileSizeCm;
  const wpDepthCm = wp?.ExtentCm?.DepthCm ?? tileSizeCm;
  if (!wp) {
    fidelity.push({
      level: 'dropped',
      domain: 'world',
      severity: 'warning',
      fieldPath: 'WorldPartition',
      message: 'Pack is missing WorldPartition data — grid size defaults to 1×1.',
      reason: 'Pre-WorldPartition pack format; SourceMode and ExtentCm unavailable.',
    });
  }

  const project: WorldProject = {
    id: pack.Meta.Id,
    name: pack.Meta.Name,
    description: pack.Meta.Description,
    version: pack.Meta.Version,

    genre: '',
    tones: [],
    difficulty: '',
    narratorTone: '',
    mode: wpMode,

    author: pack.Meta.Author,
    license: pack.Meta.License,
    category: pack.Meta.Category,
    projectTags: pack.Meta.Tags,

    map: {
      id: `${pack.Meta.Id}-map`,
      name: pack.Meta.Name,
      description: pack.Meta.Description,
      gridWidth: Math.max(1, Math.round(wpWidthCm / tileSizeCm)),
      gridHeight: Math.max(1, Math.round(wpDepthCm / tileSizeCm)),
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
    spawnPoints: spawnPointsFromUnreal(pack.Spawns ?? [], tileSizeCm),
    craftingStations: [],
    marketNodes: [],
    transitions,

    tilesets: tilesetsFromUnreal(tilesManifest),
    tileLayers: tileLayersFromUnreal(tilesManifest),
    props: propsFromUnreal(propsManifest),
    propPlacements: propPlacementsFromUnreal(propsManifest, tileSizeCm),
    ambientLayers: [],
    assets: [],
    assetPacks: [],
    strata: strataFromUnreal(strataManifest),
    stratumLinks: stratumLinksFromUnreal(strataManifest),
    hazardDefinitions: hazardDefinitionsFromUnreal(hazardsManifest),
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

function zoneFromUnreal(u: UnrealZoneDataAsset, tileSizeCm: number, fidelity: FidelityEntry[]): Zone {
  const origin = readCmVec(u.OriginCm, u.Id, `zones.${u.Id}.OriginCm`, fidelity);
  const { gridX, gridY } = unrealAxisToGrid(origin.X, origin.Y, tileSizeCm);

  const interactables: Interactable[] = [];
  const rawInteractables = Array.isArray(u.Interactables) ? u.Interactables : [];
  for (const i of rawInteractables) {
    if (!isInteractableType(i.Type)) {
      fidelity.push({
        level: 'approximated',
        domain: 'zones',
        severity: 'warning',
        entityId: u.Id,
        fieldPath: `zones.${u.Id}.interactables`,
        message: `Zone "${u.Id}" interactable "${i.Name}" has unrecognized Type "${String(i.Type)}" — dropped rather than guessed.`,
        reason: 'Type is not one of inspect/use/enter/talk/none (Interactable.type union).',
      });
      continue;
    }
    interactables.push({
      name: i.Name,
      type: i.Type,
      description: i.Description,
    });
  }

  const zone: Zone = {
    id: u.Id,
    name: u.DisplayName,
    tags: Array.isArray(u.Tags) ? u.Tags.slice() : [],
    description: u.Description,
    gridX,
    gridY,
    gridWidth: u.GridWidthTiles,
    gridHeight: u.GridHeightTiles,
    neighbors: Array.isArray(u.Neighbors) ? u.Neighbors.slice() : [],
    exits: (Array.isArray(u.Exits) ? u.Exits : []).map<ZoneExit>((e) => ({
      targetZoneId: e.TargetZoneId,
      label: e.Label,
      condition: e.Condition,
    })),
    light: u.Light,
    noise: u.Noise,
    hazards: Array.isArray(u.Hazards) ? u.Hazards.slice() : [],
    interactables,
    parentDistrictId: u.ParentDistrictId,
    backgroundId: u.BackgroundAssetId,
    tilesetId: u.TilesetAssetId,
    skylineRef: u.SkylineAssetId,
  };

  if (u.ElevationCm !== 0 || u.ElevationRangeCm) {
    zone.elevation = zToElevationMeters(u.ElevationCm);
  }
  if (u.ElevationRangeCm) {
    zone.elevationRange = {
      floor: zToElevationMeters(u.ElevationRangeCm.FloorCm),
      ceiling: zToElevationMeters(u.ElevationRangeCm.CeilingCm),
    };
  }
  if (Array.isArray(u.ParallaxLayers) && u.ParallaxLayers.length > 0) {
    zone.parallaxLayers = u.ParallaxLayers.map<ParallaxLayer>((p) => ({
      id: p.Id,
      depth: p.Depth,
      assetRef: p.AssetRef,
      scrollFactor: p.ScrollFactor,
    }));
  }

  // ── Sky / lighting (UE-FT-002) — round-trip fix ─────────────────────────
  // convert-zones.ts writes these onto UnrealZoneDataAsset AND marks them
  // `lossless` in the export-side fidelity report; this importer used to
  // just never read them back, silently contradicting its own exporter's
  // "lossless" claim on any export → import round trip.
  if (u.SkyAtmosphereAssetId !== undefined) zone.skyAtmosphereRef = u.SkyAtmosphereAssetId;
  if (u.DirectionalLightYaw !== undefined) zone.directionalLightYaw = u.DirectionalLightYaw;
  if (u.DirectionalLightPitch !== undefined) zone.directionalLightPitch = u.DirectionalLightPitch;
  if (u.SkyLightIntensity !== undefined) zone.skyLightIntensity = u.SkyLightIntensity;
  if (u.TimeOfDayKey !== undefined) zone.timeOfDay = u.TimeOfDayKey;

  // ── Collision channel (UE-FT-003) — round-trip fix ──────────────────────
  // F-dce08380: CollisionChannel is a closed union on the schema side but a
  // hand-edited pack can carry anything. Guard rather than assign.
  if (u.CollisionChannel !== undefined) {
    if (isCollisionType(u.CollisionChannel)) {
      zone.collisionType = u.CollisionChannel;
    } else {
      fidelity.push({
        level: 'approximated',
        domain: 'collision',
        severity: 'warning',
        entityId: u.Id,
        fieldPath: `zones.${u.Id}.collisionType`,
        message: `Zone "${u.Id}" has unrecognized CollisionChannel "${String(u.CollisionChannel)}" — dropped rather than guessed.`,
        reason: 'CollisionChannel is not one of walkable/water/hazard/void/custom (Zone.collisionType union).',
      });
    }
  }

  // ── Gravity + physicsMode (SCH-FT-006) — round-trip fix ─────────────────
  if (u.GravityCmPerSec2 !== undefined) zone.gravityOverride = u.GravityCmPerSec2 / 100; // cm/s² → m/s²
  if (u.GravityDirection !== undefined) {
    if (isGravityDirection(u.GravityDirection)) {
      zone.gravityDirection = u.GravityDirection;
    } else {
      fidelity.push({
        level: 'approximated',
        domain: 'physics',
        severity: 'warning',
        entityId: u.Id,
        fieldPath: `zones.${u.Id}.gravityDirection`,
        message: `Zone "${u.Id}" has unrecognized GravityDirection "${String(u.GravityDirection)}" — dropped rather than guessed.`,
        reason: 'GravityDirection is not one of down/up/none (Zone.gravityDirection union).',
      });
    }
  }
  if (u.PhysicsMode !== undefined) {
    // Unlike CollisionChannel, UnrealZoneDataAsset.PhysicsMode is a bare
    // `string` (not Zone.physicsMode's literal union) — convert-zones.ts can
    // only ever have written one of the four valid modes, but a hand-edited
    // or third-party-authored pack.json could carry anything. Guard rather
    // than cast, same defensive posture as isEntityRole()/UE-A-001 below.
    if (isPhysicsMode(u.PhysicsMode)) {
      zone.physicsMode = u.PhysicsMode;
    } else {
      fidelity.push({
        level: 'approximated',
        domain: 'physics',
        severity: 'warning',
        entityId: u.Id,
        fieldPath: `zones.${u.Id}.physicsMode`,
        message: `Zone "${u.Id}" has unrecognized PhysicsMode "${u.PhysicsMode}" — dropped rather than guessed.`,
        reason: 'PhysicsMode is not one of normal/platformer/zero-g/aquatic (Zone.physicsMode union).',
      });
    }
  }

  // ── Stratum + entry gate + typed hazard refs (round-trip) ───────────────
  if (typeof u.StratumId === 'string' && u.StratumId.length > 0) {
    zone.stratumId = u.StratumId;
  }
  if (Array.isArray(u.HazardRefs) && u.HazardRefs.length > 0) {
    zone.hazardRefs = u.HazardRefs.filter((r): r is string => typeof r === 'string');
  }
  const gate = entryGateFromUnreal(u.EntryGate, u.Id, fidelity);
  if (gate) zone.entryGate = gate;

  return zone;
}

function entryGateFromUnreal(
  raw: UnrealEntryGate | undefined,
  zoneId: string,
  fidelity: FidelityEntry[],
): ZoneEntryGate | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const mode = raw.Mode === 'soft' || raw.Mode === 'hard' ? raw.Mode : undefined;
  if (!mode) {
    fidelity.push({
      level: 'approximated',
      domain: 'structures',
      severity: 'warning',
      entityId: zoneId,
      fieldPath: `zones.${zoneId}.entryGate.mode`,
      message: `Zone "${zoneId}" has unrecognized EntryGate.Mode "${String(raw.Mode)}" — gate dropped rather than guessed.`,
      reason: 'EntryGate.Mode is not one of hard/soft (ZoneEntryGate.mode union).',
    });
    return undefined;
  }
  const conditions = Array.isArray(raw.Conditions)
    ? raw.Conditions.filter((c): c is string => typeof c === 'string')
    : [];
  if (conditions.length === 0) {
    fidelity.push({
      level: 'approximated',
      domain: 'structures',
      severity: 'warning',
      entityId: zoneId,
      fieldPath: `zones.${zoneId}.entryGate`,
      message: `Zone "${zoneId}" EntryGate had no expressible conditions — gate dropped.`,
      reason: 'An empty AND-array is vacuously true and would silently unlock the zone.',
    });
    return undefined;
  }
  const gate: ZoneEntryGate = { mode, conditions };
  if (typeof raw.Reason === 'string' && raw.Reason.length > 0) gate.reason = raw.Reason;
  return gate;
}

function strataFromUnreal(manifest: UnrealStrataManifest): Stratum[] {
  const list = Array.isArray(manifest.Strata) ? manifest.Strata : [];
  return list.map((s: UnrealStratum): Stratum => {
    const out: Stratum = {
      id: s.Id,
      name: s.Name,
      order: s.Order,
      tags: Array.isArray(s.Tags) ? s.Tags.slice() : [],
    };
    if (s.ZRangeCm) {
      out.zRange = {
        floor: zToElevationMeters(s.ZRangeCm.FloorCm),
        ceiling: zToElevationMeters(s.ZRangeCm.CeilingCm),
      };
    }
    if (Array.isArray(s.VisibleStrata) && s.VisibleStrata.length > 0) {
      out.visibleStrata = s.VisibleStrata.slice();
    }
    return out;
  });
}

function stratumLinksFromUnreal(manifest: UnrealStrataManifest): StratumLink[] {
  const list = Array.isArray(manifest.Links) ? manifest.Links : [];
  return list.map((l: UnrealStratumLink): StratumLink => ({
    id: l.Id,
    fromStratumId: l.FromStratumId,
    toStratumId: l.ToStratumId,
    fromZoneId: l.FromZoneId,
    toZoneId: l.ToZoneId,
    bidirectional: l.Bidirectional,
    linkType: l.LinkType,
  }));
}

function colorToTags(color: string | undefined): string[] {
  if (color === '#555555') return ['wall'];
  if (color === '#2244aa') return ['water'];
  if (color === '#886622') return ['door'];
  return [];
}

function tilesetsFromUnreal(manifest: UnrealTileManifest): Tileset[] {
  const layers = Array.isArray(manifest.Layers) ? manifest.Layers : [];
  const byTileset = new Map<string, Map<string, TileDefinition>>();
  for (const layer of layers as UnrealTileLayer[]) {
    const cells = Array.isArray(layer.Cells) ? layer.Cells : [];
    for (const c of cells as UnrealTileCell[]) {
      const tsId = c.TilesetId || 'tileset-imported';
      let tiles = byTileset.get(tsId);
      if (!tiles) {
        tiles = new Map();
        byTileset.set(tsId, tiles);
      }
      if (!tiles.has(c.TileId)) {
        tiles.set(c.TileId, {
          id: c.TileId,
          tilesetId: tsId,
          row: c.AtlasRow,
          col: c.AtlasCol,
          tags: colorToTags(c.Color),
          walkable: c.Walkable,
          opacity: c.Opacity ?? 1,
        });
      }
    }
  }
  return [...byTileset.entries()].map(([id, tiles]) => ({
    id,
    name: id,
    tileWidth: 32,
    tileHeight: 32,
    tiles: [...tiles.values()],
  }));
}

function tileLayersFromUnreal(manifest: UnrealTileManifest): TileLayer[] {
  const layers = Array.isArray(manifest.Layers) ? manifest.Layers : [];
  return layers.map((layer: UnrealTileLayer): TileLayer => ({
    id: layer.Id,
    name: layer.Name,
    zIndex: layer.ZIndex,
    tiles: (Array.isArray(layer.Cells) ? layer.Cells : []).map((c) => ({
      tileId: c.TileId,
      gridX: c.GridX,
      gridY: c.GridY,
    })),
  }));
}

function propsFromUnreal(manifest: UnrealPropManifest): PropDefinition[] {
  const actors = Array.isArray(manifest.Actors) ? manifest.Actors : [];
  const byId = new Map<string, PropDefinition>();
  for (const a of actors as UnrealPropActor[]) {
    if (byId.has(a.PropId)) continue;
    byId.set(a.PropId, {
      id: a.PropId,
      name: a.DisplayName,
      imagePath: a.ImagePath,
      width: a.WidthTiles,
      height: a.HeightTiles,
      tags: Array.isArray(a.Tags) ? a.Tags.slice() : [],
      walkable: a.Walkable,
      interactable: a.Interactable,
    });
  }
  return [...byId.values()];
}

function propPlacementsFromUnreal(manifest: UnrealPropManifest, tileSizeCm: number): PropPlacement[] {
  const actors = Array.isArray(manifest.Actors) ? manifest.Actors : [];
  return actors.map((a: UnrealPropActor): PropPlacement => {
    const { gridX, gridY } = unrealAxisToGrid(a.LocationCm?.X ?? 0, a.LocationCm?.Y ?? 0, tileSizeCm);
    const out: PropPlacement = {
      id: a.Id,
      propId: a.PropId,
      gridX,
      gridY,
    };
    if (a.ZoneId) out.zoneId = a.ZoneId;
    return out;
  });
}

function effectFromUnreal(e: UnrealHazardEffect): HazardEffect | undefined {
  switch (e.Kind) {
    case 'damage':
      return {
        kind: 'damage',
        amount: e.Amount,
        amountIsPercentMaxHp: e.AmountIsPercentMaxHp,
        tickOn: e.TickOn === 'turn-start' ? 'turn-start' : 'turn-end',
        durationTicks: e.DurationTicks,
      };
    case 'status':
      return {
        kind: 'status',
        statusId: e.StatusId,
        chance: e.Chance,
        stacking: e.Stacking === 'stack' || e.Stacking === 'ignore' ? e.Stacking : 'refresh',
      };
    case 'instakill':
      return { kind: 'instakill' };
    case 'ignite':
      return { kind: 'ignite', igniteChance: e.IgniteChance };
    default:
      return undefined;
  }
}

function hazardDefinitionsFromUnreal(manifest: UnrealHazardManifest): HazardDefinition[] {
  const list = Array.isArray(manifest.Definitions) ? manifest.Definitions : [];
  return list.map((d: UnrealHazardDefinition): HazardDefinition => {
    const effects = (Array.isArray(d.Effects) ? d.Effects : [])
      .map(effectFromUnreal)
      .filter((e): e is HazardEffect => e !== undefined);
    const out: HazardDefinition = {
      id: d.Id,
      name: d.Name,
      effects,
      trigger: d.Trigger === 'per-turn' || d.Trigger === 'on-exit' || d.Trigger === 'timed'
        ? d.Trigger
        : 'on-enter',
      tags: Array.isArray(d.Tags) ? d.Tags.slice() : [],
    };
    if (d.MoveCostDelta) out.moveCostDelta = d.MoveCostDelta;
    if (d.Passable === 'yes' || d.Passable === 'flying-only' || d.Passable === 'never') {
      out.passable = d.Passable;
    }
    if (d.BlocksVision) out.blocksVision = true;
    if (Array.isArray(d.WeatherConditions)) out.weatherConditions = d.WeatherConditions.slice();
    if (Array.isArray(d.ImmuneTags)) out.immuneTags = d.ImmuneTags.slice();
    return out;
  });
}

function isPhysicsMode(value: string): value is NonNullable<Zone['physicsMode']> {
  return value === 'normal' || value === 'platformer' || value === 'zero-g' || value === 'aquatic';
}

function spawnPointsFromUnreal(spawns: UnrealPlayerStart[], tileSizeCm: number): SpawnPoint[] {
  return spawns.map((s) => {
    const grid = unrealAxisToGrid(s.LocationCm.X, s.LocationCm.Y, tileSizeCm);
    return {
      id: s.Id,
      zoneId: s.ZoneId,
      gridX: grid.gridX,
      gridY: grid.gridY,
      isDefault: s.IsDefault,
    };
  });
}

function isInteractableType(value: unknown): value is Interactable['type'] {
  return value === 'inspect' || value === 'use' || value === 'enter' || value === 'talk' || value === 'none';
}

function isCollisionType(value: unknown): value is NonNullable<Zone['collisionType']> {
  return value === 'walkable' || value === 'water' || value === 'hazard' || value === 'void' || value === 'custom';
}

function isGravityDirection(value: unknown): value is NonNullable<Zone['gravityDirection']> {
  return value === 'down' || value === 'up' || value === 'none';
}

function districtFromUnreal(u: UnrealDistrictDataAsset, fidelity: FidelityEntry[]): District {
  const metrics = u.BaseMetrics && typeof u.BaseMetrics === 'object' ? u.BaseMetrics : undefined;
  const economy = u.EconomyProfile && typeof u.EconomyProfile === 'object' ? u.EconomyProfile : undefined;
  if (!metrics) {
    fidelity.push({
      level: 'approximated',
      domain: 'districts',
      severity: 'warning',
      entityId: u.Id,
      fieldPath: `districts.${u.Id}.baseMetrics`,
      message: `District "${u.Id}" is missing BaseMetrics — defaulting commerce/morale/safety/stability to 0.`,
      reason: 'Hand-edited pack omitted BaseMetrics.',
    });
  }
  if (!economy) {
    fidelity.push({
      level: 'approximated',
      domain: 'districts',
      severity: 'warning',
      entityId: u.Id,
      fieldPath: `districts.${u.Id}.economyProfile`,
      message: `District "${u.Id}" is missing EconomyProfile — defaulting to empty supply categories.`,
      reason: 'Hand-edited pack omitted EconomyProfile.',
    });
  }
  return {
    id: u.Id,
    name: u.DisplayName,
    zoneIds: Array.isArray(u.ZoneIds) ? u.ZoneIds.slice() : [],
    tags: Array.isArray(u.Tags) ? u.Tags.slice() : [],
    controllingFaction: u.ControllingFaction,
    baseMetrics: {
      commerce: metrics?.Commerce ?? 0,
      morale: metrics?.Morale ?? 0,
      safety: metrics?.Safety ?? 0,
      stability: metrics?.Stability ?? 0,
    },
    economyProfile: {
      supplyCategories: Array.isArray(economy?.SupplyCategories) ? economy.SupplyCategories.slice() : [],
      scarcityDefaults: { ...(economy?.ScarcityDefaults ?? {}) },
    },
  };
}

function entityFromUnreal(u: UnrealActorSpawnEntry, tileSizeCm: number, fidelity: FidelityEntry[]): EntityPlacement {
  const location = readCmVec(u.LocationCm, u.ActorId, `entityPlacements.${u.ActorId}.LocationCm`, fidelity);
  const { gridX, gridY } = unrealAxisToGrid(location.X, location.Y, tileSizeCm);

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
  const xOffset = Math.abs(((location.X % tileSizeCm) + tileSizeCm) % tileSizeCm);
  const yOffset = Math.abs(((location.Y % tileSizeCm) + tileSizeCm) % tileSizeCm);
  const xOffAligned = xOffset > SUBGRID_EPSILON_CM && (tileSizeCm - xOffset) > SUBGRID_EPSILON_CM;
  const yOffAligned = yOffset > SUBGRID_EPSILON_CM && (tileSizeCm - yOffset) > SUBGRID_EPSILON_CM;
  if (xOffAligned || yOffAligned) {
    fidelity.push({
      level: 'approximated',
      domain: 'entities',
      severity: 'info',
      entityId: u.ActorId,
      fieldPath: `entityPlacements.${u.ActorId}.gridX/gridY`,
      message: `Entity "${u.ActorId}" sub-grid placement (${location.X}, ${location.Y} cm) snapped to grid (${gridX}, ${gridY}).`,
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
    tags: Array.isArray(u.Tags) ? u.Tags : undefined,
    custom: u.Custom,
    portraitId: u.PortraitAssetId,
    spriteId: u.SpriteAssetId,
  };
}

function connectionFromUnreal(u: UnrealLevelStreamingHint, fidelity: FidelityEntry[]): ZoneConnection {
  const conn: ZoneConnection = {
    fromZoneId: u.FromZoneId,
    toZoneId: u.ToZoneId,
    bidirectional: u.Bidirectional,
    label: u.Label,
    condition: u.Condition,
  };
  if (u.Kind !== undefined) {
    if (VALID_CONNECTION_KINDS.has(u.Kind)) {
      conn.kind = u.Kind as ConnectionKind;
    } else {
      fidelity.push({
        level: 'approximated',
        domain: 'connections',
        severity: 'warning',
        fieldPath: `connections.${u.FromZoneId}->${u.ToZoneId}.kind`,
        message: `Connection ${u.FromZoneId}→${u.ToZoneId} has unrecognized Kind "${String(u.Kind)}" — dropped rather than guessed.`,
        reason: 'Kind is not in VALID_CONNECTION_KINDS.',
      });
    }
  }
  return conn;
}

/**
 * Inverse of convertTransition in convert-transitions.ts. LocationCm (Unreal
 * cm, Y-flipped) snaps back to integer grid tiles; presentation fields
 * passthrough. Returns undefined when Type is not a TransitionEntityType so
 * a hand-edited pack cannot inject an illegal union member.
 */
function transitionFromUnreal(
  u: UnrealTransitionEntity,
  tileSizeCm: number,
  fidelity: FidelityEntry[],
): TransitionEntity | undefined {
  if (!isTransitionEntityType(u.Type)) {
    fidelity.push({
      level: 'approximated',
      domain: 'transitions',
      severity: 'warning',
      entityId: u.Id,
      fieldPath: `transitions.${u.Id}.type`,
      message: `Transition "${u.Id}" has unrecognized Type "${String(u.Type)}" — dropped rather than guessed.`,
      reason: 'Type is not one of elevator/warp/transporter/cargo-lift/stairwell (TransitionEntityType union).',
    });
    return undefined;
  }

  const location = readCmVec(u.LocationCm, u.Id, `transitions.${u.Id}.LocationCm`, fidelity);
  const { gridX, gridY } = unrealAxisToGrid(location.X, location.Y, tileSizeCm);
  const out: TransitionEntity = {
    id: u.Id,
    zoneId: u.ZoneId,
    targetZoneId: u.TargetZoneId,
    type: u.Type,
    gridX,
    gridY,
  };
  if (u.Label !== undefined) out.label = u.Label;
  if (u.Animation !== undefined) out.animation = u.Animation;
  if (u.DurationSeconds !== undefined) out.durationSeconds = u.DurationSeconds;
  if (Array.isArray(u.Tags)) out.tags = u.Tags.slice();
  return out;
}

function isTransitionEntityType(value: unknown): value is TransitionEntityType {
  return value === 'elevator' || value === 'warp' || value === 'transporter'
    || value === 'cargo-lift' || value === 'stairwell';
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

/**
 * F-e21cd428: OriginCm / LocationCm on a hand-edited pack may be missing or
 * a non-object. Default to (0,0,0) and flag rather than throw on `.X`.
 */
function readCmVec(
  raw: unknown,
  entityId: string,
  fieldPath: string,
  fidelity: FidelityEntry[],
): { X: number; Y: number; Z: number } {
  if (raw && typeof raw === 'object') {
    const rec = raw as Record<string, unknown>;
    const X = typeof rec.X === 'number' && Number.isFinite(rec.X) ? rec.X : 0;
    const Y = typeof rec.Y === 'number' && Number.isFinite(rec.Y) ? rec.Y : 0;
    const Z = typeof rec.Z === 'number' && Number.isFinite(rec.Z) ? rec.Z : 0;
    if (typeof rec.X === 'number' && typeof rec.Y === 'number') {
      return { X, Y, Z };
    }
  }
  fidelity.push({
    level: 'approximated',
    domain: 'world',
    severity: 'warning',
    entityId,
    fieldPath,
    message: `${fieldPath} missing or not an object — defaulting to origin (0,0,0).`,
    reason: 'Hand-edited pack omitted a centimetre vector.',
  });
  return { X: 0, Y: 0, Z: 0 };
}
