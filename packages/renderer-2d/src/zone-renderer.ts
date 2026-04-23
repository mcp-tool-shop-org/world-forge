// zone-renderer.ts — zone boundaries, highlights, labels

import { Container, Graphics, Text } from 'pixi.js';
import type { Zone, District } from '@world-forge/schema';
import type { DiagnosticInfo } from './diagnostics.js';

export interface ZoneRenderOptions {
  tileSize: number;
  selectedZoneId?: string;
  hoveredZoneId?: string;
}

const DISTRICT_COLORS = [
  0x4a9eff, 0xff6b6b, 0x51cf66, 0xffd43b,
  0xcc5de8, 0x20c997, 0xff922b, 0x748ffc,
];

/** INF-FT-002: max shadow offset in pixels (clamped so very tall zones don't break layout). */
const MAX_ELEVATION_SHADOW_PX = 8;
/** INF-FT-002: elevation (meters) that maps to the max shadow offset. */
const ELEVATION_SHADOW_RANGE_M = 10;

export class ZoneOverlayRenderer {
  container: Container;
  private zones: Zone[] = [];
  private districts: District[] = [];
  private opts: ZoneRenderOptions;
  private destroyed = false;
  /** INF-FT-002: toggle for elevation visualization cues (drop shadow, sunken tint, dashed multi-level outline). */
  private showElevation = true;

  constructor(opts: ZoneRenderOptions) {
    this.opts = opts;
    this.container = new Container();
  }

  update(zones: Zone[], districts: District[], opts?: Partial<ZoneRenderOptions>): void {
    if (this.destroyed) {
      console.warn('ZoneOverlayRenderer.update: renderer has been destroyed — skipping. Create a new ZoneOverlayRenderer instance to continue rendering.');
      return;
    }
    this.zones = zones;
    this.districts = districts;
    if (opts) Object.assign(this.opts, opts);
    this.render();
  }

  /**
   * INF-FT-002: Toggle 2.5D elevation visualization cues.
   * Default is `true`. When `false`, no drop shadows, sunken tints, or dashed
   * multi-level outlines are drawn — the renderer falls back to the flat 2D look.
   * Call `update()` afterward to re-render with the new flag.
   */
  setShowElevation(enabled: boolean): void {
    this.showElevation = enabled;
  }

  /**
   * INF-A-008: Tear down the renderer and release all PixiJS resources.
   * Destroys the container and every Graphics/Text child recursively.
   * After calling destroy(), subsequent update() calls are no-ops (with a warning).
   * Idempotent — safe to call multiple times.
   */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.container.destroy({ children: true });
  }

  /**
   * INF-B-008: Lifecycle observability. Safe to call at any time, including
   * after destroy(). Never mutates state.
   */
  getDiagnostics(): DiagnosticInfo {
    return {
      className: 'ZoneOverlayRenderer',
      destroyed: this.destroyed,
      childCount: this.container.children.length,
    };
  }

  /**
   * INF-FT-002: Draw a dashed outline around a rect on the given Graphics.
   * Used to indicate multi-level zones (elevationRange floor !== ceiling).
   * Each dash is drawn as its own stroked line segment along the perimeter.
   */
  private drawDashedRect(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    dashLen: number,
    gapLen: number,
    style: { width: number; color: number; alpha: number },
  ): void {
    const stride = dashLen + gapLen;
    // Helper: draw dashes along a horizontal or vertical segment.
    const drawSide = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      if (len === 0) return;
      const ux = dx / len;
      const uy = dy / len;
      let d = 0;
      while (d < len) {
        const segLen = Math.min(dashLen, len - d);
        const sx = x1 + ux * d;
        const sy = y1 + uy * d;
        const ex = x1 + ux * (d + segLen);
        const ey = y1 + uy * (d + segLen);
        g.moveTo(sx, sy).lineTo(ex, ey).stroke(style);
        d += stride;
      }
    };
    drawSide(x, y, x + w, y);           // top
    drawSide(x + w, y, x + w, y + h);   // right
    drawSide(x + w, y + h, x, y + h);   // bottom
    drawSide(x, y + h, x, y);           // left
  }

  private getDistrictColor(zone: Zone): number {
    if (!zone.parentDistrictId) return 0x888888;
    const idx = this.districts.findIndex((d) => d.id === zone.parentDistrictId);
    return DISTRICT_COLORS[idx % DISTRICT_COLORS.length] ?? 0x888888;
  }

  private render(): void {
    // INF-A-001: destroy removed children so Graphics + Text objects don't leak.
    // PixiJS v8 removeChildren() returns the removed children array.
    const removed = this.container.removeChildren();
    for (const child of removed) child.destroy({ children: true });
    const { tileSize, selectedZoneId, hoveredZoneId } = this.opts;

    for (const zone of this.zones) {
      const x = zone.gridX * tileSize;
      const y = zone.gridY * tileSize;
      const w = zone.gridWidth * tileSize;
      const h = zone.gridHeight * tileSize;
      const color = this.getDistrictColor(zone);
      const isSelected = zone.id === selectedZoneId;
      const isHovered = zone.id === hoveredZoneId;

      // INF-FT-002: 2.5D elevation cues. Drawn BEFORE the zone's own fill so the
      // shadow sits behind and the sunken tint overlays cleanly. Skipped entirely
      // when showElevation is false.
      const elevation = zone.elevation ?? 0;
      const range = zone.elevationRange;
      const isMultiLevel = !!range && range.floor !== range.ceiling;

      if (this.showElevation) {
        if (elevation > 0) {
          // Drop shadow: offset proportional to elevation, clamped at MAX_ELEVATION_SHADOW_PX.
          const norm = Math.min(elevation / ELEVATION_SHADOW_RANGE_M, 1);
          const offset = norm * MAX_ELEVATION_SHADOW_PX;
          const shadow = new Graphics();
          shadow.rect(x + offset, y + offset, w, h).fill({ color: 0x000000, alpha: 0.25 });
          this.container.addChild(shadow);
        } else if (elevation < 0) {
          // Sunken cue: darker tint overlay (rendered as a dark fill behind the main fill).
          const tint = new Graphics();
          tint.rect(x, y, w, h).fill({ color: 0x000000, alpha: 0.12 });
          this.container.addChild(tint);
        }
      }

      const g = new Graphics();

      // Fill
      if (isSelected) {
        g.rect(x, y, w, h).fill({ color, alpha: 0.25 });
      } else if (isHovered) {
        g.rect(x, y, w, h).fill({ color, alpha: 0.12 });
      } else {
        g.rect(x, y, w, h).fill({ color, alpha: 0.06 });
      }

      // Border — dashed when zone spans multiple levels (INF-FT-002).
      const borderWidth = isSelected ? 3 : 1;
      const borderAlpha = isSelected ? 1 : 0.5;
      if (this.showElevation && isMultiLevel) {
        // Manual dashed outline: PixiJS v8 Graphics doesn't have setLineDash, so
        // we draw dash segments around the perimeter. Dash length scales with tileSize.
        const dashLen = Math.max(4, Math.floor(tileSize / 4));
        const gapLen = Math.max(3, Math.floor(dashLen * 0.6));
        this.drawDashedRect(g, x, y, w, h, dashLen, gapLen, { width: borderWidth, color, alpha: borderAlpha });
      } else {
        g.rect(x, y, w, h).stroke({ width: borderWidth, color, alpha: borderAlpha });
      }

      this.container.addChild(g);

      // Label
      const label = new Text({
        text: zone.name,
        style: { fontSize: 11, fill: 0xcccccc, fontFamily: 'monospace' },
      });
      label.position.set(x + 4, y + 2);
      this.container.addChild(label);
    }
  }
}
