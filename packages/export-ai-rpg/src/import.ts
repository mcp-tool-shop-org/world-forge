// import.ts — main import pipeline: ContentPack/ExportResult/WorldProject → WorldProject

import type { WorldProject, ZoneConnection, AuthoringMode } from '@world-forge/schema';
import { validateProject, isValidMode } from '@world-forge/schema';
import type { ContentPack, ExportResult, AssetBindingMap } from './export.js';
import type { PackMetadata } from '@ai-rpg-engine/pack-registry';
import type { FidelityEntry, FidelityReport } from './fidelity.js';
import { buildFidelityReport } from './fidelity.js';

import { importZones } from './import-zones.js';
import { importDistricts } from './import-districts.js';
import { importEntities } from './import-entities.js';
import { importItems } from './import-items.js';
import { importDialogues } from './import-dialogues.js';
import { importPlayerTemplate } from './import-player-template.js';
import { importBuildCatalog } from './import-build-catalog.js';
import { importProgressionTrees } from './import-progression-trees.js';

export type ImportFormat = 'world-project' | 'content-pack' | 'export-result' | 'project-bundle';

export interface ImportResult {
  success: true;
  project: WorldProject;
  format: ImportFormat;
  warnings: string[];
  lossless: boolean;
  fidelityReport: FidelityReport;
}

export interface ImportError {
  success: false;
  message: string;
}

// Reverse maps for recovering genre/tones/difficulty from PackMetadata
const REVERSE_GENRE: Record<string, string> = {
  fantasy: 'fantasy', 'sci-fi': 'sci-fi', cyberpunk: 'cyberpunk',
  horror: 'horror', mystery: 'detective', western: 'western',
  pirate: 'pirate', 'post-apocalyptic': 'zombie', historical: 'historical',
};

const REVERSE_DIFFICULTY: Record<string, string> = {
  beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced',
};

/** Infer authoring mode from project content when mode is not set. */
export function inferMode(project: WorldProject): AuthoringMode {
  // If mode is explicitly set and valid, use it
  if (project.mode && isValidMode(project.mode)) return project.mode;

  const kinds = new Set(project.connections.map((c) => c.kind).filter(Boolean));
  const area = project.map.gridWidth * project.map.gridHeight;

  // Connection-kind heuristics
  if (kinds.has('channel') || kinds.has('route')) return 'ocean';
  if (kinds.has('warp') || kinds.has('docking')) return 'space';

  // Tag-based heuristics for wilderness
  const allZoneTags = project.zones.flatMap((z) => z.tags ?? []);
  if (kinds.has('trail') && (allZoneTags.includes('camp') || allZoneTags.includes('wild'))) return 'wilderness';

  // Size-based heuristics
  if (area <= 400) return 'interior';   // small grid (e.g. 20×15 = 300)
  if (area >= 4000) return 'world';     // large grid (e.g. 80×60 = 4800)

  // Fallback
  return 'dungeon';
}

/** Detect the format of parsed JSON data. */
export function detectImportFormat(data: unknown): ImportFormat | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;

  // ProjectBundle has bundleVersion + project (must check before WorldProject)
  if ('bundleVersion' in obj && 'project' in obj
    && typeof obj.project === 'object' && obj.project !== null
    && 'map' in (obj.project as Record<string, unknown>)) return 'project-bundle';

  // WorldProject has map + entityPlacements + zones (all must be correct types)
  if ('map' in obj && 'entityPlacements' in obj && 'zones' in obj
    && typeof obj.map === 'object' && obj.map !== null
    && Array.isArray(obj.zones)
    && Array.isArray(obj.entityPlacements)) return 'world-project';

  // ExportResult has contentPack + manifest (both must be objects)
  if ('contentPack' in obj && 'manifest' in obj
    && typeof obj.contentPack === 'object' && obj.contentPack !== null
    && typeof obj.manifest === 'object' && obj.manifest !== null) return 'export-result';

  // ContentPack has entities + zones arrays but no map
  if ('entities' in obj && 'zones' in obj && !('map' in obj)
    && Array.isArray(obj.entities)
    && Array.isArray(obj.zones)) return 'content-pack';

  return null;
}

/** Import from any supported format. */
export function importProject(data: unknown): ImportResult | ImportError {
  const format = detectImportFormat(data);
  if (!format) return { success: false, message: 'Unrecognized file format. Expected a WorldProject, ContentPack, or ExportResult JSON.' };

  if (format === 'world-project') {
    const project = data as WorldProject;
    const validation = validateProject(project);
    const warnings = validation.valid ? [] : validation.errors.map((e) => `${e.path}: ${e.message}`);
    return { success: true, project, format: 'world-project', warnings, lossless: true, fidelityReport: buildFidelityReport([]) };
  }

  if (format === 'export-result') {
    return importFromExportResult(data as ExportResult);
  }

  return importFromContentPack(data as ContentPack);
}

/** Import from an ExportResult (has contentPack + manifest + packMeta). */
export function importFromExportResult(result: ExportResult, projectName?: string): ImportResult {
  const meta = result.packMeta;
  const imported = importFromContentPack(result.contentPack, projectName ?? meta?.name, meta);
  imported.format = 'export-result';

  // Recover mode from PackMetadata tags if present (e.g. "mode:ocean")
  if (meta?.tags) {
    const modeTag = meta.tags.find((t: string) => t.startsWith('mode:'));
    if (modeTag) {
      const modeValue = modeTag.slice(5); // strip "mode:"
      if (isValidMode(modeValue)) {
        imported.project.mode = modeValue;
      }
    }
  }

  // Recover assets + bindings from ExportResult (not available in raw ContentPack)
  if (result.assets && result.assets.length > 0) {
    imported.project.assets = result.assets;
    if (result.assetBindings) {
      applyAssetBindings(imported.project, result.assetBindings);
    }
    imported.fidelityReport.entries.push({
      level: 'lossless', domain: 'assets', severity: 'info',
      message: `${result.assets.length} asset(s) recovered from export result`,
      reason: 'assets-recovered',
    });
  }

  // Recover asset packs from ExportResult
  if (result.assetPacks && result.assetPacks.length > 0) {
    imported.project.assetPacks = result.assetPacks;
    imported.fidelityReport.entries.push({
      level: 'lossless', domain: 'packs', severity: 'info',
      message: `${result.assetPacks.length} asset pack(s) recovered from export result`,
      reason: 'asset-packs-recovered',
    });
  }

  return imported;
}

/** Apply asset bindings from an ExportResult back onto a WorldProject. */
function applyAssetBindings(project: WorldProject, bindings: AssetBindingMap): void {
  if (bindings.zones) {
    for (const z of project.zones) {
      const b = bindings.zones[z.id];
      if (b) {
        if (b.backgroundId) z.backgroundId = b.backgroundId;
        if (b.tilesetId) z.tilesetId = b.tilesetId;
      }
    }
  }
  if (bindings.entities) {
    for (const e of project.entityPlacements) {
      const b = bindings.entities[e.entityId];
      if (b) {
        if (b.portraitId) e.portraitId = b.portraitId;
        if (b.spriteId) e.spriteId = b.spriteId;
      }
    }
  }
  if (bindings.items) {
    for (const i of project.itemPlacements) {
      const b = bindings.items[i.itemId];
      if (b) {
        if (b.iconId) i.iconId = b.iconId;
      }
    }
  }
  if (bindings.landmarks) {
    for (const l of project.landmarks) {
      const b = bindings.landmarks[l.id];
      if (b) {
        if (b.iconId) l.iconId = b.iconId;
      }
    }
  }
}

/** Import from a ContentPack (lossy — zones lose grid positions, entities lose zones). */
export function importFromContentPack(
  pack: ContentPack,
  projectName?: string,
  meta?: PackMetadata,
): ImportResult {
  const allFidelity: FidelityEntry[] = [];

  // 1. Import each domain (destructure fidelity from each converter)
  const { zones, fidelity: zoneFidelity } = importZones(pack.zones);
  const { districts, fidelity: districtFidelity } = importDistricts(pack.districts);
  const { placements: entityPlacements, warnings: entityWarnings, fidelity: entityFidelity } = importEntities(pack.entities, zones.map((z) => z.id));
  const { placements: itemPlacements, warnings: itemWarnings, fidelity: itemFidelity } = importItems(pack.items, zones.map((z) => z.id));
  const { dialogues, fidelity: dialogueFidelity } = importDialogues(pack.dialogues);
  const { template: playerTemplate, fidelity: playerFidelity } = importPlayerTemplate(pack.playerTemplate);
  const { catalog: buildCatalog, fidelity: buildFidelity } = importBuildCatalog(pack.buildCatalog);
  const { trees: progressionTrees, fidelity: treeFidelity } = importProgressionTrees(pack.progressionTrees);

  // Collect all domain fidelity entries
  allFidelity.push(
    ...zoneFidelity, ...districtFidelity, ...entityFidelity, ...itemFidelity,
    ...dialogueFidelity, ...playerFidelity, ...buildFidelity, ...treeFidelity,
  );

  // 2. Cross-reference districts → zones: set parentDistrictId
  for (const d of districts) {
    for (const zid of d.zoneIds) {
      const zone = zones.find((z) => z.id === zid);
      if (zone) zone.parentDistrictId = d.id;
    }
  }

  // 3. Generate connections from zone neighbor pairs (deduplicated, bidirectional)
  const connections: ZoneConnection[] = [];
  const seen = new Set<string>();
  for (const zone of zones) {
    for (const nid of zone.neighbors) {
      const key = [zone.id, nid].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        connections.push({ fromZoneId: zone.id, toZoneId: nid, bidirectional: true });
      }
    }
  }

  if (connections.length > 0) {
    allFidelity.push({
      level: 'lossless', domain: 'world', severity: 'info',
      message: `${connections.length} connection(s) reconstructed from zone neighbor data`,
      reason: 'connections-reconstructed',
    });
  }

  // 4. Compute map dimensions from auto-layout bounds
  let maxX = 40, maxY = 30;
  for (const z of zones) {
    maxX = Math.max(maxX, z.gridX + z.gridWidth + 4);
    maxY = Math.max(maxY, z.gridY + z.gridHeight + 4);
  }

  // 5. Create spawn point
  const spawnZone = zones[0];
  const spawnPointId = playerTemplate?.spawnPointId ?? 'imported-spawn';
  const spawnPoints = spawnZone ? [{
    id: spawnPointId,
    zoneId: spawnZone.id,
    gridX: spawnZone.gridX + 1,
    gridY: spawnZone.gridY + 1,
    isDefault: true,
  }] : [];

  // Update player template spawnPointId if it was created fresh
  if (playerTemplate && !playerTemplate.spawnPointId && spawnPoints.length > 0) {
    playerTemplate.spawnPointId = spawnPointId;
  }

  // 6. Recover metadata from PackMetadata if available
  const genre = meta?.genres?.[0] ? (REVERSE_GENRE[meta.genres[0]] ?? meta.genres[0]) : 'fantasy';
  const tones = meta?.tones ? meta.tones.map(String) : ['atmospheric'];
  const difficulty = meta?.difficulty ? (REVERSE_DIFFICULTY[meta.difficulty] ?? 'intermediate') : 'intermediate';
  const narratorTone = meta?.narratorTone ?? '';

  // 7. Build the WorldProject
  const project: WorldProject = {
    id: `imported-${Date.now()}`,
    name: projectName ?? 'Imported World',
    description: meta?.description ?? 'Imported from engine content pack.',
    version: '0.1.0',
    genre,
    tones,
    difficulty,
    narratorTone,

    map: { id: 'map-1', name: projectName ?? 'Imported World', description: '', gridWidth: maxX, gridHeight: maxY, tileSize: 32 },
    zones,
    connections,
    districts,
    landmarks: [],

    factionPresences: pack.factionPresences ?? [],
    pressureHotspots: pack.pressureHotspots ?? [],
    dialogues,

    playerTemplate,
    buildCatalog,
    progressionTrees,

    entityPlacements,
    itemPlacements,
    encounterAnchors: pack.encounterAnchors ?? [],
    spawnPoints,
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

  // 7b. Infer and apply mode if not set
  if (!project.mode) {
    const inferred = inferMode(project);
    project.mode = inferred;
    allFidelity.push({
      level: 'approximated', domain: 'world', severity: 'info',
      message: `Authoring mode inferred as '${inferred}' from project content`,
      reason: 'mode-inferred',
    });
  }

  // 8. Add structural fidelity entries
  allFidelity.push({
    level: 'dropped', domain: 'world', severity: 'warning',
    message: 'Visual layers not imported (tilesets, props, ambient)',
    reason: 'visual-layers-dropped',
  });
  allFidelity.push({
    level: 'dropped', domain: 'assets', severity: 'warning',
    message: 'Asset manifest not available in ContentPack format',
    reason: 'assets-dropped',
  });
  allFidelity.push({
    level: 'dropped', domain: 'packs', severity: 'warning',
    message: 'Asset packs not available in ContentPack format',
    reason: 'asset-packs-dropped',
  });

  // 9. Build fidelity report
  const fidelityReport = buildFidelityReport(allFidelity);

  // 10. Derive backwards-compatible warnings from fidelity + entity/item warnings
  const warnings: string[] = [...entityWarnings, ...itemWarnings];
  if (zones.length > 0) warnings.push('Zone grid positions auto-generated (original layout unknown)');
  if (pack.entities.length > 0) warnings.push('Entity zone placements reconstructed (original zones unknown)');
  if (pack.items.length > 0) warnings.push('Item zone placements reconstructed (original zones unknown)');
  warnings.push('Visual layers not imported (tilesets, props, ambient)');

  // 11. Validate and surface any remaining issues
  const validation = validateProject(project);
  if (!validation.valid) {
    for (const err of validation.errors) {
      warnings.push(`Validation: ${err.path} — ${err.message}`);
    }
  }

  const lossless = fidelityReport.summary.approximated === 0 && fidelityReport.summary.dropped === 0;

  return { success: true, project, format: 'content-pack', warnings, lossless, fidelityReport };
}
