---
title: Welcome to World Forge
description: 2D world authoring studio for AI RPG Engine
sidebar:
  order: 0
---

World Forge is a 2D / 2.5D world authoring studio that produces complete content packs for [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine), [Unreal Engine 5](https://www.unrealengine.com/), and [Godot 4](https://godotengine.org/). You paint zones on a canvas, define districts and factions, place entities with stats and AI profiles, author branching dialogue trees, then export everything as a validated content pack ready for your engine of choice.

![World Forge canvas — zones, connections, and a painted island world](/screenshots/editor-canvas.jpg)

## The Ecosystem

World Forge is the authoring end of a three-layer authoring-to-play pipeline:

| Layer | Project | Role |
|-------|---------|------|
| Authoring | **World Forge** | Creates worlds and exports them for all three engines |
| Runtime | **[ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine)** | Simulation truth — stats, combat, economy, faction pressure. Loads an exported ContentPack and runs it. |
| Client | **[ai-rpg-stage](https://github.com/mcp-tool-shop-org/ai-rpg-stage)** | Godot 4 client that renders the running simulation and submits player intents |

## What World Forge Does

- **Choose an authoring mode** — dungeon, district, world, ocean, space, interior, or wilderness — to adapt grid size, connection vocabulary, validation, and guide text to your world's scale
- **Paint zones** on a 2D spatial grid with neighbors, exits, light, noise, hazards
- **Connect zones** with bidirectional or one-way links using 12 connection kinds (passage, door, stairs, road, portal, secret, hazard, channel, route, docking, warp, trail)
- **Define districts** with faction control, economy profiles, base metrics
- **Place entities** — NPCs, enemies, merchants, companions, bosses — with stats, resources, AI profiles
- **Author dialogues** — branching conversation trees with conditions and effects
- **Place items** with slot, rarity, stat modifiers, and granted verbs
- **Manage assets** — portraits, sprites, backgrounds, icons, and tilesets in a typed manifest with kind-specific bindings to zones, entities, and items
- **Paint tiles and dress interiors** — image-backed tilesets (sliced by row/column) with a colored-rect fallback, a drag brush, layers, and a per-tile "Solid" toggle that becomes real wall collision on export; plus prop placement for interior detailing
- **Author towns** — market nodes (supply categories, price modifier, contraband) and crafting stations per zone, plus buildings (enterable footprints that link to an interior zone), service hubs, and fortified strongholds
- **Model the world vertically** — discrete strata (surface / underground / sky, or building floors) with signed order, z-range, and inter-layer visibility, connected by stairs, ladders, and elevators
- **Author typed hazards** — a shared library of damage / status / instakill / ignite effects with trigger timing, terrain move-cost, passability, and weather gating, referenced per zone
- **Gate zones on party state** — block or advise entry on party level, party size, items, flags, specific members, or classes, with an authored reason so a locked door explains itself
- **Search & browse** — Ctrl+K fuzzy search across all object types with recent history, hierarchical Objects tree panel
- **Select & edit** — multi-select, box-select, drag-move, Ctrl+D duplicate, Ctrl+C/V copy-paste with ID remapping
- **Canvas tools** — minimap, viewport culling, connection preview, context menu, per-object visibility, performance stats overlay
- **Auto-save** — 30-second throttled auto-save with 3-version recovery history
- **Templates** — 6 layout templates (zone arrangements) and 5 dialogue templates (conversation starters)
- **Batch operations** — zone merge, batch entity placement (grid/random/circle patterns)
- **Theme** — dark/light mode toggle with localStorage persistence
- **Export** a validated content pack targeting AI RPG Engine, Unreal Engine 5, or Godot 4 — with per-target readiness badges, configurable options, and post-download receipts
- **Import** from ContentPack or ExportResult JSON with structured fidelity reporting and repair suggestions
- **Track changes** with semantic diff — see exactly what was modified, added, or removed since import
- **Review projects** — Review tab with health status, content overview, statistics, project metadata editor, and downloadable summaries (Markdown/JSON)
- **Manage dependencies** — Deps tab scans broken, mismatched, and orphaned references with one-click repair
- **Starter kits** — 7 built-in mode-specific kits, custom kit authoring, kit import/export (.wfkit.json)
- **Project bundles** — portable .wfproject.json files for sharing whole projects with dependency metadata
- **Speed Panel** — double-right-click command palette with pinned favorites, macros, and mode-suggested actions

## Packages

World Forge is a monorepo with six packages:

- `@world-forge/schema` — TypeScript types, validation, and the `WorldProject` container
- `@world-forge/export-ai-rpg` — AI RPG Engine conversion pipeline and CLI tool
- `@world-forge/export-unreal` — Unreal Engine 5 export pipeline with 2.5D support, signing, and CLI
- `@world-forge/export-godot` — Godot 4 export pipeline with `.tscn` scene generation
- `@world-forge/renderer-2d` — PixiJS 2D canvas with pan, zoom, overlays, and minimap
- `@world-forge/editor` — React 19 web app with Zustand state management, auto-save, undo labels, and dark/light theme
