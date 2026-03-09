<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/world-forge/readme.png" alt="World Forge" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema" alt="npm schema"></a>
  <a href="https://www.npmjs.com/package/@world-forge/export-ai-rpg"><img src="https://img.shields.io/npm/v/@world-forge/export-ai-rpg" alt="npm export"></a>
  <a href="https://www.npmjs.com/package/@world-forge/renderer-2d"><img src="https://img.shields.io/npm/v/@world-forge/renderer-2d" alt="npm renderer"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D world authoring studio for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>.<br>Paint zones, place entities, define districts — export a complete ContentPack ready to play.</p>

## Architecture

```
packages/
  schema/          @world-forge/schema        — spatial types, validation
  export-ai-rpg/   @world-forge/export-ai-rpg — engine export pipeline + CLI
  renderer-2d/     @world-forge/renderer-2d   — PixiJS 2D canvas renderer
  editor/          @world-forge/editor         — React web authoring app
```

## Quick Start

```bash
npm install
npm run build
npm run dev --workspace=packages/editor
```

Open `http://localhost:5173` to launch the editor.

### Editor Workflow

1. **Paint zones** — select the Zone tool, drag on the canvas to create rectangular zones
2. **Connect zones** — select the Connection tool, click zone A then zone B
3. **Create districts** — group zones into districts with faction and economy metadata
4. **Place entities** — drop NPCs, enemies, merchants, spawn points onto zones
5. **Export** — click Export to validate and download an ai-rpg-engine ContentPack

### CLI Export

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Packages

### @world-forge/schema

Core TypeScript types for world authoring: `WorldMap`, `Zone`, `ZoneConnection`, `District`, `EntityPlacement`, `ItemPlacement`, `SpawnPoint`, `Landmark`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`, visual layers (`Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`). Includes `validateProject()` with 32 structural checks.

### @world-forge/export-ai-rpg

Converts a `WorldProject` into ai-rpg-engine's `ContentPack` format — zones, districts, entities, items, dialogues, player template, build catalog, progression trees, manifest, and pack metadata. Full validation pipeline with gap analysis. Includes a complete **import pipeline** (8 reverse converters) that reconstructs a WorldProject from exported JSON, with structured **fidelity reporting** that tracks exactly what was lossless, approximated, or dropped during conversion.

### @world-forge/renderer-2d

PixiJS-based 2D renderer: viewport with pan/zoom, zone overlays with district coloring, connection arrows, entity icons by role, tile layers, and a minimap.

### @world-forge/editor

React 19 + Vite web app. Zustand state management with undo/redo. Workspace tabs: **Map** (zone/entity/district editing), **Player** (template with stats, inventory, equipment, spawn), **Builds** (archetypes, backgrounds, traits, disciplines, combos), **Trees** (progression nodes with requirements/effects), **Dialogue** (node editing, choice linking, broken-ref detection), **Issues** (live grouped validation with click-to-focus), **Guide** (first-run checklist), **Import** (fidelity report with domain-level breakdown), **Diff** (semantic change tracking since import). Tools: select, zone-paint, connection, entity-place, landmark, spawn.

## Authoring Surface

**World Forge currently authors:**

- Zones (spatial layout, neighbors, exits, light, noise, hazards, interactables)
- Connections (bidirectional/one-way, conditional exits)
- Districts (faction control, economy profiles, base metrics)
- Landmarks (named points of interest within zones)
- Entity placements with stats, resources, AI profiles, and custom metadata
- Item placements with slot, rarity, stat modifiers, and granted verbs
- Dialogue trees (branching conversations with conditions and effects)
- Player template (starting stats, inventory, equipment, spawn point)
- Build catalog (archetypes, backgrounds, traits, disciplines, cross-titles, entanglements)
- Progression trees (skill/ability nodes with requirements and effects)
- Spawn points, encounter anchors, pressure hotspots, faction presences
- Export to engine-compatible ContentPack JSON
- Import from ContentPack or ExportResult JSON with structured fidelity reporting
- Semantic diff tracking — see exactly what changed since import

See [`dogfood/WALKTHROUGH.md`](dogfood/WALKTHROUGH.md) for the Chapel Threshold export handshake proving the current surface.

## Engine Compatibility

Exports target [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) content types. The exported ContentPack can be loaded directly by [claude-rpg](https://github.com/mcp-tool-shop-org/claude-rpg).

## Security

- **Data touched:** project files on local disk (user-created JSON), no server-side storage
- **Data NOT touched:** no telemetry, no analytics, no network requests beyond local dev server
- **Permissions:** no API keys, no secrets, no credentials
- **No secrets, tokens, or credentials in source**

## License

MIT

---

Built by [MCP Tool Shop](https://mcp-tool-shop.github.io/)
