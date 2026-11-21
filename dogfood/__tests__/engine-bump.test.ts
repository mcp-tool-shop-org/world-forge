// engine-bump.test.ts — unit tests for weekly within-major engine bump automation.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyEngineBump,
  selectBumpPlan,
  formatEngineBumpIssue,
} from '../../scripts/engine-bump.mjs';

let tempRoot: string;

function writeJson(relPath: string, data: unknown): void {
  const full = join(tempRoot, relPath);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function readJson(relPath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(tempRoot, relPath), 'utf-8')) as Record<string, unknown>;
}

beforeEach(() => {
  tempRoot = mkdtempSync(join(tmpdir(), 'wf-engine-bump-'));
  writeJson('package.json', {
    name: 'world-forge-test-workspace',
    version: '4.9.1',
    private: true,
  });
  writeJson('packages/export-ai-rpg/package.json', {
    name: '@world-forge/export-ai-rpg',
    version: '4.9.1',
    dependencies: {
      '@ai-rpg-engine/content-schema': '^3.12.2',
      '@ai-rpg-engine/core': '^3.12.2',
    },
    devDependencies: {
      '@ai-rpg-engine/starter-fantasy': '^3.12.2',
    },
  });
  writeJson('packages/dogfood-helper/package.json', {
    name: '@world-forge/dogfood-helper',
    version: '4.9.1',
    dependencies: {
      '@ai-rpg-engine/content-schema': '^3.12.2',
    },
  });
});

afterEach(() => {
  rmSync(tempRoot, { recursive: true, force: true });
});

describe('scripts/engine-bump.mjs — within-major engine bump logic', () => {
  it('chooses the newest stable release within current major and updates all engine-depending packages together', async () => {
    let lockfileCalls = 0;
    let genListsCalls = 0;

    const result = await applyEngineBump({
      repoRoot: tempRoot,
      fetchVersions: () => ['3.12.0', '3.12.2', '3.12.5', '3.13.0', '3.14.0-alpha.1', '4.0.0'],
      regenerateLockfile: (_root, pkgs, target) => {
        lockfileCalls += 1;
        expect(pkgs).toEqual([
          '@ai-rpg-engine/content-schema',
          '@ai-rpg-engine/core',
          '@ai-rpg-engine/starter-fantasy',
        ]);
        expect(target).toBe('3.13.0');
      },
      regenerateEngineLists: (_root, target) => {
        genListsCalls += 1;
        expect(target).toBe('3.13.0');
      },
    });

    expect(result.status).toBe('bumped');
    expect(result.currentVersion).toBe('3.12.2');
    expect(result.targetVersion).toBe('3.13.0');
    expect(result.newerMajorVersion).toBe('4.0.0');
    expect(lockfileCalls).toBe(1);
    expect(genListsCalls).toBe(1);
    expect(result.updatedFiles).toEqual([
      'packages/dogfood-helper/package.json',
      'packages/export-ai-rpg/package.json',
    ]);

    const expPkg = readJson('packages/export-ai-rpg/package.json') as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const helperPkg = readJson('packages/dogfood-helper/package.json') as {
      dependencies: Record<string, string>;
    };
    expect(expPkg.dependencies['@ai-rpg-engine/content-schema']).toBe('^3.13.0');
    expect(expPkg.dependencies['@ai-rpg-engine/core']).toBe('^3.13.0');
    expect(expPkg.devDependencies['@ai-rpg-engine/starter-fantasy']).toBe('^3.13.0');
    expect(helperPkg.dependencies['@ai-rpg-engine/content-schema']).toBe('^3.13.0');

    const issue = formatEngineBumpIssue({ plan: result });
    expect(issue.title).toContain('3.12.2');
    expect(issue.title).toContain('3.13.0');
    expect(issue.body).toContain('4.0.0');
    expect(issue.body).toContain('pull/new/chore/engine-bump');
    expect(issue.body).toContain('compare/v3.12.2...v3.13.0');
  });

  it('refuses a newer major release when no newer version exists in current major and reports it', async () => {
    let lockfileCalls = 0;
    let genListsCalls = 0;

    const result = await applyEngineBump({
      repoRoot: tempRoot,
      fetchVersions: () => ['3.12.2', '4.0.0', '4.1.0'],
      regenerateLockfile: () => { lockfileCalls += 1; },
      regenerateEngineLists: () => { genListsCalls += 1; },
    });

    expect(result.status).toBe('major-only');
    expect(result.targetVersion).toBeNull();
    expect(result.newerMajorVersion).toBe('4.1.0');
    expect(result.updatedFiles).toEqual([]);
    expect(lockfileCalls).toBe(0);
    expect(genListsCalls).toBe(0);

    const expPkg = readJson('packages/export-ai-rpg/package.json') as {
      dependencies: Record<string, string>;
    };
    expect(expPkg.dependencies['@ai-rpg-engine/core']).toBe('^3.12.2');

    const issue = formatEngineBumpIssue({ plan: result });
    expect(issue.title).toContain('4.1.0');
    expect(issue.body).toContain('refused this major jump');
    expect(issue.body).toContain('compare/v3.12.2...v4.1.0');
  });

  it('is a no-op when already on the newest release within current major', async () => {
    let lockfileCalls = 0;
    let genListsCalls = 0;

    const result = await applyEngineBump({
      repoRoot: tempRoot,
      fetchVersions: () => ['3.12.0', '3.12.1', '3.12.2'],
      regenerateLockfile: () => { lockfileCalls += 1; },
      regenerateEngineLists: () => { genListsCalls += 1; },
    });

    expect(result.status).toBe('noop');
    expect(result.targetVersion).toBeNull();
    expect(result.newerMajorVersion).toBeNull();
    expect(result.compareUrl).toBeNull();
    expect(result.updatedFiles).toEqual([]);
    expect(lockfileCalls).toBe(0);
    expect(genListsCalls).toBe(0);
  });

  it('selectBumpPlan intersects published versions across packages so a partial publish does not split pins', () => {
    const plan = selectBumpPlan({
      currentVersion: '3.12.2',
      publishedByPackage: {
        '@ai-rpg-engine/core': ['3.12.2', '3.12.3', '3.12.4'],
        '@ai-rpg-engine/content-schema': ['3.12.2', '3.12.3'],
        '@ai-rpg-engine/modules': ['3.12.2', '3.12.3', '3.12.4'],
      },
    });
    expect(plan.status).toBe('bumped');
    expect(plan.targetVersion).toBe('3.12.3');
  });
});
