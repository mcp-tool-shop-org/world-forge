// connection-renderer.test.ts — tests for ConnectionRenderer leak-free cleanup (INF-A-003)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const destroyCalls: Array<{ kind: string; opts: unknown }> = [];

vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    addChild(child: unknown) { this.children.push(child); }
    removeChildren(): unknown[] {
      const removed = this.children;
      this.children = [];
      return removed;
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Container', opts }); }
  }
  class MockGraphics {
    setStrokeStyle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Graphics', opts }); }
  }
  return { Container: MockContainer, Graphics: MockGraphics };
});

import { ConnectionRenderer } from '../connection-renderer.js';
import type { Zone, ZoneConnection } from '@world-forge/schema';

function zone(id: string, gridX: number, gridY: number): Zone {
  return {
    id,
    name: `Zone ${id}`,
    gridX,
    gridY,
    gridWidth: 4,
    gridHeight: 4,
    biome: 'forest',
    mood: 'calm',
    lightingPreset: 'daylight',
  } as unknown as Zone;
}

describe('ConnectionRenderer', () => {
  let renderer: ConnectionRenderer;
  const zones: Zone[] = [zone('a', 0, 0), zone('b', 10, 10), zone('c', 20, 0)];

  beforeEach(() => {
    destroyCalls.length = 0;
    renderer = new ConnectionRenderer(32);
  });

  it('renders connections without error', () => {
    const conns: ZoneConnection[] = [
      { fromZoneId: 'a', toZoneId: 'b', bidirectional: true } as unknown as ZoneConnection,
      { fromZoneId: 'b', toZoneId: 'c', bidirectional: false } as unknown as ZoneConnection,
    ];
    renderer.update(zones, conns);
    // 1 Graphics per connection
    expect(renderer.container.children.length).toBe(2);
  });

  it('skips connections when from or to zone is missing', () => {
    const conns: ZoneConnection[] = [
      { fromZoneId: 'ghost', toZoneId: 'a', bidirectional: true } as unknown as ZoneConnection,
      { fromZoneId: 'a', toZoneId: 'ghost', bidirectional: true } as unknown as ZoneConnection,
    ];
    renderer.update(zones, conns);
    expect(renderer.container.children.length).toBe(0);
  });

  it('destroys previous Graphics on re-update to prevent leaks (INF-A-003)', () => {
    const conns: ZoneConnection[] = [
      { fromZoneId: 'a', toZoneId: 'b', bidirectional: true } as unknown as ZoneConnection,
      { fromZoneId: 'b', toZoneId: 'c', bidirectional: false } as unknown as ZoneConnection,
    ];
    renderer.update(zones, conns);
    expect(destroyCalls.length).toBe(0);
    expect(renderer.container.children.length).toBe(2);

    renderer.update(zones, [conns[0]]);
    const graphicsDestroyed = destroyCalls.filter((c) => c.kind === 'Graphics').length;
    expect(graphicsDestroyed).toBe(2);
    for (const call of destroyCalls) {
      expect(call.opts).toEqual({ children: true });
    }
    expect(renderer.container.children.length).toBe(1);
  });

  it('keeps container child count bounded across many updates (INF-A-003)', () => {
    const conns: ZoneConnection[] = [
      { fromZoneId: 'a', toZoneId: 'b', bidirectional: true } as unknown as ZoneConnection,
      { fromZoneId: 'b', toZoneId: 'c', bidirectional: false } as unknown as ZoneConnection,
    ];
    for (let i = 0; i < 10; i++) {
      renderer.update(zones, conns);
    }
    expect(renderer.container.children.length).toBe(2);
  });
});
