import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { usePresetStore, StoragePersistError } from './preset-store.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from './built-ins.js';

const STORAGE_KEY = 'world-forge-presets';

const regionInput = {
  name: 'Custom Ward',
  description: '',
  tags: [] as string[],
  regionTags: [] as string[],
  baseMetrics: {},
  factionPresences: [],
  pressureHotspots: [],
};

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  usePresetStore.setState({
    regionPresets: [...BUILTIN_REGION_PRESETS],
    encounterPresets: [...BUILTIN_ENCOUNTER_PRESETS],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(STORAGE_KEY);
});

describe('F-6cf2e4a4: loadPresets with poisoned storage', () => {
  it('resets when regionPresets is null', () => {
    localStorage.setItem(STORAGE_KEY, '{"regionPresets":null,"encounterPresets":[]}');
    expect(() => usePresetStore.getState().loadPresets()).not.toThrow();
    expect(usePresetStore.getState().regionPresets.every((p) => p.builtIn)).toBe(true);
  });
});

describe('F-76d031d9: same-ms preset ids', () => {
  it('two same-ms region saves produce distinct ids', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const a = usePresetStore.getState().saveRegionPreset(regionInput);
    const b = usePresetStore.getState().saveRegionPreset({ ...regionInput, name: 'Other' });
    expect(a.id).not.toBe(b.id);
  });
});

describe('F-9d2f6dae: preset persist failure tells the caller', () => {
  it('saveRegionPreset throws when setItem throws and rolls back', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const before = usePresetStore.getState().regionPresets.length;
    expect(() => usePresetStore.getState().saveRegionPreset(regionInput)).toThrow(StoragePersistError);
    expect(usePresetStore.getState().regionPresets.length).toBe(before);
  });
});
