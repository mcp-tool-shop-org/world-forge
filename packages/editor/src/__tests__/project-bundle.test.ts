import { describe, it, expect } from 'vitest';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import {
  serializeProject,
  parseProjectBundle,
  prepareProjectImport,
  extractDependencies,
  projectFilename,
  PROJECT_BUNDLE_VERSION,
} from '../projects/index.js';
import type { ProjectBundle } from '../projects/index.js';

const helloWorld = SAMPLE_WORLDS[0].project; // minimal
const chapel = SAMPLE_WORLDS[2].project;     // rich

describe('serializeProject', () => {
  it('sets bundleVersion to PROJECT_BUNDLE_VERSION', () => {
    const bundle = serializeProject(helloWorld);
    expect(bundle.bundleVersion).toBe(PROJECT_BUNDLE_VERSION);
  });

  it('sets exportedAt as ISO timestamp', () => {
    const bundle = serializeProject(helloWorld);
    expect(bundle.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('deep-clones project (no shared references)', () => {
    const bundle = serializeProject(helloWorld);
    expect(bundle.project).not.toBe(helloWorld);
    expect(bundle.project.zones).not.toBe(helloWorld.zones);
    expect(bundle.project.zones.length).toBe(helloWorld.zones.length);
  });

  it('preserves name, description, version, genre, mode', () => {
    const bundle = serializeProject(chapel);
    expect(bundle.name).toBe(chapel.name);
    expect(bundle.description).toBe(chapel.description);
    expect(bundle.version).toBe(chapel.version);
    expect(bundle.genre).toBe(chapel.genre);
    expect(bundle.mode).toBe(chapel.mode);
  });

  it('computes correct summary counts', () => {
    const bundle = serializeProject(chapel);
    expect(bundle.summary.zones).toBe(chapel.zones.length);
    expect(bundle.summary.entities).toBe(chapel.entityPlacements.length);
    expect(bundle.summary.items).toBe(chapel.itemPlacements.length);
    expect(bundle.summary.dialogues).toBe(chapel.dialogues.length);
    expect(bundle.summary.districts).toBe(chapel.districts.length);
    expect(bundle.summary.spawns).toBe(chapel.spawnPoints.length);
    expect(bundle.summary.connections).toBe(chapel.connections.length);
    expect(bundle.summary.encounters).toBe(chapel.encounterAnchors.length);
    expect(bundle.summary.assets).toBe(chapel.assets.length);
    expect(bundle.summary.assetPacks).toBe(chapel.assetPacks.length);
  });

  it('captures kit name in dependencies when provided', () => {
    const bundle = serializeProject(helloWorld, { name: 'Forgotten Vault', source: 'built-in' });
    expect(bundle.dependencies.kitName).toBe('Forgotten Vault');
    expect(bundle.dependencies.kitSource).toBe('built-in');
  });

  it('leaves kitName undefined when no activeKit', () => {
    const bundle = serializeProject(helloWorld);
    expect(bundle.dependencies.kitName).toBeUndefined();
    expect(bundle.dependencies.kitSource).toBeUndefined();
  });

  it('leaves kitName undefined when activeKit is null', () => {
    const bundle = serializeProject(helloWorld, null);
    expect(bundle.dependencies.kitName).toBeUndefined();
  });

  it('lists assetPackIds from project.assetPacks', () => {
    const bundle = serializeProject(chapel);
    expect(bundle.dependencies.assetPackIds).toEqual(
      chapel.assetPacks.map((p) => p.id),
    );
  });
});

describe('parseProjectBundle', () => {
  it('rejects non-object input', () => {
    const result = parseProjectBundle('not an object');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not an object');
  });

  it('rejects null input', () => {
    const result = parseProjectBundle(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not an object');
  });

  it('rejects missing bundleVersion', () => {
    const result = parseProjectBundle({ name: 'test', project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('bundleVersion');
  });

  it('rejects wrong bundleVersion', () => {
    const result = parseProjectBundle({ bundleVersion: 999, name: 'test', project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('999');
  });

  it('rejects missing name', () => {
    const result = parseProjectBundle({ bundleVersion: 1, project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('name');
  });

  it('rejects empty name', () => {
    const result = parseProjectBundle({ bundleVersion: 1, name: '  ', project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('name');
  });

  it('rejects missing project', () => {
    const result = parseProjectBundle({ bundleVersion: 1, name: 'test' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('project');
  });

  it('returns warnings for missing optional fields', () => {
    const result = parseProjectBundle({
      bundleVersion: 1,
      name: 'test',
      project: helloWorld,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContain('Missing description');
      expect(result.warnings).toContain('Missing mode');
      expect(result.warnings).toContain('Missing version');
      expect(result.warnings).toContain('Missing genre');
    }
  });

  it('returns no warnings when all fields present', () => {
    const bundle = serializeProject(chapel);
    const result = parseProjectBundle(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings).toHaveLength(0);
  });

  it('round-trip: serialize then parse preserves all data', () => {
    const bundle = serializeProject(chapel);
    const result = parseProjectBundle(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.name).toBe(chapel.name);
    expect(result.bundle.mode).toBe(chapel.mode);
    expect(result.bundle.summary.zones).toBe(chapel.zones.length);
    expect(result.bundle.project.zones.length).toBe(chapel.zones.length);
  });
});

describe('projectFilename', () => {
  it('produces sanitized .wfproject.json filename', () => {
    expect(projectFilename('Chapel Threshold')).toBe('chapel-threshold.wfproject.json');
  });

  it('handles empty name', () => {
    expect(projectFilename('')).toBe('project.wfproject.json');
  });

  it('handles special characters', () => {
    expect(projectFilename('My World!!! (v2)')).toBe('my-world-v2.wfproject.json');
  });
});

describe('prepareProjectImport', () => {
  it('with valid serialized bundle returns isValid: true', () => {
    const bundle = serializeProject(helloWorld);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isValid).toBe(true);
  });

  it('with non-object returns error', () => {
    const result = prepareProjectImport(42);
    expect(result.ok).toBe(false);
  });

  it('with wrong bundle version returns parse error', () => {
    const result = prepareProjectImport({ bundleVersion: 999, name: 'test', project: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('999');
  });

  it('returns project from valid bundle', () => {
    const bundle = serializeProject(chapel);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.name).toBe(chapel.name);
    expect(result.project.zones.length).toBe(chapel.zones.length);
  });

  it('includes bundle metadata', () => {
    const bundle = serializeProject(chapel);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.summary.zones).toBe(chapel.zones.length);
    expect(result.bundle.dependencies).toBeDefined();
  });
});

describe('extractDependencies', () => {
  it('returns kitRef when bundle has kit name', () => {
    const bundle = serializeProject(helloWorld, { name: 'Test Kit', source: 'local' });
    const deps = extractDependencies(bundle);
    expect(deps.kitRef).toBeDefined();
    expect(deps.kitRef!.name).toBe('Test Kit');
    expect(deps.kitRef!.source).toBe('local');
  });

  it('returns undefined kitRef when no kit', () => {
    const bundle = serializeProject(helloWorld);
    const deps = extractDependencies(bundle);
    expect(deps.kitRef).toBeUndefined();
  });

  it('lists asset packs from project', () => {
    const bundle = serializeProject(chapel);
    const deps = extractDependencies(bundle);
    expect(deps.assetPacks.length).toBe(chapel.assetPacks.length);
    for (const pack of deps.assetPacks) {
      expect(pack.id).toBeDefined();
      expect(pack.label).toBeDefined();
    }
  });

  it('returns empty assetPacks when project has none', () => {
    const bundle = serializeProject(helloWorld);
    const deps = extractDependencies(bundle);
    expect(deps.assetPacks).toHaveLength(helloWorld.assetPacks.length);
  });
});
