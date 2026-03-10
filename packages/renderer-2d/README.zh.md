<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

基于 PixiJS 的 2D 渲染器，用于 [World Forge](https://github.com/mcp-tool-shop-org/world-forge) 世界地图。

## 安装

```bash
npm install @world-forge/renderer-2d
```

## 组件

- **WorldViewport**：PixiJS 应用的封装，包含平移、缩放和网格叠加功能。
- **ZoneOverlayRenderer**：区域边界渲染器，带有区域颜色区分，支持选择和悬停。
- **ConnectionRenderer**：区域之间的连接线，单向连接使用箭头，条件连接使用虚线。
- **EntityRenderer**：基于角色的实体图标（NPC、敌人、商人、Boss）。
- **TileLayerRenderer**：分层渲染的瓦片，支持基于标签的颜色设置。
- **MinimapRenderer**：缩略图，包含视口指示器。

## 许可证

MIT
