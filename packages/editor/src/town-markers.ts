// town-markers.ts — world-space positions for zone-attached town structures.
// Markets / stations / hubs / strongholds have no independent grid coords, so
// they render at the parent zone center with a per-kind offset. Buildings use
// their authored footprint.

import type { WorldProject, Zone } from '@world-forge/schema';

export type TownMarkerType = 'market' | 'station' | 'building' | 'hub' | 'stronghold';

export interface TownMarker {
  type: TownMarkerType;
  id: string;
  /** World-pixel origin (footprint top-left for buildings, glyph center otherwise). */
  x: number;
  y: number;
  /** Building footprint in world pixels. Absent for point markers. */
  w?: number;
  h?: number;
  label: string;
  color: string;
}

export const TOWN_MARKER_COLORS: Record<TownMarkerType, string> = {
  market: '#f0c040',
  station: '#c070ff',
  building: '#c47a3a',
  hub: '#40c0e0',
  stronghold: '#e05050',
};

const KIND_OFFSET: Record<Exclude<TownMarkerType, 'building'>, { dx: number; dy: number }> = {
  market: { dx: -10, dy: -10 },
  station: { dx: 10, dy: -10 },
  hub: { dx: -10, dy: 10 },
  stronghold: { dx: 10, dy: 10 },
};

function zoneCenter(zone: Zone, tileSize: number): { x: number; y: number } {
  return {
    x: (zone.gridX + zone.gridWidth / 2) * tileSize,
    y: (zone.gridY + zone.gridHeight / 2) * tileSize,
  };
}

function spreadX(index: number, count: number): number {
  return (index - (count - 1) / 2) * 8;
}

/**
 * Collect every town marker that has a resolvable position. Orphaned
 * zone-attached nodes (missing parent zone) are skipped.
 */
export function collectTownMarkers(project: WorldProject, tileSize: number): TownMarker[] {
  const zoneMap = new Map(project.zones.map((z) => [z.id, z]));
  const out: TownMarker[] = [];

  const markets = project.marketNodes ?? [];
  for (const m of markets) {
    const zone = zoneMap.get(m.zoneId);
    if (!zone) continue;
    const { x, y } = zoneCenter(zone, tileSize);
    const same = markets.filter((o) => o.zoneId === m.zoneId);
    const off = KIND_OFFSET.market;
    out.push({
      type: 'market',
      id: m.id,
      x: x + off.dx + spreadX(same.indexOf(m), same.length),
      y: y + off.dy,
      label: 'market',
      color: TOWN_MARKER_COLORS.market,
    });
  }

  const stations = project.craftingStations ?? [];
  for (const s of stations) {
    const zone = zoneMap.get(s.zoneId);
    if (!zone) continue;
    const { x, y } = zoneCenter(zone, tileSize);
    const same = stations.filter((o) => o.zoneId === s.zoneId);
    const off = KIND_OFFSET.station;
    out.push({
      type: 'station',
      id: s.id,
      x: x + off.dx + spreadX(same.indexOf(s), same.length),
      y: y + off.dy,
      label: s.stationType || 'station',
      color: TOWN_MARKER_COLORS.station,
    });
  }

  const hubs = project.hubs ?? [];
  for (const h of hubs) {
    const zone = zoneMap.get(h.zoneId);
    if (!zone) continue;
    const { x, y } = zoneCenter(zone, tileSize);
    const same = hubs.filter((o) => o.zoneId === h.zoneId);
    const off = KIND_OFFSET.hub;
    out.push({
      type: 'hub',
      id: h.id,
      x: x + off.dx + spreadX(same.indexOf(h), same.length),
      y: y + off.dy,
      label: h.name || h.hubType || 'hub',
      color: TOWN_MARKER_COLORS.hub,
    });
  }

  const strongholds = project.strongholds ?? [];
  for (const sh of strongholds) {
    const zone = zoneMap.get(sh.zoneId);
    if (!zone) continue;
    const { x, y } = zoneCenter(zone, tileSize);
    const same = strongholds.filter((o) => o.zoneId === sh.zoneId);
    const off = KIND_OFFSET.stronghold;
    out.push({
      type: 'stronghold',
      id: sh.id,
      x: x + off.dx + spreadX(same.indexOf(sh), same.length),
      y: y + off.dy,
      label: sh.name || 'stronghold',
      color: TOWN_MARKER_COLORS.stronghold,
    });
  }

  for (const b of project.buildings ?? []) {
    out.push({
      type: 'building',
      id: b.id,
      x: b.gridX * tileSize,
      y: b.gridY * tileSize,
      w: Math.max(1, b.width) * tileSize,
      h: Math.max(1, b.height) * tileSize,
      label: b.name || b.buildingType || 'building',
      color: TOWN_MARKER_COLORS.building,
    });
  }

  return out;
}
