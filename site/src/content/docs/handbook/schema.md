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
  // ... crafting, market, visual layers
}
```

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

## Validation

`validateProject()` runs 48 structural checks:

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
