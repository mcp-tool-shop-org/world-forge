// entity-renderer.ts — entity placement icons

import { Container, Graphics, Text } from 'pixi.js';
import type { EntityPlacement, EntityRole } from '@world-forge/schema';

const ROLE_COLORS: Record<EntityRole, number> = {
  'npc': 0x4a9eff,
  'enemy': 0xff4444,
  'merchant': 0xffd700,
  'quest-giver': 0x44ff44,
  'companion': 0x44ffaa,
  'boss': 0xff2222,
};

const ROLE_SHAPES: Record<EntityRole, 'circle' | 'diamond' | 'square'> = {
  'npc': 'circle',
  'enemy': 'diamond',
  'merchant': 'square',
  'quest-giver': 'circle',
  'companion': 'circle',
  'boss': 'diamond',
};

export class EntityRenderer {
  container: Container;
  private tileSize: number;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
    this.container = new Container();
  }

  update(entities: EntityPlacement[], zonePositions: Map<string, { x: number; y: number }>): void {
    this.container.removeChildren();

    for (const ep of entities) {
      const zonePos = zonePositions.get(ep.zoneId);
      if (!zonePos) continue;

      const x = (ep.gridX ?? zonePos.x + 2) * this.tileSize;
      const y = (ep.gridY ?? zonePos.y + 2) * this.tileSize;
      const color = ROLE_COLORS[ep.role];
      const shape = ROLE_SHAPES[ep.role];
      const size = ep.role === 'boss' ? 10 : 6;

      const g = new Graphics();

      if (shape === 'circle') {
        g.circle(x, y, size).fill(color);
      } else if (shape === 'diamond') {
        g.moveTo(x, y - size);
        g.lineTo(x + size, y);
        g.lineTo(x, y + size);
        g.lineTo(x - size, y);
        g.closePath();
        g.fill(color);
      } else {
        g.rect(x - size, y - size, size * 2, size * 2).fill(color);
      }

      this.container.addChild(g);

      // Name label on hover would go here — for now, always show
      const label = new Text({
        text: ep.entityId,
        style: { fontSize: 9, fill: 0xaaaaaa, fontFamily: 'monospace' },
      });
      label.position.set(x + size + 2, y - 4);
      this.container.addChild(label);
    }
  }
}
