// zone-renderer.ts — zone boundaries, highlights, labels

import { Container, Graphics, Text } from 'pixi.js';
import type { Zone, District } from '@world-forge/schema';

export interface ZoneRenderOptions {
  tileSize: number;
  selectedZoneId?: string;
  hoveredZoneId?: string;
}

const DISTRICT_COLORS = [
  0x4a9eff, 0xff6b6b, 0x51cf66, 0xffd43b,
  0xcc5de8, 0x20c997, 0xff922b, 0x748ffc,
];

export class ZoneOverlayRenderer {
  container: Container;
  private zones: Zone[] = [];
  private districts: District[] = [];
  private opts: ZoneRenderOptions;

  constructor(opts: ZoneRenderOptions) {
    this.opts = opts;
    this.container = new Container();
  }

  update(zones: Zone[], districts: District[], opts?: Partial<ZoneRenderOptions>): void {
    this.zones = zones;
    this.districts = districts;
    if (opts) Object.assign(this.opts, opts);
    this.render();
  }

  private getDistrictColor(zone: Zone): number {
    if (!zone.parentDistrictId) return 0x888888;
    const idx = this.districts.findIndex((d) => d.id === zone.parentDistrictId);
    return DISTRICT_COLORS[idx % DISTRICT_COLORS.length] ?? 0x888888;
  }

  private render(): void {
    this.container.removeChildren();
    const { tileSize, selectedZoneId, hoveredZoneId } = this.opts;

    for (const zone of this.zones) {
      const x = zone.gridX * tileSize;
      const y = zone.gridY * tileSize;
      const w = zone.gridWidth * tileSize;
      const h = zone.gridHeight * tileSize;
      const color = this.getDistrictColor(zone);
      const isSelected = zone.id === selectedZoneId;
      const isHovered = zone.id === hoveredZoneId;

      const g = new Graphics();

      // Fill
      if (isSelected) {
        g.rect(x, y, w, h).fill({ color, alpha: 0.25 });
      } else if (isHovered) {
        g.rect(x, y, w, h).fill({ color, alpha: 0.12 });
      } else {
        g.rect(x, y, w, h).fill({ color, alpha: 0.06 });
      }

      // Border
      const borderWidth = isSelected ? 3 : 1;
      const borderAlpha = isSelected ? 1 : 0.5;
      g.rect(x, y, w, h).stroke({ width: borderWidth, color, alpha: borderAlpha });

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
