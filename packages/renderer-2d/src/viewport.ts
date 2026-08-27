// viewport.ts — PixiJS viewport wrapper with camera controls

import { Application, Container, Graphics } from 'pixi.js';
import type { DiagnosticInfo } from './diagnostics.js';

/** Default grid stroke — ≥3:1 on navy 0x1a1a2e at this alpha (F-87de2dd9). */
export const DEFAULT_GRID_COLOR = 0x6e7681;
export const DEFAULT_GRID_ALPHA = 0.9;
/** Major grid line every N cells. */
export const GRID_MAJOR_EVERY = 8;

export interface ViewportOptions {
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
  backgroundColor?: number;
  /** Grid overlay stroke color. Default 0x6e7681. */
  gridColor?: number;
  /** Grid overlay stroke alpha. Default 0.9. Major lines use min(1, alpha + 0.1). */
  gridAlpha?: number;
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
    // F-03dd3ea3: destroy() is terminal — the Pixi Application is already torn
    // down. Re-init must not call app.init() on it, and must not tell the
    // caller to "call destroy() first" after they already did.
    if (this._destroyed) {
      throw new Error(
        'WorldViewport has been destroyed — construct a new WorldViewport to continue.',
      );
    }
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
      // F-fd76f08c: callers that print err.message never saw the WebGL/GPU
      // reason when it lived only on Error.cause.
      const causeMessage = err instanceof Error ? err.message : String(err);
      throw new Error(
        `WorldViewport failed to initialize PixiJS Application (${this.opts.width}x${this.opts.height}): ${causeMessage}. Check WebGL/GPU availability and that the container is in the document.`,
        { cause: err },
      );
    }
    try {
      container.appendChild(this.app.canvas as HTMLCanvasElement);
    } catch (err) {
      // F-99bd3aa5: app.init() succeeded but mount failed. Tear down the live
      // Application so a retry of init() does not call app.init() twice (the
      // INF-B-002 one-shot guard only looks at _initialized, which is still
      // false here) and so GPU/canvas resources are not leaked until destroy().
      this.app.destroy(true, { children: true, texture: true, textureSource: true });
      this.app = new Application();
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

  /**
   * INF-B-008: Lifecycle observability. Safe to call at any time, including
   * before init() and after destroy(). Never mutates state.
   */
  getDiagnostics(): DiagnosticInfo {
    return {
      className: 'WorldViewport',
      destroyed: this._destroyed,
      childCount: this.world.children.length,
    };
  }

  private drawGrid(): void {
    if (this.gridOverlay) {
      this.world.removeChild(this.gridOverlay);
      this.gridOverlay.destroy();
      this.gridOverlay = null;
    }
    if (!this._showGrid) return;

    const g = new Graphics();
    const { gridWidth, gridHeight, tileSize } = this.opts;
    const color = this.opts.gridColor ?? DEFAULT_GRID_COLOR;
    const alpha = this.opts.gridAlpha ?? DEFAULT_GRID_ALPHA;
    // F-87de2dd9: screen-space hairline so zoom does not hide or fatten lines.
    const hairline = 1 / this._zoom;
    const majorAlpha = Math.min(1, alpha + 0.1);

    const isMajor = (i: number, max: number): boolean =>
      i === 0 || i === max || i % GRID_MAJOR_EVERY === 0;

    for (let x = 0; x <= gridWidth; x++) {
      if (isMajor(x, gridWidth)) continue;
      g.moveTo(x * tileSize, 0);
      g.lineTo(x * tileSize, gridHeight * tileSize);
    }
    for (let y = 0; y <= gridHeight; y++) {
      if (isMajor(y, gridHeight)) continue;
      g.moveTo(0, y * tileSize);
      g.lineTo(gridWidth * tileSize, y * tileSize);
    }
    g.stroke({ width: hairline, color, alpha });

    for (let x = 0; x <= gridWidth; x++) {
      if (!isMajor(x, gridWidth)) continue;
      g.moveTo(x * tileSize, 0);
      g.lineTo(x * tileSize, gridHeight * tileSize);
    }
    for (let y = 0; y <= gridHeight; y++) {
      if (!isMajor(y, gridHeight)) continue;
      g.moveTo(0, y * tileSize);
      g.lineTo(gridWidth * tileSize, y * tileSize);
    }
    g.stroke({ width: hairline, color, alpha: majorAlpha });

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
    // Hairline width is 1/zoom — redraw so the overlay stays 1px on screen.
    this.drawGrid();
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

  set gridColor(v: number) {
    if (this.warnIfDestroyed('gridColor')) return;
    this.opts.gridColor = v;
    this.drawGrid();
  }

  get gridColor(): number {
    return this.opts.gridColor ?? DEFAULT_GRID_COLOR;
  }

  set gridAlpha(v: number) {
    if (this.warnIfDestroyed('gridAlpha')) return;
    this.opts.gridAlpha = v;
    this.drawGrid();
  }

  get gridAlpha(): number {
    return this.opts.gridAlpha ?? DEFAULT_GRID_ALPHA;
  }

  get zoomLevel(): number {
    if (this.warnIfDestroyed('zoomLevel')) return this._zoom;
    return this._zoom;
  }

  /**
   * F-6e1b2c4d: PixiJS v8's `Application.destroy(rendererDestroyOptions, options)`
   * takes two independent parameters — the first tears down the
   * renderer/canvas, the second controls whether the stage's children are
   * recursively destroyed. Passing only `true` left `options` at its default
   * `false`, so `this.world` (where every sibling renderer's container is
   * mounted — see the `world` field) and `gridOverlay` never had their
   * GPU-side resources released. Every sibling renderer in this package
   * (TileLayerRenderer, ZoneOverlayRenderer, EntityRenderer,
   * ConnectionRenderer, MinimapRenderer, DiagnosticsOverlay) already calls
   * `this.container.destroy({ children: true })` — this is the equivalent
   * for the Application-level destroy.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }
}
