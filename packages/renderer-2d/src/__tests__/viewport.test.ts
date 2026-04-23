// viewport.test.ts — tests for WorldViewport init error handling (I-005)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pixi.js
vi.mock('pixi.js', () => {
  class MockContainer {
    children: unknown[] = [];
    position = { set: vi.fn() };
    scale = { set: vi.fn() };
    addChild() {}
    addChildAt() {}
    removeChild() {}
  }
  class MockGraphics {
    setStrokeStyle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
    destroy() {}
  }
  class MockApplication {
    stage = new MockContainer();
    canvas = {} as HTMLCanvasElement;
    screen = { width: 800, height: 600 };
    _initFn: (() => Promise<void>) | null = null;
    async init() {
      if (this._initFn) return this._initFn();
    }
    destroy() {}
  }
  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
  };
});

import { WorldViewport } from '../viewport.js';

function makeContainer(): HTMLElement {
  return {
    appendChild: vi.fn(),
  } as unknown as HTMLElement;
}

describe('WorldViewport', () => {
  const defaultOpts = {
    width: 800,
    height: 600,
    gridWidth: 30,
    gridHeight: 25,
    tileSize: 32,
  };

  it('initializes successfully with valid options', async () => {
    const vp = new WorldViewport(defaultOpts);
    const el = makeContainer();
    await expect(vp.init(el)).resolves.toBeUndefined();
  });

  it('wraps PixiJS init errors with context (I-005)', async () => {
    const vp = new WorldViewport(defaultOpts);
    // Force the underlying app.init to reject
    (vp.app as unknown as { _initFn: () => Promise<void> })._initFn = () =>
      Promise.reject(new Error('WebGL not supported'));

    const el = makeContainer();
    await expect(vp.init(el)).rejects.toThrow(/WorldViewport failed to initialize/);
  });

  it('preserves original error as cause (I-005)', async () => {
    const vp = new WorldViewport(defaultOpts);
    const original = new Error('GPU context lost');
    (vp.app as unknown as { _initFn: () => Promise<void> })._initFn = () =>
      Promise.reject(original);

    const el = makeContainer();
    try {
      await vp.init(el);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).cause).toBe(original);
    }
  });

  it('pan updates world position', () => {
    const vp = new WorldViewport(defaultOpts);
    vp.pan(10, 20);
    expect(vp.world.position.set).toHaveBeenCalledWith(10, 20);
    vp.pan(5, -3);
    expect(vp.world.position.set).toHaveBeenCalledWith(15, 17);
  });

  it('zoom clamps between 0.1 and 5', () => {
    const vp = new WorldViewport(defaultOpts);
    vp.zoom(0.001); // extreme shrink
    expect(vp.zoomLevel).toBeCloseTo(0.1, 1);
    // Reset
    vp.zoom(50); // huge zoom -> clamp at 5
    expect(vp.zoomLevel).toBeLessThanOrEqual(5);
  });

  it('throws helpful error when container.appendChild fails (IB-004)', async () => {
    const vp = new WorldViewport(defaultOpts);
    const badContainer = {
      appendChild: () => { throw new Error('Node is not connected'); },
    } as unknown as HTMLElement;
    await expect(vp.init(badContainer)).rejects.toThrow(
      /Failed to mount World Forge viewport/,
    );
  });

  it('preserves original DOM error as cause when mount fails (IB-004)', async () => {
    const vp = new WorldViewport(defaultOpts);
    const original = new Error('detached node');
    const badContainer = {
      appendChild: () => { throw original; },
    } as unknown as HTMLElement;
    try {
      await vp.init(badContainer);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).cause).toBe(original);
    }
  });

  it('showGrid getter reflects setter', () => {
    const vp = new WorldViewport(defaultOpts);
    expect(vp.showGrid).toBe(true);
    vp.showGrid = false;
    expect(vp.showGrid).toBe(false);
  });

  describe('double-init guard (INF-B-002)', () => {
    it('throws a clear error when init() is called twice', async () => {
      const vp = new WorldViewport(defaultOpts);
      const el = makeContainer();
      await vp.init(el);
      await expect(vp.init(el)).rejects.toThrow(
        /WorldViewport already initialized/,
      );
    });

    it('isMounted() returns false before init and true after', async () => {
      const vp = new WorldViewport(defaultOpts);
      expect(vp.isMounted()).toBe(false);
      await vp.init(makeContainer());
      expect(vp.isMounted()).toBe(true);
    });

    it('isMounted() returns false after destroy', async () => {
      const vp = new WorldViewport(defaultOpts);
      await vp.init(makeContainer());
      vp.destroy();
      expect(vp.isMounted()).toBe(false);
    });

    it('does NOT set initialized flag if init fails', async () => {
      const vp = new WorldViewport(defaultOpts);
      (vp.app as unknown as { _initFn: () => Promise<void> })._initFn = () =>
        Promise.reject(new Error('boom'));
      await expect(vp.init(makeContainer())).rejects.toThrow();
      expect(vp.isMounted()).toBe(false);
    });
  });

  describe('post-destroy guard (INF-B-003)', () => {
    it('pan is a no-op after destroy and warns once', () => {
      const vp = new WorldViewport(defaultOpts);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vp.destroy();
      vp.pan(10, 20);
      vp.pan(5, 5);
      vp.pan(-3, -3);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/destroyed/);
      warnSpy.mockRestore();
    });

    it('zoom is a no-op after destroy', () => {
      const vp = new WorldViewport(defaultOpts);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vp.destroy();
      const before = vp.zoomLevel;
      vp.zoom(2);
      expect(vp.zoomLevel).toBe(before);
      warnSpy.mockRestore();
    });

    it('centerOnTile is a no-op after destroy', () => {
      const vp = new WorldViewport(defaultOpts);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vp.destroy();
      expect(() => vp.centerOnTile(5, 5)).not.toThrow();
      warnSpy.mockRestore();
    });

    it('showGrid setter is a no-op after destroy', () => {
      const vp = new WorldViewport(defaultOpts);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vp.destroy();
      const before = vp.showGrid;
      vp.showGrid = !before;
      expect(vp.showGrid).toBe(before);
      warnSpy.mockRestore();
    });

    it('zoomLevel getter warns once after destroy (R2D-A-001)', () => {
      const vp = new WorldViewport(defaultOpts);
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vp.destroy();
      // Reading zoomLevel must emit the destroyed warning (asymmetry fix).
      const z1 = vp.zoomLevel;
      const z2 = vp.zoomLevel;
      const z3 = vp.zoomLevel;
      expect(z1).toBe(1);
      expect(z2).toBe(1);
      expect(z3).toBe(1);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0][0]).toMatch(/zoomLevel/);
      expect(warnSpy.mock.calls[0][0]).toMatch(/destroyed/);
      warnSpy.mockRestore();
    });

    it('destroy is idempotent', () => {
      const vp = new WorldViewport(defaultOpts);
      const spy = vi.spyOn(vp.app, 'destroy');
      vp.destroy();
      vp.destroy();
      vp.destroy();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
