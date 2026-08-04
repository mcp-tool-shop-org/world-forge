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
// ⚠ WHERE THE REAL RESOLUTION HAPPENS — CHANGED 2026-07-29 by the engine-deps
// errand. This header used to read: "this repo's `@ai-rpg-engine/*` dependencies
// are installed at 2.0.1 / 2.1.0 / 2.0.2 while the engine ships 3.8.0 — that is
// C0's version-skew checklist item 1, still open… So this file CANNOT boot a
// 3.8.0 engine to resolve ids against." Item 1 is closed. It can.
//
// The split now:
//   - HERE, structural: no phantom is back, the near-misses point at their real
//     counterparts, the version claim is a range. These need no engine and hold
//     even if a boot is impossible.
//   - HERE, live (the last describe block): a real published starter is booted
//     and every id this exporter emits is resolved against its ModuleManager.
//   - IN THE ENGINE REPO (`packages/cli/src/c1-gate.test.ts`, the "C1/P2 — the
//     forge export, gated live" block): the same resolution over the committed
//     forge manifest, plus the full four-check load gate.
//
// The engine-side half is NOT redundant and is NOT demoted. It resolves against
// the engine's own unreleased `main`; this half resolves against what a consumer
// installing from npm actually gets. Those are different engines, and an id that
// resolves in one and not the other is a fact worth failing over. What this half
// removes is the reason the check could only live over there.
//
// (The old header also pointed at `c1-forge-manifest.test.ts`, a file that does
// not exist — the checks landed in `c1-gate.test.ts`. Corrected while rewriting,
// and noted rather than silently fixed: a cross-repo pointer nobody follows is
// how the DEFAULT_MODULES comment rotted in the first place.)

import { describe, it, expect } from 'vitest';
import { createGame } from '@ai-rpg-engine/starter-fantasy';
import {
  DEFAULT_MODULES,
  ENGINE_VERSION_RANGE,
  RETIRED_PHANTOM_MODULES,
  convertManifest,
  convertPackMeta,
} from '../convert-pack.js';
import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

/** Module ids a real booted engine registered. The ground truth, not a list. */
function registeredModuleIds(): string[] {
  return createGame(71).moduleManager.getModules().map((m) => m.id);
}

// F-f216da1a (swarm wave-4): minimalProject (as its name promises) authors
// ZERO craftingStations, so it no longer emits all twelve DEFAULT_MODULES —
// convertManifest now drops 'crafting-core' when there is no crafting
// content for that module to act on (see convert-pack.ts's doc comment).
// The tests below that need to see the FULL twelve-module list use this
// variant instead, which authors exactly one station.
const projectWithCraftingStation: WorldProject = {
  ...minimalProject,
  craftingStations: [
    { id: 'station-test', zoneId: minimalProject.zones[0].id, stationType: 'anvil', availableRecipes: [] },
  ],
};

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

  it('the manifest actually emits this list — when the project has crafting content', () => {
    expect(convertManifest(projectWithCraftingStation).modules).toEqual(DEFAULT_MODULES);
  });

  it("F-f216da1a: 'crafting-core' is dropped when the project authors no crafting stations", () => {
    // minimalProject is the REQUIRED (not optional) craftingStations field at
    // its emptiest — the exact shape that used to still ship a manifest
    // claiming the crafting module was active with nothing behind it.
    expect(minimalProject.craftingStations).toEqual([]);
    const modules = convertManifest(minimalProject).modules;
    expect(modules).not.toContain('crafting-core');
    expect(modules).toEqual(DEFAULT_MODULES.filter((m) => m !== 'crafting-core'));
    // Every OTHER module id is untouched — this finding narrows exactly one
    // id, not the whole list.
    expect(modules).toHaveLength(DEFAULT_MODULES.length - 1);
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

// --- Live resolution against a real booted engine -------------------------

describe('engine deps 3.x — every emitted module id resolves against a real boot', () => {
  it('boots a published starter and registers modules — the probe works at all', () => {
    // The precondition for everything below, asserted rather than assumed. If
    // the boot ever silently produced an empty registry, the resolution test
    // would fail in a way that reads like phantom ids returning, and the next
    // reader would go looking in convert-pack.ts for a bug that is not there.
    const ids = registeredModuleIds();
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size, 'the registry returned duplicate ids').toBe(ids.length);
  });

  it('all twelve ids the manifest emits are real modules on a booted engine', () => {
    // The check EB-011 asked a human to perform and C0 measured the cost of
    // skipping: nine of eighteen ids named nothing, and rode along in every
    // manifest this exporter ever wrote because manifest validation checked
    // that `modules` was an array of strings and never resolved an id.
    //
    // F-f216da1a (swarm wave-4): uses projectWithCraftingStation, not
    // minimalProject, so this test keeps proving what it always proved — ALL
    // TWELVE ids resolve — now that minimalProject itself only emits eleven.
    const registered = new Set(registeredModuleIds());
    const modules = convertManifest(projectWithCraftingStation).modules;
    expect(modules).toEqual(DEFAULT_MODULES);
    const unresolved = modules.filter((id) => !registered.has(id));
    expect(unresolved, `unresolved module ids: ${unresolved.join(', ')}`).toEqual([]);
    expect(DEFAULT_MODULES).toHaveLength(12);
  });

  it('and the nine retired phantoms resolve against nothing — the check discriminates', () => {
    // The RED control. A resolution test that has only ever passed proves the
    // ids are plausible, not that the resolver can say no. These nine are the
    // exact strings that used to ship, so this is the real historical input.
    const registered = new Set(registeredModuleIds());
    const stillPhantom = Object.keys(RETIRED_PHANTOM_MODULES).filter((id) => !registered.has(id));
    expect(stillPhantom).toHaveLength(9);
  });

  it('each near-miss resolves where the name it replaced does not', () => {
    // movement-core → traversal-core and the other two, checked as PAIRS
    // against the live registry rather than against the mapping table. The
    // table asserting itself is what the structural block above already does.
    const registered = new Set(registeredModuleIds());
    for (const [phantom, replacement] of Object.entries(RETIRED_PHANTOM_MODULES)) {
      if (replacement === null) continue;
      expect(registered.has(replacement), `${replacement} should be real`).toBe(true);
      expect(registered.has(phantom), `${phantom} should not be`).toBe(false);
    }
  });
});
