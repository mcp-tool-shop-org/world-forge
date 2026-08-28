// leftover-480.test.ts — v4.8.0 leftover pass, editor cheap cluster.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { saveProjectFile, clearSavedFileHandle, getSavedFileHandle, setSavedFileHandle } from '../save-project.js';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import type { WorldProject } from '@world-forge/schema';
import { TOOL_PALETTE_TOOLS } from '../panels/ToolPalette.js';
import {
  applyPresetFromSelection,
  savePresetFromSelection,
  resetPresetMemory,
  buildRegionPresetFromDistrict,
} from '../preset-actions.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = (rel: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), rel), 'utf8');

describe('F-8680d2f9: Save reuses the File System Access handle', () => {
  beforeEach(() => {
    clearSavedFileHandle();
  });
  afterEach(() => {
    clearSavedFileHandle();
  });

  it('second save writes the cached handle and does not open the picker', async () => {
    const markClean = vi.fn();
    const toast = vi.fn();
    const write = vi.fn(async () => {});
    const close = vi.fn(async () => {});
    const picker = vi.fn(async () => ({
      name: 'world-1.json',
      createWritable: async () => ({ write, close }),
    }));
    const project = createEmptyProject();
    project.id = 'world-1';

    await saveProjectFile(project, { markClean, toast, showSaveFilePicker: picker });
    expect(picker).toHaveBeenCalledTimes(1);
    expect(getSavedFileHandle()?.name).toBe('world-1.json');

    await saveProjectFile(project, { markClean, toast, showSaveFilePicker: picker });
    expect(picker).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(2);
    expect(markClean).toHaveBeenCalledTimes(2);
  });

  it('saveAs: true always opens a new picker', async () => {
    const handle = {
      name: 'old.json',
      createWritable: vi.fn(async () => ({ write: vi.fn(), close: vi.fn() })),
    };
    setSavedFileHandle(handle);
    const picker = vi.fn(async () => ({
      name: 'new.json',
      createWritable: async () => ({ write: vi.fn(), close: vi.fn() }),
    }));
    await saveProjectFile(createEmptyProject(), {
      markClean: vi.fn(),
      toast: vi.fn(),
      showSaveFilePicker: picker,
      saveAs: true,
    });
    expect(picker).toHaveBeenCalledTimes(1);
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  it('loadProject / newProject drop the cached handle', () => {
    setSavedFileHandle({
      name: 'stale.json',
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
    });
    useProjectStore.getState().loadProject(createEmptyProject());
    expect(getSavedFileHandle()).toBeNull();
    setSavedFileHandle({
      name: 'stale.json',
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
    });
    useProjectStore.getState().newProject();
    expect(getSavedFileHandle()).toBeNull();
  });
});

describe('F-1db1d1d7: encounter-place is on the tool palette', () => {
  it('lists encounter-place and item-place next to the other tools', () => {
    const ids = TOOL_PALETTE_TOOLS.map((t) => t.id);
    expect(ids).toContain('encounter-place');
    expect(ids).toContain('item-place');
    expect(TOOL_PALETTE_TOOLS.find((t) => t.id === 'encounter-place')?.key).toBe('N');
  });
});

describe('F-b97d277c: Review Project Info is editable', () => {
  it('ReviewPanel mounts identity inputs for name/mode/genre/version', () => {
    const srcText = src('../panels/ReviewPanel.tsx');
    expect(srcText).toContain('wf-project-name');
    expect(srcText).toContain('wf-project-mode');
    expect(srcText).toContain('wf-project-genre');
    expect(srcText).toContain('wf-project-version');
    expect(srcText).toContain('ProjectIdentityFields');
    expect(srcText).not.toMatch(/<Row label="Name"/);
  });
});

describe('F-fabda31a: apply/save preset from selection', () => {
  beforeEach(() => {
    resetPresetMemory();
  });

  it('applies a region preset to the district that owns the selected zone', () => {
    const applyRegionPreset = vi.fn();
    const createEncounterFromPreset = vi.fn();
    const project = {
      ...createEmptyProject(),
      mode: 'dungeon' as const,
      districts: [{
        id: 'd1', name: 'Nave', description: '', tags: [], zoneIds: ['z1'],
        controllingFaction: undefined,
        baseMetrics: { commerce: 0, morale: 0, safety: 0, stability: 0 },
        economyProfile: { supplyCategories: [], scarcityDefaults: {} },
      }],
      zones: [{
        id: 'z1', name: 'z1', description: '', tags: [],
        gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
        neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
      }],
    };
    const preset = {
      id: 'rp-1', name: 'Market Ward', description: '', tags: [], builtIn: true,
      regionTags: [], baseMetrics: {}, factionPresences: [], pressureHotspots: [],
    };
    const result = applyPresetFromSelection(
      project as unknown as WorldProject,
      { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] },
      {
        regionPresets: [preset],
        encounterPresets: [],
        applyRegionPreset,
        createEncounterFromPreset,
      },
    );
    expect(result.ok).toBe(true);
    expect(applyRegionPreset).toHaveBeenCalledWith('d1', preset, 'merge');
    expect(createEncounterFromPreset).not.toHaveBeenCalled();
  });

  it('toasts when nothing is selected', () => {
    const result = applyPresetFromSelection(
      createEmptyProject(),
      { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] },
      {
        regionPresets: [],
        encounterPresets: [],
        applyRegionPreset: vi.fn(),
        createEncounterFromPreset: vi.fn(),
      },
    );
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Select a district zone/);
  });

  it('buildRegionPresetFromDistrict copies district name into the preset', () => {
    const project = createEmptyProject();
    const district = {
      id: 'd1', name: 'Chapel', description: '', tags: ['holy'],
      zoneIds: [], controllingFaction: 'church',
      baseMetrics: { commerce: 0, morale: 0, safety: 8, stability: 0 },
      economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    };
    const built = buildRegionPresetFromDistrict(
      { ...project, districts: [district] } as unknown as WorldProject,
      district,
    );
    expect(built.name).toBe('Chapel Preset');
    expect(built.regionTags).toEqual(['holy']);
  });

  it('savePresetFromSelection refuses an empty selection', () => {
    const result = savePresetFromSelection(
      createEmptyProject(),
      { zones: [], entities: [], landmarks: [], spawns: [], encounters: [] },
      { saveRegionPreset: vi.fn(), saveEncounterPreset: vi.fn() },
    );
    expect(result.ok).toBe(false);
  });
});

describe('F-bde2ece7: Canvas wires onSave', () => {
  it('App passes handleSave into Canvas', () => {
    expect(src('../App.tsx')).toContain('<Canvas onSave={handleSave} />');
  });
});

describe('F-1fdefe62: GitHub Release attests packed tarballs', () => {
  it('release.yml pins attest-build-provenance and writes attestations', () => {
    const yml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../../../.github/workflows/release.yml'), 'utf8');
    expect(yml).toContain('actions/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8');
    expect(yml).toContain('attestations: write');
    expect(yml).toContain('subject-path: dist-tarballs/*.tgz');
  });
});
