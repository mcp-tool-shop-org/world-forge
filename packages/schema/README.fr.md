<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

Types TypeScript de base pour [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — un studio de création de mondes 2D pour le moteur de jeux de rôle IA.

## Types

- **Spatial (Spatial):** `WorldMap` (Carte du monde), `Zone` (Zone), `ZoneExit` (Sortie de zone), `ZoneConnection` (Connexion de zone), `Landmark` (Point d'intérêt), `Interactable` (Interactif)
- **Districts (Quartiers):** `District` (Quartier), `DistrictMetrics` (Métriques du quartier), `EconomyProfile` (Profil économique), `FactionPresence` (Présence de faction), `PressureHotspot` (Point chaud de pression)
- **Entities (Entités):** `EntityPlacement` (Placement d'entité) (avec `EntityStats` (Statistiques de l'entité), `EntityResources` (Ressources de l'entité), `EntityAI` (IA de l'entité)), `ItemPlacement` (Placement d'objet) (avec `ItemSlot` (Emplacement d'objet), `ItemRarity` (Rareté de l'objet)), `SpawnPoint` (Point de spawn), `EncounterAnchor` (Ancre de rencontre), `CraftingStation` (Station de fabrication), `MarketNode` (Nœud de marché)
- **Visual (Visuel):** `Tileset` (Jeu de tuiles), `TileDefinition` (Définition de tuile), `TileLayer` (Couche de tuiles), `PropDefinition` (Définition d'objet), `PropPlacement` (Placement d'objet), `AmbientLayer` (Couche d'ambiance)
- **Project (Projet):** `WorldProject` — le conteneur complet du monde créé.
- **Validation (Validation):** `validateProject()` avec 54 vérifications structurelles.

## Installation

```bash
npm install @world-forge/schema
```

## Utilisation

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## Licence

MIT
