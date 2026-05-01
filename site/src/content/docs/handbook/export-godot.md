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
3. **Convert entities** — `EntityPlacement[]` becomes an actor manifest with stats, roles, and placement data.
4. **Convert items** — `ItemPlacement[]` becomes resource definitions with slot, rarity, and stat modifiers.
5. **Convert connections** — `ZoneConnection[]` becomes navigation links and transition scene nodes.
6. **Convert dialogues** — `DialogueDefinition[]` becomes branching conversation resources.
7. **Build loot tables** — probability-weighted drop definitions from item placements.
8. **Build scenes** — `buildWorldScene()` generates `.tscn` scene text via the `.tres` serializer.
9. **Build asset bindings** — sprites, portraits, and backgrounds mapped to Godot resource paths.
10. **Fidelity report** — structured tracking of lossless, approximated, and dropped data.

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

- **Lossless** — zones, entities, items, connections, dialogues, spawn points
- **Approximated** — coordinate precision, some metadata fields
- **Dropped** — visual layers not representable in Godot's resource format

## Format Version

`GODOT_PACK_FORMAT_VERSION` — currently `1.0.0`.
