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

    // F-77095738: aggregate missing from/to zone ids into one warning per
    // update, matching EntityRenderer.update / TileLayerRenderer.update.
    const missingByZone = new Map<string, number>();
    let skipped = 0;

    for (const conn of connections) {
      const from = zoneMap.get(conn.fromZoneId);
      const to = zoneMap.get(conn.toZoneId);
      if (!from || !to) {
        skipped += 1;
        if (!from) missingByZone.set(conn.fromZoneId, (missingByZone.get(conn.fromZoneId) ?? 0) + 1);
        if (!to) missingByZone.set(conn.toZoneId, (missingByZone.get(conn.toZoneId) ?? 0) + 1);
        continue;
      }

      const fx = (from.gridX + from.gridWidth / 2) * this.tileSize;
      const fy = (from.gridY + from.gridHeight / 2) * this.tileSize;
      const tx = (to.gridX + to.gridWidth / 2) * this.tileSize;
      const ty = (to.gridY + to.gridHeight / 2) * this.tileSize;

      const g = new Graphics();
      const isDashed = !!conn.condition;
      const style = {
        width: 1,
        color: isDashed ? 0xffaa00 : 0x888888,
        alpha: 0.6,
      };

      if (isDashed) {
        // F-7f5f8d32: PixiJS v8 Graphics has no setLineDash — draw dash
        // segments along (fx,fy)→(tx,ty), same loop as ZoneOverlayRenderer.
        const dashLen = Math.max(4, Math.floor(this.tileSize / 4));
        const gapLen = Math.max(3, Math.floor(dashLen * 0.6));
        this.drawDashedLine(g, fx, fy, tx, ty, dashLen, gapLen, style);
      } else {
        g.moveTo(fx, fy);
        g.lineTo(tx, ty);
        g.stroke(style);
      }

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
        g.stroke(style);
      }

      this.container.addChild(g);
    }

    if (missingByZone.size > 0) {
      const parts = Array.from(missingByZone.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([zoneId, count]) => `"${zoneId}" (${count})`)
        .join(', ');
      console.warn(
        `ConnectionRenderer.update: ${skipped} connection${skipped === 1 ? '' : 's'} reference ${missingByZone.size} missing zone${missingByZone.size === 1 ? '' : 's'} — skipping lines for ${parts}. Check that each endpoint zone exists.`,
      );
    }
  }

  /**
   * Draw a dashed segment along (x1,y1)→(x2,y2). PixiJS v8 Graphics has no
   * setLineDash, so each dash is its own stroked moveTo/lineTo.
   */
  private drawDashedLine(
    g: Graphics,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLen: number,
    gapLen: number,
    style: { width: number; color: number; alpha: number },
  ): void {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const ux = dx / len;
    const uy = dy / len;
    const stride = dashLen + gapLen;
    let d = 0;
    while (d < len) {
      const segLen = Math.min(dashLen, len - d);
      const sx = x1 + ux * d;
      const sy = y1 + uy * d;
      const ex = x1 + ux * (d + segLen);
      const ey = y1 + uy * (d + segLen);
      g.moveTo(sx, sy).lineTo(ex, ey).stroke(style);
      d += stride;
    }
  }
}
