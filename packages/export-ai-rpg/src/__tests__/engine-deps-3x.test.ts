// engine-deps-3x.test.ts — the dep bump, pinned so it cannot silently regress,
// and the Node equivalence guard for world-forge's browser-safe contentHash.
//
// C0 checklist item 1 sat open from the engine's 3.0.0 through 3.8.0: this
// package declared `@ai-rpg-engine/* ^2.x` and type-checked against a surface
// one major behind, so every 3.x addition was invisible to it. The errand of
// 2026-07-29 closed it, and the 2026-11-21 bump moved the pin to ^3.12.2.
//
// Why `src/content-hash.ts` stays duplicated even though 3.12.2 publishes
// `computeContentHash` from `@ai-rpg-engine/content-schema`: the engine's
// `gate.ts` imports `createHash` from `node:crypto`, and `exportToEngine`
// must remain browser-safe (`f-1d037344-browser-safe-hash.test.ts`). So the
// browser-safe mirror stays and hashes the exact 12 `SIM_AFFECTING_KEYS` the
// engine hashes, while this Node test asserts byte-identical digests against
// `@ai-rpg-engine/content-schema`'s `computeContentHash` (the engine repo's
// `packages/cli/src/c1-gate.test.ts:425-470` is the other half of this check).

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  ALLOWED_PACK_KEYS,
  applyContentPack,
  computeContentHash as computeEngineContentHash,
  ENCOUNTER_ANCHOR_TYPES,
  EVALUATED_NOT_MAPPED_KEYS,
  runLoadGate,
  SIM_AFFECTING_KEYS as ENGINE_SIM_AFFECTING_KEYS,
  type ContentPack as EngineContentPack,
} from '@ai-rpg-engine/content-schema';
import {
  AI_RPG_ENCOUNTER_ANCHOR_TYPES as SCHEMA_AI_RPG_ENCOUNTER_ANCHOR_TYPES,
  createEmptyProject,
  validateProject,
  type WorldProject,
} from '@world-forge/schema';
import { ENGINE_VERSION_RANGE } from '../convert-pack.js';
import { computeContentHash, SIM_AFFECTING_KEYS } from '../content-hash.js';
import { AI_RPG_ENCOUNTER_ANCHOR_TYPES, listAiRpgEncounterBlockers } from '../encounter-types.js';
import { exportToEngine } from '../export.js';
import { vocabularyCoverageProject } from './fixtures/vocabulary-coverage.js';

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
  it('declares all six @ai-rpg-engine ranges at ^3.12.2 — six is what the tree holds', () => {
    // The contract doc said "six". C0 repeated it. Both were right, but neither
    // had counted recently: this reads the manifest, so a seventh dependency
    // added later cannot ride along undeclared.
    const deps = declaredDeps();
    const engineRanges = Object.keys(deps).filter((k) => k.startsWith('@ai-rpg-engine/')).sort();
    expect(engineRanges).toEqual([...ENGINE_DEPS]);
    for (const dep of ENGINE_DEPS) {
      expect(deps[dep], `${dep} must target 4.0.0+`).toBe('^4.0.0');
    }
    const pkg = JSON.parse(fs.readFileSync(OWN_PACKAGE_JSON, 'utf-8')) as {
      devDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies['@ai-rpg-engine/starter-fantasy']).toBe('^4.0.0');
  });

  it('resolves all seven at 4.0.0 — a declared range is not an installed version', () => {
    // C0's item 1 was a statement about package.json; what actually determines
    // which types the converters compile against is what npm put on disk. The
    // first install of this errand produced a tree where the DECLARED ranges
    // were all 3.8.0 and `content-schema@3.8.0` still sat on `core@2.0.1`,
    // because npm kept the 2.x copies it already had for the transitive `*`
    // ranges. The lockfile diff looked correct. This assertion is what that
    // near-miss earned.
    for (const dep of [...ENGINE_DEPS, '@ai-rpg-engine/starter-fantasy'] as const) {
      expect(installedVersion(dep), `${dep} resolved below 4.0.0`).toBe('4.0.0');
    }
  });

  it('the emitted engineVersion range agrees with the range that is installed', () => {
    // Two independent claims about the same engine: the dep range in
    // package.json, and the `>=4.0.0 <5.0.0` this exporter stamps into every
    // manifest it writes. Nothing connected them, so bumping one and not the
    // other would ship packs advertising compatibility the exporter was never
    // compiled against.
    const floor = /^>=(\d+\.\d+\.\d+)/.exec(ENGINE_VERSION_RANGE)?.[1];
    const ceiling = /<(\d+)\.\d+\.\d+/.exec(ENGINE_VERSION_RANGE)?.[1];
    expect(floor, `no floor in "${ENGINE_VERSION_RANGE}"`).toBeDefined();
    expect(declaredDeps()['@ai-rpg-engine/core']).toBe(`^${floor}`);
    // `^4.0.0` admits <5.0.0; the stamped range must not promise more.
    expect(ceiling).toBe(`${Number(floor!.split('.')[0]) + 1}`);
  });
});

function createSmallestValidWorldProject(): WorldProject {
  const base = createEmptyProject();
  return {
    ...base,
    zones: [
      {
        id: 'zone-empty',
        name: 'Empty Zone',
        tags: [],
        description: '',
        gridX: 0,
        gridY: 0,
        gridWidth: 4,
        gridHeight: 4,
        neighbors: [],
        exits: [],
        light: 5,
        noise: 0,
        hazards: [],
        interactables: [],
      },
    ],
    spawnPoints: [
      {
        id: 'sp-empty',
        zoneId: 'zone-empty',
        gridX: 1,
        gridY: 1,
        isDefault: true,
      },
    ],
  };
}

async function loadDogfoodProject(relFromRepoRoot: string, exportName: string): Promise<WorldProject> {
  const abs = path.resolve(import.meta.dirname, '../../../..', relFromRepoRoot);
  const mod = await vi.importActual<Record<string, unknown>>(abs);
  return mod[exportName] as WorldProject;
}

describe('H1 — world-forge browser-safe contentHash equals engine computeContentHash (Node equivalence)', () => {
  it('SIM_AFFECTING_KEYS matches the engine gate list (12 keys)', () => {
    expect([...SIM_AFFECTING_KEYS]).toEqual([...ENGINE_SIM_AFFECTING_KEYS]);
  });

  it('empty project (smallest valid WorldProject) produces an identical digest to the engine hasher', () => {
    const empty = createSmallestValidWorldProject();
    expect(validateProject(empty).valid).toBe(true);
    const exported = exportToEngine(empty);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('export failed');
    const engineHash = computeEngineContentHash(exported.contentPack as unknown as EngineContentPack);
    expect(computeContentHash(exported.contentPack)).toBe(engineHash);
    expect(exported.manifest.contentHash).toBe(engineHash);
  });

  it('vocabulary-coverage fixture produces an identical digest to the engine hasher', () => {
    const exported = exportToEngine(vocabularyCoverageProject);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('export failed');
    const engineHash = computeEngineContentHash(exported.contentPack as unknown as EngineContentPack);
    expect(computeContentHash(exported.contentPack)).toBe(engineHash);
    expect(exported.manifest.contentHash).toBe(engineHash);
  });

  it('dogfood multi-target-proof world produces an identical digest to the engine hasher', async () => {
    const proofProject = await loadDogfoodProject('dogfood/worlds/multi-target-proof.ts', 'proofProject');
    const exported = exportToEngine(proofProject);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('export failed');
    const engineHash = computeEngineContentHash(exported.contentPack as unknown as EngineContentPack);
    expect(computeContentHash(exported.contentPack)).toBe(engineHash);
    expect(exported.manifest.contentHash).toBe(engineHash);
  });

  it('dogfood salt-road world produces an identical digest to the engine hasher', async () => {
    const saltRoadProject = await loadDogfoodProject('dogfood/worlds/salt-road.ts', 'saltRoadProject');
    const scaleMod = await vi.importActual<{ scaleForSandbox: (p: WorldProject) => WorldProject }>(
      path.resolve(import.meta.dirname, '../../../../dogfood/worlds/sandbox-scale.ts'),
    );
    const scaled = scaleMod.scaleForSandbox(saltRoadProject);
    const exported = exportToEngine(scaled);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('export failed');
    const engineHash = computeEngineContentHash(exported.contentPack as unknown as EngineContentPack);
    expect(computeContentHash(exported.contentPack)).toBe(engineHash);
    expect(exported.manifest.contentHash).toBe(engineHash);
  });
});

describe('AI RPG encounterType list pinned to engine ENCOUNTER_ANCHOR_TYPES', () => {
  it('AI_RPG_ENCOUNTER_ANCHOR_TYPES in schema (and re-exported by export-ai-rpg) matches ENCOUNTER_ANCHOR_TYPES from @ai-rpg-engine/content-schema', () => {
    expect(AI_RPG_ENCOUNTER_ANCHOR_TYPES).toBe(SCHEMA_AI_RPG_ENCOUNTER_ANCHOR_TYPES);
    expect([...SCHEMA_AI_RPG_ENCOUNTER_ANCHOR_TYPES]).toEqual([...ENCOUNTER_ANCHOR_TYPES]);
  });

  it('listAiRpgEncounterBlockers flags non-engine encounter types by anchor id and names the four valid types', () => {
    const empty = createSmallestValidWorldProject();
    const blockers = listAiRpgEncounterBlockers({
      encounterAnchors: [
        { id: 'enc-ok', zoneId: empty.zones[0].id, encounterType: 'patrol', enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
        { id: 'enc-bad', zoneId: empty.zones[0].id, encounterType: 'combat', enemyIds: [], probability: 0.5, cooldownTurns: 1, tags: [] },
      ],
    });
    expect(blockers).toHaveLength(1);
    expect(blockers[0].anchorId).toBe('enc-bad');
    expect(blockers[0].encounterType).toBe('combat');
    expect(blockers[0].validTypes).toEqual([...ENCOUNTER_ANCHOR_TYPES]);
    expect(blockers[0].message).toContain('enc-bad');
    for (const valid of ENCOUNTER_ANCHOR_TYPES) {
      expect(blockers[0].message).toContain(valid);
    }
  });
});

describe('3.12.2 content-hash decision — browser-safe twin stays standalone and pinned', () => {
  it('content-schema@3.12.2 exports computeContentHash, gate, intake, and schema lists, while src/content-hash.ts avoids node:crypto and @ai-rpg-engine imports', () => {
    expect(typeof computeEngineContentHash).toBe('function');
    expect(typeof runLoadGate).toBe('function');
    expect(typeof applyContentPack).toBe('function');
    expect(Array.isArray(ALLOWED_PACK_KEYS)).toBe(true);
    expect(ALLOWED_PACK_KEYS).toContain('strongholds');
    expect(Array.isArray(ENGINE_SIM_AFFECTING_KEYS)).toBe(true);
    expect(ENGINE_SIM_AFFECTING_KEYS).toHaveLength(12);
    expect(typeof EVALUATED_NOT_MAPPED_KEYS).toBe('object');
    expect(Array.isArray(ENCOUNTER_ANCHOR_TYPES)).toBe(true);

    const contentHashSrc = fs.readFileSync(
      path.resolve(import.meta.dirname, '../content-hash.ts'),
      'utf-8',
    );
    expect(contentHashSrc).not.toMatch(/from\s+['"]node:crypto['"]/);
    expect(contentHashSrc).not.toMatch(/from\s+['"]@ai-rpg-engine\//);
  });
});
