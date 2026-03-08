<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/world-forge/readme.png" alt="World Forge" width="400">
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
if ('ok' in result) {
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
