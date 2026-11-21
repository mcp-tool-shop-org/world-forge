# ai-rpg-engine — Engine API Contract

This exporter depends on the **ai-rpg-engine 3.x** API and its dependency
ranges say so: all six `@ai-rpg-engine/*` runtime ranges (plus
`@ai-rpg-engine/starter-fantasy` in `devDependencies`) are `^3.12.2`.

They were `^2.x` from the engine's 3.0.0 release until 2026-07-29, through
eight minor releases, because the checklist below said "work through these
items *before* bumping the ranges" and nobody did. The order was backwards.
Bumping first is what makes the drift visible; leaving the ranges behind is
what let nine nonexistent module ids ship in every manifest this exporter
wrote. **When the engine cuts 4.x, bump the ranges first, then work the
checklist against the compiler.**

Everything below was verified against the installed 3.12.2 packages on
2026-11-21 — read off the published `.d.ts` files and a booted engine.

## The 3.x surface we rely on

Types imported by the browser-safe surface (`import type` in every case — no
engine value is imported at runtime by `src/index.ts` or any converter, while
Node-only `src/engine-gate.ts` builds `createRuntimeValidationHost` from runtime
`@ai-rpg-engine/*` packages for `--validate-only` and contract verification):

| Type | Package | What we depend on |
|---|---|---|
| `ZoneDefinition`, `EntityBlueprint`, `DialogueDefinition`, `ProgressionTreeDefinition` | `content-schema` | `{ id, name, tags, … }`; no required `version` field per record |
| `GameManifest` | `core` | `id`, `title`, `version`, `engineVersion`, `ruleset`, `modules[]`, `contentPacks[]` |
| `DistrictDefinition` | `modules` | `baseMetrics` keyed `commerce` / `morale` / `stability` / `surveillance` |
| `PackMetadata`, `PackGenre`, `PackTone`, `PackDifficulty` | `pack-registry` | string enums, mapped in `convert-pack.ts` via `TONE_MAP` / `GENRE_MAP` / `DIFFICULTY_MAP` |
| `ItemDefinition` | `equipment` | `slot`: `weapon\|armor\|accessory\|tool\|trinket`; `rarity`: `common\|uncommon\|rare\|legendary` |

Runtime assumptions, as they stand at 3.12.2:

- `GameManifest.engineVersion` carries a **range**, `ENGINE_VERSION_RANGE =
  '>=3.12.2 <4.0.0'` (`convert-pack.ts`), in both the manifest and the pack
  metadata. It used to be the literal `'2.0.0'` in both places. The engine's
  load gate reads it, so it is a checked claim rather than a comment.
- The stage moves `ENGINE_REF` and `FORGE_REF` together, so a forge pack is
  always checked against the engine it was built for, and the stage's CI is the
  proof.
- `DEFAULT_MODULES` names twelve modules, every one of which resolves against
  a booted engine. Enforced by a test, not by this sentence — see item 3.
- `DialogueNode.text` is `string | TextBlock[]` (`schemas.d.ts:272` at 3.12.2).
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

**1 — ranges.** All six runtime dependencies and
`@ai-rpg-engine/starter-fantasy` (`devDependencies`) at `^3.12.2`, all seven
resolving `3.12.2`. `__tests__/engine-deps-3x.test.ts` asserts both,
separately: a declared range is not an installed version, and a prior install
produced a tree where declared ranges moved while `content-schema` still sat
on `core@2.0.1`.

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

**5 — item slots and rarities.** Re-verified against installed
`@ai-rpg-engine/equipment@3.12.2` (`types.d.ts:2-6` and runtime exports):
`EQUIPMENT_SLOTS` is still 5/5 (`weapon`, `armor`, `accessory`, `tool`,
`trinket`) and `ITEM_RARITIES` is still 4/4 (`common`, `uncommon`, `rare`,
`legendary`), unchanged across 3.8.0 → 3.12.2.

⚠ These lists are guarded in ONE DIRECTION ONLY, which is worth stating
because the type annotation makes them look safer than they are.
`convert-items.ts` declares `Set<ItemDefinition['slot']>` and
`Set<ItemDefinition['rarity']>` and then writes the members as literals. If
the engine REMOVES a slot, a literal stops being assignable and the build
fails. If the engine ADDS one, the literal list is still valid and simply
omits it — silently, exactly the shape of the `GENRE_MAP` gap in item 4.
Deriving both sets from `EQUIPMENT_SLOTS` / `ITEM_RARITIES` (runtime exports
that already exist) would close that direction.

Note on world-forge's sixth `ItemSlot` member, `consumable`
(`schema/src/entities.ts:49`): `narrowSlot` (`convert-items.ts:37-74`) still
collapses `'consumable'` to `'trinket'`, and since `F-1c1a6e56` it now emits
a warning and an `approximated` fidelity entry (`item-slot-no-engine-target`)
rather than doing so silently.

**6 — role maps.** Re-verified against installed
`@ai-rpg-engine/content-schema@3.12.2` (`schemas.d.ts:2-12` and
`validateEntityBlueprint` in `dist/validate.js`): `EntityBlueprint.type` is
still `type: string` with no enum and no validation, and `aiProfile` is an
optional free string (`resolveEntityAi` / `applyContentPack` resolve it
against supplied profiles at intake). There is nothing for `ROLE_TO_TYPE`'s
six-roles-onto-two-types collapse to be checked against, so the item reads
clean when what it actually is, is unconstrained. Shipped starters use `npc`
and `enemy` by convention.

**7 — suite and fixtures.** Build clean at 3.12.2 (`tsc --build --force`),
and the 3.12.2 alignment run passed 223 files / 3513 tests in CI (the original
2.x → 3.8.0 bump passed 133 files / 2412 tests with zero fixture churn). The
2.x note this document used to carry ("Dialogue node `text` is an array of
`{ text: string }` blocks on 2.x") never described what
`convert-dialogues.ts` emits — it writes a plain string, and did so under
the 2.x note as well. Re-verified at 3.12.2 (`schemas.d.ts:272`):
`DialogueNode.text` is `string | TextBlock[]`, so the union still admits
plain strings while `ZoneDefinition.description` (`schemas.d.ts:203`) is
`TextBlock[]`.

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

## Generated mirror lists & browser-safe content-hash twin

Browser-safe engine constants (`INSTALLED_ENGINE_VERSION`, `ENGINE_VERSION_RANGE`,
`SIM_AFFECTING_KEYS`, `ALLOWED_PACK_KEYS`, `ENCOUNTER_ANCHOR_TYPES`, and
`EVALUATED_NOT_MAPPED_KEYS`) are generated into
`packages/schema/src/generated/engine-lists.ts` by `scripts/gen-engine-lists.mjs`
from the installed `@ai-rpg-engine/content-schema` package and re-exported by
`@world-forge/schema` and `@world-forge/export-ai-rpg` (no hand-kept copies).
CI regenerates that file and fails on `git diff --exit-code`.

`src/content-hash.ts` imports `SIM_AFFECTING_KEYS` from `@world-forge/schema` and
implements `computeContentHash` synchronously as a **deliberate standalone twin**
of `@ai-rpg-engine/content-schema`'s `computeContentHash`.

`@ai-rpg-engine/content-schema@3.12.2` exports `computeContentHash`,
`runLoadGate`, `applyContentPack`, `ALLOWED_PACK_KEYS`, `SIM_AFFECTING_KEYS`,
`EVALUATED_NOT_MAPPED_KEYS`, and `ENCOUNTER_ANCHOR_TYPES`. However, the engine's
`gate.ts` imports `createHash` from `node:crypto`, and `exportToEngine` must
stay browser-safe so editor and web bundles do not pull Node builtins or the
`content-schema` runtime barrel (`__tests__/browser-entry-safety.test.ts` and
`__tests__/f-1d037344-browser-safe-hash.test.ts` assert this).

- `src/content-hash.ts` stays byte-compatible with the engine's `gate.ts` —
  including the `undefined`-valued-key filter that agrees with JSON
  round-trips and exact equality on the 12 `SIM_AFFECTING_KEYS`.
- The engine repo's cross-repo equivalence test (`c1-gate.test.ts`) verifies
  the committed forge fixture from the engine side.
- `__tests__/engine-deps-3x.test.ts` verifies byte-identical digests across four
  worlds and asserts that `src/content-hash.ts` imports `@world-forge/schema`
  rather than `node:crypto` or `@ai-rpg-engine/*`.

## Real load gate (`--validate-only`) and shared runtime host

`world-forge-export --validate-only` runs `validateExportWithEngine`
(`src/engine-gate.ts`), using the single `createRuntimeValidationHost` factory
built strictly from runtime `@ai-rpg-engine/*` dependencies (`core`,
`modules`, `equipment`, `content-schema`). Both CLI `--validate-only` and the
contract tests (`__tests__/engine-contract.test.ts`,
`__tests__/item-placements-contract.test.ts`, and
`dogfood/__tests__/cli-host-parity.test.ts`) run through this factory with a
fresh `Engine` and unique per-world `gameId` (cleaned up via
`unregisterEncounterSpawnContent` and `unregisterTypedHazards` in `finally`).
Unknown top-level project keys are forwarded so `runLoadGate`'s key allowlist
refuses misspelled fields (`ENGINE_LOAD_GATE_REFUSED` / `ENGINE_GATE_KEY_ALLOWLIST`),
`dropped[]` entries are printed verbatim, and intake or encounter blockers exit
non-zero with `ENGINE_INTAKE_REFUSED` or `ENGINE_ENCOUNTER_TYPE_BLOCKED`.

## Weekly within-major engine bump

`.github/workflows/engine-bump.yml` (`schedule` Mondays `07:00 UTC` and
`workflow_dispatch`) runs `scripts/engine-bump.mjs` to check npm for newer
releases within the current major across all `@ai-rpg-engine/*` dependencies,
refreshes `package-lock.json`, regenerates `packages/schema/src/generated/engine-lists.ts`,
runs the structured 31-world check via `dogfood/verify-golden-corpus.ts`, pushes
`chore/engine-bump`, dispatches `ci.yml`, and opens/updates a tracking issue
labelled `engine-bump`. Newer major releases are never bumped automatically and
are reported in the tracking issue instead.

## When the engine cuts 4.x

Bump the ranges **first** — that is the lesson of the eight releases this
document spent describing an engine that no longer existed. Then work these
against the compiler and the suite:

1. [ ] Bump the six `@ai-rpg-engine/*` ranges, then verify what npm actually
       installed (`npm ls @ai-rpg-engine/core` — one copy, at the new major).
2. [ ] Run `node scripts/gen-engine-lists.mjs` to regenerate `ENGINE_VERSION_RANGE`
       and the mirror lists in `packages/schema/src/generated/engine-lists.ts`
       (`engine-deps-3x.test.ts` and `gen-engine-lists.test.ts` assert agreement).
3. [ ] Re-run `c1-manifest-truth.test.ts` and `cli-host-parity.test.ts` — the live boot resolves
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
