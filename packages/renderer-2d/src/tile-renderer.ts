// tile-renderer.ts — tile layer rendering

import { Container, Graphics } from 'pixi.js';
import type { TileLayer, TileDefinition, Tileset } from '@world-forge/schema';

export class TileLayerRenderer {
  container: Container;
  private tileSize: number;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
    this.container = new Container();
  }

  update(layers: TileLayer[], tilesets: Tileset[]): void {
    this.container.removeChildren();

    // Build tile lookup
    const tileDefs = new Map<string, TileDefinition>();
    for (const ts of tilesets) {
      for (const t of ts.tiles) {
        tileDefs.set(t.id, t);
      }
    }

    // Sort layers by zIndex
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sorted) {
      const layerContainer = new Container();

      for (const placement of layer.tiles) {
        const def = tileDefs.get(placement.tileId);
        if (!def) continue;

        // Without actual tileset images, render colored rectangles based on tags
        const g = new Graphics();
        const x = placement.gridX * this.tileSize;
        const y = placement.gridY * this.tileSize;

        let color = 0x333333; // default floor
        if (def.tags.includes('wall')) color = 0x555555;
        else if (def.tags.includes('water')) color = 0x2244aa;
        else if (def.tags.includes('door')) color = 0x886622;

        g.rect(x, y, this.tileSize, this.tileSize).fill({ color, alpha: def.opacity });
        layerContainer.addChild(g);
      }

      this.container.addChild(layerContainer);
    }
  }
}
