// minimap.ts — small overview map

import { Container, Graphics } from 'pixi.js';
import type { Zone, District } from '@world-forge/schema';
import type { DiagnosticInfo } from './diagnostics.js';
import { DISTRICT_COLORS } from './district-colors.js';

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

  /**
   * INF-B-008: Lifecycle observability. Safe to call at any time, including
   * after destroy(). Never mutates state.
   */
  getDiagnostics(): DiagnosticInfo {
    return {
      className: 'MinimapRenderer',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
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

    // F-6e1482bc: uniform scale + center so a non-square grid is letterboxed,
    // not stretched. scaleX === scaleY keeps zone w/h similar to the map.
    const scale = Math.min(size / gridWidth, size / gridHeight);
    const offsetX = (size - gridWidth * scale) / 2;
    const offsetY = (size - gridHeight * scale) / 2;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, size, size).fill({ color: 0x111111, alpha: 0.8 });
    bg.rect(0, 0, size, size).stroke({ width: 1, color: 0x444444 });
    this.container.addChild(bg);

    // Zone blocks
    for (const zone of zones) {
      const g = new Graphics();
      const x = offsetX + zone.gridX * scale;
      const y = offsetY + zone.gridY * scale;
      const w = zone.gridWidth * scale;
      const h = zone.gridHeight * scale;

      let color = 0x888888;
      if (zone.parentDistrictId) {
        const idx = districts.findIndex((d) => d.id === zone.parentDistrictId);
        color = DISTRICT_COLORS[idx % DISTRICT_COLORS.length] ?? 0x888888;
      }

      g.rect(x, y, w, h).fill({ color, alpha: 0.5 });
      g.rect(x, y, w, h).stroke({ width: 1, color: 0xcccccc, alpha: 0.8 });
      this.container.addChild(g);
    }

    // Viewport indicator — filled hairline so it reads on mid-luminance fills.
    if (viewportRect) {
      const vg = new Graphics();
      vg.label = 'viewportRect';
      const vx = offsetX + viewportRect.x * scale;
      const vy = offsetY + viewportRect.y * scale;
      const vw = viewportRect.w * scale;
      const vh = viewportRect.h * scale;
      vg.rect(vx, vy, vw, vh).fill({ color: 0xffffff, alpha: 0.12 });
      vg.rect(vx, vy, vw, vh).stroke({ width: 1, color: 0x4a9eff, alpha: 1 });
      this.container.addChild(vg);
    }
  }
}
