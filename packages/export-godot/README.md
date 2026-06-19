# @world-forge/export-godot

Godot 4 export pipeline for World Forge — converts a `WorldProject` into a structured content pack with `.tscn` scene generation.

`buildWorldScene()` emits a single **playable** `.tscn` — not a metadata graph —
that opens navigable in the Godot 4 editor. Verified against the real Godot 4.7
engine via a headless dogfood smoke (36 assertions on the generated scene).

## What lands in the scene

- **Per zone** — a `Node2D` with a `StaticBody2D` collision hull, a
  `NavigationRegion2D` navmesh, `y_sort_enabled`, and a `z_index` from its stratum
  band (+ elevation). A framed `Camera2D` sits on the root.
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

Every node is a textureless, self-contained engine primitive — the export loads
clean headless with zero external resources.

## Usage

```ts
import { exportToGodot } from '@world-forge/export-godot';

const result = exportToGodot(project);
// result.contentPack    — full GodotContentPack (zones, tiles, props, town,
//                          strata, hazards, …)
// result.contentPack.worldSceneTscn — the playable .tscn text
// result.fidelity       — structured fidelity report
```

## Format Version

`GODOT_PACK_FORMAT_VERSION` — currently `1.0.0`.

## License

MIT
