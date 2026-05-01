import { describe, it, expect } from 'vitest';

import {
  parseSemVer,
  compareSemVer,
  migratePack,
  isMigrationError,
  MIGRATIONS,
} from '../migrations.js';
import { exportToUnreal, UNREAL_PACK_FORMAT_VERSION, type UnrealPackMeta } from '../export.js';
import { importFromUnreal } from '../import.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

function metaWithVersion(version: string): UnrealPackMeta {
  return {
    Id: 'pack-x',
    Name: 'Pack X',
    Description: 'x',
    Version: '1.0.0',
    SourceProjectId: 'pack-x',
    TileSizeCm: 100,
    SourceTileSizePx: 32,
    FormatVersion: version,
  };
}

describe('parseSemVer', () => {
  it('parses valid semver strings', () => {
    expect(parseSemVer('1.1.0')).toEqual({ major: 1, minor: 1, patch: 0 });
    expect(parseSemVer('0.0.0')).toEqual({ major: 0, minor: 0, patch: 0 });
    expect(parseSemVer('99.100.101')).toEqual({ major: 99, minor: 100, patch: 101 });
  });

  it('rejects malformed / missing inputs', () => {
    expect(parseSemVer(undefined)).toBeUndefined();
    expect(parseSemVer(null)).toBeUndefined();
    expect(parseSemVer('1.1')).toBeUndefined();
    expect(parseSemVer('1.1.0-beta')).toBeUndefined();
    expect(parseSemVer('not-a-version')).toBeUndefined();
    expect(parseSemVer(12)).toBeUndefined();
  });
});

describe('compareSemVer', () => {
  it('returns signed diff and sameMajor flag', () => {
    expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 0, patch: 0 })).toEqual({
      cmp: 0,
      sameMajor: true,
    });
    expect(compareSemVer({ major: 1, minor: 0, patch: 0 }, { major: 1, minor: 1, patch: 0 }).cmp).toBeLessThan(0);
    expect(compareSemVer({ major: 1, minor: 1, patch: 0 }, { major: 1, minor: 0, patch: 0 }).cmp).toBeGreaterThan(0);
    expect(compareSemVer({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 9, patch: 9 }).sameMajor).toBe(false);
  });
});

describe('migratePack', () => {
  it('is a no-op when already at target', () => {
    const meta = metaWithVersion('1.1.0');
    const result = migratePack(meta, '1.1.0');
    if (isMigrationError(result)) throw new Error('expected success');
    expect(result.appliedSteps).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.meta.FormatVersion).toBe('1.1.0');
  });

  it('walks the chain from an older minor to the target', () => {
    const meta = metaWithVersion('1.0.0');
    const result = migratePack(meta, '1.1.0');
    if (isMigrationError(result)) throw new Error('expected success');
    expect(result.appliedSteps).toEqual([{ from: '1.0.0', to: '1.1.0' }]);
    expect(result.meta.FormatVersion).toBe('1.1.0');
  });

  it('emits a forward-compat warning for newer minor on same major', () => {
    const meta = metaWithVersion('1.2.0');
    const result = migratePack(meta, '1.1.0');
    if (isMigrationError(result)) throw new Error('expected success');
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0].kind).toBe('forward-compat');
    expect(result.warnings[0].fromVersion).toBe('1.2.0');
    expect(result.warnings[0].toVersion).toBe('1.1.0');
    expect(result.meta.FormatVersion).toBe('1.2.0');
  });

  it('hard-errors on unknown major (future)', () => {
    const meta = metaWithVersion('2.0.0');
    const result = migratePack(meta, '1.1.0');
    expect(isMigrationError(result)).toBe(true);
    if (isMigrationError(result)) {
      expect(result.code).toBe('UNKNOWN_MAJOR');
      expect(result.message).toContain('2.0.0');
    }
  });

  it('hard-errors on unknown major (past)', () => {
    const meta = metaWithVersion('0.9.0');
    const result = migratePack(meta, '1.1.0');
    expect(isMigrationError(result)).toBe(true);
    if (isMigrationError(result)) {
      expect(result.code).toBe('UNKNOWN_MAJOR');
    }
  });

  it('rejects malformed FormatVersion', () => {
    const meta = metaWithVersion('garbage');
    const result = migratePack(meta, '1.1.0');
    expect(isMigrationError(result)).toBe(true);
    if (isMigrationError(result)) expect(result.code).toBe('MALFORMED_VERSION');
  });
});

describe('MIGRATIONS chain', () => {
  it('has v1.0.0 → v1.1.0 registered', () => {
    const step = MIGRATIONS.find((m) => m.from === '1.0.0' && m.to === '1.1.0');
    expect(step).toBeDefined();
  });

  it('each step transforms FormatVersion to match its `to`', () => {
    for (const step of MIGRATIONS) {
      const before = metaWithVersion(step.from);
      const after = step.migrate(before);
      expect(after.FormatVersion).toBe(step.to);
    }
  });
});

describe('UNREAL_PACK_FORMAT_VERSION', () => {
  it('is 1.1.0 (Signature added as optional minor bump)', () => {
    expect(UNREAL_PACK_FORMAT_VERSION).toBe('1.1.0');
  });
});

describe('importFromUnreal + migration integration', () => {
  it('current pack round-trips unchanged at v1.1.0', () => {
    const exp = exportToUnreal(minimalProject);
    if (!exp.success) throw new Error('export failed');
    expect(exp.contentPack.Meta.FormatVersion).toBe('1.1.0');
    const back = importFromUnreal(exp.contentPack);
    expect(back.success).toBe(true);
  });

  it('a synthetic v1.0.0 pack is migrated on import (no-op content)', () => {
    const exp = exportToUnreal(minimalProject);
    if (!exp.success) throw new Error('export failed');
    const legacyPack = {
      ...exp.contentPack,
      Meta: { ...exp.contentPack.Meta, FormatVersion: '1.0.0' },
    };
    const back = importFromUnreal(legacyPack);
    expect(back.success).toBe(true);
  });

  it('a synthetic v2.0.0 pack fails with a clear error naming the version', () => {
    const exp = exportToUnreal(minimalProject);
    if (!exp.success) throw new Error('export failed');
    const futurePack = {
      ...exp.contentPack,
      Meta: { ...exp.contentPack.Meta, FormatVersion: '2.0.0' },
    };
    const back = importFromUnreal(futurePack);
    expect(back.success).toBe(false);
    if (!back.success) {
      expect(back.errors.some((e) => e.message.includes('2.0.0'))).toBe(true);
    }
  });

  it('a synthetic v1.2.0 pack loads with a forward-compat warning entry', () => {
    const exp = exportToUnreal(minimalProject);
    if (!exp.success) throw new Error('export failed');
    const futureMinor = {
      ...exp.contentPack,
      Meta: { ...exp.contentPack.Meta, FormatVersion: '1.2.0' },
    };
    const back = importFromUnreal(futureMinor);
    expect(back.success).toBe(true);
    if (back.success) {
      const warning = back.fidelity.entries.find(
        (e) => typeof e.message === 'string' && e.message.includes('newer than loader'),
      );
      expect(warning).toBeDefined();
    }
  });
});
