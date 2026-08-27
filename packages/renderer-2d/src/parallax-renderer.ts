/**
 * parallax-renderer.ts — INF-FT-005: Parallax preview sub-renderer.
 *
 * Depth-sorted sprites (or tinted rects when the referenced asset has no path)
 * sit in this container, which consumers parent *behind* the gameplay
 * WorldViewport.world container. Each layer is scrolled by its scrollFactor
 * relative to WorldViewport pan so a far layer (low scrollFactor) moves less.
 */

import { Container, Graphics, Sprite } from 'pixi.js';
import type { AssetEntry, ParallaxLayer, Zone } from '@world-forge/schema';
import type { DiagnosticInfo } from './diagnostics.js';

export interface ParallaxRenderOptions {
  tileSize: number;
}

/** Neutral tints for placeholder rects, cycled by depth rank. */
const PLACEHOLDER_TINTS = [0x2a2a44, 0x3a3a5c, 0x4a4a70, 0x5a5a84];

interface LayerHandle {
  layerId: string;
  scrollFactor: number;
  baseX: number;
  baseY: number;
  container: Container;
}

export class ParallaxRenderer {
  container: Container;
  private opts: ParallaxRenderOptions;
  private destroyed = false;
  /** INF-FT-005: toggle for parallax visualization. Default on. */
  private showParallax = true;
  private panX = 0;
  private panY = 0;
  private layers: LayerHandle[] = [];

  constructor(opts: ParallaxRenderOptions) {
    this.opts = opts;
    this.container = new Container();
  }

  /**
   * INF-FT-005: Toggle 2.5D parallax visualization.
   * Default is `true`. When `false`, no backdrop layers are drawn.
   * Call `update()` afterward to re-render with the new flag.
   */
  setShowParallax(enabled: boolean): void {
    this.showParallax = enabled;
  }

  /**
   * Scroll every layer by `scrollFactor` relative to the WorldViewport pan.
   * Does not rebuild sprites — only repositions existing layer containers.
   * Far layers (lower scrollFactor) move less than near layers.
   */
  applyPan(panX: number, panY: number): void {
    if (this.destroyed) return;
    this.panX = panX;
    this.panY = panY;
    this.reposition();
  }

  update(
    zones: Zone[],
    assets: AssetEntry[],
    pan?: { x: number; y: number },
  ): void {
    if (this.destroyed) {
      console.warn('ParallaxRenderer.update: renderer has been destroyed — skipping. Create a new ParallaxRenderer instance to continue rendering.');
      return;
    }
    if (pan) {
      this.panX = pan.x;
      this.panY = pan.y;
    }
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    this.layers = [];

    if (!this.showParallax) return;

    const assetById = new Map(assets.map((a) => [a.id, a]));
    const collected: Array<{ zone: Zone; layer: ParallaxLayer }> = [];
    for (const zone of zones) {
      const list = Array.isArray(zone.parallaxLayers) ? zone.parallaxLayers : [];
      for (const layer of list) collected.push({ zone, layer });
    }
    // Higher depth = further back = drawn first.
    collected.sort((a, b) => b.layer.depth - a.layer.depth);

    const { tileSize } = this.opts;
    for (const { zone, layer } of collected) {
      const layerContainer = new Container();
      const baseX = zone.gridX * tileSize;
      const baseY = zone.gridY * tileSize;
      const w = Math.max(1, zone.gridWidth) * tileSize;
      const h = Math.max(1, zone.gridHeight) * tileSize;

      const asset = assetById.get(layer.assetRef);
      const path = asset?.path;
      if (typeof path === 'string' && path.length > 0) {
        const sprite = Sprite.from(path);
        sprite.width = w;
        sprite.height = h;
        layerContainer.addChild(sprite);
      } else {
        const g = new Graphics();
        const tint = PLACEHOLDER_TINTS[Math.abs(Math.floor(layer.depth)) % PLACEHOLDER_TINTS.length];
        g.rect(0, 0, w, h).fill({ color: tint, alpha: 0.45 });
        layerContainer.addChild(g);
      }

      (layerContainer as Container & { layerId: string; scrollFactor: number }).layerId = layer.id;
      (layerContainer as Container & { layerId: string; scrollFactor: number }).scrollFactor = layer.scrollFactor;
      this.layers.push({
        layerId: layer.id,
        scrollFactor: layer.scrollFactor,
        baseX,
        baseY,
        container: layerContainer,
      });
      this.container.addChild(layerContainer);
    }
    this.reposition();
  }

  /**
   * INF-A-008: Tear down the renderer and release all PixiJS resources.
   * Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.layers = [];
    this.container.destroy({ children: true });
  }

  /**
   * INF-B-008: Lifecycle observability. Safe to call at any time, including
   * after destroy(). Never mutates state.
   */
  getDiagnostics(): DiagnosticInfo {
    return {
      className: 'ParallaxRenderer',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
  }

  private reposition(): void {
    for (const layer of this.layers) {
      layer.container.position.set(
        layer.baseX + this.panX * layer.scrollFactor,
        layer.baseY + this.panY * layer.scrollFactor,
      );
    }
  }
}
