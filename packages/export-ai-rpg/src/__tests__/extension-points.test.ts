import { describe, it, expect } from 'vitest';

// Import all documented extension points from the public API
import {
  // Import pipeline extension points
  detectImportFormat,
  importProject,
  importFromContentPack,
  importFromExportResult,

  // Export pipeline extension point
  exportToEngine,

  // Per-domain converters (export)
  convertZones,
  convertDistricts,
  convertEntities,
  convertItems,
  convertManifest,
  convertPackMeta,

  // Fidelity system
  summarizeFidelity,
  buildFidelityReport,
} from '../index.js';

// Import types to verify they are accessible
import type {
  ImportResult,
  ImportError,
  ImportFormat,
  ContentPack,
  ExportResult,
  ExportError,
  AssetBindingMap,
  FidelityLevel,
  FidelitySeverity,
  FidelityDomain,
  FidelityEntry,
  DomainSummary,
  FidelitySummary,
  FidelityReport,
} from '../index.js';

describe('Extension point exports', () => {
  it('exports detectImportFormat as a function', () => {
    expect(typeof detectImportFormat).toBe('function');
  });

  it('exports importProject as a function', () => {
    expect(typeof importProject).toBe('function');
  });

  it('exports importFromContentPack as a function', () => {
    expect(typeof importFromContentPack).toBe('function');
  });

  it('exports importFromExportResult as a function', () => {
    expect(typeof importFromExportResult).toBe('function');
  });

  it('exports exportToEngine as a function', () => {
    expect(typeof exportToEngine).toBe('function');
  });

  it('exports per-domain converter functions', () => {
    expect(typeof convertZones).toBe('function');
    expect(typeof convertDistricts).toBe('function');
    expect(typeof convertEntities).toBe('function');
    expect(typeof convertItems).toBe('function');
    expect(typeof convertManifest).toBe('function');
    expect(typeof convertPackMeta).toBe('function');
  });

  it('exports fidelity utilities', () => {
    expect(typeof summarizeFidelity).toBe('function');
    expect(typeof buildFidelityReport).toBe('function');
  });

  it('buildFidelityReport produces a valid report from empty entries', () => {
    const report = buildFidelityReport([]);
    expect(report.entries).toEqual([]);
    expect(report.summary.total).toBe(0);
    expect(report.summary.losslessPercent).toBe(100);
  });

  it('summarizeFidelity counts levels correctly', () => {
    const entries: FidelityEntry[] = [
      { level: 'lossless', domain: 'zones', severity: 'info', message: 'ok', reason: 'test' },
      { level: 'approximated', domain: 'entities', severity: 'warning', message: 'guessed', reason: 'test' },
      { level: 'dropped', domain: 'assets', severity: 'error', message: 'lost', reason: 'test' },
    ];
    const summary = summarizeFidelity(entries);
    expect(summary.total).toBe(3);
    expect(summary.lossless).toBe(1);
    expect(summary.approximated).toBe(1);
    expect(summary.dropped).toBe(1);
    expect(summary.losslessPercent).toBe(33);
    expect(summary.byDomain.zones?.lossless).toBe(1);
    expect(summary.byDomain.entities?.approximated).toBe(1);
    expect(summary.byDomain.assets?.dropped).toBe(1);
  });

  it('detectImportFormat returns null for unrecognized data', () => {
    expect(detectImportFormat(null)).toBe(null);
    expect(detectImportFormat(42)).toBe(null);
    expect(detectImportFormat([])).toBe(null);
    expect(detectImportFormat({ random: true })).toBe(null);
  });

  it('importProject returns an error for unrecognized format', () => {
    const result = importProject({ random: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.message).toContain('Unrecognized file format');
    }
  });

  // Type-level smoke test: ensure the documented types compile.
  // This test does not execute meaningful logic — it verifies that the types
  // referenced in the extension-point documentation are importable and usable.
  it('documented types are usable at compile time', () => {
    const format: ImportFormat = 'content-pack';
    const level: FidelityLevel = 'lossless';
    const severity: FidelitySeverity = 'info';
    const domain: FidelityDomain = 'zones';

    // These assignments prove the types resolve. The expect is a formality.
    expect(format).toBe('content-pack');
    expect(level).toBe('lossless');
    expect(severity).toBe('info');
    expect(domain).toBe('zones');
  });
});
