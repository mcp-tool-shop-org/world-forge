<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

Renderizador 2D baseado em PixiJS para mapas de mundos do [World Forge](https://github.com/mcp-tool-shop-org/world-forge).

## Instalação

```bash
npm install @world-forge/renderer-2d
```

## Componentes

- **WorldViewport**: Wrapper da aplicação PixiJS com funcionalidades de pan, zoom e sobreposição de grade.
- **ZoneOverlayRenderer**: Renderizador de limites de zonas com coloração por distrito, seleção e efeito de "hover".
- **ConnectionRenderer**: Renderizador de linhas entre zonas, com setas para conexões unidirecionais e linhas tracejadas para conexões condicionais.
- **EntityRenderer**: Renderizador de ícones de entidades baseados em função (NPC, inimigo, comerciante, chefe).
- **TileLayerRenderer**: Renderizador de camadas de tiles com ordenação por profundidade e coloração baseada em tags.
- **MinimapRenderer**: Renderizador de uma visão geral em escala com indicador da área visível.

## Licença

MIT
