// engine-deps-3x.test.ts — the dep bump, pinned so it cannot silently regress,
// and the ONE thing the bump was supposed to unlock and did not.
//
// C0 checklist item 1 sat open from the engine's 3.0.0 through 3.8.0: this
// package declared `@ai-rpg-engine/* ^2.x` and type-checked against a surface
// one major behind, so every 3.x addition was invisible to it. The errand of
// 2026-07-29 closed it. These assertions are the mechanism that keeps it closed
// — a range that slides back to 2.x fails here rather than in a bug report
// eight minor releases later.
//
// ⚠ The second describe block is an ANDON, not a pass. It pins a BLOCKED state
// and is written to fail loudly the moment the block lifts. Read its comment
// before "fixing" it.

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GameManifest } from '@ai-rpg-engine/core';
import { ENGINE_VERSION_RANGE } from '../convert-pack.js';

/**
 * Resolves to `'absent-from-published-manifest'` while the installed
 * `GameManifest` lacks `contentHash`, and to the other literal the moment a
 * published engine adds it — which breaks the assignment in the test below at
 * COMPILE time. See `export.ts`'s `ExportedManifest`.
 */
type PinnedContentHashState = 'contentHash' extends keyof GameManifest
  ? 'PUBLISHED — drop the ExportedManifest intersection in export.ts'
  : 'absent-from-published-manifest';

/** This package's own manifest — the source of truth for what it declares. */
const OWN_PACKAGE_JSON = path.resolve(import.meta.dirname, '../../package.json');

/** The six engine packages this exporter depends on. Enumerated from the tree. */
const ENGINE_DEPS = [
  '@ai-rpg-engine/character-creation',
  '@ai-rpg-engine/content-schema',
  '@ai-rpg-engine/core',
  '@ai-rpg-engine/equipment',
  '@ai-rpg-engine/modules',
  '@ai-rpg-engine/pack-registry',
] as const;

function declaredDeps(): Record<string, string> {
  const pkg = JSON.parse(fs.readFileSync(OWN_PACKAGE_JSON, 'utf-8')) as {
    dependencies: Record<string, string>;
  };
  return pkg.dependencies;
}

/**
 * The version of an installed engine package, found the way Node resolves one:
 * walk up from this file checking each `node_modules/<pkg>/package.json`.
 *
 * Neither shortcut works here. `import('<pkg>/package.json')` is blocked — these
 * packages declare a single `"."` entry in `exports`, so the subpath does not
 * resolve; `createRequire().resolve('<pkg>')` is blocked too, because they are
 * ESM-only and offer no `require` condition. `import.meta.resolve` exists in
 * Node but not in Vitest's SSR transform. So: the walk, which also naturally
 * finds a nested copy before the hoisted one — exactly the case the assertion
 * below exists to catch.
 */
function installedVersion(pkg: string): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, 'node_modules', pkg, 'package.json');
    if (fs.existsSync(candidate)) {
      return (JSON.parse(fs.readFileSync(candidate, 'utf-8')) as { version: string }).version;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`${pkg} is not installed anywhere above ${import.meta.dirname}`);
}

describe('engine deps — the export lane targets the engine it claims to', () => {
  it('declares all six @ai-rpg-engine ranges at ^3.8.0 — six is what the tree holds', () => {
    // The contract doc said "six". C0 repeated it. Both were right, but neither
    // had counted recently: this reads the manifest, so a seventh dependency
    // added later cannot ride along undeclared.
    const deps = declaredDeps();
    const engineRanges = Object.keys(deps).filter((k) => k.startsWith('@ai-rpg-engine/')).sort();
    expect(engineRanges).toEqual([...ENGINE_DEPS]);
    for (const dep of ENGINE_DEPS) {
      expect(deps[dep], `${dep} must target 3.x`).toBe('^3.8.0');
    }
  });

  it('resolves all six at 3.8.x — a declared range is not an installed version', () => {
    // C0's item 1 was a statement about package.json; what actually determines
    // which types the converters compile against is what npm put on disk. The
    // first install of this errand produced a tree where the DECLARED ranges
    // were all 3.8.0 and `content-schema@3.8.0` still sat on `core@2.0.1`,
    // because npm kept the 2.x copies it already had for the transitive `*`
    // ranges. The lockfile diff looked correct. This assertion is what that
    // near-miss earned.
    for (const dep of ENGINE_DEPS) {
      expect(installedVersion(dep), `${dep} resolved below 3.8`).toMatch(/^3\.8\./);
    }
  });

  it('the emitted engineVersion range agrees with the range that is installed', () => {
    // Two independent claims about the same engine: the dep range in
    // package.json, and the `>=3.8.0 <4.0.0` this exporter stamps into every
    // manifest it writes. Nothing connected them, so bumping one and not the
    // other would ship packs advertising compatibility the exporter was never
    // compiled against.
    const floor = /^>=(\d+\.\d+\.\d+)/.exec(ENGINE_VERSION_RANGE)?.[1];
    const ceiling = /<(\d+)\.\d+\.\d+/.exec(ENGINE_VERSION_RANGE)?.[1];
    expect(floor, `no floor in "${ENGINE_VERSION_RANGE}"`).toBeDefined();
    expect(declaredDeps()['@ai-rpg-engine/core']).toBe(`^${floor}`);
    // `^3.8.0` admits <4.0.0; the stamped range must not promise more.
    expect(ceiling).toBe(`${Number(floor!.split('.')[0]) + 1}`);
  });
});

describe('⚠ ANDON — the content-hash de-duplication is BLOCKED', () => {
  it('the canonical hasher is still not in any PUBLISHED engine package', async () => {
    // THIS TEST IS EXPECTED TO FAIL EVENTUALLY. When it does, the block has
    // lifted and the fix is:
    //   1. delete `src/content-hash.ts`
    //   2. import { computeContentHash } from '@ai-rpg-engine/content-schema'
    //      in `export.ts`
    //   3. retire the engine-side cross-repo equivalence test
    //      (`ai-rpg-engine/packages/cli/src/c1-gate.test.ts`) with a dated note
    //      — with one shared function it asserts a tautology
    //   4. delete this test
    //
    // Why it is blocked. The 2026-07-29 errand was briefed to delete the
    // duplicated hash and import the engine's canonical one, on the standing
    // reasoning that only the 2.x dep ranges stood in the way. They did not.
    // `computeContentHash` lives in `content-schema/src/gate.ts`, which C1
    // added to engine `main` (merge `00001de`) and which has never been
    // released. npm's `latest` for @ai-rpg-engine/content-schema is 3.8.0,
    // published 2026-07-28 — the night before C1 existed. Verified by grepping all
    // 26 published 3.8.0 packages: zero hits for `computeContentHash`,
    // `runLoadGate` or `applyContentPack`.
    //
    // Publishing an engine release is not this errand's to do, so the duplicate
    // stays and the equivalence test that guards it stays with it.
    const cs = (await import('@ai-rpg-engine/content-schema')) as unknown as Record<string, unknown>;
    // POSITIVE CONTROL, and not decoration: every assertion in this block is an
    // absence, and absence is what a broken import looks like too. If the
    // specifier ever resolved to nothing, `computeContentHash === undefined`
    // would be true for the wrong reason and this ANDON would quietly report
    // "still blocked" forever. So first prove the probe can see an export.
    expect(typeof cs.validateGameContent, 'the import resolved to nothing').toBe('function');
    expect(
      cs.computeContentHash,
      'computeContentHash is now published — see the steps in this test comment, then delete it',
    ).toBeUndefined();
  });

  it('GameManifest still has no contentHash, so ExportedManifest must keep declaring it', () => {
    // A TYPE-level pin, and it is the build that enforces it, not this
    // assertion. `contentHash` was added to `GameManifest` by the same
    // unpublished C1 work (engine `bf496e7`); the published 3.8.0 type does not
    // have it, which is why `export.ts` still intersects the field in locally.
    //
    // If a published engine ever carries it, `PinnedContentHashState` resolves
    // to the other literal, this assignment stops compiling, and `npm run build`
    // fails with the fix in the type's own name. The runtime `expect` below is
    // only here so the constant is used and the pin cannot be lint-swept away.
    const pin: PinnedContentHashState = 'absent-from-published-manifest';
    expect(pin).toBe('absent-from-published-manifest');
  });

  it('…and the whole C1 gate surface is absent, so this is a release gap, not a rename', async () => {
    // Named individually so a partial publish reads as a partial publish rather
    // than as "the export was renamed".
    const cs = (await import('@ai-rpg-engine/content-schema')) as unknown as Record<string, unknown>;
    for (const symbol of ['canonicalize', 'SIM_AFFECTING_KEYS', 'runLoadGate', 'applyContentPack', 'ALLOWED_PACK_KEYS']) {
      expect(cs[symbol], `${symbol} appeared — the C1 surface is shipping`).toBeUndefined();
    }
  });
});
