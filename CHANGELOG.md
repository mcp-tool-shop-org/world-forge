# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [4.4.2]

### Fixed

- Publish workflow: removed `--provenance` flag, fixed stale test fixtures.
- Synced `SCHEMA_VERSION` with package version.

## [Unreleased]

### Fixed — Editor Audit (Phases 14–26)

**@world-forge/editor:**
- **Phase 14 — Error Envelope / Diagnostics:** Unified `ValidationError[]` across all import/export paths. Unreal CLI prints stack trace with `--verbose`.
- **Phase 15 — Backward Compatibility:** Fixed 4 crash risks in import pipelines — old ContentPacks, pre-WorldPartition Unreal packs, and partial project JSON all load gracefully.
- **Phase 17 — Persistence:** Fixed autosave never starting, missing crash recovery on mount, save button not clearing dirty flag. Added `markClean()` store action.
- **Phase 18 — Unsaved Changes:** Added dirty guards to Template Manager (New) and top-bar Load button. All project-opening paths now confirm before discarding unsaved work.
- **Phase 19 — Undo/Redo:** Added descriptive undo labels to all 48 previously-unlabeled `updateProject` calls (factions, pressure hotspots, build catalog, progression trees, assets, dialogues, presets).
- **Phase 24 — Canvas Performance:** O(n²) → O(1) zone lookups in hit-testing, connection-lines, and Canvas draw via `Map<string, Zone>`.
- **Phase 25 — Accessibility:** Modal focus traps (`role="dialog"`, `aria-modal`, Escape-to-close, Tab cycling). ARIA labels on all icon-only buttons. Canvas `role="img"` + `tabIndex`. Screen-reader dirty indicator.
- **Phase 26 — Keyboard Canvas Operations:** Wired 6 tool-switching hotkeys (V/Z/C/E/L/S) that ToolPalette displayed but never connected. Added keyboard accessibility (`tabIndex`, `role="button"`, Enter/Space handlers) to all 8 clickable row types in ObjectListPanel.

**@world-forge/export-unreal:**
- **Phase 14:** Added `errors: ValidationError[]` to `UnrealImportError` (was `errors: string[]`).

**@world-forge/schema:**
- **Phase 14:** Exposed `SCHEMA_VERSION` on `ValidationResult` and `ReviewSnapshot`.

### Fixed — Phase 13 Public API Contract Audit

**All packages:**
- Added `"exports"` map to all 5 public packages. Consumers can no longer deep-import `@world-forge/*/dist/internal-module.js`. Only the barrel `"."` entry point is public.

**@world-forge/export-ai-rpg:**
- Exported 4 missing converters: `convertDialogues`, `convertPlayerTemplate`, `convertBuildCatalog`, `convertProgressionTrees` (Godot/Unreal already exposed all theirs).
- Exported 2 missing types: `ExportedPlayerTemplate`, `ExportedBuildCatalog` (referenced by `ContentPack` but previously un-nameable by consumers).
- Added `fidelity: FidelityReport` to `ExportResult` — now aligned with Unreal and Godot result envelopes.
- Wired `fidelityEntries` through `convertEntities` (previously passed `undefined`).

**@world-forge/export-unreal:**
- Documented Node-only APIs (`signMeta`, `summarizePack`, `diffPacks`) vs browser-safe APIs in barrel JSDoc.

**@world-forge/schema:**
- Exposed `./package.json` subpath export for version introspection consumers.

### Noted — Known API Drift (non-breaking, documented)

| Surface | AI RPG | Unreal | Godot |
|---------|--------|--------|-------|
| ExportError.errors | `ValidationError[]` | `ValidationError[]` | `ValidationError[]` |
| ImportError shape | `{ message: string }` | `{ errors: string[] }` | N/A (no import) |
| ExportResult.fidelity | ✓ (added) | ✓ | ✓ |
| Node-only exports | CLI only | signing + summary + diff | none |

The `ImportError` shape divergence is pre-existing (AI RPG returns a single `message`, Unreal returns `errors: string[]`). Not fixing now — would be a breaking change. Both discriminate on `success: false`.

### Verified — Phase 12 Packaging Dry Run

All 6 packages (`schema`, `export-ai-rpg`, `export-unreal`, `export-godot`, `renderer-2d`, `editor`) verified from tarball in an isolated project:

- **API smoke (17/17):** `validateProject`, `advisoryValidation`, `buildReviewSnapshot`, `scanDependencies`, `exportToEngine`, `importProject`, `exportToUnreal`, `pixelsToUnrealCm`, `exportToGodot`, format constants — all pass from tarball install.
- **CLI smoke:** `world-forge-export --dry-run` and `world-forge-export-unreal --validate-only` both exit 0 with correct output.
- **No missing dist files, no broken exports map, no tarball-only failures.**

## [4.4.0] - 2026-04-23

Star-Freight-driven release. Full 10-phase dogfood swarm: Stage A bug/security pass, Stage B proactive audit, Stage C humanization amend, then a focused feature pass on the Unreal export lane to get the UnrealContentPack contract ready for the `star-freight-ue5` project's future loader plugin.

### Added — Unreal export feature pass

**@world-forge/export-unreal:**
- **Schema versioning + migration framework** (UE-FT-008) — `UNREAL_PACK_FORMAT_VERSION` bumped 1.0.0 → 1.1.0. New `migratePack(meta, targetVersion)` walks a chain of pure migration steps from the pack's recorded FormatVersion to the current version. `importFromUnreal` now migrates-then-dispatches: unknown majors → hard error naming the version; older minors → run through `migratePack`; newer minors → forward-compat warning surfaced via fidelity. Rules in README: major = breaking semantics, minor = additive optional field, patch = docs.
- **Pack signing / integrity hash** (UE-FT-007) — optional `Signature` field on `pack.Meta`: `{ algorithm: 'sha256', value, signedFields: string[] }`. `composeSignedMeta` runs last in `buildMeta` so the hash covers every other built field. FormatVersion is signed to block downgrade attacks. `verifyPackSignature(meta)` exported for loader / CI use; import does NOT auto-verify (opt-in). CLI: `--sign`. No external deps (node `crypto` only).
- **CLI `--summary` and `--diff <prev> <new> [--detailed]`** (UE-FT-005) — `summarizePack` prints zone / entity / landmark / asset counts, FormatVersion, signature status, pack size. `diffPacks` uses sorted-key canonical stringify; reports added / removed / changed per object kind plus FormatVersion delta and Signature state change. `--detailed` lists changed ids.

### Fixed — health pass (Stages A + B + C)

**Schema (@world-forge/schema):**
- SCH-A-001/002 — `VALID_ASSET_KINDS` / `VALID_CONNECTION_KINDS` now derive from a `Record<Kind, true>` lookup (enum drift trap closed, compile-time enforced).
- SCH-A-003 — regression tests guarding 2.5D parallax + skyline asset refs (recurring v4.3.0 orphan-check lesson).
- SCH-A-004 — advisory type coercion on non-string metadata now raises `ValidationError`.
- SCH-B-001 — `SCHEMA_VERSION` exported; `ValidationResult` + `ReviewSnapshot` carry it.
- SCH-B-002 — dialogue reachability emits structured "Unreachable dialogue" errors with ids + fix hint.
- `MODE_LABELS` typed `Record<AuthoringMode, string>` — compile-time exhaustiveness.
- `CanonAdapterError` structured class with gameSlug / kitId context.

**Unreal export (@world-forge/export-unreal):**
- UE-A-001 — unsafe `pack.Meta` cast replaced with `readOptionalPositiveNumber` type guard.
- UE-A-002 — FormatVersion pinned to exported constant via test.
- UE-A-003 — CLI help advertises the pack format version; tests shape-check `pack.json`.
- UE-B-001 — `Promise.allSettled` for zone / district writes with aggregated per-file stderr + non-zero exit on write failure.
- UE-B-002 — progress status lines to stderr so long exports don't look hung.
- UE-B-003 — `UnrealDroppedEntity[]` + `Incomplete` flag on manifest; CLI lists dropped actors with zone id (silent-failure closed).

**AI RPG export + renderer (@world-forge/export-ai-rpg, @world-forge/renderer-2d):**
- AIR-B-002 / AIR-B-003 / AIR-B-009 — validate `exit.targetZoneId`, `factionId`, `spawnPointId`; tagged `UNKNOWN` with named warning.
- AIR-B-007 — drop-tracking in `exportToEngine` with multi-entity / zone summary.
- R2D-A-001 — `zoomLevel` getter guards destroyed state (lifecycle contract).
- R2D-B-002 / R2D-B-003 — `EntityRenderer` + `TileLayerRenderer` aggregate missing-ref warnings (dedup, not flood).

**Editor (@world-forge/editor):**
- ED-B-001 — transactional autosave; human-readable "Local storage is full" on quota failure.
- ED-B-002 — orphaned-encounter repair UI: red "Orphaned encounters" group in `ObjectListPanel` with zone-reassign dropdown and delete, both undoable.
- ED-B-003 — connection line dangling-ref one-time warnings naming missing zones.

**CI / docs / site:**
- INF-A-001 — `pages.yml` setup-node npm cache (cache hits on Pages deploy).
- INF-B-001 — root `package.json` drives README version block (via `scripts/sync-version.mjs` + `prebuild` hook) AND site hero (build-time import). No more manual version bumps across repo at release time.
- INF-B-006 — `timeout-minutes: 20` on all four CI jobs.
- INF-B-009 — `pages.yml` post-deploy curl verifies deploy returned 200 with 5-retry backoff.

### Investigated and reverted

- **ED-A-001** — an initial CRITICAL finding claiming an operator-precedence bug in entity hit-test defaults was investigated and reverted as a false positive. `(ep.gridX ?? zone.gridX + 2)` is intentional: `+2` is a fallback default when `ep.gridX` is undefined, not a universal offset. Landmarks and spawn points use pure absolute `gridX` (no `+2`); entities are the only placement type with optional `gridX`, hence the fallback shape. The would-be "fix" would have visually shifted every explicitly-placed entity by 2 tiles.

### Stats

- **Tests:** 1959 → 2067 (+108).
- **Test files:** 98 → 103.
- **Findings closed:** 9 Stage A CRIT+HIGH, 8 Stage B HIGH, 22 Stage B MED + LOW.
- **Features shipped:** 3 (UE-FT-005, UE-FT-007, UE-FT-008).

### Deferred to v4.5+

INF-B-002 (UE5 handbook page — rolled into v4.4.0 Full Treatment), INF-B-003 (dogfood stdout artifact), INF-B-005 (Node-version matrix on site-build), INF-B-007 (snapshot-diff regression tests), ED-B-005 (CanonAdapter error boundary), ED-B-004 / ED-B-006 / ED-B-007 / ED-B-008 (elevation defaults, hidden-object persistence, tab overflow, autosave startup warning), GO-B-001 (export-godot stub coordinate transform signature).

## [4.3.0] - 2026-04-22

### Added — Feature Pass (2.5D-focused wave)

Dogfood-swarm release. The 2.5D surface shipped end-to-end: schema foundations → editor authoring UI → renderer visualization → UE5 export. Approved scope: 15 features across all 5 packages. Deferred: Quest system, full UE5 loader plugin, Godot exporter.

**Schema (@world-forge/schema):**
- **LootTable** schema — weighted drop pools with `rolls`, per-entry `weight`, optional `quantity` range, `condition`, `rarity`. `ItemPlacement.lootTableId` references a table instead of / in addition to the single-item placement. (SCH-FT-001)
- **SpawnCondition grammar** — `parseSpawnCondition` + `validateSpawnCondition` support `always`, `never`, `random:<p>`, `time:<period>`, `quest:<id>:<stage>`, `faction:<id>:<op><value>`, `level:<op><value>`. Every `EntityPlacement.spawnCondition` now structurally validated. (SCH-FT-003)
- **TransitionEntity** — first-class type for elevators, warps, transporters, cargo lifts, stairwells. `WorldProject.transitions` array. Validated for id uniqueness, valid zone refs, finite duration. (SCH-FT-004)
- **Zone physics overrides** — optional `gravityOverride`, `gravityDirection`, `physicsMode` for platformer / zero-g / aquatic zones. Advisory flags space-mode station zones missing `physicsMode`. (SCH-FT-006)
- **Zone sky + lighting metadata** — optional `skyAtmosphereRef`, `directionalLightYaw`/`Pitch`, `skyLightIntensity`, `timeOfDay` for UE5 Sky Atmosphere / DirectionalLight hints. (UE-FT-002 schema half)
- **Zone collision channel** — optional `collisionType: 'walkable' | 'water' | 'hazard' | 'void' | 'custom'`. (UE-FT-003 schema half)
- +38 new schema tests (235 → 273).

**Editor (@world-forge/editor):**
- **Zone 2.5D editor UI** — the promised full edit form replaces the Stage C read-only preview. Elevation slider + input, elevation range floor/ceiling pair with live validation, parallax layer list editor with asset picker and compact visual preview stack, skyline asset picker. (ED-FT-001)
- **Canvas elevation badge + layer toggle** — zones with elevation data show an inline `+Xm` / `floor→ceiling` badge. New "Show Elevation" layer toggle, persisted to localStorage. (ED-FT-003)
- **Parallax layer preview** — compact stacked tiles below the layer list, depth-sorted, click-to-focus on a row. (ED-FT-004)
- **Multi-zone elevation batch** — "Set elevation for N zone(s)" toolbar action + `set-elevation` Speed Panel action. One atomic undo entry per batch. (ED-FT-005)
- +31 new editor tests.

**Renderer (@world-forge/renderer-2d):**
- **2.5D visualization** on `ZoneOverlayRenderer` — drop shadow (clamped at 8px for +10m) for elevated zones, dark tint overlay for negative elevation, dashed outline when `elevationRange.floor !== ceiling`. New `setShowElevation(enabled)` API. (INF-FT-002)
- **DiagnosticsOverlay** — PixiJS overlay consuming the `getDiagnostics()` API shipped in Stage C. Renders `className`, `childCount`, `destroyed` per renderer. Editor exposes a "Show renderer diagnostics" toggle next to Perf Stats. (INF-FT-003)
- +13 new renderer tests.

**Unreal export (@world-forge/export-unreal):**
- **Sky / lighting metadata output** — `SkyAtmosphereAssetId`, `DirectionalLightYaw`/`Pitch`, `SkyLightIntensity`, `TimeOfDayKey` on `UnrealZoneDataAsset`. Per-zone `lossless`/`lighting` fidelity entries. (UE-FT-002)
- **Collision channel output** — `CollisionChannel` on `UnrealZoneDataAsset` from `zone.collisionType`, with `approximated` inference (`'hazard'`) when hazards are present but no channel is authored. (UE-FT-003)
- **Parallax actor spawn manifest** — new `actors/parallax-manifest.json` output; one `UnrealParallaxActor` per layer per zone with `SuggestedScale`, `ParentZoneOriginCm`. (UE-FT-004)
- **Gravity + physicsMode passthrough** — `GravityCmPerSec2`, `GravityDirection`, `PhysicsMode` on `UnrealZoneDataAsset`.
- **TransitionEntity passthrough** — `UnrealContentPack.Transitions` array; CLI writes `actors/transitions.json`.
- New `FidelityDomain` values: `lighting`, `collision`, `physics`, `transitions`.
- +11 new tests.

**AI RPG Engine export (@world-forge/export-ai-rpg):**
- **Export profiles** — `exportToEngine(project, { profile: 'debug' | 'release' })` + CLI `--profile`. Release = today's minimal output. Debug = adds a top-level `_debug` block (timestamp, schemaVersion, sourceProjectId, fidelityVerbose). Both profiles deterministic. (AIR-FT-001)
- **Dry-run + schema-version CLI** — `--dry-run` validates and reports sizes without writing files (mutually exclusive with `--out`); `ContentPack.schemaVersion` now emitted by default (opt out via `--no-emit-schema-version`). (AIR-FT-005)
- +18 new tests.

### Deferred to v4.4+

- **UE5 reference loader plugin (UE-FT-001)** — will ship with the Star Freight UE5 project (`F:/AI/star-freight-ue5/`), not inside world-forge. The export-unreal README documents the expected contract; Star Freight devs build the loader alongside the game.
- **Godot 4 exporter (INF-FT-001)** — stub package stays inert. Ships when Fractured Road needs it.
- **Quest system (SCH-FT-002)**, **Canon adapter v1 (SCH-FT-007)**, **Faction relationships (SCH-FT-005)** — content-authoring primitives deferred until dogfooding a real game surfaces the concrete requirements.

### Health Pass summary (closed before this release)

- Stage A: 56 findings (2 CRITICAL + 11 HIGH in Wave 1 `5137710`, 42 MED+LOW in Wave 2 `2baaa5d`).
- Stage B (proactive) + Stage C (humanization): 54 findings in a single amend pass (`be679c6`).
- 110 health-pass items closed before features shipped.

### Verification

- Tests: 1692 (v4.2.0) → 1959 (v4.3.0), +267 new tests.
- Shipcheck: 100% pass, all hard gates green.

### Notes

- **Translations (pending):** translated READMEs drift from 2026-03-10; user regenerates via polyglot-mcp. Will land with v4.3.0 publish.

## [4.2.0] - 2026-04-22

### Added — Unreal Engine 5 alignment wave

- **`@world-forge/export-unreal` (new)** — peer export lane targeting UE5 2.5D games. Emits an `UnrealContentPack` (pack manifest, per-zone / per-district Primary Data Asset JSON, actor spawn manifest grouped by zone, level-streaming hints, World Partition cell hints, fidelity report). Ships a `world-forge-export-unreal` CLI with `--out`, `--tile-size-cm`, `--validate-only`, `--verbose` flags.
- **2.5D schema additions on `Zone`** — optional `elevation` (metres), `elevationRange` (multi-level), `parallaxLayers` (depth-ordered backdrop layers), and `skylineRef`. Backward-compatible with v4.1.x projects.
- **Two new validation checks** — `elevationRange.floor < ceiling` and unique parallax-layer `depth` + `id` per zone.
- **Two new advisories** — suggest authoring elevation when mode is `space` or `wilderness`.
- **`CanonAdapter` interface stub** — reserved contract for future read-only binding to canon trees (style-dataset-lab, game design directories, Motif scene lists). No implementation in this release.
- **`@world-forge/export-godot` (stub)** — reserved workspace slot for the planned Godot 4 export lane. Not yet implemented.
- **Editor — Export modal** — new **Export Unreal Engine 5** button next to the existing **Export JSON** button.
- **Coordinate transform** — pure functions `pixelsToUnrealCm`, `elevationToZ`, `worldForgeToUnrealAxis`, `gridToUnrealAxis`. Default world scale: 1 tile = 100 cm (1 m). Y-down (World Forge) → Z-up (Unreal) with Y flipped.

### Changed

- Root `package.json` description now names all three engine targets (ai-rpg-engine, UE5, Godot).
- `ExportModal` title changed from "Export to AI RPG Engine" to "Export" — the modal now hosts multiple engine targets.
- Workspace version consistency test now covers `@world-forge/export-unreal`.

### Test coverage

- 22 new tests across `export-unreal` (coordinate-transform numeric anchors, export + round-trip import, parity contract against the WorldProject canonical field list).
- 10 new schema tests covering `elevationRange`, parallax uniqueness, and mode-specific elevation advisories.

## [4.1.0] - 2026-03-31

### Added

- **Auto-save** — 30-second throttled auto-save with 3-version recovery history (localStorage)
- **Undo labels** — undo/redo stack entries now carry descriptive action labels with count badges
- **Copy/paste** — Ctrl+C / Ctrl+V with full ID remapping and configurable offset
- **Per-object visibility** — hide/show individual objects, persisted in localStorage
- **Context menu** — right-click for 7 context-sensitive actions on canvas
- **Connection preview** — dashed cyan line during connection tool placement
- **Minimap** — 200×150 overview overlay with click-to-jump navigation
- **Viewport culling** — only renders objects within visible bounds (64px margin)
- **Performance stats** — toggle object count, render time, and zoom overlay
- **Theme toggle** — dark/light mode switch persisted in localStorage
- **Unsaved changes guard** — beforeunload warning prevents accidental navigation
- **Layout templates** — 6 prebuilt zone arrangements (3 dungeon + 3 district)
- **Dialogue templates** — 5 conversation starters (greeting, quest-giver, merchant, warning, farewell)
- **Zone merge** — merge multiple zones into one with full reassignment of connections, entities, items
- **Batch entity placement** — grid, random, and circle placement patterns
- **Fuzzy search** — character-order matching with scoring (consecutive, word-start, shorter-text bonuses)
- **Search history** — recent searches persisted in localStorage
- **Project metadata editor** — author, license, category, tags fields in Review panel
- **Review statistics** — role distribution, connection kinds, encounter types, zones per district
- **Role filter pills** — entity list filterable by role with counts
- **Import fidelity repair suggestions** — actionable fix recommendations in ImportSummaryPanel
- **Export versioning tips** — multi-user footnote and version guidance in ExportModal
- **Progression cross-links** — progression tree nodes link to associated entities
- **Checklist keyboard shortcuts** — hotkey reference section in guide panel
- **Asset drag handles** — reorderable asset entries in AssetPanel
- **Validation toast** — green auto-dismiss toast on successful validation
- **Zone auto-naming** — mode-aware default names (e.g., "Chamber 3" for dungeon, "Sector 3" for space)
- **Snap distance** — `computeSnapDistance()` pure function, exported snap guide constants
- **Modal guards** — `confirmDiscard()` utility for unsaved changes confirmation
- **Schema metadata** — optional `author`, `license`, `category`, `projectTags` on WorldProject
- **Schema warningCount** — `ValidationResult` now includes `warningCount` and optional `ValidateOptions`
- **Advisory enhancements** — metadata completeness advisories, asset generic-name detection
- **Export --verbose flag** — verbose output mode for CLI export
- **Export JSDoc** — comprehensive documentation of export/import pipeline architecture

### Changed

- **Validation performance** — replaced O(n²) zone lookups with precomputed Maps and Sets
- **structuredClone** — replaced JSON.parse(JSON.stringify()) for deep cloning throughout
- **Error boundary** — localStorage availability check with try-catch, dev-mode stack traces
- **Renderer hardening** — fallback colors/shapes for missing assets, division-by-zero guards

### Fixed

- **CI workflow** — removed invalid `secrets` context from step-level if expression
- **Bundle validation** — fixed isValid logic (now checks `.valid` only, not OR with errors.length)
- **Import safety** — null guards on FileReader result, empty zone checks before spawn creation
- **Repairs** — added null guard on optional `fieldName` in computed property access
- **Chapel threshold** — fixed discriminant field (success → ok)

## [4.0.6] - 2026-03-25

### Fixed
- SHA-pin CI workflow actions (checkout, setup-node, codecov, pages actions) for supply chain security

## [4.0.5] - 2026-03-19

### Changed

- **ExportModal → ModalFrame** — migrated the last remaining modal (ExportModal) to the shared `<ModalFrame>` shell, completing the 7/7 modal migration
- **shared.tsx cleanup** — stripped 11 style-constant exports from `shared.tsx`; all style primitives now live exclusively in `styles.ts`. `shared.tsx` exports only 4 reusable components: `PanelHeader`, `ConfirmButton`, `EmptyState`, `useFocusHighlight`
- **SpeedPanel tokenization** — replaced 30+ hardcoded hex colors with CSS custom properties from `theme.css` (backgrounds, text, borders, shadows). Unique colors (gold pins, warning banners) preserved intentionally
- **SearchOverlay tokenization** — replaced 15+ hardcoded hex colors and z-index literals with CSS custom properties (`--wf-bg-overlay`, `--wf-z-overlay`, `--wf-bg-panel`, `--wf-bg-elevated`, `--wf-bg-app`, `--wf-bg-control`)
- **18 consumer file import migration** — updated import paths across `ToolPalette`, `ImportModal`, `TemplateManager`, `ValidationPanel`, `SaveTemplateModal`, `SaveKitModal`, `DistrictPanel`, `ConnectionProperties`, `EncounterProperties`, `ZoneProperties`, `AssetPanel`, `BuildCatalogPanel`, `DialoguePanel`, `ProgressionPanel`, `PlayerTemplatePanel`, and 3 others to source styles from `styles.ts` instead of `shared.tsx`
- **PLAN.md rewrite** — replaced stale implementation plan with architectural decisions summary, shipped version history (v1.0–v4.0.4), and categorized future ideas

## [4.0.3] - 2026-03-11

### Added

- **Design-system token layer** — `src/ui/theme.css` with ~85 CSS custom properties covering backgrounds, text colors, semantic colors, borders, spacing (4 px grid), border radius, shadows, typography scale, z-index layers, layout dimensions, and transitions. Imported once in `main.tsx`
- **Style primitives library** — `src/ui/styles.ts` exports ~22 reusable `CSSProperties` objects: `panelShell`, `inspectorShell`, `sectionHeader`, `toolbarRow`, `buttonBase`, `buttonPrimary`, `buttonDanger`, `buttonAccent`, `buttonGhost`, `inputBase`, `inputCompact`, `selectBase`, `labelText`, `overlayBackdrop`, `modalCard()`, `modalTitleRow`, `modalTitle`, `modalFooter`, `closeButton`, `scrollArea`, `badgePill`, `cardItem`, `hintText`
- **ModalFrame component** — `src/ui/ModalFrame.tsx` shared modal shell (backdrop + card + title row + close button) used by 6 modals
- **Design-system documentation** — `src/ui/DESIGN-SYSTEM.md` with token reference, primitive catalog, ModalFrame usage example, and contributor conventions

### Changed

- **Modal migration** — 6 of 7 modals migrated to `<ModalFrame>`: SaveTemplateModal, SaveKitModal, ImportModal, EditKitModal, ImportKitModal, TemplateManager. Dead local `btnStyle` / `closeBtnStyle` constants removed from each. ExportModal intentionally deferred (non-standard layout)
- **Control standardization** — local button/input/select/label style constants replaced with design-token equivalents across 14 files: App, ExportModal, ChecklistPanel, DependencyPanel, ReviewPanel, SelectionActionsPanel, BatchZoneActions, ConnectionProperties, EncounterProperties, ZoneProperties, DistrictPanel, AssetPanel, PresetBrowser, ToolPalette
- **Panel shell tokenization** — `shared.tsx` internals migrated to CSS custom properties (cascading to 14+ consumer files). App.tsx layout shells (toolbar, sidebars, tab bar, status bar, collapse buttons) fully tokenized. ChecklistPanel fully tokenized (headers, progress bar, step cards, hotkey table, health indicators)
- **Audit follow-up hardening** — result discriminant migration to `{ ok, fail }` pattern, ErrorBoundary for Canvas, CLI integration tests, viewport tests, import shape guards, modal extraction from App.tsx
- **CI fix** — replaced invalid `secrets.CODECOV_TOKEN != ''` in step-level `if` with `continue-on-error: true`

## [4.0.2] - 2026-03-10

### Added

- **Multilingual READMEs** — all package READMEs translated into 7 languages (Spanish, French, Hindi, Italian, Japanese, Portuguese-BR, Chinese) via polyglot-mcp

## [4.0.1] - 2026-03-09

### Changed

- **README reformat** — broke wall-of-text package descriptions into categorized sections (workspace tabs table, canvas/editing bullets, navigation/shortcuts, import/export); grouped 36 flat authoring surface bullets into 5 categories (world structure, content, character systems, assets, workflow)
- **Modal consistency** — SaveKitModal and SaveTemplateModal now use shared `MODAL_OVERLAY`, `MODAL_CARD`, `labelStyle`, and `inputStyle` (were duplicating locally)
- **Color consistency** — eliminated all remaining `#1f6feb` instances: ToolPalette active tool, ExportModal bundle button, TemplateManager badge borders, ImportModal mode badge border — all now use `ACTIVE_TAB_BG` (`#58a6ff`)

## [4.0.0] - 2026-03-09

### Added

- **Shared component library** — `PanelHeader`, `ConfirmButton`, `deleteBtnStyle`, `MODAL_OVERLAY`, `MODAL_CARD`, `ACTIVE_TAB_BG` in shared.tsx standardize all panels and modals
- **Kit guide hints** — all 7 built-in starter kits now have mode-specific guide step labels (zone/spawn/district/player/npc) for contextual first-run guidance
- **Samples mode filter** — mode filter pills in the Samples tab let you browse sample worlds by authoring mode
- **Genre→mode auto-default** — selecting a genre template in the wizard automatically sets the matching authoring mode
- **Landing page refresh** — 9 feature cards (was 7), 16 surface table rows (was 12), updated handbook and README
- ~16 new tests (1243 total across 55 test files)

### Changed

- **Button verb normalization** — all "New" buttons changed to "Add" for consistency
- **Panel headers** — 6 property/utility panels now use shared `PanelHeader` component
- **Modal sizing** — all 5 modals use `MODAL_CARD` with consistent 85vh maxHeight
- **Active tab color** — BuildCatalog/ToolPalette corrected from `#1f6feb` to `#58a6ff`
- **Delete confirmation** — district delete now uses two-click `ConfirmButton` pattern
- **Empty states** — ObjectListPanel uses shared `EmptyState` component
- **Advisory border** — ValidationPanel advisory border-left uses canonical `ACTIVE_TAB_BG`
- **Delete buttons** — property panels (Zone, Connection, Encounter) use shared `deleteBtnStyle`

## [3.9.0] - 2026-03-09

### Added

- **Review snapshot model** — `buildReviewSnapshot(project)` in `@world-forge/schema` aggregates validation, advisory, and dependency data into a single `ReviewSnapshot` with health classification (`ready` / `healthy` / `degraded` / `blocked`), content counts, system completeness, region summaries (per-district entity roles, metrics, encounters, items), encounter summary (by type, boss count, avg probability), connection summary (by kind, conditional/one-way/bidirectional counts), validation summary (errors by domain, first 5), advisory summary, and dependency health
- **Review panel** — new "Review" right-side tab with color-coded health banner, project overview, content counts grid, system completeness checks, region cards with metrics bars and entity role pills, encounter/connection summaries, dependency and validation summaries with cross-tab navigation links, provenance section, and unassigned zones callout
- **Summary export** — "Export Summary" (Markdown) and "Export JSON" buttons in the Review panel generate shareable project summaries as downloadable `.md` or `.json` files with all review sections, provenance, and timestamps
- **Search integration** — Ctrl+K search indexes "Project Review" and "Export Summary" results; selecting either navigates to the Review tab
- **Speed Panel integration** — `open-review` and `export-summary` global actions in the command palette
- **Guide integration** — ChecklistPanel includes a "Review project" step linking to the Review tab
- ~68 new tests (1227 total across 54 test files)

### Changed

- `RightTab` type extended with `'review'`
- `SearchResult.type` union extended with `'review'`
- `SPEED_PANEL_ACTIONS` extended with 2 macroSafe global actions (`open-review`, `export-summary`)

## [3.8.0] - 2026-03-09

### Added

- **Dependency scanner** — `scanDependencies(project)` in `@world-forge/schema` walks the full reference graph and classifies every edge as `ok`, `broken`, `mismatched`, `orphaned`, or `informational`. Covers zone asset refs (backgroundId, tilesetId), entity asset refs (portraitId, spriteId), item asset refs (iconId), landmark asset refs (iconId), asset→pack refs (packId), zone refs (connections, districts, spawns, encounters), dialogue refs, orphan asset detection, and orphan pack detection
- **Repair actions** — `repairsForEdge()` and `batchRepair()` in `packages/editor/src/repairs.ts` generate pure `(WorldProject) => WorldProject` repair functions for broken/mismatched/orphaned edges. Seven repair kinds: clear broken ref, relink to same-kind asset, remove orphan asset, remove orphan pack, clear pack ref, clear broken zone ref, clear broken dialogue ref. All repairs produce atomic undo steps
- **Dependency Manager panel** — new "Deps" right-side tab with summary bar, domain-grouped issue listing, inline repair buttons, "Relink" picker for same-kind assets, batch "Clear all broken refs" and "Remove all orphans" buttons, click-to-navigate from source labels, and badge count in the tab strip
- **Search integration** — Ctrl+K search indexes non-ok dependency edges so broken refs are discoverable by message text. Selecting a dependency result navigates to the Deps tab
- **Guide integration** — ChecklistPanel shows dependency health step: amber warning for broken/mismatched refs with link to Deps tab, info note for orphans, green check when all resolved
- **Import flow integration** — import preview shows dependency health summary for both project-bundle and world-project formats. If imported project has broken refs, auto-switches to Deps tab after import
- **Export modal integration** — bundle export section shows amber warning when project has broken references with link to Deps tab for repair before exporting. `dependencyHealth` (broken/mismatched/orphaned counts) embedded in ProjectBundle dependencies
- **Validation cross-link** — ValidationPanel shows "Open Deps" link on asset reference errors, linking directly to the Dependency Manager for repair
- ~77 new tests (1159 total across 50 test files)

### Changed

- `ProjectBundleDependencies` type extended with optional `dependencyHealth` field
- `serializeProject()` now computes and includes dependency health from `scanDependencies`
- `RightTab` type extended with `'deps'`
- `Domain` type in validation-helpers extended with `'deps'`
- `SearchResult.type` union extended with `'dependency'`

## [3.7.0] - 2026-03-09

### Added

- **Project bundle export** — export any project as a portable `.wfproject.json` file via the new "Export Project Bundle" button in the Export modal. The bundle wraps a deep-cloned `WorldProject` with `bundleVersion: 1`, `exportedAt` timestamp, content summary counts, and dependency metadata (active kit provenance + asset pack IDs). No validation gate — work-in-progress projects can be exported
- **Project bundle import** — `.wfproject.json` files are auto-detected as the fourth import format (`project-bundle`) alongside WorldProject, ExportResult, and ContentPack. The Import modal shows bundle metadata (name, mode, genre, exported date), content summary, kit provenance, asset pack listing, and validation warnings. Unsaved-changes guard warns before overwriting dirty projects
- **Project bundle format** — `ProjectBundle` interface in `packages/editor/src/projects/bundle.ts` with `serializeProject()`, `parseProjectBundle()`, `prepareProjectImport()`, `extractDependencies()`, and `projectFilename()` functions. Follows the same serialize/parse/prepare pipeline as kit bundles
- **Provenance tracking** — `projectBundleSource` field in editor store tracks whether the current project was imported from a bundle. Provenance indicator appears in the Guide checklist and Export modal. Cleared on `resetChecklist`
- **Format detection update** — `detectImportFormat()` now checks for `bundleVersion` + `project` fields before the WorldProject heuristic, preventing false-positive detection of bundles as raw WorldProject
- 107 new tests (1082 total across 47 test files)

### Changed

- Export modal shows "ProjectBundle" in the "Changes Since Import" format label when applicable
- Import modal file picker accepts `.wfproject.json` in addition to `.json`
- `ImportFormat` type in `@world-forge/export-ai-rpg` extended with `'project-bundle'`

## [3.6.0] - 2026-03-09

### Added

- **Kit export** — every starter kit (built-in and custom) can be exported as a portable `.wfkit.json` bundle file via the new Export button on kit cards. The bundle format (`KitBundle`) strips runtime fields (id, builtIn, createdAt, updatedAt, source), adds `bundleVersion: 1` and `exportedAt` timestamp, and deep-clones the project for clean serialization
- **Kit import** — new "Import Kit" button in the Starter Kits tab opens a file picker modal that accepts `.wfkit.json` or `.json` files. The import pipeline validates the bundle format, checks required fields (bundleVersion, name, modes, project), runs full kit validation, and shows a preview with name, mode badges, content counts, and any warnings/errors before importing
- **Kit collision handling** — when importing a kit whose name matches an existing kit (case-insensitive), the modal offers three strategies: "Import as Copy" (appends "(imported)" suffix), "Replace Existing" (custom kits only, preserves createdAt), or "Cancel". Built-in kits can never be replaced
- **Kit provenance tracking** — `source?: 'local' | 'imported'` field on `StarterKit`. Saved kits default to `'local'`, imported kits are tagged `'imported'`. Provenance badges appear on kit cards: blue "imported" badge, gray "custom" badge. Search overlay shows three-way status (built-in/imported/custom). ChecklistPanel displays "Using imported kit: {name}" when applicable
- **Bundle serialization** — `serializeKit()`, `parseKitBundle()`, `prepareKitImport()`, `kitFilename()` functions in new `kits/bundle.ts` module. Full validation pipeline: parse JSON → validate bundle structure → validate as kit → return ready-to-import shape with combined parse warnings and validation warnings/errors
- **Kit store `importKit` method** — creates a new kit with generated ID, or replaces an existing custom kit in-place when `replaceId` is provided (preserves original createdAt). Deep-clones project, sets timestamps, persists to localStorage
- **`duplicateKit` source preservation** — duplicating an imported kit preserves `source: 'imported'`; duplicating a built-in kit gets `source: undefined`
- 57 new tests (975 total across 44 test files)

### Changed

- TemplateManager kit cards show provenance badges ("imported" in blue, "custom" in gray) alongside the built-in lock icon
- SearchOverlay kit detail string uses three-way status: built-in/imported/custom (was two-way: built-in/custom)
- ChecklistPanel shows imported kit name when active kit has `source === 'imported'`
- `saveKit` defaults `source` to `'local'` via `input.source ?? 'local'`
- Barrel exports in `kits/index.ts` expanded with bundle types and functions

## [3.5.0] - 2026-03-09

### Added

- **Custom starter kits** — users can create, save, edit, duplicate, and delete their own mode-native starter kits alongside the 7 built-in kits. Custom kits persist to localStorage and appear in the Starter Kits tab with full CRUD controls
- **StarterKit type** — new `StarterKit` interface with multi-mode support (`modes[]`), preset refs (region + encounter IDs), guide hints (checklist label/description overrides), tags, built-in flag, and timestamps
- **Kit store** (`kits/kit-store.ts`) — Zustand + localStorage CRUD store following the preset-store pattern. Built-in protection prevents editing/deleting shipped kits
- **Starter Kits tab** — replaces "Mode Starters" tab in Template Manager. Shows built-in kits with lock icon + custom kits with Edit/Delete. Mode filter pills, name input, content counts, preset ref counts, tag badges
- **Save as Kit** — new button in top bar captures current project as a reusable starter kit with name, description, icon, mode checkboxes, and comma-separated tags
- **Edit Kit modal** — edit custom kit metadata, toggle preset refs from built-in presets, and set per-step guide hint overrides (label + description for district/zone/spawn/player/npc steps)
- **Kit search** — `'starter-kit'` type added to Ctrl+K search overlay with orange "Kit" badge; indexes all kits with built-in/custom status and mode annotations
- **Kit guide integration** — `activeKitId` in editor store; ChecklistPanel reads kit `guideHints` first, then ModeProfile `guideOverrides`, then defaults. `resetChecklist()` clears active kit
- **Kit validation** — `validateKit()` returns `{ valid, errors[], warnings[] }`. Errors: empty name, empty/invalid modes, broken project. Warnings: preset ref IDs not found in existing presets
- **`createProjectFromKit()`** — pure helper for deep-cloning a kit project with new ID and optional name override
- **`filterKitsByMode()`** — pure mode filter for kits, same pattern as `filterPresetsByMode()`
- **BUILTIN_KITS wraps MODE_STARTERS** — 7 built-in kits with curated preset refs per mode; `MODE_STARTERS` derived from `BUILTIN_KITS` for backward compat (zero test breakage)
- 103 new tests (918 total across 40 test files)

### Changed

- Template Manager "Mode Starters" tab renamed to "Starter Kits" and now shows built-in + custom kits
- `MODE_STARTERS` derived from `BUILTIN_KITS` via `.map()` instead of individual imports (backward compatible)
- `editor-store.ts` extended with `activeKitId` + `setActiveKitId()`; `resetChecklist()` clears it
- `SearchOverlay` type union extended with `'starter-kit'`
- `ChecklistPanel` guide hint cascade: kit → ModeProfile → defaults

## [3.4.0] - 2026-03-09

### Added

- **Mode starter templates** — 7 hand-built starter projects (one per authoring mode) with 4 zones, 4 connections, entities, dialogues, encounters, items, player template, build catalog, and progression tree. Each starter is a fully playable world that demonstrates mode-native content: Forgotten Vault (dungeon), Market Quarter (district), Contested Frontier (world), Corsair Strait (ocean), Relay Station (space), Clockwork Manor (interior), Wolf Ridge (wilderness)
- **Mode Starters wizard tab** — new "Mode Starters" tab in the Template Manager showing all 7 starters with icon, description, mode tip, and content counts; click "Start Project" to create a named project from any starter
- **`ModeStarter` interface** — `{ id, name, description, icon, mode, project }` with `createProjectFromModeStarter()` factory (deep-clone, unique ID, custom name)
- **Upgraded sample worlds** — 6 minimal 2-zone samples replaced with intermediate 3-4 zone samples including interactables, entities, dialogues, encounters, player templates, build catalogs, progression trees, items, faction presences, and pressure hotspots: Smuggler's Cove (ocean), Mining Outpost (space), Thornwood Path (wilderness), Dockside Market (district), Iron Steppe (world), Keeper's Lodge (interior)
- **7 mode-specific encounter presets** — Dungeon Ambush, Street Brawl, Caravan Raid, Pirate Attack, Boarding Action, Haunted Room, Beast Hunt — each tagged with its authoring mode for filtered browsing (10 total encounter presets: 3 universal + 7 mode-specific)
- **`modeTip` on ModeProfile** — short guidance string per mode displayed in the Getting Started checklist (e.g. "Design rooms and corridors, then connect them with doors and passages.")
- **Expanded guide overrides** — all 7 modes now provide custom labels and descriptions for spawn, player, and npc checklist steps (e.g. dungeon: "Place an entry point" / "Create an adventurer" / "Add a speaking creature")
- **Mode description in wizard** — Genres tab shows the current mode's description below the Scale selector
- 131 new tests (815 total across 34 test files)

### Changed

- `ModeProfile` interface extended with `modeTip: string`
- `guideOverrides` expanded from 2 keys (district, zone) to 5 keys (district, zone, spawn, player, npc) across all 7 modes
- ChecklistPanel displays `modeTip` with mode icon and uses expanded overrides for player/npc steps
- Template Manager gains 4th tab ("Mode Starters") and mode description in Genres tab
- Sample worlds upgraded from `complexity: 'minimal'` to `complexity: 'intermediate'` with full content
- Encounter preset count: 3 → 10 (3 universal + 7 mode-specific)

## [3.3.0] - 2026-03-09

### Added

- **Mode-aware object defaults** — creating objects now uses mode-appropriate defaults: dungeon connections default to `door`, ocean to `channel`, space to `docking`, wilderness to `trail`; dungeon entities default to `enemy` role, district/world to `npc`; encounters default to mode-relevant types (dungeon→`patrol`, ocean→`pirate`, space→`pirate`); zones use mode-specific name patterns (`Chamber 1`, `Waters 1`, `Sector 1`, etc.)
- **ModeProfile extended** — 3 new fields: `encounterTypes` (mode-relevant encounter type suggestions), `defaultEntityRole` (role applied when placing entities), `zoneNamePattern` (name prefix for new zones)
- **`getDefaultConnectionKind(mode)`** — pure helper returning `connectionKinds[0]` from the mode profile
- **Connection kind visual styles** — 5 missing entries added to `CONNECTION_KIND_STYLES` for channel (ocean blue), route (ocean blue dashed), docking (purple dashed), warp (purple double-dash), trail (green dashed)
- **Mode-ordered connection dropdown** — ConnectionProperties now shows all 12 connection kinds with mode-relevant kinds first and remaining kinds in an "Other" section
- **Encounter type suggestions** — EncounterProperties gains a datalist populated from `getModeProfile(project.mode).encounterTypes`
- **Suggested zone tags** — ZoneProperties shows clickable tag chips from the mode profile's `suggestedZoneTags`
- **Mode-aware empty states** — ObjectListPanel shows mode-specific empty state messaging (e.g. "add your first chamber" in dungeon, "add your first sector" in space)
- **Speed Panel mode suggestions** — new MODE section between MACROS and CONTEXTUAL showing mode-relevant quick actions: Add Secret Connection (dungeon/interior), Add Channel (ocean), Add Warp Route (space), Add Trail (wilderness)
- **`modeSuggested` field** on `SpeedPanelAction` — actions with matching `modeSuggested` modes appear in the MODE section when that mode is active
- **`getOrderedKinds(mode)`** — pure helper for generating mode-ordered connection kind lists
- **`emptyStateMessage(mode)`** — pure helper for mode-aware empty state text
- 56 new tests (684 total across 33 test files)

### Fixed

- **ConnectionProperties missing 5 kinds** — dropdown now shows all 12 connection kinds (was missing channel, route, docking, warp, trail)
- **Connection kind styles missing** — 5 v3.2 connection kinds (channel, route, docking, warp, trail) now have distinct visual styles on the canvas instead of falling back to passage gray

### Changed

- `ModeProfile` interface extended with `encounterTypes`, `defaultEntityRole`, `zoneNamePattern`
- `filterActions()` accepts optional 8th `mode` parameter and returns 6-section `FilteredActions` (added `modeSuggested`)
- Speed Panel section layout: PINNED → GROUPS → RECENT → MACROS → **MODE** → CONTEXTUAL (was 5 sections, now 6)
- Canvas zone creation uses `zoneNamePattern` from mode profile instead of hardcoded "Zone"
- Canvas connection creation uses `getDefaultConnectionKind()` instead of implicit passage
- Canvas entity creation uses mode profile's `defaultEntityRole` instead of hardcoded 'npc'
- Canvas encounter creation uses mode profile's `encounterTypes[0]` instead of hardcoded 'patrol'

## [3.2.0] - 2026-03-09

### Added

- **Authoring modes** — 7 orthogonal scale modes (dungeon, district, world, ocean, space, interior, wilderness) that govern grid defaults, connection vocabulary, validation emphasis, guide wording, and preset filtering — genre stays as flavor, mode is scale
- **Mode profiles** — static `ModeProfile` data objects per mode with label, icon, grid dimensions (tileSize), connection kinds, suggested zone tags, and guide overrides
- **5 new connection kinds** — `channel`, `route`, `docking`, `warp`, `trail` for ocean/space/wilderness modes (backward-compatible union expansion)
- **Advisory validation** — `advisoryValidation()` returns mode-specific suggestions (e.g. "dungeon: add secret connections", "ocean: add channel connections") that never block export; shown in a collapsible blue section below hard errors
- **Mode-aware project creation** — `createEmptyProject(mode?)` and `createProjectFromWizard({mode})` apply correct grid dimensions from mode profile; mode picker in Template Manager wizard
- **Preset mode compatibility** — `modes?: AuthoringMode[]` on presets; `filterPresetsByMode()` hides incompatible presets with "N hidden by mode" count; 5 new region presets (Ocean Port, Space Station Hub, Wilderness Camp, Dungeon Vault, City Slum)
- **Mode-adaptive guide** — ChecklistPanel applies `guideOverrides` per mode (e.g. dungeon→"Add a chamber", ocean→"Add a sea zone", space→"Add a sector")
- **UI mode indicators** — mode badge in top bar next to project name, "Mode: icon label" in status bar
- **Search mode annotations** — preset search results include mode tags in detail text; incompatible presets get dim styling
- **Import mode inference** — `inferMode()` heuristic recovers mode from connection kinds, grid area, and zone tags; mode preserved through export/import round-trip via PackMetadata tags
- **6 new mode samples** — Ocean Harbor (channel), Space Station (docking), Wilderness Trail (trail), City Market (road), World Map (road), Cabin Interior (stairs) — each with 2 zones, 1 connection, 1 district, 1 spawn
- 105 new tests (628 total)

### Changed

- `WorldProject.mode` is an optional `AuthoringMode` field — existing projects with `undefined` are treated as `'dungeon'` everywhere
- `ConnectionKind` union expanded from 7 to 12 kinds
- `VALID_CONNECTION_KINDS` set updated for the 5 new kinds
- Existing genre templates assigned `mode: 'district'`; existing samples assigned `mode` (Hello World→dungeon, Tavern→district, Chapel→dungeon)
- Existing region presets assigned `modes` arrays; encounter presets left universal
- Tab bar preset search indexes mode annotations
- Import pipeline applies `inferMode()` when mode is missing, adds fidelity entry
- Export pipeline includes `mode:` tag in PackMetadata

## [3.1.0] - 2026-03-09

### Added

- **Favorites reorder** — edit mode (pencil button) reveals up/down arrows to reorder pinned favorites; order persists in localStorage
- **Recent actions** — last 5 unique actions tracked and shown in a RECENT section; deduped, most-recent-first
- **Custom groups** — create named action groups in edit mode; collapsible sections with inline rename, delete, and action assignment
- **Lightweight macros** — create multi-step macros from macroSafe actions; sequential execution with per-step undo; abort on context mismatch with inline status feedback
- **macroSafe flag** — each action marked as safe (deterministic) or unsafe (interactive picking); only safe actions available as macro steps
- **Extracted execute module** — `speed-panel-execute.ts` with `executeAction()` and `executeMacro()` pure functions, fully testable
- **Speed Panel edit mode** — pencil toggle reveals CRUD controls for groups and macros alongside reorder arrows for pins
- **Step editor** — inline macro step list with add (dropdown filtered to macroSafe), remove, and reorder controls
- **Section layout** — Speed Panel now shows 5 sections: PINNED → GROUPS → RECENT → MACROS → CONTEXTUAL; empty sections fully hidden
- **Macro execution feedback** — red banner shows which step failed and why when a macro aborts
- 43 new tests (523 total)

### Changed

- `SpeedPanelAction` interface extended with `macroSafe: boolean`
- `filterActions()` now returns `FilteredActions` with pinned, recents, groups, macros, and contextual sections
- Speed panel store expanded: `reorderPin`, `addRecent`, group CRUD, macro CRUD, step management (all localStorage-backed)
- Editor store: `speedPanelEditMode` + `toggleSpeedPanelEditMode()`, edit mode resets on close
- Speed Panel max-height increased to 400px to accommodate additional sections

## [3.0.0] - 2026-03-09

### Added

- **Speed Panel** — double-right-click anywhere on the canvas to open a floating command palette at the cursor position
- **Context-aware actions** — Speed Panel shows different actions based on what's under the cursor: zone actions (Edit Properties, Delete, Duplicate, Assign District, Place Entity Here, Connect From Here), entity/landmark actions (Edit Properties, Delete, Duplicate), connection actions (Edit Properties, Delete, Swap Direction), or empty canvas actions (New Zone, Fit to Content)
- **Pinned favorites** — star any action to pin it to the top of the Speed Panel; pins persist in localStorage across sessions
- **Speed Panel search** — type in the search input to filter actions by name
- **Keyboard navigation** — Arrow keys, Enter to execute, Esc to dismiss the Speed Panel
- **Esc guard** — Esc closes the Speed Panel when open instead of clearing selection
- 20 new tests (480 total)

### Changed

- HotkeyContext extended with `showSpeedPanel` and `closeSpeedPanel` for Esc dispatch guard
- Editor store extended with speed panel state (`showSpeedPanel`, `speedPanelPosition`, `speedPanelContext`)

## [2.9.0] - 2026-03-09

### Added

- **Preset system** — reusable region and encounter templates with merge/overwrite application modes
- **Region presets** — 4 built-in presets (Crypt District, Market Ward, Chapel Grounds, Smuggler Dock) that configure tags, controlling faction, metrics, economy profile, faction presences, and pressure hotspots in one click
- **Encounter presets** — 3 built-in presets (Boss, Hazard, Discovery) that create encounter anchors with pre-configured type, probability, cooldown, and tags
- **Preset Browser** — new "Presets" tab in right sidebar with Region/Encounter sub-tabs, merge/overwrite mode toggle, save-from-current, apply with confirm, and duplicate support
- **Custom presets** — save any district or encounter configuration as a reusable preset; custom presets are stored in localStorage and support full CRUD
- **Built-in preset protection** — built-in presets are immutable (lock icon, cannot edit or delete); duplicate to customize
- **Centralized hotkey registry** — `hotkeys.ts` with binding registry, `matchHotkey()`, and `dispatchHotkey()` replacing inline Canvas.tsx handlers
- **New keyboard shortcuts** — Enter (open details panel for selected object), P (apply preset), Shift+P (save current as preset)
- **Hotkey reference table** — Guide tab now includes a keyboard shortcuts reference section
- **Double-click panel affordance** — double-click any object on the canvas to select it, switch to Map tab, and center viewport; works for zones, encounters, entities, landmarks, spawns, and connections
- **Preset search** — Ctrl+K indexes region and encounter presets alongside world objects; selecting a preset switches to the Presets tab
- 48 new tests (460 total)

### Changed

- Canvas.tsx keyboard handler delegated to centralized `dispatchHotkey()` (Space/pan remains local)
- SearchResult type extended with `region-preset` and `encounter-preset` types
- RightTab union extended with `presets`

## [2.8.0] - 2026-03-09

### Added

- **Encounter anchors on canvas** — red diamond markers at zone center, type-based coloring (boss=bright red, ambush=orange, patrol=muted yellow), selection ring, type label at zoom > 40%
- **Encounter-place tool** — click a zone to place a new encounter anchor
- **EncounterProperties panel** — edit encounter type, enemy IDs, probability, cooldown, tags; delete encounter
- **Encounter hit-testing** — encounters are selectable on canvas with priority: spawns > encounters > landmarks > entities > connections > zones
- **Encounter search** — Ctrl+K indexes encounter anchors with type and probability detail
- **Encounter object list** — red "Enc" badges under each zone in Objects tab
- **District panel expansion** — collapsible per-district editor with metrics sliders (commerce/morale/safety/stability), tags, controlling faction, economy profile, faction presences, pressure hotspots, and remove button
- **Faction presence editing** — inline add/edit/remove faction influence and alert level per district
- **Pressure hotspot editing** — inline add/edit/remove hotspot type, probability, and tags per district
- **District name labels** — muted large text at zone centroid when zoom > 25%
- **Remove District** — deletes district and clears `parentDistrictId` from affected zones
- **Export round-trip** — encounterAnchors, factionPresences, and pressureHotspots now included in ContentPack and preserved through export/import cycle
- 6 new validation checks: encounter ID uniqueness, encounter zoneId exists, encounterType non-empty, faction districtIds valid, pressure hotspot ID uniqueness, pressure hotspot zoneId exists
- `SelectionSet` extended with `encounters: string[]`
- Chapel Threshold sample: added `controllingFaction` to crypt-depths district, added crypt-pressure hotspot
- 17 new tests (412 total)

## [2.7.0] - 2026-03-09

### Added

- **Connection kinds** — 7 semantic path types: passage (default), door, stairs, road, portal, secret, hazard
- **Kind-based visual grammar** — each kind has distinct color and dash pattern on the canvas (door=amber, portal=purple, secret=faint dashed, hazard=red-orange, stairs=step-dash)
- **Kind dropdown** — Connection Properties panel includes a Kind selector between Label and Bidirectional
- **Connection labels** — optional label text renders at line midpoint as a dark pill when zoom > 30%
- **Kind badges** — Objects tab shows kind badges (e.g. `door`, `secret`) next to the "C" badge for non-passage connections
- **Kind search** — Ctrl+K search indexes connection kind in detail text; search "secret" or "door" to find connections by kind
- **Chapel Threshold kinds** — sample project connections now have semantic kinds: entrance→nave (door), nave→vestry (door), alcove→crypt (secret + conditional)
- `ConnectionKind` type — exported from `@world-forge/schema` as a union of 7 string literals
- `getKindStyle()` — returns color, hoverColor, and dash pattern for any connection kind
- `connectionMidpoint()` — computes world-pixel midpoint of connection endpoints for label placement
- Validation check #49 — rejects connections with invalid kind values
- Logo embedded in all npm packages (replaces remote brand repo reference)

### Changed

- Condition dashing now takes priority over kind dashing (condition always means "gated")
- `connectionLabel()` includes `[kind]` prefix for non-passage connections
- `updateConnection` store action now supports `kind` field

## [2.6.0] - 2026-03-09

### Added

- **Connection selection** — click any connection line on the canvas to select it; blue highlight (#58a6ff) and thicker line indicate selection
- **Connection properties panel** — edit label, bidirectional toggle, condition, swap direction, and delete from the Map tab sidebar
- **Edge-anchored routing** — connection lines now anchor at zone edges (ray-rectangle intersection) instead of zone centers, producing cleaner visuals especially after resize
- **Directional arrowheads** — non-bidirectional connections render a small triangle arrowhead at the target zone endpoint
- **Conditional connection styling** — connections with conditions render as dashed orange lines; selected connections override to solid blue
- **Connection hover** — hovering a connection line shows pointer cursor and increases opacity/thickness
- **Connection hit-testing** — connections are clickable objects in the hit-testing priority chain (after spawns/landmarks/entities, before zones)
- **Connection deletion** — Delete/Backspace removes the selected connection with full undo/redo support
- **Objects tab connections** — Connections section in the Objects panel with click-to-select and frame-both-zones navigation
- **Search connections** — Ctrl+K search indexes connections by zone names and condition text
- `connection-lines.ts` — pure connection math module (getEdgeAnchor, getConnectionEndpoints, pointToSegmentDist, hitTestConnection, findConnectionAt, connectionLabel)
- `ConnectionProperties.tsx` — connection editing panel following ZoneProperties pattern
- `updateConnection` store action — update label/bidirectional/condition with undo/redo
- `selectConnection` / `selectedConnection` — mutual exclusion with object selection (selecting a connection clears objects and vice versa)
- 26 new tests (378 total)

## [2.5.0] - 2026-03-09

### Added

- **Zone resize handles** — 8 handles (4 corners + 4 edge midpoints) appear when a single zone is selected; drag any handle to reshape the zone directly on the canvas
- **Resize snap** — during resize, the moving edge snaps to nearby zone edges using the existing snap candidates within 1 grid cell radius; guides render at snap positions
- **Resize preview** — zone renders at its new geometry during resize; connections follow the resized zone center in real-time
- **Directional cursors** — handle hover shows directional resize cursors (nw-resize, n-resize, e-resize, etc.)
- **Minimum zone size** — zones cannot be resized below 2×2 grid cells, matching the zone-paint constraint
- `resize-handles.ts` — pure resize math module (getHandles, getHandleAxes, applyResize, findHandleAt) following the layout.ts/snap.ts pattern
- `computeResizeSnap` in snap.ts — edge-specific resize snap computation
- `resizeZone` store action — atomic resize with undo/redo support (one drag = one undo step)
- 26 new tests (352 total)

## [2.4.1] - 2026-03-09

### Added

- **Right-click pan** — right-click drag on the canvas now pans the viewport, alongside existing spacebar+drag and middle-mouse drag

## [2.4.0] - 2026-03-09

### Added

- **Object-to-object snapping** — during drag, selected objects snap to edges and centers of non-selected objects within 1 grid cell; X and Y axes snap independently; closest candidate wins
- **Visual snap guides** — cyan dashed guide lines render at snap positions during drag, spanning the full extent of both the snapped and target objects; zoom-compensated width and dash pattern
- **Drag preview** — selected objects render at their snapped position during drag instead of staying at original position; connections follow dragged zones in real-time
- **Snap to Objects toggle** — checkbox in ToolPalette Layers section (default: on); disables object-to-object snapping when unchecked
- `snap.ts` — pure snap computation module (computeSnap, getNonSelectedEdges) following the layout.ts pattern
- 15 new tests (326 total)

## [2.3.0] - 2026-03-09

### Added

- **Align selected** — 6-way alignment (left/right/top/bottom/center-h/center-v) for any combination of zones, entities, landmarks, and spawns; uses selection bounding box extremes as anchor; entities without explicit positions are materialized from zone fallback
- **Distribute selected** — even horizontal/vertical spacing for 3+ selected objects; preserves first and last positions, moves intermediates
- **Selection Actions Panel** — unified panel replacing BatchZoneActions, shows when 2+ objects are selected (any type); contains align buttons (3x2 grid), distribute buttons, and zone-specific batch operations (district assign, tag batch, delete)
- `layout.ts` — pure layout math functions (getSelectionBounds, alignSelected, distributeSelected) matching the `duplicate.ts` pattern
- 20 new tests (311 total)

### Changed

- App.tsx routes to SelectionActionsPanel instead of BatchZoneActions when 2+ objects selected
- Project store gains `alignSelected()` and `distributeSelected()` actions with atomic undo
- BatchZoneActions.tsx marked as deprecated (superseded by SelectionActionsPanel)

## [2.2.0] - 2026-03-09

### Added

- **Search / command-jump** — Ctrl+K opens a search overlay to find any zone, entity, landmark, spawn, district, dialogue, or progression tree by name/ID; arrow-key navigable, Enter selects + frames on canvas, Escape dismisses
- **Object list panel** — new "Objects" tab with hierarchical tree view (districts → zones → entities/landmarks/spawns), expand/collapse, click to select + frame, bidirectional selection highlighting, inline filter
- **Duplicate selected** — Ctrl+D duplicates all selected objects with 2-tile offset, `(copy)` suffix, unique IDs, remapped connections/neighbors (only between co-selected zones), spawns always `isDefault: false`, district membership preserved; single `updateProject()` call for atomic undo
- **Click-cycle disambiguation** — repeated clicks at the same screen position cycle through overlapping objects (spawn → landmark → entity → zone priority), 4px tolerance for "same spot" detection
- **Frame helpers** — extracted `computeFrameViewport()` and `getCanvasSize()` into `frame-helpers.ts` as shared utility for SearchOverlay, ObjectListPanel, and DistrictPanel
- 33 new tests: 15 search (index + filter), 10 duplicate, 8 overlap-cycle (291 total)

### Changed

- Canvas.tsx gains `findAllHitsAt()` for click-cycle, Ctrl+K for search, Ctrl+D for duplicate
- Editor store adds `showSearch` boolean, `'objects'` to RightTab union
- Project store gains `duplicateSelected()` action via pure `duplicate.ts` function
- DistrictPanel refactored to use shared `getCanvasSize()` helper
- App.tsx renders SearchOverlay conditionally, routes Objects tab to ObjectListPanel

## [2.1.0] - 2026-03-09

### Added

- **Multi-select** — `SelectionSet` model supports zones, entities, landmarks, and spawns simultaneously; shift-click to add/remove from selection
- **Box select** — rubber-band rectangle in select tool mode selects all enclosed objects; shift held unions with existing selection
- **Drag-move** — drag any selected object(s) to reposition; 3px threshold prevents accidental moves; single `updateProject()` call for atomic undo
- **Hit testing** — extracted `hit-testing.ts` with `findHitAt()` (priority: spawns > landmarks > entities > zones) and `findAllInRect()`, 8px screen-space hit radius for point objects
- **Batch zone actions** — `BatchZoneActions` panel when 2+ zones selected: batch district assignment, batch tag add, delete all with confirmation
- **Spatial jump helpers** — `frameBounds()` viewport function frames arbitrary spatial items; Center button works with multi-selection; district zone count badge click selects + frames all district zones
- **Keyboard shortcuts** — Escape (clear selection), Ctrl/Cmd+A (select all visible), Delete/Backspace (remove selected with confirmation), Arrow keys (nudge 1 cell, Shift+Arrow nudge 5)
- **Selection highlights** — white circle for selected entities/landmarks, white square outline for selected spawns, selection count badge on canvas
- 37 new tests: 12 selection model, 20 hit testing, 5 viewport frame (258 total)

### Changed

- Canvas.tsx fully rewritten with hit-testing integration, box-select, drag-move, keyboard shortcuts, and cursor management
- Editor store uses `SelectionSet` instead of single `selectedZoneId`; backward-compatible `setSelectedZone()` kept for navigation panels
- Project store gains batch helpers: `moveSelected()`, `removeSelected()`, `updateEntity()`, `updateLandmark()`, `updateSpawnPoint()`, `removeLandmark()`, `removeSpawnPoint()`
- ToolPalette Center button handles multi-selection via `frameBounds()`
- DistrictPanel supports multi-zone assignment and click-to-frame-district
- App.tsx routes to BatchZoneActions when 2+ zones selected; status bar shows selection count

## [2.0.0] - 2026-03-09

### Added

- **Canvas viewport** — real camera model with pan/zoom via `ctx.setTransform()`, replacing fixed tileSize rendering that left zones off-screen
- **Viewport math utilities** — `viewport.ts` with 8 pure functions: `screenToWorld`, `worldToScreen`, `screenToGrid`, `computeContentBounds`, `fitBoundsToViewport`, `centerOnPoint`, `centerOnZone`, `zoomAtPoint`
- **Mousewheel zoom** — cursor-anchored zoom that keeps the world point under the cursor stationary
- **Drag pan** — spacebar + left-click or middle-mouse drag to pan the canvas
- **Auto fit-to-content** — viewport automatically frames all content when a project loads
- **Double-click to center** — double-click a zone to select it and frame it in the viewport
- **Viewport controls** — Viewport section in ToolPalette with zoom +/-, percentage display, Fit (frame all content), Center (frame selected zone), Reset (return to origin at 100%)
- **Spatial legibility** — zone labels with dark background pills for readability at any zoom, zoom-compensated line widths and marker sizes, stronger selection/hover states (thicker borders, brighter fills, white label for selected)
- **ViewportState in editor store** — `panX`, `panY`, `zoom` replacing the old flat `zoom` field, with `setViewport()` partial updater and `resetViewport()`
- 24 viewport math tests (221 total)

### Changed

- Canvas.tsx fully rewritten with viewport transform — all drawing in world coordinates via `ctx.setTransform()`
- All mouse handlers convert screen coordinates through viewport (screenToWorld → grid)
- Entity markers, landmark diamonds, spawn squares, grid lines all zoom-compensated (constant screen size)
- Editor store imports `ViewportState` from `viewport.ts` (single source of truth)
- ToolPalette uses `computeContentBounds`/`fitBoundsToViewport`/`centerOnZone` from viewport.ts
- Status bar and App.tsx reference `viewport.zoom` instead of flat `zoom`

## [1.9.0] - 2026-03-09

### Added

- **Scene preview** — inline HTML/CSS composed preview in ZoneProperties showing all visual data bound to a zone (background, tileset, entities, landmarks, items, spawns, ambient layers, connections, light level)
- **Scene data assembly** — `assembleSceneData()` pure function extracts and resolves all zone visual bindings with missing-asset detection
- **Layer toggles** — 4 new visibility toggles (Landmarks, Spawns, Backgrounds, Ambient) in ToolPalette; all 7 toggles now drive both Canvas and ScenePreview
- **Canvas landmarks** — gold diamond markers with name labels for landmarks on the map canvas
- **Canvas ambient overlays** — tinted zone rectangles using ambient layer color and intensity
- **Chapel landmark** — Altar of Passage landmark with icon binding added to Chapel Threshold sample
- 18 scene-preview tests + 1 landmark validation test (197 total)

### Changed

- Canvas.tsx now respects `showConnections`, `showEntities`, and `showSpawns` toggles (previously ignored)
- Spawn points rendering wrapped in `showSpawns` toggle guard

## [1.8.0] - 2026-03-08

### Added

- **Asset packs** — `AssetPack` type with id, label, version, description, tags, theme, source, license, author, and `PackCompatibility` metadata (minSchemaVersion, engineVersion)
- **Pack-to-asset binding** — `AssetEntry.packId` references an `AssetPack.id`, same referential pattern as Zone→District
- **6 new validation checks** (#43-48) — pack ID uniqueness, label non-empty, version non-empty, asset packId ref existence, orphaned pack detection, version format (semver x.y.z)
- **Export pack preservation** — `ExportResult` gains `assetPacks` for round-trip fidelity
- **Import pack recovery** — `importFromExportResult()` recovers packs with `asset-packs-recovered` fidelity entry; `importFromContentPack()` emits `asset-packs-dropped`
- **Pack management UI** — AssetPanel gains pack section with add/remove/edit, group-by-pack toggle, pack assignment dropdown per asset, orphaned pack and unassigned asset diagnostics
- **Pack diff tracking** — `diffProjects()` includes packs domain with label/version/description/tags/theme/source/license/author/compatibility field diffs; `diffAsset()` tracks packId changes
- **Chapel Threshold pack** — `chapel-base-pack` groups all 5 chapel assets as a reference sample
- **Pack CRUD with cascade** — `removeAssetPack()` clears `packId` from all referencing assets
- 15 new tests across schema validation, export, import, fidelity, and template suites (178 total)

### Changed

- `WorldProject.assetPacks` is now a required `AssetPack[]` field (defaults to `[]`)
- `FidelityDomain` union includes `'packs'`
- All domain label records (ImportSummaryPanel, DiffPanel, ValidationPanel) include packs
- Export modal shows asset pack count in content summary

## [1.7.0] - 2026-03-08

### Added

- **Asset manifest types** — `AssetEntry` with `id`, `kind` (portrait/sprite/background/icon/tileset), `label`, `path`, `version`, `tags`, `provenance` metadata
- **Asset reference fields** — Zone gains `backgroundId`/`tilesetId`, EntityPlacement gains `portraitId`/`spriteId`, ItemPlacement gains `iconId`, Landmark gains `iconId`
- **10 new validation checks** (#33-42) — asset ID uniqueness, path non-empty, zone/entity/item/landmark ref existence + kind match, orphaned asset detection
- **Export asset preservation** — `ExportResult` gains `assets` and `assetBindings` for round-trip fidelity
- **Import asset recovery** — `importFromExportResult()` recovers assets + bindings; `importFromContentPack()` emits `assets-dropped` fidelity entry
- **Asset library panel** — kind-filtered, searchable asset list with inline editing, add/remove, orphan indicator
- **Zone asset binding** — Background and Tileset dropdowns in Zone Properties with missing-asset indicators
- **Asset diff tracking** — `diffProjects()` includes asset domain with label/kind/path/version/tags/provenance field diffs
- **Chapel Threshold assets** — 5 asset entries (2 backgrounds, 2 portraits, 1 icon) with zone/entity/item bindings as reference sample
- 9 new tests across schema validation, export, import, and template suites (163 total)

### Changed

- `WorldProject.assets` is now a required `AssetEntry[]` field (defaults to `[]`)
- `FidelityDomain` union includes `'assets'`
- All domain label records (ImportSummaryPanel, DiffPanel, ValidationPanel) include assets
- Status bar shows asset count
- Tab bar gains Assets tab with count badge

## [1.6.0] - 2026-03-08

### Added

- **Fidelity report model** — structured `FidelityReport` with per-entry level (lossless/approximated/dropped), domain, severity, entityId, fieldPath, machine-stable reason keys, and summary with `losslessPercent` and `byDomain` breakdown
- **Converter fidelity entries** — all 8 import converters now emit structured `FidelityEntry[]` with reason keys: `grid-auto-generated`, `interactable-type-defaulted`, `surveillance-to-safety`, `economy-data-lost`, `zone-placement-round-robin`, `role-reverse-mapped`, `zone-placement-first-zone`, `hidden-from-contraband`, `textblock-to-string`, `spawn-point-generated`, `pack-id-stripped`, `visual-layers-dropped`, `connections-reconstructed`
- **Import summary panel** — right sidebar tab showing overall fidelity percentage bar, lossless/approximated/dropped counts, collapsible domain groups with per-entry detail
- **Semantic diff engine** — `diffProjects()` compares two WorldProjects by domain (zones, districts, entities, items, dialogues, progression, player, builds) with field-level diffs
- **Diff viewer panel** — right sidebar tab showing changes since import with domain groups, object-level status (modified/added/removed), and field-level before/after diffs
- **Export comparison summary** — export modal shows "Changes Since Import" section when exporting an imported project, with domain change counts and import caveats
- **22 fidelity tests** — `fidelity.test.ts` covering model summarization, per-converter reason keys, Minimal + Chapel round-trip field comparisons, and report accuracy
- 10 inline fidelity tests in `import.test.ts` for converter return signatures

### Changed

- `ImportResult` now includes `fidelityReport: FidelityReport` alongside backwards-compatible `warnings: string[]` and `lossless: boolean`
- All 8 import converters return structured objects with `fidelity: FidelityEntry[]` instead of flat arrays
- Tab bar uses `flexShrink: 0` with `overflowX: auto` instead of `flex: 1` — supports up to 9 tabs without cramping
- Import modal stores fidelity report and project snapshot, auto-switches to Import tab on lossy import

## [1.5.0] - 2026-03-08

### Added

- **Import pipeline** — 8 reverse converters reconstruct WorldProject from engine ContentPack, ExportResult, or raw WorldProject JSON with format auto-detection and lossy-area warnings
- **Round-trip trust** — export → import → re-export produces matching ContentPacks for all supported fields; 38 new import + round-trip tests (114 total)
- **User template store** — save, duplicate, and delete reusable project templates backed by localStorage with corruption recovery
- **Import modal** — file picker with format badge (lossless/lossy), content preview (zone/entity/item counts), and import warnings
- **Save as Template modal** — save current project as a named template with genre, icon, and description metadata
- **Template Manager** — unified 3-tab browser (Genres | Samples | My Templates) replacing the separate wizard and sample browser

### Changed

- Toolbar: `New | Import | Load | Save | Save as Template | Undo | Redo | Export`
- "New" opens the unified Template Manager instead of the old wizard
- "Samples" button removed (merged into Template Manager Samples tab)

### Removed

- `NewProjectWizard.tsx` — replaced by Template Manager Genres tab
- `SampleBrowserModal.tsx` — merged into Template Manager Samples tab

## [1.4.1] - 2026-03-08

### Improved

- **Starter items** — all 5 genre templates now include 2 thematic items (weapon + trinket/tool) with starting inventory and equipment
- **Intermediate sample** — new "Tavern Crossroads" sample bridges the gap between Hello World and Chapel Threshold (2 zones, 1 NPC with dialogue, player template, build catalog, progression tree)
- **Checklist wording** — clearer step descriptions: "Use the Zone tool to create a named location", "Set up the player's starting stats and gear", "Add a character the player can talk to"
- **Sample browser badges** — three complexity tiers with distinct colors: minimal (green), intermediate (blue), rich (amber)

### Added

- `templates.test.ts` — 19 tests covering genre template validation, sample validation, wizard factory, system stripping, and invalid-project error routing via `classifyError`

## [1.4.0] - 2026-03-08

### Added

- **New Project Wizard** — 2-step modal: choose name + genre template (Blank, Fantasy, Cyberpunk, Detective, Pirate, Zombie), then toggle which systems to include (player template, build catalog, progression tree, dialogue, sample NPCs)
- **5 genre starter templates** — each with 4 zones, connections, spawn, player template, build catalog (2 archetypes, 1 background, 2 traits), progression tree, dialogue, and sample NPCs
- **Sample browser** — browse and open Hello World (minimal) or Chapel Threshold (rich reference) as editable copies with content counts
- **First-run checklist** — Guide tab with 6 reactive steps (create district, add zone, place spawn, create player template, add speaking NPC, export), auto-detects completion from project state, click-to-navigate, dismissable
- **Export content summary** — export modal now shows zone/district/entity/item/dialogue/tree/spawn counts and missing system warnings
- **"Fix first issue" navigation** — export modal links directly to the first validation error's relevant tab and field
- `validation-helpers.ts` — shared `classifyError()` and `buildsSubTabFor()` used by ValidationPanel and ExportModal
- `templates/registry.ts` — template registry with `GenreTemplate`, `SampleWorld`, `WizardOptions` types and `createProjectFromWizard()` factory

## [1.3.1] - 2026-03-08

### Improved

- **Issue navigation** — clicking a validation issue now switches to the correct tab, sub-tab (for builds), scrolls the field into view, and pulses a blue highlight for 1.5s
- **Empty states** — all workspace panels (Player, Builds, Trees, Dialogue) now show explanatory empty states with descriptions and quick-start actions
- **Starter templates** — one-click scaffolds: Starter Catalog (Fantasy) for builds, Combat Basics tree for progression, Keeper Greeting dialogue
- **Panel clarity** — consistent section headings, helper text, field hints, and shared styles across all panels
- **Export readiness** — export modal now shows a live readiness banner ("Ready to export" / "Not ready — N issues") with top issues listed, and dims the export button when invalid

### Added

- `shared.tsx` — reusable panel styles, `EmptyState` component, and `useFocusHighlight` hook
- `BuildsSubTab` and `FocusTarget` types in editor store for cross-panel navigation
- `setBuildsSubTab` and `setFocusTarget` store actions

## [1.3.0] - 2026-03-08

### Added

- **Editor workspace tabs** — right sidebar now has Map, Player, Builds, Trees, Dialogue, and Issues tabs
- **Validation panel** — live grouped validation issues by domain (world, entities, items, dialogue, player, builds, progression), clickable errors navigate to the relevant tab, issue count badge in tab bar and bottom status bar
- **Player template editor** — create/edit player templates with base stats, resources, starting inventory, equipment slots, spawn point picker, tags, default archetype/background selection
- **Build catalog editor** — full CRUD for archetypes, backgrounds, traits, disciplines with sub-tab navigation (Config, Arch, Bg, Traits, Disc, Combos), trait effect editor, cross-title and entanglement management
- **Progression tree editor** — create/edit trees and nodes with cost, currency, prerequisites (multi-select), and effect editing
- **Dialogue editor** — full node editing with speaker/text, choice management with next-node linking, entry node highlighting, broken reference detection and highlighting, auto-advance configuration
- **30+ project store helpers** — typed CRUD actions for player templates, build catalog (archetypes, backgrounds, traits, disciplines, cross-titles, entanglements), progression trees/nodes, and dialogue trees/nodes, all with undo/redo support

## [1.2.0] - 2026-03-08

### Added

- **Player template** — `PlayerTemplate` type for player starting state (base stats, resources, inventory, equipment, spawn point)
- **Build catalog** — `BuildCatalogDefinition` with archetypes, backgrounds, traits, disciplines, cross-titles, and entanglements
- **Progression trees** — `ProgressionTreeDefinition` with nodes, requirements, costs, and effects
- **15 new validation checks** (checks 18-32) — player template refs, build catalog ID uniqueness, archetype-tree refs, trait incompatibility refs, cross-title/entanglement refs, tree structure validation
- **3 new export converters** — `convertPlayerTemplate()`, `convertBuildCatalog()`, `convertProgressionTrees()`
- Export warnings for missing player template, build catalog, and progression trees
- Chapel Threshold fixture now includes full player template, build catalog (2 archetypes, 2 backgrounds, 3 traits, 1 discipline), and 2 progression trees
- 57 tests (up from 36)
- Zero-gap dogfood: Chapel Threshold exports with full engine handshake

## [1.1.0] - 2026-03-08

### Added

- **Dialogue authoring** — `DialogueDefinition` type with branching nodes, choices, conditions, and effects
- **Dialogue validation** — entry node existence, broken node references, unreachable node detection, entity-dialogue binding checks
- **Dialogue export** — `convertDialogues()` converter, dialogues wired into ContentPack export pipeline
- **Chapel Threshold dialogue** — 6-node pilgrim conversation tree with branching paths and `set-global` effects
- Minimal fixture now includes a keeper dialogue for test coverage
- 36 tests (up from 24)

## [1.0.0] - 2026-03-08

### Added

- **@world-forge/schema** — spatial types (WorldMap, Zone, ZoneConnection, Landmark), district types (District, FactionPresence, PressureHotspot), entity types (EntityPlacement, ItemPlacement, SpawnPoint, EncounterAnchor, CraftingStation, MarketNode), visual types (Tileset, TileLayer, PropDefinition, AmbientLayer), WorldProject container, `validateProject()` with 12 structural checks
- **@world-forge/export-ai-rpg** — full export pipeline converting WorldProject to ai-rpg-engine ContentPack (zones, districts, entities, items, manifest, pack metadata), CLI tool `world-forge-export`
- **@world-forge/renderer-2d** — PixiJS 2D renderer with viewport pan/zoom, zone overlays with district coloring, connection arrows, entity rendering by role, tile layers, minimap
- **@world-forge/editor** — React 19 + Vite web app with Zustand state management, undo/redo, zone painting, connection drawing, entity placement, district editing, export modal
- Monorepo with npm workspaces and TypeScript project references
- CI with GitHub Actions (Node 20 + 22)
- 24 tests across schema validation and export pipeline
