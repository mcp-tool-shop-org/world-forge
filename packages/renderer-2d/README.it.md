<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

Motore di rendering 2D basato su PixiJS per le mappe di mondi di [World Forge](https://github.com/mcp-tool-shop-org/world-forge).

## Installazione

```bash
npm install @world-forge/renderer-2d
```

## Componenti

- **WorldViewport**: Wrapper per l'applicazione PixiJS con funzionalità di panoramica, zoom e sovrapposizione di griglia.
- **ZoneOverlayRenderer**: Rendering dei confini delle zone con colorazione per distretto, selezione e effetto hover.
- **ConnectionRenderer**: Rendering delle linee tra le zone, con frecce per indicare la direzione (unidirezionale) e linee tratteggiate per indicare condizioni.
- **EntityRenderer**: Icone di entità basate sul ruolo (NPC, nemico, mercante, boss).
- **TileLayerRenderer**: Livelli di tile ordinati per profondità con colorazione basata su tag.
- **MinimapRenderer**: Vista d'insieme ridotta con indicatore della viewport.

## Licenza

MIT
