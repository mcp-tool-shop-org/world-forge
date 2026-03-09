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

Core TypeScript types for world authoring: `WorldMap`, `Zone`, `ZoneConnection`, `District`, `EntityPlacement`, `ItemPlacement`, `SpawnPoint`, `Landmark`, `EncounterAnchor`, `FactionPresence`, `PressureHotspot`, `DialogueDefinition`, `PlayerTemplate`, `BuildCatalogDefinition`, `ProgressionTreeDefinition`, `AssetEntry`, `AssetPack`, visual layers (`Tileset`, `TileLayer`, `PropDefinition`, `AmbientLayer`). Includes `AuthoringMode` type (7 modes: dungeon, district, world, ocean, space, interior, wilderness), `validateProject()` with 54 structural checks, `advisoryValidation()` with mode-specific suggestions. `assembleSceneData()` extracts all visual bindings for a zone with missing-asset detection.

### @world-forge/export-ai-rpg

Converts a `WorldProject` into ai-rpg-engine's `ContentPack` format — zones, districts, entities, items, dialogues, player template, build catalog, progression trees, encounter anchors, faction presences, pressure hotspots, manifest, and pack metadata. Full validation pipeline with gap analysis. Includes a complete **import pipeline** (8 reverse converters) that reconstructs a WorldProject from exported JSON, with structured **fidelity reporting** that tracks exactly what was lossless, approximated, or dropped during conversion. Asset manifests, bindings, asset packs, encounter anchors, faction presences, and pressure hotspots are preserved through ExportResult round-trips.

### @world-forge/renderer-2d

PixiJS-based 2D renderer: viewport with pan/zoom, zone overlays with district coloring, connection arrows, entity icons by role, tile layers, and a minimap.

### @world-forge/editor

React 19 + Vite web app. Zustand state management with undo/redo. **Authoring modes** (dungeon/district/world/ocean/space/interior/wilderness) adapt grid defaults, connection vocabulary, preset filtering, guide text, and advisory suggestions to the world's scale. Workspace tabs: **Map** (zone/entity/district editing), **Objects** (hierarchical tree: districts → zones → entities/landmarks/spawns, click-to-select+frame, bidirectional highlights), **Player** (template with stats, inventory, equipment, spawn), **Builds** (archetypes, backgrounds, traits, disciplines, combos), **Trees** (progression nodes with requirements/effects), **Dialogue** (node editing, choice linking, broken-ref detection), **Assets** (asset library with kind-filtered search, inline editing, orphan detection, asset pack management with group-by-pack view), **Issues** (live grouped validation with click-to-focus), **Presets** (region and encounter preset browser with merge/overwrite apply, save-from-current, built-in + custom presets), **Guide** (first-run checklist with hotkey reference), **Import** (fidelity report with domain-level breakdown), **Diff** (semantic change tracking since import). Tools: select, zone-paint, connection, entity-place, landmark, spawn. **Search / command-jump** — Ctrl+K opens overlay to find any object by name/ID with keyboard navigation. **Multi-select** — shift-click, box-select, Ctrl+A; drag-move with atomic undo; Ctrl+D to duplicate selected with remapped IDs/connections. **Align & distribute** — 6-way alignment (left/right/top/bottom/center-h/center-v) and even horizontal/vertical distribution for any selection of 2+ objects. **Object snapping** — drag-time snap to edges/centers of non-selected objects with visual guide lines and live drag preview. **Click-cycle** — repeated clicks at same position cycle through overlapping objects. **Canvas viewport** — pan/zoom camera with `ctx.setTransform()`, mousewheel zoom (cursor-anchored), spacebar/middle-mouse drag-pan, auto fit-to-content on project load, double-click to select and center on any object. **Viewport controls** — zoom +/-, Fit (frame all content), Center (frame selected zone), Reset (return to origin). **Centralized hotkey registry** — 13 keyboard shortcuts including Enter (open details), P (apply preset), Shift+P (save preset). **Speed Panel** — double-right-click canvas to open a floating command palette with context-aware actions, pinnable favorites (reorder in edit mode), recent actions, custom groups, lightweight macros with step editor and abort feedback, and mode-suggested quick actions. **Scene Preview** — inline composed preview in ZoneProperties showing background, entities, landmarks, items, spawns, ambient layers, connections, and light level with missing-asset markers. **Layer toggles** — 7 visibility controls (Grid, Connections, Entities, Landmarks, Spawns, Backgrounds, Ambient) driving both canvas and scene preview. **Spatial legibility** — zone labels with dark background pills, zoom-compensated markers and line widths, stronger selection/hover states.

## Authoring Modes

World Forge separates **genre** (fantasy, cyberpunk, pirate) from **mode** (dungeon, ocean, space). Genre is flavor — mode is scale. A cyberpunk dungeon and a pirate ocean are both valid. Mode governs grid defaults, connection vocabulary, validation suggestions, guide wording, and preset filtering.

| Mode | Grid | Tile | Key Connections |
|------|------|------|-----------------|
| Dungeon | 30×25 | 32 | door, stairs, passage, secret, hazard |
| District / City | 50×40 | 32 | road, door, passage, portal |
| Region / World | 80×60 | 48 | road, portal, passage |
| Ocean / Sea | 60×50 | 48 | channel, route, portal, hazard |
| Space | 100×80 | 64 | docking, warp, passage, portal |
| Interior | 20×15 | 24 | door, stairs, passage, secret |
| Wilderness | 60×50 | 48 | trail, road, passage, hazard |

Mode is set when creating a new project (mode picker in the wizard) and stored as `mode?: AuthoringMode` on `WorldProject`. Existing projects without a mode are treated as `'dungeon'`. Importing pre-mode projects triggers heuristic inference from connection kinds and grid area. The **Mode Starters** tab in the Template Manager provides a fully built starter project for each mode — 4 zones, entities, dialogues, encounters, and a complete player template ready to explore.

Modes provide **smart defaults** during editing — creating a connection in ocean mode defaults to `channel`, placing an entity in dungeon mode defaults to `enemy`, new zones are named by mode pattern (`Chamber 1`, `Waters 1`, `Sector 1`), and the Speed Panel surfaces mode-relevant quick actions.

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
- Asset manifest (portraits, sprites, backgrounds, icons, tilesets) with kind-specific bindings
- Asset packs (named, versioned groupings with compatibility metadata, theme, license)
- Canvas viewport with pan, zoom, fit-to-content, center-on-selection, and spatial legibility
- Multi-select (shift-click, box-select, Ctrl+A), drag-move, Ctrl+D duplicate, click-cycle disambiguation
- Align (left/right/top/bottom/center-h/center-v) and distribute (horizontal/vertical) for any selection
- Object-to-object snapping during drag with visual guide lines, drag preview, and toggleable snap control
- Zone resize handles (8 handles per zone) with edge-specific snapping, min-size clamping, and live preview
- Connection selection, editing, and deletion — click connections to inspect/edit label, kind, direction, and conditions
- 12 connection kinds (passage, door, stairs, road, portal, secret, hazard, channel, route, docking, warp, trail) with distinct visual styles and canvas labels
- Edge-anchored connection routing with directional arrowheads and conditional dashed-line styling
- Encounter anchors on canvas — red diamond markers at zone center with type-based coloring (boss, ambush, patrol), selectable and editable
- District panel with metrics sliders, tags, controlling faction, economy profile, faction presence editing, pressure hotspot editing, and district removal
- District name labels at zone centroids when zoomed in
- Search / command-jump (Ctrl+K) across all object types including connections and encounters
- Object list panel with hierarchical district → zone → entity/landmark/spawn/encounter tree view plus connections section
- Scene preview (inline HTML/CSS composition of all zone visual bindings with missing-asset detection)
- Layer visibility toggles (7 layers: grid, connections, entities, landmarks, spawns, backgrounds, ambient)
- Spawn points, encounter anchors, pressure hotspots, faction presences
- Region presets (9 built-in, mode-filtered) and encounter presets (10 built-in: 3 universal + 7 mode-specific) with merge/overwrite application, custom preset CRUD
- Centralized hotkey registry with 13 shortcuts including Enter (open details), P (apply preset), Shift+P (save preset)
- Double-click any canvas object to select and open its details panel
- Speed Panel (double-right-click) — floating command palette with context-aware actions, pinnable favorites with reorder, recent actions, custom groups, lightweight macros, and mode-suggested quick actions (edit mode for CRUD)
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
