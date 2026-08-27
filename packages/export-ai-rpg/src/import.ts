/**
 * import.ts — Main import pipeline: ContentPack / ExportResult / WorldProject → WorldProject
 *
 * ## Import Pipeline Architecture
 *
 * The import pipeline follows a three-stage process:
 *
 * 1. **Format Detection** (`detectImportFormat`)
 *    Inspects the shape of parsed JSON to determine which import format it matches.
 *    Supported formats: `world-project`, `content-pack`, `export-result`, `project-bundle`.
 *
 * 2. **Conversion** (per-domain converter functions)
 *    Each domain (zones, entities, items, dialogues, etc.) has a dedicated import
 *    converter in its own module (e.g. `import-zones.ts`, `import-entities.ts`).
 *    Converters transform engine-format data back into WorldProject domain objects
 *    and produce {@link FidelityEntry} records documenting any data loss.
 *
 * 3. **Assembly** (`importProject` / `importFromContentPack` / `importFromExportResult`)
 *    Combines converted domains into a complete {@link WorldProject}, infers missing
 *    metadata (mode, connections, spawn points), runs validation, and builds the
 *    {@link FidelityReport}.
 *
 * ## How to Add a New Import Format
 *
 * 1. Add the new format name to the {@link ImportFormat} union type.
 * 2. Add a detection clause in {@link detectImportFormat} that identifies the new
 *    format by its structural shape (check for unique top-level keys).
 * 3. Write a converter function (e.g. `importFromMyFormat`) that accepts the raw
 *    data and returns an {@link ImportResult}. Use per-domain importers where possible.
 * 4. Add a branch in {@link importProject} that dispatches to your converter.
 * 5. Re-export any new public functions/types from `index.ts`.
 *
 * ## Extension Points
 *
 * - {@link detectImportFormat} — Add detection logic for new shapes.
 * - Per-domain converters (`importZones`, `importEntities`, etc.) — Reuse or extend
 *   for formats that share the engine's domain schemas.
 * - {@link importProject} — The main entry point; add dispatch branches here.
 * - {@link ImportFormat} — The union type listing all recognized formats.
 * - {@link FidelityEntry} / {@link FidelityDomain} (in `fidelity.ts`) — Extend with
 *   new domains if your format introduces data categories not yet tracked.
 *
 * @module import
 */

import type { WorldProject, ZoneConnection, AuthoringMode, ValidationError } from '@world-forge/schema';
import { validateProject, isValidMode, SCHEMA_VERSION } from '@world-forge/schema';
import type { ContentPack, ExportResult, AssetBindingMap } from './export.js';
import type { PackMetadata } from '@ai-rpg-engine/pack-registry';
import type { FidelityEntry, FidelityReport } from './fidelity.js';
import { buildFidelityReport } from './fidelity.js';
import { safeLookup } from './safe-lookup.js';
import { GENRE_MAP, DIFFICULTY_MAP, ENGINE_VERSION_RANGE, RETIRED_PHANTOM_MODULES } from './convert-pack.js';

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
  errors: ValidationError[];
}

// EB-012: Reverse maps must stay in sync with GENRE_MAP / DIFFICULTY_MAP in convert-pack.ts.
// F-0fdda22c: canonical reverse is IDENTITY, not the editor alias — a pack
// that exported genre 'mystery' must import as 'mystery', not 'detective'.
// Derived from the forward-map VALUES so a newly added VALID_GENRES identity
// cannot sit in GENRE_MAP and miss the reverse table.
/** @internal Exported for drift-guard tests only (AIR-A-005/006). */
export const REVERSE_GENRE: Record<string, string> = Object.fromEntries(
  [...new Set(Object.values(GENRE_MAP))].map((g) => [g, g]),
);

/** @internal Exported for drift-guard tests only (AIR-A-005/006). */
export const REVERSE_DIFFICULTY: Record<string, string> = Object.fromEntries(
  [...new Set(Object.values(DIFFICULTY_MAP))].map((d) => [d, d]),
);

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

  // EB-010: Explicit error path for null/unrecognized format
  if (format === null) {
    const message = 'Unrecognized file format. Expected a WorldProject (.map + .zones + .entityPlacements), ContentPack (.entities + .zones), ExportResult (.contentPack + .manifest), or ProjectBundle (.bundleVersion + .project). Check that your JSON structure matches one of these shapes.';
    return {
      success: false,
      message,
      errors: [{ path: 'import', message }],
    };
  }

  if (format === 'world-project') {
    // F-159f42a6: fail closed, matching exportToEngine's ExportError path.
    // A truncated project that passes detectImportFormat (map+zones+entityPlacements)
    // but fails validateProject is NOT a successful import, and lossless:true
    // was a lie when validation.errors is non-empty.
    const project = data as WorldProject;
    const validation = validateProject(project);
    if (!validation.valid) {
      return {
        success: false,
        message: `WorldProject failed schema validation (${validation.errors.length} error(s)).`,
        errors: validation.errors,
      };
    }
    return { success: true, project, format: 'world-project', warnings: [], lossless: true, fidelityReport: buildFidelityReport([]) };
  }

  if (format === 'export-result') {
    return importFromExportResult(data as ExportResult);
  }

  if (format === 'content-pack') {
    return importFromContentPack(data as ContentPack);
  }

  // project-bundle: extract the embedded project
  if (format === 'project-bundle') {
    const bundle = data as { project: WorldProject };
    return importProject(bundle.project);
  }

  // Exhaustive: this should never be reached
  const message = `Internal error: unhandled import format '${format as string}'.`;
  return { success: false, message, errors: [{ path: 'import', message }] };
}

/** Import from an ExportResult (has contentPack + manifest + packMeta). */
export function importFromExportResult(result: ExportResult, projectName?: string): ImportResult | ImportError {
  const meta = result.packMeta;
  const imported = importFromContentPack(result.contentPack, projectName ?? meta?.name, meta, result.manifest);
  if (!imported.success) return imported;
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

type ManifestLike = { engineVersion?: string; modules?: string[] };

function parseSemverTriple(version: string): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function cmpTriple(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function classifyAgainstCurrent(
  version: string | undefined,
  current: string,
): 'ok' | 'missing' | 'behind' | 'ahead' | 'unknown' {
  if (version === undefined || version === '') return 'missing';
  if (version === current) return 'ok';
  const v = parseSemverTriple(version);
  const c = parseSemverTriple(current);
  if (!v || !c) return 'unknown';
  const cmp = cmpTriple(v, c);
  if (cmp === 0) return 'ok';
  return cmp < 0 ? 'behind' : 'ahead';
}

function classifyAgainstRange(
  version: string | undefined,
  range: string,
): 'ok' | 'missing' | 'behind' | 'ahead' | 'unknown' {
  if (version === undefined || version === '') return 'missing';
  if (version === range) return 'ok';
  const v = parseSemverTriple(version);
  if (!v) return 'unknown';
  const ge = />=\s*(\d+\.\d+\.\d+)/.exec(range);
  const lt = /<\s*(\d+\.\d+\.\d+)/.exec(range);
  if (!ge || !lt) return 'unknown';
  const floor = parseSemverTriple(ge[1]);
  const ceil = parseSemverTriple(lt[1]);
  if (!floor || !ceil) return 'unknown';
  if (cmpTriple(v, floor) < 0) return 'behind';
  if (cmpTriple(v, ceil) >= 0) return 'ahead';
  return 'ok';
}

/** F-64b9e73d: warn when schemaVersion / engineVersion / retired modules are off. */
function collectProvenanceNotes(
  pack: ContentPack,
  meta?: PackMetadata,
  manifest?: ManifestLike,
): { warnings: string[]; fidelity: FidelityEntry[] } {
  const warnings: string[] = [];
  const fidelity: FidelityEntry[] = [];

  const schemaClass = classifyAgainstCurrent(pack.schemaVersion, SCHEMA_VERSION);
  if (schemaClass !== 'ok') {
    const msg = schemaClass === 'missing'
      ? `ContentPack.schemaVersion is missing — importer cannot pick a migration path (current schema is ${SCHEMA_VERSION}).`
      : schemaClass === 'behind'
        ? `ContentPack.schemaVersion '${pack.schemaVersion}' is behind the current schema ${SCHEMA_VERSION}.`
        : schemaClass === 'ahead'
          ? `ContentPack.schemaVersion '${pack.schemaVersion}' is unknown-ahead of the current schema ${SCHEMA_VERSION}.`
          : `ContentPack.schemaVersion '${pack.schemaVersion}' is not a recognised semver (current schema is ${SCHEMA_VERSION}).`;
    warnings.push(msg);
    fidelity.push({
      level: 'approximated', domain: 'world', severity: 'warning',
      fieldPath: 'schemaVersion',
      message: msg,
      reason: `schema-version-${schemaClass}`,
    });
  }

  // engineVersion lives on the manifest (and packMeta). A raw ContentPack
  // has no such field — don't invent a miss when the caller didn't pass one.
  if (manifest !== undefined || meta !== undefined) {
    const engineVersion = manifest?.engineVersion ?? meta?.engineVersion;
    const engineClass = classifyAgainstRange(engineVersion, ENGINE_VERSION_RANGE);
    if (engineClass !== 'ok') {
      const labelled = engineVersion === undefined || engineVersion === '' ? '(missing)' : `'${engineVersion}'`;
      const msg = engineClass === 'missing'
        ? `engineVersion is missing — importer expected a version in ${ENGINE_VERSION_RANGE}.`
        : engineClass === 'behind'
          ? `engineVersion ${labelled} is behind the supported range ${ENGINE_VERSION_RANGE}.`
          : engineClass === 'ahead'
            ? `engineVersion ${labelled} is unknown-ahead of the supported range ${ENGINE_VERSION_RANGE}.`
            : `engineVersion ${labelled} is not a recognised version in ${ENGINE_VERSION_RANGE}.`;
      warnings.push(msg);
      fidelity.push({
        level: 'approximated', domain: 'world', severity: 'warning',
        fieldPath: 'engineVersion',
        message: msg,
        reason: `engine-version-${engineClass}`,
      });
    }
  }

  const modules = manifest?.modules ?? [];
  for (const id of modules) {
    if (!Object.hasOwn(RETIRED_PHANTOM_MODULES, id)) continue;
    const replacement = RETIRED_PHANTOM_MODULES[id];
    const msg = replacement
      ? `Retired module '${id}' is remapped to '${replacement}' (the engine no longer registers '${id}').`
      : `Retired phantom module '${id}' has no engine counterpart and will not load.`;
    warnings.push(msg);
    fidelity.push({
      level: 'dropped', domain: 'world', severity: 'warning',
      fieldPath: 'modules',
      message: msg,
      reason: replacement ? 'retired-module-remapped' : 'retired-module-phantom',
    });
  }

  return { warnings, fidelity };
}

function converterFailed(err: unknown): ImportError {
  const message = err instanceof Error ? err.message : String(err);
  return {
    success: false,
    message: `Converter failed: ${message}. Report this as a bug.`,
    errors: [{ path: 'converter', message: `Converter failed: ${message}. Report this as a bug.` }],
  };
}

/** Import from a ContentPack (lossy — zones lose grid positions, entities lose zones). */
export function importFromContentPack(
  pack: ContentPack,
  projectName?: string,
  meta?: PackMetadata,
  manifest?: ManifestLike,
): ImportResult | ImportError {
  const allFidelity: FidelityEntry[] = [];

  let zones: ReturnType<typeof importZones>['zones'];
  let districts: ReturnType<typeof importDistricts>['districts'];
  let entityPlacements: ReturnType<typeof importEntities>['placements'];
  let itemPlacements: ReturnType<typeof importItems>['placements'];
  let dialogues: ReturnType<typeof importDialogues>['dialogues'];
  let playerTemplate: ReturnType<typeof importPlayerTemplate>['template'];
  let buildCatalog: ReturnType<typeof importBuildCatalog>['catalog'];
  let progressionTrees: ReturnType<typeof importProgressionTrees>['trees'];
  let entityWarnings: string[] = [];
  let itemWarnings: string[] = [];
  let entityFidelity: FidelityEntry[] = [];
  const engineEntities = pack.entities ?? [];
  const engineItems = pack.items ?? [];

  // F-1d5f2ce5: wrap converters in the same try/catch exportToEngine uses so a
  // TypeError from untrusted JSON becomes ImportError rather than escaping.
  try {
    // 1. Import each domain (destructure fidelity from each converter).
    // F-1d5f2ce5: districts/items get the same `?? []` dialogues/progressionTrees
    // already had — detectImportFormat admits a pack on entities+zones alone.
    const zoneResult = importZones(pack.zones ?? []);
    zones = zoneResult.zones;
    const districtResult = importDistricts(pack.districts ?? []);
    districts = districtResult.districts;
    // F-5a257bc8 (swarm wave-2, headline fix): pack.placements is threaded
    // through so importEntities can restore each entity's REAL authored zoneId
    // (and spawnCondition) instead of always falling back to round-robin. See
    // importEntities's own doc comment for the per-entity fallback rule.
    const entityResult = importEntities(engineEntities, zones.map((z) => z.id), pack.placements);
    entityPlacements = entityResult.placements;
    entityWarnings = entityResult.warnings;
    entityFidelity = entityResult.fidelity;
    const itemResult = importItems(engineItems, zones.map((z) => z.id));
    itemPlacements = itemResult.placements;
    itemWarnings = itemResult.warnings;
    const dialogueResult = importDialogues(pack.dialogues ?? []);
    dialogues = dialogueResult.dialogues;
    const playerResult = importPlayerTemplate(pack.playerTemplate);
    playerTemplate = playerResult.template;
    const buildResult = importBuildCatalog(pack.buildCatalog);
    buildCatalog = buildResult.catalog;
    const treeResult = importProgressionTrees(pack.progressionTrees ?? []);
    progressionTrees = treeResult.trees;

    // Collect all domain fidelity entries
    allFidelity.push(
      ...zoneResult.fidelity, ...districtResult.fidelity, ...entityFidelity, ...itemResult.fidelity,
      ...dialogueResult.fidelity, ...playerResult.fidelity, ...buildResult.fidelity, ...treeResult.fidelity,
    );
  } catch (err) {
    return converterFailed(err);
  }

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

  // 4. Compute map dimensions from auto-layout bounds (40×30 minimum floor)
  let maxX = 0, maxY = 0;
  for (const z of zones) {
    maxX = Math.max(maxX, z.gridX + z.gridWidth + 4);
    maxY = Math.max(maxY, z.gridY + z.gridHeight + 4);
  }
  maxX = Math.max(maxX, 40);
  maxY = Math.max(maxY, 30);

  // 5. Create spawn point
  if (zones.length === 0) {
    allFidelity.push({
      level: 'dropped', domain: 'zones', severity: 'warning',
      message: 'No zones found — cannot create spawn point. The imported world will have no navigable areas.',
      reason: 'no-zones-no-spawn',
    });
  }
  const spawnZone = zones[0];
  const spawnPointId = (playerTemplate?.spawnPointId && playerTemplate.spawnPointId !== '') ? playerTemplate.spawnPointId : 'imported-spawn';
  const spawnPoints = spawnZone ? [{
    id: spawnPointId,
    zoneId: spawnZone.id,
    gridX: spawnZone.gridX + 1,
    gridY: spawnZone.gridY + 1,
    isDefault: true,
  }] : [];

  // Update player template spawnPointId if it was created fresh (check empty string too)
  if (playerTemplate && (!playerTemplate.spawnPointId || playerTemplate.spawnPointId === '') && spawnPoints.length > 0) {
    playerTemplate.spawnPointId = spawnPointId;
  }

  // 6. Recover metadata from PackMetadata if available
  // EB-015: Null-coalescing for meta.genres and meta.tones before .map()
  // F-d0f3a1ed: reverse maps go through safeLookup so a prototype-name key
  // ('__proto__' / 'constructor' / 'toString') misses instead of resolving to
  // Object.prototype / Object / Function.
  const authoredGenre = meta?.genres?.[0];
  const genre = authoredGenre
    ? (safeLookup(REVERSE_GENRE, authoredGenre) ?? authoredGenre)
    : 'fantasy';
  const tones = (meta?.tones ?? []).length > 0 ? (meta?.tones ?? []).map(String) : ['atmospheric'];
  const authoredDifficulty = meta?.difficulty;
  const difficulty = authoredDifficulty
    ? (safeLookup(REVERSE_DIFFICULTY, authoredDifficulty) ?? 'intermediate')
    : 'intermediate';
  const narratorTone = meta?.narratorTone ?? '';

  // 7. Build the WorldProject
  const project: WorldProject = {
    id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
    // F-f216da1a (swarm wave-4): these used to be hardcoded to `[]` even
    // though the export side now actually carries this content on
    // `ContentPack.craftingStations` / `.marketNodes` (raw pass-through —
    // see export.ts's ContentPack doc comment) — a round trip erased both
    // in this direction regardless of what the pack held. `?? []` guards a
    // hand-authored/older ContentPack that omits the keys entirely, the same
    // defensive style already used for `pack.dialogues ?? []` /
    // `pack.encounterAnchors ?? []` / `pack.progressionTrees ?? []` above —
    // `ContentPack` is a type annotation on the input, not a runtime
    // guarantee, so this boundary treats it as untrusted parsed JSON.
    craftingStations: pack.craftingStations ?? [],
    marketNodes: pack.marketNodes ?? [],
    // F-5442422b (swarm wave-2 health-amend-a): last two ContentPack raw
    // pass-through catalogs export already wrote and import dropped.
    // Sweep of pack → project catalogs at this constructor:
    //   restored: encounterAnchors, factionPresences, pressureHotspots,
    //             craftingStations, marketNodes
    //   were dropped: hazardDefinitions, lootTables
    // Same untrusted-JSON `?? []` as the wave-4 station/node reads above.
    // Zones' hazardRefs (F-9f90a607) are not sufficient coverage — schema
    // rule 77 rejects a ref whose definition is missing from the project.
    hazardDefinitions: pack.hazardDefinitions ?? [],
    lootTables: pack.lootTables ?? [],

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

  // F-64b9e73d: consult schemaVersion / engineVersion / retired modules instead
  // of stamping the pack with the same mapping regardless of provenance.
  const provenance = collectProvenanceNotes(pack, meta, manifest);
  allFidelity.push(...provenance.fidelity);

  // 9. Build fidelity report
  const fidelityReport = buildFidelityReport(allFidelity);

  // 10. Derive backwards-compatible warnings from fidelity + entity/item warnings
  const warnings: string[] = [...entityWarnings, ...itemWarnings, ...provenance.warnings];
  if (zones.length > 0) warnings.push('Zone grid positions auto-generated (original layout unknown)');
  // F-5a257bc8 (swarm wave-2): this warning used to fire unconditionally
  // whenever the pack had entities, claiming "original zones unknown" even
  // when pack.placements held the real answer for every one of them. Now it
  // only fires for the entities that ACTUALLY fell back to round-robin —
  // counted from entityFidelity rather than re-deriving the same per-entity
  // logic importEntities already did.
  const roundRobinFallbackCount = entityFidelity.filter(
    (f) => f.domain === 'entities' && f.reason === 'zone-placement-round-robin',
  ).length;
  if (roundRobinFallbackCount > 0) {
    warnings.push(
      roundRobinFallbackCount === engineEntities.length
        ? 'Entity zone placements reconstructed (original zones unknown) — this pack has no placements[] data.'
        : `Entity zone placements reconstructed for ${roundRobinFallbackCount} of ${engineEntities.length} entities (original zone unknown for these; the rest were restored from the pack's placements[] data).`,
    );
  }
  if (engineItems.length > 0) warnings.push('Item zone placements reconstructed (original zones unknown)');
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
