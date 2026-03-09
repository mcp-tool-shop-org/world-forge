---
title: Export & Import Pipeline
description: How WorldProject becomes an ai-rpg-engine ContentPack and back
sidebar:
  order: 5
---

The `@world-forge/export-ai-rpg` package converts a `WorldProject` into a set of JSON files that ai-rpg-engine can load directly.

## Pipeline Steps

1. **Validate** — `validateProject()` runs all 32 structural checks. If any fail, export aborts with error details.
2. **Convert zones** — `Zone[]` becomes `ZoneDefinition[]` with description as TextBlock, exits, neighbors, hazards.
3. **Convert districts** — `District[]` becomes `DistrictDefinition[]` with safety mapped to surveillance.
4. **Convert entities** — `EntityPlacement[]` becomes `EntityBlueprint[]` with role-based defaults, authored stats/resources/AI.
5. **Convert items** — `ItemPlacement[]` becomes `ItemDefinition[]` with slot, rarity, modifiers, provenance.
6. **Convert dialogues** — `DialogueDefinition[]` passes through to engine's matching type.
7. **Convert player template** — `PlayerTemplate` becomes `ExportedPlayerTemplate` with stats, inventory, equipment, spawn.
8. **Convert build catalog** — `BuildCatalogDefinition` becomes `ExportedBuildCatalog` with archetypes, backgrounds, traits, disciplines.
9. **Convert progression trees** — `ProgressionTreeDefinition[]` maps nodes with requirements and effects.
10. **Build manifest** — game ID, title, modules, content pack references.
11. **Build pack metadata** — genres, tones, difficulty, narrator tone.
12. **Collect warnings** — missing player template, build catalog, progression trees, landmarks, factions, hotspots.

## Output Format

The export produces a `ContentPack` with all authored domains plus manifest and metadata:

```typescript
type ContentPack = {
  entities: EntityBlueprint[];
  zones: ZoneDefinition[];
  districts: DistrictDefinition[];
  dialogues: DialogueDefinition[];
  items: ItemDefinition[];
  playerTemplate?: ExportedPlayerTemplate;
  buildCatalog?: ExportedBuildCatalog;
  progressionTrees: ProgressionTreeDefinition[];
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

## Import Pipeline

World Forge can import exported JSON back into the editor. The import pipeline reverses the export process with 8 converters:

| Converter | Input | Output |
|-----------|-------|--------|
| `importZones` | ZoneDefinition[] | Zone[] |
| `importDistricts` | DistrictDefinition[] | District[] |
| `importEntities` | EntityBlueprint[] | EntityPlacement[] |
| `importItems` | ItemDefinition[] | ItemPlacement[] |
| `importDialogues` | DialogueDefinition[] | DialogueDefinition[] |
| `importPlayerTemplate` | ExportedPlayerTemplate | PlayerTemplate |
| `importBuildCatalog` | ExportedBuildCatalog | BuildCatalogDefinition |
| `importProgressionTrees` | ProgressionTreeDefinition[] | ProgressionTreeDefinition[] |

The `importProject()` function auto-detects the input format (WorldProject, ExportResult, or ContentPack) and orchestrates all converters.

```typescript
import { importProject } from '@world-forge/export-ai-rpg';

const result = importProject(jsonString);

if (result.success) {
  const { project, format, lossless, fidelityReport } = result;
}
```

### Supported Formats

- **WorldProject** — lossless round-trip, no conversion needed
- **ExportResult** — `{ contentPack, manifest, packMeta }` from `exportToEngine()`
- **ContentPack** — engine content without manifest/metadata wrapper

## Fidelity Reporting

Every import produces a structured `FidelityReport` that tracks exactly what happened to each piece of data during conversion. Each entry has:

- **level** — `lossless`, `approximated`, or `dropped`
- **domain** — which system was affected (zones, districts, entities, items, etc.)
- **severity** — `info`, `warning`, or `error`
- **reason** — machine-stable key for programmatic use

Common fidelity entries:

| Reason Key | Level | Description |
|-----------|-------|-------------|
| `grid-auto-generated` | approximated | Zone grid positions auto-generated (engine doesn't store spatial layout) |
| `surveillance-to-safety` | approximated | District safety reverse-mapped from engine's surveillance metric |
| `economy-data-lost` | dropped | District economy profile not stored in engine format |
| `zone-placement-round-robin` | approximated | Entities assigned to zones via round-robin (original zones unknown) |
| `role-reverse-mapped` | approximated | Entity role inferred from engine tags |
| `textblock-to-string` | approximated | Dialogue text normalized from TextBlock arrays to strings |
| `visual-layers-dropped` | dropped | Visual layers (tiles, props, ambient) not stored in engine format |

The report includes a summary with overall lossless percentage and per-domain breakdowns, displayed in the editor's Import Summary panel.

## Dogfood: Chapel Threshold

The `dogfood/` directory contains a full export test using the Chapel Threshold fixture — 5 zones, 2 districts, 4 entities, 3 items, 1 dialogue, 1 player template, 1 build catalog, 2 progression trees. Running `npx tsx dogfood/chapel-threshold.ts` exports the fixture and performs a gap analysis against engine expectations. As of v1.2, the gap analysis reports zero gaps — full engine handshake.
