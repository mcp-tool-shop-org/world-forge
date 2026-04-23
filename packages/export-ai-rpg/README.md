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
```

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
