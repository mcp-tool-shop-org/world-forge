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
