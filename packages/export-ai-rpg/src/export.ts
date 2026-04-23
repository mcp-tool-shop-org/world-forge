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

import type { WorldProject, ValidationError, AssetEntry, AssetPack, EncounterAnchor, FactionPresence, PressureHotspot } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';
import type { ZoneDefinition, EntityBlueprint, DialogueDefinition, ProgressionTreeDefinition } from '@ai-rpg-engine/content-schema';
import type { GameManifest } from '@ai-rpg-engine/core';
import type { DistrictDefinition } from '@ai-rpg-engine/modules';
import type { PackMetadata } from '@ai-rpg-engine/pack-registry';
import type { ItemDefinition } from '@ai-rpg-engine/equipment';

import { convertZones } from './convert-zones.js';
import { convertDistricts } from './convert-districts.js';
import { convertEntities } from './convert-entities.js';
import { convertItems } from './convert-items.js';
import { convertDialogues } from './convert-dialogues.js';
import { convertPlayerTemplate, type ExportedPlayerTemplate } from './convert-player-template.js';
import { convertBuildCatalog, type ExportedBuildCatalog } from './convert-build-catalog.js';
import { convertProgressionTrees } from './convert-progression-trees.js';
import { convertManifest, convertPackMeta } from './convert-pack.js';

export type ContentPack = {
  entities: EntityBlueprint[];
  zones: ZoneDefinition[];
  districts: DistrictDefinition[];
  dialogues: DialogueDefinition[];
  items: ItemDefinition[];
  playerTemplate?: ExportedPlayerTemplate;
  buildCatalog?: ExportedBuildCatalog;
  progressionTrees: ProgressionTreeDefinition[];
  encounterAnchors: EncounterAnchor[];
  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];
};

export type AssetBindingMap = {
  zones?: Record<string, { backgroundId?: string; tilesetId?: string }>;
  entities?: Record<string, { portraitId?: string; spriteId?: string }>;
  items?: Record<string, { iconId?: string }>;
  landmarks?: Record<string, { iconId?: string }>;
};

export type ExportResult = {
  success: true;
  contentPack: ContentPack;
  manifest: GameManifest;
  packMeta: PackMetadata;
  warnings: string[];
  assets?: AssetEntry[];
  assetBindings?: AssetBindingMap;
  assetPacks?: AssetPack[];
};

export type ExportError = {
  success: false;
  errors: ValidationError[];
};

/** Export a WorldProject to engine-compatible ContentPack, GameManifest, and PackMetadata. */
export function exportToEngine(project: WorldProject): ExportResult | ExportError {
  // 1. Validate the project
  const validation = validateProject(project);
  if (!validation.valid) {
    return { success: false, errors: validation.errors };
  }

  const warnings: string[] = [];

  // 2. Convert zones
  const zones = convertZones(project);

  // 3. Convert districts
  const districts = convertDistricts(project);

  // 4. Convert entities
  if (project.entityPlacements.length === 0) {
    warnings.push('No entities found — exported world will have no NPCs or encounters. Add entity placements in the editor to populate your world.');
  }
  const entities = convertEntities(project);
  // Note: convertEntities 1:1 maps project.entityPlacements, so if placements exist,
  // entities will exist. The earlier "no placements" warning above is sufficient.

  // 5. Convert items
  const items = convertItems(project);

  // 6. Convert dialogues
  const dialogues = convertDialogues(project);

  // 7. Convert player template, build catalog, progression trees
  const playerTemplate = convertPlayerTemplate(project);
  const buildCatalog = convertBuildCatalog(project);
  const progressionTrees = convertProgressionTrees(project);

  // 8. Build manifest and pack metadata
  const manifest = convertManifest(project);
  const packMeta = convertPackMeta(project);

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

  // 11. Collect asset manifest and bindings for round-trip preservation
  const assets = project.assets.length > 0 ? project.assets : undefined;
  let assetBindings: AssetBindingMap | undefined;
  if (assets) {
    const zoneBindings: Record<string, { backgroundId?: string; tilesetId?: string }> = {};
    for (const z of project.zones) {
      if (z.backgroundId || z.tilesetId) {
        zoneBindings[z.id] = { backgroundId: z.backgroundId, tilesetId: z.tilesetId };
      }
    }
    const entityBindings: Record<string, { portraitId?: string; spriteId?: string }> = {};
    for (const e of project.entityPlacements) {
      if (e.portraitId || e.spriteId) {
        entityBindings[e.entityId] = { portraitId: e.portraitId, spriteId: e.spriteId };
      }
    }
    const itemBindings: Record<string, { iconId?: string }> = {};
    for (const i of project.itemPlacements) {
      if (i.iconId) {
        itemBindings[i.itemId] = { iconId: i.iconId };
      }
    }
    const landmarkBindings: Record<string, { iconId?: string }> = {};
    for (const l of project.landmarks) {
      if (l.iconId) {
        landmarkBindings[l.id] = { iconId: l.iconId };
      }
    }
    assetBindings = {};
    if (Object.keys(zoneBindings).length > 0) assetBindings.zones = zoneBindings;
    if (Object.keys(entityBindings).length > 0) assetBindings.entities = entityBindings;
    if (Object.keys(itemBindings).length > 0) assetBindings.items = itemBindings;
    if (Object.keys(landmarkBindings).length > 0) assetBindings.landmarks = landmarkBindings;
    if (Object.keys(assetBindings).length === 0) assetBindings = undefined;
  }

  // 12. Collect asset packs for round-trip preservation
  const assetPacks = project.assetPacks.length > 0 ? project.assetPacks : undefined;

  return {
    success: true,
    contentPack: {
      entities,
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
    },
    manifest,
    packMeta,
    warnings,
    assets,
    assetBindings,
    assetPacks,
  };
}
