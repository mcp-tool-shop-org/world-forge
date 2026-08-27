<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

Export pipeline for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — converts a `WorldProject` into an [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) `ContentPack`.

## Install

```bash
npm install @world-forge/export-ai-rpg
```

## API

```typescript
import { exportToEngine } from '@world-forge/export-ai-rpg';

const result = exportToEngine(myProject);
if (!result.success) {
  console.error(result.errors);
} else {
  const { contentPack, manifest, packMeta, warnings } = result;
}
```

## CLI

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
npx world-forge-export --import ./my-pack --out ./imported
npx world-forge-export --from-pack ./my-pack --out ./imported
```

Put `<project.json>` first, or as the first non-option token (`world-forge-export --validate-only project.json` is accepted). Unknown flags are errors and exit 1.

`--out` produces `content-pack.json`, `manifest.json`, `pack-meta.json`, `fidelity.json`, and when present `assets.json` / `asset-bindings.json` / `asset-packs.json`.

| Option | Meaning |
|--------|---------|
| `--out <dir>` | Output directory (default: `./export`; created if missing). Mutually exclusive with `--validate-only` and `--dry-run`. `<dir>` must not start with `-`. |
| `--import <file>` | Import a WorldProject, ContentPack, ExportResult JSON, or a pack directory. Writes `world-project.json` to `--out`, or stdout if `--out` is omitted. |
| `--from-pack <dir>` | Import a pack directory (`content-pack.json` + `pack-meta.json` + `manifest.json`) via `importFromExportResult`. Reads sidecar `fidelity.json` / `assets.json` / `asset-bindings.json` / `asset-packs.json` when present. |
| `--validate-only` | Validate without writing files. Mutually exclusive with `--out`. |
| `--profile release\|debug` | Export profile. `debug` adds a `_debug` block (timestamp, schemaVersion, sourceProjectId, fidelityVerbose). Default: `release`. |
| `--dry-run` | Validate and report sizes without writing files. Mutually exclusive with `--out`. |
| `--verbose` | Detailed diagnostics on every path (success, `--validate-only`, `--dry-run`, and failure). Includes `err.stack` on failure. |
| `--emit-schema-version` | Force-on `ContentPack.schemaVersion`. Wins over `--no-emit-schema-version` and over `WORLD_FORGE_EMIT_SCHEMA_VERSION`. |
| `--no-emit-schema-version` | Strip `ContentPack.schemaVersion`. |
| `WORLD_FORGE_EMIT_SCHEMA_VERSION` | Env: `0` / `false` / `off` disables schemaVersion unless `--emit-schema-version` is set. Default is emit-on. |
| `--help` | Print usage. |

Exit codes: `0` success (including `--validate-only` / `--dry-run` passed); `1` any error (bad args, unreadable input, invalid JSON, validation failure, write failure).

## Which exporter?

World Forge ships multiple engine exporters. Pick the one that matches your
target runtime:

| Exporter | Target | Use when… |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (this package) | [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) `ContentPack` | You want a text-first, systems-driven AI RPG — NPCs, districts, factions, dialogue graphs, progression trees. |
| `@world-forge/export-unreal` | Unreal Engine 5 2.5D projects | You're building a 2.5D Unreal game and need a level/actor/data-table handoff. |
| `@world-forge/export-godot` | Godot 4 projects | You're building a Godot 4 RPG and want scenes + resources. |

If in doubt, start here (`export-ai-rpg`) — it's the reference exporter and
produces the richest systems layer.

## What it converts

| World Forge | Engine |
|-------------|--------|
| Zones | `ZoneDefinition[]` |
| Districts | `DistrictDefinition[]` |
| Entity placements | `EntityBlueprint[]` (with stats, resources, AI) |
| Item placements | `ItemDefinition[]` (with slot, rarity, modifiers) |
| Project metadata | `GameManifest` + `PackMetadata` |

## License

MIT
