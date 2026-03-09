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

- **Spatial types** — `WorldMap`, `Zone`, `ZoneConnection`, `Landmark`
- **District types** — `District`, `FactionPresence`, `PressureHotspot`
- **Entity types** — `EntityPlacement`, `ItemPlacement`, `SpawnPoint`, `EncounterAnchor`
- **Dialogue types** — `DialogueDefinition`, `DialogueNode`, `DialogueChoice`, `DialogueCondition`, `DialogueEffect`
- **Asset types** — `AssetEntry`, `AssetKind`, `AssetProvenance`
- **Visual types** — `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Container** — `WorldProject` interface that holds everything
- **Validation** — `validateProject()` with 42 structural checks (including asset ref + kind validation)

## @world-forge/export-ai-rpg

Bidirectional conversion between `WorldProject` and ai-rpg-engine's `ContentPack` format.

**Export** — 9 converters transform WorldProject domains into engine types. `exportToEngine()` orchestrates validation, conversion, manifest generation, and warning collection. A CLI tool (`world-forge-export`) wraps the pipeline.

**Import** — 8 reverse converters reconstruct a WorldProject from exported JSON. `importProject()` auto-detects the format (WorldProject, ExportResult, or ContentPack) and orchestrates all converters.

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

React 19 + Vite web app. State management with Zustand, supporting undo/redo (10-deep stack). Tools: select, zone-paint, connection, entity-place, landmark, spawn. Workspace tabs: Map, Objects, Player, Builds, Trees, Dialogue, Assets, Issues, Guide, plus conditional Import (fidelity report) and Diff (semantic change tracking) tabs after importing a project.

Key editor modules:

- **SearchOverlay** — Ctrl+K command-jump across all object types (zones, entities, landmarks, spawns, districts, dialogues, progression trees)
- **ObjectListPanel** — hierarchical tree view (districts → zones → entities/landmarks/spawns) with bidirectional selection and inline filter
- **duplicate.ts** — pure function for duplicating selections with ID remapping, connection rewiring, and district preservation
- **frame-helpers.ts** — shared viewport framing utility (`computeFrameViewport`) used by search, object list, and district panels
- **hit-testing.ts** — pure math hit-testing (`findHitAt`, `findAllHitsAt`) with click-cycle disambiguation for overlapping objects

## Build System

`tsc --build` at the root builds all packages in dependency order using TypeScript project references. Each package has its own `tsconfig.json` that references its dependencies. Vitest runs tests across the monorepo.
