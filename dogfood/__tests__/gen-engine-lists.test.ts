// gen-engine-lists.test.ts — Verifies that packages/schema/src/generated/engine-lists.ts
// stays byte-for-byte synchronized with installed @ai-rpg-engine/content-schema and remains browser-safe.

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import * as engineSchema from '@ai-rpg-engine/content-schema';
import * as worldForgeSchema from '@world-forge/schema';
import {
  computeEngineVersionRange,
  generateEngineLists,
  GENERATED_REL_PATH,
  renderEngineListsModule,
  resolveInstalledContentSchemaInfo,
} from '../../scripts/gen-engine-lists.mjs';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const GENERATED_FILE = resolve(REPO_ROOT, GENERATED_REL_PATH);

describe('generated engine contract lists in @world-forge/schema', () => {
  it('committed packages/schema/src/generated/engine-lists.ts matches scripts/gen-engine-lists.mjs output verbatim', async () => {
    const { version, content: expectedContent } = await generateEngineLists({
      repoRoot: REPO_ROOT,
      write: false,
    });
    const actualContent = readFileSync(GENERATED_FILE, 'utf-8');

    expect(actualContent).toBe(expectedContent);
    expect(actualContent).not.toContain('\r\n');
    expect(actualContent).toContain('GENERATED, DO NOT EDIT BY HAND.');
    expect(actualContent).toContain(`@ai-rpg-engine/content-schema@${version}`);
    expect(actualContent).not.toMatch(/(?:^|\n)\s*import\b/);
    expect(actualContent).not.toContain('node:');
  });

  it('re-exported constants from @world-forge/schema match installed @ai-rpg-engine/content-schema', () => {
    const info = resolveInstalledContentSchemaInfo(REPO_ROOT);

    expect(worldForgeSchema.INSTALLED_ENGINE_VERSION).toBe(info.version);
    expect(worldForgeSchema.ENGINE_VERSION_RANGE).toBe(computeEngineVersionRange(info.version));
    expect([...worldForgeSchema.SIM_AFFECTING_KEYS]).toEqual([...engineSchema.SIM_AFFECTING_KEYS]);
    expect([...worldForgeSchema.ALLOWED_PACK_KEYS]).toEqual([...engineSchema.ALLOWED_PACK_KEYS]);
    expect([...worldForgeSchema.ENCOUNTER_ANCHOR_TYPES]).toEqual([...engineSchema.ENCOUNTER_ANCHOR_TYPES]);
    expect([...worldForgeSchema.AI_RPG_ENCOUNTER_ANCHOR_TYPES]).toEqual([...engineSchema.ENCOUNTER_ANCHOR_TYPES]);
    expect(worldForgeSchema.EVALUATED_NOT_MAPPED_KEYS).toEqual(engineSchema.EVALUATED_NOT_MAPPED_KEYS);
  });

  it('throws explicitly if any required list export is missing or empty', () => {
    const validExports = {
      SIM_AFFECTING_KEYS: ['zones'],
      ALLOWED_PACK_KEYS: ['zones'],
      ENCOUNTER_ANCHOR_TYPES: ['ambush'],
      EVALUATED_NOT_MAPPED_KEYS: { connections: 'not mapped' },
    };

    for (const key of [
      'SIM_AFFECTING_KEYS',
      'ALLOWED_PACK_KEYS',
      'ENCOUNTER_ANCHOR_TYPES',
      'EVALUATED_NOT_MAPPED_KEYS',
    ] as const) {
      const missing = { ...validExports, [key]: undefined };
      expect(() => renderEngineListsModule({ version: '3.12.2', schemaExports: missing })).toThrow(key);
    }

    expect(() =>
      renderEngineListsModule({
        version: '3.12.2',
        schemaExports: { ...validExports, SIM_AFFECTING_KEYS: [] },
      }),
    ).toThrow('SIM_AFFECTING_KEYS');
  });

  it('writes pure LF static module into a target path and CI checks drift via git diff --exit-code', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wf-gen-lists-'));
    try {
      const res = await generateEngineLists({
        repoRoot: tmp,
        outRelPath: 'generated/engine-lists.ts',
        version: '3.12.2',
        schemaExports: engineSchema,
        write: true,
      });
      const written = readFileSync(res.outPath, 'utf-8');
      expect(written).toBe(readFileSync(GENERATED_FILE, 'utf-8'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }

    const ciWorkflow = readFileSync(resolve(REPO_ROOT, '.github/workflows/ci.yml'), 'utf-8');
    expect(ciWorkflow).toContain('node scripts/gen-engine-lists.mjs');
    expect(ciWorkflow).toContain('git diff --exit-code -- packages/schema/src/generated/engine-lists.ts');
  });
});
