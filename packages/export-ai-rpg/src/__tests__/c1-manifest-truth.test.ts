// c1-manifest-truth.test.ts — the manifest tells the truth, and a TEST says so.
//
// C0's version-skew finding, in one sentence: nine of the eighteen module ids
// this exporter wrote into every manifest did not exist in the engine, and
// nothing caught it, because manifest validation checked that `modules` was an
// array of strings and never resolved an id
// (ai-rpg-engine/docs/c0-alignment/REPORT.md §5, item 3).
//
// The mechanism that was supposed to prevent it was a COMMENT: "EB-011:
// DEFAULT_MODULES must stay in sync with the engine module registry. When the
// engine adds or removes core modules, update this list to match." A comment
// asking a human to remember is not a synchronisation mechanism. This file is
// the mechanism.
//
// ⚠ WHERE THE REAL RESOLUTION HAPPENS, and why it is not here. This repo's
// `@ai-rpg-engine/*` dependencies are installed at 2.0.1 / 2.1.0 / 2.0.2 while
// the engine ships 3.8.0 — that is C0's version-skew checklist item 1, still
// open, and bumping six dependency ranges is not something C1 does on the way
// past (the same ANDON that kept the fidelity fix small). So this file CANNOT
// boot a 3.8.0 engine to resolve ids against.
//
// The split, therefore:
//   - HERE: structural checks that need no engine — no phantom is back, the
//     near-misses point at their real counterparts, the version claim is a range.
//   - IN THE ENGINE REPO (`packages/cli/src/c1-forge-manifest.test.ts`): the
//     LIVE resolution, where a real booted engine's ModuleManager is available
//     and every id this exporter emits is resolved against it.
//
// That is the same two-repo shape C0's own audit used, and it puts the decisive
// check in the only repo that can actually make it. Neither half is claimed to
// be the other.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MODULES,
  ENGINE_VERSION_RANGE,
  RETIRED_PHANTOM_MODULES,
  convertManifest,
  convertPackMeta,
} from '../convert-pack.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

describe('C1/P2 — DEFAULT_MODULES carries no phantoms', () => {
  it('the list shrank from 18 to 12, and every removal is accounted for', () => {
    expect(DEFAULT_MODULES).toHaveLength(12);
    expect(Object.keys(RETIRED_PHANTOM_MODULES)).toHaveLength(9);
    // 18 = 12 kept + 9 retired − 3 near-misses that came back under a real name.
    const remapped = Object.values(RETIRED_PHANTOM_MODULES).filter((v) => v !== null);
    expect(remapped).toHaveLength(3);
    expect(DEFAULT_MODULES.length + Object.keys(RETIRED_PHANTOM_MODULES).length - remapped.length).toBe(18);
  });

  it('none of the nine phantoms is back', () => {
    // Named explicitly rather than derived, because these are the specific ids
    // that shipped in every manifest this exporter ever wrote.
    for (const phantom of Object.keys(RETIRED_PHANTOM_MODULES)) {
      expect(DEFAULT_MODULES, `${phantom} is a phantom and must not return`).not.toContain(phantom);
    }
  });

  it('the three near-misses are replaced by their real counterparts', () => {
    // movement-core → traversal-core, npc-ai-core → cognition-core,
    // rumor-core → rumor-propagation. These are why the old list read plausible:
    // each named a real capability under a name the engine does not use.
    expect(RETIRED_PHANTOM_MODULES['movement-core']).toBe('traversal-core');
    expect(RETIRED_PHANTOM_MODULES['npc-ai-core']).toBe('cognition-core');
    expect(RETIRED_PHANTOM_MODULES['rumor-core']).toBe('rumor-propagation');
    for (const replacement of Object.values(RETIRED_PHANTOM_MODULES)) {
      if (replacement === null) continue;
      expect(DEFAULT_MODULES).toContain(replacement);
    }
  });

  it('the six pure phantoms are named, and none is silently re-invented', () => {
    const pure = Object.entries(RETIRED_PHANTOM_MODULES).filter(([, v]) => v === null).map(([k]) => k);
    expect(pure.sort()).toEqual([
      'arc-core', 'endgame-core', 'faction-core', 'leverage-core', 'pressure-core', 'relationship-core',
    ]);
    // `pressure` in particular has no module id under ANY name — pressure-system.ts
    // is a source file that registers none. C0's ledger entry 8 records getting
    // this wrong once already, by naming a FILE as a module's near-miss.
    expect(DEFAULT_MODULES.some((id) => id.startsWith('pressure'))).toBe(false);
  });

  it('every id is well-formed and the list has no duplicates', () => {
    for (const id of DEFAULT_MODULES) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(new Set(DEFAULT_MODULES).size).toBe(DEFAULT_MODULES.length);
  });

  it('the manifest actually emits this list', () => {
    expect(convertManifest(minimalProject).modules).toEqual(DEFAULT_MODULES);
  });
});

describe('C1/P2 — the manifest carries a checkable version claim', () => {
  it('engineVersion is a RANGE, not the stale 2.0.0 literal', () => {
    const manifest = convertManifest(minimalProject);
    expect(manifest.engineVersion).toBe(ENGINE_VERSION_RANGE);
    expect(manifest.engineVersion).not.toBe('2.0.0');
    // A range has an operator; a bare version does not. This is the property the
    // engine's gate reads — a bare version is accepted as an exact match and
    // advised against, which is precisely how '2.0.0' hid against a 3.8.0 engine.
    expect(/[<>=^~]/.test(manifest.engineVersion)).toBe(true);
  });

  it('pack metadata carries the same range — it had the identical stale literal', () => {
    const meta = convertPackMeta(minimalProject);
    expect(meta.engineVersion).toBe(ENGINE_VERSION_RANGE);
  });

  it('the range is well-formed and bounded on both sides', () => {
    // An unbounded range ('>=3.8.0') would admit a future 4.x that breaks the
    // contract — the Minecraft pack_format lesson in the other direction. A
    // range that admits everything is the same non-claim as a comment.
    expect(ENGINE_VERSION_RANGE).toMatch(/>=\d+\.\d+\.\d+/);
    expect(ENGINE_VERSION_RANGE).toMatch(/<\d+\.\d+\.\d+/);
  });
});
