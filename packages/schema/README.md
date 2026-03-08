# @world-forge/schema

Core TypeScript types for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — a 2D world authoring studio for AI RPG Engine.

## Types

- **Spatial:** `WorldMap`, `Zone`, `ZoneExit`, `ZoneConnection`, `Landmark`, `Interactable`
- **Districts:** `District`, `DistrictMetrics`, `EconomyProfile`, `FactionPresence`, `PressureHotspot`
- **Entities:** `EntityPlacement` (with `EntityStats`, `EntityResources`, `EntityAI`), `ItemPlacement` (with `ItemSlot`, `ItemRarity`), `SpawnPoint`, `EncounterAnchor`, `CraftingStation`, `MarketNode`
- **Visual:** `Tileset`, `TileDefinition`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Project:** `WorldProject` — the complete authored world container
- **Validation:** `validateProject()` with 12 structural checks

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
