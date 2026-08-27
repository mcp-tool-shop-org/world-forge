import { describe, it, expect } from 'vitest';
import { parseKitBundle, serializeKit, BUNDLE_VERSION, migrateKitBundle } from './bundle.js';
import { BUILTIN_KITS } from './built-ins.js';

describe('F-b81060ec: kit bundle version migration', () => {
  it('rejects only unknown future versions', () => {
    const result = parseKitBundle({
      bundleVersion: 999,
      name: 'test',
      modes: ['dungeon'],
      project: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('999');
  });

  it('a v1 bundle still parses after BUNDLE_VERSION becomes 2', () => {
    const v1 = serializeKit(BUILTIN_KITS[0]);
    expect(v1.bundleVersion).toBe(1);
    const result = parseKitBundle(v1, { currentVersion: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.name).toBe(BUILTIN_KITS[0].name);
      expect(result.bundle.bundleVersion).toBe(2);
    }
  });

  it('migrateKitBundle records a best-effort warning when no step exists', () => {
    const { warnings } = migrateKitBundle({ bundleVersion: 1, name: 'x' }, 1, 2);
    expect(warnings.some((w) => w.includes('best-effort'))).toBe(true);
  });

  it('current BUNDLE_VERSION still round-trips', () => {
    const bundle = serializeKit(BUILTIN_KITS[0]);
    expect(bundle.bundleVersion).toBe(BUNDLE_VERSION);
    const parsed = parseKitBundle(bundle);
    expect(parsed.ok).toBe(true);
  });
});
