<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

Pipeline d'exportation pour [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — convertit un `WorldProject` en un `ContentPack` pour [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine).

## Installation

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

## Interface en ligne de commande (CLI)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Quel exportateur choisir ?

World Forge propose plusieurs exportateurs pour différents moteurs. Choisissez celui qui correspond à votre
environnement d'exécution cible :

| Exportateur | Cible | Utiliser lorsque… |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (ce paquet) | `ContentPack` pour [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) | Vous souhaitez un RPG basé sur l'IA, axé sur le texte et les systèmes : PNJ, districts, factions, graphiques de dialogue, arbres de progression. |
| `@world-forge/export-unreal` | Projets Unreal Engine 5 en 2.5D | Vous développez un jeu Unreal en 2.5D et avez besoin de transférer des niveaux, des acteurs et des tableaux de données. |
| `@world-forge/export-godot` | Projets Godot 4 | Vous développez un RPG Godot 4 et souhaitez exporter des scènes et des ressources. |

En cas de doute, commencez par celui-ci (`export-ai-rpg`) — c'est l'exportateur de référence et il produit la couche de système la plus complète.

## Ce que cela convertit

| World Forge | Moteur |
|-------------|--------|
| Zones | `ZoneDefinition[]` |
| Districts | `DistrictDefinition[]` |
| Placements d'entités | `EntityBlueprint[]` (avec statistiques, ressources, IA) |
| Placements d'objets | `ItemDefinition[]` (avec emplacement, rareté, modificateurs) |
| Métadonnées du projet | `GameManifest` + `PackMetadata` |

## Licence

MIT
