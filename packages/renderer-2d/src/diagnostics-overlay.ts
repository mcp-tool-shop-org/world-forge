// diagnostics-overlay.ts — INF-FT-003
// A minimal PixiJS overlay that displays a table of DiagnosticInfo rows for
// the world-forge 2D renderers. Intended as a developer/debug HUD: drop it
// into any stage, call setDiagnostics() with the latest snapshot, and it
// paints a semi-transparent info box listing each renderer's class name,
// child count, and destroyed flag.
//
// Kept deliberately simple — no zoom, no interactivity, no theming knobs.
// The editor can layer its own polish on top if needed.

import { Container, Graphics, Text } from 'pixi.js';
import type { DiagnosticInfo } from './diagnostics.js';

export interface DiagnosticsOverlayOptions {
  /** Top-left anchor in screen pixels (default 8, 8). */
  x?: number;
  y?: number;
  /** Width of the info box in pixels (default 240). */
  width?: number;
}

/**
 * INF-FT-003: Renderer diagnostics overlay.
 *
 * Usage:
 *   const overlay = new DiagnosticsOverlay();
 *   app.stage.addChild(overlay.container);
 *   overlay.setDiagnostics([tileRenderer.getDiagnostics(), zoneRenderer.getDiagnostics(), ...]);
 *   // Later, when no longer needed:
 *   overlay.destroy();
 */
export class DiagnosticsOverlay {
  container: Container;
  private diagnostics: DiagnosticInfo[] = [];
  private opts: Required<DiagnosticsOverlayOptions>;
  private destroyed = false;

  constructor(opts: DiagnosticsOverlayOptions = {}) {
    this.opts = {
      x: opts.x ?? 8,
      y: opts.y ?? 8,
      width: opts.width ?? 240,
    };
    this.container = new Container();
  }

  /**
   * Replace the current diagnostic snapshot and re-render. Accepts any number
   * of DiagnosticInfo objects — one row per renderer.
   */
  setDiagnostics(diagnostics: DiagnosticInfo[]): void {
    if (this.destroyed) {
      console.warn('DiagnosticsOverlay.setDiagnostics: overlay has been destroyed — skipping. Create a new DiagnosticsOverlay instance to continue rendering.');
      return;
    }
    this.diagnostics = diagnostics;
    this.render();
  }

  /**
   * Lifecycle parity with the other renderers. After destroy(), setDiagnostics()
   * is a no-op (with a warning). Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.container.destroy({ children: true });
  }

  /** Lifecycle observability — same shape as renderers. */
  getDiagnostics(): DiagnosticInfo {
    return {
      className: 'DiagnosticsOverlay',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
  }

  private render(): void {
    // Tear down prior draw so PixiJS objects don't leak across updates.
    const removed = this.container.removeChildren();
    for (const child of removed) (child as { destroy: (opts: { children: boolean }) => void }).destroy({ children: true });

    const { x, y, width } = this.opts;
    const lineH = 14;
    const pad = 6;
    const titleH = 16;
    const rows = this.diagnostics.length;
    const boxH = titleH + pad + (rows === 0 ? lineH : rows * lineH) + pad;

    // Background box.
    const bg = new Graphics();
    bg.rect(x, y, width, boxH).fill({ color: 0x000000, alpha: 0.75 });
    bg.rect(x, y, width, boxH).stroke({ width: 1, color: 0x30363d, alpha: 1 });
    this.container.addChild(bg);

    // Title.
    const title = new Text({
      text: `Renderer Diagnostics (${rows})`,
      style: { fontSize: 11, fill: 0x58a6ff, fontFamily: 'monospace' },
    });
    title.position.set(x + pad, y + pad);
    this.container.addChild(title);

    if (rows === 0) {
      const empty = new Text({
        text: '(no renderers)',
        style: { fontSize: 10, fill: 0x8b949e, fontFamily: 'monospace' },
      });
      empty.position.set(x + pad, y + titleH + pad);
      this.container.addChild(empty);
      return;
    }

    // One row per diagnostic. Layout: "ClassName  ch:N  [destroyed]"
    for (let i = 0; i < rows; i++) {
      const d = this.diagnostics[i];
      const rowY = y + titleH + pad + i * lineH;
      const color = d.destroyed ? 0xf85149 : 0xc9d1d9;
      const destroyedTag = d.destroyed ? '  [destroyed]' : '';
      const rowText = new Text({
        text: `${d.className}  ch:${d.childCount}${destroyedTag}`,
        style: { fontSize: 10, fill: color, fontFamily: 'monospace' },
      });
      rowText.position.set(x + pad, rowY);
      this.container.addChild(rowText);
    }
  }
}
