---
title: AI RPG Export & Import Pipeline
description: How WorldProject becomes an ai-rpg-engine ContentPack and back
sidebar:
  order: 5
---

The `@world-forge/export-ai-rpg` package converts a `WorldProject` into a set of JSON files that ai-rpg-engine can load directly.

:::note[Other export targets]
World Forge also exports to **[Unreal Engine 5](/docs/handbook/export-unreal/)** and **[Godot 4](/docs/handbook/export-godot/)**. This page covers the AI RPG Engine pipeline.
:::

## Pipeline Steps

1. **Validate** — `validateProject()` runs 89 structural checks. If any fail, export aborts with error details.
2. **Convert zones** — `Zone[]` becomes `ZoneDefinition[]` with description as TextBlock, exits, neighbors, hazards.
3. **Convert districts** — `District[]` becomes `DistrictDefinition[]` with safety mapped to surveillance.
4. **Convert entities** — `EntityPlacement[]` becomes `EntityBlueprint[]` with role-based defaults, authored stats/resources/AI.
5. **Convert items** — `ItemPlacement[]` becomes `ItemDefinition[]` with slot, rarity, modifiers, provenance.
6. **Convert dialogues** — `DialogueDefinition[]` passes through to engine's matching type.
7. **Convert player template** — `PlayerTemplate` becomes `ExportedPlayerTemplate` with stats, inventory, equipment, spawn.
8. **Convert build catalog** — `BuildCatalogDefinition` becomes `ExportedBuildCatalog` with archetypes, backgrounds, traits, disciplines.
9. **Convert progression trees** — `ProgressionTreeDefinition[]` maps nodes with requirements and effects.
10. **Build manifest** — game ID, title, modules, content pack references.
11. **Build pack metadata** — genres, tones, difficulty, narrator tone, authoring mode tag.
12. **Collect warnings** — missing player template, build catalog, progression trees, landmarks, factions, hotspots.
13. **Collect assets** — asset manifest and zone/entity/item/landmark bindings are attached to the ExportResult for round-trip preservation.
14. **Collect asset packs** — asset pack definitions are attached to the ExportResult when present.

## Output Format

The export produces a `ContentPack` with all authored domains plus manifest and metadata:

```typescript
type ContentPack = {
  _debug?: ExportDebugBlock;          // only with --profile debug
  schemaVersion?: string;             // default-on; --no-emit-schema-version strips it
  entities: EntityBlueprint[];
  placements: ExportedPlacement[];    // where entities stand (not on the blueprint)
  zones: ExportedZone[];              // includes entryGate, not bare ZoneDefinition
  districts: DistrictDefinition[];
  dialogues: DialogueDefinition[];
  items: ItemDefinition[];
  playerTemplate?: ExportedPlayerTemplate;
  buildCatalog?: ExportedBuildCatalog;
  progressionTrees: ProgressionTreeDefinition[];
  encounterAnchors: EncounterAnchor[];
  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];
  hazardDefinitions: HazardDefinition[];
  lootTables: LootTable[];
  craftingStations: CraftingStation[];
  marketNodes: MarketNode[];
};
```

## CLI Usage

```bash
# Export to directory
npx world-forge-export project.json --out ./my-pack

# Validate only (no output files)
npx world-forge-export project.json --validate-only

# Dry-run: validate + report sizes, never write (--out is mutually exclusive)
npx world-forge-export project.json --dry-run

# Debug profile (adds _debug block, keeps every fidelity entry)
npx world-forge-export project.json --out ./my-pack --profile debug

# Strip ContentPack.schemaVersion (default is to emit it)
npx world-forge-export project.json --out ./my-pack --no-emit-schema-version

# Verbose output (detailed conversion log)
npx world-forge-export project.json --out ./my-pack --verbose

# Import a pack directory back to WorldProject JSON
npx world-forge-export --import ./my-pack --out ./round-trip

# Import content-pack.json + pack-meta.json + manifest.json (and sidecars)
npx world-forge-export --from-pack ./my-pack --out ./round-trip
```

## Programmatic Usage

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);

if (!result.success) {
  // Validation failed, or refused for engine blockers (unmapped encounter types or unresolved dialogue speakers)
  console.error(result.errors);
} else {
  // Success
  const { contentPack, manifest, packMeta, warnings, assets, assetBindings, assetPacks } = result;
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

## Encounter Type Mapping

`@ai-rpg-engine/content-schema` accepts four encounter anchor types: `ambush`, `patrol`, `horde`, and `duel`. `@world-forge/export-ai-rpg` translates World Forge's richer authoring types during AI RPG export only (editor authoring, `@world-forge/schema`, Unreal Engine 5, and Godot 4 exports keep all authored types unchanged):

| World Forge type | AI RPG `ContentPack` writes | `tags[]` & fidelity entry |
|---|---|---|
| `boss` | `duel` | adds `worldforge-type:boss`; `approximated` (`encounter-type-translated`) |
| `beast`, `haunt`, `caravan-raid` | `ambush` | adds `worldforge-type:<original>`; `approximated` (`encounter-type-translated`) |
| `pirate` | `patrol` | adds `worldforge-type:pirate`; `approximated` (`encounter-type-translated`) |
| `boarding`, `brawl` | `horde` | adds `worldforge-type:<original>`; `approximated` (`encounter-type-translated`) |
| `hazard`, `discovery` | left out of `ContentPack.encounterAnchors` | `dropped` (`encounter-type-dropped`) |
| `ambush`, `patrol`, `horde`, `duel` | unchanged | unchanged, no fidelity entry |
| any other custom string | refused by name (Export modal blocked, CLI exit `1`) | blocker (`listAiRpgEncounterBlockers`) |

When running `world-forge-export --validate-only`, mapped and dropped types pass with each approximation and drop named on stderr; unmapped custom strings still exit `1`.

## Dialogue Speaker Rules

- Any entry in `dialogues[].speakers` that does not match an exported entity's `entityId` is refused by name (`listAiRpgDialogueSpeakerBlockers`, `exportToEngine` returns `success: false`, Export modal blocked, CLI exit `1`).
- A node with `speaker: ''` exports with its `speaker` filled from the dialogue's single entry in `dialogues[].speakers` (with no extra fidelity entry) only when every entity whose `dialogueId` references that dialogue is that listed speaker, or when no entity carries the dialogue.
- A node with `speaker: ''` is refused when any entity carrying that dialogue is a different entity (naming the dialogue ID, node ID, and carrier entity ID), or when `dialogues[].speakers` has zero or multiple entries (naming the dialogue ID and node ID).
- Any non-empty node `speaker` exports unchanged.

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
- **ExportResult** — `{ contentPack, manifest, packMeta, assets, assetBindings }` from `exportToEngine()`
- **ContentPack** — engine content without manifest/metadata wrapper
- **ProjectBundle** — portable `.wfproject.json` file exported from the editor (lossless)

## The Measured Export Contract (v4.6.0)

An exporter that runs is not the same thing as a world that boots. v4.6.0 makes the
difference measurable instead of assumed.

### The alignment audit

`docs/c0-alignment/` holds a generated, checked-in **export table**: a leaf-path
differ walks every authored field in a fixture project, exports it, and records
which fields actually arrive in the ContentPack — lossless, approximated, or
dropped. It is regenerated and verified on every test run, so a converter that
silently stops carrying a field fails a test rather than going unnoticed.

This exists because the alternative had already happened. Two required fields —
`craftingStations` and `marketNodes` — were dropped by the exporter with no warning
and no fidelity entry, and returned as empty arrays on import, so a round trip
erased authored town economy in both directions without a single failing test.

### Manifest truth

The emitted manifest carries a real engine semver range, real module ids, a content
hash over the simulation-affecting content, and compiled exit conditions — values
that were previously nominal.

Module ids are **gated on real content**. A pack with no crafting stations no longer
declares the crafting module active. Claiming a module that has nothing to act on is
worse than dropping the content quietly, because it tells the runtime to expect
something that is not there.

### What crosses

Per-entity placements with compiled spawn conditions, typed hazards, entry gates,
and scene descriptors all reach the engine's content pack — not just the schema.

:::note[The honest boundary]
Not every authored field has an engine-side destination, and the export table says
so per field. Where something cannot cross, the fidelity report records it as
dropped or approximated with a reason. **A silent success is the failure mode this
whole layer exists to prevent** — if the export does not tell you a field was lost,
that is a bug in the export, not a detail of it.
:::

### Known gaps against AI RPG Engine 4.0.0

A boot test on 2026-11-25 exported the Chapel Threshold sample with v4.11.0 and
loaded it in the published engine. The pack loads, and moving between its zones
plays. These parts don't reach play yet:

- **Gated exits.** The engine moves only along `zones[].neighbors`. It drops
  `zones[].exits` and the pack's `connections` when it loads the pack, so a zone
  you reach only through a gated exit can't be entered there. In the sample,
  that's the crypt and the encounter inside it.
- **Custom behaviour profiles.** The engine refuses an `aiProfile` it doesn't
  know, by default (`--unresolved-ai-profile fail` in `validate` and `sidecar`).
  This exporter writes the engine's built-in profiles for every role, so its
  exports load. An entity you give a custom `ai.profileId` needs a host that
  registers that profile, or `--unresolved-ai-profile warn`.
- **Dialogues through the sidecar.** Dialogues play when a host boots the pack
  in-process, as in the engine's JSON boot recipe. The engine's sidecar drops
  them when it loads the pack.
- **Other pack data.** The engine drops these when it loads the pack, and names
  each one with its reason: zone descriptions and hazards, faction presences,
  pressure hotspots, spawn points, the player template, loot tables, landmarks,
  strata and stratum links, transitions, crafting stations, market nodes,
  buildings, hubs, strongholds, the build catalog and progression trees.

Before v4.10.0, the engine refused the exporter's packs at load: encounter types
outside its four, and item placements with no `entityId`. From v4.11.0, exports
declare `engineVersion: ">=4.0.0 <5.0.0"`, because AI RPG Engine 4.0's load gate
refuses a pack whose range excludes it; re-export packs made with earlier versions.

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
| `assets-recovered` | lossless | Asset manifest and bindings restored from ExportResult |
| `asset-packs-recovered` | lossless | Asset packs restored from ExportResult |
| `assets-dropped` | dropped | Assets not available in bare ContentPack format |
| `asset-packs-dropped` | dropped | Asset packs not available in bare ContentPack format |
| `mode-inferred` | approximated | Authoring mode inferred from connection kinds and grid area |

The report includes a summary with overall lossless percentage and per-domain breakdowns, displayed in the editor's Import Summary panel.

## Mode Preservation

The export pipeline stores the project's authoring mode as a `mode:<value>` tag in PackMetadata. On import:

- **ExportResult** — mode is recovered from the `mode:` tag in `packMeta.tags` (lossless)
- **ContentPack / pre-mode projects** — `inferMode()` uses heuristics to recover the likely mode:
  - `channel` or `route` connections → ocean
  - `warp` or `docking` connections → space
  - `trail` connections with camp/wild zone tags → wilderness
  - Grid area ≤ 400 → interior
  - Grid area ≥ 4000 → world
  - Fallback → dungeon

Inferred modes generate a `mode-inferred` fidelity entry at the `approximated` level.

## Dogfood: Chapel Threshold

The `dogfood/` directory contains a full export test using the Chapel Threshold fixture — 5 zones, 2 districts, 4 entities, 3 items, 1 dialogue, 1 player template, 1 build catalog, 2 progression trees. Running `npx tsx dogfood/chapel-threshold.ts` exports the fixture and performs a gap analysis against engine expectations. As of v1.2, the gap analysis reports zero gaps — full engine handshake.
