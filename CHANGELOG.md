# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
