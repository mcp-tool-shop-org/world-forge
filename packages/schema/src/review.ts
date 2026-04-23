// review.ts — project review snapshot model + health classification

import type { WorldProject } from './project.js';
import type { ValidationResult } from './validate.js';
import type { DependencySummary } from './dependencies.js';
import type { AuthoringMode } from './authoring-mode.js';
import { validateProject } from './validate.js';
import { advisoryValidation } from './advisory.js';
import { scanDependencies } from './dependencies.js';
import { DEFAULT_MODE } from './authoring-mode.js';

// ── Types ──────────────────────────────────────────────────

export type HealthStatus = 'ready' | 'healthy' | 'degraded' | 'blocked';

export interface ContentCounts {
  zones: number;
  districts: number;
  entities: number;
  items: number;
  dialogues: number;
  progressionTrees: number;
  spawns: number;
  connections: number;
  encounters: number;
  landmarks: number;
  assets: number;
  assetPacks: number;
  factions: number;
  hotspots: number;
}

export interface SystemCompleteness {
  hasPlayerTemplate: boolean;
  hasBuildCatalog: boolean;
  hasProgressionTrees: boolean;
  hasDialogues: boolean;
  hasSpawnPoints: boolean;
  missingLabels: string[];
}

export interface RegionSummary {
  id: string;
  name: string;
  zoneCount: number;
  zoneNames: string[];
  controllingFaction?: string;
  tags: string[];
  metrics: { commerce: number; morale: number; safety: number; stability: number };
  entityCount: number;
  entityRoles: Record<string, number>;
  encounterCount: number;
  itemCount: number;
}

export interface EncounterSummary {
  byType: Record<string, number>;
  totalCount: number;
  avgProbability: number;
  zonesWithEncounters: number;
  bossEncounters: number;
}

export interface ConnectionSummary {
  byKind: Record<string, number>;
  totalCount: number;
  conditionalCount: number;
  oneWayCount: number;
  bidirectionalCount: number;
}

export interface ValidationSummary {
  valid: boolean;
  errorCount: number;
  errorsByDomain: Record<string, number>;
  firstErrors: Array<{ path: string; message: string }>;
}

export interface AdvisorySummary {
  suggestionCount: number;
  firstSuggestions: Array<{ message: string }>;
}

export interface DependencyHealthSummary {
  broken: number;
  mismatched: number;
  orphaned: number;
  totalIssues: number;
}

export interface ReviewSnapshot {
  // Metadata
  projectName: string;
  projectId: string;
  version: string;
  genre: string;
  mode: string;
  modeLabel: string;
  description: string;
  generatedAt: string;

  // Health
  health: HealthStatus;
  healthLabel: string;

  // Counts
  counts: ContentCounts;
  systems: SystemCompleteness;

  // Domain summaries
  regions: RegionSummary[];
  encounters: EncounterSummary;
  connections: ConnectionSummary;

  // Health summaries
  validation: ValidationSummary;
  advisory: AdvisorySummary;
  dependencies: DependencyHealthSummary;
}

// ── Mode labels ────────────────────────────────────────────

// MAINTENANCE: When adding a new AuthoringMode in authoring-mode.ts,
// add a label here. Otherwise the mode will display its raw key as the label.
const MODE_LABELS: Record<string, string> = {
  dungeon: 'Dungeon Crawl',
  district: 'City District',
  world: 'Open World',
  ocean: 'Naval / Ocean',
  space: 'Space Sector',
  interior: 'Interior',
  wilderness: 'Wilderness',
};

// ── Health classification ──────────────────────────────────

const HEALTH_LABELS: Record<HealthStatus, string> = {
  ready: 'Ready to export',
  healthy: 'Healthy (minor cleanup available)',
  degraded: 'Degraded (fixable issues)',
  blocked: 'Blocked (validation errors)',
};

export function classifyHealth(validation: ValidationResult, depSummary: DependencySummary): HealthStatus {
  if (!validation.valid) return 'blocked';
  if (depSummary.broken > 0 || depSummary.mismatched > 0) return 'degraded';
  if (depSummary.orphaned > 0) return 'healthy';
  return 'ready';
}

// ── Validation domain classifier (schema-side, no editor import) ──

/**
 * Dedupe set for unknown-prefix warnings. Module-level so a noisy fixture or
 * a mis-typed path only warns ONCE per unique prefix per process — health
 * dashboards and log aggregators still see the signal without being flooded.
 */
const WARNED_UNKNOWN_PREFIXES = new Set<string>();

/**
 * Map a ValidationError.path to a coarse domain bucket used by the review UI.
 *
 * ── Path-prefix contract ───────────────────────────────────
 * Known prefixes (order-sensitive, longest-first for overlapping roots):
 *   - `assetPacks`          → `'packs'`
 *   - `assets`              → `'assets'`
 *   - `entityPlacements`    → `'entities'`
 *   - `itemPlacements`      → `'items'`
 *   - `dialogues`           → `'dialogue'`
 *   - `playerTemplate`      → `'player'`
 *   - `buildCatalog`        → `'builds'`
 *   - `progressionTrees`    → `'progression'`
 *
 * Any other prefix (including `zones`, `map`, `districts`, `connections`,
 * `encounterAnchors`, top-level metadata fields, and truly unknown paths)
 * falls through to the `'world'` bucket — the documented catch-all.
 *
 * Unknown/unrecognized prefixes also emit a ONE-TIME `console.warn` per
 * process so health dashboards notice that a new error path was introduced
 * without a corresponding classifier update. Tests or callers that want to
 * silence the warn should swap out `console.warn` or preload
 * {@link WARNED_UNKNOWN_PREFIXES} with the prefix.
 *
 * When adding a new top-level project section, add its prefix here AND update
 * the regression test in `__tests__/review.test.ts` so every known domain has
 * a non-default classification.
 */
function classifyValidationDomain(path: string): string {
  if (path.startsWith('assetPacks')) return 'packs';
  if (path.startsWith('assets')) return 'assets';
  if (path.startsWith('entityPlacements')) return 'entities';
  if (path.startsWith('itemPlacements')) return 'items';
  if (path.startsWith('dialogues')) return 'dialogue';
  if (path.startsWith('playerTemplate')) return 'player';
  if (path.startsWith('buildCatalog')) return 'builds';
  if (path.startsWith('progressionTrees')) return 'progression';

  // Fell through to the catch-all. Emit an observable signal so dashboards
  // can catch new path shapes that were introduced without a classifier update.
  // Dedupe on the top-level segment (everything before the first '.') so
  // `zones.z1.field` and `zones.z2.other` only warn once for `zones`.
  const firstDot = path.indexOf('.');
  const prefix = firstDot === -1 ? path : path.slice(0, firstDot);
  if (prefix && !WARNED_UNKNOWN_PREFIXES.has(prefix)) {
    WARNED_UNKNOWN_PREFIXES.add(prefix);
    // Known-world prefixes that we intentionally route through the catch-all
    // (zones, map, etc.) are silenced from the warn to keep the channel clean.
    const KNOWN_WORLD_PREFIXES = new Set([
      'zones', 'map', 'districts', 'connections', 'encounterAnchors',
      'spawnPoints', 'landmarks', 'factionPresences', 'pressureHotspots',
      'craftingStations', 'marketNodes', 'tilesets', 'tileLayers',
      'props', 'propPlacements', 'ambientLayers',
      // Top-level metadata fields
      'id', 'name', 'description', 'version', 'genre', 'tones', 'difficulty',
      'narratorTone', 'mode', 'author', 'license', 'category',
    ]);
    if (!KNOWN_WORLD_PREFIXES.has(prefix)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[world-forge/schema] classifyValidationDomain: unknown path prefix "${prefix}" — routed to 'world'. ` +
          `Add it to the classifier in review.ts if it deserves its own domain bucket.`,
      );
    }
  }
  return 'world';
}

/**
 * Test-only: reset the unknown-prefix warn dedupe set. Exported for regression
 * tests that need a clean warn channel per run; not part of the public API.
 * @internal
 */
export function __resetClassifyDomainWarnings(): void {
  WARNED_UNKNOWN_PREFIXES.clear();
}

// ── Build snapshot ─────────────────────────────────────────

export function buildReviewSnapshot(project: WorldProject): ReviewSnapshot {
  const validation = validateProject(project);
  const advisory = advisoryValidation(project);
  const depReport = scanDependencies(project);
  const mode: AuthoringMode = project.mode ?? DEFAULT_MODE;

  // Health
  const health = classifyHealth(validation, depReport.summary);

  // Content counts
  const counts: ContentCounts = {
    zones: project.zones.length,
    districts: project.districts.length,
    entities: project.entityPlacements.length,
    items: project.itemPlacements.length,
    dialogues: project.dialogues.length,
    progressionTrees: project.progressionTrees.length,
    spawns: project.spawnPoints.length,
    connections: project.connections.length,
    encounters: project.encounterAnchors.length,
    landmarks: project.landmarks.length,
    assets: project.assets.length,
    assetPacks: project.assetPacks.length,
    factions: project.factionPresences.length,
    hotspots: project.pressureHotspots.length,
  };

  // System completeness
  const missingLabels: string[] = [];
  if (!project.playerTemplate) missingLabels.push('No player template');
  if (!project.buildCatalog) missingLabels.push('No build catalog');
  if (project.progressionTrees.length === 0) missingLabels.push('No progression trees');
  if (project.dialogues.length === 0) missingLabels.push('No dialogues');
  if (project.spawnPoints.length === 0) missingLabels.push('No spawn points');

  const systems: SystemCompleteness = {
    hasPlayerTemplate: !!project.playerTemplate,
    hasBuildCatalog: !!project.buildCatalog,
    hasProgressionTrees: project.progressionTrees.length > 0,
    hasDialogues: project.dialogues.length > 0,
    hasSpawnPoints: project.spawnPoints.length > 0,
    missingLabels,
  };

  // Region summaries
  // NOTE: Memoization opportunity — zoneMap and district-entity lookups could be
  // cached if buildReviewSnapshot is called repeatedly on the same project
  // (e.g. during editor live-refresh with sub-second intervals). Currently
  // expected to be called once per user action, so rebuild cost is acceptable.
  const zoneMap = new Map(project.zones.map((z) => [z.id, z]));
  const regions: RegionSummary[] = project.districts.map((d) => {
    const districtZoneIds = new Set(d.zoneIds);
    const zoneNames = d.zoneIds
      .map((zid) => zoneMap.get(zid)?.name)
      .filter((n): n is string => !!n);

    // Entities in this district's zones
    const districtEntities = project.entityPlacements.filter((ep) => districtZoneIds.has(ep.zoneId));
    const entityRoles: Record<string, number> = {};
    for (const ep of districtEntities) {
      entityRoles[ep.role] = (entityRoles[ep.role] || 0) + 1;
    }

    // Encounters in this district's zones
    const encounterCount = project.encounterAnchors.filter((ea) => districtZoneIds.has(ea.zoneId)).length;

    // Items in this district's zones
    const itemCount = project.itemPlacements.filter((ip) => districtZoneIds.has(ip.zoneId)).length;

    // Safely access baseMetrics — if missing (e.g. draft district), default all to 0.
    // This avoids a runtime crash and surfaces the gap in the review output.
    const metrics = d.baseMetrics ?? { commerce: 0, morale: 0, safety: 0, stability: 0 };

    return {
      id: d.id,
      name: d.name,
      zoneCount: d.zoneIds.length,
      zoneNames,
      controllingFaction: d.controllingFaction,
      tags: d.tags,
      metrics: {
        commerce: metrics.commerce ?? 0,
        morale: metrics.morale ?? 0,
        safety: metrics.safety ?? 0,
        stability: metrics.stability ?? 0,
      },
      entityCount: districtEntities.length,
      entityRoles,
      encounterCount,
      itemCount,
    };
  });

  // Encounter summary
  const byType: Record<string, number> = {};
  let totalProbability = 0;
  const zonesWithEncounters = new Set<string>();
  let bossEncounters = 0;
  for (const ea of project.encounterAnchors) {
    byType[ea.encounterType] = (byType[ea.encounterType] || 0) + 1;
    totalProbability += ea.probability;
    zonesWithEncounters.add(ea.zoneId);
    if (ea.tags.includes('boss')) bossEncounters++;
  }
  const encounters: EncounterSummary = {
    byType,
    totalCount: project.encounterAnchors.length,
    avgProbability: project.encounterAnchors.length > 0
      ? totalProbability / project.encounterAnchors.length
      : 0,
    zonesWithEncounters: zonesWithEncounters.size,
    bossEncounters,
  };

  // Connection summary
  const byKind: Record<string, number> = {};
  let conditionalCount = 0;
  let oneWayCount = 0;
  let bidirectionalCount = 0;
  for (const c of project.connections) {
    const kind = c.kind || 'passage';
    byKind[kind] = (byKind[kind] || 0) + 1;
    if (c.condition) conditionalCount++;
    if (c.bidirectional) bidirectionalCount++;
    else oneWayCount++;
  }
  const connectionSummary: ConnectionSummary = {
    byKind,
    totalCount: project.connections.length,
    conditionalCount,
    oneWayCount,
    bidirectionalCount,
  };

  // Validation summary
  const errorsByDomain: Record<string, number> = {};
  for (const err of validation.errors) {
    const domain = classifyValidationDomain(err.path);
    errorsByDomain[domain] = (errorsByDomain[domain] || 0) + 1;
  }
  const validationSummary: ValidationSummary = {
    valid: validation.valid,
    errorCount: validation.errors.length,
    errorsByDomain,
    firstErrors: validation.errors.slice(0, 5).map((e) => ({ path: e.path, message: e.message })),
  };

  // Advisory summary
  const advisorySummary: AdvisorySummary = {
    suggestionCount: advisory.items.length,
    firstSuggestions: advisory.items.slice(0, 5).map((a) => ({ message: a.message })),
  };

  // Dependency health
  const dependencies: DependencyHealthSummary = {
    broken: depReport.summary.broken,
    mismatched: depReport.summary.mismatched,
    orphaned: depReport.summary.orphaned,
    totalIssues: depReport.summary.broken + depReport.summary.mismatched + depReport.summary.orphaned,
  };

  return {
    projectName: project.name,
    projectId: project.id,
    version: project.version,
    genre: project.genre,
    mode,
    modeLabel: MODE_LABELS[mode] || mode,
    description: project.description,
    generatedAt: new Date().toISOString(),

    health,
    healthLabel: HEALTH_LABELS[health],

    counts,
    systems,

    regions,
    encounters,
    connections: connectionSummary,

    validation: validationSummary,
    advisory: advisorySummary,
    dependencies,
  };
}
