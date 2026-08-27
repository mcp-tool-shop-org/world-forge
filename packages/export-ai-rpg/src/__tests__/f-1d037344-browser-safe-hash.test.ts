// F-1d037344: exportToEngine must remain callable when node:crypto is gone
// (AIR-FT-005 browser-safe contract). This file's vi.mock is the injection
// the finding asked for — Node-only unit tests of canonicalize / SIM_AFFECTING_KEYS
// are not proof the public export path is callable without Node builtins.

import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    createHash() {
      throw new Error('node:crypto createHash is not available (F-1d037344 injection)');
    },
  };
});

import { exportToEngine } from '../export.js';
import { computeContentHash } from '../content-hash.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

const srcDir = dirname(fileURLToPath(import.meta.url));

describe('F-1d037344: exportToEngine is browser-safe (no node:crypto on the public path)', () => {
  it('content-hash.ts and export.ts do not import node:crypto', () => {
    const hashSrc = readFileSync(join(srcDir, '..', 'content-hash.ts'), 'utf8');
    const exportSrc = readFileSync(join(srcDir, '..', 'export.ts'), 'utf8');
    const importRe = /(?:from|import)\s+['"]node:crypto['"]|require\(\s*['"]node:crypto['"]\s*\)/;
    expect(hashSrc).not.toMatch(importRe);
    expect(exportSrc).not.toMatch(importRe);
  });

  it('the injection is live: node:crypto.createHash throws in this file', async () => {
    const crypto = await import('node:crypto');
    expect(() => crypto.createHash('sha256')).toThrow(/F-1d037344/);
  });

  it('exportToEngine succeeds when node:crypto.createHash throws and still returns a well-formed ExportResult', () => {
    const result = exportToEngine(minimalProject);
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack).toBeDefined();
    expect(Array.isArray(result.contentPack.entities)).toBe(true);
    expect(Array.isArray(result.contentPack.zones)).toBe(true);
    expect(result.manifest).toBeDefined();
    expect(typeof result.manifest.id).toBe('string');
    expect(result.packMeta).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.fidelity).toBeDefined();
    // Hash is still stamped — computed without Node builtins, not omitted.
    expect(result.manifest.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('computeContentHash still stamps a sha256 digest without Node builtins', () => {
    expect(computeContentHash({ entities: [] })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});
