// content-hash.ts — the content hash the engine's load gate verifies.
//
// The engine computes this same hash at load and REFUSES a pack whose content
// does not match the value its manifest records (Factorio's mod-checksum shape;
// Paradox hashes only sim-affecting files so a comment or an asset path does not
// invalidate a save).
//
// ⚠ THIS IS A DELIBERATE DUPLICATE, and duplication across repos is precisely
// the failure C0 documented — `DEFAULT_MODULES` drifted into nine phantom ids
// because a COMMENT asked a human to keep two repos in sync. So the duplication
// is defended two ways:
//
//   1. It cannot be avoided today, but ⚠ NOT for the reason this comment gave
//      until 2026-07-29. The old text read: "the engine exports
//      `computeContentHash` from @ai-rpg-engine/content-schema, but this repo's
//      engine dependencies are installed at 2.x and 2.x has no such export.
//      Importing it is a dependency bump, not an import." The dependency bump
//      has now happened — all six ranges resolve 3.8.0 — and the import is
//      STILL impossible. The measured reason: `computeContentHash` does not
//      exist in any PUBLISHED @ai-rpg-engine package. It lives in
//      `content-schema/src/gate.ts`, which C1 added to engine `main` (merge
//      `00001de`, 2026-07-29) and which has never been released; npm's
//      `latest` is 3.8.0, published 2026-07-28, the night before C1. Grepped
//      across all 26 published 3.8.0 packages: zero hits for
//      `computeContentHash`, `runLoadGate` or `applyContentPack`.
//      So the blocker is a RELEASE, not a range. When the engine publishes the
//      C1 surface, delete this file and import the canonical implementation —
//      `engine-deps-3x.test.ts` fails the moment that becomes possible, so
//      nobody has to remember.
//   2. It is CHECKED, not trusted. The engine repo's
//      `packages/cli/src/c1-gate.test.ts` recomputes the hash of the committed
//      fixture pack with the ENGINE's implementation and asserts it equals the
//      value this implementation stamped into the committed fixture manifest.
//      If the two ever disagree, that test fails — the difference cannot hide.
//      That test was slated for retirement in this errand, on the reasoning
//      that one shared function makes it a tautology. It is NOT retired: there
//      is still no shared function, so it is still the only thing standing
//      between two implementations and a silent divergence.
//
// Any change here must be mirrored in the engine's gate.ts, and the equivalence
// test is what will say so.

import { createHash } from 'node:crypto';

/**
 * The pack keys whose contents can change what the simulation computes.
 *
 * Must stay identical to `SIM_AFFECTING_KEYS` in the engine's gate.ts.
 * Deliberately EXCLUDES `schemaVersion` (metadata) and `buildCatalog` /
 * `progressionTrees` (session-scoped — consumed before a world exists, so they
 * cannot change a simulation).
 */
export const SIM_AFFECTING_KEYS = [
  'entities',
  'zones',
  'dialogues',
  'quests',
  'abilities',
  'statuses',
  'verbs',
  'itemUseEffects',
  'districts',
  // C3/P1 — mirrored from the engine's gate.ts in the same cycle.
  //
  // ⚠ AND THE EQUIVALENCE TEST IS HOW I KNOW. Adding these two keys engine-side
  // turned the engine's `c1-gate.test.ts` cross-repo assertion RED immediately:
  // the engine hashed a pack subset that included `encounterAnchors` while this
  // implementation still did not, so the stamped hash and the computed hash
  // disagreed for byte-identical content. That is precisely the silent
  // divergence the duplication was defended against, caught by the mechanism
  // named in this file's header rather than by review — and it is the concrete
  // argument for NOT retiring that test while two implementations exist.
  'placements',
  'encounterAnchors',
] as const;

/**
 * Deterministic JSON: object keys sorted at every depth, array order preserved.
 * Array order is content, not formatting — reordering zones can change which one
 * a fallback picks — so it is inside the hash on purpose.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const obj = value as Record<string, unknown>;
  // ⚠ `undefined`-valued keys are SKIPPED, matching JSON.stringify. This side
  // hashes an IN-MEMORY pack; the engine hashes the same pack after a JSON
  // round-trip, which drops those keys. Without this filter the two could never
  // agree — the exporter stamped one hash and the loader computed another, for
  // byte-identical content. Caught by the engine's cross-repo equivalence test.
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalize(obj[k])}`)
    .join(',')}}`;
}

/** SHA-256 over the pack's sim-affecting subset. Absent keys are omitted. */
export function computeContentHash(pack: unknown): string {
  const raw = (pack ?? {}) as Record<string, unknown>;
  const subset: Record<string, unknown> = {};
  for (const key of SIM_AFFECTING_KEYS) {
    if (raw[key] !== undefined) subset[key] = raw[key];
  }
  return `sha256:${createHash('sha256').update(canonicalize(subset)).digest('hex')}`;
}
