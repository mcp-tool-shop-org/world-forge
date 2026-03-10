<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

PixiJS-based 2D renderer for [World Forge](https://github.com/mcp-tool-shop-org/world-forge) world maps.

## Install

```bash
npm install @world-forge/renderer-2d
```

## Components

- **WorldViewport** — PixiJS Application wrapper with pan, zoom, grid overlay
- **ZoneOverlayRenderer** — zone boundaries with district coloring, selection/hover
- **ConnectionRenderer** — lines between zones, arrows for one-way, dashed for conditional
- **EntityRenderer** — role-based entity icons (NPC, enemy, merchant, boss)
- **TileLayerRenderer** — z-ordered tile layers with tag-based coloring
- **MinimapRenderer** — scaled overview with viewport indicator

## License

MIT
