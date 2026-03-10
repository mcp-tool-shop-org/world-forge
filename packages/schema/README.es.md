<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/schema

Tipos principales de TypeScript para [World Forge](https://github.com/mcp-tool-shop-org/world-forge), un estudio de creación de mundos 2D para el motor de juegos de rol con inteligencia artificial.

## Tipos

- **Espaciales:** `WorldMap` (Mapa del mundo), `Zone` (Zona), `ZoneExit` (Salida de zona), `ZoneConnection` (Conexión de zona), `Landmark` (Punto de referencia), `Interactable` (Objeto interactuable).
- **Distritos:** `District` (Distrito), `DistrictMetrics` (Métricas del distrito), `EconomyProfile` (Perfil económico), `FactionPresence` (Presencia de facción), `PressureHotspot` (Punto caliente de presión).
- **Entidades:** `EntityPlacement` (Colocación de entidad) (con `EntityStats` (Estadísticas de la entidad), `EntityResources` (Recursos de la entidad), `EntityAI` (IA de la entidad)), `ItemPlacement` (Colocación de objeto) (con `ItemSlot` (Ranura del objeto), `ItemRarity` (Rareza del objeto)), `SpawnPoint` (Punto de aparición), `EncounterAnchor` (Anclaje de encuentro), `CraftingStation` (Estación de creación), `MarketNode` (Nodo de mercado).
- **Visuales:** `Tileset` (Conjunto de teselas), `TileDefinition` (Definición de tesela), `TileLayer` (Capa de teselas), `PropDefinition` (Definición de objeto), `PropPlacement` (Colocación de objeto), `AmbientLayer` (Capa ambiental).
- **Proyecto:** `WorldProject` (Proyecto del mundo) — el contenedor completo del mundo creado.
- **Validación:** `validateProject()` con 54 comprobaciones estructurales.

## Instalación

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

## Licencia

MIT
