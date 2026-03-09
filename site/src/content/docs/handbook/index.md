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

- **Paint zones** on a 2D spatial grid with neighbors, exits, light, noise, hazards
- **Connect zones** with bidirectional or one-way links
- **Define districts** with faction control, economy profiles, base metrics
- **Place entities** — NPCs, enemies, merchants, companions, bosses — with stats, resources, AI profiles
- **Author dialogues** — branching conversation trees with conditions and effects
- **Place items** with slot, rarity, stat modifiers, and granted verbs
- **Manage assets** — portraits, sprites, backgrounds, icons, and tilesets in a typed manifest with kind-specific bindings to zones, entities, and items
- **Export** a validated ContentPack targeting ai-rpg-engine's content schema
- **Import** from ContentPack or ExportResult JSON with structured fidelity reporting
- **Track changes** with semantic diff — see exactly what was modified, added, or removed since import

## Packages

World Forge is a monorepo with four packages:

- `@world-forge/schema` — TypeScript types, validation, and the `WorldProject` container
- `@world-forge/export-ai-rpg` — conversion pipeline and CLI tool
- `@world-forge/renderer-2d` — PixiJS 2D canvas with pan, zoom, overlays, and minimap
- `@world-forge/editor` — React 19 web app with Zustand state management
