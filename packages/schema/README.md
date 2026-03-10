<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

Core TypeScript types for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — a 2D world authoring studio for AI RPG Engine.

## Types

- **Spatial:** `WorldMap`, `Zone`, `ZoneExit`, `ZoneConnection`, `Landmark`, `Interactable`
- **Districts:** `District`, `DistrictMetrics`, `EconomyProfile`, `FactionPresence`, `PressureHotspot`
- **Entities:** `EntityPlacement` (with `EntityStats`, `EntityResources`, `EntityAI`), `ItemPlacement` (with `ItemSlot`, `ItemRarity`), `SpawnPoint`, `EncounterAnchor`, `CraftingStation`, `MarketNode`
- **Visual:** `Tileset`, `TileDefinition`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Project:** `WorldProject` — the complete authored world container
- **Validation:** `validateProject()` with 54 structural checks

## Install

```bash
npm install @world-forge/schema
```

## Usage

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## License

MIT
