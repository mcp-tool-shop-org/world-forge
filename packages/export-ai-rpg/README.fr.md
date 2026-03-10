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
if ('ok' in result) {
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

## Ce qui est converti

| World Forge | Moteur (Engine) |
|-------------|--------|
| Zones | `ZoneDefinition[]` |
| Districts | `DistrictDefinition[]` |
| Placements d'entités | `EntityBlueprint[]` (avec statistiques, ressources, IA) |
| Placements d'objets | `ItemDefinition[]` (avec emplacement, rareté, modificateurs) |
| Métadonnées du projet | `GameManifest` + `PackMetadata` |

## Licence

MIT
