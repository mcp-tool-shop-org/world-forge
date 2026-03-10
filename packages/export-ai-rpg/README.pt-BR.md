<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

Pipeline de exportação para [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — converte um `WorldProject` em um `ContentPack` para o [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine).

## Instalação

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

## Interface de Linha de Comando (CLI)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## O que é convertido

| World Forge | Motor (Engine) |
|-------------|--------|
| Zonas | `ZoneDefinition[]` |
| Distritos | `DistrictDefinition[]` |
| Posicionamentos de entidades | `EntityBlueprint[]` (com estatísticas, recursos, IA) |
| Posicionamentos de itens | `ItemDefinition[]` (com slot, raridade, modificadores) |
| Metadados do projeto | `GameManifest` + `PackMetadata` |

## Licença

MIT
