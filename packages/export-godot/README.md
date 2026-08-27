<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-godot

Godot 4 export pipeline for World Forge — converts a `WorldProject` into a structured content pack with `.tscn` scene generation.

`buildWorldScene()` emits a single **playable** `.tscn` — not a metadata graph —
that opens navigable in the Godot 4 editor. Walkable interiors are open (walls
come from per-cell collision); a `CharacterBody2D` pawn (with a following
`Camera2D` and move script) sits at the default spawn; entities are `Node2D` +
`ColorRect`/`Label` placeholders and items/props are `Marker2D` gizmos so a
clean project does not need PackedScenes this pack does not ship. CLI `--out`
is a loadable Godot 4 project (`project.godot` + `res://` layout).

## What lands in the scene

```
World (Node2D, y_sort_enabled)
├── Player (CharacterBody2D) — pawn at the default spawn; Camera2D child follows
│   ├── CollisionShape2D
│   ├── Camera2D
│   └── Body (Polygon2D)
├── <TileLayer> (TileMapLayer) — image layers bake tile_map_data; color-only emit ColorRect cells
├── <ZoneName> (Node2D) — at zone origin, y_sort_enabled, z_index from elevation
│   ├── Collision (StaticBody2D) — only when collisionType is void/hazard
│   │   └── CollisionShape2D — RectangleShape2D covering the zone bounds
│   ├── Navigation (NavigationRegion2D) — walkable interiors only; skipped for void/hazard
│   ├── Entities/ (Node2D)
│   │   └── <EntityName> (Node2D) — ColorRect + Label placeholder; sceneTemplate in metadata
│   ├── Items/ (Node2D)
│   │   └── <ItemName> (Marker2D) — ExtResource item/loot .tres + metadata
│   ├── SpawnPoints/ (Node2D)
│   │   └── <SpawnName> (Marker2D) — extra spawns; default is the pawn
│   └── Transitions/ (Node2D)
│       └── <TransitionName> (Area2D + CollisionShape2D trigger)
└── NavigationLinks/ (Node2D)
```

Color-only layers (no tileset `imagePath` — the editor/renderer-2d default) emit
`ColorRect` children from the wall `#555555` / water `#2244aa` / door `#886622` /
floor `#333333` tag palette (plus `TileDefinition.opacity`); without that
generated-atlas / ColorRect fallback Godot's `TileMapLayer` would be empty while
the editor still paints tagged rects.

- **Per zone** — a `Node2D` with a `NavigationRegion2D` navmesh (walkable
  interiors are **not** filled with a `StaticBody2D` — walls come from per-cell
  collision; `void`/`hazard` zones still get a solid hull), `y_sort_enabled`,
  and a `z_index` from its stratum band (+ elevation). A `CharacterBody2D`
  player pawn at the default spawn carries a following `Camera2D`.
- **Tiles** — `TileMapLayer` + `TileSet` (image tilesets bake `tile_map_data`
  cells; color-only layers emit `ColorRect` children so the map is visible
  without an atlas), with per-cell wall `StaticBody2D` collision for non-walkable
  tiles.
- **Props** — a `Props` container of `Marker2D` gizmos.
- **Town** — `Markets` / `CraftingStations` (`Marker2D`), plus `Buildings`
  (`StaticBody2D` footprints with a `CollisionShape2D`), `Hubs`, and
  `Strongholds`.
- **World modeling** — `Strata` + `StratumLinks` containers (zones carry
  `stratum_id` + a `z_index` band so layers sort), `Hazards` as `Area2D` regions
  (effects in metadata, read on `body_entered`), and entry-gate metadata on gated
  zones (`entry_gate` / `entry_gate_mode` / `entry_gate_reason`).
- **Content** — entities (`ColorRect` + `Label`), items (`Marker2D`), navigation
  links, loot tables, spawn markers, transition nodes, dialogue resources, asset
  bindings, and district groupings.
- **Fidelity report** — structured tracking of lossless / approximated / dropped
  data, grouped by domain.

Every node is a self-contained engine primitive — entities carry a `ColorRect` +
`Label` (PackedScene paths live in metadata), items and props are `Marker2D`
gizmos, transitions are `Area2D` placeholders, so a clean Godot project loads
the export with no missing PackedScene `ExtResource`s. Image-backed tilesets
still declare `Texture2D` ext_resources for authored tileset files.

## CLI

```
npx @world-forge/export-godot --help
npx world-forge-export-godot project.json --out ./GodotPack
npx world-forge-export-godot project.json --validate-only
npx world-forge-export-godot project.json --out ./GodotPack --no-world-tscn
```

`--out` requires a path that does not start with `-`. Writes a Godot 4 project
root: `project.godot` (`run/main_scene="res://world.tscn"`), `world.tscn`,
`.tres` files at the `res://`-stripped `resourcePath` (`world_data/…`), copied
authored textures under `assets/`, `scripts/player.gd`, plus `pack.json` and
`fidelity.json` alongside. Exit 1 on `GodotExportError` or write failure, with
path + message + a fix hint.

## Usage

`exportToGodot` returns a discriminated union (`GodotExportResult | GodotExportError`). Narrow on `success` before reading `contentPack`. Options `includeWorldTscn` and `sceneUidPrefix` live on `GodotExportOptions`.

```ts
import {
  exportToGodot,
  migrateGodotPack,
  isMigrationError,
  GODOT_PACK_FORMAT_VERSION,
} from '@world-forge/export-godot';

const result = exportToGodot(project, {
  includeWorldTscn: true,
  sceneUidPrefix: 'wf',
});

if (!result.success) {
  for (const e of result.errors) {
    console.error(`[${e.path}] ${e.message}`);
  }
  throw new Error('Godot export blocked until the project validates');
}

const { contentPack, warnings, fidelity } = result;
// write contentPack.worldSceneTscn (the playable .tscn) and contentPack.files
// (each stamped resourcePath → .tres body) onto disk, or hand them to a loader.
void contentPack.worldSceneTscn;
void contentPack.files;
for (const w of warnings) console.warn(w);
if (fidelity.summary.incomplete) {
  console.warn('Pack is incomplete — inspect fidelity.entries for dropped/approximated data.');
}

const migrated = migrateGodotPack(contentPack, GODOT_PACK_FORMAT_VERSION);
if (isMigrationError(migrated)) {
  // MALFORMED_VERSION — pack.meta.formatVersion is not N.N.N
  // UNKNOWN_MAJOR    — different major than the loader; re-export with a compatible exporter
  // NO_PATH          — no migration chain from this version to the loader target; re-export
  throw new Error(`${migrated.code}: ${migrated.message}`);
}
```

## Format Version

`GODOT_PACK_FORMAT_VERSION` — currently interpolated from the exporter constant (`1.1.0` as of this writing; import `GODOT_PACK_FORMAT_VERSION` rather than hard-coding `1.0.0`).

Bump rules (keep in sync with `migrations.ts`):

- **Major** — required field added/removed, or field semantics change in a way a loader must see.
- **Minor** — optional field added. Old loaders ignore it; new loaders may read it.
- **Patch** — clarifications, doc-only changes.

When the pack shape changes, bump the constant and add a migration in `src/migrations.ts`. `migrateGodotPack()` walks that chain. 1.1.0 added `files` (each stamped `resourcePath` → `.tres` body) and `zoneGates` on the JSON pack so a data-driven loader does not need to parse the `.tscn`. `isMigrationError()` narrows `MALFORMED_VERSION` / `UNKNOWN_MAJOR` / `NO_PATH`; those loaders should re-export rather than guess.

Pass `includeWorldTscn: false` on `GodotExportOptions` to skip scene generation when only the JSON pack is needed.

## License

MIT
