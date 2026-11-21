// engine-contract.test.ts — contract test proving world-forge exports pass the
// pinned engine's load gate and applyContentPack intake without silent loss.

import { describe, it, expect, vi } from 'vitest';
import * as path from 'node:path';
import { createEmptyProject, validateProject, type WorldProject } from '@world-forge/schema';
import { exportToEngine } from '../export.js';
import { vocabularyCoverageProject } from './fixtures/vocabulary-coverage.js';
import { runContractGateAndIntake } from './helpers/contract-host.js';

function createSmallestValidWorldProject(): WorldProject {
  const base = createEmptyProject();
  return {
    ...base,
    zones: [
      {
        id: 'zone-empty',
        name: 'Empty Zone',
        tags: [],
        description: '',
        gridX: 0,
        gridY: 0,
        gridWidth: 4,
        gridHeight: 4,
        neighbors: [],
        exits: [],
        light: 5,
        noise: 0,
        hazards: [],
        interactables: [],
      },
    ],
    spawnPoints: [
      {
        id: 'sp-empty',
        zoneId: 'zone-empty',
        gridX: 1,
        gridY: 1,
        isDefault: true,
      },
    ],
  };
}

async function loadDogfoodProject(relFromRepoRoot: string, exportName: string): Promise<WorldProject> {
  const abs = path.resolve(import.meta.dirname, '../../../..', relFromRepoRoot);
  const mod = await vi.importActual<Record<string, unknown>>(abs);
  return mod[exportName] as WorldProject;
}

const METADATA_KEYS = new Set(['schemaVersion', '_debug']);

function runContractPipeline(project: WorldProject) {
  const validation = validateProject(project);
  expect(validation.valid, JSON.stringify(validation.errors)).toBe(true);

  const exported = exportToEngine(project);
  expect(exported.success).toBe(true);
  if (!exported.success) throw new Error('exportToEngine failed');

  const { gate, intake } = runContractGateAndIntake(exported);

  const writtenNonEmptyKeys = Object.entries(exported.contentPack as Record<string, unknown>)
    .filter(([k, v]) => !METADATA_KEYS.has(k) && v !== undefined && !(Array.isArray(v) && v.length === 0))
    .map(([k]) => k);

  const droppedTopKeys = new Set(
    intake.dropped
      .map((d) => /^pack\.([^.([\]]+)$/.exec(d.path)?.[1])
      .filter((k): k is string => k !== undefined),
  );

  const silentlyLost = writtenNonEmptyKeys.filter(
    (k) => (intake.applied[k] ?? 0) <= 0 && !droppedTopKeys.has(k),
  );

  return { exported, gate, intake, writtenNonEmptyKeys, droppedTopKeys, silentlyLost };
}

describe('engine contract — world-forge exports pass engine load gate and intake', () => {
  describe('(a) empty project (smallest valid WorldProject)', () => {
    const getRun = () => runContractPipeline(createSmallestValidWorldProject());

    it('passes the engine load gate', () => {
      const { gate } = getRun();
      expect(gate.ok, gate.report).toBe(true);
    });

    it('intake returns ok:true', () => {
      const { intake } = getRun();
      expect(intake.ok, JSON.stringify(intake.errors, null, 2)).toBe(true);
    });

    it('every non-empty key world-forge wrote either arrived or is named in dropped[]', () => {
      const { silentlyLost } = getRun();
      expect(silentlyLost, `silently uncarried keys: ${silentlyLost.join(', ')}`).toEqual([]);
    });
  });

  describe('(b) vocabulary-coverage fixture', () => {
    const getRun = () => runContractPipeline(vocabularyCoverageProject);

    it('passes the engine load gate', () => {
      const { gate } = getRun();
      expect(gate.ok, gate.report).toBe(true);
    });

    it('intake returns ok:true', () => {
      const { intake } = getRun();
      expect(intake.ok, JSON.stringify(intake.errors, null, 2)).toBe(true);
    });

    it('every non-empty key world-forge wrote either arrived or is named in dropped[]', () => {
      const { silentlyLost } = getRun();
      expect(silentlyLost, `silently uncarried keys: ${silentlyLost.join(', ')}`).toEqual([]);
    });
  });

  describe('(c1) dogfood world: multi-target-proof.ts', () => {
    const getRun = async () =>
      runContractPipeline(await loadDogfoodProject('dogfood/worlds/multi-target-proof.ts', 'proofProject'));

    it('passes the engine load gate', async () => {
      const { gate } = await getRun();
      expect(gate.ok, gate.report).toBe(true);
    });

    it('intake returns ok:true', async () => {
      const { intake } = await getRun();
      expect(intake.ok, JSON.stringify(intake.errors, null, 2)).toBe(true);
    });

    it('every non-empty key world-forge wrote either arrived or is named in dropped[]', async () => {
      const { silentlyLost } = await getRun();
      expect(silentlyLost, `silently uncarried keys: ${silentlyLost.join(', ')}`).toEqual([]);
    });
  });

  describe('(c2) dogfood world: salt-road.ts', () => {
    const getRun = async () => {
      const saltRoadProject = await loadDogfoodProject('dogfood/worlds/salt-road.ts', 'saltRoadProject');
      const scaleMod = await vi.importActual<{ scaleForSandbox: (p: WorldProject) => WorldProject }>(
        path.resolve(import.meta.dirname, '../../../../dogfood/worlds/sandbox-scale.ts'),
      );
      return runContractPipeline(scaleMod.scaleForSandbox(saltRoadProject));
    };

    it('passes the engine load gate', async () => {
      const { gate } = await getRun();
      expect(gate.ok, gate.report).toBe(true);
    });

    it('intake returns ok:true', async () => {
      const { intake } = await getRun();
      expect(intake.ok, JSON.stringify(intake.errors, null, 2)).toBe(true);
    });

    it('every non-empty key world-forge wrote either arrived or is named in dropped[]', async () => {
      const { silentlyLost } = await getRun();
      expect(silentlyLost, `silently uncarried keys: ${silentlyLost.join(', ')}`).toEqual([]);
    });
  });
});
