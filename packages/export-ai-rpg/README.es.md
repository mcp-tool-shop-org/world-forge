<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/export-ai-rpg

Proceso de exportación para [World Forge](https://github.com/mcp-tool-shop-org/world-forge) — convierte un `WorldProject` en un `ContentPack` para [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine).

## Instalación

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

## ¿Qué exportador usar?

World Forge incluye varios exportadores para diferentes motores. Elija el que se adapte a su
entorno de ejecución:

| Exportador | Objetivo | Úselo cuando… |
|----------|--------|-----------|
| `@world-forge/export-ai-rpg` (este paquete) | `ContentPack` para [ai-rpg-engine](https://github.com/mcp-tool-shop-org/ai-rpg-engine) | Quiere un RPG con IA basado en texto y sistemas: personajes no jugables, distritos, facciones, gráficos de diálogo, árboles de progresión. |
| `@world-forge/export-unreal` | Proyectos 2.5D para Unreal Engine 5 | Está creando un juego 2.5D para Unreal Engine y necesita transferir niveles, actores y tablas de datos. |
| `@world-forge/export-godot` | Proyectos para Godot 4 | Está creando un RPG para Godot 4 y desea escenas y recursos. |

Si tiene dudas, comience aquí (`export-ai-rpg`) — es el exportador de referencia y
produce la capa de sistemas más completa.

## Qué convierte

| World Forge | Motor |
|-------------|--------|
| Zonas | `ZoneDefinition[]` |
| Distritos | `DistrictDefinition[]` |
| Colocaciones de entidades | `EntityBlueprint[]` (con estadísticas, recursos, IA) |
| Colocaciones de objetos | `ItemDefinition[]` (con ranura, rareza, modificadores) |
| Metadatos del proyecto | `GameManifest` + `PackMetadata` |

## Licencia

MIT
