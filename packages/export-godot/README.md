# @world-forge/export-godot

Godot 4 export pipeline for World Forge — converts a `WorldProject` into a structured content pack with `.tscn` scene generation.

## Features

- **Zones** — spatial resources with Godot 2D coordinate transform
- **Entities** — actor manifests with stats, roles, and placement data
- **Items** — resource definitions with slot, rarity, and stat modifiers
- **Connections** — navigation links between zones
- **Dialogues** — branching conversation resources
- **Loot tables** — probability-weighted drop definitions
- **Spawn points** — positioned markers with type metadata
- **Transitions** — scene-change nodes between zones
- **Assets** — binding layer for sprites, portraits, and backgrounds
- **Districts** — faction/economy grouping resources
- **Scene builder** — `buildWorldScene()` generates `.tscn` text via the tres serializer
- **Fidelity report** — structured tracking of lossless / approximated / dropped data

## Usage

```ts
import { exportToGodot } from '@world-forge/export-godot';

const result = exportToGodot(project);
// result.pack — full GodotContentPack
// result.scenes — .tscn scene text per zone
// result.fidelity — structured fidelity report
```

## Format Version

`GODOT_PACK_FORMAT_VERSION` — currently `1.0.0`.

## License

MIT
