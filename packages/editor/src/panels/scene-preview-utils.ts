// scene-preview-utils.ts — pure data assembly for zone scene preview

import type {
  WorldProject, AssetEntry, EntityPlacement, ItemPlacement,
  Landmark, SpawnPoint, AmbientLayer,
} from '@world-forge/schema';

export interface SceneData {
  background: { asset: AssetEntry; missing: false } | { id: string; missing: true } | null;
  tileset: { asset: AssetEntry; missing: false } | { id: string; missing: true } | null;
  entities: Array<{
    placement: EntityPlacement;
    portrait: AssetEntry | null;
    sprite: AssetEntry | null;
    missingPortrait: boolean;
    missingSprite: boolean;
  }>;
  landmarks: Array<{ landmark: Landmark; icon: AssetEntry | null; missingIcon: boolean }>;
  items: Array<{ item: ItemPlacement; icon: AssetEntry | null; missingIcon: boolean }>;
  spawns: SpawnPoint[];
  ambient: AmbientLayer[];
  connections: Array<{ zoneName: string; condition?: string }>;
  light: number;
}

function resolveAsset(
  id: string | undefined,
  assets: AssetEntry[],
): { asset: AssetEntry; missing: false } | { id: string; missing: true } | null {
  if (!id) return null;
  const asset = assets.find((a) => a.id === id);
  if (asset) return { asset, missing: false };
  return { id, missing: true };
}

export function assembleSceneData(zoneId: string, project: WorldProject): SceneData {
  const zone = project.zones.find((z) => z.id === zoneId);
  if (!zone) {
    return {
      background: null, tileset: null,
      entities: [], landmarks: [], items: [],
      spawns: [], ambient: [], connections: [],
      light: 0,
    };
  }

  const background = resolveAsset(zone.backgroundId, project.assets);
  const tileset = resolveAsset(zone.tilesetId, project.assets);

  const entities = project.entityPlacements
    .filter((ep) => ep.zoneId === zoneId)
    .map((placement) => {
      const portraitRes = resolveAsset(placement.portraitId, project.assets);
      const spriteRes = resolveAsset(placement.spriteId, project.assets);
      return {
        placement,
        portrait: portraitRes && !portraitRes.missing ? portraitRes.asset : null,
        sprite: spriteRes && !spriteRes.missing ? spriteRes.asset : null,
        missingPortrait: portraitRes?.missing === true,
        missingSprite: spriteRes?.missing === true,
      };
    });

  const landmarks = project.landmarks
    .filter((lm) => lm.zoneId === zoneId)
    .map((landmark) => {
      const iconRes = resolveAsset(landmark.iconId, project.assets);
      return {
        landmark,
        icon: iconRes && !iconRes.missing ? iconRes.asset : null,
        missingIcon: iconRes?.missing === true,
      };
    });

  const items = project.itemPlacements
    .filter((ip) => ip.zoneId === zoneId)
    .map((item) => {
      const iconRes = resolveAsset(item.iconId, project.assets);
      return {
        item,
        icon: iconRes && !iconRes.missing ? iconRes.asset : null,
        missingIcon: iconRes?.missing === true,
      };
    });

  const spawns = project.spawnPoints.filter((sp) => sp.zoneId === zoneId);
  const ambient = project.ambientLayers.filter((al) => al.zoneIds.includes(zoneId));

  const connections = project.connections
    .filter((c) => c.fromZoneId === zoneId || c.toZoneId === zoneId)
    .map((c) => {
      const otherId = c.fromZoneId === zoneId ? c.toZoneId : c.fromZoneId;
      const otherZone = project.zones.find((z) => z.id === otherId);
      return { zoneName: otherZone?.name ?? otherId, condition: c.condition };
    });

  return {
    background, tileset,
    entities, landmarks, items,
    spawns, ambient, connections,
    light: zone.light,
  };
}
