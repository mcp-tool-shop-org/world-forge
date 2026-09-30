# world-forge: how it works

Mapped at 2026-09-30 from commit 69358f1 by Atlas 1.24.0.

## What this is

15 parts, mostly TypeScript (497 files), Astro (4), JavaScript (4), CSS (3), GDScript (1) and HTML (1). Work enters through 11 doors; the busiest is CI, which reaches 11 parts. It publishes @world-forge/editor (packages/editor), @world-forge/export-ai-rpg (packages/export-ai-rpg), @world-forge/export-godot (packages/export-godot), @world-forge/export-unreal (packages/export-unreal), @world-forge/renderer-2d (packages/renderer-2d) and @world-forge/schema (packages/schema) to npm. It deploys a site to GitHub Pages. People run world-forge-export, world-forge-export-godot and world-forge-export-unreal. People import @world-forge/export-ai-rpg, @world-forge/export-godot, @world-forge/export-unreal, @world-forge/renderer-2d and @world-forge/schema.

## What changed since 2026-09-23 (b6fa56a)

- site no longer imports the repository root.
- CI now also runs dogfood/__tests__/, packages/editor/src/__tests__/, packages/editor/src/kits/bundle-migrate.test.ts and 58 more.
- CI now also checks dogfood/chapel-threshold-unreal.ts, dogfood/chapel-threshold.ts, dogfood/export-stage-fixture.ts and 6 more.
- CI no longer runs dogfood/.
- And 12 more changes to doors.
- docs/c0-alignment/export-table.json is now written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts.
- docs/c0-alignment/export-table.md is now written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts.
- docs/c0-alignment/fixture-manifest.json is now written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts.
- And 99 more new writers and readers of places.
- docs was authored and is now mixed.
- 1 file added and 633 changed content, across 14 parts.

## What comes in

1. **CI.** On a pull request; on a push; or by hand. Runs scripts/check-pack.mjs, scripts/sync-version.mjs, dogfood/__tests__/ and 211 more; checks dogfood/chapel-threshold-unreal.ts, dogfood/chapel-threshold.ts, dogfood/export-stage-fixture.ts and 475 more.
2. **Release.** When a release is published. Runs scripts/sync-version.mjs, dogfood/__tests__/, packages/editor/src/__tests__/ and 117 more; checks dogfood/chapel-threshold-unreal.ts, dogfood/chapel-threshold.ts, dogfood/export-stage-fixture.ts and 475 more.
3. **Deploy site to GitHub Pages.** On a push to main touching 3 paths; when a release is published; or by hand. On a push to main or by hand, it runs site/astro.config.mjs and site/src/.
4. **@world-forge/export-ai-rpg** (the package people import). Loads packages/export-ai-rpg/src/index.ts.
5. **@world-forge/export-godot** (the package people import). Loads packages/export-godot/src/index.ts.
6. **@world-forge/export-unreal** (the package people import). Loads packages/export-unreal/src/index.ts, packages/export-unreal/src/diff.ts, packages/export-unreal/src/signing.ts and 1 more.
7. **@world-forge/renderer-2d** (the package people import). Loads packages/renderer-2d/src/index.ts.
8. **world-forge-export** (a command people run). Runs packages/export-ai-rpg/src/cli.ts.
9. **world-forge-export-godot** (a command people run). Runs packages/export-godot/src/cli.ts.
10. **world-forge-export-unreal** (a command people run). Runs packages/export-unreal/src/cli.ts.
11. **@world-forge/schema** (the package people import). Loads packages/schema/src/index.ts.

## What happens through CI

1. The workflow runs scripts/check-pack.mjs and scripts/sync-version.mjs in scripts, dogfood/__tests__/ in dogfood, 112 files in editor, 22 files in export-ai-rpg, packages/export-godot/src/__tests__/ in export-godot, and 50 files in 4 more parts; it checks 11 files in dogfood, e2e/ in e2e, packages/editor/src/ in editor, packages/export-ai-rpg/src/ in export-ai-rpg, packages/export-godot/src/ in export-godot, and 108 files in 3 more parts.
2. That reaches the repository root (1 file).
3. It writes to docs/c0-alignment/export-table.json, docs/c0-alignment/export-table.md, docs/c0-alignment/fixture-manifest.json and docs/c0-alignment/fixture-pack.json.
4. It uploads coverage to Codecov.

## Who reads the results

- **docs/c0-alignment/** has no reader in this repository.

## The other doors

**Release** runs scripts/sync-version.mjs, dogfood/__tests__/, packages/editor/src/__tests__/ and 117 more, checks dogfood/chapel-threshold-unreal.ts, dogfood/chapel-threshold.ts, dogfood/export-stage-fixture.ts and 475 more, reaches the repository root, writes to docs/c0-alignment/export-table.json, docs/c0-alignment/export-table.md, docs/c0-alignment/fixture-manifest.json and docs/c0-alignment/fixture-pack.json, publishes @world-forge/editor (packages/editor), @world-forge/export-ai-rpg (packages/export-ai-rpg), @world-forge/export-godot (packages/export-godot), @world-forge/export-unreal (packages/export-unreal), @world-forge/renderer-2d (packages/renderer-2d) and @world-forge/schema (packages/schema) to npm, and uploads dist-tarballs/*.tgz to the release.

**Deploy site to GitHub Pages** runs site/astro.config.mjs and site/src/ on a push to main or by hand, and deploys the site on a push to main or by hand.

**@world-forge/export-ai-rpg** (the package people import) loads packages/export-ai-rpg/src/index.ts and reaches schema.

**@world-forge/export-godot** (the package people import) loads packages/export-godot/src/index.ts and reaches schema.

**@world-forge/export-unreal** (the package people import) loads packages/export-unreal/src/index.ts, packages/export-unreal/src/diff.ts, packages/export-unreal/src/signing.ts and 1 more, and reaches schema.

**@world-forge/renderer-2d** (the package people import) loads packages/renderer-2d/src/index.ts and reaches schema.

**world-forge-export** (a command people run) runs packages/export-ai-rpg/src/cli.ts and reaches schema.

**world-forge-export-godot** (a command people run) runs packages/export-godot/src/cli.ts and reaches schema.

**world-forge-export-unreal** (a command people run) runs packages/export-unreal/src/cli.ts and reaches schema.

**@world-forge/schema** (the package people import) loads packages/schema/src/index.ts.

## What breaks what

- **schema** is imported by 7 parts (dogfood, e2e, editor, export-ai-rpg, export-godot, export-unreal, renderer-2d) and sits on the path of 10 doors.
- **export-ai-rpg** is imported by 2 parts (dogfood, editor) and sits on the path of 4 doors.
- **export-godot** is imported by 2 parts (dogfood, editor) and sits on the path of 4 doors.
- **export-unreal** is imported by 2 parts (dogfood, editor) and sits on the path of 4 doors.
- **renderer-2d** is imported by no other part and sits on the path of 3 doors.
- **the repository root** is imported only from tests, by 1 part (dogfood), and sits on the path of 2 doors.
- **dogfood** is imported by no other part and sits on the path of 2 doors.
- **e2e** is imported by no other part and sits on the path of 2 doors.

## What tends to change together

- **packages/export-godot/src/export.ts** and **packages/export-godot/src/index.ts** changed together in 12 of 16 commits, inside the export-godot part.
- **packages/export-unreal/src/export.ts** and **packages/export-unreal/src/index.ts** changed together in 5 of 7 commits, inside the export-unreal part.
- **packages/schema/src/index.ts** and **packages/schema/src/project.ts** changed together in 7 of 10 commits, inside the schema part.
- **packages/export-unreal/src/__tests__/export.test.ts** and **packages/export-unreal/src/import.ts** changed together in 8 of 12 commits, inside the export-unreal part.
- **packages/schema/src/index.ts** and **packages/schema/src/spatial.ts** changed together in 7 of 11 commits, inside the schema part.

5 files changed together with their own tests, as expected.

Confidence is low: fewer than 25 source files reach 10 revisions in the window.

Window: 180 days; a pair counts from 3 shared commits, since 15 source files reach 10 revisions; the floor rises to 10 when 25 do.

## What no test touches

Every code part is imported by at least one test.

## Written but never read

- **docs/c0-alignment/export-table.json** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test) and read by nothing else in this repository.
- **docs/c0-alignment/export-table.md** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test) and read by nothing else in this repository.
- **docs/c0-alignment/fixture-manifest.json** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test) and read by nothing else in this repository.
- **docs/c0-alignment/fixture-pack.json** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test) and read by nothing else in this repository.
- **dogfood/worlds/multi-target-proof.worldforge.json** is written by dogfood/multi-target-export-proof.ts and read by nothing else in this repository.

## Helpers that look duplicated

These are candidates from names and call order, not a judgement.

- **buildFidelityReport** is exported by 3 parts (export-ai-rpg, export-godot and export-unreal); with the same name in this many parts it is most likely a shared contract, not a copy.
- **collectDroppedFieldFidelity** is exported by packages/export-godot/src/field-coverage.ts (export-godot) and packages/export-unreal/src/field-coverage.ts (export-unreal); the two look alike.
- **compareSemVer** is exported by packages/export-godot/src/migrations.ts (export-godot) and packages/export-unreal/src/migrations.ts (export-unreal); the two look alike.
- **convertConnections** is exported by 3 parts (export-ai-rpg, export-godot and export-unreal); with the same name in this many parts it is most likely a shared contract, not a copy.
- **convertDialogues** is exported by packages/export-ai-rpg/src/convert-dialogues.ts (export-ai-rpg) and packages/export-godot/src/convert-dialogues.ts (export-godot); the two look alike.

And 16 more candidates.

## Generated, never hand-edited

- **README.md** has a block written by scripts/sync-version.mjs when run outside CI.
- **docs/c0-alignment/export-table.json** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test).
- **docs/c0-alignment/export-table.md** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test).
- **docs/c0-alignment/fixture-manifest.json** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test).
- **docs/c0-alignment/fixture-pack.json** is written by packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts (a test).
- **dogfood/worlds/multi-target-proof.worldforge.json** is written by dogfood/multi-target-export-proof.ts.

## Hand-authored

People write .claude/, .github/, assets/ and site/; 3 writes with paths built at run time may land here.

## Where to start

packages/export-ai-rpg/src/cli.ts → packages/schema/src/advisory.ts → packages/schema/src/project.ts → packages/schema/src/spatial.ts → packages/schema/src/visual.ts

Read those in order to follow one run of world-forge-export end to end. This path follows world-forge-export (a command people run) from its entry, since CI runs only tests, scripts that import no code here and checks.

## What this map cannot see

- 9 imports could not be resolved: `dogfood/__tests__/dogfood-runner-exit-codes.test.ts` loads `@ai-rpg-engine/content-schema` when it is installed, which is not declared; `dogfood/godot-smoke/smoke_load_world.gd` imports `res://world.tscn`; `dogfood/run-ai-rpg-smoke.ts` imports `@ai-rpg-engine/content-schema`, which is not declared; and 6 more.
- 3 writes and 3 reads use paths built at run time and are not named here.
- 37 writes go to places this repository does not track, so they are not listed as generated.
- 2 writes and 56 reads go to a path their caller passes, not to this repository.
- 26 writes go to the directory the command is run in (GodotPack/ and UnrealPack/) or a path their caller passes, not to this repository.
- 2 writes go to the directory the command is run in (export/), not to this repository.
- 4 commands are built at run time and not followed.
- Statistics confidence is low: fewer than 25 source files reach 10 revisions in the window.

Regenerate with `npx --yes @dogfood-lab/atlas map`.
