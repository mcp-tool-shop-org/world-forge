// minimap.ts — small overview map

import { Container, Graphics } from 'pixi.js';
import type { Zone, District } from '@world-forge/schema';

const DISTRICT_COLORS = [
  0x4a9eff, 0xff6b6b, 0x51cf66, 0xffd43b,
  0xcc5de8, 0x20c997, 0xff922b, 0x748ffc,
];

export interface MinimapOptions {
  size: number;
  gridWidth: number;
  gridHeight: number;
}

export class MinimapRenderer {
  container: Container;
  private opts: MinimapOptions;

  constructor(opts: MinimapOptions) {
    this.opts = opts;
    this.container = new Container();
  }

  update(zones: Zone[], districts: District[], viewportRect?: { x: number; y: number; w: number; h: number }): void {
    this.container.removeChildren();
    const { size, gridWidth, gridHeight } = this.opts;
    const scaleX = size / gridWidth;
    const scaleY = size / gridHeight;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, size, size).fill({ color: 0x111111, alpha: 0.8 });
    bg.rect(0, 0, size, size).stroke({ width: 1, color: 0x444444 });
    this.container.addChild(bg);

    // Zone blocks
    for (const zone of zones) {
      const g = new Graphics();
      const x = zone.gridX * scaleX;
      const y = zone.gridY * scaleY;
      const w = zone.gridWidth * scaleX;
      const h = zone.gridHeight * scaleY;

      let color = 0x888888;
      if (zone.parentDistrictId) {
        const idx = districts.findIndex((d) => d.id === zone.parentDistrictId);
        color = DISTRICT_COLORS[idx % DISTRICT_COLORS.length] ?? 0x888888;
      }

      g.rect(x, y, w, h).fill({ color, alpha: 0.5 });
      g.rect(x, y, w, h).stroke({ width: 0.5, color: 0xcccccc, alpha: 0.3 });
      this.container.addChild(g);
    }

    // Viewport indicator
    if (viewportRect) {
      const vg = new Graphics();
      vg.rect(
        viewportRect.x * scaleX,
        viewportRect.y * scaleY,
        viewportRect.w * scaleX,
        viewportRect.h * scaleY,
      ).stroke({ width: 1, color: 0xffffff, alpha: 0.7 });
      this.container.addChild(vg);
    }
  }
}
