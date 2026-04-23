// diagnostics-overlay.test.ts — INF-FT-003
// Validates the DiagnosticsOverlay renders a row per DiagnosticInfo, flags
// destroyed renderers distinctly, and cleans up children between updates.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const destroyCalls: Array<{ kind: string; opts: unknown }> = [];
const createdTexts: Array<{ text: string; style: unknown }> = [];

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
    rect() { return this; }
    fill() { return this; }
    stroke() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Graphics', opts }); }
  }
  class MockText {
    text: string;
    style: unknown;
    position = { set: vi.fn() };
    constructor(opts: { text: string; style: unknown }) {
      this.text = opts.text;
      this.style = opts.style;
      createdTexts.push({ text: opts.text, style: opts.style });
    }
    destroy(opts?: unknown) { destroyCalls.push({ kind: 'Text', opts }); }
  }
  return { Container: MockContainer, Graphics: MockGraphics, Text: MockText };
});

import { DiagnosticsOverlay } from '../diagnostics-overlay.js';
import type { DiagnosticInfo } from '../diagnostics.js';

describe('DiagnosticsOverlay (INF-FT-003)', () => {
  beforeEach(() => {
    destroyCalls.length = 0;
    createdTexts.length = 0;
  });

  it('renders a title + one row per DiagnosticInfo', () => {
    const overlay = new DiagnosticsOverlay();
    const infos: DiagnosticInfo[] = [
      { className: 'TileLayerRenderer', destroyed: false, childCount: 3 },
      { className: 'ZoneOverlayRenderer', destroyed: false, childCount: 8 },
      { className: 'EntityRenderer', destroyed: false, childCount: 0 },
    ];
    overlay.setDiagnostics(infos);

    // Background graphic + title text + 3 row texts = 5 children.
    expect(overlay.container.children.length).toBe(5);

    // Title reflects the row count.
    expect(createdTexts[0].text).toContain('Renderer Diagnostics (3)');

    // One row per renderer, each with className + child count.
    for (const info of infos) {
      const row = createdTexts.find((t) => t.text.startsWith(info.className));
      expect(row, `expected a row for ${info.className}`).toBeTruthy();
      expect(row!.text).toContain(`ch:${info.childCount}`);
      expect(row!.text).not.toContain('[destroyed]');
    }
  });

  it('marks destroyed renderers with a [destroyed] tag', () => {
    const overlay = new DiagnosticsOverlay();
    overlay.setDiagnostics([
      { className: 'TileLayerRenderer', destroyed: false, childCount: 2 },
      { className: 'ZoneOverlayRenderer', destroyed: true, childCount: 0 },
    ]);

    const live = createdTexts.find((t) => t.text.startsWith('TileLayerRenderer'));
    const dead = createdTexts.find((t) => t.text.startsWith('ZoneOverlayRenderer'));
    expect(live!.text).not.toContain('[destroyed]');
    expect(dead!.text).toContain('[destroyed]');
  });

  it('renders an empty state when no diagnostics are supplied', () => {
    const overlay = new DiagnosticsOverlay();
    overlay.setDiagnostics([]);
    // bg + title + empty row
    expect(overlay.container.children.length).toBe(3);
    const emptyRow = createdTexts.find((t) => t.text.includes('no renderers'));
    expect(emptyRow).toBeTruthy();
  });

  it('destroys previous children on re-update to prevent leaks', () => {
    const overlay = new DiagnosticsOverlay();
    overlay.setDiagnostics([{ className: 'A', destroyed: false, childCount: 0 }]);
    const firstChildCount = overlay.container.children.length;
    expect(destroyCalls.length).toBe(0);

    overlay.setDiagnostics([
      { className: 'A', destroyed: false, childCount: 1 },
      { className: 'B', destroyed: true, childCount: 0 },
    ]);

    // The firstChildCount prior children must have been destroyed.
    expect(destroyCalls.length).toBe(firstChildCount);
    // New snapshot: bg + title + 2 rows = 4 children.
    expect(overlay.container.children.length).toBe(4);
  });

  it('destroy() tears down the container and rejects subsequent updates', () => {
    const overlay = new DiagnosticsOverlay();
    overlay.setDiagnostics([{ className: 'A', destroyed: false, childCount: 0 }]);

    overlay.destroy();
    expect(destroyCalls.some((c) => c.kind === 'Container')).toBe(true);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const before = overlay.container.children.length;
    overlay.setDiagnostics([{ className: 'B', destroyed: false, childCount: 0 }]);
    expect(overlay.container.children.length).toBe(before);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toMatch(/destroyed/);
    warnSpy.mockRestore();

    // Idempotent.
    overlay.destroy();
    expect(destroyCalls.filter((c) => c.kind === 'Container').length).toBe(1);
  });

  it('getDiagnostics() reports the overlay itself', () => {
    const overlay = new DiagnosticsOverlay();
    const d1 = overlay.getDiagnostics();
    expect(d1.className).toBe('DiagnosticsOverlay');
    expect(d1.destroyed).toBe(false);
    expect(d1.childCount).toBe(0);

    overlay.setDiagnostics([{ className: 'A', destroyed: false, childCount: 0 }]);
    expect(overlay.getDiagnostics().childCount).toBeGreaterThan(0);

    overlay.destroy();
    expect(overlay.getDiagnostics().destroyed).toBe(true);
  });
});
