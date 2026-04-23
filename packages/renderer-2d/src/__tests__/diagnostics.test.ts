// diagnostics.test.ts — INF-B-008
// Verify every renderer exposes a consistent DiagnosticInfo shape, safe before
// and after destroy, and that class names match.

import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
    addChild(child: unknown) { this.children.push(child); }
    addChildAt() {}
    removeChild() {}
    removeChildren(): unknown[] {
      const removed = this.children;
      this.children = [];
      return removed;
    }
    destroy() {}
  }
  class MockGraphics {
    setStrokeStyle() { return this; }
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    circle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
    destroy() {}
  }
  class MockText {
    text: string;
    style: unknown;
    position = { set: vi.fn() };
    constructor(opts: { text: string; style: unknown }) {
      this.text = opts.text;
      this.style = opts.style;
    }
    destroy() {}
  }
  class MockApplication {
    stage = new MockContainer();
    canvas = {} as HTMLCanvasElement;
    screen = { width: 800, height: 600 };
    async init() {}
    destroy() {}
  }
  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Text: MockText,
  };
});

import { TileLayerRenderer } from '../tile-renderer.js';
import { EntityRenderer } from '../entity-renderer.js';
import { ConnectionRenderer } from '../connection-renderer.js';
import { MinimapRenderer } from '../minimap.js';
import { ZoneOverlayRenderer } from '../zone-renderer.js';

describe('DiagnosticInfo shape (INF-B-008)', () => {
  it('TileLayerRenderer.getDiagnostics()', () => {
    const r = new TileLayerRenderer(32);
    const d = r.getDiagnostics();
    expect(d.className).toBe('TileLayerRenderer');
    expect(d.destroyed).toBe(false);
    expect(d.childCount).toBe(0);
    r.destroy();
    const d2 = r.getDiagnostics();
    expect(d2.destroyed).toBe(true);
    expect(d2.className).toBe('TileLayerRenderer');
  });

  it('EntityRenderer.getDiagnostics()', () => {
    const r = new EntityRenderer(32);
    const d = r.getDiagnostics();
    expect(d.className).toBe('EntityRenderer');
    expect(d.destroyed).toBe(false);
    expect(d.childCount).toBe(0);
    r.destroy();
    expect(r.getDiagnostics().destroyed).toBe(true);
  });

  it('ConnectionRenderer.getDiagnostics()', () => {
    const r = new ConnectionRenderer(32);
    const d = r.getDiagnostics();
    expect(d.className).toBe('ConnectionRenderer');
    expect(d.destroyed).toBe(false);
    expect(d.childCount).toBe(0);
    r.destroy();
    expect(r.getDiagnostics().destroyed).toBe(true);
  });

  it('MinimapRenderer.getDiagnostics()', () => {
    const r = new MinimapRenderer({ size: 100, gridWidth: 10, gridHeight: 10 });
    const d = r.getDiagnostics();
    expect(d.className).toBe('MinimapRenderer');
    expect(d.destroyed).toBe(false);
    expect(d.childCount).toBe(0);
    r.destroy();
    expect(r.getDiagnostics().destroyed).toBe(true);
  });

  it('ZoneOverlayRenderer.getDiagnostics()', () => {
    const r = new ZoneOverlayRenderer({ tileSize: 32 });
    const d = r.getDiagnostics();
    expect(d.className).toBe('ZoneOverlayRenderer');
    expect(d.destroyed).toBe(false);
    expect(d.childCount).toBe(0);
    r.destroy();
    expect(r.getDiagnostics().destroyed).toBe(true);
  });

  it('childCount reflects current container.children length', () => {
    const r = new EntityRenderer(32);
    r.update(
      [{ entityId: 'e1', zoneId: 'z1', role: 'npc' }],
      new Map([['z1', { x: 0, y: 0 }]]),
    );
    // 1 entity = 1 graphic + 1 label = 2 children
    expect(r.getDiagnostics().childCount).toBe(2);
  });
});
