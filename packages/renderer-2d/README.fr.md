<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="./logo.png" alt="World Forge" width="400">
</p>

# @world-forge/renderer-2d

Moteur de rendu 2D basé sur PixiJS pour les cartes de mondes [World Forge](https://github.com/mcp-tool-shop-org/world-forge).

## Installation

```bash
npm install @world-forge/renderer-2d
```

## Composants

- **WorldViewport** : Wrapper PixiJS pour l'application, avec panoramique, zoom et superposition de grille.
- **ZoneOverlayRenderer** : Représentation des limites des zones, avec coloration par district, sélection et survol.
- **ConnectionRenderer** : Lignes reliant les zones, flèches pour les connexions unidirectionnelles, lignes pointillées pour les connexions conditionnelles.
- **EntityRenderer** : Icônes d'entités basées sur leur rôle (PNJ, ennemi, marchand, boss).
- **TileLayerRenderer** : Couches de tuiles ordonnées par profondeur, avec coloration basée sur les balises.
- **MinimapRenderer** : Vue d'ensemble à échelle réduite avec indicateur de la zone visible.

## Licence

MIT
