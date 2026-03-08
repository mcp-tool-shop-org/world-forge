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

  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];

  entityPlacements: EntityPlacement[];
  itemPlacements: ItemPlacement[];
  encounterAnchors: EncounterAnchor[];
  spawnPoints: SpawnPoint[];
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

## Validation

`validateProject()` runs 17 structural checks:

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
