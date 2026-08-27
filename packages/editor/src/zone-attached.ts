// zone-attached.ts — copy/paste/duplicate/merge/move helpers for collections
// that hang off a zoneId but are not independently selectable.
// F-00a578f0 / F-2864fdb3 / F-e900da8a

import type {
  WorldProject, ItemPlacement, PropPlacement, MarketNode, CraftingStation,
  Building, Hub, Stronghold, PressureHotspot, Zone,
} from '@world-forge/schema';
import { nextId } from './ids.js';

export interface ZoneAttachedClipboard {
  itemPlacements: ItemPlacement[];
  propPlacements: PropPlacement[];
  marketNodes: MarketNode[];
  craftingStations: CraftingStation[];
  buildings: Building[];
  hubs: Hub[];
  strongholds: Stronghold[];
  pressureHotspots: PressureHotspot[];
}

export const EMPTY_ATTACHED: ZoneAttachedClipboard = {
  itemPlacements: [],
  propPlacements: [],
  marketNodes: [],
  craftingStations: [],
  buildings: [],
  hubs: [],
  strongholds: [],
  pressureHotspots: [],
};

function inZone(zoneIds: Set<string>, zoneId: string | undefined): boolean {
  return !!zoneId && zoneIds.has(zoneId);
}

/** Deep-clone every zoneId-bearing object whose zone is in `zoneIds`. */
export function collectZoneAttached(project: WorldProject, zoneIds: Set<string>): ZoneAttachedClipboard {
  return {
    itemPlacements: (project.itemPlacements ?? []).filter((i) => inZone(zoneIds, i.zoneId)).map((i) => structuredClone(i)),
    propPlacements: (project.propPlacements ?? []).filter((p) => inZone(zoneIds, p.zoneId)).map((p) => structuredClone(p)),
    marketNodes: (project.marketNodes ?? []).filter((m) => inZone(zoneIds, m.zoneId)).map((m) => structuredClone(m)),
    craftingStations: (project.craftingStations ?? []).filter((c) => inZone(zoneIds, c.zoneId)).map((c) => structuredClone(c)),
    buildings: (project.buildings ?? []).filter((b) => inZone(zoneIds, b.zoneId)).map((b) => structuredClone(b)),
    hubs: (project.hubs ?? []).filter((h) => inZone(zoneIds, h.zoneId)).map((h) => structuredClone(h)),
    strongholds: (project.strongholds ?? []).filter((s) => inZone(zoneIds, s.zoneId)).map((s) => structuredClone(s)),
    pressureHotspots: (project.pressureHotspots ?? []).filter((h) => inZone(zoneIds, h.zoneId)).map((h) => structuredClone(h)),
  };
}

function shiftXY<T extends { gridX?: number; gridY?: number }>(obj: T, dx: number, dy: number): T {
  const out = { ...obj };
  if (typeof out.gridX === 'number') (out as { gridX: number }).gridX = out.gridX + dx;
  if (typeof out.gridY === 'number') (out as { gridY: number }).gridY = out.gridY + dy;
  return out;
}

/**
 * Mint new ids, remap zoneId (and interior/connected zone refs) through
 * `idMap`, and shift grid coordinates. Used by paste + duplicate.
 */
export function remapZoneAttached(
  attached: Partial<ZoneAttachedClipboard> | undefined,
  idMap: Map<string, string>,
  dx: number,
  dy: number,
): ZoneAttachedClipboard {
  if (!attached) return { ...EMPTY_ATTACHED };
  const z = (zoneId: string) => idMap.get(zoneId) ?? zoneId;
  return {
    itemPlacements: (attached.itemPlacements ?? []).map((i) => shiftXY({
      ...structuredClone(i),
      itemId: nextId('item'),
      zoneId: z(i.zoneId),
    }, dx, dy)),
    propPlacements: (attached.propPlacements ?? []).map((p) => shiftXY({
      ...structuredClone(p),
      id: nextId('prop'),
      zoneId: p.zoneId ? z(p.zoneId) : p.zoneId,
    }, dx, dy)),
    marketNodes: (attached.marketNodes ?? []).map((m) => ({
      ...structuredClone(m),
      id: nextId('market'),
      zoneId: z(m.zoneId),
    })),
    craftingStations: (attached.craftingStations ?? []).map((c) => ({
      ...structuredClone(c),
      id: nextId('craft'),
      zoneId: z(c.zoneId),
    })),
    buildings: (attached.buildings ?? []).map((b) => shiftXY({
      ...structuredClone(b),
      id: nextId('building'),
      zoneId: b.zoneId ? z(b.zoneId) : b.zoneId,
      interiorZoneId: b.interiorZoneId && idMap.has(b.interiorZoneId) ? idMap.get(b.interiorZoneId) : b.interiorZoneId,
    }, dx, dy)),
    hubs: (attached.hubs ?? []).map((h) => ({
      ...structuredClone(h),
      id: nextId('hub'),
      zoneId: z(h.zoneId),
      connectedZoneIds: h.connectedZoneIds.map((cid) => idMap.get(cid) ?? cid),
    })),
    strongholds: (attached.strongholds ?? []).map((s) => ({
      ...structuredClone(s),
      id: nextId('stronghold'),
      zoneId: z(s.zoneId),
    })),
    pressureHotspots: (attached.pressureHotspots ?? []).map((h) => ({
      ...structuredClone(h),
      id: nextId('hotspot'),
      zoneId: z(h.zoneId),
    })),
  };
}

/** Append remapped attached collections onto a project. */
export function applyAttachedToProject(project: WorldProject, attached: ZoneAttachedClipboard): WorldProject {
  return {
    ...project,
    itemPlacements: [...(project.itemPlacements ?? []), ...attached.itemPlacements],
    propPlacements: [...(project.propPlacements ?? []), ...attached.propPlacements],
    marketNodes: [...(project.marketNodes ?? []), ...attached.marketNodes],
    craftingStations: [...(project.craftingStations ?? []), ...attached.craftingStations],
    buildings: [...(project.buildings ?? []), ...attached.buildings],
    hubs: [...(project.hubs ?? []), ...attached.hubs],
    strongholds: [...(project.strongholds ?? []), ...attached.strongholds],
    pressureHotspots: [...(project.pressureHotspots ?? []), ...attached.pressureHotspots],
  };
}

/** Re-point every zoneId in the merge set onto `mergedId`. */
export function reassignAttachedZoneIds(project: WorldProject, fromIds: Set<string>, mergedId: string): Pick<WorldProject,
  'itemPlacements' | 'propPlacements' | 'marketNodes' | 'craftingStations' |
  'buildings' | 'hubs' | 'strongholds' | 'pressureHotspots'
> {
  const mapId = (zid: string | undefined) => (zid && fromIds.has(zid) ? mergedId : zid);
  return {
    itemPlacements: (project.itemPlacements ?? []).map((i) => fromIds.has(i.zoneId) ? { ...i, zoneId: mergedId } : i),
    propPlacements: (project.propPlacements ?? []).map((p) => p.zoneId && fromIds.has(p.zoneId) ? { ...p, zoneId: mergedId } : p),
    marketNodes: (project.marketNodes ?? []).map((m) => fromIds.has(m.zoneId) ? { ...m, zoneId: mergedId } : m),
    craftingStations: (project.craftingStations ?? []).map((c) => fromIds.has(c.zoneId) ? { ...c, zoneId: mergedId } : c),
    buildings: (project.buildings ?? []).map((b) => {
      const zoneId = mapId(b.zoneId);
      const interiorZoneId = b.interiorZoneId && fromIds.has(b.interiorZoneId) ? mergedId : b.interiorZoneId;
      return zoneId !== b.zoneId || interiorZoneId !== b.interiorZoneId ? { ...b, zoneId, interiorZoneId } : b;
    }),
    hubs: (project.hubs ?? []).map((h) => {
      const zoneId = fromIds.has(h.zoneId) ? mergedId : h.zoneId;
      const connectedZoneIds = h.connectedZoneIds.map((cid) => fromIds.has(cid) ? mergedId : cid);
      return zoneId !== h.zoneId || connectedZoneIds.some((c, i) => c !== h.connectedZoneIds[i])
        ? { ...h, zoneId, connectedZoneIds }
        : h;
    }),
    strongholds: (project.strongholds ?? []).map((s) => fromIds.has(s.zoneId) ? { ...s, zoneId: mergedId } : s),
    pressureHotspots: (project.pressureHotspots ?? []).map((h) => fromIds.has(h.zoneId) ? { ...h, zoneId: mergedId } : h),
  };
}

export function zoneContainsCell(z: Zone, gx: number, gy: number): boolean {
  return gx >= z.gridX && gx < z.gridX + z.gridWidth && gy >= z.gridY && gy < z.gridY + z.gridHeight;
}

/**
 * Translate grid-bearing children of selected zones (and any unselected
 * entity/landmark/spawn in those zones) by (dx, dy). Zone rows themselves
 * are translated by the caller.
 */
export function translateAttachedByZones(
  project: WorldProject,
  zoneIds: Set<string>,
  dx: number,
  dy: number,
  alreadyMoved: { entities: Set<string>; landmarks: Set<string>; spawns: Set<string> },
): Pick<WorldProject, 'entityPlacements' | 'landmarks' | 'spawnPoints' | 'itemPlacements' | 'propPlacements' | 'buildings' | 'tileLayers'> {
  const moveChild = (zid: string | undefined, selected: boolean) =>
    selected || (!!zid && zoneIds.has(zid));

  const movedZones = project.zones.filter((z) => zoneIds.has(z.id));

  return {
    entityPlacements: project.entityPlacements.map((e) => {
      if (!moveChild(e.zoneId, alreadyMoved.entities.has(e.entityId))) return e;
      if (e.gridX == null || e.gridY == null) return e;
      return { ...e, gridX: e.gridX + dx, gridY: e.gridY + dy };
    }),
    landmarks: project.landmarks.map((l) =>
      moveChild(l.zoneId, alreadyMoved.landmarks.has(l.id))
        ? { ...l, gridX: l.gridX + dx, gridY: l.gridY + dy }
        : l,
    ),
    spawnPoints: project.spawnPoints.map((s) =>
      moveChild(s.zoneId, alreadyMoved.spawns.has(s.id))
        ? { ...s, gridX: s.gridX + dx, gridY: s.gridY + dy }
        : s,
    ),
    itemPlacements: (project.itemPlacements ?? []).map((i) => {
      if (!zoneIds.has(i.zoneId)) return i;
      return shiftXY(i, dx, dy);
    }),
    propPlacements: (project.propPlacements ?? []).map((p) => {
      if (!p.zoneId || !zoneIds.has(p.zoneId)) return p;
      return { ...p, gridX: p.gridX + dx, gridY: p.gridY + dy };
    }),
    buildings: (project.buildings ?? []).map((b) => {
      if (!b.zoneId || !zoneIds.has(b.zoneId)) return b;
      return { ...b, gridX: b.gridX + dx, gridY: b.gridY + dy };
    }),
    tileLayers: (project.tileLayers ?? []).map((layer) => ({
      ...layer,
      tiles: layer.tiles.map((t) =>
        movedZones.some((z) => zoneContainsCell(z, t.gridX, t.gridY))
          ? { ...t, gridX: t.gridX + dx, gridY: t.gridY + dy }
          : t,
      ),
    })),
  };
}
