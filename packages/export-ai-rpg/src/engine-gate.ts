// engine-gate.ts — Node-only AI RPG Engine load-gate and intake runner.
//
// Imported ONLY by `cli.ts` and Node tests; never re-exported from browser-safe
// `index.ts` or imported by editor bundles. Builds the validation host strictly
// from runtime `@ai-rpg-engine/*` dependencies (`core`, `modules`, `equipment`,
// `content-schema`).

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  applyContentPack,
  formatGateReport,
  runLoadGate,
  type ApplyContentPackResult,
  type ContentPack as EngineContentPack,
  type GateContext,
  type GateResult,
} from '@ai-rpg-engine/content-schema';
import { Engine } from '@ai-rpg-engine/core';
import { createEquipmentCore } from '@ai-rpg-engine/equipment';
import {
  applyStatus,
  buildCombatStack,
  buildWorldStack,
  createAbilityCore,
  createAbilityEffects,
  createAbilityReview,
  createDialogueCore,
  createInventoryCore,
  createPerceptionFilter,
  createProgressionCore,
  createSimulationInspector,
  createStandardChannels,
  registerStatusDefinitions,
  removeStatus,
  statusCore,
  traversalCore,
  unregisterEncounterSpawnContent,
  unregisterTypedHazards,
} from '@ai-rpg-engine/modules';
import type { WorldProject } from '@world-forge/schema';
import type { ExportResult } from './export.js';
import { listAiRpgEncounterBlockers, type AiRpgEncounterBlocker } from './encounter-types.js';
import { ENGINE_VERSION_RANGE } from './convert-pack.js';

export type EngineRefusalCode =
  | 'ENGINE_LOAD_GATE_REFUSED'
  | 'ENGINE_INTAKE_REFUSED'
  | 'ENGINE_ENCOUNTER_TYPE_BLOCKED';

export type EngineGateCheckCode =
  | 'ENGINE_GATE_ENGINE_VERSION'
  | 'ENGINE_GATE_MODULE_IDS'
  | 'ENGINE_GATE_CONTENT_HASH'
  | 'ENGINE_GATE_KEY_ALLOWLIST';

const GATE_CHECK_TO_CODE: Record<string, EngineGateCheckCode> = {
  'engine-version': 'ENGINE_GATE_ENGINE_VERSION',
  'module-ids': 'ENGINE_GATE_MODULE_IDS',
  'content-hash': 'ENGINE_GATE_CONTENT_HASH',
  'key-allowlist': 'ENGINE_GATE_KEY_ALLOWLIST',
};

const WORLD_PROJECT_KNOWN_KEYS = [
  'id',
  'name',
  'description',
  'version',
  'genre',
  'tones',
  'difficulty',
  'narratorTone',
  'schemaVersion',
  'mode',
  'author',
  'license',
  'category',
  'projectTags',
  'map',
  'zones',
  'connections',
  'districts',
  'landmarks',
  'factionPresences',
  'pressureHotspots',
  'dialogues',
  'playerTemplate',
  'buildCatalog',
  'progressionTrees',
  'entityPlacements',
  'itemPlacements',
  'encounterAnchors',
  'spawnPoints',
  'craftingStations',
  'marketNodes',
  'buildings',
  'hubs',
  'strongholds',
  'strata',
  'stratumLinks',
  'hazardDefinitions',
  'tilesets',
  'tileLayers',
  'props',
  'propPlacements',
  'ambientLayers',
  'assets',
  'assetPacks',
  'lootTables',
  'transitions',
  'presentation',
] as const satisfies readonly (keyof WorldProject)[];

type KnownProjectKey = (typeof WORLD_PROJECT_KNOWN_KEYS)[number];
type _AssertAllProjectKeysListed =
  Exclude<keyof WorldProject, KnownProjectKey> extends never
    ? Exclude<KnownProjectKey, keyof WorldProject> extends never
      ? true
      : KnownProjectKey
    : keyof WorldProject;
const _assertAllProjectKeysListed: _AssertAllProjectKeysListed = true;
void _assertAllProjectKeysListed;

const WORLD_PROJECT_KNOWN_KEY_SET = new Set<string>(WORLD_PROJECT_KNOWN_KEYS);

let validationSeq = 0;

/** Read the installed version of an engine package by walking ancestor `node_modules`. */
export function resolveInstalledEngineVersion(pkg = '@ai-rpg-engine/content-schema'): string {
  const roots = [import.meta.dirname, process.cwd()];
  for (const startDir of roots) {
    let dir = startDir;
    for (let i = 0; i < 10; i++) {
      const candidate = join(dir, 'node_modules', pkg, 'package.json');
      if (existsSync(candidate)) {
        return (JSON.parse(readFileSync(candidate, 'utf-8')) as { version: string }).version;
      }
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error(`${pkg} is not installed anywhere above ${import.meta.dirname} or ${process.cwd()}`);
}

/** Collect any unknown/extra top-level keys carried on a project JSON input. */
export function collectUnknownTopLevelKeys(project: WorldProject): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(project as unknown as Record<string, unknown>)) {
    if (!WORLD_PROJECT_KNOWN_KEY_SET.has(key)) {
      extra[key] = value;
    }
  }
  return extra;
}

/**
 * Construct an isolated `Engine` host using only runtime `@ai-rpg-engine/*` dependencies.
 * Registers all modules needed for gate checks (`registeredModuleIds`) and intake dry-runs.
 */
export function createRuntimeValidationHost(
  manifest: ExportResult['manifest'],
  uniqueGameId: string,
  seed = 71,
): Engine {
  const combat = buildCombatStack({
    statMapping: { attack: 'vigor', precision: 'instinct', resolve: 'will' },
    playerId: 'player',
  });
  const worldStack = buildWorldStack({
    playerId: 'player',
    factions: [],
    districts: [],
    encounterSpawn: { gameId: uniqueGameId, encounters: [], zoneTables: {}, entityTemplates: [] },
    quests: { gameId: uniqueGameId, quests: [] },
  });
  return new Engine({
    manifest: {
      id: uniqueGameId,
      title: manifest.title,
      version: manifest.version,
      engineVersion: ENGINE_VERSION_RANGE,
      ruleset: manifest.ruleset || 'validate',
      modules: [...manifest.modules],
      contentPacks: [...manifest.contentPacks],
    },
    seed,
    modules: [
      traversalCore,
      statusCore,
      ...combat.modules,
      createInventoryCore([]),
      createDialogueCore([]),
      createPerceptionFilter(),
      createProgressionCore({ trees: [], rewards: [] }),
      ...worldStack.modules,
      createEquipmentCore({
        catalog: { items: [] },
        statuses: {
          registerDefinitions: registerStatusDefinitions,
          apply: applyStatus,
          remove: removeStatus,
        },
      }),
      createAbilityCore({ abilities: [], statMapping: { power: 'vigor', precision: 'instinct', focus: 'will' } }),
      createAbilityEffects(),
      createAbilityReview(),
      createSimulationInspector(),
    ],
  });
}

export interface EngineValidationResult {
  ok: boolean;
  refusalCode: EngineRefusalCode | null;
  failedGateCheckCodes: EngineGateCheckCode[];
  engineVersion: string;
  gate: GateResult;
  gateFormattedReport: string;
  intake: ApplyContentPackResult;
  encounterBlockers: AiRpgEncounterBlocker[];
  unknownTopLevelKeys: string[];
}

/**
 * Run the real engine load gate and `applyContentPack` dry run against an exported
 * `WorldProject` + `ExportResult` using only runtime `@ai-rpg-engine/*` dependencies.
 */
export function validateExportWithEngine(
  project: WorldProject,
  exportResult: ExportResult,
): EngineValidationResult {
  const engineVersion = resolveInstalledEngineVersion('@ai-rpg-engine/content-schema');
  const unknownExtra = collectUnknownTopLevelKeys(project);
  const unknownTopLevelKeys = Object.keys(unknownExtra).sort();

  const gatedPack = (
    unknownTopLevelKeys.length > 0
      ? { ...exportResult.contentPack, ...unknownExtra }
      : exportResult.contentPack
  ) as unknown as EngineContentPack;

  const gateGameId = `${exportResult.manifest.id}__wf_gate_${++validationSeq}`;
  const intakeGameId = `${exportResult.manifest.id}__wf_intake_${++validationSeq}`;

  let gate: GateResult;
  let intake: ApplyContentPackResult;

  try {
    const gateHost = createRuntimeValidationHost(exportResult.manifest, gateGameId, 71);
    const gateCtx: GateContext = {
      engineVersion,
      registeredModuleIds: gateHost.moduleManager.getModules().map((m) => m.id),
      manifest: exportResult.manifest,
    };
    gate = runLoadGate(gatedPack, gateCtx);

    const intakeHost = createRuntimeValidationHost(exportResult.manifest, intakeGameId, 71);
    intake = applyContentPack(intakeHost, gatedPack, {
      channels: createStandardChannels(),
    });
  } finally {
    unregisterEncounterSpawnContent(gateGameId);
    unregisterTypedHazards(gateGameId);
    unregisterEncounterSpawnContent(intakeGameId);
    unregisterTypedHazards(intakeGameId);
  }

  const encounterBlockers = listAiRpgEncounterBlockers(project);
  const failedGateCheckCodes = gate.checks
    .filter((c) => !c.ok)
    .map((c) => GATE_CHECK_TO_CODE[c.check] ?? 'ENGINE_GATE_KEY_ALLOWLIST');

  const ok = gate.ok && intake.ok && encounterBlockers.length === 0;

  let refusalCode: EngineRefusalCode | null = null;
  if (!gate.ok) {
    refusalCode = 'ENGINE_LOAD_GATE_REFUSED';
  } else if (!intake.ok) {
    refusalCode = 'ENGINE_INTAKE_REFUSED';
  } else if (encounterBlockers.length > 0) {
    refusalCode = 'ENGINE_ENCOUNTER_TYPE_BLOCKED';
  }

  return {
    ok,
    refusalCode,
    failedGateCheckCodes,
    engineVersion,
    gate,
    gateFormattedReport: formatGateReport(gate.checks),
    intake,
    encounterBlockers,
    unknownTopLevelKeys,
  };
}
