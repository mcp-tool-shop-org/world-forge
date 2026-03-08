# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
