/**
 * profiles.test.ts — AIR-FT-001 export profiles (debug vs release) +
 * AIR-FT-005 schemaVersion emission.
 *
 * Verifies:
 * - release profile omits `_debug`.
 * - debug profile adds a `_debug` block with stable field ordering.
 * - Same project + same profile + same timestamp → byte-identical JSON.
 * - `schemaVersion` is present by default and can be opted out via options.
 */

import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../export.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

describe('AIR-FT-001: export profiles', () => {
  it('release profile (default) produces NO _debug key', () => {
    const result = exportToEngine(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack._debug).toBeUndefined();
    // Serialized form should NOT contain the _debug token at all.
    const json = JSON.stringify(result.contentPack);
    expect(json.includes('"_debug"')).toBe(false);
  });

  it('explicit release profile matches default behaviour', () => {
    const a = exportToEngine(minimalProject);
    const b = exportToEngine(minimalProject, { profile: 'release' });
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    if (a.success && b.success) {
      expect(JSON.stringify(a.contentPack)).toBe(JSON.stringify(b.contentPack));
    }
  });

  it('debug profile produces a _debug block with stable field ordering', () => {
    const result = exportToEngine(minimalProject, {
      profile: 'debug',
      debugTimestamp: '2026-04-22T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const dbg = result.contentPack._debug;
    expect(dbg).toBeDefined();
    expect(dbg!.timestamp).toBe('2026-04-22T00:00:00.000Z');
    expect(typeof dbg!.schemaVersion).toBe('string');
    expect(dbg!.sourceProjectId).toBe(minimalProject.id);
    expect(dbg!.fidelityVerbose).toBe(true);

    // Stable field ordering: timestamp, schemaVersion, sourceProjectId,
    // fidelityVerbose — in that exact order.
    expect(Object.keys(dbg!)).toEqual([
      'timestamp',
      'schemaVersion',
      'sourceProjectId',
      'fidelityVerbose',
    ]);
  });

  it('debug _debug block is the first key in the ContentPack (stable ordering)', () => {
    const result = exportToEngine(minimalProject, {
      profile: 'debug',
      debugTimestamp: '2026-04-22T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (!result.success) return;

    const keys = Object.keys(result.contentPack);
    expect(keys[0]).toBe('_debug');
  });

  it('same project + same profile + same timestamp → byte-identical JSON (release)', () => {
    const a = exportToEngine(minimalProject, { profile: 'release' });
    const b = exportToEngine(minimalProject, { profile: 'release' });
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(JSON.stringify(a.contentPack, null, 2))
        .toBe(JSON.stringify(b.contentPack, null, 2));
    }
  });

  it('same project + same profile + same timestamp → byte-identical JSON (debug)', () => {
    const ts = '2026-04-22T00:00:00.000Z';
    const a = exportToEngine(minimalProject, { profile: 'debug', debugTimestamp: ts });
    const b = exportToEngine(minimalProject, { profile: 'debug', debugTimestamp: ts });
    expect(a.success && b.success).toBe(true);
    if (a.success && b.success) {
      expect(JSON.stringify(a.contentPack, null, 2))
        .toBe(JSON.stringify(b.contentPack, null, 2));
    }
  });

  it('backward compatible — calling exportToEngine without options still works', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = (exportToEngine as any)(minimalProject);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.contentPack._debug).toBeUndefined();
      expect(result.contentPack.zones.length).toBeGreaterThan(0);
    }
  });
});

describe('AIR-FT-005: schemaVersion emission', () => {
  it('emitSchemaVersion defaults to true — schemaVersion present in ContentPack', () => {
    const result = exportToEngine(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(typeof result.contentPack.schemaVersion).toBe('string');
    expect(result.contentPack.schemaVersion!.length).toBeGreaterThan(0);
  });

  it('emitSchemaVersion: false strips the field', () => {
    const result = exportToEngine(minimalProject, { emitSchemaVersion: false });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.schemaVersion).toBeUndefined();
    const json = JSON.stringify(result.contentPack);
    expect(json.includes('"schemaVersion"')).toBe(false);
  });

  it('schemaVersion matches @world-forge/schema package version', async () => {
    // Pull the schema version from the same place the exporter does.
    const { createRequire } = await import('node:module');
    const req = createRequire(import.meta.url);
    const pkg = req('@world-forge/schema/package.json') as { version: string };

    const result = exportToEngine(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.schemaVersion).toBe(pkg.version);
  });

  it('debug profile always carries schemaVersion inside _debug regardless of emit flag', () => {
    const result = exportToEngine(minimalProject, {
      profile: 'debug',
      debugTimestamp: '2026-04-22T00:00:00.000Z',
      emitSchemaVersion: false,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack._debug?.schemaVersion).toBeTruthy();
    // Top-level schemaVersion was opted out.
    expect(result.contentPack.schemaVersion).toBeUndefined();
  });
});
