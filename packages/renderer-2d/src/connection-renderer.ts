// connection-renderer.ts — zone connection lines/arrows

import { Container, Graphics } from 'pixi.js';
import type { Zone, ZoneConnection } from '@world-forge/schema';
import type { DiagnosticInfo } from './diagnostics.js';

export class ConnectionRenderer {
  container: Container;
  private tileSize: number;
  private destroyed = false;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
    this.container = new Container();
  }

  /**
   * INF-A-010: Tear down the renderer and release all PixiJS resources.
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
      className: 'ConnectionRenderer',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
  }

  update(zones: Zone[], connections: ZoneConnection[]): void {
    if (this.destroyed) {
      console.warn('ConnectionRenderer.update: renderer has been destroyed — skipping. Create a new ConnectionRenderer instance to continue rendering.');
      return;
    }
    // INF-A-003: destroy removed children so Graphics objects don't leak.
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    const zoneMap = new Map(zones.map((z) => [z.id, z]));

    for (const conn of connections) {
      const from = zoneMap.get(conn.fromZoneId);
      const to = zoneMap.get(conn.toZoneId);
      if (!from || !to) continue;

      const fx = (from.gridX + from.gridWidth / 2) * this.tileSize;
      const fy = (from.gridY + from.gridHeight / 2) * this.tileSize;
      const tx = (to.gridX + to.gridWidth / 2) * this.tileSize;
      const ty = (to.gridY + to.gridHeight / 2) * this.tileSize;

      const g = new Graphics();
      const isDashed = !!conn.condition;

      if (isDashed) {
        g.setStrokeStyle({ width: 1, color: 0xffaa00, alpha: 0.6 });
      } else {
        g.setStrokeStyle({ width: 1, color: 0x888888, alpha: 0.6 });
      }

      g.moveTo(fx, fy);
      g.lineTo(tx, ty);
      g.stroke();

      // Arrowhead for one-way connections
      if (!conn.bidirectional) {
        const angle = Math.atan2(ty - fy, tx - fx);
        const headLen = 8;
        g.moveTo(tx, ty);
        g.lineTo(
          tx - headLen * Math.cos(angle - Math.PI / 6),
          ty - headLen * Math.sin(angle - Math.PI / 6),
        );
        g.moveTo(tx, ty);
        g.lineTo(
          tx - headLen * Math.cos(angle + Math.PI / 6),
          ty - headLen * Math.sin(angle + Math.PI / 6),
        );
        g.stroke();
      }

      this.container.addChild(g);
    }
  }
}
