<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

Tipi TypeScript fondamentali per [World Forge](https://github.com/mcp-tool-shop-org/world-forge), uno studio di creazione di mondi 2D per il motore di giochi di ruolo AI.

## Tipi

- **Spaziali:** `WorldMap`, `Zone`, `ZoneExit`, `ZoneConnection`, `Landmark`, `Interactable`
- **Distretti:** `District`, `DistrictMetrics`, `EconomyProfile`, `FactionPresence`, `PressureHotspot`
- **Entità:** `EntityPlacement` (con `EntityStats`, `EntityResources`, `EntityAI`), `ItemPlacement` (con `ItemSlot`, `ItemRarity`), `SpawnPoint`, `EncounterAnchor`, `CraftingStation`, `MarketNode`
- **Visivi:** `Tileset`, `TileDefinition`, `TileLayer`, `PropDefinition`, `PropPlacement`, `AmbientLayer`
- **Progetto:** `WorldProject` — il contenitore completo del mondo creato.
- **Validazione:** `validateProject()` con 54 controlli strutturali.

## Installazione

```bash
npm install @world-forge/schema
```

## Utilizzo

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## Licenza

MIT
