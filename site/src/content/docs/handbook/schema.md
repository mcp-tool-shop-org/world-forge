---
title: Schema & Types
description: WorldProject types and validation rules
sidebar:
  order: 4
---

The `@world-forge/schema` package defines every type in a world project. This page covers the key types and validation rules.

## WorldProject

The top-level container that holds an entire authored world:

```typescript
interface WorldProject {
  id: string;
  name: string;
  description: string;
  version: string;
  genre: string;
  mode?: AuthoringMode;    // dungeon | district | world | ocean | space | interior | wilderness
  tones: string[];
  difficulty: string;
  narratorTone: string;

  map: WorldMap;
  zones: Zone[];
  connections: ZoneConnection[];
  districts: District[];
  landmarks: Landmark[];
  dialogues: DialogueDefinition[];

  playerTemplate?: PlayerTemplate;
  buildCatalog?: BuildCatalogDefinition;
  progressionTrees: ProgressionTreeDefinition[];

  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];

  entityPlacements: EntityPlacement[];
  itemPlacements: ItemPlacement[];
  encounterAnchors: EncounterAnchor[];
  spawnPoints: SpawnPoint[];
  assets: AssetEntry[];
  assetPacks: AssetPack[];

  // Project metadata (v4.1.0)
  author?: string;
  license?: string;
  category?: string;
  projectTags?: string[];

  // Town economy + visual layers
  craftingStations: CraftingStation[];
  marketNodes: MarketNode[];
  tilesets: Tileset[];
  tileLayers: TileLayer[];
  props: PropDefinition[];
  propPlacements: PropPlacement[];
  ambientLayers: AmbientLayer[];

  // Town structures (v4.5) — optional, so pre-v4.5 projects open unchanged
  buildings?: Building[];
  hubs?: Hub[];
  strongholds?: Stronghold[];

  // World modeling (v4.5) — also optional
  strata?: Stratum[];
  stratumLinks?: StratumLink[];
  hazardDefinitions?: HazardDefinition[];

  // Earlier additive fields
  lootTables?: LootTable[];        // v4.3
  transitions?: TransitionEntity[]; // v4.3
}
```

Town structures (`buildings` / `hubs` / `strongholds`), world-modeling (`strata` / `stratumLinks` / `hazardDefinitions`), `lootTables`, and `transitions` are **optional** — a project authored before those fields were added still opens, validates, and exports unchanged. The town-economy and visual arrays (`craftingStations`, `marketNodes`, `tilesets`, `tileLayers`, `props`, `propPlacements`, `ambientLayers`) are required; omitting them fails the structural guard. See [Town Structures](#town-structures), [Vertical Strata](#vertical-strata), [Typed Hazards](#typed-hazards), and [Zone Entry Gates](#zone-entry-gates) below for the v4.5 additions.

## AuthoringMode

World Forge separates **genre** (fantasy, cyberpunk) from **mode** (dungeon, ocean, space). Genre is flavor — mode is scale. They are orthogonal: a cyberpunk dungeon and a pirate ocean are both valid.

```typescript
type AuthoringMode = 'dungeon' | 'district' | 'world' | 'ocean' | 'space' | 'interior' | 'wilderness';
```

The `mode` field on `WorldProject` is optional — projects without it default to `'dungeon'` everywhere. Mode governs:

- **Grid defaults** — `createEmptyProject(mode)` applies mode-specific width, height, and tile size
- **Connection vocabulary** — each mode suggests relevant connection kinds (e.g., ocean uses channel/route, space uses docking/warp)
- **Object creation defaults** — connections default to the mode's primary kind (dungeon→door, ocean→channel), entities default to mode-appropriate role (dungeon→enemy, district→npc), encounters use mode-relevant types, and zones use mode-specific name patterns (Chamber, Waters, Sector, etc.)
- **Preset filtering** — presets with `modes` arrays are hidden when incompatible with the current mode
- **Guide text** — the checklist adapts step labels per mode (e.g., "Add a chamber" vs "Add a sea zone")
- **Advisory validation** — mode-specific suggestions (e.g., "Consider adding secret connections" for dungeons)
- **Speed Panel suggestions** — mode-specific quick actions appear in a dedicated MODE section (e.g., "Add Secret Connection" for dungeons)

| Mode | Grid | Tile | Key Connections |
|------|------|------|-----------------|
| dungeon | 30×25 | 32 | door, stairs, passage, secret, hazard |
| district | 50×40 | 32 | road, door, passage, portal |
| world | 80×60 | 48 | road, portal, passage |
| ocean | 60×50 | 48 | channel, route, portal, hazard |
| space | 100×80 | 64 | docking, warp, passage, portal |
| interior | 20×15 | 24 | door, stairs, passage, secret |
| wilderness | 60×50 | 48 | trail, road, passage, hazard |

## Zone

A distinct area in the world with spatial coordinates, neighbors, and environmental properties:

- `gridX`, `gridY`, `gridWidth`, `gridHeight` — position on the spatial grid
- `neighbors` — IDs of adjacent zones
- `exits` — labeled transitions with target zone IDs
- `light` (0-10) and `noise` (0-10) — ambient levels
- `hazards` — environmental dangers
- `interactables` — objects players can inspect or use
- `parentDistrictId` — which district this zone belongs to

## EntityPlacement

Places an entity in a zone with optional authored data:

- `entityId`, `zoneId`, `role` — identity, location, and role (npc/enemy/merchant/boss/companion)
- `name` — display name (defaults to entityId)
- `stats` — authored stat block (e.g., `{ vigor: 4, instinct: 3, will: 1 }`)
- `resources` — resource pools (e.g., `{ hp: 12, stamina: 4 }`)
- `ai` — AI profile override (e.g., `{ profileId: 'aggressive', goals: ['guard-crypt'] }`)
- `tags` — additional tags merged with role defaults
- `dialogueId` — links to a dialogue tree
- `custom` — freeform metadata for companion abilities, personal goals, etc.

## DialogueDefinition

A branching conversation tree:

- `id` — unique identifier
- `speakers` — entity IDs involved in the conversation
- `entryNodeId` — where the conversation starts
- `nodes` — map of node ID to `DialogueNode`

Each `DialogueNode` has a speaker, text, and optional choices. Each `DialogueChoice` can have conditions (gates) and effects (state changes). Effects use `DialogueEffect` with a type, optional target (`actor`/`target`/`zone`), and params.

## PlayerTemplate

Defines the player character's starting state:

- `name` — display name (e.g., "Wanderer")
- `baseStats`, `baseResources` — starting stat/resource pools
- `startingInventory` — item IDs placed in inventory at game start
- `startingEquipment` — slot-to-item-ID map for equipped items
- `spawnPointId` — where the player starts
- `defaultArchetypeId`, `defaultBackgroundId` — optional build catalog refs

## BuildCatalogDefinition

Character creation data for the engine:

- `archetypes` — class-like choices with stat priorities, progression trees, granted verbs
- `backgrounds` — origin stories with stat modifiers and faction modifiers
- `traits` — perks and flaws with effects (stat-modifier, resource-modifier, grant-tag, verb-access, faction-modifier)
- `disciplines` — specialized abilities with granted verbs, passives, and drawbacks
- `crossTitles` — special titles granted by archetype + discipline combinations
- `entanglements` — synergy effects between archetype and discipline

## ProgressionTreeDefinition

Skill/ability trees with:

- `currency` — what resource is spent to unlock nodes (e.g., "xp")
- `nodes` — each with `cost`, optional `requires` (prerequisite node IDs), and `effects`

## AssetEntry

A single entry in the project's asset manifest:

- `id` — unique identifier
- `kind` — `portrait`, `sprite`, `background`, `icon`, or `tileset`
- `label` — display name
- `path` — relative path or URI to the media file
- `tags` — freeform tags for filtering
- `packId` — optional reference to an `AssetPack.id`
- `provenance` — optional metadata (source, author, license, createdAt)

## AssetPack

A named, versioned grouping of assets for portability:

- `id`, `label`, `version` — identity and semver version
- `description` — what this pack contains
- `tags`, `theme` — categorization (e.g., `dark-fantasy`)
- `source` — provenance (`hand-drawn`, `ai-generated`, `stock`)
- `license`, `author` — ownership metadata
- `compatibility` — optional `PackCompatibility` with `minSchemaVersion` and `engineVersion`

Assets reference their pack via `packId`. Deleting a pack cascades by clearing `packId` on all member assets.

## Town Structures

Three placed structure types sit a layer above the town economy (market nodes and crafting stations). All three are additive since v4.5 — the arrays are optional, so a project authored before they existed opens and validates unchanged.

**`Building`** — an enterable footprint on the town map: a house, shop, temple, tavern, warehouse.

- `id`, `name`, `buildingType` — identity and a free-form kind
- `gridX`, `gridY`, `width`, `height` — footprint origin (top-left) and size in tiles
- `zoneId` — the town zone this building sits in (optional)
- `interiorZoneId` — **the zone you enter**, linking the town map to the interiors layer (optional)
- `tags`

**`Hub`** — a service and connectivity node anchored to a zone: a market square, crossroads, town center.

- `id`, `name`, `hubType` — identity and a free-form kind
- `zoneId` — the central zone this hub anchors to (**required**)
- `serviceTypes` — what is offered here (`market`, `tavern`, `temple`, `inn`, …)
- `connectedZoneIds` — the zones this hub serves
- `tags`

**`Stronghold`** — a fortified faction seat: a keep, fort, or citadel.

- `id`, `name` — identity
- `zoneId` — the zone it occupies (**required**)
- `factionId` — the controlling faction (optional, and not cross-validated — see Validation)
- `defenseLevel` — fortification strength, a finite number ≥ 0
- `garrisonEntityIds` — entities garrisoned here as defenders
- `tags`

## Vertical Strata

Discrete vertical layers — surface / underground / sky, or the floors of a building — and the connectors between them. Additive since v4.5.

**`Stratum`** — `id`, `name`, a signed `order` (higher sits above lower), a `zRange` with `floor` < `ceiling`, and `visibleStrata` listing which other strata are visible from this one. A zone joins a stratum via `Zone.stratumId`.

**`StratumLink`** — a connector between two strata (`fromStratumId`, `toStratumId`) with a `kind` (stairs, ladder, elevator, …) and optional anchor zones at each end.

On Godot export, strata become per-zone `z_index` banding so layers render in the authored order rather than by accident of draw sequence.

## Typed Hazards

A shared hazard library referenced per zone, rather than the legacy free-text `Zone.hazards` string list (which is untouched and still works).

**`HazardDefinition`** — `id`, `name`, `trigger` (when it fires), `effects[]`, plus optional `moveCostDelta`, `passable`, vision-blocking, and weather gating.

**`HazardEffect`** is a discriminated union on `kind`, with four arms:

| `kind` | Fields |
|--------|--------|
| `damage` | `amount`, `tickOn` (`turn-start` \| `turn-end`), optional `durationTicks` |
| `status` | `statusId`, `chance` (0–1), `stacking` |
| `instakill` | — no extra fields |
| `ignite` | `igniteChance` (0–1) |

Zones reference definitions by id via `Zone.hazardRefs`. Godot export emits each as an `Area2D` region.

## Zone Entry Gates

Gate entry to a zone on party state. A `ZoneEntryGate` carries an AND-array of `conditions`, a `mode` (`hard` blocks entry, `soft` advises), and an authored `reason` — the text shown to the player, so a locked door can explain itself instead of silently refusing.

Conditions use the extended `SpawnCondition` grammar, which accepts party-state operands alongside the original set:

```
party-level:>=5      party-size:<4       item:brass-key
flag:met-the-keeper  member:npc-aldric   class:cleric
level:>=3            faction:keepers:>50 random:0.25
```

Comparator grammars (`level:`, `party-level:`, `party-size:`, `faction:<id>:<op>`, `random:`) reject an empty or whitespace-only operand rather than coercing it to `0`.

## Scene Data Assembly

`assembleSceneData(zoneId, project)` is a pure function that extracts all visual data bound to a zone into a single `SceneData` structure:

- **background/tileset** — resolved asset or `{ id, missing: true }` marker
- **entities** — placements with resolved portrait/sprite assets and missing flags
- **landmarks** — with resolved icon assets and missing flags
- **items** — with resolved icon assets and missing flags
- **spawns** — spawn points in this zone
- **ambient** — ambient layers that include this zone
- **connections** — connected zone names with optional conditions
- **light** — the zone's light level (0-10)

This is the data source for the editor's Scene Preview component and can be used independently for testing or tooling.

## Viewport Math

The `viewport.ts` module provides pure math functions for 2D viewport transforms. No React, no DOM — just coordinate math.

```typescript
interface ViewportState { panX: number; panY: number; zoom: number; }
interface WorldBounds { minX: number; minY: number; maxX: number; maxY: number; }
```

**Transform model:** `screenX = (worldX - panX) * zoom`, applied via `ctx.setTransform(zoom, 0, 0, zoom, -panX * zoom, -panY * zoom)`.

| Function | Purpose |
|----------|---------|
| `screenToWorld` | Convert screen pixel to world pixel coordinates |
| `worldToScreen` | Convert world pixel to screen pixel coordinates |
| `screenToGrid` | Convert screen pixel to tile grid coordinates |
| `computeContentBounds` | Compute world-pixel bounding box of all authored content |
| `fitBoundsToViewport` | Compute viewport that fits bounds into a canvas, centered |
| `centerOnPoint` | Compute viewport centered on a world point at current zoom |
| `centerOnZone` | Compute viewport that frames a specific zone with padding |
| `zoomAtPoint` | Apply zoom delta while keeping cursor world-point stationary |

Constants: `MIN_ZOOM = 0.1`, `MAX_ZOOM = 5.0`, `DEFAULT_VIEWPORT = { panX: 0, panY: 0, zoom: 1 }`.

## Validation

`validateProject()` runs 89 structural checks using precomputed Map lookups for O(n) performance. Returns `{ valid, errors, warningCount, schemaVersion }`. `warningCount` currently equals `errors.length` (it is not a separate advisory count — see `advisoryValidation()` for suggestions). `schemaVersion` is stamped on the full-validation return so exporters can pick a migration path; the structural-guard early return may omit it until that path also stamps. An optional `ValidateOptions` parameter supports `verbose` mode for detailed output.

Before any rule runs, a structural guard confirms every required top-level array is actually an array. A truncated or corrupted import used to sail past this and fail later in a converter; now it fails immediately, with the field named. The three optional town arrays are guarded the same way, but only when present — absent stays valid, which is what keeps projects authored before v4.5 opening unchanged.

1. At least one spawn point exists
2. At least one default spawn point
3. Zone ID uniqueness
4. District ID uniqueness
5. Zone neighbors reference existing zones
6. Symmetrical neighbor relationships
7. District zone references exist
8. Entity placements reference valid zones
9. Item placements reference valid zones
10. Spawn points reference valid zones
11. Connections reference valid zones
12. Landmarks reference valid zones
13. Dialogue ID uniqueness
14. Entry node exists in dialogue
15. All nextNodeId references point to existing nodes
16. No unreachable nodes in dialogue trees
17. Entity dialogueId references existing dialogue
18. Player template spawn point exists
19. Starting inventory items exist in item placements
20. Starting equipment items exist in item placements
21. Default archetype exists in build catalog
22. Default background exists in build catalog
23. Archetype ID uniqueness + progression tree refs
24. Background ID uniqueness
25. Trait ID uniqueness + incompatibility refs
26. Discipline ID uniqueness
27. Cross-title archetype + discipline refs
28. Entanglement archetype + discipline refs
29. Progression tree ID uniqueness
30. Node ID uniqueness within tree
31. Required node refs exist
32. Root node existence (at least one node without requirements)
33. Asset ID uniqueness
34. Asset path non-empty
35. Zone background/tileset asset ref existence + kind match
36. Entity portrait/sprite asset ref existence + kind match
37. Item icon asset ref existence + kind match
38. Landmark icon asset ref existence + kind match
39-42. Orphaned asset detection
43. Pack ID uniqueness
44. Pack label non-empty
45. Pack version non-empty
46. Asset packId references existing pack
47. Orphaned pack detection (no assets reference this pack)
48. Pack version format (semver x.y.z)
53-55. 2.5D: elevation range sanity (finite, floor < ceiling), unique parallax depth per zone, `skylineRef` resolves to a `background` asset
56-58. LootTable ID uniqueness; every entry weight finite and > 0
59. `EntityPlacement.spawnCondition` parses as a legal condition
60-65. TransitionEntity: ID uniqueness, `zoneId`/`targetZoneId` resolve, finite non-negative duration, finite `gravityOverride` (0 is legal — zero-g), sky/lighting sanity, `collisionType` runtime guard
66-72. Strata: ID uniqueness, finite `zRange` with floor < ceiling, finite `order`, `visibleStrata` resolve, `Zone.stratumId` resolves; StratumLink ID uniqueness and endpoint/anchor resolution
73-77. Hazards: ID uniqueness, valid trigger, passability + `moveCostDelta` sanity, per-`kind` effect validation with an exhaustiveness guard, `Zone.hazardRefs` resolve
78. Zone entry gates: valid mode, and every condition is a legal `SpawnCondition`
79-80. Town economy: CraftingStation and MarketNode ID uniqueness, `zoneId` resolution, `merchantEntityId` resolution
81-86. Visual layers: Tileset / TileDefinition / TileLayer / PropDefinition / PropPlacement / AmbientLayer ID uniqueness and cross-reference resolution
87-89. Town structures: Building, Hub, and Stronghold ID uniqueness; `zoneId` resolution; `Building.interiorZoneId` resolution; `Hub.connectedZoneIds` resolution; `Stronghold.garrisonEntityIds` resolution and finite non-negative `defenseLevel`

Rules 87-89 close a gap worth naming, because it is the kind that hides well.
`Building.interiorZoneId` is the link from the town map to the interiors layer —
functionally the same field as `TransitionEntity.targetZoneId`, which rule 61 has
always checked. Until v4.6.0 nothing checked it, so a typo meant the player entered
a building and arrived nowhere, with `validateProject()` reporting the project clean.

`Stronghold.factionId` is deliberately **not** validated. There is no faction
registry in the schema — factions exist only as `FactionPresence.factionId` scoped
to districts — so a stronghold held by a faction with no district presence is
legitimately authorable, and flagging it would manufacture false errors.

## Advisory Validation

`advisoryValidation(project)` returns mode-specific **suggestions** that never block export. These appear in the editor as a collapsible blue section below hard validation errors.

Each mode generates relevant suggestions — for example, dungeon mode suggests adding secret connections and trap hazards, ocean mode suggests channel connections and port zones. Universal suggestions (e.g., "add at least 2 zones", "add connections between zones") apply to all modes.

v4.1.0 added **metadata advisories** (missing author, license, category) and **asset naming advisories** (detects generic names like 'untitled', 'image', short or purely numeric labels).

```typescript
interface AdvisoryItem {
  path: string;      // e.g. 'connections' or 'zones'
  message: string;   // human-readable suggestion
  severity: 'info' | 'suggestion';
}
```
