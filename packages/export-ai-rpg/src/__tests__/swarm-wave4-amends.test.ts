// swarm-wave4-amends.test.ts — Stage-B AMEND wave (wave 4) fixes for export-ai-rpg.
//
// One describe block per approved finding. See
// E:\AI\testing-os\swarms\swarm-1785831762-2a42\wave-4\export-engine.md for
// the full finding text this wave fixes.

import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertManifest } from '../convert-pack.js';
import { importFromContentPack } from '../import.js';
import { SIM_AFFECTING_KEYS } from '../content-hash.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { WorldProject } from '@world-forge/schema';
import type { ContentPack } from '../export.js';

// --- F-f216da1a: WorldProject.craftingStations / .marketNodes are exported ---

describe('F-f216da1a: craftingStations/marketNodes cross into the ContentPack instead of being silently dropped', () => {
  const economyProject = (): WorldProject => ({
    ...minimalProject,
    craftingStations: [
      { id: 'station-forge', zoneId: 'zone-entrance', stationType: 'forge', availableRecipes: ['recipe-nails', 'recipe-hinges'] },
    ],
    marketNodes: [
      {
        id: 'market-stall',
        zoneId: 'zone-entrance',
        merchantEntityId: 'npc-keeper',
        supplyCategories: ['tools', 'food'],
        priceModifier: 1.2,
        contrabandAvailable: false,
      },
    ],
  });

  it('exportToEngine puts project.craftingStations onto ContentPack.craftingStations verbatim', () => {
    const project = economyProject();
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.craftingStations).toEqual(project.craftingStations);
  });

  it('exportToEngine puts project.marketNodes onto ContentPack.marketNodes verbatim', () => {
    const project = economyProject();
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.marketNodes).toEqual(project.marketNodes);
  });

  it('ContentPack.craftingStations/marketNodes are present as empty arrays when the project authors none (unconditional key)', () => {
    const result = exportToEngine(minimalProject);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.craftingStations).toEqual([]);
    expect(result.contentPack.marketNodes).toEqual([]);
    // Unconditional presence, not merely `undefined` — matches lootTables'
    // and hazardDefinitions' precedent: the key exists so the content hash
    // covers it even when empty.
    expect(Object.keys(result.contentPack)).toContain('craftingStations');
    expect(Object.keys(result.contentPack)).toContain('marketNodes');
  });

  it('is present in the debug/prefixed branch too', () => {
    const project = economyProject();
    const result = exportToEngine(project, { profile: 'debug', debugTimestamp: '2026-01-01T00:00:00.000Z' });
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.craftingStations).toEqual(project.craftingStations);
    expect(result.contentPack.marketNodes).toEqual(project.marketNodes);
  });

  it('craftingStations and marketNodes participate in the content hash (SIM_AFFECTING_KEYS)', () => {
    expect(SIM_AFFECTING_KEYS).toContain('craftingStations');
    expect(SIM_AFFECTING_KEYS).toContain('marketNodes');
    const withEconomy = exportToEngine(economyProject());
    const without = exportToEngine(minimalProject);
    if (!withEconomy.success || !without.success) throw new Error('export failed');
    expect(withEconomy.manifest.contentHash).not.toBe(without.manifest.contentHash);
  });

  // --- The warning: loud on non-empty, silent on empty ---

  it('warns with a count when craftingStations is non-empty', () => {
    const project: WorldProject = { ...minimalProject, marketNodes: [] };
    const withStation: WorldProject = {
      ...project,
      craftingStations: [{ id: 'station-a', zoneId: 'zone-entrance', stationType: 'forge', availableRecipes: [] }],
    };
    const result = exportToEngine(withStation);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('1 crafting station(s)') && w.includes('craftingStations'))).toBe(true);
  });

  it('warns with a count when marketNodes is non-empty', () => {
    const withNode: WorldProject = {
      ...minimalProject,
      marketNodes: [{ id: 'market-a', zoneId: 'zone-entrance', supplyCategories: ['food'], priceModifier: 1, contrabandAvailable: false }],
    };
    const result = exportToEngine(withNode);
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('1 market node(s)') && w.includes('marketNodes'))).toBe(true);
  });

  it('adds a lossless fidelity entry (domain: world) for each non-empty field', () => {
    const result = exportToEngine(economyProject());
    if (!result.success) throw new Error('export failed');
    const stationEntry = result.fidelity.entries.find((f) => f.reason === 'crafting-stations-raw-passthrough');
    const marketEntry = result.fidelity.entries.find((f) => f.reason === 'market-nodes-raw-passthrough');
    expect(stationEntry).toBeDefined();
    expect(stationEntry!.level).toBe('lossless');
    expect(stationEntry!.domain).toBe('world');
    expect(marketEntry).toBeDefined();
    expect(marketEntry!.level).toBe('lossless');
    expect(marketEntry!.domain).toBe('world');
  });

  // --- The control: this is the shape MOST projects will have, and it must
  // stay perfectly silent. This is the requirement's own bar: a project with
  // no crafting/market content must still export cleanly with NO spurious
  // warning (and, checked here too, no spurious fidelity noise either). ---

  it('CONTROL: a project with no crafting/market content exports cleanly with no spurious warning or fidelity entry', () => {
    expect(minimalProject.craftingStations).toEqual([]);
    expect(minimalProject.marketNodes).toEqual([]);
    const result = exportToEngine(minimalProject);
    if (!result.success) throw new Error('export failed');

    const economyWarnings = result.warnings.filter(
      (w) => w.includes('crafting station') || w.includes('market node'),
    );
    expect(economyWarnings).toEqual([]);

    const economyFidelity = result.fidelity.entries.filter(
      (f) => f.reason === 'crafting-stations-raw-passthrough' || f.reason === 'market-nodes-raw-passthrough',
    );
    expect(economyFidelity).toEqual([]);
  });

  // --- The manifest honesty fix: 'crafting-core' must not be claimed for
  // free. (The live cross-check against a real booted engine registry lives
  // in c1-manifest-truth.test.ts; this proves the same logic without needing
  // that dependency, since @ai-rpg-engine/starter-fantasy is a real runtime
  // import this worktree does not have installed.) ---

  it("convertManifest drops 'crafting-core' when the project authors no crafting stations", () => {
    const modules = convertManifest(minimalProject).modules;
    expect(modules).not.toContain('crafting-core');
  });

  it("convertManifest keeps 'crafting-core' when the project DOES author a crafting station", () => {
    const project: WorldProject = {
      ...minimalProject,
      craftingStations: [{ id: 'station-a', zoneId: 'zone-entrance', stationType: 'forge', availableRecipes: [] }],
    };
    const modules = convertManifest(project).modules;
    expect(modules).toContain('crafting-core');
  });

  it('exportToEngine end-to-end: manifest.modules omits crafting-core exactly when the pack carries no crafting content', () => {
    const withStation = exportToEngine(economyProject());
    const without = exportToEngine(minimalProject);
    if (!withStation.success || !without.success) throw new Error('export failed');
    expect(withStation.manifest.modules).toContain('crafting-core');
    expect(without.manifest.modules).not.toContain('crafting-core');
  });

  // --- The round trip: import must read the data back, not hardcode `[]` ---

  it('importFromContentPack restores craftingStations/marketNodes from the pack instead of hardcoding []', () => {
    const project = economyProject();
    const exported = exportToEngine(project);
    if (!exported.success) throw new Error('export failed');

    const imported = importFromContentPack(exported.contentPack);
    expect(imported.project.craftingStations).toEqual(project.craftingStations);
    expect(imported.project.marketNodes).toEqual(project.marketNodes);
  });

  it('importFromContentPack defaults to [] when a hand-authored pack omits the keys entirely (defensive boundary)', () => {
    const bareMinimumPack = {
      entities: [],
      placements: [],
      zones: [],
      districts: [],
      dialogues: [],
      items: [],
      progressionTrees: [],
      encounterAnchors: [],
      factionPresences: [],
      pressureHotspots: [],
      hazardDefinitions: [],
      lootTables: [],
      // craftingStations / marketNodes deliberately OMITTED — simulates an
      // older or hand-authored ContentPack predating this fix.
    } as unknown as ContentPack;

    const imported = importFromContentPack(bareMinimumPack);
    expect(imported.project.craftingStations).toEqual([]);
    expect(imported.project.marketNodes).toEqual([]);
  });
});
