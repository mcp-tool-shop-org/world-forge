import { describe, it, expect } from 'vitest';
import { summarizeFidelity, buildFidelityReport } from '../fidelity.js';
import type { FidelityEntry } from '../fidelity.js';
import { exportToEngine } from '../export.js';
import { importFromExportResult, importFromContentPack, importProject } from '../import.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { chapelProject } from '../../../schema/src/__tests__/fixtures/chapel-authored.js';

// --- FidelityReport model ---

describe('FidelityReport', () => {
  it('summarize empty → 100% lossless', () => {
    const summary = summarizeFidelity([]);
    expect(summary.total).toBe(0);
    expect(summary.lossless).toBe(0);
    expect(summary.approximated).toBe(0);
    expect(summary.dropped).toBe(0);
    expect(summary.losslessPercent).toBe(100);
  });

  it('summarize mixed entries → correct arithmetic', () => {
    const entries: FidelityEntry[] = [
      { level: 'lossless', domain: 'zones', severity: 'info', message: 'ok', reason: 'r1' },
      { level: 'lossless', domain: 'zones', severity: 'info', message: 'ok', reason: 'r2' },
      { level: 'approximated', domain: 'entities', severity: 'warning', message: 'approx', reason: 'r3' },
      { level: 'dropped', domain: 'districts', severity: 'error', message: 'gone', reason: 'r4' },
    ];
    const summary = summarizeFidelity(entries);
    expect(summary.total).toBe(4);
    expect(summary.lossless).toBe(2);
    expect(summary.approximated).toBe(1);
    expect(summary.dropped).toBe(1);
    expect(summary.losslessPercent).toBe(50);
  });

  it('byDomain grouping correct', () => {
    const entries: FidelityEntry[] = [
      { level: 'lossless', domain: 'zones', severity: 'info', message: '', reason: '' },
      { level: 'approximated', domain: 'zones', severity: 'warning', message: '', reason: '' },
      { level: 'dropped', domain: 'entities', severity: 'error', message: '', reason: '' },
    ];
    const summary = summarizeFidelity(entries);
    expect(summary.byDomain.zones?.total).toBe(2);
    expect(summary.byDomain.zones?.lossless).toBe(1);
    expect(summary.byDomain.zones?.approximated).toBe(1);
    expect(summary.byDomain.zones?.dropped).toBe(0);
    expect(summary.byDomain.entities?.total).toBe(1);
    expect(summary.byDomain.entities?.dropped).toBe(1);
    expect(summary.byDomain.districts).toBeUndefined();
  });

  it('buildFidelityReport wraps entries + summary', () => {
    const entries: FidelityEntry[] = [
      { level: 'lossless', domain: 'zones', severity: 'info', message: 'ok', reason: 'r1' },
    ];
    const report = buildFidelityReport(entries);
    expect(report.entries).toHaveLength(1);
    expect(report.summary.total).toBe(1);
    expect(report.summary.lossless).toBe(1);
  });
});

// --- Round-trip fidelity: Minimal ---

describe('Round-trip fidelity: Minimal', () => {
  function getMinimalImport() {
    const exported = exportToEngine(minimalProject);
    if ('ok' in exported) throw new Error('export failed');
    return importFromExportResult(exported);
  }

  it('fidelity report is present and structured', () => {
    const imported = getMinimalImport();
    expect(imported.fidelityReport).toBeDefined();
    expect(imported.fidelityReport.entries.length).toBeGreaterThan(0);
    expect(imported.fidelityReport.summary.total).toBeGreaterThan(0);
  });

  it('zone names, descriptions, tags are lossless', () => {
    const exported = exportToEngine(minimalProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromExportResult(exported);
    for (const origZone of minimalProject.zones) {
      const importedZone = imported.project.zones.find((z) => z.id === origZone.id);
      expect(importedZone).toBeDefined();
      expect(importedZone!.name).toBe(origZone.name);
      expect(importedZone!.description).toBe(origZone.description);
      expect(importedZone!.tags).toEqual(origZone.tags);
    }
  });

  it('grid positions differ (approximated)', () => {
    const imported = getMinimalImport();
    const report = imported.fidelityReport;
    const gridEntries = report.entries.filter((e) => e.reason === 'grid-auto-generated');
    expect(gridEntries.length).toBe(minimalProject.zones.length);
    expect(gridEntries.every((e) => e.level === 'approximated')).toBe(true);
  });

  it('entity zone assignments differ (round-robin)', () => {
    const imported = getMinimalImport();
    const report = imported.fidelityReport;
    const roundRobin = report.entries.filter((e) => e.reason === 'zone-placement-round-robin');
    expect(roundRobin.length).toBe(minimalProject.entityPlacements.length);
  });

  it('dialogue nodes match', () => {
    const exported = exportToEngine(minimalProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromExportResult(exported);
    for (const origDlg of minimalProject.dialogues) {
      const importedDlg = imported.project.dialogues.find((d) => d.id === origDlg.id);
      expect(importedDlg).toBeDefined();
      expect(Object.keys(importedDlg!.nodes).sort()).toEqual(Object.keys(origDlg.nodes).sort());
    }
  });

  it('player template fields match', () => {
    const exported = exportToEngine(minimalProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromExportResult(exported);
    expect(imported.project.playerTemplate?.name).toBe(minimalProject.playerTemplate?.name);
    expect(imported.project.playerTemplate?.baseStats).toEqual(minimalProject.playerTemplate?.baseStats);
    expect(imported.project.playerTemplate?.startingInventory).toEqual(minimalProject.playerTemplate?.startingInventory);
  });
});

// --- Round-trip fidelity: Chapel Threshold ---

describe('Round-trip fidelity: Chapel Threshold', () => {
  function getChapelImport() {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');
    return importFromExportResult(exported);
  }

  it('fidelity report lossless% is reasonable', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    // Chapel has zones, districts, entities, items, dialogues, player, builds, progression
    // Many entries will be approximated (grid, zone assignments, role mapping, etc.)
    expect(report.summary.losslessPercent).toBeGreaterThan(0);
    expect(report.summary.losslessPercent).toBeLessThan(100);
  });

  it('all approximated entries have correct reason keys', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    const approx = report.entries.filter((e) => e.level === 'approximated');
    const validReasons = new Set([
      'grid-auto-generated', 'interactable-type-defaulted',
      'surveillance-to-safety', 'zone-placement-round-robin',
      'role-reverse-mapped', 'zone-placement-first-zone',
      'hidden-from-contraband', 'textblock-to-string',
      'spawn-point-generated',
    ]);
    for (const entry of approx) {
      expect(validReasons.has(entry.reason)).toBe(true);
    }
  });

  it('all dropped entries have correct reason keys', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    const dropped = report.entries.filter((e) => e.level === 'dropped');
    const validReasons = new Set([
      'economy-data-lost', 'pack-id-stripped', 'visual-layers-dropped', 'assets-dropped',
      'asset-packs-dropped',
    ]);
    for (const entry of dropped) {
      expect(validReasons.has(entry.reason)).toBe(true);
    }
  });

  it('entity roles reverse-mapped with fidelity entries per entity', () => {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromExportResult(exported);
    const report = imported.fidelityReport;
    const roleMapped = report.entries.filter((e) => e.reason === 'role-reverse-mapped');
    expect(roleMapped.length).toBe(chapelProject.entityPlacements.length);
    // Each entry has level 'approximated' and domain 'entities'
    expect(roleMapped.every((e) => e.level === 'approximated')).toBe(true);
    expect(roleMapped.every((e) => e.domain === 'entities')).toBe(true);
    // Verify entities without ambiguous author tags round-trip correctly
    const pilgrim = imported.project.entityPlacements.find((e) => e.entityId === 'suspicious-pilgrim');
    expect(pilgrim!.role).toBe('npc'); // no ambiguous tags
    const ghoul = imported.project.entityPlacements.find((e) => e.entityId === 'ash-ghoul');
    expect(ghoul!.role).toBe('boss'); // boss tag survives
  });

  it('build catalog survives minus packId', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    expect(report.entries.some((e) => e.reason === 'pack-id-stripped')).toBe(true);
    expect(imported.project.buildCatalog).toBeDefined();
    expect(imported.project.buildCatalog!.statBudget).toBe(chapelProject.buildCatalog!.statBudget);
    expect(imported.project.buildCatalog!.archetypes.length).toBe(chapelProject.buildCatalog!.archetypes.length);
    expect(imported.project.buildCatalog!.backgrounds.length).toBe(chapelProject.buildCatalog!.backgrounds.length);
    expect(imported.project.buildCatalog!.traits.length).toBe(chapelProject.buildCatalog!.traits.length);
  });

  it('progression tree structure identical', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    // Trees are lossless — no tree fidelity entries
    const treeEntries = report.entries.filter((e) => e.domain === 'progression');
    expect(treeEntries).toHaveLength(0);
    // Structure matches
    expect(imported.project.progressionTrees.length).toBe(chapelProject.progressionTrees.length);
    for (const orig of chapelProject.progressionTrees) {
      const importedTree = imported.project.progressionTrees.find((t) => t.id === orig.id);
      expect(importedTree).toBeDefined();
      expect(importedTree!.nodes.length).toBe(orig.nodes.length);
      expect(importedTree!.currency).toBe(orig.currency);
    }
  });

  it('district fidelity: surveillance-to-safety + economy-data-lost per district', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    const survEntries = report.entries.filter((e) => e.reason === 'surveillance-to-safety');
    const econEntries = report.entries.filter((e) => e.reason === 'economy-data-lost');
    expect(survEntries.length).toBe(chapelProject.districts.length);
    expect(econEntries.length).toBe(chapelProject.districts.length);
  });

  it('visual-layers-dropped entry present', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    expect(report.entries.some((e) => e.reason === 'visual-layers-dropped')).toBe(true);
  });

  it('byDomain covers all non-empty domains', () => {
    const imported = getChapelImport();
    const report = imported.fidelityReport;
    expect(report.summary.byDomain.zones).toBeDefined();
    expect(report.summary.byDomain.districts).toBeDefined();
    expect(report.summary.byDomain.entities).toBeDefined();
    expect(report.summary.byDomain.world).toBeDefined();
    // builds should be there if pack-id-stripped emitted
    expect(report.summary.byDomain.builds).toBeDefined();
  });
});

// --- FidelityReport accuracy ---

describe('FidelityReport accuracy', () => {
  it('report claims match actual data differences', () => {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromExportResult(exported);
    const report = imported.fidelityReport;

    // Count actual grid differences
    let gridDiffs = 0;
    for (const orig of chapelProject.zones) {
      const imp = imported.project.zones.find((z) => z.id === orig.id);
      if (imp && (imp.gridX !== orig.gridX || imp.gridY !== orig.gridY)) gridDiffs++;
    }
    const gridEntries = report.entries.filter((e) => e.reason === 'grid-auto-generated');
    // All zones should have grid entries since all are auto-generated
    expect(gridEntries.length).toBe(chapelProject.zones.length);
    // And actual diffs should match (all zones differ)
    expect(gridDiffs).toBe(chapelProject.zones.length);
  });

  it('WorldProject import produces empty fidelity report', () => {
    const result = importProject(chapelProject);
    if ('ok' in result) throw new Error('import failed');
    expect(result.fidelityReport.summary.total).toBe(0);
    expect(result.fidelityReport.summary.losslessPercent).toBe(100);
  });

  it('connections-reconstructed entry present when zones have neighbors', () => {
    const exported = exportToEngine(chapelProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromExportResult(exported);
    const connEntry = imported.fidelityReport.entries.find((e) => e.reason === 'connections-reconstructed');
    if (chapelProject.connections.length > 0) {
      expect(connEntry).toBeDefined();
      expect(connEntry!.level).toBe('lossless');
    }
  });

  it('ContentPack import has asset-packs-dropped fidelity entry', () => {
    const exported = exportToEngine(minimalProject);
    if ('ok' in exported) throw new Error('export failed');
    const imported = importFromContentPack(exported.contentPack);
    expect(imported.fidelityReport.entries.some((e) => e.reason === 'asset-packs-dropped')).toBe(true);
  });
});
