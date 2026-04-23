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
  private destroyed = false;

  constructor(opts: MinimapOptions) {
    this.opts = opts;
    this.container = new Container();
  }

  /**
   * INF-A-011: Tear down the renderer and release all PixiJS resources.
   * Destroys the container and every Graphics child recursively.
   * After calling destroy(), subsequent update() calls are no-ops (with a warning).
   * Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.container.destroy({ children: true });
  }

  update(zones: Zone[], districts: District[], viewportRect?: { x: number; y: number; w: number; h: number }): void {
    if (this.destroyed) {
      console.warn('MinimapRenderer.update: renderer has been destroyed — skipping. Create a new MinimapRenderer instance to continue rendering.');
      return;
    }
    // INF-A-004: destroy removed children so Graphics objects don't leak.
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    const { size, gridWidth, gridHeight } = this.opts;

    if (gridWidth === 0 || gridHeight === 0) {
      console.warn(
        `MinimapRenderer.update: skipping render — gridWidth (${gridWidth}) or gridHeight (${gridHeight}) is zero, which would cause division by zero.`,
      );
      return;
    }

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
