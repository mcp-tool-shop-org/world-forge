// tile-renderer.ts — tile layer rendering

import { Container, Graphics } from 'pixi.js';
import type { TileLayer, TileDefinition, Tileset } from '@world-forge/schema';
import type { DiagnosticInfo } from './diagnostics.js';

export class TileLayerRenderer {
  container: Container;
  private tileSize: number;
  private destroyed = false;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
    this.container = new Container();
  }

  /**
   * INF-A-012: Tear down the renderer and release all PixiJS resources.
   * Destroys the container and every Graphics/Container child recursively.
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
      className: 'TileLayerRenderer',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
  }

  update(layers: TileLayer[], tilesets: Tileset[]): void {
    if (this.destroyed) {
      console.warn('TileLayerRenderer.update: renderer has been destroyed — skipping. Create a new TileLayerRenderer instance to continue rendering.');
      return;
    }
    // INF-B-001: destroy removed children so Graphics + Container objects don't leak.
    // removeChildren() detaches but does not destroy — we must destroy each child recursively.
    const removed = this.container.removeChildren();
    for (const child of removed) (child as { destroy: (opts: { children: boolean }) => void }).destroy({ children: true });

    // Build tile lookup
    const tileDefs = new Map<string, TileDefinition>();
    for (const ts of tilesets) {
      for (const t of ts.tiles) {
        tileDefs.set(t.id, t);
      }
    }

    // Sort layers by zIndex
    const sorted = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    // R2D-B-003: Aggregate missing-tile references. A 100-tile layer with 20
    // missing types would flood the console with duplicate warnings; instead
    // we dedupe by tileId and emit a single summary at the end.
    // Key is `${layerId}::${tileId}` so we can attribute each missing id back
    // to its layer in the summary.
    const missingCounts = new Map<string, number>();

    for (const layer of sorted) {
      const layerContainer = new Container();

      for (const placement of layer.tiles) {
        const def = tileDefs.get(placement.tileId);
        if (!def) {
          const key = `${layer.id}::${placement.tileId}`;
          missingCounts.set(key, (missingCounts.get(key) ?? 0) + 1);
          continue;
        }

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

    // R2D-B-003: emit a single consolidated warning covering every missing
    // tileId × layer pairing, so heavy layers don't flood the console.
    if (missingCounts.size > 0) {
      const totalSkipped = Array.from(missingCounts.values()).reduce((n, v) => n + v, 0);
      const entries = Array.from(missingCounts.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => {
          const [layerId, tileId] = key.split('::');
          return `  - layer "${layerId}" tileId "${tileId}" (${count} placement${count === 1 ? '' : 's'})`;
        })
        .join('\n');
      console.warn(
        `TileLayerRenderer.update: ${totalSkipped} tile placement${totalSkipped === 1 ? '' : 's'} across ${missingCounts.size} missing tile id${missingCounts.size === 1 ? '' : 's'} — not defined in any loaded tileset, skipping:\n${entries}\nEnsure the tilesets containing these tiles are included.`,
      );
    }
  }
}
