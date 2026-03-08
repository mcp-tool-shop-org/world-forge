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

  constructor(opts: ViewportOptions) {
    this.opts = opts;
    this.app = new Application();
    this.world = new Container();
  }

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.opts.width,
      height: this.opts.height,
      backgroundColor: this.opts.backgroundColor ?? 0x1a1a2e,
      antialias: true,
      resizeTo: container,
    });
    container.appendChild(this.app.canvas as HTMLCanvasElement);
    this.app.stage.addChild(this.world);
    this.drawGrid();
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
    this._panX += dx;
    this._panY += dy;
    this.world.position.set(this._panX, this._panY);
  }

  zoom(factor: number): void {
    this._zoom = Math.max(0.1, Math.min(5, this._zoom * factor));
    this.world.scale.set(this._zoom);
  }

  centerOnTile(gridX: number, gridY: number): void {
    const { tileSize } = this.opts;
    const cx = this.app.screen.width / 2;
    const cy = this.app.screen.height / 2;
    this._panX = cx - gridX * tileSize * this._zoom;
    this._panY = cy - gridY * tileSize * this._zoom;
    this.world.position.set(this._panX, this._panY);
  }

  set showGrid(v: boolean) {
    this._showGrid = v;
    this.drawGrid();
  }

  get showGrid(): boolean {
    return this._showGrid;
  }

  get zoomLevel(): number {
    return this._zoom;
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
