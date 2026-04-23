// stage-c-amends.test.ts — Stage C (Humanization) amends for export-ai-rpg
// Covers findings AIR-B-001, AIR-B-004, AIR-B-006, AIR-B-008.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertEntities } from '../convert-entities.js';
import { convertPackMeta } from '../convert-pack.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from '../fidelity.js';

// --- AIR-B-001: Deterministic assetBindings key order ---

describe('AIR-B-001: deterministic assetBindings JSON output', () => {
  // Build a project whose natural insertion order is non-alphabetical. If
  // the exporter did not sort keys, a second export that iterates in a
  // different underlying order would produce a different JSON string.
  const makeProjectWithBindings = (zoneIdOrder: string[]): WorldProject => {
    const zones: WorldProject['zones'] = zoneIdOrder.map((id, i) => ({
      id,
      name: id,
      tags: ['indoor'],
      description: `zone ${id}`,
      gridX: i * 10, gridY: 0, gridWidth: 10, gridHeight: 10,
      neighbors: [],
      exits: [],
      light: 5, noise: 2,
      hazards: [],
      interactables: [],
      parentDistrictId: 'district-x',
      backgroundId: `bg-${id}`,
    }));
    const assets: WorldProject['assets'] = [
      ...zoneIdOrder.map((id) => ({
        id: `bg-${id}`, kind: 'background' as const, label: id, path: `${id}.png`, tags: [],
      })),
      { id: 'port-z', kind: 'portrait' as const, label: 'z', path: 'z.png', tags: [] },
      { id: 'port-a', kind: 'portrait' as const, label: 'a', path: 'a.png', tags: [] },
      { id: 'icon-zinc', kind: 'icon' as const, label: 'zinc', path: 'zinc.png', tags: [] },
      { id: 'icon-apple', kind: 'icon' as const, label: 'apple', path: 'apple.png', tags: [] },
      { id: 'icon-b', kind: 'icon' as const, label: 'b', path: 'b.png', tags: [] },
      { id: 'icon-a', kind: 'icon' as const, label: 'a', path: 'a.png', tags: [] },
    ];
    return {
      ...minimalProject,
      id: 'deterministic-test',
      zones,
      connections: [],
      districts: [{
        id: 'district-x',
        name: 'X',
        zoneIds: zoneIdOrder,
        tags: [],
        controllingFaction: 'keepers',
        baseMetrics: { commerce: 10, morale: 10, safety: 10, stability: 10 },
        economyProfile: { supplyCategories: [], scarcityDefaults: {} },
      }],
      landmarks: [
        { id: 'lm-b', name: 'B', zoneId: zoneIdOrder[0], gridX: 1, gridY: 1, tags: [], description: 'b', interactionType: 'inspect', iconId: 'icon-b' },
        { id: 'lm-a', name: 'A', zoneId: zoneIdOrder[0], gridX: 2, gridY: 2, tags: [], description: 'a', interactionType: 'inspect', iconId: 'icon-a' },
      ],
      entityPlacements: [
        { entityId: 'npc-zeta', zoneId: zoneIdOrder[0], role: 'npc', portraitId: 'port-z' },
        { entityId: 'npc-alpha', zoneId: zoneIdOrder[0], role: 'npc', portraitId: 'port-a' },
      ],
      itemPlacements: [
        { itemId: 'item-zinc', zoneId: zoneIdOrder[0], container: 'shelf', hidden: false, iconId: 'icon-zinc' },
        { itemId: 'item-apple', zoneId: zoneIdOrder[0], container: 'shelf', hidden: false, iconId: 'icon-apple' },
        // Keep item-torch referenced by playerTemplate.startingInventory
        { itemId: 'item-torch', zoneId: zoneIdOrder[0], container: 'shelf', hidden: false },
      ],
      spawnPoints: [
        { id: 'sp-default', zoneId: zoneIdOrder[0], gridX: 0, gridY: 0, isDefault: true },
      ],
      factionPresences: [
        { factionId: 'keepers', districtIds: ['district-x'], influence: 50, alertLevel: 10 },
      ],
      pressureHotspots: [],
      encounterAnchors: [],
      assets,
    };
  };

  it('produces byte-identical JSON across two exports of the same project', () => {
    const project = makeProjectWithBindings(['zone-zeta', 'zone-alpha']);
    const r1 = exportToEngine(project);
    const r2 = exportToEngine(project);
    if (!r1.success) throw new Error('export failed: ' + JSON.stringify(r1.errors));
    if (!r2.success) throw new Error('export failed: ' + JSON.stringify(r2.errors));
    const j1 = JSON.stringify(r1.assetBindings);
    const j2 = JSON.stringify(r2.assetBindings);
    expect(j1).toBe(j2);
  });

  it('sorts binding keys alphabetically regardless of insertion order', () => {
    const p1 = makeProjectWithBindings(['zone-zeta', 'zone-alpha']);
    const p2 = makeProjectWithBindings(['zone-alpha', 'zone-zeta']);
    const r1 = exportToEngine(p1);
    const r2 = exportToEngine(p2);
    if (!r1.success || !r2.success) throw new Error('export failed');
    // Zones map keyed by zone id — alphabetical regardless of insertion.
    expect(Object.keys(r1.assetBindings!.zones!)).toEqual(['zone-alpha', 'zone-zeta']);
    expect(Object.keys(r2.assetBindings!.zones!)).toEqual(['zone-alpha', 'zone-zeta']);
    // Top-level keys: entities, items, landmarks, zones (alphabetical).
    expect(Object.keys(r1.assetBindings!)).toEqual(['entities', 'items', 'landmarks', 'zones']);
    expect(Object.keys(r1.assetBindings!.entities!)).toEqual(['npc-alpha', 'npc-zeta']);
    expect(Object.keys(r1.assetBindings!.items!)).toEqual(['item-apple', 'item-zinc']);
    expect(Object.keys(r1.assetBindings!.landmarks!)).toEqual(['lm-a', 'lm-b']);
  });

  it('two different insertion orders still serialize to the same JSON', () => {
    const p1 = makeProjectWithBindings(['zone-zeta', 'zone-alpha']);
    const p2 = makeProjectWithBindings(['zone-alpha', 'zone-zeta']);
    const r1 = exportToEngine(p1);
    const r2 = exportToEngine(p2);
    if (!r1.success || !r2.success) throw new Error('export failed');
    expect(JSON.stringify(r1.assetBindings)).toBe(JSON.stringify(r2.assetBindings));
  });
});

// --- AIR-B-004: Fidelity entry for non-JSON-serializable custom fields ---

describe('AIR-B-004: convertEntities fidelity for circular custom fields', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('pushes an approximated/warning fidelity entry when a custom field is circular', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'npc-keeper', zoneId: 'zone-entrance', role: 'npc',
        name: 'Keeper',
        custom: { ok: 'value', broken: circular } as unknown as Record<string, string>,
      }],
    };
    const fidelity: FidelityEntry[] = [];
    convertEntities(project, fidelity);
    const entry = fidelity.find((f) => f.reason === 'custom-field-not-json-serializable');
    expect(entry).toBeDefined();
    expect(entry!.domain).toBe('entities');
    expect(entry!.level).toBe('approximated');
    expect(entry!.severity).toBe('warning');
    expect(entry!.entityId).toBe('npc-keeper');
    expect(entry!.fieldPath).toBe('custom.broken');
  });

  it('does not push a fidelity entry when all custom fields are serializable', () => {
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'npc-keeper', zoneId: 'zone-entrance', role: 'npc',
        name: 'Keeper',
        custom: { ok: 'value' },
      }],
    };
    const fidelity: FidelityEntry[] = [];
    convertEntities(project, fidelity);
    expect(fidelity).toHaveLength(0);
  });

  it('is backward-compatible when no fidelity array is provided', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const project: WorldProject = {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'npc-keeper', zoneId: 'zone-entrance', role: 'npc',
        name: 'Keeper',
        custom: { broken: circular } as unknown as Record<string, string>,
      }],
    };
    // No fidelity arg — must not throw.
    expect(() => convertEntities(project)).not.toThrow();
  });
});

// --- AIR-B-006: Precondition JSDoc is present on every converter ---

describe('AIR-B-006: converter precondition documentation', () => {
  // JSDoc lives in .ts source files — verify by reading them directly so a
  // future refactor can't silently drop the precondition comment.
  const fs = require('node:fs');
  const path = require('node:path');
  const srcDir = path.resolve(__dirname, '..');

  const converters = [
    'convert-zones.ts',
    'convert-districts.ts',
    'convert-entities.ts',
    'convert-items.ts',
    'convert-dialogues.ts',
    'convert-player-template.ts',
    'convert-build-catalog.ts',
    'convert-progression-trees.ts',
    'convert-pack.ts',
  ];

  for (const file of converters) {
    it(`${file} documents the validateProject precondition`, () => {
      const text = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      expect(text).toContain('validateProject(project).valid === true');
    });
  }
});

// --- AIR-B-008: convertPackMeta warnings array surfaces invalid tones ---

describe('AIR-B-008: convertPackMeta surfaces tone warnings via ExportResult', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('pushes invalid-tone warnings into the provided warnings array', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['dark', 'bogus-tone', 'also-bad'] };
    const warnings: string[] = [];
    convertPackMeta(project, warnings);
    expect(warnings.some((w) => w.includes("'bogus-tone'"))).toBe(true);
    expect(warnings.some((w) => w.includes("'also-bad'"))).toBe(true);
  });

  it('pushes the fallback warning when no tones are valid', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['bogus-tone'] };
    const warnings: string[] = [];
    convertPackMeta(project, warnings);
    expect(warnings.some((w) => w.includes('falling back'))).toBe(true);
  });

  it('adds no warnings when every tone is valid', () => {
    const project: WorldProject = { ...minimalProject, tones: ['dark', 'gritty'] };
    const warnings: string[] = [];
    convertPackMeta(project, warnings);
    expect(warnings).toHaveLength(0);
  });

  it('is backward-compatible with the single-arg signature', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['bogus-tone'] };
    expect(() => convertPackMeta(project)).not.toThrow();
  });

  it('exportToEngine surfaces invalid-tone warnings in ExportResult.warnings', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const project: WorldProject = { ...minimalProject, tones: ['dark', 'unrecognized'] };
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes("'unrecognized'"))).toBe(true);
  });
});
