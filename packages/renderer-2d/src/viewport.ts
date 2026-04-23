// viewport.ts — PixiJS viewport wrapper with camera controls

import { Application, Container, Graphics } from 'pixi.js';

export interface ViewportOptions {
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
  backgroundColor?: number;
}

export class WorldViewport {
  app: Application;
  world: Container;
  private gridOverlay: Graphics | null = null;
  private _showGrid = true;
  private _zoom = 1;
  private _panX = 0;
  private _panY = 0;
  private opts: ViewportOptions;
  private _initialized = false;
  private _destroyed = false;
  private _destroyedWarned = false;

  constructor(opts: ViewportOptions) {
    this.opts = opts;
    this.app = new Application();
    this.world = new Container();
  }

  /**
   * INF-B-003: Guard used by every public method. Returns true if the viewport
   * has been destroyed, and emits a single console.warn the first time it fires
   * so log floods don't drown out the signal.
   */
  private warnIfDestroyed(method: string): boolean {
    if (!this._destroyed) return false;
    if (!this._destroyedWarned) {
      this._destroyedWarned = true;
      console.warn(
        `WorldViewport.${method}: viewport has been destroyed — subsequent calls will be ignored. Create a new WorldViewport instance to continue.`,
      );
    }
    return true;
  }

  async init(container: HTMLElement): Promise<void> {
    // INF-B-002: init() is one-shot — double-init leaks the PixiJS Application
    // and re-parents the world container, producing subtle, hard-to-debug bugs.
    if (this._initialized) {
      throw new Error(
        'WorldViewport already initialized — call destroy() first or instantiate a new viewport.',
      );
    }
    try {
      await this.app.init({
        width: this.opts.width,
        height: this.opts.height,
        backgroundColor: this.opts.backgroundColor ?? 0x1a1a2e,
        antialias: true,
        resizeTo: container,
      });
    } catch (err) {
      throw new Error(
        `WorldViewport failed to initialize PixiJS Application (${this.opts.width}x${this.opts.height})`,
        { cause: err },
      );
    }
    try {
      container.appendChild(this.app.canvas as HTMLCanvasElement);
    } catch (err) {
      throw new Error(
        'Failed to mount World Forge viewport — check that the container element is attached to the DOM.',
        { cause: err },
      );
    }
    this.app.stage.addChild(this.world);
    this.drawGrid();
    this._initialized = true;
  }

  /**
   * INF-B-002: Returns true once init() has completed successfully. Consumers
   * use this to decide whether it's safe to hand the viewport off to renderers.
   */
  isMounted(): boolean {
    return this._initialized && !this._destroyed;
  }

  private drawGrid(): void {
    if (this.gridOverlay) {
      this.world.removeChild(this.gridOverlay);
      this.gridOverlay.destroy();
    }
    if (!this._showGrid) return;

    const g = new Graphics();
    const { gridWidth, gridHeight, tileSize } = this.opts;
    g.setStrokeStyle({ width: 1, color: 0x333333, alpha: 0.3 });

    for (let x = 0; x <= gridWidth; x++) {
      g.moveTo(x * tileSize, 0);
      g.lineTo(x * tileSize, gridHeight * tileSize);
    }
    for (let y = 0; y <= gridHeight; y++) {
      g.moveTo(0, y * tileSize);
      g.lineTo(gridWidth * tileSize, y * tileSize);
    }
    g.stroke();
    this.gridOverlay = g;
    this.world.addChildAt(g, 0);
  }

  pan(dx: number, dy: number): void {
    if (this.warnIfDestroyed('pan')) return;
    this._panX += dx;
    this._panY += dy;
    this.world.position.set(this._panX, this._panY);
  }

  zoom(factor: number): void {
    if (this.warnIfDestroyed('zoom')) return;
    this._zoom = Math.max(0.1, Math.min(5, this._zoom * factor));
    this.world.scale.set(this._zoom);
  }

  centerOnTile(gridX: number, gridY: number): void {
    if (this.warnIfDestroyed('centerOnTile')) return;
    const { tileSize } = this.opts;
    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;
    this._panX = cx - gridX * tileSize * this._zoom;
    this._panY = cy - gridY * tileSize * this._zoom;
    this.world.position.set(this._panX, this._panY);
  }

  set showGrid(v: boolean) {
    if (this.warnIfDestroyed('showGrid')) return;
    this._showGrid = v;
    this.drawGrid();
  }

  get showGrid(): boolean {
    if (this.warnIfDestroyed('showGrid')) return this._showGrid;
    return this._showGrid;
  }

  get zoomLevel(): number {
    return this._zoom;
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.app.destroy(true);
  }
}
