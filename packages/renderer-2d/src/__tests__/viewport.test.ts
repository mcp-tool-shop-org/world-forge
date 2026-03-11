import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pixi.js before importing viewport
vi.mock('pixi.js', () => {
  const Graphics = vi.fn(() => ({
    setStrokeStyle: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    destroy: vi.fn(),
  }));

  const Container = vi.fn(() => ({
    position: { set: vi.fn() },
    scale: { set: vi.fn() },
    addChild: vi.fn(),
    addChildAt: vi.fn(),
    removeChild: vi.fn(),
  }));

  const Application = vi.fn(() => ({
    init: vi.fn(),
    stage: { addChild: vi.fn() },
    screen: { width: 800, height: 600 },
    canvas: {},
    destroy: vi.fn(),
  }));

  return { Application, Container, Graphics };
});

import { WorldViewport, type ViewportOptions } from '../viewport.js';

const defaultOpts: ViewportOptions = {
  width: 800,
  height: 600,
  gridWidth: 20,
  gridHeight: 20,
  tileSize: 32,
};

describe('WorldViewport', () => {
  let vp: WorldViewport;

  beforeEach(() => {
    vp = new WorldViewport(defaultOpts);
  });

  describe('zoom', () => {
    it('starts at zoom 1', () => {
      expect(vp.zoomLevel).toBe(1);
    });

    it('zooms in', () => {
      vp.zoom(2);
      expect(vp.zoomLevel).toBe(2);
    });

    it('zooms out', () => {
      vp.zoom(0.5);
      expect(vp.zoomLevel).toBe(0.5);
    });

    it('clamps zoom to minimum 0.1', () => {
      vp.zoom(0.01);
      expect(vp.zoomLevel).toBeCloseTo(0.1, 5);
    });

    it('clamps zoom to maximum 5', () => {
      vp.zoom(10);
      expect(vp.zoomLevel).toBe(5);
    });

    it('compounds zoom', () => {
      vp.zoom(2);
      vp.zoom(2);
      expect(vp.zoomLevel).toBe(4);
    });

    it('zoom in then out returns to original', () => {
      vp.zoom(2);
      vp.zoom(0.5);
      expect(vp.zoomLevel).toBeCloseTo(1, 5);
    });
  });

  describe('pan', () => {
    it('accumulates pan offsets', () => {
      const posSpy = vp.world.position.set as ReturnType<typeof vi.fn>;
      vp.pan(10, 20);
      expect(posSpy).toHaveBeenLastCalledWith(10, 20);
      vp.pan(-5, 15);
      expect(posSpy).toHaveBeenLastCalledWith(5, 35);
    });
  });

  describe('centerOnTile', () => {
    it('centers on origin tile', () => {
      const posSpy = vp.world.position.set as ReturnType<typeof vi.fn>;
      vp.centerOnTile(0, 0);
      // cx = 800/2 = 400, cy = 600/2 = 300
      // panX = 400 - 0*32*1 = 400, panY = 300 - 0*32*1 = 300
      expect(posSpy).toHaveBeenLastCalledWith(400, 300);
    });

    it('centers on non-origin tile', () => {
      const posSpy = vp.world.position.set as ReturnType<typeof vi.fn>;
      vp.centerOnTile(5, 10);
      // panX = 400 - 5*32*1 = 240, panY = 300 - 10*32*1 = -20
      expect(posSpy).toHaveBeenLastCalledWith(240, -20);
    });

    it('accounts for zoom when centering', () => {
      const posSpy = vp.world.position.set as ReturnType<typeof vi.fn>;
      vp.zoom(2);
      vp.centerOnTile(5, 5);
      // panX = 400 - 5*32*2 = 80, panY = 300 - 5*32*2 = -20
      expect(posSpy).toHaveBeenLastCalledWith(80, -20);
    });
  });

  describe('showGrid', () => {
    it('defaults to true', () => {
      expect(vp.showGrid).toBe(true);
    });

    it('can be toggled off', () => {
      vp.showGrid = false;
      expect(vp.showGrid).toBe(false);
    });

    it('can be toggled back on', () => {
      vp.showGrid = false;
      vp.showGrid = true;
      expect(vp.showGrid).toBe(true);
    });
  });
});
