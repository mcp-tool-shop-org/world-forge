# @world-forge/export-godot

Godot 4 export pipeline for World Forge — converts a `WorldProject` into a structured content pack with `.tscn` scene generation.

`buildWorldScene()` emits a single **playable** `.tscn` — not a metadata graph —
that opens navigable in the Godot 4 editor. Walkable interiors are open (walls
come from per-cell collision); entities and transitions are textureless
placeholders so a clean project does not need PackedScenes this pack does not
ship.

## What lands in the scene

- **Per zone** — a `Node2D` with a `NavigationRegion2D` navmesh (walkable
  interiors are **not** filled with a `StaticBody2D` — walls come from per-cell
  collision; `void`/`hazard` zones still get a solid hull), `y_sort_enabled`,
  and a `z_index` from its stratum band (+ elevation). A framed `Camera2D` sits
  on the root.
- **Tiles** — `TileMapLayer` + `TileSet` (image tilesets bake `tile_map_data`
  cells; color-only layers carry a scaffold + metadata), with per-cell wall
  `StaticBody2D` collision for non-walkable tiles.
- **Props** — a `Props` `Node2D` container.
- **Town** — `Markets` / `CraftingStations`, plus `Buildings` (`StaticBody2D`
  footprints with a `CollisionShape2D`), `Hubs`, and `Strongholds`.
- **World modeling** — `Strata` + `StratumLinks` containers (zones carry
  `stratum_id` + a `z_index` band so layers sort), `Hazards` as `Area2D` regions
  (effects in metadata, read on `body_entered`), and entry-gate metadata on gated
  zones (`entry_gate` / `entry_gate_mode` / `entry_gate_reason`).
- **Content** — entities, items, navigation links, loot tables, spawn markers,
  transition nodes, dialogue resources, asset bindings, and district groupings.
- **Fidelity report** — structured tracking of lossless / approximated / dropped
  data, grouped by domain.

Every node is a textureless, self-contained engine primitive — entities and
transitions are `Node2D` / `Area2D` placeholders (PackedScene paths live in
metadata, matching props), so a clean Godot project loads the export with no
missing PackedScene `ExtResource`s. Image-backed tilesets still declare
`Texture2D` ext_resources for authored tileset files.

## CLI

```
npx @world-forge/export-godot --help
npx world-forge-export-godot project.json --out ./GodotPack
npx world-forge-export-godot project.json --validate-only
npx world-forge-export-godot project.json --out ./GodotPack --no-world-tscn
```

`--out` requires a path that does not start with `-`. Writes `pack.json`, `world.tscn`, a `files/` tree (`res://` stripped), and `fidelity.json`. Exit 1 on `GodotExportError` or write failure, with path + message + a fix hint.

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
