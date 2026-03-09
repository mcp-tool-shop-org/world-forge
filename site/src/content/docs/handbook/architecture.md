---
title: Architecture
description: Monorepo structure and package dependencies
sidebar:
  order: 3
---

World Forge is a monorepo with npm workspaces and TypeScript project references. Four packages form a clean dependency graph.

## Package Map

```
packages/
  schema/          @world-forge/schema        — types + validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS canvas
  editor/          @world-forge/editor         — React web app
```

## Dependency Graph

```
schema ← renderer-2d
schema ← export-ai-rpg
schema + renderer-2d + export-ai-rpg ← editor
```

Schema is the foundation. The renderer and export packages depend only on schema. The editor depends on all three.

## @world-forge/schema

The type authority. Defines every structure in a `WorldProject`:

- **Authoring modes** — `AuthoringMode` type (7 modes), `isValidMode()`, `DEFAULT_MODE`
- **Spatial types** — `WorldMap`, `Zone`, `ZoneConnection`, `ConnectionKind` (12 kinds), `Landmark`
- **District types** — `District`, `FactionPresence`, `PressureHotspot`
- **Entity types** — `EntityPlacement`, `ItemPlacement`, `SpawnPoint`, `EncounterAnchor`
- **Dialogue types** — `DialogueDefinition`, `DialogueNode`, `DialogueChoice`, `DialogueCondition`, `DialogueEffect`
- **Asset types** — `AssetEntry`, `AssetKind`, `AssetProvenance`
- **Visual types** — `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Container** — `WorldProject` interface that holds everything
- **Validation** — `validateProject()` with 54 structural checks; `advisoryValidation()` for mode-specific suggestions

## @world-forge/export-ai-rpg

Bidirectional conversion between `WorldProject` and ai-rpg-engine's `ContentPack` format.

**Export** — 9 converters transform WorldProject domains into engine types. `exportToEngine()` orchestrates validation, conversion, manifest generation, and warning collection. A CLI tool (`world-forge-export`) wraps the pipeline.

**Import** — 8 reverse converters reconstruct a WorldProject from exported JSON. `importProject()` auto-detects the format (WorldProject, ExportResult, or ContentPack) and orchestrates all converters. `inferMode()` recovers the authoring mode from connection kinds and grid area when importing pre-mode projects.

**Fidelity** — every import produces a structured `FidelityReport` tracking what was lossless, approximated, or dropped. Each entry has a domain, severity, and machine-stable reason key.

**Diff** — the editor includes a semantic diff engine (`diff-model.ts`) that compares two WorldProject snapshots with domain-specific comparators.

## @world-forge/renderer-2d

PixiJS-based 2D renderer with six sub-renderers:

- **WorldViewport** — Application wrapper with pan, zoom, grid overlay
- **ZoneOverlayRenderer** — zone boundaries with district coloring, selection/hover
- **ConnectionRenderer** — lines between zones, arrows for one-way connections
- **EntityRenderer** — role-based icons (NPC, enemy, merchant, boss)
- **TileLayerRenderer** — z-ordered tile layers with tag-based coloring
- **MinimapRenderer** — scaled overview with viewport indicator

## @world-forge/editor

React 19 + Vite web app. State management with Zustand, supporting undo/redo (10-deep stack). **Authoring modes** (dungeon/district/world/ocean/space/interior/wilderness) adapt grid defaults, connection vocabulary, object creation defaults (connection kind, entity role, encounter type, zone naming), preset filtering, guide text, and advisory validation to the world's scale. Tools: select, zone-paint, connection, entity-place, encounter-place, landmark, spawn. Workspace tabs: Map, Objects, Player, Builds, Trees, Dialogue, Presets, Assets, Issues, Guide, plus conditional Import (fidelity report) and Diff (semantic change tracking) tabs after importing a project.

Key editor modules:

- **SearchOverlay** — Ctrl+K command-jump across all object types (zones, entities, landmarks, spawns, encounters, districts, connections, dialogues, progression trees) and presets (region and encounter)
- **ObjectListPanel** — hierarchical tree view (districts → zones → entities/landmarks/spawns/encounters) with bidirectional selection, inline filter, faction and hotspot counts
- **EncounterProperties** — single-encounter selection panel with type, enemy IDs, probability, cooldown, tags
- **DistrictPanel** — expanded district editor with metrics sliders, tags, controlling faction, economy profile, faction presence management, pressure hotspot editing
- **duplicate.ts** — pure function for duplicating selections with ID remapping, connection rewiring, and district preservation
- **frame-helpers.ts** — shared viewport framing utility (`computeFrameViewport`) used by search, object list, and district panels
- **hit-testing.ts** — pure math hit-testing (`findHitAt`, `findAllHitsAt`) with click-cycle disambiguation for overlapping objects; priority: spawns > encounters > landmarks > entities > connections > zones
- **layout.ts** — pure functions for 6-way alignment and horizontal/vertical distribution across any combination of object types
- **snap.ts** — pure snap computation for object-to-object snapping during drag and resize (edge/center matching, guide line generation)
- **resize-handles.ts** — pure math for zone resize handles (8 handles per zone, axis-aware resizing, min-size clamping, screen-space hit detection)
- **connection-lines.ts** — pure math for connection routing, edge anchoring (ray-rect intersection), line-segment hit-testing, kind-based visual styles (all 12 connection kinds with distinct colors and dash patterns), and display labels
- **hotkeys.ts** — centralized keyboard shortcut registry with 13 bindings, `matchHotkey()` and `dispatchHotkey()` with input-field safety guard
- **PresetBrowser** — preset library UI with Region/Encounter sub-tabs, merge/overwrite mode, save-from-current, built-in protection
- **mode-profiles.ts** — `ModeProfile` interface and `MODE_PROFILES` record with grid defaults, connection kinds, zone tag suggestions, guide overrides (district, zone, spawn, player, npc), encounter types, default entity role, zone name pattern, and mode tip per authoring mode; `getModeProfile(mode)` with dungeon fallback; `getDefaultConnectionKind(mode)` returns the mode's primary connection kind
- **presets/** — preset type definitions (`RegionPreset`, `EncounterPreset` with `modes?: AuthoringMode[]`), built-in presets (9 region, 10 encounter: 3 universal + 7 mode-specific), `filterPresetsByMode()`, Zustand + localStorage preset store
- **kits/** — `StarterKit` type with multi-mode support, preset refs, guide hints, tags; 7 built-in kits wrapping mode starters; `useKitStore` (Zustand + localStorage CRUD with built-in protection); `filterKitsByMode()`; `validateKit()` with errors + warnings; barrel export via `index.ts`
- **templates/** — genre starters, mode starter templates (7 hand-built projects, one per mode, derived from `BUILTIN_KITS`), sample worlds (6 intermediate), `ModeStarter` interface, `MODE_STARTERS` array, `createProjectFromModeStarter()` factory
- **SpeedPanel** — double-right-click floating command palette with context-aware actions, pinnable favorites (reorder), recent actions, custom groups, lightweight macros, edit mode for CRUD, search filtering
- **speed-panel-actions.ts** — action registry with `SpeedPanelAction` interface (including `macroSafe` and `modeSuggested`), group/macro types, and `filterActions()` returning 6-section `FilteredActions` (pinned, groups, recents, macros, modeSuggested, contextual)
- **speed-panel-execute.ts** — extracted `executeAction()` and `executeMacro()` pure functions with `ExecuteStores` interface for testability
- **speed-panel-store.ts** — Zustand + localStorage store for pins (with reorder), recents, groups CRUD, macros CRUD, step management

## Build System

`tsc --build` at the root builds all packages in dependency order using TypeScript project references. Each package has its own `tsconfig.json` that references its dependencies. Vitest runs tests across the monorepo.
