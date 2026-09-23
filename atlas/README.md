# world-forge: how it works

Mapped at 2026-09-23 from commit b6fa56a.

## What this is

15 parts. Work enters through 3 doors; the busiest is CI, which reaches 10 parts.

## What changed since the last map

This is the first map.

## What comes in

1. **CI.** On a pull request; on a push; or by hand. Runs scripts/check-pack.mjs, scripts/sync-version.mjs, dogfood/ and 7 more.
2. **Release.** When a release is published. Runs scripts/sync-version.mjs, dogfood/, e2e/ and 6 more.
3. **Deploy site to GitHub Pages.** On a push to main touching 3 paths; when a release is published; or by hand. Runs no file this map can see.

## What happens through CI

1. The workflow runs dogfood/ in dogfood, e2e/ in e2e, packages/editor/src/ in editor, packages/export-ai-rpg/src/ in export-ai-rpg, packages/export-godot/src/ in export-godot, packages/export-unreal/src/ in export-unreal, packages/renderer-2d/src/ in renderer-2d, packages/schema/src/ in schema, and scripts/check-pack.mjs and scripts/sync-version.mjs in scripts.
2. That reaches the repository root (1 file).
3. It writes to README.md and dogfood/.

## Who reads the results

- **README.md** is read by the repository root (7 README files), editor (8 files), export-ai-rpg (8 files), packages/export-godot/package.json (found by text), packages/export-unreal/package.json (found by text), renderer-2d (8 files), schema (8 files) and scripts/check-pack.mjs.
- **dogfood/** is read by scripts/run-proofs.mjs.

## The other doors

**Release** runs scripts/sync-version.mjs, dogfood/, e2e/ and 6 more, reaches the repository root, and writes to README.md and dogfood/.

**Deploy site to GitHub Pages** runs no file this map can see and deploys the site.

## What breaks what

- **schema** is imported by 7 parts (dogfood, e2e, editor, export-ai-rpg, export-godot, export-unreal, renderer-2d) and sits on the path of 2 doors.
- **export-ai-rpg** is imported by 2 parts (dogfood, editor) and sits on the path of 2 doors.
- **export-godot** is imported by 2 parts (dogfood, editor) and sits on the path of 2 doors.
- **export-unreal** is imported by 2 parts (dogfood, editor) and sits on the path of 2 doors.
- **the repository root** is imported by 1 part (site), and by 1 more only from tests; it sits on the path of 2 doors.
- **dogfood** is imported by no other part and sits on the path of 2 doors.
- **e2e** is imported by no other part and sits on the path of 2 doors.
- **README.md** is written by scripts and read by scripts; a hand edit reaches every reader.

## What tends to change together

- **packages/export-godot/src/export.ts** and **packages/export-godot/src/index.ts** changed together in 12 of 16 commits, inside the export-godot part.
- **packages/export-unreal/src/export.ts** and **packages/export-unreal/src/index.ts** changed together in 5 of 7 commits, inside the export-unreal part.
- **packages/schema/src/index.ts** and **packages/schema/src/project.ts** changed together in 7 of 10 commits, inside the schema part.
- **packages/export-unreal/src/__tests__/export.test.ts** and **packages/export-unreal/src/import.ts** changed together in 8 of 12 commits, inside the export-unreal part.
- **packages/schema/src/index.ts** and **packages/schema/src/spatial.ts** changed together in 7 of 11 commits, inside the schema part.

5 files changed together with their own tests, as expected.

Confidence is low: fewer than 20 source files reach 10 revisions in the window.

Window: 180 days; a pair counts from 3 shared commits.

## What no test touches

Every code part is imported by at least one test.

## Written but never read

Every written place has a reader.

## Helpers that look duplicated

These are candidates from names and call order, not a judgement.

- **buildFidelityReport** is exported by 3 parts (export-ai-rpg, export-godot and export-unreal); with the same name in this many parts it is most likely a shared contract, not a copy.
- **collectDroppedFieldFidelity** is exported by packages/export-godot/src/field-coverage.ts (export-godot) and packages/export-unreal/src/field-coverage.ts (export-unreal); the two look alike.
- **compareSemVer** is exported by packages/export-godot/src/migrations.ts (export-godot) and packages/export-unreal/src/migrations.ts (export-unreal); the two look alike.
- **convertConnections** is exported by 3 parts (export-ai-rpg, export-godot and export-unreal); with the same name in this many parts it is most likely a shared contract, not a copy.
- **convertDialogues** is exported by packages/export-ai-rpg/src/convert-dialogues.ts (export-ai-rpg) and packages/export-godot/src/convert-dialogues.ts (export-godot); the two look alike.

And 16 more candidates.

## Generated, never hand-edited

- **README.md** is written by scripts/sync-version.mjs.
- **dogfood/** is written by dogfood (6 files) and e2e/write-chapel-fixture.ts.

## Hand-authored

People write .claude/, .github/, assets/, docs/ and site/. Nothing in this repository writes to them.

## Where to start

.github/workflows/ci.yml → packages/editor/src/ → playwright.config.ts → README.md → scripts/check-pack.mjs

Read those in order to follow one pull request end to end.

## What this map cannot see

- 4 writes and 18 reads use paths built at run time and are not named here.
- Readers marked (found by text) come from scanning unparsed files.
- Statistics confidence is low: fewer than 20 source files reach 10 revisions in the window.

Regenerate with `npx --yes @dogfood-lab/atlas map`.
