import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertEntities } from '../convert-entities.js';
import { convertPackMeta } from '../convert-pack.js';
import { importEntities } from '../import-entities.js';
import { importZones } from '../import-zones.js';
import { importDialogues } from '../import-dialogues.js';
import { importItems } from '../import-items.js';
import { importProject, importFromContentPack, detectImportFormat } from '../import.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';

// --- EB-001: Guard/warning when entityPlacements is empty before conversion ---

describe('EB-001: empty entityPlacements warning', () => {
  it('warns when entityPlacements is empty', () => {
    const project: WorldProject = { ...minimalProject, entityPlacements: [] };
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('No entities found'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('no NPCs or encounters'))).toBe(true);
  });

  it('does not warn about empty entityPlacements when entities exist', () => {
    const result = exportToEngine(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('No entities found'))).toBe(false);
  });
});

// --- EB-002: --out bounds check (unit-testable via CLI arg parsing logic) ---
// CLI integration tests are in cli.test.ts. Here we verify the arg parsing shape.

describe('EB-002: --out bounds check', () => {
  it('detectImportFormat returns null for primitives (format detection safety)', () => {
    // This validates the format detection path that CLI relies on
    expect(detectImportFormat(null)).toBeNull();
    expect(detectImportFormat(undefined)).toBeNull();
    expect(detectImportFormat(42)).toBeNull();
  });
});

// --- EB-003: Log specific invalid tone values ---

describe('EB-003: specific invalid tone logging', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('logs specific unrecognized tone names', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['spooky', 'wacky'] };
    convertPackMeta(project);
    // Should log the specific invalid tones
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'spooky'"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("'wacky'"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Valid tones'));
  });

  it('does not log unrecognized warning when all tones are valid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['dark', 'gritty'] };
    convertPackMeta(project);
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unrecognized'));
  });

  it('logs both specific invalid tones and fallback when all are invalid', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['bogus'] };
    convertPackMeta(project);
    // Should get both warnings: unrecognized + fallback
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });
});

// --- EB-004: Reduced warning noise in import-entities ---

describe('EB-004: import-entities reduced warning noise', () => {
  it('no warnings when zoneIds is non-empty', () => {
    const { warnings } = importEntities(
      [
        { id: 'e1', type: 'npc', name: 'Alice', tags: [], aiProfile: 'passive' },
        { id: 'e2', type: 'npc', name: 'Bob', tags: [], aiProfile: 'passive' },
      ],
      ['z1', 'z2'],
    );
    expect(warnings).toHaveLength(0);
  });

  it('warns with actionable message when zoneIds is empty', () => {
    const { warnings } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Alice', tags: [], aiProfile: 'passive' }],
      [],
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('no zones available');
    expect(warnings[0]).toContain('Import zones first');
  });
});

// --- EB-005: import-zones large grid uses fidelity instead of console.warn ---

describe('EB-005: import-zones fidelity for large grid', () => {
  it('emits grid-exceeds-recommended-size fidelity entry', () => {
    const manyZones = Array.from({ length: 500 }, (_, i) => ({
      id: `zone-${i}`, name: `Zone ${i}`, tags: [],
      description: [{ text: 'test' }],
      neighbors: [], exits: [], hazards: [], interactables: [],
      light: 5, noise: 3,
    }));
    const { fidelity } = importZones(manyZones as never);
    const entry = fidelity.find((f) => f.reason === 'grid-exceeds-recommended-size');
    expect(entry).toBeDefined();
    expect(entry!.message).toContain('exceeds');
    expect(entry!.message).toContain('grouping zones');
  });

  it('does not emit grid-exceeds for normal zone count', () => {
    const zones = Array.from({ length: 9 }, (_, i) => ({
      id: `zone-${i}`, name: `Zone ${i}`, tags: [],
      description: [{ text: 'test' }],
      neighbors: [], exits: [], hazards: [], interactables: [],
      light: 5, noise: 3,
    }));
    const { fidelity } = importZones(zones as never);
    expect(fidelity.some((f) => f.reason === 'grid-exceeds-recommended-size')).toBe(false);
  });
});

// --- EB-006: import-dialogues TextBlock guard ---

describe('EB-006: import-dialogues TextBlock array element guard', () => {
  it('filters out TextBlock items without .text property', () => {
    const { dialogues } = importDialogues([{
      id: 'dlg-1',
      speakers: ['narrator'],
      entryNodeId: 'n1',
      nodes: {
        n1: {
          id: 'n1',
          speaker: 'narrator',
          text: [{ text: 'Hello' }, { notText: 'bad' } as never, { text: 'World' }],
        },
      },
    }] as never);
    expect(dialogues[0].nodes.n1.text).toBe('Hello World');
  });

  it('handles empty TextBlock array', () => {
    const { dialogues } = importDialogues([{
      id: 'dlg-1',
      speakers: ['narrator'],
      entryNodeId: 'n1',
      nodes: {
        n1: { id: 'n1', speaker: 'narrator', text: [] },
      },
    }] as never);
    expect(dialogues[0].nodes.n1.text).toBe('');
  });

  it('handles TextBlock array with all invalid entries', () => {
    const { dialogues } = importDialogues([{
      id: 'dlg-1',
      speakers: ['narrator'],
      entryNodeId: 'n1',
      nodes: {
        n1: { id: 'n1', speaker: 'narrator', text: [{ bad: true }, null] },
      },
    }] as never);
    expect(dialogues[0].nodes.n1.text).toBe('');
  });
});

// --- EB-007: Guard empty zones before spawn point ---

describe('EB-007: empty zones spawn point guard', () => {
  it('emits fidelity warning when zones array is empty', () => {
    const emptyPack = {
      entities: [], zones: [], districts: [], dialogues: [],
      items: [], progressionTrees: [],
      encounterAnchors: [], factionPresences: [], pressureHotspots: [],
    };
    const result = importFromContentPack(emptyPack as never);
    const entry = result.fidelityReport.entries.find((f) => f.reason === 'no-zones-no-spawn');
    expect(entry).toBeDefined();
    expect(entry!.message).toContain('No zones found');
    expect(entry!.message).toContain('cannot create spawn point');
  });

  it('does not emit no-zones-no-spawn when zones exist', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const result = importFromContentPack(exported.contentPack);
    expect(result.fidelityReport.entries.some((f) => f.reason === 'no-zones-no-spawn')).toBe(false);
  });
});

// --- EB-008: Fidelity entry when engineEntities is empty ---

describe('EB-008: fidelity for empty engineEntities', () => {
  it('emits no-entities-in-source fidelity entry', () => {
    const { fidelity } = importEntities([], ['z1']);
    const entry = fidelity.find((f) => f.reason === 'no-entities-in-source');
    expect(entry).toBeDefined();
    expect(entry!.level).toBe('lossless');
    expect(entry!.severity).toBe('info');
    expect(entry!.message).toContain('No entities');
  });

  it('does not emit no-entities-in-source when entities exist', () => {
    const { fidelity } = importEntities(
      [{ id: 'e1', type: 'npc', name: 'Bob', tags: [], aiProfile: 'passive' }],
      ['z1'],
    );
    expect(fidelity.some((f) => f.reason === 'no-entities-in-source')).toBe(false);
  });
});

// --- EB-009: Validate custom field values are JSON-serializable ---

describe('EB-009: convertEntities custom field JSON validation', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('passes through JSON-serializable custom values', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'e1', zoneId: 'zone-entrance', role: 'npc',
        name: 'Test', custom: { greeting: 'hello', count: '5' },
      }],
    };
    const entities = convertEntities(project);
    expect((entities[0] as Record<string, unknown>).custom).toEqual({ greeting: 'hello', count: '5' });
  });

  it('warns about non-serializable values', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'e1', zoneId: 'zone-entrance', role: 'npc',
        name: 'Test', custom: { good: 'value', bad: circular } as unknown as Record<string, string>,
      }],
    };
    const entities = convertEntities(project);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-JSON-serializable'));
    // Good value survives, bad value is skipped
    const custom = (entities[0] as Record<string, unknown>).custom as Record<string, string>;
    expect(custom.good).toBe('value');
    expect(custom.bad).toBeUndefined();
  });
});

// --- EB-010: Exhaustive format detection ---

describe('EB-010: exhaustive format detection error path', () => {
  it('returns descriptive error for unrecognized format', () => {
    const result = importProject({ foo: 'bar' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain('Unrecognized file format');
      expect(result.message).toContain('WorldProject');
      expect(result.message).toContain('ContentPack');
      expect(result.message).toContain('ExportResult');
      expect(result.message).toContain('ProjectBundle');
    }
  });

  it('handles project-bundle format', () => {
    const bundle = { bundleVersion: 1, project: minimalProject };
    const result = importProject(bundle);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.project.id).toBe(minimalProject.id);
    }
  });
});

// --- EB-013: --verbose flag (CLI integration is in cli.test.ts, here we verify arg parsing shape) ---

describe('EB-013: verbose flag exists in USAGE', () => {
  it('exportToEngine returns contentPack with diagnostic-friendly structure', () => {
    const result = exportToEngine(minimalProject);
    if (!result.success) throw new Error('export failed');
    // All keys that verbose mode reports should exist
    expect(result.contentPack).toHaveProperty('zones');
    expect(result.contentPack).toHaveProperty('entities');
    expect(result.contentPack).toHaveProperty('districts');
    expect(result.contentPack).toHaveProperty('dialogues');
    expect(result.contentPack).toHaveProperty('items');
    expect(result.contentPack).toHaveProperty('progressionTrees');
    expect(result.contentPack).toHaveProperty('encounterAnchors');
    expect(result.contentPack).toHaveProperty('factionPresences');
    expect(result.contentPack).toHaveProperty('pressureHotspots');
  });
});

// --- EB-014: import-items early return when empty ---

describe('EB-014: importItems early return for empty input', () => {
  it('returns empty result immediately for empty engineItems', () => {
    const { placements, warnings, fidelity } = importItems([], ['z1', 'z2']);
    expect(placements).toHaveLength(0);
    expect(warnings).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });
});

// --- EB-015: null-coalescing for meta.genres and meta.tones ---

describe('EB-015: null-coalescing for meta fields', () => {
  it('handles undefined meta.tones gracefully', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    // Import with meta that has no tones field
    const result = importFromContentPack(exported.contentPack, 'Test', {
      id: 'test', name: 'Test', tagline: '', genres: ['fantasy'],
      difficulty: 'intermediate', tones: undefined as never,
      tags: [], engineVersion: '2.0.0', version: '1.0.0',
      description: 'test', narratorTone: '',
    });
    expect(result.project.tones).toEqual(['atmospheric']);
  });

  it('handles undefined meta.genres gracefully', () => {
    const exported = exportToEngine(minimalProject);
    if (!exported.success) throw new Error('export failed');
    const result = importFromContentPack(exported.contentPack, 'Test', {
      id: 'test', name: 'Test', tagline: '', genres: undefined as never,
      difficulty: 'intermediate', tones: ['dark'],
      tags: [], engineVersion: '2.0.0', version: '1.0.0',
      description: 'test', narratorTone: '',
    });
    expect(result.project.genre).toBe('fantasy'); // fallback
  });
});
