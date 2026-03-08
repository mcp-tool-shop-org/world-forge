---
title: Export Pipeline
description: How WorldProject becomes an ai-rpg-engine ContentPack
sidebar:
  order: 5
---

The `@world-forge/export-ai-rpg` package converts a `WorldProject` into a set of JSON files that ai-rpg-engine can load directly.

## Pipeline Steps

1. **Validate** — `validateProject()` runs all 17 structural checks. If any fail, export aborts with error details.
2. **Convert zones** — `Zone[]` becomes `ZoneDefinition[]` with description as TextBlock, exits, neighbors, hazards.
3. **Convert districts** — `District[]` becomes `DistrictDefinition[]` with safety mapped to surveillance.
4. **Convert entities** — `EntityPlacement[]` becomes `EntityBlueprint[]` with role-based defaults, authored stats/resources/AI.
5. **Convert items** — `ItemPlacement[]` becomes `ItemDefinition[]` with slot, rarity, modifiers, provenance.
6. **Convert dialogues** — `DialogueDefinition[]` passes through to engine's matching type.
7. **Build manifest** — game ID, title, modules, content pack references.
8. **Build pack metadata** — genres, tones, difficulty, narrator tone.
9. **Collect warnings** — missing landmarks, no faction presences, no pressure hotspots.

## Output Format

The export produces a `ContentPack` with five arrays plus manifest and metadata:

```typescript
type ContentPack = {
  entities: EntityBlueprint[];
  zones: ZoneDefinition[];
  districts: DistrictDefinition[];
  dialogues: DialogueDefinition[];
  items: ItemDefinition[];
};
```

## CLI Usage

```bash
# Export to directory
npx world-forge-export project.json --out ./my-pack

# Validate only (no output files)
npx world-forge-export project.json --validate-only
```

## Programmatic Usage

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);

if ('ok' in result) {
  // Validation failed
  console.error(result.errors);
} else {
  // Success
  const { contentPack, manifest, packMeta, warnings } = result;
}
```

## Entity Conversion Details

Role-based defaults are applied when the author hasn't specified values:

| Role | Engine Type | Default AI | Default Tags |
|------|-----------|------------|--------------|
| npc | npc | passive | — |
| enemy | enemy | aggressive | hostile |
| merchant | npc | passive | merchant, trader |
| companion | npc | follower | recruitable, companion |
| boss | enemy | territorial | hostile, boss, elite |

Authored values always override defaults. For example, if you set `ai.profileId: 'aggressive'` on a boss, it uses that instead of the default `'territorial'`.

## Dogfood: Chapel Threshold

The `dogfood/` directory contains a full export test using the Chapel Threshold fixture — 5 zones, 2 districts, 4 entities, 3 items, 1 dialogue tree. Running `npx tsx dogfood/chapel-threshold.ts` exports the fixture and performs a gap analysis against engine expectations.
