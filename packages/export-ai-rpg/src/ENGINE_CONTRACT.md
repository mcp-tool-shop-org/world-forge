# ai-rpg-engine — Engine API Contract

This exporter depends on the **ai-rpg-engine 3.x** API and its dependency
ranges say so: all six `@ai-rpg-engine/*` ranges are `^3.8.0`.

They were `^2.x` from the engine's 3.0.0 release until 2026-07-29, through
eight minor releases, because the checklist below said "work through these
items *before* bumping the ranges" and nobody did. The order was backwards.
Bumping first is what makes the drift visible; leaving the ranges behind is
what let nine nonexistent module ids ship in every manifest this exporter
wrote. **When the engine cuts 4.x, bump the ranges first, then work the
checklist against the compiler.**

Everything below was verified against the installed 3.8.0 packages on
2026-07-29 — read off the published `.d.ts` files and a booted engine, not
transcribed from the previous revision.

## The 3.x surface we rely on

Types imported by this package (`import type` in every case — no engine
value is imported at runtime by the production code):

| Type | Package | What we depend on |
|---|---|---|
| `ZoneDefinition`, `EntityBlueprint`, `DialogueDefinition`, `ProgressionTreeDefinition` | `content-schema` | `{ id, name, tags, … }`; no required `version` field per record |
| `GameManifest` | `core` | `id`, `title`, `version`, `engineVersion`, `ruleset`, `modules[]`, `contentPacks[]` |
| `DistrictDefinition` | `modules` | `baseMetrics` keyed `commerce` / `morale` / `stability` / `surveillance` |
| `PackMetadata`, `PackGenre`, `PackTone`, `PackDifficulty` | `pack-registry` | string enums, mapped in `convert-pack.ts` via `TONE_MAP` / `GENRE_MAP` / `DIFFICULTY_MAP` |
| `ItemDefinition` | `equipment` | `slot`: `weapon\|armor\|accessory\|tool\|trinket`; `rarity`: `common\|uncommon\|rare\|legendary` |

Runtime assumptions, as they stand at 3.8.0:

- `GameManifest.engineVersion` carries a **range**, `ENGINE_VERSION_RANGE =
  '>=3.8.0 <4.0.0'` (`convert-pack.ts`), in both the manifest and the pack
  metadata. It used to be the literal `'2.0.0'` in both places. The engine's
  load gate reads it, so it is a checked claim rather than a comment.
- `DEFAULT_MODULES` names twelve modules, every one of which resolves against
  a booted engine. Enforced by a test, not by this sentence — see item 3.
- `DialogueNode.text` is `string | TextBlock[]` (`schemas.d.ts:218`).
  `convert-dialogues.ts` writes a plain string, which the union admits.
- `EntityBlueprint.type` is a bare `string` with no enum and no validation.

Two declarations that are **not** load-bearing and are recorded so the next
reader does not assume they are:

- `@ai-rpg-engine/character-creation` is a declared dependency that nothing
  imports. `convert-build-catalog.ts` builds `ExportedBuildCatalog` from
  `@world-forge/schema` instead. Left in place — dropping a dependency from a
  published package is a consumer-visible change, not errand scope.
- `convert-pack.ts` imports `VALID_GENRES`, `VALID_TONES` and
  `VALID_DIFFICULTIES` as **values**. GENRE_MAP / TONE_MAP / DIFFICULTY_MAP
  identity targets are derived from those arrays (F-0fdda22c), so a newly
  added engine genre cannot sit unmapped.

## Checklist status — the 2.x → 3.x bump

Worked as findings by C0 (`ai-rpg-engine/docs/c0-alignment/version-skew.json`,
7 of 8 open), then closed across C1 and the 2026-07-29 dependency errand.

| # | Item | Status |
|---|---|---|
| 1 | Bump the six `@ai-rpg-engine/*` dep ranges | **CLOSED** (errand, 2026-07-29) |
| 2 | Update hard-coded `engineVersion: '2.0.0'` | **CLOSED** (C1) |
| 3 | Re-verify `DEFAULT_MODULES` against the 3.x registry | **CLOSED** (C1 + errand) |
| 4 | Re-verify `TONE_MAP` / `GENRE_MAP` / `DIFFICULTY_MAP` | **CLOSED** (F-0fdda22c, swarm wave-9) |
| 5 | Re-verify `VALID_ITEM_SLOTS` / `VALID_ITEM_RARITIES` | **CLOSED** (verified 5/5 and 4/4) |
| 6 | Re-verify `ROLE_TO_TYPE` / `ROLE_TAGS` / `ROLE_AI_PROFILE` | **CLOSED as far as it can be** |
| 7 | Run the full suite; update fixtures if shapes changed | **CLOSED** — zero fixture churn |
| 8 | Bump this package's major version | **DEFERRED — release bookkeeping**, see below |

**1 — ranges.** All six at `^3.8.0`, all six resolving 3.8.0.
`__tests__/engine-deps-3x.test.ts` asserts both, separately: a declared range
is not an installed version, and this errand produced a tree where the six
declared ranges were correct while `content-schema@3.8.0` still sat on
`core@2.0.1`.

**2 — engineVersion.** C1 replaced the stale literal with
`ENGINE_VERSION_RANGE` in both places. The `>=` floor is checked against the
declared dep range by `engine-deps-3x.test.ts`, so the two cannot diverge.

**3 — DEFAULT_MODULES.** C1 cut 18 ids to 12: six pure phantoms dropped
(`faction-core`, `leverage-core`, `pressure-core`, `relationship-core`,
`arc-core`, `endgame-core`) and three near-misses remapped
(`movement-core`→`traversal-core`, `npc-ai-core`→`cognition-core`,
`rumor-core`→`rumor-propagation`). The mechanism that failed here was a
comment asking a human to keep two repos in sync; it is now two live checks —
`c1-manifest-truth.test.ts` boots a published starter and resolves all twelve
against its `ModuleManager`, and the engine repo's `c1-gate.test.ts` does the
same against its own `main`. Keep both: they are different engines.

**4 — CLOSED by F-0fdda22c (swarm wave-9).** `TONE_MAP` and `DIFFICULTY_MAP`
already matched `VALID_TONES` / `VALID_DIFFICULTIES`. `GENRE_MAP` identity
targets are now **derived from `VALID_GENRES`**, so `mercantile` and `pursuit`
(and any later 3.x addition) identity-map instead of silently becoming
`'fantasy'`. Unmapped authored genre/difficulty warn the same way tones
already did. The three-vocabulary disagreement (schema free-string vs editor
picker vs engine enum) is unchanged and still a C3 design question — see
`[[2p5d-c3-space-vocabulary-kickoff]]` — but it is no longer a silent
fallback.

**5 — item slots and rarities.** Verified against the 3.8.0 exports:
`EQUIPMENT_SLOTS` 5/5 and `ITEM_RARITIES` 4/4, unchanged across the major —
the only checklist item the 3.x major did not invalidate.

⚠ These lists are guarded in ONE DIRECTION ONLY, which is worth stating
because the type annotation makes them look safer than they are.
`convert-items.ts` declares `Set<ItemDefinition['slot']>` and
`Set<ItemDefinition['rarity']>` and then writes the members as literals. If
the engine REMOVES a slot, a literal stops being assignable and the build
fails. If the engine ADDS one, the literal list is still valid and simply
omits it — silently, exactly the shape of the `GENRE_MAP` gap in item 4.
Deriving both sets from `EQUIPMENT_SLOTS` / `ITEM_RARITIES` (runtime exports
that already exist) would close that direction.

Beneath this item sits a forge-side hole C0 found independently and this
errand did not touch: world-forge's own `ItemSlot` (`schema/src/entities.ts:49`)
has a sixth member, `consumable`, which `narrowSlot` collapses to `trinket`
with no warning and no fidelity entry. That is a forge concern, not an
engine-contract item.

**6 — role maps.** Re-verified, and the verification is the finding: at 3.8.0
`EntityBlueprint.type` is still `type: string` with no enum and no validation
(`schemas.d.ts`), and `aiProfile` is a free string. There is nothing for
`ROLE_TO_TYPE`'s six-roles-onto-two-types collapse to be checked against, so
the item reads clean when what it actually is, is unconstrained. Shipped
starters use `npc` and `enemy` by convention.

**7 — suite and fixtures.** Build clean, 133 files / 2412 tests green, and
**not one fixture changed**. The 2.x note this document used to carry
("Dialogue node `text` is an array of `{ text: string }` blocks on 2.x")
never described what `convert-dialogues.ts` emits — it writes a plain string,
and did so under the 2.x note as well. At 3.8.0 the type is
`string | TextBlock[]`, so the constraint was widened out of existence rather
than satisfied. The pack still disagrees with itself: zone descriptions are
wrapped in `TextBlock` arrays while dialogue text is not.

**8 — major version bump: DEFERRED, deliberately.** `@world-forge/export-ai-rpg`
is versioned with the World Forge monorepo (4.5.0), not against the engine
surface it targets, so there is no engine-facing major to cut on its own.
Retargeting the exporter from 2.x to 3.x IS a breaking change for anyone
resolving this package's engine peers, and the errand that made it had no
authority to publish, tag or bump.

> **STANDING RELEASE NOTE — carry this into the next release of
> `@world-forge/export-ai-rpg`.** This package's `@ai-rpg-engine/*` ranges
> moved 2.x → ^3.8.0 (2026-07-29). Consumers pinning engine 2.x will get a
> duplicated engine in their tree or a resolution failure. The release that
> ships it takes a **major** bump and says so in CHANGELOG.md.

## Known blocker — the duplicated content hash

`src/content-hash.ts` reimplements the engine's `computeContentHash`. This is
a deliberate duplicate and the errand of 2026-07-29 was briefed to delete it
and import the canonical one. **It could not.**

The reasoning everyone had been carrying — "2.x has no such export, so
importing it is a dependency bump" — was wrong. The bump happened and the
import is still impossible: `computeContentHash` lives in
`content-schema/src/gate.ts`, added to engine `main` by C1 (merge `00001de`)
and **never released**. npm's `latest` is 3.8.0, published 2026-07-28, the night
before C1. Verified across all 26 published 3.8.0 packages: no
`computeContentHash`, no `runLoadGate`, no `applyContentPack`.

So the blocker is a **release**, not a range. Until the engine ships the C1
surface:

- `content-hash.ts` stays, and stays byte-compatible with the engine's
  `gate.ts` — including the `undefined`-valued-key filter that makes it agree
  with a JSON round-trip (C1 REPORT §7.6).
- The engine repo's cross-repo equivalence test stays. It was slated for
  retirement here on the reasoning that one shared function makes it a
  tautology; there is no shared function, so it is still the only thing
  between two implementations and a silent divergence.
- `engine-deps-3x.test.ts` fails the moment a published release makes the
  de-duplication possible, and carries the four steps in its own comment.

## When the engine cuts 4.x

Bump the ranges **first** — that is the lesson of the eight releases this
document spent describing an engine that no longer existed. Then work these
against the compiler and the suite:

1. [ ] Bump the six `@ai-rpg-engine/*` ranges, then verify what npm actually
       installed (`npm ls @ai-rpg-engine/core` — one copy, at the new major).
2. [ ] Update `ENGINE_VERSION_RANGE` in `convert-pack.ts`; its floor must
       match the new dep range (`engine-deps-3x.test.ts` asserts this).
3. [ ] Re-run `c1-manifest-truth.test.ts` — the live boot resolves
       `DEFAULT_MODULES` against the new registry and names anything renamed
       or removed.
4. [ ] Re-verify `TONE_MAP` / `GENRE_MAP` / `DIFFICULTY_MAP` against the 4.x
       enums, and close item 4 above if it is still open.
5. [ ] Re-verify `VALID_ITEM_SLOTS` / `VALID_ITEM_RARITIES` in
       `convert-items.ts` (typed off `ItemDefinition`, so the build should
       tell you first).
6. [ ] Re-verify `ROLE_TO_TYPE` / `ROLE_TAGS` / `ROLE_AI_PROFILE` — check
       whether `EntityBlueprint.type` gained an enum, which would make this
       item checkable for the first time.
7. [ ] Run the full suite; update fixtures only if record shapes actually
       changed, and say so if none did.
8. [ ] Major-bump this package at release time and carry the standing note
       above.
