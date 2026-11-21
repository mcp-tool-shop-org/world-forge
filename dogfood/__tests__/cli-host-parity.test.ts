// cli-host-parity.test.ts — compares the CLI runtime validation host against
// @ai-rpg-engine/starter-fantasy createGame(71) across every corpus world.

import { describe, it, expect } from 'vitest';
import {
  applyContentPack,
  runLoadGate,
  type ContentPack as EngineContentPack,
} from '@ai-rpg-engine/content-schema';
import { createStandardChannels } from '@ai-rpg-engine/modules';
import { createGame } from '@ai-rpg-engine/starter-fantasy';
import { exportToEngine } from '../../packages/export-ai-rpg/src/index.js';
import { validateExportWithEngine } from '../../packages/export-ai-rpg/src/engine-gate.js';
import { loadGoldenCorpusWorlds } from '../verify-golden-corpus.js';

const worlds = loadGoldenCorpusWorlds();

describe('CLI runtime validation host vs starter-fantasy createGame(71) parity', () => {
  it.each(worlds)(
    '$name produces identical gate checks, intake result, and dropped[] entries',
    (world) => {
      const exported = exportToEngine(world.project);
      expect(exported.success, `${world.name} failed exportToEngine`).toBe(true);
      if (!exported.success) throw new Error(`${world.name} export failed`);

      const cliRes = validateExportWithEngine(world.project, exported);
      const pack = exported.contentPack as unknown as EngineContentPack;

      const sfGateHost = createGame(71);
      const sfGate = runLoadGate(pack, {
        engineVersion: cliRes.engineVersion,
        registeredModuleIds: sfGateHost.moduleManager.getModules().map((m) => m.id),
        manifest: exported.manifest,
      });

      const sfIntake = applyContentPack(createGame(71), pack, {
        channels: createStandardChannels(),
      });

      expect(cliRes.gate.ok).toBe(sfGate.ok);
      expect(cliRes.gate.checks).toEqual(sfGate.checks);
      expect(cliRes.intake.ok).toBe(sfIntake.ok);
      expect(cliRes.intake.applied).toEqual(sfIntake.applied);
      expect(cliRes.intake.errors).toEqual(sfIntake.errors);
      expect(cliRes.intake.advisories).toEqual(sfIntake.advisories);
      expect(cliRes.intake.dropped).toEqual(sfIntake.dropped);
    },
  );
});
