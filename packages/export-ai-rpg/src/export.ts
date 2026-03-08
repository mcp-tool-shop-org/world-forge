// export.ts — full export pipeline

import type { WorldProject, ValidationError } from '@world-forge/schema';
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
};

export type ExportResult = {
  contentPack: ContentPack;
  manifest: GameManifest;
  packMeta: PackMetadata;
  warnings: string[];
};

export type ExportError = {
  ok: false;
  errors: ValidationError[];
};

export function exportToEngine(project: WorldProject): ExportResult | ExportError {
  // 1. Validate the project
  const validation = validateProject(project);
  if (!validation.valid) {
    return { ok: false, errors: validation.errors };
  }

  const warnings: string[] = [];

  // 2. Convert zones
  const zones = convertZones(project);

  // 3. Convert districts
  const districts = convertDistricts(project);

  // 4. Convert entities
  const entities = convertEntities(project);
  if (entities.length === 0) {
    warnings.push('No entities in the world — the engine expects at least one NPC or enemy');
  }

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

  return {
    contentPack: {
      entities,
      zones,
      districts,
      dialogues,
      items,
      playerTemplate,
      buildCatalog,
      progressionTrees,
    },
    manifest,
    packMeta,
    warnings,
  };
}
