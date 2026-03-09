# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
