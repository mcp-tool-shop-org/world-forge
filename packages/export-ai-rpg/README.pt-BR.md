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
if (!result.success) {
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

## Qual exportador usar?

O World Forge oferece vários exportadores para diferentes engines. Escolha aquele que corresponde ao seu ambiente de execução:

| Exportador | Destino | Use quando… |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (este pacote) | `ContentPack` para [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) | Você deseja um RPG com IA focado em texto e sistemas — NPCs, distritos, facções, gráficos de diálogo, árvores de progressão. |
| `@world-forge/export-unreal` | Projetos 2.5D para Unreal Engine 5 | Você está criando um jogo 2.5D para Unreal Engine e precisa transferir níveis, atores e tabelas de dados. |
| `@world-forge/export-godot` | Projetos para Godot 4 | Você está criando um RPG para Godot 4 e deseja cenas e recursos. |

Se estiver em dúvida, comece por aqui (`export-ai-rpg`) — é o exportador de referência e produz a camada de sistemas mais completa.

## O que ele converte

| World Forge | Engine |
|-------------|--------|
| Zonas | `ZoneDefinition[]` |
| Distritos | `DistrictDefinition[]` |
| Posições de entidades | `EntityBlueprint[]` (com estatísticas, recursos, IA) |
| Posições de itens | `ItemDefinition[]` (com slot, raridade, modificadores) |
| Metadados do projeto | `GameManifest` + `PackMetadata` |

## Licença

MIT
