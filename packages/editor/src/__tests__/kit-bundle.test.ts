import { describe, it, expect } from 'vitest';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import {
  serializeKit,
  parseKitBundle,
  prepareKitImport,
  kitFilename,
  BUNDLE_VERSION,
} from '../kits/bundle.js';
import type { StarterKit } from '../kits/types.js';

const sampleKit: StarterKit = {
  ...BUILTIN_KITS[0],
  id: 'test-kit-1',
  builtIn: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-02-01T00:00:00.000Z',
  source: 'local',
};

describe('serializeKit', () => {
  it('strips id, builtIn, createdAt, updatedAt, source', () => {
    const bundle = serializeKit(sampleKit);
    expect(bundle).not.toHaveProperty('id');
    expect(bundle).not.toHaveProperty('builtIn');
    expect(bundle).not.toHaveProperty('createdAt');
    expect(bundle).not.toHaveProperty('updatedAt');
    expect(bundle).not.toHaveProperty('source');
  });

  it('sets bundleVersion to BUNDLE_VERSION', () => {
    const bundle = serializeKit(sampleKit);
    expect(bundle.bundleVersion).toBe(BUNDLE_VERSION);
  });

  it('deep-clones project (no shared references)', () => {
    const bundle = serializeKit(sampleKit);
    expect(bundle.project).toEqual(sampleKit.project);
    expect(bundle.project).not.toBe(sampleKit.project);
    expect(bundle.project.zones).not.toBe(sampleKit.project.zones);
  });

  it('sets exportedAt timestamp', () => {
    const before = new Date().toISOString();
    const bundle = serializeKit(sampleKit);
    expect(bundle.exportedAt).toBeDefined();
    expect(bundle.exportedAt >= before).toBe(true);
  });

  it('preserves name, modes, tags, presetRefs, guideHints', () => {
    const bundle = serializeKit(sampleKit);
    expect(bundle.name).toBe(sampleKit.name);
    expect(bundle.modes).toEqual(sampleKit.modes);
    expect(bundle.tags).toEqual(sampleKit.tags);
    expect(bundle.presetRefs).toEqual(sampleKit.presetRefs);
    expect(bundle.guideHints).toEqual(sampleKit.guideHints);
  });
});

describe('parseKitBundle', () => {
  it('rejects non-object input', () => {
    const result = parseKitBundle('not an object');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not an object');
  });

  it('rejects null input', () => {
    const result = parseKitBundle(null);
    expect(result.ok).toBe(false);
  });

  it('rejects missing bundleVersion', () => {
    const result = parseKitBundle({ name: 'test', modes: ['dungeon'], project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('bundleVersion');
  });

  it('rejects wrong bundleVersion', () => {
    const result = parseKitBundle({ bundleVersion: 999, name: 'test', modes: ['dungeon'], project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('999');
  });

  it('rejects missing/empty name', () => {
    const result = parseKitBundle({ bundleVersion: 1, name: '', modes: ['dungeon'], project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('name');
  });

  it('rejects empty modes array', () => {
    const result = parseKitBundle({ bundleVersion: 1, name: 'test', modes: [], project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('mode');
  });

  it('rejects missing project', () => {
    const result = parseKitBundle({ bundleVersion: 1, name: 'test', modes: ['dungeon'] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('project');
  });

  it('returns warnings for missing optional fields', () => {
    const result = parseKitBundle({
      bundleVersion: 1,
      name: 'test',
      modes: ['dungeon'],
      project: { id: 'p', name: 'p', mode: 'dungeon', zones: [], districts: [], entities: [], items: [], dialogues: [], progressionTrees: [], spawns: [], connections: [], encounters: [] },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.includes('description'))).toBe(true);
    }
  });

  it('round-trip: serialize then parse preserves all data', () => {
    const bundle = serializeKit(sampleKit);
    const result = parseKitBundle(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bundle.name).toBe(sampleKit.name);
      expect(result.bundle.modes).toEqual(sampleKit.modes);
      expect(result.bundle.tags).toEqual(sampleKit.tags);
      expect(result.bundle.presetRefs).toEqual(sampleKit.presetRefs);
      expect(result.bundle.project.zones.length).toBe(sampleKit.project.zones.length);
      expect(result.warnings).toHaveLength(0);
    }
  });
});

describe('kitFilename', () => {
  it('produces sanitized .wfkit.json filename', () => {
    expect(kitFilename('Forgotten Vault')).toBe('forgotten-vault.wfkit.json');
  });

  it('handles empty name', () => {
    expect(kitFilename('')).toBe('kit.wfkit.json');
  });

  it('handles special characters', () => {
    expect(kitFilename('My Kit! (v2)')).toBe('my-kit-v2.wfkit.json');
  });
});

describe('prepareKitImport', () => {
  it('with valid serialized bundle returns isValid: true', () => {
    const bundle = serializeKit(sampleKit);
    const result = prepareKitImport(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isValid).toBe(true);
      expect(result.validationErrors).toHaveLength(0);
    }
  });

  it('with non-object returns error', () => {
    const result = prepareKitImport(42);
    expect(result.ok).toBe(false);
  });

  it('with empty modes returns validation errors', () => {
    const bundle = serializeKit(sampleKit);
    (bundle as unknown as Record<string, unknown>).modes = [];
    const result = prepareKitImport(bundle);
    expect(result.ok).toBe(false);
  });

  it('with missing preset refs returns validation warnings', () => {
    const bundle = serializeKit(sampleKit);
    bundle.presetRefs = { region: ['nonexistent-preset'], encounter: [] };
    const result = prepareKitImport(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isValid).toBe(true);
      expect(result.validationWarnings.some((w) => w.includes('nonexistent-preset'))).toBe(true);
    }
  });

  it('with wrong bundle version returns parse error', () => {
    const bundle = serializeKit(sampleKit);
    (bundle as unknown as Record<string, unknown>).bundleVersion = 99;
    const result = prepareKitImport(bundle);
    expect(result.ok).toBe(false);
  });

  it('sets source to imported', () => {
    const bundle = serializeKit(sampleKit);
    const result = prepareKitImport(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.kit.source).toBe('imported');
    }
  });

  it('round-trip from serializeKit passes cleanly', () => {
    for (const builtIn of BUILTIN_KITS) {
      const bundle = serializeKit(builtIn);
      const result = prepareKitImport(bundle);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.isValid).toBe(true);
        expect(result.kit.name).toBe(builtIn.name);
      }
    }
  });

  it('with minimal valid bundle (no optional fields) passes with warnings', () => {
    const minimal = {
      bundleVersion: 1,
      name: 'Minimal Kit',
      modes: ['dungeon'],
      project: sampleKit.project,
    };
    const result = prepareKitImport(minimal);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.isValid).toBe(true);
      expect(result.parseWarnings.length).toBeGreaterThan(0);
    }
  });
});
