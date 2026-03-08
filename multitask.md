# World Forge — 2D World Authoring Studio for AI RPG Engine

> **Coordination rule:** Before starting a task, mark it `[IN PROGRESS by <your-id>]`.
> Check that no other Claude has already claimed it. If claimed, pick the next unclaimed task.
> When done, mark `[DONE by <your-id>]` and note what files were changed.
> If a task depends on another, wait until the dependency is marked DONE.

## Repos

- **World Forge:** `F:\AI\world-forge` (monorepo, `packages/*`)
- **Engine (read-only reference):** `F:\AI\ai-rpg-engine` (target export format)
- **Product (read-only reference):** `F:\AI\claude-rpg` (consumer of world packs)

## Design Principles

1. **The map is not the simulation.** The map is a spatial scaffold for the simulation.
2. **Engine owns truth.** World Forge creates places; ai-rpg-engine runs the laws.
3. **AI RPG-native.** The editor knows about districts, factions, rumors, scarcity, pressure zones — not generic tile painting.
4. **Schema-first.** Everything flows from `@world-forge/schema`. No code without types.

## Target Export Format

World Forge exports to ai-rpg-engine's `ContentPack` format:
- `EntityBlueprint[]` — NPCs, enemies, player template
- `ZoneDefinition[]` — rooms/locations with neighbors, exits, tags, light, hazards
- `DistrictDefinition[]` — zone groupings with faction control, base metrics
- `DialogueDefinition[]` — NPC dialogue trees
- `ItemDefinition[]` — equipment catalog
- `BuildCatalog` — character creation data (archetypes, backgrounds, traits)
- `PackMetadata` — id, name, genres, tones, difficulty, narrator tone
- `GameManifest` — version, ruleset, modules

Reference files:
- `ai-rpg-engine/packages/content-schema/src/schemas.ts` — all content types
- `ai-rpg-engine/packages/content-schema/src/validate.ts` — validation logic
- `ai-rpg-engine/packages/core/src/types.ts` — runtime types
- `ai-rpg-engine/packages/starter-fantasy/src/content.ts` — example world pack
- `ai-rpg-engine/packages/modules/src/district-core.ts` — district types
- `ai-rpg-engine/packages/pack-registry/src/types.ts` — pack metadata
- `ai-rpg-engine/packages/character-creation/src/types.ts` — build catalog
- `ai-rpg-engine/packages/equipment/src/types.ts` — item catalog

---

## Track A: Monorepo Scaffold

### A1. Initialize monorepo structure
- [DONE by A] **Create npm workspaces monorepo with shared tooling** — root package.json, tsconfig.base.json, 4 package stubs, vitest, .gitignore, .editorconfig
  - Root `package.json` with `"private": true`, `"workspaces": ["packages/*"]`
  - Root `tsconfig.json` with project references
  - Root `tsconfig.base.json` with shared compiler options (ES2022, NodeNext, strict)
  - `.gitignore` — node_modules, dist, .turbo, site/.astro, site/dist
  - `.editorconfig`
  - Create empty package stubs:
    - `packages/schema/` — `@world-forge/schema`
    - `packages/export-ai-rpg/` — `@world-forge/export-ai-rpg`
    - `packages/renderer-2d/` — `@world-forge/renderer-2d`
    - `packages/editor/` — `@world-forge/editor`
  - Each package gets: `package.json`, `tsconfig.json`, `src/index.ts`
  - Root scripts: `"build": "npm run build --workspaces"`, `"test": "vitest run"`, `"verify": "npm run build && npm run test"`
  - **Files:** `package.json`, `tsconfig.json`, `tsconfig.base.json`, `.gitignore`, all `packages/*/package.json`

### A2. CI workflow
- [DONE by A] **Add GitHub Actions CI** — paths-gated, Node 20+22, concurrency group
  - `.github/workflows/ci.yml`
  - Triggers: push to `packages/**`, `package.json`, `.github/workflows/**`, plus `workflow_dispatch`
  - Node 20 + 22 matrix (1 OS: ubuntu-latest)
  - Steps: install → build → test
  - Concurrency group per rules
  - **Files:** `.github/workflows/ci.yml`

### A3. Initial commit and push
- [DONE by A] **Push scaffold to GitHub** — 23f6ce7 pushed
  - Verify: `git remote -v` shows `mcp-tool-shop-org/world-forge`
  - Verify: `git branch --show-current` shows `main`
  - Commit: `feat: monorepo scaffold with 4 package stubs`
  - Push, verify CI passes
  - **Files:** all scaffold files

---

## Track B: @world-forge/schema — Spatial Data Types

This is the heart. Everything depends on it.

### B1. Core spatial types
- [DONE by A] **Define map, zone, and connection types**
  - `packages/schema/src/spatial.ts`:
    ```typescript
    WorldMap — top-level container
      id, name, description, gridWidth, gridHeight, tileSize

    Zone — a named area on the map
      id, name, tags[], description
      gridX, gridY, gridWidth, gridHeight (tile coords)
      neighbors[] (adjacent zone IDs)
      exits[] (labeled transitions with optional conditions)
      light (0-10), noise, hazards[]
      interactables[] (named objects)
      parentDistrictId?

    ZoneConnection — explicit link between two zones
      fromZoneId, toZoneId, label?, bidirectional (default true)
      condition? (gate/lock)

    Landmark — named point of interest within a zone
      id, name, zoneId, gridX, gridY
      tags[], description?
      interactionType: 'inspect' | 'use' | 'enter' | 'talk' | 'none'
    ```
  - `packages/schema/src/index.ts` — re-export all types
  - **Files:** `packages/schema/src/spatial.ts`, `packages/schema/src/index.ts`

### B2. District and faction overlay types
- [DONE by A] **Define district grouping and faction presence types**
  - `packages/schema/src/districts.ts`:
    ```typescript
    District — aggregates zones into a region
      id, name, zoneIds[]
      tags[] (e.g., 'sacred', 'underground', 'market')
      controllingFaction?
      baseMetrics: { commerce, morale, safety, stability }
      economyProfile: { supplyCategories[], scarcityDefaults }

    FactionPresence — faction footprint on the map
      factionId, districtIds[]
      influence (0-100), alertLevel (0-100)
      patrolRoutes?: ZoneConnection[] (zones faction patrols)

    PressureHotspot — zone where world pressures spawn
      id, zoneId, pressureType, baseProbability, tags[]
    ```
  - **Files:** `packages/schema/src/districts.ts`

### B3. Entity placement and spawn types
- [DONE by A] **Define NPC, enemy, and item placement types**
  - `packages/schema/src/entities.ts`:
    ```typescript
    EntityPlacement — where an entity spawns
      entityId, zoneId, gridX?, gridY?
      role: 'npc' | 'enemy' | 'merchant' | 'quest-giver' | 'companion' | 'boss'
      spawnCondition?
      factionId?
      dialogueId? (links to dialogue tree)

    ItemPlacement — where an item can be found
      itemId, zoneId, gridX?, gridY?
      container?: string (e.g., 'chest', 'corpse', 'shelf')
      hidden: boolean

    EncounterAnchor — point where encounters can trigger
      id, zoneId, encounterType
      enemyIds[], probability, cooldownTurns
      tags[]

    SpawnPoint — player start position
      id, zoneId, gridX, gridY
      isDefault: boolean

    CraftingStation — world-placed crafting point
      id, zoneId, stationType
      availableRecipes[]

    MarketNode — trade/shop point
      id, zoneId, merchantEntityId?
      supplyCategories[], priceModifier
      contrabandAvailable: boolean
    ```
  - **Files:** `packages/schema/src/entities.ts`

### B4. Visual layer types
- [DONE by A] **Define tileset, tile, and visual layer types**
  - `packages/schema/src/visual.ts`:
    ```typescript
    Tileset — a set of tiles for a biome/style
      id, name, tileWidth, tileHeight
      imagePath?, imageWidth?, imageHeight?
      tiles: TileDefinition[]

    TileDefinition — single tile in a tileset
      id, tilesetId
      row, col (position in tileset image)
      tags[] (e.g., 'floor', 'wall', 'water', 'door')
      walkable: boolean
      opacity: number (0-1)

    TileLayer — one layer of tile placements on the map
      id, name, zIndex
      tiles: TilePlacement[] (tileId + gridX + gridY)

    PropDefinition — decorative/interactive object
      id, name, imagePath?
      width, height (in tiles)
      tags[], walkable: boolean
      interactable: boolean

    PropPlacement — placed prop on map
      propId, gridX, gridY, zoneId?

    AmbientLayer — mood/atmosphere overlay
      id, name, zoneIds[]
      type: 'fog' | 'rain' | 'dust' | 'glow' | 'shadow' | 'custom'
      intensity (0-1), color?
    ```
  - **Files:** `packages/schema/src/visual.ts`

### B5. World project container and validation
- [DONE by A] **Define WorldProject container + validation functions** — 10 tests pass
  - `packages/schema/src/project.ts`:
    ```typescript
    WorldProject — complete authored world
      id, name, description, version
      genre: string (maps to PackGenre)
      tones: string[]
      difficulty: string
      narratorTone: string

      map: WorldMap
      zones: Zone[]
      connections: ZoneConnection[]
      districts: District[]
      landmarks: Landmark[]

      factionPresences: FactionPresence[]
      pressureHotspots: PressureHotspot[]

      entityPlacements: EntityPlacement[]
      itemPlacements: ItemPlacement[]
      encounterAnchors: EncounterAnchor[]
      spawnPoints: SpawnPoint[]
      craftingStations: CraftingStation[]
      marketNodes: MarketNode[]

      tilesets: Tileset[]
      tileLayers: TileLayer[]
      props: PropDefinition[]
      propPlacements: PropPlacement[]
      ambientLayers: AmbientLayer[]
    ```
  - `packages/schema/src/validate.ts`:
    - `validateProject(project: WorldProject): ValidationResult`
    - Checks: ID uniqueness, cross-references, symmetrical neighbors, at least one spawn point, all district zoneIds exist, all entity placements reference valid zones
    - Returns `{ valid: boolean, errors: ValidationError[] }`
  - Tests: `packages/schema/src/__tests__/validate.test.ts`
    - Valid minimal project passes
    - Missing spawn point fails
    - Orphaned zone neighbor fails
    - Duplicate IDs fail
    - District referencing nonexistent zone fails
  - **Files:** `packages/schema/src/project.ts`, `packages/schema/src/validate.ts`, `packages/schema/src/__tests__/validate.test.ts`

### B6. Test fixtures — minimal world projects
- [DONE by A] **Create test fixture world projects** — minimal, chapel-authored, invalid-orphan
  - `packages/schema/src/__tests__/fixtures/minimal.ts` — 2 zones, 1 district, 1 NPC, 1 spawn
  - `packages/schema/src/__tests__/fixtures/chapel-authored.ts` — hand-authored version of chapel-threshold with spatial data
  - `packages/schema/src/__tests__/fixtures/invalid-orphan.ts` — deliberately broken for validation tests
  - Build passes, all validation tests pass
  - **Files:** `packages/schema/src/__tests__/fixtures/*.ts`

---

## Track C: @world-forge/export-ai-rpg — Engine Export Pipeline

### C1. Zone and district conversion
- [DONE by A] **Convert WorldProject zones → engine ZoneDefinition[]** (depends on B5)
  - `packages/export-ai-rpg/src/convert-zones.ts`:
    - `convertZones(project: WorldProject): ZoneDefinition[]`
    - Maps: zone.id → id, zone.name → name, zone.tags → tags
    - Maps: zone.neighbors → neighbors, zone.exits → exits with targetZoneId + label
    - Maps: zone.light → light, zone.hazards → hazards, zone.interactables → interactables
  - `packages/export-ai-rpg/src/convert-districts.ts`:
    - `convertDistricts(project: WorldProject): DistrictDefinition[]`
    - Maps: district.id → id, district.name → name, district.zoneIds → zoneIds
    - Maps: district.controllingFaction → controllingFaction
    - Maps: district.baseMetrics → baseMetrics
  - Tests for both converters against minimal fixture
  - Add `@ai-rpg-engine/content-schema` and `@ai-rpg-engine/modules` as dependencies
  - **Files:** `packages/export-ai-rpg/src/convert-zones.ts`, `convert-districts.ts`, tests

### C2. Entity and item conversion
- [DONE by A] **Convert placements → engine EntityBlueprint[] and ItemDefinition[]** (depends on C1)
  - `packages/export-ai-rpg/src/convert-entities.ts`:
    - `convertEntities(project: WorldProject): EntityBlueprint[]`
    - EntityPlacement → EntityBlueprint with type, name, tags, zoneId
    - NPC role mappings: 'merchant' gets merchant tags, 'companion' gets recruitable tag
    - Sets aiProfile based on role
  - `packages/export-ai-rpg/src/convert-items.ts`:
    - `convertItems(project: WorldProject): ItemDefinition[]`
    - ItemPlacement → ItemDefinition with slot, rarity, location metadata
  - Tests against chapel-authored fixture
  - **Files:** `packages/export-ai-rpg/src/convert-entities.ts`, `convert-items.ts`, tests

### C3. Pack metadata and manifest conversion
- [DONE by A] **Convert WorldProject metadata → GameManifest + PackMetadata** (depends on C1)
  - `packages/export-ai-rpg/src/convert-pack.ts`:
    - `convertManifest(project: WorldProject): GameManifest`
    - `convertPackMeta(project: WorldProject): PackMetadata`
    - Maps genre → PackGenre enum, tones → PackTone enum
    - Sets default modules list, default ruleset
    - Generates narratorTone from genre + tones
  - Tests
  - **Files:** `packages/export-ai-rpg/src/convert-pack.ts`, tests

### C4. Full export pipeline + validation
- [DONE by A] **Wire all converters into a single export function** — 24 tests pass (depends on C1-C3)
  - `packages/export-ai-rpg/src/export.ts`:
    - `exportToEngine(project: WorldProject): ExportResult`
    - Calls validateProject first — abort if invalid
    - Calls all converters
    - Returns `{ contentPack, manifest, packMeta, warnings[] }`
    - Runs engine-side validation (`validate` from content-schema) as post-check
  - `packages/export-ai-rpg/src/index.ts` — re-export
  - Round-trip test: create WorldProject → export → validate with engine schema → passes
  - **Files:** `packages/export-ai-rpg/src/export.ts`, `index.ts`, integration tests

### C5. CLI export command
- [DONE by A] **Add CLI tool for exporting world project files** (depends on C4)
  - `packages/export-ai-rpg/src/cli.ts`:
    - `world-forge export <project.json> [--out <dir>] [--validate-only]`
    - Reads project JSON, runs export pipeline, writes output files
    - `--validate-only` mode just checks without writing
    - Exit code 0 on success, 1 on validation failure
  - Add `bin` entry to package.json
  - **Files:** `packages/export-ai-rpg/src/cli.ts`, `package.json`

---

## Track D: @world-forge/renderer-2d — Canvas Rendering

### D1. PixiJS setup and viewport
- [DONE by B] **Initialize PixiJS renderer with viewport** (depends on A3)
  - `packages/renderer-2d/package.json` — add `pixi.js` dependency
  - `packages/renderer-2d/src/viewport.ts`:
    - `WorldViewport` class wrapping a PixiJS Application
    - init(container: HTMLElement, width, height)
    - Camera: pan, zoom, center-on-zone
    - Grid overlay toggle
    - Background color from project palette
  - `packages/renderer-2d/src/index.ts` — re-export
  - **Files:** `packages/renderer-2d/src/viewport.ts`, `index.ts`, `package.json`

### D2. Tile layer rendering
- [DONE by B] **Render tile layers from WorldProject data** (depends on B4, D1)
  - `packages/renderer-2d/src/tile-renderer.ts`:
    - `TileLayerRenderer` — takes TileLayer + Tileset data
    - Renders tilemap to PixiJS container
    - Supports multiple layers with z-ordering
    - Efficient: only renders visible tiles (viewport culling)
  - `packages/renderer-2d/src/tileset-loader.ts`:
    - Load tileset images, slice into tile textures
    - Cache loaded tilesets
  - **Files:** `packages/renderer-2d/src/tile-renderer.ts`, `tileset-loader.ts`

### D3. Zone overlay and highlighting
- [DONE by B] **Render zone boundaries and selection highlights** (depends on B1, D1)
  - `packages/renderer-2d/src/zone-renderer.ts`:
    - `ZoneOverlayRenderer` — draws zone boundaries as colored outlines
    - Hover highlight (semi-transparent fill)
    - Selection highlight (brighter, thicker border)
    - Zone labels (name text at center)
    - Color-coding by district membership
  - `packages/renderer-2d/src/connection-renderer.ts`:
    - Draw zone connections as lines/arrows between zone centers
    - Bidirectional = plain line, one-way = arrow
    - Dashed line for conditional exits
  - **Files:** `packages/renderer-2d/src/zone-renderer.ts`, `connection-renderer.ts`

### D4. Entity and prop rendering
- [DONE by B] **Render entity placements and props** (depends on B3, B4, D1)
  - `packages/renderer-2d/src/entity-renderer.ts`:
    - Render entity placements as icons/sprites by role
    - NPC = blue circle, enemy = red diamond, merchant = gold square, companion = green circle, boss = red skull
    - Show name label on hover
  - `packages/renderer-2d/src/prop-renderer.ts`:
    - Render prop placements from PropDefinition images or fallback shapes
    - Layer props above tiles but below entities
  - **Files:** `packages/renderer-2d/src/entity-renderer.ts`, `prop-renderer.ts`

### D5. Minimap
- [DONE by B] **Render a minimap panel** (depends on D2, D3)
  - `packages/renderer-2d/src/minimap.ts`:
    - `MinimapRenderer` — small overview of entire map
    - Shows zone colors, current viewport rectangle
    - Click-to-navigate
    - Fixed size (200x200 default)
  - **Files:** `packages/renderer-2d/src/minimap.ts`

---

## Track E: @world-forge/editor — Web Authoring App

### E1. React app shell
- [DONE by B] **Create React app with Vite** (depends on A3)
  - `packages/editor/package.json` — React 19, Vite, TypeScript
  - `packages/editor/vite.config.ts`
  - `packages/editor/index.html`
  - `packages/editor/src/main.tsx` — React root
  - `packages/editor/src/App.tsx` — layout shell:
    - Left sidebar: tool palette
    - Center: canvas (renderer-2d viewport)
    - Right sidebar: property inspector
    - Top bar: file menu, project name, export button
    - Bottom bar: status, coordinates, zoom level
  - Basic styling with CSS modules or Tailwind
  - **Files:** `packages/editor/` scaffold

### E2. Project state management
- [DONE by B] **Create project store with save/load** (depends on B5, E1)
  - `packages/editor/src/store/project-store.ts`:
    - Zustand or React context store for WorldProject state
    - Actions: createNewProject, loadProject(json), saveProject() → JSON
    - Undo/redo stack (10 levels)
    - Dirty flag tracking
  - `packages/editor/src/store/selection-store.ts`:
    - Currently selected zone, entity, connection, tool
    - Hover state
  - `packages/editor/src/store/editor-store.ts`:
    - Active tool: 'select' | 'zone-paint' | 'connection' | 'entity-place' | 'landmark' | 'prop'
    - Grid snap toggle
    - Show/hide layers
    - Zoom level
  - **Files:** `packages/editor/src/store/*.ts`

### E3. Zone painting tool
- [DONE by B] **Implement zone creation and editing on canvas** (depends on D3, E2)
  - `packages/editor/src/tools/zone-tool.ts`:
    - Click-drag to create zone rectangle (grid-snapped)
    - Click existing zone to select it
    - Drag zone edges to resize
    - Delete key to remove zone
    - Double-click to rename
  - `packages/editor/src/panels/ZoneProperties.tsx`:
    - Name, tags (comma-separated), description
    - Light level slider (0-10)
    - Hazards list
    - Interactables list
    - Parent district dropdown
  - **Files:** `packages/editor/src/tools/zone-tool.ts`, `panels/ZoneProperties.tsx`

### E4. Connection editing tool
- [DONE by B] **Implement zone connection drawing** (depends on D3, E3)
  - `packages/editor/src/tools/connection-tool.ts`:
    - Click zone A → click zone B to create connection
    - Right-click connection to delete
    - Toggle bidirectional/one-way
    - Add label and condition in property panel
  - `packages/editor/src/panels/ConnectionProperties.tsx`:
    - Label, bidirectional toggle
    - Condition type dropdown (none, key-required, faction-gate, level-gate)
  - **Files:** `packages/editor/src/tools/connection-tool.ts`, `panels/ConnectionProperties.tsx`

### E5. Entity and landmark placement
- [DONE by B] **Implement entity/landmark drag-and-drop** (depends on D4, E2)
  - `packages/editor/src/tools/entity-tool.ts`:
    - Drag from palette to canvas to place entity
    - Entity palette shows role icons: NPC, enemy, merchant, companion, boss
    - Click placed entity to select → property panel
    - Delete key to remove
  - `packages/editor/src/tools/landmark-tool.ts`:
    - Click to place landmark at grid position
    - Auto-assigns to containing zone
  - `packages/editor/src/panels/EntityProperties.tsx`:
    - entityId, role dropdown, factionId, dialogueId
    - Spawn condition
  - `packages/editor/src/panels/LandmarkProperties.tsx`:
    - name, tags, description, interaction type dropdown
  - **Files:** `packages/editor/src/tools/entity-tool.ts`, `landmark-tool.ts`, panels

### E6. District metadata panel
- [DONE by B] **Implement district creation and AI-RPG metadata editing** (depends on E3)
  - `packages/editor/src/panels/DistrictPanel.tsx`:
    - Create new district
    - Assign zones to district (multi-select zones → "Add to district")
    - Edit district metadata:
      - Name, tags
      - Controlling faction dropdown
      - Commerce slider (0-100, default 50)
      - Morale slider (0-100, default 50)
      - Safety slider (0-100, default 50)
      - Stability slider (0-100, default 50)
    - Economy profile: supply categories checkboxes, scarcity defaults
  - `packages/editor/src/panels/FactionPresencePanel.tsx`:
    - Define faction presences on the map
    - Faction ID, districts covered, influence level, patrol routes
  - `packages/editor/src/panels/PressurePanel.tsx`:
    - Place pressure hotspots on zones
    - Type, probability, tags
  - **Files:** `packages/editor/src/panels/DistrictPanel.tsx`, `FactionPresencePanel.tsx`, `PressurePanel.tsx`

### E7. Export integration
- [DONE by B] **Wire export pipeline into editor** (depends on C4, E2)
  - `packages/editor/src/actions/export.ts`:
    - Import `exportToEngine` from `@world-forge/export-ai-rpg`
    - Validate button — shows validation results in a modal
    - Export button — runs full export, downloads as JSON
    - Shows warnings in export modal
  - `packages/editor/src/panels/ExportModal.tsx`:
    - Validation results (errors in red, warnings in yellow)
    - Export format options (JSON, TypeScript content.ts)
    - Download button
  - **Files:** `packages/editor/src/actions/export.ts`, `panels/ExportModal.tsx`

---

## Track F: Documentation & Release

### F1. README
- [DONE by B] **Write README.md** (can start after A3)
  - Project description: "2D world authoring studio for AI RPG Engine"
  - Architecture diagram (monorepo packages)
  - Quick start (install, create project, paint zones, export)
  - Package descriptions
  - Engine compatibility note
  - **Files:** `README.md`

### F2. Shipcheck compliance
- [DONE by B] **Run shipcheck init and work through gates** (depends on ALL)
  - SECURITY.md
  - Threat model in README (no secrets, no network beyond asset loading, no telemetry)
  - CHANGELOG.md
  - LICENSE (MIT, already created by GitHub)
  - Verify script
  - Version bump to v1.0.0 (when ready)
  - **Files:** `SECURITY.md`, `CHANGELOG.md`, `SHIP_GATE.md`

---

## Task Dependencies

```
A1 ── A2 ── A3 (scaffold must be first)
              │
              ├── B1 ── B2
              │    │    B3
              │    │    B4
              │    └──── B5 ── B6
              │           │
              │           ├── C1 ── C2
              │           │         C3
              │           │         └── C4 ── C5
              │           │
              │           └── E2 ── E3 ── E4
              │                     │     E5
              │                     │     E6
              │                     └──── E7 (needs C4)
              │
              ├── D1 ── D2 (needs B4)
              │         D3 (needs B1)
              │         D4 (needs B3, B4)
              │         D5 (needs D2, D3)
              │
              └── F1 (anytime after A3)

ALL ── F2 (shipcheck last)
```

## Parallel Assignment

**Claude A — Schema & Export Pipeline:**
```
A1 → A2 → A3 → B1 → B2 → B3 → B4 → B5 → B6 → C1 → C2 → C3 → C4 → C5
```

**Claude B — Renderer & Editor:**
```
(wait for A3) → D1 → (wait for B1) → D3 → (wait for B4) → D2 → D4 → D5
then: (wait for B5) → E1 → E2 → E3 → E4 → E5 → E6 → (wait for C4) → E7
```

**Conflict zones:**
- `packages/schema/src/index.ts` — both may need to re-export; coordinate
- No other file conflicts — schema and renderer/editor are separate packages

## Phase Boundaries

**Phase 1 (this multitask):** Schema + Export + Renderer + Minimal Editor
- Deliverable: create a world project in the editor, export to ai-rpg-engine format, validate round-trip

**Phase 2 (future):** Visual polish — tilesets, props, palette themes, district overlays, validation UI

**Phase 3 (future):** AI-assisted authoring — "generate dock district from tags", "populate ruined chapel quarter"

**Phase 4 (future):** Asset pipeline — tile packs, sprite packs, image generation adapters

## First Milestone

The first version is done when you can:
1. Open the editor
2. Paint zones on a grid
3. Connect zones with exits
4. Group zones into districts with faction/economy metadata
5. Place NPCs, enemies, landmarks, spawn points
6. Export to a valid ai-rpg-engine ContentPack JSON
7. Load that JSON in claude-rpg and play it
