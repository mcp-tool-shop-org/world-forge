import { describe, it, expect } from 'vitest';
import { validateProject, type WorldProject } from '@world-forge/schema';
import { exportToEngine, listAiRpgEncounterBlockers } from '@world-forge/export-ai-rpg';
import { exportToUnreal } from '@world-forge/export-unreal';
import { exportToGodot } from '@world-forge/export-godot';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import { createProjectFromKit } from '../panels/TemplateManager.js';
import {
  GENRE_TEMPLATES,
  MODE_STARTERS,
  createProjectFromModeStarter,
  createProjectFromWizard,
} from '../templates/registry.js';
import { useProjectStore } from '../store/project-store.js';

/** Load a project into the editor store and verify schema + all three export-lane validators pass. */
function assertSampleGate(project: WorldProject): void {
  const loaded = useProjectStore.getState().loadProject(structuredClone(project));
  expect(loaded).toBe(true);

  const stored = useProjectStore.getState().project;
  const validation = validateProject(stored);
  expect(validation.errors).toEqual([]);
  expect(validation.valid).toBe(true);

  const aiRpg = exportToEngine(stored);
  expect(aiRpg.success).toBe(true);
  const aiRpgBlockers = listAiRpgEncounterBlockers(stored);
  expect(aiRpgBlockers).toEqual([]);

  const unreal = exportToUnreal(stored);
  expect(unreal.success).toBe(true);

  const godot = exportToGodot(stored);
  expect(godot.success).toBe(true);
}

describe('sample gate: SAMPLE_WORLDS', () => {
  it.each(SAMPLE_WORLDS)('$id ($name) loads, validates, and passes all export lanes', (sample) => {
    assertSampleGate(sample.project);
  });
});

describe('sample gate: BUILTIN_KITS', () => {
  it.each(BUILTIN_KITS)('$id ($name) loads, validates, and passes all export lanes', (kit) => {
    assertSampleGate(createProjectFromKit(kit));
  });
});

describe('sample gate: GENRE_TEMPLATES', () => {
  it.each(GENRE_TEMPLATES)('$id ($name) loads, validates, and passes all export lanes', (tpl) => {
    const project = createProjectFromWizard({
      name: tpl.name,
      genre: tpl.id,
      mode: tpl.mode ?? 'district',
      includePlayer: true,
      includeBuildCatalog: true,
      includeProgressionTree: true,
      includeDialogue: true,
      includeSampleNPCs: true,
    });
    assertSampleGate(project);
  });
});

describe('sample gate: MODE_STARTERS', () => {
  it.each(MODE_STARTERS)('$id ($name) loads, validates, and passes all export lanes', (starter) => {
    assertSampleGate(createProjectFromModeStarter(starter.name, starter));
  });
});
