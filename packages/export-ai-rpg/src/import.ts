// import.ts — main import pipeline: ContentPack/ExportResult/WorldProject → WorldProject

import type { WorldProject, ZoneConnection } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';
import type { ContentPack, ExportResult } from './export.js';
import type { PackMetadata } from '@ai-rpg-engine/pack-registry';

import { importZones } from './import-zones.js';
import { importDistricts } from './import-districts.js';
import { importEntities } from './import-entities.js';
import { importItems } from './import-items.js';
import { importDialogues } from './import-dialogues.js';
import { importPlayerTemplate } from './import-player-template.js';
import { importBuildCatalog } from './import-build-catalog.js';
import { importProgressionTrees } from './import-progression-trees.js';

export type ImportFormat = 'world-project' | 'content-pack' | 'export-result';

export interface ImportResult {
  project: WorldProject;
  format: ImportFormat;
  warnings: string[];
  lossless: boolean;
}

export interface ImportError {
  ok: false;
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

/** Detect the format of parsed JSON data. */
export function detectImportFormat(data: unknown): ImportFormat | null {
  if (typeof data !== 'object' || data === null) return null;
  const obj = data as Record<string, unknown>;

  // WorldProject has map + entityPlacements + zones
  if ('map' in obj && 'entityPlacements' in obj && 'zones' in obj) return 'world-project';

  // ExportResult has contentPack + manifest
  if ('contentPack' in obj && 'manifest' in obj) return 'export-result';

  // ContentPack has entities + zones but no map
  if ('entities' in obj && 'zones' in obj && !('map' in obj)) return 'content-pack';

  return null;
}

/** Import from any supported format. */
export function importProject(data: unknown): ImportResult | ImportError {
  const format = detectImportFormat(data);
  if (!format) return { ok: false, message: 'Unrecognized file format. Expected a WorldProject, ContentPack, or ExportResult JSON.' };

  if (format === 'world-project') {
    const project = data as WorldProject;
    const validation = validateProject(project);
    const warnings = validation.valid ? [] : validation.errors.map((e) => `${e.path}: ${e.message}`);
    return { project, format: 'world-project', warnings, lossless: true };
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
  return imported;
}

/** Import from a ContentPack (lossy — zones lose grid positions, entities lose zones). */
export function importFromContentPack(
  pack: ContentPack,
  projectName?: string,
  meta?: PackMetadata,
): ImportResult {
  const warnings: string[] = [];

  // 1. Import each domain
  const zones = importZones(pack.zones);
  const districts = importDistricts(pack.districts);
  const { placements: entityPlacements, warnings: entityWarnings } = importEntities(pack.entities, zones.map((z) => z.id));
  const { placements: itemPlacements, warnings: itemWarnings } = importItems(pack.items, zones.map((z) => z.id));
  const dialogues = importDialogues(pack.dialogues);
  const playerTemplate = importPlayerTemplate(pack.playerTemplate);
  const buildCatalog = importBuildCatalog(pack.buildCatalog);
  const progressionTrees = importProgressionTrees(pack.progressionTrees);

  warnings.push(...entityWarnings, ...itemWarnings);

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

    factionPresences: [],
    pressureHotspots: [],
    dialogues,

    playerTemplate,
    buildCatalog,
    progressionTrees,

    entityPlacements,
    itemPlacements,
    encounterAnchors: [],
    spawnPoints,
    craftingStations: [],
    marketNodes: [],

    tilesets: [],
    tileLayers: [],
    props: [],
    propPlacements: [],
    ambientLayers: [],
  };

  // 8. Add structural warnings
  if (zones.length > 0) warnings.push('Zone grid positions auto-generated (original layout unknown)');
  if (pack.entities.length > 0) warnings.push('Entity zone placements reconstructed (original zones unknown)');
  if (pack.items.length > 0) warnings.push('Item zone placements reconstructed (original zones unknown)');
  warnings.push('Visual layers not imported (tilesets, props, ambient)');

  // 9. Validate and surface any remaining issues
  const validation = validateProject(project);
  if (!validation.valid) {
    for (const err of validation.errors) {
      warnings.push(`Validation: ${err.path} — ${err.message}`);
    }
  }

  return { project, format: 'content-pack', warnings, lossless: false };
}
