<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

Tipos principais em TypeScript para [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — um estúdio de criação de mundos 2D para o motor de RPG com inteligência artificial.

## Tipos

- **Espaciais:** `WorldMap` (Mapa do Mundo), `Zone` (Zona), `ZoneExit` (Saída da Zona), `ZoneConnection` (Conexão da Zona), `Landmark` (Marco), `Interactable` (Interagível)
- **Distritos:** `District` (Distrito), `DistrictMetrics` (Métricas do Distrito), `EconomyProfile` (Perfil Econômico), `FactionPresence` (Presença de Facção), `PressureHotspot` (Ponto de Pressão)
- **Entidades:** `EntityPlacement` (Posicionamento de Entidade) (com `EntityStats` (Estatísticas da Entidade), `EntityResources` (Recursos da Entidade), `EntityAI` (IA da Entidade)), `ItemPlacement` (Posicionamento de Item) (com `ItemSlot` (Slot do Item), `ItemRarity` (Raridade do Item)), `SpawnPoint` (Ponto de Geração), `EncounterAnchor` (Ponto de Encontro), `CraftingStation` (Estação de Criação), `MarketNode` (Nó de Mercado)
- **Visuais:** `Tileset` (Conjunto de Tiles), `TileDefinition` (Definição de Tile), `TileLayer` (Camada de Tiles), `PropDefinition` (Definição de Propriedade), `PropPlacement` (Posicionamento de Propriedade), `AmbientLayer` (Camada Ambiental)
- **Projeto:** `WorldProject` — o contêiner completo do mundo criado.
- **Validação:** `validateProject()` com 54 verificações estruturais.

## Instalação

```bash
npm install @world-forge/schema
```

## Uso

```typescript
import type { WorldProject, Zone, EntityPlacement } from '@world-forge/schema';
import { validateProject } from '@world-forge/schema';

const result = validateProject(myProject);
if (!result.valid) {
  console.error(result.errors);
}
```

## Licença

MIT
