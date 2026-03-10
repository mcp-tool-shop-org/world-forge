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
if ('ok' in result) {
  console.error(result.errors);
} else {
  const { contentPack, manifest, packMeta, warnings } = result;
}
```

## Interfaz de línea de comandos (CLI)

```bash
npx world-forge-export project.json --out ./my-pack
npx world-forge-export project.json --validate-only
```

## ¿Qué convierte?

| World Forge | Motor (Engine) |
|-------------|--------|
| Zonas | `ZoneDefinition[]` |
| Distritos | `DistrictDefinition[]` |
| Ubicaciones de entidades | `EntityBlueprint[]` (con estadísticas, recursos, IA) |
| Ubicaciones de objetos | `ItemDefinition[]` (con ranura, rareza, modificadores) |
| Metadatos del proyecto | `GameManifest` + `PackMetadata` |

## Licencia

MIT
