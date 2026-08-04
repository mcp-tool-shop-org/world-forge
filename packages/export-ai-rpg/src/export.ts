/**
 * export.ts — Full export pipeline: WorldProject → ContentPack + GameManifest + PackMetadata
 *
 * ## Export Pipeline Architecture
 *
 * The export pipeline converts a {@link WorldProject} into engine-compatible artifacts:
 *
 * 1. **Validation** — The project is validated via `validateProject`. Invalid projects
 *    produce an {@link ExportError} and halt the pipeline.
 *
 * 2. **Per-domain conversion** — Each domain is converted by a dedicated converter:
 *    - `convertZones` → engine `ZoneDefinition[]`
 *    - `convertDistricts` → engine `DistrictDefinition[]`
 *    - `convertEntities` → engine `EntityBlueprint[]`
 *    - `convertItems` → engine `ItemDefinition[]`
 *    - `convertDialogues` → engine `DialogueDefinition[]`
 *    - `convertPlayerTemplate` → engine player template
 *    - `convertBuildCatalog` → engine build catalog
 *    - `convertProgressionTrees` → engine progression trees
 *
 * 3. **Manifest + metadata** — `convertManifest` and `convertPackMeta` produce the
 *    engine's `GameManifest` and `PackMetadata` from project-level fields.
 *
 * 4. **Asset binding collection** — Asset references (backgrounds, sprites, icons)
 *    are collected into an {@link AssetBindingMap} for round-trip preservation.
 *
 * 5. **Result assembly** — All pieces are combined into an {@link ExportResult}.
 *
 * ## How to Add a Custom Export Target
 *
 * 1. Create a new converter module (e.g. `convert-my-target.ts`) that accepts a
 *    {@link WorldProject} and returns your target format.
 * 2. If your target needs the full pipeline output, write a wrapper around
 *    {@link exportToEngine} that post-processes the {@link ExportResult}.
 * 3. If your target needs a completely different pipeline, write a new top-level
 *    export function following the same validate → convert → assemble pattern.
 * 4. Re-export your new function/types from `index.ts`.
 *
 * @module export
 */

import type { WorldProject, ValidationError, AssetEntry, AssetPack, EncounterAnchor, FactionPresence, PressureHotspot, HazardDefinition, LootTable } from '@world-forge/schema';
import { validateProject, SCHEMA_VERSION } from '@world-forge/schema';
import type { ZoneDefinition, EntityBlueprint, DialogueDefinition, ProgressionTreeDefinition } from '@ai-rpg-engine/content-schema';
import type { GameManifest } from '@ai-rpg-engine/core';
import type { DistrictDefinition } from '@ai-rpg-engine/modules';
import type { PackMetadata } from '@ai-rpg-engine/pack-registry';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';

import { convertZones, type ExportedZone } from './convert-zones.js';
import { convertDistricts } from './convert-districts.js';
import { convertEntities } from './convert-entities.js';
import { convertPlacements, type ExportedPlacement } from './convert-placements.js';
import { convertItems } from './convert-items.js';
import { convertDialogues } from './convert-dialogues.js';
import { convertPlayerTemplate, type ExportedPlayerTemplate } from './convert-player-template.js';
import { convertBuildCatalog, type ExportedBuildCatalog } from './convert-build-catalog.js';
import { convertProgressionTrees } from './convert-progression-trees.js';
import { convertManifest, convertPackMeta } from './convert-pack.js';
import { computeContentHash } from './content-hash.js';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';

// AIR-FT-005: Schema version is imported directly from @world-forge/schema
// as SCHEMA_VERSION. This is browser-safe (no node:module dependency) and
// guaranteed to match the schema this build was linked against.
function resolveSchemaVersion(): string {
  return SCHEMA_VERSION;
}

/**
 * Export profile controls how much diagnostic metadata is emitted.
 *
 * - `'release'` (default) — minimal, stable, deterministic output suitable for
 *   shipping. No `_debug` block. Fidelity entries are emitted normally.
 * - `'debug'` — adds a top-level `_debug` block (timestamp, schemaVersion,
 *   sourceProjectId, fidelityVerbose: true) to the ContentPack and instructs
 *   downstream consumers to preserve every fidelity entry (no level filtering).
 *   Still deterministic for a fixed project + fixed timestamp.
 */
export type ExportProfile = 'debug' | 'release';

/** Optional settings for {@link exportToEngine}. */
export interface ExportOptions {
  /** Export profile — `'release'` by default. */
  profile?: ExportProfile;
  /**
   * Override the timestamp used in the debug block. Only consulted when
   * `profile === 'debug'`. Defaults to `new Date().toISOString()`. Tests and
   * reproducible pipelines can pin this to get byte-identical output across
   * runs.
   */
  debugTimestamp?: string;
  /**
   * Include `schemaVersion` in the ContentPack (AIR-FT-005). Defaults to
   * `true`. When `true`, the version is pulled from `@world-forge/schema`'s
   * `package.json`.
   */
  emitSchemaVersion?: boolean;
}

/**
 * Debug metadata block injected at the top of the ContentPack when
 * `profile === 'debug'`.
 *
 * Field ordering here (timestamp → schemaVersion → sourceProjectId →
 * fidelityVerbose) is stable across runs — JSON.stringify preserves object
 * insertion order, so identical inputs produce byte-identical output.
 */
export interface ExportDebugBlock {
  timestamp: string;
  schemaVersion: string;
  sourceProjectId: string;
  fidelityVerbose: true;
}

export type ContentPack = {
  /** Debug metadata — present only when exported with `profile: 'debug'`. */
  _debug?: ExportDebugBlock;
  /** Schema version pulled from `@world-forge/schema`. Omitted when `emitSchemaVersion: false`. */
  schemaVersion?: string;
  entities: EntityBlueprint[];
  /**
   * WHERE the entities stand (C3/P1). Closes C0 §2's single most consequential
   * drop: `EntityBlueprint` has no location field, so before this key an
   * exported pack knew every NPC and where none of them stood.
   *
   * A separate channel rather than a field on the blueprint, because a blueprint
   * is a template and the engine's spawn system clones templates per instance.
   */
  placements: ExportedPlacement[];
  /** `ExportedZone`, not `ZoneDefinition` — the C3/P2 `entryGate` field lives on engine `main` and is unpublished. */
  zones: ExportedZone[];
  districts: DistrictDefinition[];
  dialogues: DialogueDefinition[];
  items: ItemDefinition[];
  playerTemplate?: ExportedPlayerTemplate;
  buildCatalog?: ExportedBuildCatalog;
  progressionTrees: ProgressionTreeDefinition[];
  encounterAnchors: EncounterAnchor[];
  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];
  /**
   * C3/P3 — TYPED hazard definitions, the vocabulary that lets hazard data MEAN
   * something. C0 §9: "the highest-value single item, because it closes a
   * structural hole rather than a wire hole." Zones bind by id via `hazardRefs`.
   */
  hazardDefinitions: HazardDefinition[];
  /**
   * F-ee46a52c (swarm wave-2) — CLOSED. `WorldProject.lootTables` was read
   * NOWHERE in this package: no key on `ContentPack`, no warning at export,
   * a complete silent drop of an entire authored subsystem despite the
   * schema validating loot tables extensively (duplicate-id checks,
   * SpawnCondition-grammar entry conditions, two-way referential integrity
   * with `itemPlacements[].lootTableId` — packages/schema/src/validate.ts
   * lines 888-975).
   *
   * A RAW PASS-THROUGH, deliberately — the same class as `factionPresences`,
   * `pressureHotspots`, and `encounterAnchors` above: the engine has no
   * `LootTable`-shaped type of its own to convert INTO (confirmed: zero hits
   * for `LootTable`/`loot` across every installed `@ai-rpg-engine/*` .d.ts),
   * so there is nothing to mirror convert-progression-trees.ts's per-field
   * reconstruction against. `entries[].itemId` needs no remapping either:
   * convertItems already emits items keyed by the same `itemId` the author
   * used, so a loot table's references resolve into `items[]` unchanged.
   *
   * `entries[].condition` crosses as the RAW authored SpawnCondition-grammar
   * string, uncompiled — unlike zone exits / entryGate / entity placements,
   * which compile through `parseSpawnCondition`. That is a deliberate
   * narrower scope, not an oversight: the engine has no loot-table reader yet
   * to define what shape it expects, so compiling now would guess at a
   * contract that does not exist. Revisit when the engine actually consumes
   * this channel.
   */
  lootTables: LootTable[];
};

export type AssetBindingMap = {
  zones?: Record<string, { backgroundId?: string; tilesetId?: string }>;
  entities?: Record<string, { portraitId?: string; spriteId?: string }>;
  items?: Record<string, { iconId?: string }>;
  landmarks?: Record<string, { iconId?: string }>;
};

/**
 * The manifest this exporter emits.
 *
 * ⚠ CORRECTED 2026-07-29 by the engine-deps errand. This comment used to read
 * "`contentHash` was added to the engine's `GameManifest` in engine 3.8.0+, but
 * this repo's `@ai-rpg-engine/core` dependency is still installed at 2.0.1 (C0
 * version-skew checklist item 1, open)". Item 1 is closed — `core` resolves
 * 3.8.0 — and BOTH halves of that sentence were wrong. The published 3.8.0
 * `GameManifest` (`core/dist/types.d.ts`) has no `contentHash`: the field was
 * added by C1 on engine `main` (commit `bf496e7`) and has never been released,
 * the same unpublished surface that blocks the content-hash de-duplication.
 *
 * So the intersection stays, for a different reason than the one it recorded:
 * not a range behind, a release behind. Delete it when a published engine
 * carries the field — the same release that unblocks
 * `__tests__/engine-deps-3x.test.ts`.
 */
export type ExportedManifest = GameManifest & { contentHash?: string };

export type ExportResult = {
  success: true;
  contentPack: ContentPack;
  manifest: ExportedManifest;
  packMeta: PackMetadata;
  warnings: string[];
  fidelity: FidelityReport;
  assets?: AssetEntry[];
  assetBindings?: AssetBindingMap;
  assetPacks?: AssetPack[];
};

export type ExportError = {
  success: false;
  errors: ValidationError[];
};

/**
 * Export a WorldProject to engine-compatible ContentPack, GameManifest, and PackMetadata.
 *
 * @param project The authored world.
 * @param options Optional export settings. Backward compatible — omitting
 *   `options` behaves identically to pre-AIR-FT-001 callers.
 */
export function exportToEngine(
  project: WorldProject,
  options?: ExportOptions,
): ExportResult | ExportError {
  const profile: ExportProfile = options?.profile ?? 'release';
  const emitSchemaVersion = options?.emitSchemaVersion ?? true;

  // 1. Validate the project
  const validation = validateProject(project);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const warnings: string[] = [];
  const fidelityEntries: FidelityEntry[] = [];

  // 2–8. Per-domain conversion (wrapped in try/catch to surface internal
  // converter errors as structured ExportErrors rather than raw exceptions).
  let zones: ReturnType<typeof convertZones>;
  let districts: ReturnType<typeof convertDistricts>;
  let entities: ReturnType<typeof convertEntities>;
  let placements: ReturnType<typeof convertPlacements>;
  let items: ReturnType<typeof convertItems>;
  let dialogues: ReturnType<typeof convertDialogues>;
  let playerTemplate: ReturnType<typeof convertPlayerTemplate>;
  let buildCatalog: ReturnType<typeof convertBuildCatalog>;
  let progressionTrees: ReturnType<typeof convertProgressionTrees>;
  let manifest: ReturnType<typeof convertManifest>;
  let packMeta: ReturnType<typeof convertPackMeta>;

  try {
    // 2. Convert zones (AIR-B-002: forward warnings for broken exit refs)
    zones = convertZones(project, warnings);

    // 3. Convert districts (F-6cd32f2d: warnings report the safety->surveillance approximation)
    districts = convertDistricts(project, warnings);

    // 4. Convert entities
    if (project.entityPlacements.length === 0) {
      warnings.push('No entities found — exported world will have no NPCs or encounters. Add entity placements in the editor to populate your world.');
    }

    // AIR-B-007: Track entities whose zoneId doesn't resolve to a real zone in
    // the export. convertEntities currently emits a blueprint regardless, but
    // entities-in-deleted-zones used to vanish silently once the engine
    // positioned them. We surface the orphans BEFORE conversion so the user
    // sees entity + zone ids together and can fix the authoring issue.
    const exportedZoneIds = new Set(zones.map((z) => z.id));
    const orphanedEntities: { entityId: string; zoneId: string; name: string }[] = [];
    for (const ep of project.entityPlacements) {
      if (!exportedZoneIds.has(ep.zoneId)) {
        orphanedEntities.push({
          entityId: ep.entityId,
          zoneId: ep.zoneId,
          name: ep.name || ep.entityId,
        });
      }
    }
    if (orphanedEntities.length > 0) {
      const lines = orphanedEntities
        .map((o) => `  - entity "${o.entityId}" (${o.name}) → zone "${o.zoneId}"`)
        .join('\n');
      warnings.push(
        `${orphanedEntities.length} entity placement(s) reference zones that do not exist and will be unreachable at runtime:\n${lines}\nRestore the missing zones or move these entities to a surviving zone.`,
      );
    }

    // AIR-B-003: forward warnings for dangling faction refs.
    entities = convertEntities(project, fidelityEntries, warnings);
    // C3/P1 — WHERE they stand. Emitted alongside the blueprints, from the same
    // authored `entityPlacements`, so the two cannot disagree about which
    // entities exist. The orphan check above already named any placement whose
    // zone was deleted; the engine's intake now REFUSES it rather than
    // narrating it.
    placements = convertPlacements(project, fidelityEntries, warnings);
    // Note: convertEntities 1:1 maps project.entityPlacements, so if placements exist,
    // entities will exist. The earlier "no placements" warning above is sufficient.

    // 5. Convert items (F-1c1a6e56: warnings/fidelity report the slot/rarity fallback)
    items = convertItems(project, warnings, fidelityEntries);

    // 6. Convert dialogues
    dialogues = convertDialogues(project);

    // 7. Convert player template, build catalog, progression trees (AIR-B-009)
    playerTemplate = convertPlayerTemplate(project, warnings);
    buildCatalog = convertBuildCatalog(project);
    progressionTrees = convertProgressionTrees(project);

    // 8. Build manifest and pack metadata
    manifest = convertManifest(project);
    // AIR-B-008: Pass warnings so invalid/fallback tone messages reach the CLI.
    packMeta = convertPackMeta(project, warnings);
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

  // 9. Warn on missing features
  if (!playerTemplate) {
    warnings.push('No player template — engine will need manual player setup');
  }
  if (!buildCatalog) {
    warnings.push('No build catalog — character creation will use engine defaults');
  }
  if (progressionTrees.length === 0) {
    warnings.push('No progression trees — character advancement will be inactive');
  }

  // 10. Warn on other missing features
  if (project.landmarks.length === 0) {
    warnings.push('No landmarks placed — consider adding points of interest');
  }
  if (project.pressureHotspots.length === 0) {
    warnings.push('No pressure hotspots — world pressures will not spawn');
  }
  if (project.factionPresences.length === 0) {
    warnings.push('No faction presences defined — faction system will be inactive');
  }

  // 11. Collect asset manifest and bindings for round-trip preservation.
  //
  // AIR-B-001: Binding maps are keyed by entity/zone/item/landmark IDs. Object
  // key iteration in JS follows insertion order, so the output would otherwise
  // depend on the order of project.zones, project.entityPlacements, etc. To
  // guarantee byte-identical JSON across runs (and across engines with subtly
  // different insertion semantics for integer-like keys), we sort keys
  // alphabetically when assembling each sub-map, and we also assemble the
  // top-level assetBindings in a fixed alphabetical order.
  const assets = project.assets.length > 0 ? project.assets : undefined;
  let assetBindings: AssetBindingMap | undefined;
  if (assets) {
    const sortedObject = <V>(source: Record<string, V>): Record<string, V> => {
      const sorted: Record<string, V> = {};
      for (const k of Object.keys(source).sort()) sorted[k] = source[k];
      return sorted;
    };

    const zoneBindingsRaw: Record<string, { backgroundId?: string; tilesetId?: string }> = {};
    for (const z of project.zones) {
      if (z.backgroundId || z.tilesetId) {
        zoneBindingsRaw[z.id] = { backgroundId: z.backgroundId, tilesetId: z.tilesetId };
      }
    }
    const entityBindingsRaw: Record<string, { portraitId?: string; spriteId?: string }> = {};
    for (const e of project.entityPlacements) {
      if (e.portraitId || e.spriteId) {
        entityBindingsRaw[e.entityId] = { portraitId: e.portraitId, spriteId: e.spriteId };
      }
    }
    const itemBindingsRaw: Record<string, { iconId?: string }> = {};
    for (const i of project.itemPlacements) {
      if (i.iconId) {
        itemBindingsRaw[i.itemId] = { iconId: i.iconId };
      }
    }
    const landmarkBindingsRaw: Record<string, { iconId?: string }> = {};
    for (const l of project.landmarks) {
      if (l.iconId) {
        landmarkBindingsRaw[l.id] = { iconId: l.iconId };
      }
    }

    const zoneBindings = sortedObject(zoneBindingsRaw);
    const entityBindings = sortedObject(entityBindingsRaw);
    const itemBindings = sortedObject(itemBindingsRaw);
    const landmarkBindings = sortedObject(landmarkBindingsRaw);

    // Top-level keys are also assembled in alphabetical order: entities, items,
    // landmarks, zones. Any future binding category should slot into this order.
    const assembled: AssetBindingMap = {};
    if (Object.keys(entityBindings).length > 0) assembled.entities = entityBindings;
    if (Object.keys(itemBindings).length > 0) assembled.items = itemBindings;
    if (Object.keys(landmarkBindings).length > 0) assembled.landmarks = landmarkBindings;
    if (Object.keys(zoneBindings).length > 0) assembled.zones = zoneBindings;
    assetBindings = Object.keys(assembled).length > 0 ? assembled : undefined;
  }

  // 12. Collect asset packs for round-trip preservation
  const assetPacks = project.assetPacks.length > 0 ? project.assetPacks : undefined;

  // AIR-FT-001 / AIR-FT-005: Assemble the ContentPack with deterministic key
  // order. `_debug` and `schemaVersion` go FIRST (when present) so they are
  // easy to spot at the top of the JSON. The rest of the fields keep their
  // historical order so release-profile output is byte-identical to the
  // pre-options signature.
  const contentPack: ContentPack = {
    entities,
    // C3/P1: immediately after `entities`, because it is about them and the two
    // are read together at intake.
    placements,
    zones,
    districts,
    dialogues,
    items,
    playerTemplate,
    buildCatalog,
    progressionTrees,
    encounterAnchors: project.encounterAnchors,
    factionPresences: project.factionPresences,
    pressureHotspots: project.pressureHotspots,
    // C3/P3. `?? []` because `hazardDefinitions` is optional on WorldProject
    // (additive since v4.5) — an empty array is a claim the hash covers, and it
    // keeps the key's presence unconditional so the pack shape does not vary.
    hazardDefinitions: project.hazardDefinitions ?? [],
    // F-ee46a52c. Same `?? []` discipline as hazardDefinitions above — raw
    // pass-through, unconditional key presence, see the ContentPack.lootTables
    // doc comment for why this is not routed through a dedicated converter.
    lootTables: project.lootTables ?? [],
  };

  if (profile === 'debug' || emitSchemaVersion) {
    // Rebuild with the metadata keys in front, preserving insertion order.
    const prefixed: ContentPack = {
      entities: [],
      placements: [],
      zones: [],
      districts: [],
      dialogues: [],
      items: [],
      progressionTrees: [],
      encounterAnchors: [],
      factionPresences: [],
      pressureHotspots: [],
      hazardDefinitions: [],
      lootTables: [],
    };
    // Wipe the placeholder keys so we can re-insert them in the canonical order
    // *after* the metadata keys.
    for (const k of Object.keys(prefixed) as (keyof ContentPack)[]) {
      delete (prefixed as Record<string, unknown>)[k as string];
    }

    if (profile === 'debug') {
      prefixed._debug = {
        timestamp: options?.debugTimestamp ?? new Date().toISOString(),
        schemaVersion: resolveSchemaVersion(),
        sourceProjectId: project.id,
        fidelityVerbose: true,
      };
    }
    if (emitSchemaVersion) {
      prefixed.schemaVersion = resolveSchemaVersion();
    }

    prefixed.entities = contentPack.entities;
    prefixed.placements = contentPack.placements;
    prefixed.zones = contentPack.zones;
    prefixed.districts = contentPack.districts;
    prefixed.dialogues = contentPack.dialogues;
    prefixed.items = contentPack.items;
    if (contentPack.playerTemplate) prefixed.playerTemplate = contentPack.playerTemplate;
    if (contentPack.buildCatalog) prefixed.buildCatalog = contentPack.buildCatalog;
    prefixed.progressionTrees = contentPack.progressionTrees;
    prefixed.encounterAnchors = contentPack.encounterAnchors;
    prefixed.factionPresences = contentPack.factionPresences;
    prefixed.pressureHotspots = contentPack.pressureHotspots;
    prefixed.hazardDefinitions = contentPack.hazardDefinitions;
    prefixed.lootTables = contentPack.lootTables;

    return {
      success: true,
      contentPack: prefixed,
      // C1/P2: stamp the content hash. It can only be computed once the pack is
      // FINAL, which is why it is attached here rather than inside
      // convertManifest — that function sees only the project.
      manifest: { ...manifest, contentHash: computeContentHash(prefixed) },
      packMeta,
      warnings,
      fidelity: buildFidelityReport(fidelityEntries),
      assets,
      assetBindings,
      assetPacks,
    };
  }

  return {
    success: true,
    contentPack,
    manifest: { ...manifest, contentHash: computeContentHash(contentPack) },
    packMeta,
    warnings,
    fidelity: buildFidelityReport(fidelityEntries),
    assets,
    assetBindings,
    assetPacks,
  };
}
