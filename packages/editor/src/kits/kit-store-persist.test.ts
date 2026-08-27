import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useKitStore, StoragePersistError } from './kit-store.js';
import { BUILTIN_KITS } from './built-ins.js';

const STORAGE_KEY = 'world-forge-kits';
const minimalProject = BUILTIN_KITS[0].project;

const sampleInput = {
  name: 'Persist Kit',
  description: '',
  icon: '',
  modes: ['dungeon' as const],
  tags: [] as string[],
  project: minimalProject,
  presetRefs: { region: [] as string[], encounter: [] as string[] },
  guideHints: {},
};

beforeEach(() => {
  localStorage.removeItem(STORAGE_KEY);
  useKitStore.setState({ kits: [...BUILTIN_KITS] });
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(STORAGE_KEY);
});

describe('F-6cf2e4a4: loadKits with poisoned storage', () => {
  it('resets when kits is null instead of crashing', () => {
    localStorage.setItem(STORAGE_KEY, '{"kits":null}');
    let result: { reset: boolean } | undefined;
    expect(() => { result = useKitStore.getState().loadKits(); }).not.toThrow();
    expect(result?.reset).toBe(true);
    const { kits } = useKitStore.getState();
    expect(kits.every((k) => k.builtIn)).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resets when kits is missing', () => {
    localStorage.setItem(STORAGE_KEY, '{"other":[]}');
    const result = useKitStore.getState().loadKits();
    expect(result.reset).toBe(true);
    expect(useKitStore.getState().kits.length).toBe(BUILTIN_KITS.length);
  });

  it('does not flag reset when storage is empty', () => {
    const result = useKitStore.getState().loadKits();
    expect(result.reset).toBe(false);
  });
});

describe('F-76d031d9: same-ms save/duplicate ids', () => {
  it('two same-ms saves produce distinct ids', () => {
    const now = 1_700_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const a = useKitStore.getState().saveKit(sampleInput);
    const b = useKitStore.getState().saveKit({ ...sampleInput, name: 'Persist Kit 2' });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(/^kit-\d+$/);
    expect(b.id).toMatch(/^kit-\d+$/);
  });

  it('duplicateKit uses the counter too', () => {
    const now = 1_700_000_000_001;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const saved = useKitStore.getState().saveKit(sampleInput);
    const copy = useKitStore.getState().duplicateKit(saved.id);
    expect(copy).toBeDefined();
    expect(copy!.id).not.toBe(saved.id);
    expect(copy!.id).toMatch(/^kit-\d+$/);
  });
});

describe('F-9d2f6dae: persist failure tells the caller', () => {
  it('saveKit throws StoragePersistError when setItem throws and rolls back', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const before = useKitStore.getState().kits.length;
    expect(() => useKitStore.getState().saveKit(sampleInput)).toThrow(StoragePersistError);
    expect(useKitStore.getState().kits.length).toBe(before);
  });
});
