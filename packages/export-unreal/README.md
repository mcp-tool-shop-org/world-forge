# @world-forge/export-unreal

Export pipeline for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — converts a `WorldProject` into an **Unreal Engine 5** content pack tuned for 2.5D games.

## Install

```bash
npm install @world-forge/export-unreal
```

## API

Choose this exporter for Unreal Engine 5 2.5D projects. For the AI RPG Engine, use `@world-forge/export-ai-rpg`. For Godot (planned), see `@world-forge/export-godot`.

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
npx world-forge-export-unreal project.json --out ./UnrealPack --sign
npx world-forge-export-unreal --summary ./UnrealPack
npx world-forge-export-unreal --diff ./prev ./new [--detailed]
```

### `--sign` (UE-FT-007)

Attaches an optional integrity hash to `pack.json` under `Meta.Signature`:

```json
{
  "Signature": {
    "algorithm": "sha256",
    "value": "<64-char hex>",
    "signedFields": ["Id", "Name", "Description", "Version", "...", "FormatVersion"]
  }
}
```

The signature is an integrity check, not a MAC — anyone with the pack can re-hash it. The UE5 loader or a CI step calls `verifyPackSignature(meta)` (exported from this package) to detect tampering between export and import. Omit `--sign` for unsigned packs (default, backward compatible).

### `--summary <pack-dir>` / `--diff <prev> <new>` (UE-FT-005)

Human-readable change review over exported packs. `--summary` prints counts + FormatVersion + signed-or-not. `--diff` compares two pack directories and reports added / removed / changed zones, districts, actors, plus FormatVersion and Signature changes. Add `--detailed` to list the ids.

## Pack format versioning (UE-FT-008)

`Meta.FormatVersion` is a semver string. Versioning rules:

- **Major bump** — required field added/removed, or semantics change. Old loaders must refuse.
- **Minor bump** — optional field added (additive, back-compatible). Old loaders ignore new fields.
- **Patch bump** — doc-only.

The current format is `1.1.0` (v1.0.0 → v1.1.0 added the optional `Signature` field). A migration framework (`migratePack` + `MIGRATIONS` chain) walks older packs forward on import; unknown majors are rejected with a clear error naming the version, and newer minors load with a forward-compat warning.

## Output layout

Writing to `--out ./UnrealPack` produces:

```
UnrealPack/
  pack.json                  — manifest (id, name, version, FormatVersion, optional Signature)
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

## UE5 integration

**This package ships the pack, not the loader.** You bring (or build) a small UE5 plugin — Blueprint or C++ — that reads the JSON tree and spawns the world. A concrete loader plugin is not shipped with this npm package; it lives on the UE5 side of the wall where the engine is.

Expected loader contract:

1. Read `pack.json` once to pin the source project id, `TileSizeCm`, and `FormatVersion`. Bail early if `FormatVersion` is past the loader's supported major.
2. Iterate `zones/<id>.json` — each file is a UE5 Primary Data Asset payload with zone extent in UE cm (Z-up, Y-flipped), elevation in cm, parallax layers, and the tileset/background/skyline asset ids.
3. Consult `world-partition.json` to size the streaming grid (`CellsX`, `CellsY`, `CellSizeCm`) and pick a loader strategy (always-loaded for small maps, streaming cells for open worlds).
4. Read `connections.json` to wire LevelStreaming edges and set up teleport/load volumes per `StreamMode`.
5. Iterate `actors/manifest.json` — entities are grouped by zone, each with a role tag (`npc`, `enemy`, `merchant`, `quest-giver`, `companion`, `boss`) the loader maps to a Blueprint class. `LocationCm` is already in UE space.
6. Surface `fidelity.json` to content authors — the `dropped` / `approximated` entries tell them what didn't round-trip and why.

A reference UE5 loader will be published alongside the Star Freight UE5 project when it lands.

## Peer packages

`@world-forge/export-ai-rpg` targets the `ai-rpg-engine` ContentPack format. Both exporters consume the same `WorldProject` — pick the one that matches your engine.
