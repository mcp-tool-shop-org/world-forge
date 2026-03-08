// connection-renderer.ts — zone connection lines/arrows

import { Container, Graphics } from 'pixi.js';
import type { Zone, ZoneConnection } from '@world-forge/schema';

export class ConnectionRenderer {
  container: Container;
  private tileSize: number;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
    this.container = new Container();
  }

  update(zones: Zone[], connections: ZoneConnection[]): void {
    this.container.removeChildren();
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
