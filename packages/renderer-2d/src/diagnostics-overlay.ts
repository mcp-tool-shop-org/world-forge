// diagnostics-overlay.ts — INF-FT-003
// Developer/debug HUD for world-forge 2D renderers. Drop it into any stage,
// call setDiagnostics() with the latest snapshot, and it paints a
// semi-transparent info box listing each renderer's class name, child count,
// and destroyed flag. Palette matches the viewport (0x4a9eff / 0xcccccc).

import { Container, Graphics, Text } from 'pixi.js';
import type { DiagnosticInfo } from './diagnostics.js';

export interface DiagnosticsOverlayOptions {
  /** Top-left anchor in screen pixels (default 8, 8). */
  x?: number;
  y?: number;
  /** Width of the info box in pixels (default 280). Grows if a row is wider. */
  width?: number;
}

const DEFAULT_WIDTH = 280;
const PAD = 8;
const LINE_H = 18;
const TITLE_H = 20;
const CLASS_COL = 22;
const CH_COL = 8;
/** 10px monospace advance used when measuring / growing the box. */
const MONO_ADVANCE = 6;

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
      width: opts.width ?? DEFAULT_WIDTH,
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

    const { x, y } = this.opts;
    const pad = PAD;
    const lineH = LINE_H;
    const titleH = TITLE_H;
    const rows = this.diagnostics.length;
    const innerW = Math.max(1, this.opts.width - 2 * pad);

    const title = new Text({
      text: `Renderer Diagnostics (${rows})`,
      style: {
        fontSize: 11,
        fill: 0x4a9eff,
        fontFamily: 'monospace',
        wordWrap: true,
        wordWrapWidth: innerW,
      },
    });

    const rowTexts: Text[] = [];
    if (rows === 0) {
      rowTexts.push(new Text({
        text: '(no renderers)',
        style: {
          fontSize: 10,
          fill: 0x8b949e,
          fontFamily: 'monospace',
          wordWrap: true,
          wordWrapWidth: innerW,
        },
      }));
    } else {
      for (let i = 0; i < rows; i++) {
        const d = this.diagnostics[i];
        const color = d.destroyed ? 0xf85149 : 0xcccccc;
        const destroyedTag = d.destroyed ? '[destroyed]' : '';
        const row = `${padRight(d.className, CLASS_COL)}${padRight(`ch:${d.childCount}`, CH_COL)}${destroyedTag}`.trimEnd();
        rowTexts.push(new Text({
          text: row,
          style: {
            fontSize: 10,
            fill: color,
            fontFamily: 'monospace',
            wordWrap: true,
            wordWrapWidth: innerW,
          },
        }));
      }
    }

    const measured = Math.max(
      textWidth(title, innerW),
      ...rowTexts.map((t) => textWidth(t, innerW)),
    );
    const width = Math.max(this.opts.width, measured + 2 * pad);
    const boxH = titleH + pad + (rowTexts.length * lineH) + pad;

    const bg = new Graphics();
    bg.rect(x, y, width, boxH).fill({ color: 0x000000, alpha: 0.75 });
    bg.rect(x, y, width, boxH).stroke({ width: 1, color: 0x30363d, alpha: 1 });
    this.container.addChild(bg);

    title.position.set(x + pad, y + pad);
    this.container.addChild(title);

    for (let i = 0; i < rowTexts.length; i++) {
      rowTexts[i].position.set(x + pad, y + titleH + pad + i * lineH);
      this.container.addChild(rowTexts[i]);
    }
  }
}

function padRight(s: string, n: number): string {
  return s.length >= n ? `${s} ` : s + ' '.repeat(n - s.length);
}

function textWidth(t: Text, cap: number): number {
  const measured = typeof t.width === 'number' && t.width > 0
    ? t.width
    : t.text.length * MONO_ADVANCE;
  return Math.min(measured, cap);
}
