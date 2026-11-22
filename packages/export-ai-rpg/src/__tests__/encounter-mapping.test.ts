import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import { writeFile, rm, mkdtemp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyContentPack,
  ENCOUNTER_ANCHOR_TYPES,
  runLoadGate,
  validateEncounterAnchorRecord,
  type ContentPack as EngineContentPack,
  type GateContext,
} from '@ai-rpg-engine/content-schema';
import { createStandardChannels } from '@ai-rpg-engine/modules';
import { createGame } from '@ai-rpg-engine/starter-fantasy';
import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
// Samples loaded via vi.importActual below to avoid a rootDir cycle with editor.
import { exportToEngine, listAiRpgEncounterAdjustments, listAiRpgEncounterBlockers } from '../index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CLI_PATH = resolve(__dirname, '../../dist/cli.js');

function installedPackageVersion(pkg: string): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'node_modules', pkg, 'package.json');
    if (fs.existsSync(candidate)) {
      return (JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { version: string }).version;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`${pkg} is not installed anywhere above ${import.meta.dirname}`);
}

function projectWithAnchors(
  encounterAnchors: WorldProject['encounterAnchors'],
): WorldProject {
  const cloned = structuredClone(minimalProject);
  return {
    ...cloned,
    dialogues: cloned.dialogues.map((d) => ({ ...d, speakers: ['npc-keeper'] })),
    encounterAnchors,
  };
}

function runCli(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    execFile('node', [CLI_PATH, ...args], { timeout: 10_000 }, (error, stdout, stderr) => {
      resolvePromise({
        code: error?.code !== undefined ? (error.code as unknown as number) : error ? 1 : 0,
        stdout,
        stderr,
      });
    });
  });
}

const TRANSLATED_CASES: ReadonlyArray<{ from: string; to: (typeof ENCOUNTER_ANCHOR_TYPES)[number] }> = [
  { from: 'boss', to: 'duel' },
  { from: 'beast', to: 'ambush' },
  { from: 'haunt', to: 'ambush' },
  { from: 'caravan-raid', to: 'ambush' },
  { from: 'pirate', to: 'patrol' },
  { from: 'boarding', to: 'horde' },
  { from: 'brawl', to: 'horde' },
];

describe('encounter-type translation mapping', () => {
  it.each(TRANSLATED_CASES)(
    '$from translates to $to with worldforge-type:$from tag and approximated fidelity entry',
    ({ from, to }) => {
      const zoneId = minimalProject.zones[0].id;
      const project = projectWithAnchors([
        {
          id: 'enc-mapped',
          zoneId,
          encounterType: from,
          enemyIds: ['npc-guard'],
          probability: 0.75,
          cooldownTurns: 2,
          tags: ['scripted'],
        },
      ]);

      expect(listAiRpgEncounterBlockers(project)).toEqual([]);

      const exported = exportToEngine(project);
      expect(exported.success).toBe(true);
      if (!exported.success) throw new Error('exportToEngine failed');

      expect(exported.contentPack.encounterAnchors).toHaveLength(1);
      const [anchor] = exported.contentPack.encounterAnchors;
      expect(anchor.encounterType).toBe(to);
      expect(anchor.tags).toEqual(['scripted', `worldforge-type:${from}`]);

      const entry = exported.fidelity.entries.find(
        (e) =>
          e.level === 'approximated' &&
          e.reason === 'encounter-type-translated' &&
          e.entityId === 'enc-mapped',
      );
      expect(entry).toBeDefined();
      expect(entry?.domain).toBe('world');
      expect(entry?.fieldPath).toBe('encounterAnchors.enc-mapped.encounterType');
      expect(entry?.message).toContain(from);
      expect(entry?.message).toContain(to);
    },
  );

  it('leaves the four native engine encounter types unchanged alongside translated types', () => {
    const zoneId = minimalProject.zones[0].id;
    const project = projectWithAnchors([
      ...ENCOUNTER_ANCHOR_TYPES.map((t, i) => ({
        id: `enc-native-${i}`,
        zoneId,
        encounterType: t,
        enemyIds: [],
        probability: 0.5,
        cooldownTurns: 1,
        tags: ['native-tag'],
      })),
      {
        id: 'enc-boss',
        zoneId,
        encounterType: 'boss',
        enemyIds: [],
        probability: 1,
        cooldownTurns: 0,
        tags: [],
      },
    ]);

    expect(listAiRpgEncounterBlockers(project)).toEqual([]);

    const exported = exportToEngine(project);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('exportToEngine failed');

    expect(exported.contentPack.encounterAnchors).toHaveLength(5);
    for (let i = 0; i < ENCOUNTER_ANCHOR_TYPES.length; i++) {
      const nativeAnchor = exported.contentPack.encounterAnchors.find((a) => a.id === `enc-native-${i}`);
      expect(nativeAnchor?.encounterType).toBe(ENCOUNTER_ANCHOR_TYPES[i]);
      expect(nativeAnchor?.tags).toEqual(['native-tag']);
      expect(
        exported.fidelity.entries.filter((e) => e.entityId === `enc-native-${i}`),
      ).toEqual([]);
    }
  });
});

describe('encounter-type drops', () => {
  it.each(['hazard', 'discovery'] as const)(
    '%s is left out of the exported pack and records a dropped fidelity entry',
    (droppedType) => {
      const zoneId = minimalProject.zones[0].id;
      const project = projectWithAnchors([
        {
          id: `enc-${droppedType}`,
          zoneId,
          encounterType: droppedType,
          enemyIds: [],
          probability: 0.5,
          cooldownTurns: 2,
          tags: ['env'],
        },
      ]);

      expect(listAiRpgEncounterBlockers(project)).toEqual([]);

      const exported = exportToEngine(project);
      expect(exported.success).toBe(true);
      if (!exported.success) throw new Error('exportToEngine failed');

      expect(exported.contentPack.encounterAnchors).toEqual([]);
      const entry = exported.fidelity.entries.find(
        (e) =>
          e.level === 'dropped' &&
          e.reason === 'encounter-type-dropped' &&
          e.entityId === `enc-${droppedType}`,
      );
      expect(entry).toBeDefined();
      expect(entry?.domain).toBe('world');
      expect(entry?.fieldPath).toBe(`encounterAnchors.enc-${droppedType}.encounterType`);
      expect(entry?.message).toContain(droppedType);
    },
  );
});

describe('unmapped custom encounter types', () => {
  it('refuses unmapped custom encounter types by name while allowing translated and dropped types', () => {
    const zoneId = minimalProject.zones[0].id;
    const project = projectWithAnchors([
      { id: 'enc-boss', zoneId, encounterType: 'boss', enemyIds: [], probability: 1, cooldownTurns: 0, tags: [] },
      { id: 'enc-hazard', zoneId, encounterType: 'hazard', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
      { id: 'enc-custom', zoneId, encounterType: 'custom-skirmish', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
    ]);

    const blockers = listAiRpgEncounterBlockers(project);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].anchorId).toBe('enc-custom');
    expect(blockers[0].encounterType).toBe('custom-skirmish');
    expect(blockers[0].message).toContain('enc-custom');
    expect(blockers[0].message).toContain('custom-skirmish');
  });
});

describe('built-in samples against @ai-rpg-engine/content-schema', () => {
  it('every built-in sample exports an AI RPG pack passing content-schema validateEncounterAnchorRecord, runLoadGate, and applyContentPack', async () => {
    const engineVersion = installedPackageVersion('@ai-rpg-engine/content-schema');
    const host = createGame(71);
    const registeredModuleIds = host.moduleManager.getModules().map((m) => m.id);
    const samplesPath = resolve(__dirname, '../../../editor/src/templates/samples.ts');
    const { SAMPLE_WORLDS } = await vi.importActual<{ SAMPLE_WORLDS: Array<{ id: string; project: WorldProject }> }>(samplesPath);

    for (const sample of SAMPLE_WORLDS) {
      const blockers = listAiRpgEncounterBlockers(sample.project);
      expect(blockers, `${sample.id} blockers`).toEqual([]);

      const exported = exportToEngine(sample.project);
      expect(exported.success, `${sample.id} exportToEngine`).toBe(true);
      if (!exported.success) continue;

      const pack = exported.contentPack as unknown as EngineContentPack;
      for (let i = 0; i < (pack.encounterAnchors?.length ?? 0); i++) {
        const anchorCheck = validateEncounterAnchorRecord(pack.encounterAnchors![i], `encounterAnchors[${i}]`);
        expect(anchorCheck.ok, `${sample.id} anchor[${i}]: ${JSON.stringify(anchorCheck.errors)}`).toBe(true);
      }

      const gateCtx: GateContext = {
        engineVersion,
        registeredModuleIds,
        manifest: exported.manifest,
      };
      const gate = runLoadGate(pack, gateCtx);
      expect(gate.ok, `${sample.id} runLoadGate:\n${gate.report}`).toBe(true);

      const intakeHost = createGame(71);
      const intake = applyContentPack(intakeHost, pack, { channels: createStandardChannels() });
      expect(intake.ok, `${sample.id} applyContentPack: ${JSON.stringify(intake.errors)}`).toBe(true);
    }
  });
});

describe('CLI --validate-only with mapped and dropped encounter types', () => {
  let tmpDir: string;
  let mappedPath: string;
  let customPath: string;

  beforeAll(async () => {
    await access(CLI_PATH);
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-enc-map-cli-'));
    const zoneId = minimalProject.zones[0].id;
    mappedPath = join(tmpDir, 'mapped.json');
    customPath = join(tmpDir, 'custom.json');

    await writeFile(
      mappedPath,
      JSON.stringify(
        projectWithAnchors([
          { id: 'enc-boss', zoneId, encounterType: 'boss', enemyIds: [], probability: 1, cooldownTurns: 0, tags: [] },
          { id: 'enc-hazard', zoneId, encounterType: 'hazard', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
        ]),
        null,
        2,
      ),
    );
    await writeFile(
      customPath,
      JSON.stringify(
        projectWithAnchors([
          { id: 'enc-boss', zoneId, encounterType: 'boss', enemyIds: [], probability: 1, cooldownTurns: 0, tags: [] },
          { id: 'enc-custom', zoneId, encounterType: 'custom-skirmish', enemyIds: [], probability: 0.5, cooldownTurns: 2, tags: [] },
        ]),
        null,
        2,
      ),
    );
  });

  afterAll(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it('--validate-only passes when all anchors map or drop and names approximations/drops on stderr', async () => {
    const res = await runCli([mappedPath, '--validate-only']);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain('Validation passed');
    expect(res.stderr).toContain('enc-boss');
    expect(res.stderr).toContain('boss');
    expect(res.stderr).toContain('duel');
    expect(res.stderr).toContain('enc-hazard');
    expect(res.stderr).toContain('hazard');
  });

  it('--validate-only still exits 1 when an unmapped custom encounter type is present alongside mapped types', async () => {
    const res = await runCli([customPath, '--validate-only']);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('enc-custom');
    expect(res.stderr).toContain('custom-skirmish');
    expect(res.stderr).not.toContain('enc-boss');
  });
});

const PROTOTYPE_KEY_TYPES = ['constructor', 'toString', 'hasOwnProperty', '__proto__'] as const;

describe('prototype-key encounter types are refused', () => {
  let tmpDir: string;
  const fileByType = new Map<string, string>();

  beforeAll(async () => {
    await access(CLI_PATH);
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-enc-proto-cli-'));
    const zoneId = minimalProject.zones[0].id;
    for (let i = 0; i < PROTOTYPE_KEY_TYPES.length; i++) {
      const badType = PROTOTYPE_KEY_TYPES[i];
      const filePath = join(tmpDir, `proto-${i}.json`);
      await writeFile(
        filePath,
        JSON.stringify(
          projectWithAnchors([
            { id: 'enc-proto', zoneId, encounterType: badType, enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
          ]),
          null,
          2,
        ),
      );
      fileByType.set(badType, filePath);
    }
  });

  afterAll(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  it.each(PROTOTYPE_KEY_TYPES)('exporter refuses %s by name', (badType) => {
    const zoneId = minimalProject.zones[0].id;
    const project = projectWithAnchors([
      { id: 'enc-proto', zoneId, encounterType: badType, enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
    ]);

    const blockers = listAiRpgEncounterBlockers(project);
    expect(blockers.map((b) => b.encounterType)).toEqual([badType]);
    expect(blockers[0].anchorId).toBe('enc-proto');
    expect(listAiRpgEncounterAdjustments(project)).toEqual([]);

    expect(blockers[0].message).toContain('enc-proto');
    expect(blockers[0].message).toContain(badType);
    const exported = exportToEngine(project);
    expect(exported.success && typeof exported.contentPack.encounterAnchors[0].encounterType).toBe('string');
  });

  it.each(PROTOTYPE_KEY_TYPES)('CLI --validate-only exits 1 for %s and names it on stderr', async (badType) => {
    const filePath = fileByType.get(badType)!;
    const res = await runCli([filePath, '--validate-only']);
    expect(res.code).toBe(1);
    expect(res.stderr).toContain('enc-proto');
    expect(res.stderr).toContain(badType);
  });
});
