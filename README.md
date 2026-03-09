<p align="center">
  <img src="./assets/logo.png" alt="World Forge" width="400">
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/world-forge/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@world-forge/schema"><img src="https://img.shields.io/npm/v/@world-forge/schema" alt="npm schema"></a>
  <a href="https://www.npmjs.com/package/@world-forge/export-ai-rpg"><img src="https://img.shields.io/npm/v/@world-forge/export-ai-rpg" alt="npm export"></a>
  <a href="https://www.npmjs.com/package/@world-forge/renderer-2d"><img src="https://img.shields.io/npm/v/@world-forge/renderer-2d" alt="npm renderer"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License"></a>
  <a href="https://mcp-tool-shop-org.github.io/world-forge/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page"></a>
</p>

<p align="center">2D world authoring studio for <a href="https://github.com/mcp-tool-shop-org/ai-rpg-engine">AI RPG Engine</a>.<br>One editor, many modes — paint zones, place entities, define districts, export a complete ContentPack ready to play.</p>

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

1. **Choose a mode** — dungeon, district, world, ocean, space, interior, or wilderness — to set grid defaults and connection vocabulary
2. **Start from a kit** — pick a starter kit or genre template from the Template Manager, or start blank
3. **Paint zones** — drag on the canvas to create zones, connect them, assign districts
4. **Place entities** — drop NPCs, enemies, merchants, encounters, and items onto zones
5. **Review** — open the Review tab for health status, content overview, and summary export (Markdown/JSON)
6. **Export** — download a ContentPack, project bundle (.wfproject.json), or review summary

### CLI Export

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Packages

### @world-forge/schema

Core TypeScript types and validation for world authoring.

- **Spatial types** — `WorldMap`, `Zone`, `ZoneConnection`, `District`, `Landmark`, `SpawnPoint`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`
- **Content types** — `EntityPlacement`, `ItemPlacement`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`
- **Visual layers** — `AssetEntry`, `AssetPack`, `Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`
- **Mode system** — `AuthoringMode` (7 modes), mode-specific grid/connection/validation profiles
- **Validation** — `validateProject()` (54 structural checks), `advisoryValidation()` (mode-specific suggestions)
- **Utilities** — `assembleSceneData()` (visual bindings with missing-asset detection), `scanDependencies()` (reference graph analysis), `buildReviewSnapshot()` (health classification)

### @world-forge/export-ai-rpg

Converts a `WorldProject` into ai-rpg-engine's `ContentPack` format.

- **Export** — zones, districts, entities, items, dialogues, player template, build catalog, progression trees, encounters, factions, hotspots, manifest, and pack metadata
- **Import** — 8 reverse converters reconstruct a WorldProject from exported JSON
- **Fidelity reporting** — structured tracking of what was lossless, approximated, or dropped during conversion
- **Format detection** — auto-detects WorldProject, ExportResult, ContentPack, and ProjectBundle formats
- **CLI** — `world-forge-export` command with `--out` and `--validate-only` flags

### @world-forge/renderer-2d

PixiJS-based 2D renderer: viewport with pan/zoom, zone overlays with district coloring, connection arrows, entity icons by role, tile layers, and a minimap.

### @world-forge/editor

React 19 + Vite web app with Zustand state management and undo/redo.

#### Workspace Tabs

| Tab | Purpose |
|-----|---------|
| Map | Zone/entity/district editing on the 2D canvas |
| Objects | Hierarchical tree: districts → zones → entities/landmarks/spawns |
| Player | Player template with stats, inventory, equipment, spawn |
| Builds | Archetypes, backgrounds, traits, disciplines, combos |
| Trees | Progression nodes with requirements and effects |
| Dialogue | Node editing, choice linking, broken-ref detection |
| Presets | Region and encounter preset browser with merge/overwrite |
| Assets | Asset library with kind-filtered search, orphan detection, asset packs |
| Issues | Live grouped validation with click-to-focus navigation |
| Deps | Dependency scanner with inline repair buttons |
| Review | Health dashboard, content overview, summary export |
| Guide | First-run checklist with hotkey reference |

#### Canvas & Editing

- **Tools** — select, zone-paint, connection, entity-place, landmark, spawn
- **Multi-select** — shift-click, box-select, Ctrl+A; drag-move with atomic undo
- **Alignment** — 6-way align (left/right/top/bottom/center-h/center-v) and horizontal/vertical distribution
- **Snapping** — drag-time snap to edges/centers of nearby objects with visual guide lines
- **Resize** — 8 handles per zone with edge snapping, min-size clamping, live preview
- **Duplicate** — Ctrl+D with remapped IDs, connections, and district assignments
- **Click-cycle** — repeated clicks at same position cycle through overlapping objects
- **Layers** — 7 visibility toggles (grid, connections, entities, landmarks, spawns, backgrounds, ambient)

#### Navigation & Shortcuts

- **Viewport** — pan/zoom camera, mousewheel zoom (cursor-anchored), spacebar/middle-mouse/right-click drag-pan, auto fit-to-content, double-click to center
- **Search** — Ctrl+K opens overlay to find any object by name/ID with keyboard navigation
- **Speed Panel** — double-right-click for a floating command palette with context-aware actions, pinnable favorites, macros, and mode-suggested quick actions
- **Hotkeys** — 13 keyboard shortcuts including Enter (open details), P (apply preset), Shift+P (save preset)

#### Import & Export

- **ContentPack** — one-click export to ai-rpg-engine format with full validation
- **Project bundles** — portable `.wfproject.json` files with provenance metadata and dependency info
- **Kit bundles** — `.wfkit.json` export/import with validation, collision handling, and provenance tracking
- **Import** — auto-detects 4 formats with structured fidelity reporting
- **Diff** — semantic change tracking since import
- **Scene preview** — inline HTML/CSS composition of all zone visual bindings

## Authoring Modes

World Forge separates **genre** (fantasy, cyberpunk, pirate) from **mode** (dungeon, ocean, space). Genre is flavor — mode is scale. Mode governs grid defaults, connection vocabulary, validation suggestions, guide wording, and preset filtering.

| Mode | Grid | Tile | Key Connections |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | door, stairs, passage, secret, hazard |
| District / City | 50×40 | 32 | road, door, passage, portal |
| Region / World | 80×60 | 48 | road, portal, passage |
| Ocean / Sea | 60×50 | 48 | channel, route, portal, hazard |
| Space | 100×80 | 64 | docking, warp, passage, portal |
| Interior | 20×15 | 24 | door, stairs, passage, secret |
| Wilderness | 60×50 | 48 | trail, road, passage, hazard |

Mode is set when creating a project and stored as `mode?: AuthoringMode` on `WorldProject`. Each mode provides **smart defaults** — connection kinds, entity roles, zone names, and Speed Panel suggestions adapt automatically.

## Authoring Surface

### World Structure

- Zones with spatial layout, neighbors, exits, light, noise, hazards, and interactables
- 12 connection kinds (passage, door, stairs, road, portal, secret, hazard, channel, route, docking, warp, trail) with distinct visual styles, edge-anchored routing, directional arrowheads, and conditional dashed styling
- Districts with faction control, economy profiles, metrics sliders, tags, and district name labels at zone centroids
- Landmarks (named points of interest within zones)
- Spawn points, encounter anchors (type-based coloring), faction presences, and pressure hotspots

### Content

- Entity placements with stats, resources, AI profiles, and custom metadata
- Item placements with slot, rarity, stat modifiers, and granted verbs
- Dialogue trees with branching conversations, conditions, and effects
- Encounter anchors on canvas — red diamond markers with boss/ambush/patrol types

### Character Systems

- Player template (starting stats, inventory, equipment, spawn point)
- Build catalog (archetypes, backgrounds, traits, disciplines, cross-titles, entanglements)
- Progression trees (skill/ability nodes with requirements and effects)

### Assets

- Asset manifest (portraits, sprites, backgrounds, icons, tilesets) with kind-specific bindings
- Asset packs (named, versioned groupings with compatibility metadata, theme, license)
- Scene preview (inline composition of all zone visual bindings with missing-asset detection)

### Workflow

- Region presets (9 built-in, mode-filtered) and encounter presets (10 built-in) with merge/overwrite application and custom preset CRUD
- Starter kits (7 built-in, mode-specific) with kit export/import (`.wfkit.json`), collision handling, and provenance tracking
- Ctrl+K search across all object types including connections and encounters
- Speed Panel command palette with pinnable favorites, macros, custom groups, and mode suggestions
- 13 centralized keyboard shortcuts
- Export to ContentPack JSON, project bundles, and review summaries
- Import from 4 formats with structured fidelity reporting and semantic diff tracking

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
