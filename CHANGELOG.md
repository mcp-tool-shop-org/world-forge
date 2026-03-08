# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
