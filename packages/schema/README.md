<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

Core TypeScript types for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — a 2D world authoring studio for AI RPG Engine.

## Types

- **Spatial:** `WorldMap`, `Zone`, `ZoneExit`, `ZoneConnection`, `Landmark`, `Interactable`, `ZoneEntryGate`
- **Districts:** `District`, `DistrictMetrics`, `EconomyProfile`, `FactionPresence`, `PressureHotspot`
- **Entities:** `EntityPlacement` (with `EntityStats`, `EntityResources`, `EntityAI`), `ItemPlacement` (with `ItemSlot`, `ItemRarity`), `SpawnPoint`, `EncounterAnchor`, `CraftingStation`, `MarketNode`
- **Town & structures:** `Building`, `Hub`, `Stronghold`
- **World modeling:** `Stratum`, `StratumLink` (vertical layers), `HazardDefinition` (typed effects union), plus party-state `SpawnCondition` operands powering `ZoneEntryGate`
- **Visual:** `Tileset`, `TileDefinition`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Project:** `WorldProject` — the complete authored world container
- **Shape helpers:** `createEmptyProject()`, `normalizeProjectShape()`, `stampProjectSchemaVersion()` — v4.x backfill for arrays added after v4.0
- **Closed unions:** `VALID_*` sets (`VALID_CONNECTION_KINDS`, `VALID_PHYSICS_MODES`, …) — refuse-to-guess lookups derived from the TypeScript unions
- **Validation:** `validateProject()` — numbered structural checks live in `src/validate.ts` (do not treat a published count as the contract)

## Install

```bash
npm install @world-forge/schema
```

## Usage

```typescript
import type { WorldProject } from '@world-forge/schema';
import {
  validateProject,
  stampProjectSchemaVersion,
  normalizeProjectShape,
  VALID_PHYSICS_MODES,
} from '@world-forge/schema';

// v4.0 JSON may omit arrays added later (craftingStations, tilesets, …).
// Stamp backfills omitted required arrays to []; validateProject still rejects
// present-but-wrong types on the raw document.
const parsed: unknown = JSON.parse(raw);
const project = stampProjectSchemaVersion(
  normalizeProjectShape(parsed) ?? (parsed as WorldProject),
);
const result = validateProject(project);
if (!result.valid) {
  console.error(result.errors);
}

VALID_PHYSICS_MODES.has('platformer'); // true — refuse-to-guess against one source
```

## License

MIT
