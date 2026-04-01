// ft021-ft027-ft030-ft031-ft033.test.ts — tests for render optimization,
// asset drag-and-drop, theme toggle, project statistics, multi-user docs

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { WorldProject, Zone, EntityPlacement, ZoneConnection, EncounterAnchor, District, EntityRole, ConnectionKind } from '@world-forge/schema';
import { LARGE_SELECTION_THRESHOLD } from '../Canvas.js';
import { isGenericAssetName } from '../panels/AssetPanel.js';
import { getInitialTheme } from '../App.js';
import { computeStatistics, StatBar } from '../panels/ReviewPanel.js';
import { getSelectionCount, type SelectionSet } from '../store/editor-store.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeZone(id: string, districtId?: string): Zone {
  return {
    id, name: `Zone ${id}`, description: '',
    gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
    tags: [], neighbors: [], exits: [],
    light: 5, noise: 2, hazards: [], interactables: [],
    parentDistrictId: districtId,
  };
}

function makeEntity(entityId: string, zoneId: string, role: EntityRole = 'npc'): EntityPlacement {
  return { entityId, name: `Entity ${entityId}`, zoneId, role, gridX: 1, gridY: 1 };
}

function makeConnection(from: string, to: string, kind: ConnectionKind = 'passage'): ZoneConnection {
  return { fromZoneId: from, toZoneId: to, kind, bidirectional: true };
}

function makeEncounter(id: string, zoneId: string, encounterType = 'combat'): EncounterAnchor {
  return { id, zoneId, encounterType, probability: 0.5, enemyIds: [], cooldownTurns: 0, tags: [] };
}

function makeDistrict(id: string, name: string, zoneIds: string[]): District {
  return {
    id, name, zoneIds, tags: [],
    baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
  };
}

const baseProject: WorldProject = {
  id: 'test', name: 'Test', description: 'A test project', version: '0.1.0',
  genre: 'fantasy', tones: [], difficulty: 'beginner', narratorTone: '',
  map: { id: 'm', name: 'M', description: '', gridWidth: 10, gridHeight: 10, tileSize: 32 },
  zones: [], connections: [], districts: [], landmarks: [],
  factionPresences: [], pressureHotspots: [], dialogues: [],
  progressionTrees: [], entityPlacements: [], itemPlacements: [],
  encounterAnchors: [], spawnPoints: [], craftingStations: [],
  marketNodes: [], tilesets: [], tileLayers: [], props: [],
  propPlacements: [], ambientLayers: [], assets: [], assetPacks: [],
};

function clone(overrides: Partial<WorldProject> = {}): WorldProject {
  return { ...structuredClone(baseProject), ...overrides };
}

// ── FT-021: Render Optimization for Large Selections ─────────────

describe('FT-021: Large selection optimization', () => {
  it('LARGE_SELECTION_THRESHOLD is 50', () => {
    expect(LARGE_SELECTION_THRESHOLD).toBe(50);
  });

  it('selection count below threshold does not trigger simplified mode', () => {
    const sel: SelectionSet = {
      zones: Array.from({ length: 10 }, (_, i) => `z${i}`),
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    const count = getSelectionCount(sel);
    expect(count).toBe(10);
    expect(count > LARGE_SELECTION_THRESHOLD).toBe(false);
  });

  it('selection count above threshold triggers simplified mode', () => {
    const sel: SelectionSet = {
      zones: Array.from({ length: 30 }, (_, i) => `z${i}`),
      entities: Array.from({ length: 25 }, (_, i) => `e${i}`),
      landmarks: [], spawns: [], encounters: [],
    };
    const count = getSelectionCount(sel);
    expect(count).toBe(55);
    expect(count > LARGE_SELECTION_THRESHOLD).toBe(true);
  });

  it('exactly 50 does not trigger simplified mode (must exceed threshold)', () => {
    const sel: SelectionSet = {
      zones: Array.from({ length: 50 }, (_, i) => `z${i}`),
      entities: [], landmarks: [], spawns: [], encounters: [],
    };
    expect(getSelectionCount(sel) > LARGE_SELECTION_THRESHOLD).toBe(false);
  });
});

// ── FT-027: Asset Drag-and-Drop Hints ────────────────────────────

describe('FT-027: Asset drag-and-drop', () => {
  it('isGenericAssetName detects generic names', () => {
    expect(isGenericAssetName('123')).toBe(true);
    expect(isGenericAssetName('untitled')).toBe(true);
    expect(isGenericAssetName('npc-merchant-01')).toBe(false);
  });

  it('AssetPanel module exports correctly', async () => {
    const mod = await import('../panels/AssetPanel.js');
    expect(typeof mod.AssetPanel).toBe('function');
    expect(typeof mod.isGenericAssetName).toBe('function');
  });
});

// ── FT-030: Theme Toggle ─────────────────────────────────────────

describe('FT-030: Theme toggle', () => {
  it('getInitialTheme returns "dark" when localStorage is empty', () => {
    // Clear without depending on DOM
    try { localStorage.removeItem('wf-theme'); } catch { /* no-op in non-browser */ }
    expect(getInitialTheme()).toBe('dark');
  });

  it('getInitialTheme returns "light" when stored', () => {
    localStorage.setItem('wf-theme', 'light');
    expect(getInitialTheme()).toBe('light');
    localStorage.removeItem('wf-theme');
  });

  it('getInitialTheme returns "dark" for invalid stored value', () => {
    localStorage.setItem('wf-theme', 'neon');
    expect(getInitialTheme()).toBe('dark');
    localStorage.removeItem('wf-theme');
  });

  it('getInitialTheme is a function', () => {
    expect(typeof getInitialTheme).toBe('function');
  });
});

// ── FT-031: Project Statistics ───────────────────────────────────

describe('FT-031: Project statistics', () => {
  it('computeStatistics returns empty maps for empty project', () => {
    const stats = computeStatistics(clone());
    expect(Object.keys(stats.roleMap)).toHaveLength(0);
    expect(Object.keys(stats.kindMap)).toHaveLength(0);
    expect(Object.keys(stats.encTypeMap)).toHaveLength(0);
    expect(stats.districtZones).toHaveLength(0);
  });

  it('computes entity role distribution', () => {
    const proj = clone({
      zones: [makeZone('z1')],
      entityPlacements: [
        makeEntity('e1', 'z1', 'npc'),
        makeEntity('e2', 'z1', 'npc'),
        makeEntity('e3', 'z1', 'enemy'),
        makeEntity('e4', 'z1', 'boss'),
      ],
    });
    const stats = computeStatistics(proj);
    expect(stats.roleMap).toEqual({ npc: 2, enemy: 1, boss: 1 });
  });

  it('computes connection kind breakdown', () => {
    const proj = clone({
      zones: [makeZone('z1'), makeZone('z2'), makeZone('z3')],
      connections: [
        makeConnection('z1', 'z2', 'passage'),
        makeConnection('z1', 'z3', 'door'),
        makeConnection('z2', 'z3', 'door'),
        makeConnection('z1', 'z2', 'secret'),
      ],
    });
    const stats = computeStatistics(proj);
    expect(stats.kindMap).toEqual({ passage: 1, door: 2, secret: 1 });
  });

  it('computes encounter type summary', () => {
    const proj = clone({
      zones: [makeZone('z1')],
      encounterAnchors: [
        makeEncounter('enc1', 'z1', 'combat'),
        makeEncounter('enc2', 'z1', 'combat'),
        makeEncounter('enc3', 'z1', 'trap'),
      ],
    });
    const stats = computeStatistics(proj);
    expect(stats.encTypeMap).toEqual({ combat: 2, trap: 1 });
  });

  it('computes zone count per district with unassigned', () => {
    const proj = clone({
      zones: [makeZone('z1', 'd1'), makeZone('z2', 'd1'), makeZone('z3')],
      districts: [makeDistrict('d1', 'Town', ['z1', 'z2'])],
    });
    const stats = computeStatistics(proj);
    expect(stats.districtZones).toEqual([
      { name: 'Town', count: 2 },
      { name: 'Unassigned', count: 1 },
    ]);
  });

  it('no unassigned entry when all zones are in districts', () => {
    const proj = clone({
      zones: [makeZone('z1', 'd1'), makeZone('z2', 'd1')],
      districts: [makeDistrict('d1', 'Town', ['z1', 'z2'])],
    });
    const stats = computeStatistics(proj);
    expect(stats.districtZones).toEqual([{ name: 'Town', count: 2 }]);
  });

  it('StatBar is exported as a function', () => {
    expect(typeof StatBar).toBe('function');
  });
});

// ── FT-033: Multi-User Documentation ─────────────────────────────

describe('FT-033: Multi-user documentation in ExportModal', () => {
  it('ExportModal module exports correctly', async () => {
    const mod = await import('../panels/ExportModal.js');
    expect(typeof mod.ExportModal).toBe('function');
  });
});
