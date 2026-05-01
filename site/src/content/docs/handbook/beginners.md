---
title: Beginner's Guide
description: Your first world from blank canvas to exported ContentPack
sidebar:
  order: 99
---

This guide walks you through creating your first world in World Forge -- from installation to a playable ContentPack export. No prior experience with ai-rpg-engine is required.

## 1. What is World Forge?

World Forge is a 2D world authoring studio that produces content packs for [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine), [Unreal Engine 5](https://www.unrealengine.com/), and [Godot 4](https://godotengine.org/). You design worlds visually -- painting zones on a canvas, connecting them, placing entities with stats and AI profiles, writing branching dialogues -- then export everything as validated JSON that your engine can load directly.

World Forge is a monorepo with six packages:

| Package | What it does |
|---------|-------------|
| `@world-forge/schema` | TypeScript types, validation (60+ checks), and the `WorldProject` container |
| `@world-forge/export-ai-rpg` | Converts projects to ai-rpg-engine format; includes a CLI tool |
| `@world-forge/export-unreal` | Converts projects to Unreal Engine 5 format with 2.5D support; includes CLI |
| `@world-forge/export-godot` | Converts projects to Godot 4 format with `.tscn` scene generation |
| `@world-forge/renderer-2d` | PixiJS 2D canvas with pan, zoom, overlays, and minimap |
| `@world-forge/editor` | React 19 web app with Zustand state management and undo/redo |

## 2. Who is This For?

World Forge is built for game designers, content authors, and hobbyists who want to create playable worlds for ai-rpg-engine without writing JSON by hand. If you can use a drawing program, you can use World Forge -- the canvas-based editor handles spatial layout, validation, and export so you can focus on world design rather than data plumbing.

You do not need programming experience to use the editor. Familiarity with RPG concepts (zones, NPCs, items, stats) is helpful but not required -- the glossary at the end of this page defines every term.

Developers who want to integrate World Forge types or the export pipeline into their own tooling can use the published npm packages (`@world-forge/schema` and `@world-forge/export-ai-rpg`) directly.

## 3. Installation and Setup

**Prerequisites:** Node.js 20+ and npm 10+.

```bash
git clone https://github.com/mcp-tool-shop-org/world-forge
cd world-forge
npm install
npm run build
```

The build step runs `tsc --build`, which compiles all four packages in dependency order (schema first, then renderer-2d and export-ai-rpg, then editor).

Launch the editor:

```bash
npm run dev --workspace=packages/editor
```

Open `http://localhost:5173` in your browser. You will see the Template Manager.

### Verifying your setup

Run `npm run verify` to build and test everything in one command. If it exits cleanly, your environment is ready.

## 4. Core Concepts

### Projects

A **WorldProject** is the top-level container that holds your entire authored world: zones, connections, districts, entities, items, dialogues, assets, and configuration. Projects are saved as JSON and can be exported as ContentPacks or shared as `.wfproject.json` bundles.

### Authoring Modes

World Forge separates **genre** (fantasy, cyberpunk, pirate) from **mode** (dungeon, ocean, space). Genre is flavor -- mode is scale. They are orthogonal: a cyberpunk dungeon and a pirate ocean are both valid.

Seven modes are available, each with different grid sizes and connection types:

| Mode | Best for | Grid | Default connections |
|------|----------|------|-------------------|
| Dungeon | Rooms, corridors, caves | 30x25 | door, stairs, passage, secret, hazard |
| District / City | Neighborhoods, wards | 50x40 | road, door, passage, portal |
| Region / World | Continents, kingdoms | 80x60 | road, portal, passage |
| Ocean / Sea | Harbors, shipping lanes | 60x50 | channel, route, portal, hazard |
| Space | Stations, star systems | 100x80 | docking, warp, passage, portal |
| Interior | Cabins, single buildings | 20x15 | door, stairs, passage, secret |
| Wilderness | Trails, camps, forests | 60x50 | trail, road, passage, hazard |

Mode affects everything: grid defaults, connection vocabulary, zone naming patterns, entity role defaults, encounter types, preset filtering, guide checklist wording, and advisory validation.

### Zones, Connections, and Districts

- **Zones** are rectangular areas on the canvas (rooms, territories, sectors). Each has a name, tags, light/noise levels, hazards, and interactables.
- **Connections** link zones together. There are 12 connection kinds (passage, door, stairs, road, portal, secret, hazard, channel, route, docking, warp, trail). Connections can be bidirectional or one-way, and optionally conditional.
- **Districts** group zones into logical regions (a dungeon level, a city ward, a sea region) with faction control, economy profiles, and base metrics.

### Entities and Items

- **Entities** are characters placed in zones. Six roles are available: NPC, Enemy, Merchant, Quest Giver, Companion, and Boss. Each entity can have stats (vigor, instinct, will), resources (hp, stamina), an AI profile, and linked dialogue.
- **Items** are objects placed in zones with a slot, rarity, stat modifiers, and granted verbs.

### ContentPack

A **ContentPack** is the export format that ai-rpg-engine understands. It contains zones, districts, entities, items, dialogues, a player template, and metadata. The export pipeline validates your project (60+ structural checks) before converting it. World Forge also exports to Unreal Engine 5 (2.5D-aware content pack) and Godot 4 (.tscn scenes + resource pack).

## 5. Step-by-Step Tutorial

Follow these steps to build a small playable world.

### Step 1: Create a new project

In the Template Manager, choose an authoring mode. For your first world, **Dungeon** is a good choice -- it uses a compact grid and door/passage connections that are easy to visualize.

You have three starting options:
- **Blank project** -- empty canvas, build from scratch
- **Genre template** -- pre-themed project (fantasy, cyberpunk, pirate, detective, zombie)
- **Starter kit** -- fully built sample with 4 zones, entities, dialogues, encounters, and a player template

For learning, start with a **Starter Kit**. Pick the Dungeon starter to get a working project you can explore and modify.

### Step 2: Explore the canvas

The canvas is your main workspace. Use these controls to navigate:

| Action | Input |
|--------|-------|
| Pan | Right-click drag, Spacebar + drag, or middle-mouse drag |
| Zoom | Mousewheel (anchored to cursor position) |
| Fit all content | Click **Fit** in viewport controls |
| Reset view | Click **Reset** in viewport controls |

The starter kit comes with 4 zones already connected. Click a zone to select it -- you will see its properties in the right sidebar.

### Step 3: Paint a new zone

Select the **Zone** tool from the tool palette. Click and drag on the canvas to create a rectangular zone. Give it a name and description in the properties panel. Add tags like `indoor`, `dangerous`, or `hidden` to describe the environment.

### Step 4: Connect zones

Switch to the **Connection** tool. Click your new zone, then click an existing zone to draw a connection. The connection defaults to the mode's primary kind (door for dungeons). You can change the kind, toggle bidirectional/one-way, and add conditions in the Connection Properties panel.

### Step 5: Place an entity

Select the **Entity** tool. Click on your new zone to place an entity. Choose a role (Enemy is the default for dungeons). Set the entity's name, stats, and AI profile in the properties panel. If you want the entity to have dialogue, create a dialogue tree in the Dialogue tab first, then link it via the entity's `dialogueId` field.

### Step 6: Set a spawn point

Select the **Spawn** tool. Click on a zone to place a spawn point. Mark one spawn as "default" -- this is where the player starts. If you used a starter kit, a default spawn already exists.

### Step 7: Review and export

Open the **Review** tab to check your project's health. The health banner shows one of four states: Ready (green), Healthy (green), Degraded (amber), or Blocked (red). Fix any blocking validation errors shown in the Issues tab.

When the project is Ready or Healthy, click **Export** to open the Export modal. You'll see per-target readiness badges (✓ Ready / ⚠ advisories) for all three targets: AI RPG Engine, Unreal Engine 5, and Godot 4. Expand **Target Options** to configure engine-specific settings, then click the appropriate download button. Post-export receipts show file size, counts, and fidelity details.

## 6. Common Pitfalls

**No spawn point defined.** Every project needs at least one spawn point marked as default. Without it, the validator blocks export. Use the Spawn tool to place one and check the "default" box.

**Orphaned zone references.** If you delete a zone that other objects reference (connections, entity placements, spawn points), the validator reports broken references. Open the **Deps** tab to see all broken references and use the inline repair buttons to fix them.

**Forgetting to connect zones.** Zones without connections are isolated -- the player cannot reach them. The advisory validation warns about disconnected zones. Use the Connection tool to link every zone to at least one neighbor.

**Bidirectional mismatch.** If you create a one-way connection from A to B, the player cannot travel back from B to A. This is sometimes intentional (trap doors, one-way portals) but is a common mistake. Check connection directionality in the Connection Properties panel.

**Wrong asset kind.** Zone backgrounds must reference assets of kind `background`, entity portraits must be `portrait`, and so on. The Deps tab flags mismatched asset kinds and offers a relink button to pick the correct asset.

**Export with validation errors.** The export pipeline requires `validateProject()` to pass all 60+ structural checks. If export fails, check the Issues tab for the specific errors. Common blockers include missing spawn points, broken dialogue node references, and duplicate IDs.

## 7. Glossary

| Term | Definition |
|------|-----------|
| **AuthoringMode** | The scale setting for a project (dungeon, district, world, ocean, space, interior, wilderness). Governs grid size, connection vocabulary, and smart defaults. |
| **ContentPack** | The JSON export format that ai-rpg-engine loads. Contains zones, districts, entities, items, dialogues, and metadata. World Forge also exports UE5 and Godot 4 content packs. |
| **Connection** | A link between two zones. Has a kind (door, passage, trail, etc.), direction, and optional condition. |
| **District** | A group of zones forming a logical region with faction control, economy profile, and base metrics. |
| **EncounterAnchor** | A point in a zone where encounters can trigger during gameplay. Has a type (boss, patrol, ambush), probability, and cooldown. |
| **EntityPlacement** | A character placed in a zone with a role (NPC, enemy, merchant, boss, companion), stats, resources, and AI profile. |
| **FidelityReport** | A structured report generated during import that tracks what was lossless, approximated, or dropped during conversion. |
| **ItemPlacement** | An object placed in a zone with slot, rarity, stat modifiers, and granted verbs. |
| **Landmark** | A named point of interest within a zone. |
| **PlayerTemplate** | The player character's starting state: name, stats, inventory, equipment, and spawn point. |
| **Preset** | A reusable template for districts (region presets) or encounters (encounter presets). Can be built-in or custom. |
| **ProjectBundle** | A portable `.wfproject.json` file containing an entire project with metadata, for sharing or backup. |
| **SpawnPoint** | A location where the player or entities can appear. One must be marked as default for the player start. |
| **Speed Panel** | A floating command palette opened with double-right-click. Context-aware, supports pinned favorites, custom groups, and macros. |
| **StarterKit** | A pre-built project template (one per mode) that includes zones, entities, dialogues, and a player template. Exportable as `.wfkit.json`. |
| **WorldProject** | The top-level container holding an entire authored world. Everything in the editor is part of this structure. |
| **Zone** | A rectangular area on the canvas representing a distinct location (room, territory, sector) with spatial coordinates and environmental properties. |

:::tip[Accessibility]
World Forge supports keyboard-driven navigation, tool switching (V/Z/C/E/L/S), object-tree selection, validation, review, import, export, and modal workflows. Spatial canvas operations such as placement, box-select, resize, drawing connections, and panning remain pointer-based.
:::

## 8. Where to Go Next

- **[Editor Workflow](/world-forge/handbook/editor-workflow/)** -- detailed walkthrough of every editor feature, including selection, alignment, snapping, presets, and the Speed Panel
- **[Architecture](/world-forge/handbook/architecture/)** -- package structure, dependency graph, and design system details
- **[Schema & Types](/world-forge/handbook/schema/)** -- full type reference for WorldProject, validation rules, and viewport math
- **[AI RPG Export & Import](/world-forge/handbook/export/)** — how ContentPacks are built, the CLI tool, import pipeline, and fidelity reporting
- **[Unreal Export](/world-forge/handbook/export-unreal/)** — UE5 pipeline, pack format, signing, CLI
- **[Godot Export](/world-forge/handbook/export-godot/)** — Godot 4 pipeline, .tscn generation, editor options
- **[Security](/world-forge/handbook/security/)** — threat model and data boundaries
- **[GitHub repository](https://github.com/mcp-tool-shop-org/world-forge)** -- source code, issues, and the dogfood walkthrough
