---
title: Godot Export Pipeline
description: How WorldProject becomes a Godot 4 content pack with .tscn scenes
sidebar:
  order: 7
---

The `@world-forge/export-godot` package converts a `WorldProject` into a structured content pack with `.tscn` scene generation for Godot 4.

## Pipeline Overview

1. **Validate** — `validateProject()` runs structural checks. Invalid projects fail with detailed error context.
2. **Convert zones** — `Zone[]` becomes Godot spatial resources with 2D coordinate transform (grid → Godot 2D).
3. **Convert content** — entities, items, connections, dialogues, loot tables, spawn markers, and transitions.
4. **Convert tiles + interiors** — `TileLayer[]` → `TileMapLayer` + `TileSet` (baked `tile_map_data` for image tilesets), non-walkable cells → wall `StaticBody2D` collision, and props → a `Node2D` container.
5. **Convert town** — markets + crafting stations, and buildings / hubs / strongholds (`convert-economy`, `convert-structures`).
6. **Convert world modeling** — vertical strata + links (`convert-strata`), typed hazards (`convert-hazards`), and zone entry gates (`convert-gates`).
7. **Build scene** — `buildWorldScene()` generates a single playable `.tscn` from all of the above.
8. **Build asset bindings** — sprites, portraits, and backgrounds mapped to Godot resource paths.
9. **Fidelity report** — structured tracking of lossless, approximated, and dropped data.

## Output

The export produces a `GodotContentPack` containing:

- Per-zone resources with spatial data
- Entity manifest with placement coordinates
- Navigation links between zones
- Transition nodes for scene changes
- Loot tables and spawn markers
- Dialogue resources
- District groupings with faction/economy data
- Asset binding manifest
- A world `.tscn` scene (optional, controlled by export options)

## Playable Scene Structure

`buildWorldScene()` emits a single `.tscn` that opens navigable in the Godot 4
editor — not a metadata graph. The root `Node2D` (y-sort enabled) contains:

- A framed **`Camera2D`** so the scene is visible the moment it opens.
- Per **zone**: a `Node2D` with a **`StaticBody2D` collision** hull, a
  **`NavigationRegion2D`** navmesh, `y_sort_enabled`, and a `z_index` derived from
  its stratum band (+ elevation).
- **`TileMapLayer`** nodes per tile layer (image tilesets bake `tile_map_data`
  cells; color-only layers carry a `TileSet` scaffold + metadata), each with
  per-cell wall `StaticBody2D` collision for non-walkable tiles.
- A **`Props`** container (`Node2D` placements).
- **Town**: `Markets` / `CraftingStations` containers, plus `Buildings`
  (`StaticBody2D` footprints with a `CollisionShape2D`), `Hubs`, and `Strongholds`.
- **`Strata`** + **`StratumLinks`** containers (metadata; zones carry `stratum_id`
  and a `z_index` band so surface layers sort over the cellar).
- **`Hazards`** — one **`Area2D`** per (zone, hazard) with an inline
  `CollisionShape2D` region; the hazard's effects ride as metadata, read on
  `body_entered`.
- Gated zones carry `entry_gate` / `entry_gate_mode` / `entry_gate_reason`
  metadata for the runtime to evaluate against party state on entry.

Every node is a textureless, self-contained engine primitive — the export loads
clean in **real Godot 4.7 headless** (the dogfood smoke asserts 36 facts about the
generated scene, from zone collision to the cellar's underground `z_index` band).

## Programmatic Usage

```typescript
import { exportToGodot } from '@world-forge/export-godot';

const result = exportToGodot(project);

// result.pack — full GodotContentPack
// result.scenes — .tscn scene text per zone
// result.fidelity — structured fidelity report
```

## Editor Export Options

When exporting from the editor's Export modal, the **Godot 4** target options panel provides:

| Option | Default | Effect |
|--------|---------|--------|
| Entity scene prefix | `res://entities/` | Resource path prefix for entity scenes |
| Transition scene prefix | `res://transitions/` | Resource path prefix for transition scenes |
| Include world .tscn | ✓ enabled | Whether to generate the top-level world scene |
| Asset binding mode | `manifest` | How assets are referenced: `manifest` (centralized) or `manual` (inline paths) |

These settings are embedded in the exported bundle's `exportSettings` field for downstream tooling to consume.

## Coordinate Transform

World Forge grid coordinates are converted to Godot 2D coordinates:

- Grid position → Godot `Vector2` in pixels
- Zone dimensions map to scene node bounds
- Entity placements become positioned child nodes

## Fidelity Reporting

Every export produces a structured fidelity report tracking what was preserved, approximated, or dropped:

- **Lossless** — zones, entities, items, connections, dialogues, spawn points, tile cells (image tilesets), wall collision
- **Approximated** — town economy + structures, vertical strata, hazards, and entry gates (emitted as nodes + metadata the runtime drives); parallax (no `ParallaxBackground` node emitted yet); position-default fallbacks
- **Dropped** — references with no matching definition (e.g. a zone hazardRef with no `HazardDefinition`), reported with the offending id

Fidelity is grouped by domain (`zones`, `tiles`, `props`, `economy`,
`structures`, `navigation`, …) so you can see exactly what each subsystem
contributed.

## Format Version

`GODOT_PACK_FORMAT_VERSION` — currently `1.0.0`.
