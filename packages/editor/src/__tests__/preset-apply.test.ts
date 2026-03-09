import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from '../presets/built-ins.js';
import type { District } from '@world-forge/schema';

function makeDistrict(overrides: Partial<District> = {}): District {
  return {
    id: 'test-district',
    name: 'Test District',
    zoneIds: ['zone-1', 'zone-2'],
    tags: [],
    baseMetrics: { commerce: 0, morale: 0, safety: 0, stability: 0 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
    ...overrides,
  };
}

function seedProject() {
  const p = createEmptyProject();
  p.zones = [
    { id: 'zone-1', name: 'Zone A', gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4, description: '', light: 5, noise: 5, hazards: [], neighbors: [], exits: [], interactables: [], tags: [], parentDistrictId: 'test-district' },
    { id: 'zone-2', name: 'Zone B', gridX: 5, gridY: 0, gridWidth: 4, gridHeight: 4, description: '', light: 5, noise: 5, hazards: [], neighbors: [], exits: [], interactables: [], tags: [], parentDistrictId: 'test-district' },
  ];
  p.districts = [makeDistrict()];
  return p;
}

beforeEach(() => {
  useProjectStore.getState().loadProject(seedProject());
});

describe('applyRegionPreset — overwrite', () => {
  it('applies tags, faction, metrics, economy', () => {
    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'crypt-district')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'overwrite');

    const { project } = useProjectStore.getState();
    const district = project.districts.find((d) => d.id === 'test-district')!;

    expect(district.tags).toEqual(['dark', 'cramped', 'undead']);
    expect(district.controllingFaction).toBe('undead-horde');
    expect(district.baseMetrics.commerce).toBe(5);
    expect(district.baseMetrics.safety).toBe(10);
    expect(district.economyProfile.supplyCategories).toEqual(['bones', 'cursed-relics']);
  });

  it('creates faction presence for the district', () => {
    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'crypt-district')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'overwrite');

    const { project } = useProjectStore.getState();
    const faction = project.factionPresences.find((f) => f.factionId === 'undead-horde');
    expect(faction).toBeDefined();
    expect(faction!.districtIds).toContain('test-district');
    expect(faction!.influence).toBe(85);
  });

  it('creates pressure hotspot in first zone', () => {
    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'crypt-district')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'overwrite');

    const { project } = useProjectStore.getState();
    const hotspot = project.pressureHotspots.find((h) => h.pressureType === 'undead-surge');
    expect(hotspot).toBeDefined();
    expect(hotspot!.zoneId).toBe('zone-1');
    expect(hotspot!.baseProbability).toBe(0.7);
  });
});

describe('applyRegionPreset — merge', () => {
  it('preserves existing tags and appends new ones', () => {
    // Set some existing tags
    useProjectStore.getState().updateDistrict('test-district', { tags: ['existing'] });

    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'market-ward')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'merge');

    const district = useProjectStore.getState().project.districts.find((d) => d.id === 'test-district')!;
    expect(district.tags).toContain('existing');
    expect(district.tags).toContain('bustling');
  });

  it('preserves existing non-zero metrics', () => {
    useProjectStore.getState().updateDistrict('test-district', {
      baseMetrics: { commerce: 42, morale: 0, safety: 0, stability: 0 },
    });

    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'market-ward')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'merge');

    const district = useProjectStore.getState().project.districts.find((d) => d.id === 'test-district')!;
    expect(district.baseMetrics.commerce).toBe(42); // Preserved — was non-zero
    expect(district.baseMetrics.morale).toBe(65); // Filled — was zero
  });

  it('preserves existing controlling faction', () => {
    useProjectStore.getState().updateDistrict('test-district', { controllingFaction: 'existing-faction' });

    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'chapel-grounds')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'merge');

    const district = useProjectStore.getState().project.districts.find((d) => d.id === 'test-district')!;
    expect(district.controllingFaction).toBe('existing-faction');
  });

  it('does not duplicate faction presence on re-apply', () => {
    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'smuggler-dock')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'overwrite');
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'merge');

    const { project } = useProjectStore.getState();
    const factions = project.factionPresences.filter((f) => f.factionId === 'smuggler-ring');
    expect(factions.length).toBe(1);
  });
});

describe('applyRegionPreset — undo/redo', () => {
  it('undo restores pre-preset state', () => {
    const before = JSON.stringify(useProjectStore.getState().project);

    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'crypt-district')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'overwrite');

    useProjectStore.getState().undo();
    expect(JSON.stringify(useProjectStore.getState().project)).toBe(before);
  });

  it('redo re-applies preset result', () => {
    const preset = BUILTIN_REGION_PRESETS.find((p) => p.id === 'crypt-district')!;
    useProjectStore.getState().applyRegionPreset('test-district', preset, 'overwrite');

    const afterApply = JSON.stringify(useProjectStore.getState().project);
    useProjectStore.getState().undo();
    useProjectStore.getState().redo();
    expect(JSON.stringify(useProjectStore.getState().project)).toBe(afterApply);
  });
});

describe('createEncounterFromPreset', () => {
  it('creates encounter with preset defaults', () => {
    const preset = BUILTIN_ENCOUNTER_PRESETS.find((p) => p.id === 'boss-encounter')!;
    const id = useProjectStore.getState().createEncounterFromPreset('zone-1', preset);

    const { project } = useProjectStore.getState();
    const enc = project.encounterAnchors.find((e) => e.id === id);
    expect(enc).toBeDefined();
    expect(enc!.zoneId).toBe('zone-1');
    expect(enc!.encounterType).toBe('boss');
    expect(enc!.probability).toBe(1.0);
    expect(enc!.cooldownTurns).toBe(0);
    expect(enc!.tags).toEqual(['boss', 'scripted']);
  });

  it('creates hazard encounter from preset', () => {
    const preset = BUILTIN_ENCOUNTER_PRESETS.find((p) => p.id === 'hazard-encounter')!;
    const id = useProjectStore.getState().createEncounterFromPreset('zone-2', preset);

    const enc = useProjectStore.getState().project.encounterAnchors.find((e) => e.id === id);
    expect(enc!.encounterType).toBe('hazard');
    expect(enc!.probability).toBe(0.6);
    expect(enc!.cooldownTurns).toBe(2);
  });

  it('undo removes the created encounter', () => {
    const preset = BUILTIN_ENCOUNTER_PRESETS.find((p) => p.id === 'discovery-encounter')!;
    useProjectStore.getState().createEncounterFromPreset('zone-1', preset);

    expect(useProjectStore.getState().project.encounterAnchors.length).toBe(1);
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.encounterAnchors.length).toBe(0);
  });
});
