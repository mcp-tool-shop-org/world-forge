<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

Pipeline di esportazione per [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — converte un `WorldProject` in un `ContentPack` per [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine).

## Installazione

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

## Interfaccia a riga di comando (CLI)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## Cosa viene convertito

| World Forge | Motore (Engine) |
|-------------|--------|
| Zone | `ZoneDefinition[]` |
| Distretti | `DistrictDefinition[]` |
| Posizionamenti di entità | `EntityBlueprint[]` (con statistiche, risorse, intelligenza artificiale) |
| Posizionamenti di oggetti | `ItemDefinition[]` (con slot, rarità, modificatori) |
| Metadati del progetto | `GameManifest` + `PackMetadata` |

## Licenza

MIT
