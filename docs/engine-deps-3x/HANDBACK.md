# HANDBACK — world-forge engine deps 2.x → 3.x (2026-07-29)

Short, because this was an errand. Two PRs open and unmerged, advisor gate.

| | |
|---|---|
| world-forge | [PR #33](https://github.com/mcp-tool-shop-org/world-forge/pull/33), branch `chore/engine-deps-3x`, 5 commits off `86e54f1` |
| ai-rpg-engine | [PR #15](https://github.com/mcp-tool-shop-org/ai-rpg-engine/pull/15), branch `chore/engine-deps-3x-pin-flip`, 1 commit off `00001de` |
| Suites | forge **133 files / 2413 tests** (was 132 / 2403) · engine **338 / 6684**, unchanged |
| Publishes / tags / bumps | **none** |

Merge order: world-forge first. The engine PR only *describes* what the forge
PR does.

## The four scope items

**§1.1 — six ranges bumped. DONE, and it was uneventful in a way worth
recording.** All six declare `^3.8.0` and all six resolve 3.8.0. Zero source
changes, zero fixture churn, suite green on the first run. C1 had already
repaired everything the major boundary actually moved forge-side; the rest of
the 3.x surface either did not change or was widened.

Two things not to repeat:

- The lockfile was regenerated **surgically**. A full
  `rm package-lock.json && npm install` also bumped 94 unrelated packages
  (pixi.js 8.16→8.19, react 19.2.4→19.2.8, playwright 1.59→1.62,
  `parse-svg-path` 0.1.2→0.2.0 — a 0.x minor, i.e. a major). Stripping the seven
  `@ai-rpg-engine` entries and re-resolving only those changed **7 of 229**.
- ⚠ The first `npm install` produced an **incoherent tree that looked fine in
  the diff**. npm resolved the direct deps to 3.8.0 and kept the 2.x copies it
  already had for the transitive `*` ranges, so `content-schema@3.8.0` sat on
  `core@2.0.1`. `npm ls` said so; the lockfile diff did not. There is now an
  assertion for resolved versions separate from declared ranges.

**§1.2 — the hash de-duplication. ⚠ ANDON, not done.**

The premise was wrong, and it was wrong before this errand started. `content-hash.ts`
said it existed because "2.x has no such export, so importing it is a dependency
bump, not an import." The bump happened; the import is still impossible.
`computeContentHash` lives in `content-schema/src/gate.ts`, which **C1 added to
engine `main` and which has never been published**. npm `latest` is 3.8.0,
published 2026-03-07 — months before C1. Installed all 26 published 3.8.0
packages and grepped: zero hits for `computeContentHash`, `runLoadGate`,
`applyContentPack`. **The blocker is a release, not a range.**

Consequences, all recorded rather than worked around:

- `content-hash.ts` stays; its header now carries the measured reason.
- The engine-side cross-repo equivalence test is **not retired**. Retiring it was
  justified by "one shared function makes it a tautology" — there is no shared
  function.
- `GameManifest.contentHash` is the same gap (added by engine `bf496e7`,
  unpublished), so `export.ts` still intersects the field in locally.
- All three are **pinned to fail when a release lifts the block**, not left to
  memory: a runtime pin in `engine-deps-3x.test.ts` and a type-level pin that
  breaks `npm run build`.

**§1.3 — forge-side live module resolution. DONE, and cheap.** One devDep
(`@ai-rpg-engine/starter-fantasy`, one package, 19 lockfile lines, no transitive
additions) and four checks in `c1-manifest-truth.test.ts`: boot a published
starter, read its `ModuleManager`, resolve all twelve emitted ids. Inside the
stated budget, so no ANDON.

The engine-side check is **not** demoted. It resolves against the engine's
unreleased `main`; this resolves against what `npm install` hands a consumer.
Those are two different engines right now — see §1.2 — so an id resolving in one
and not the other is a fact worth failing over.

**§1.4 — `ENGINE_CONTRACT.md` rewritten.** Every claim re-measured against the
installed 3.8.0 `.d.ts` files and a booted engine. Checklist now **5 closed, 3
open**, matching `version-skew.json` exactly. Item 8 is a **standing release
note**, not a bump.

**§1.5 — pins flipped**, engine and forge. Detail in the two PR bodies.

## What the advisor should look at

1. **Engine-side scope.** The brief said "keep it to the flip" and named item 1.
   I flipped **four** items (1, 7 mine; 2, 3 closed by C1 and never flipped),
   because leaving them would have regenerated a `version-skew.json` I knew was
   wrong while `c1-gate.test.ts` two directories over already asserted the
   opposite. If that reads as over-reach, items 2 and 3 revert cleanly on their
   own. Everything else engine-side is comment corrections in the same file plus
   a dated addendum to C0's REPORT. **No production code touched.**

2. **⚠ `GENRE_MAP` (checklist item 4) — ANDON, routed to C3.** 3.x added
   `mercantile` and `pursuit`. Two identity entries *look* mechanical. They are
   not: the forge has **three genre vocabularies that already disagree** — a free
   `string` in the schema, six fixed options in the editor picker
   (`SaveTemplateModal.tsx:12`, matching neither list), eleven `GENRE_MAP` keys
   onto nine targets. Mapping two strings the editor cannot author is half a fix.
   Which layer owns genre is a C3 question.

3. **A one-directional guard, now labelled.** `convert-items.ts` types its slot
   and rarity sets off `ItemDefinition` and then writes the members as literals.
   The engine **removing** one breaks the build; the engine **adding** one is
   silently omitted — the same shape as the `GENRE_MAP` gap. Deriving both from
   `EQUIPMENT_SLOTS` / `ITEM_RARITIES` closes it. Not done: out of scope, and it
   deserves its own change.

4. **Recorded, deliberately not acted on.** `@ai-rpg-engine/character-creation`
   is a declared dependency nothing imports (dropping it is consumer-visible);
   `convert-pack.ts:5` imports `VALID_GENRES` / `VALID_TONES` /
   `VALID_DIFFICULTIES` type-only and never uses them — which is the ready-made
   handle for the drift guard item 4 will want.

## Errors worth carrying

- **I proved the type pin fails.** Injected `contentHash?: string` into the
  installed `core/dist/types.d.ts`, rebuilt, got the intended `TS2322` naming
  the fix, then restored with `npm ci` and confirmed zero residue. A pin that has
  never fired is a comment with extra syntax.
- **The positive control caught me.** Every assertion in the ANDON block is an
  absence, and a broken import looks identical to one — so it opens by proving
  the probe can see an export. That control **failed on first run**: I had
  guessed the export name. It is the only reason I know the block discriminates.
- **Two files pointed at `packages/cli/src/c1-forge-manifest.test.ts`, which
  does not exist.** The checks are in `c1-gate.test.ts`. Corrected with a note
  rather than silently — a cross-repo pointer nobody follows is exactly how the
  EB-011 comment rotted into nine phantom module ids.

## Compensators — nothing beyond the authorised table

| Action | Undo |
|---|---|
| `chore/engine-deps-3x` (world-forge) | `git push origin --delete chore/engine-deps-3x` |
| `chore/engine-deps-3x-pin-flip` (ai-rpg-engine) | `git push origin --delete chore/engine-deps-3x-pin-flip` |
| PR #33 / PR #15 | `gh pr close` — both unmerged |
| Any commit | `git revert` per slice; each is independently revertible |

No publish, no tag, no version bump, no deploy, no deletion.
