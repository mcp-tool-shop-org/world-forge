<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

Motor de renderizado 2D basado en PixiJS para mapas de mundos de [World Forge](https://github.com/mcp-tool-shop-org/world-forge).

## Instalación

```bash
npm install @world-forge/renderer-2d
```

## Componentes

- **WorldViewport**: Envoltorio de la aplicación PixiJS con funciones de desplazamiento, zoom y superposición de cuadrícula.
- **ZoneOverlayRenderer**: Límites de zonas con coloración por distrito, selección/hover.
- **ConnectionRenderer**: Líneas entre zonas, flechas para conexiones unidireccionales, líneas discontinuas para conexiones condicionales.
- **EntityRenderer**: Iconos de entidades basados en roles (NPC, enemigo, comerciante, jefe).
- **TileLayerRenderer**: Capas de mosaicos ordenadas por profundidad con coloración basada en etiquetas.
- **MinimapRenderer**: Vista general a escala con indicador de la ventana de visualización.

## Licencia

MIT
