// entity-renderer.ts — entity placement icons

import { Container, Graphics, Text } from 'pixi.js';
import type { EntityPlacement, EntityRole } from '@world-forge/schema';
import type { DiagnosticInfo } from './diagnostics.js';

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
  private destroyed = false;

  constructor(tileSize: number) {
    this.tileSize = tileSize;
    this.container = new Container();
  }

  /**
   * INF-A-009: Tear down the renderer and release all PixiJS resources.
   * Destroys the container and every Graphics/Text child recursively.
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
      className: 'EntityRenderer',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
  }

  update(entities: EntityPlacement[], zonePositions: Map<string, { x: number; y: number }>): void {
    if (this.destroyed) {
      console.warn('EntityRenderer.update: renderer has been destroyed — skipping. Create a new EntityRenderer instance to continue rendering.');
      return;
    }
    // INF-A-002: destroy removed children so Graphics + Text objects don't leak.
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });

    for (const ep of entities) {
      const zonePos = zonePositions.get(ep.zoneId);
      if (!zonePos) {
        console.warn(
          `EntityRenderer.update: entity "${ep.entityId}" references zoneId "${ep.zoneId}" which has no known position — skipping placement. Check that the zone exists and is registered in zonePositions.`,
        );
        continue;
      }

      const x = (ep.gridX ?? zonePos.x + 2) * this.tileSize;
      const y = (ep.gridY ?? zonePos.y + 2) * this.tileSize;
      const color = ROLE_COLORS[ep.role] ?? 0xcccccc;
      const shape = ROLE_SHAPES[ep.role] ?? 'circle';
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

      // TODO: Show name label only on hover instead of always-visible
      const label = new Text({
        text: ep.entityId,
        style: { fontSize: 9, fill: 0xaaaaaa, fontFamily: 'monospace' },
      });
      label.position.set(x + size + 2, y - 4);
      this.container.addChild(label);
    }
  }
}
