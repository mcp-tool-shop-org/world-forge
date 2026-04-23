# @world-forge/export-unreal

Export pipeline for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — converts a `WorldProject` into an **Unreal Engine 5** content pack tuned for 2.5D games.

## Install

```bash
npm install @world-forge/export-unreal
```

## API

```typescript
import { exportToUnreal } from '@world-forge/export-unreal';

const result = exportToUnreal(myProject);
if (!result.success) {
  console.error(result.errors);
} else {
  const { contentPack, warnings, fidelity } = result;
}
```

## CLI

```bash
npx world-forge-export-unreal project.json --out ./UnrealPack
npx world-forge-export-unreal project.json --validate-only
```

## Output layout

Writing to `--out ./UnrealPack` produces:

```
UnrealPack/
  pack.json                  — manifest (id, name, version, source project hash)
  zones/<id>.json            — one Primary Data Asset JSON per zone
  districts/<id>.json        — one per district
  actors/manifest.json       — entity placements grouped by zone, BP-class tag per role
  connections.json           — ZoneConnection → LevelStreamingHint
  world-partition.json       — grid cell hints (gridWidth/gridHeight → UE cells)
  fidelity.json              — what was lossless / approximated / dropped
```

Each zone file carries transformed coordinates in Unreal units (centimetres, Z-up, Y-flipped) and 2.5D-specific fields (elevation, parallax layers, skyline ref).

## Coordinate transform

Pure functions in `coordinate-transform.ts`:

- `pixelsToUnrealCm(pixels, tileSize)` — 1 tile = 100 UE cm by default (1 m).
- `elevationToZ(elevationMeters)` — meters → UE cm.
- `worldForgeToUnrealAxis({ x, y, elevation? })` → `{ X, Y, Z }` (Y-down → Z-up, Y flipped).

## 2.5D awareness

When a zone has `elevation`, `elevationRange`, `parallaxLayers`, or `skylineRef`, the exporter preserves them in the zone asset so the UE5 loader can:

- place the zone volume at the right Z offset,
- stack multi-level zones using `elevationRange.floor` / `elevationRange.ceiling`,
- spawn parallax backdrop actors per `ParallaxLayer` (sorted by `depth`, scrolled by `scrollFactor`),
- bind the skybox / skyline mesh to `skylineRef`.

Projects without 2.5D fields still export cleanly — elevation defaults to 0 and parallax layers are simply omitted.

## Peer packages

`@world-forge/export-ai-rpg` targets the `ai-rpg-engine` ContentPack format. Both exporters consume the same `WorldProject` — pick the one that matches your engine.
