import { describe, it, expect, beforeEach } from 'vitest';
import { usePresetStore } from '../presets/preset-store.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from '../presets/built-ins.js';

beforeEach(() => {
  // Reset store between tests
  usePresetStore.setState({
    regionPresets: [...BUILTIN_REGION_PRESETS],
    encounterPresets: [...BUILTIN_ENCOUNTER_PRESETS],
  });
});

describe('preset-store region presets', () => {
  it('starts with built-in region presets', () => {
    const { regionPresets } = usePresetStore.getState();
    expect(regionPresets.length).toBe(4);
    expect(regionPresets.every((p) => p.builtIn)).toBe(true);
  });

  it('saves a custom region preset', () => {
    const { saveRegionPreset } = usePresetStore.getState();
    const saved = saveRegionPreset({
      name: 'Custom Ward',
      description: 'A test region.',
      tags: ['test'],
      regionTags: ['test-tag'],
      baseMetrics: { commerce: 50 },
      factionPresences: [],
      pressureHotspots: [],
    });
    expect(saved.builtIn).toBe(false);
    expect(saved.id).toMatch(/^region-preset-/);
    expect(usePresetStore.getState().regionPresets.length).toBe(5);
  });

  it('cannot delete a built-in region preset', () => {
    const { deleteRegionPreset } = usePresetStore.getState();
    deleteRegionPreset('crypt-district');
    expect(usePresetStore.getState().regionPresets.length).toBe(4);
  });

  it('deletes a custom region preset', () => {
    const { saveRegionPreset, deleteRegionPreset } = usePresetStore.getState();
    const saved = saveRegionPreset({
      name: 'Temp',
      description: '',
      tags: [],
      regionTags: [],
      baseMetrics: {},
      factionPresences: [],
      pressureHotspots: [],
    });
    deleteRegionPreset(saved.id);
    expect(usePresetStore.getState().regionPresets.length).toBe(4);
  });

  it('duplicates a region preset as non-built-in', () => {
    const { duplicateRegionPreset } = usePresetStore.getState();
    const copy = duplicateRegionPreset('crypt-district');
    expect(copy).toBeDefined();
    expect(copy!.builtIn).toBe(false);
    expect(copy!.name).toBe('Crypt District (copy)');
    expect(usePresetStore.getState().regionPresets.length).toBe(5);
  });

  it('updates a custom region preset', () => {
    const { saveRegionPreset, updateRegionPreset } = usePresetStore.getState();
    const saved = saveRegionPreset({
      name: 'Original',
      description: '',
      tags: [],
      regionTags: [],
      baseMetrics: {},
      factionPresences: [],
      pressureHotspots: [],
    });
    updateRegionPreset(saved.id, { name: 'Updated' });
    const found = usePresetStore.getState().regionPresets.find((p) => p.id === saved.id);
    expect(found?.name).toBe('Updated');
  });

  it('cannot update a built-in region preset', () => {
    const { updateRegionPreset } = usePresetStore.getState();
    updateRegionPreset('crypt-district', { name: 'Hacked' });
    const found = usePresetStore.getState().regionPresets.find((p) => p.id === 'crypt-district');
    expect(found?.name).toBe('Crypt District');
  });
});

describe('preset-store encounter presets', () => {
  it('starts with built-in encounter presets', () => {
    const { encounterPresets } = usePresetStore.getState();
    expect(encounterPresets.length).toBe(3);
    expect(encounterPresets.every((p) => p.builtIn)).toBe(true);
  });

  it('saves a custom encounter preset', () => {
    const { saveEncounterPreset } = usePresetStore.getState();
    const saved = saveEncounterPreset({
      name: 'Custom Fight',
      description: 'Test encounter.',
      tags: ['test'],
      encounterType: 'patrol',
      enemyIds: ['goblin-1'],
      probability: 0.5,
      cooldownTurns: 3,
      encounterTags: ['patrol'],
    });
    expect(saved.builtIn).toBe(false);
    expect(usePresetStore.getState().encounterPresets.length).toBe(4);
  });

  it('duplicates an encounter preset', () => {
    const { duplicateEncounterPreset } = usePresetStore.getState();
    const copy = duplicateEncounterPreset('boss-encounter');
    expect(copy).toBeDefined();
    expect(copy!.builtIn).toBe(false);
    expect(copy!.name).toBe('Boss Encounter (copy)');
  });

  it('deletes a custom encounter preset', () => {
    const { saveEncounterPreset, deleteEncounterPreset } = usePresetStore.getState();
    const saved = saveEncounterPreset({
      name: 'Temp',
      description: '',
      tags: [],
      encounterType: 'patrol',
      enemyIds: [],
      probability: 0.5,
      cooldownTurns: 1,
      encounterTags: [],
    });
    deleteEncounterPreset(saved.id);
    expect(usePresetStore.getState().encounterPresets.length).toBe(3);
  });
});
