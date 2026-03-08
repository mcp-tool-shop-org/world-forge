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
- **Visual types** — `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Container** — `WorldProject` interface that holds everything
- **Validation** — `validateProject()` with 17 structural checks

## @world-forge/export-ai-rpg

Converts a `WorldProject` into ai-rpg-engine's `ContentPack` format. Five converters handle the transformation:

| Converter | Input | Output |
|-----------|-------|--------|
| `convertZones` | Zone[] | ZoneDefinition[] |
| `convertDistricts` | District[] | DistrictDefinition[] |
| `convertEntities` | EntityPlacement[] | EntityBlueprint[] |
| `convertItems` | ItemPlacement[] | ItemDefinition[] |
| `convertDialogues` | DialogueDefinition[] | DialogueDefinition[] |

The `exportToEngine()` function orchestrates validation, conversion, manifest generation, and warning collection.

A CLI tool (`world-forge-export`) wraps the pipeline for command-line use.

## @world-forge/renderer-2d

PixiJS-based 2D renderer with six sub-renderers:

- **WorldViewport** — Application wrapper with pan, zoom, grid overlay
- **ZoneOverlayRenderer** — zone boundaries with district coloring, selection/hover
- **ConnectionRenderer** — lines between zones, arrows for one-way connections
- **EntityRenderer** — role-based icons (NPC, enemy, merchant, boss)
- **TileLayerRenderer** — z-ordered tile layers with tag-based coloring
- **MinimapRenderer** — scaled overview with viewport indicator

## @world-forge/editor

React 19 + Vite web app. State management with Zustand, supporting undo/redo (10-deep stack). Tools: select, zone-paint, connection, entity-place, landmark, spawn. Panels: zone properties, district editor, entity reference, export modal.

## Build System

`tsc --build` at the root builds all packages in dependency order using TypeScript project references. Each package has its own `tsconfig.json` that references its dependencies. Vitest runs tests across the monorepo.
