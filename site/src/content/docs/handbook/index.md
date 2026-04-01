---
title: Welcome to World Forge
description: 2D world authoring studio for AI RPG Engine
sidebar:
  order: 0
---

World Forge is a 2D world authoring studio that produces complete content packs for [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine). You paint zones on a canvas, define districts and factions, place entities with stats and AI profiles, author branching dialogue trees, then export everything as a validated ContentPack ready to play in [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## The Ecosystem

World Forge is one of three projects that form the authoring-to-play pipeline:

| Project | Role |
|---------|------|
| **ai-rpg-engine** | Simulation truth — stats, combat, economy, faction pressure |
| **claude-rpg** | Flagship campaign product — plays the worlds |
| **World Forge** | Authoring surface — creates and exports the worlds |

## What World Forge Does

- **Choose an authoring mode** — dungeon, district, world, ocean, space, interior, or wilderness — to adapt grid size, connection vocabulary, validation, and guide text to your world's scale
- **Paint zones** on a 2D spatial grid with neighbors, exits, light, noise, hazards
- **Connect zones** with bidirectional or one-way links using 12 connection kinds (passage, door, stairs, road, portal, secret, hazard, channel, route, docking, warp, trail)
- **Define districts** with faction control, economy profiles, base metrics
- **Place entities** — NPCs, enemies, merchants, companions, bosses — with stats, resources, AI profiles
- **Author dialogues** — branching conversation trees with conditions and effects
- **Place items** with slot, rarity, stat modifiers, and granted verbs
- **Manage assets** — portraits, sprites, backgrounds, icons, and tilesets in a typed manifest with kind-specific bindings to zones, entities, and items
- **Search & browse** — Ctrl+K fuzzy search across all object types with recent history, hierarchical Objects tree panel
- **Select & edit** — multi-select, box-select, drag-move, Ctrl+D duplicate, Ctrl+C/V copy-paste with ID remapping
- **Canvas tools** — minimap, viewport culling, connection preview, context menu, per-object visibility, performance stats overlay
- **Auto-save** — 30-second throttled auto-save with 3-version recovery history
- **Templates** — 6 layout templates (zone arrangements) and 5 dialogue templates (conversation starters)
- **Batch operations** — zone merge, batch entity placement (grid/random/circle patterns)
- **Theme** — dark/light mode toggle with localStorage persistence
- **Export** a validated ContentPack targeting ai-rpg-engine's content schema
- **Import** from ContentPack or ExportResult JSON with structured fidelity reporting and repair suggestions
- **Track changes** with semantic diff — see exactly what was modified, added, or removed since import
- **Review projects** — Review tab with health status, content overview, statistics, project metadata editor, and downloadable summaries (Markdown/JSON)
- **Manage dependencies** — Deps tab scans broken, mismatched, and orphaned references with one-click repair
- **Starter kits** — 7 built-in mode-specific kits, custom kit authoring, kit import/export (.wfkit.json)
- **Project bundles** — portable .wfproject.json files for sharing whole projects with dependency metadata
- **Speed Panel** — double-right-click command palette with pinned favorites, macros, and mode-suggested actions

## Packages

World Forge is a monorepo with four packages:

- `@world-forge/schema` — TypeScript types, validation, and the `WorldProject` container
- `@world-forge/export-ai-rpg` — conversion pipeline and CLI tool
- `@world-forge/renderer-2d` — PixiJS 2D canvas with pan, zoom, overlays, and minimap
- `@world-forge/editor` — React 19 web app with Zustand state management, auto-save, undo labels, and dark/light theme
