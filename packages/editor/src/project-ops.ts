// project-ops.ts — pure WorldProject transformation helpers shared by project-store and atomic Speed Panel macros

import type { EncounterAnchor, WorldProject, Zone } from '@world-forge/schema';
import { tileMatchesSelection } from './hit-testing.js';
import { nextId } from './ids.js';
import type { EncounterPreset, RegionPreset } from './presets/types.js';
import type { SelectionSet } from './store/editor-store.js';
import { reassignAttachedZoneIds } from './zone-attached.js';

/** Remove all objects named in `sel` from `project` without cascading orphans on zones. */
export function removeSelectedFromProject(project: WorldProject, sel: SelectionSet): WorldProject {
  const iSet = new Set(sel.items ?? []);
  const mSet = new Set(sel.markets ?? []);
  const stSet = new Set(sel.stations ?? []);
  const bSet = new Set(sel.buildings ?? []);
  const hSet = new Set(sel.hubs ?? []);
  const shSet = new Set(sel.strongholds ?? []);
  const pSet = new Set(sel.props ?? []);
  const tSet = new Set(sel.tiles ?? []);
  const zSet = new Set(sel.zones);
  const eSet = new Set(sel.entities);
  const lSet = new Set(sel.landmarks);
  const sSet = new Set(sel.spawns);
  const encSet = new Set(sel.encounters);

  return {
    ...project,
    zones: project.zones
      .filter((z) => !zSet.has(z.id))
      .map((z) => ({
        ...z,
        neighbors: z.neighbors.filter((n) => !zSet.has(n)),
        exits: z.exits.filter((e) => !zSet.has(e.targetZoneId)),
      })),
    connections: project.connections.filter((c) => !zSet.has(c.fromZoneId) && !zSet.has(c.toZoneId)),
    districts: project.districts.map((d) => ({ ...d, zoneIds: d.zoneIds.filter((zid) => !zSet.has(zid)) })),
    entityPlacements: project.entityPlacements.filter((e) => !eSet.has(e.entityId)),
    landmarks: project.landmarks.filter((l) => !lSet.has(l.id)),
    spawnPoints: project.spawnPoints.filter((s) => !sSet.has(s.id)),
    encounterAnchors: project.encounterAnchors.filter((e) => !encSet.has(e.id)),
    itemPlacements: (project.itemPlacements ?? []).filter((it) => !iSet.has(it.itemId)),
    marketNodes: (project.marketNodes ?? []).filter((m) => !mSet.has(m.id)),
    craftingStations: (project.craftingStations ?? []).filter((c) => !stSet.has(c.id)),
    buildings: (project.buildings ?? []).filter((b) => !bSet.has(b.id)),
    hubs: (project.hubs ?? []).filter((h) => !hSet.has(h.id)),
    strongholds: (project.strongholds ?? []).filter((s) => !shSet.has(s.id)),
    propPlacements: (project.propPlacements ?? []).filter((pl) => !pSet.has(pl.id)),
    tileLayers: (project.tileLayers ?? []).map((l) => ({
      ...l,
      tiles: l.tiles.filter((t) => !tileMatchesSelection(l.id, t, tSet)),
    })),
  };
}

/** Apply a RegionPreset to `districtId` using `'merge'` or `'overwrite'` mode, returning the updated project. */
export function applyRegionPresetToProject(
  project: WorldProject,
  districtId: string,
  preset: RegionPreset,
  mode: 'merge' | 'overwrite',
): { project: WorldProject; applied: boolean } {
  const district = project.districts.find((d) => d.id === districtId);
  if (!district) {
    return { project, applied: false };
  }

  const isMerge = mode === 'merge';
  const updatedDistrict = { ...district };

  if (isMerge) {
    updatedDistrict.tags = [...new Set([...district.tags, ...preset.regionTags])];
  } else {
    updatedDistrict.tags = [...preset.regionTags];
  }

  if (!isMerge || !district.controllingFaction) {
    updatedDistrict.controllingFaction = preset.controllingFaction;
  }

  const dm = district.baseMetrics;
  updatedDistrict.baseMetrics = {
    commerce: (!isMerge || dm.commerce === 0) && preset.baseMetrics.commerce != null ? preset.baseMetrics.commerce : dm.commerce,
    morale: (!isMerge || dm.morale === 0) && preset.baseMetrics.morale != null ? preset.baseMetrics.morale : dm.morale,
    safety: (!isMerge || dm.safety === 0) && preset.baseMetrics.safety != null ? preset.baseMetrics.safety : dm.safety,
    stability: (!isMerge || dm.stability === 0) && preset.baseMetrics.stability != null ? preset.baseMetrics.stability : dm.stability,
  };

  if (preset.economyProfile) {
    const existing = district.economyProfile;
    if (!isMerge) {
      updatedDistrict.economyProfile = {
        supplyCategories: preset.economyProfile.supplyCategories ?? existing.supplyCategories,
        scarcityDefaults: preset.economyProfile.scarcityDefaults ?? existing.scarcityDefaults,
      };
    } else {
      updatedDistrict.economyProfile = {
        supplyCategories: existing.supplyCategories.length === 0 && preset.economyProfile.supplyCategories
          ? preset.economyProfile.supplyCategories
          : existing.supplyCategories,
        scarcityDefaults: Object.keys(existing.scarcityDefaults).length === 0 && preset.economyProfile.scarcityDefaults
          ? preset.economyProfile.scarcityDefaults
          : existing.scarcityDefaults,
      };
    }
  }

  const districts = project.districts.map((d) => (d.id === districtId ? updatedDistrict : d));

  let factionPresences = [...project.factionPresences];
  for (const fp of preset.factionPresences) {
    const exists = factionPresences.some(
      (f) => f.factionId === fp.factionId && f.districtIds.includes(districtId),
    );
    if (!exists) {
      const existing = factionPresences.find((f) => f.factionId === fp.factionId);
      if (existing) {
        factionPresences = factionPresences.map((f) =>
          f.factionId === fp.factionId
            ? { ...f, districtIds: [...f.districtIds, districtId] }
            : f,
        );
      } else {
        factionPresences.push({
          factionId: fp.factionId,
          districtIds: [districtId],
          influence: fp.influence,
          alertLevel: fp.alertLevel,
          patrolRoutes: fp.patrolRoutes,
        });
      }
    }
  }

  const pressureHotspots = [...project.pressureHotspots];
  for (const ph of preset.pressureHotspots) {
    const targetZone = district.zoneIds.find(
      (zid) => !pressureHotspots.some((h) => h.zoneId === zid && h.pressureType === ph.pressureType),
    );
    if (targetZone) {
      pressureHotspots.push({
        id: nextId('hotspot'),
        zoneId: targetZone,
        pressureType: ph.pressureType,
        baseProbability: ph.baseProbability,
        tags: [...ph.tags],
      });
    }
  }

  return {
    project: { ...project, districts, factionPresences, pressureHotspots },
    applied: true,
  };
}

/** Build and append an encounter anchor from an EncounterPreset inside `zoneId`. */
export function createEncounterFromPresetInProject(
  project: WorldProject,
  zoneId: string,
  preset: EncounterPreset,
  id = nextId('enc'),
): { project: WorldProject; id: string } {
  const anchor: EncounterAnchor = {
    id,
    zoneId,
    encounterType: preset.encounterType,
    enemyIds: [...preset.enemyIds],
    probability: preset.probability,
    cooldownTurns: preset.cooldownTurns,
    tags: [...preset.encounterTags],
  };
  return {
    id,
    project: {
      ...project,
      encounterAnchors: [...project.encounterAnchors, anchor],
    },
  };
}

/** Merge two or more zones inside `project` into one bounding-box zone, returning the new project and ID. */
export function mergeZonesInProject(
  project: WorldProject,
  zoneIds: readonly string[],
): { project: WorldProject; mergedId: string | null } {
  if (zoneIds.length < 2) return { project, mergedId: null };
  const zones = project.zones.filter((z) => zoneIds.includes(z.id));
  if (zones.length < 2) return { project, mergedId: null };

  const mergedId = nextId('zone-merged');
  const idSet = new Set(zoneIds);

  const minX = Math.min(...zones.map((z) => z.gridX));
  const minY = Math.min(...zones.map((z) => z.gridY));
  const maxX = Math.max(...zones.map((z) => z.gridX + z.gridWidth));
  const maxY = Math.max(...zones.map((z) => z.gridY + z.gridHeight));

  const allTags = [...new Set(zones.flatMap((z) => z.tags))];
  const allHazards = [...new Set(zones.flatMap((z) => z.hazards))];
  const allInteractables = zones.flatMap((z) => z.interactables);
  const externalNeighbors = [...new Set(zones.flatMap((z) => z.neighbors).filter((n) => !idSet.has(n)))];

  const mergedZone: Zone = {
    id: mergedId,
    name: `Merged (${zones.map((z) => z.name).join(' + ')})`,
    description: zones.map((z) => z.description).filter(Boolean).join(' '),
    tags: allTags,
    gridX: minX,
    gridY: minY,
    gridWidth: maxX - minX,
    gridHeight: maxY - minY,
    neighbors: externalNeighbors,
    exits: zones.flatMap((z) => z.exits.filter((e) => !idSet.has(e.targetZoneId))),
    light: Math.round(zones.reduce((s, z) => s + z.light, 0) / zones.length),
    noise: Math.round(zones.reduce((s, z) => s + z.noise, 0) / zones.length),
    hazards: allHazards,
    interactables: allInteractables,
    parentDistrictId: zones.find((z) => z.parentDistrictId)?.parentDistrictId,
  };

  const newZones = [...project.zones.filter((z) => !idSet.has(z.id)), mergedZone];
  const entityPlacements = project.entityPlacements.map((e) =>
    idSet.has(e.zoneId) ? { ...e, zoneId: mergedId } : e);
  const landmarks = project.landmarks.map((l) =>
    idSet.has(l.zoneId) ? { ...l, zoneId: mergedId } : l);
  const spawnPoints = project.spawnPoints.map((s) =>
    idSet.has(s.zoneId) ? { ...s, zoneId: mergedId } : s);
  const encounterAnchors = project.encounterAnchors.map((e) =>
    idSet.has(e.zoneId) ? { ...e, zoneId: mergedId } : e);

  const connections = project.connections
    .filter((c) => !(idSet.has(c.fromZoneId) && idSet.has(c.toZoneId)))
    .map((c) => ({
      ...c,
      fromZoneId: idSet.has(c.fromZoneId) ? mergedId : c.fromZoneId,
      toZoneId: idSet.has(c.toZoneId) ? mergedId : c.toZoneId,
    }))
    .filter((c, i, arr) => arr.findIndex((x) => x.fromZoneId === c.fromZoneId && x.toZoneId === c.toZoneId) === i);

  const districts = project.districts.map((d) => {
    const hasOld = d.zoneIds.some((zid) => idSet.has(zid));
    if (!hasOld) return d;
    const filtered = d.zoneIds.filter((zid) => !idSet.has(zid));
    return { ...d, zoneIds: [...filtered, mergedId] };
  });

  const attached = reassignAttachedZoneIds(project, idSet, mergedId);

  return {
    mergedId,
    project: {
      ...project,
      zones: newZones,
      entityPlacements,
      landmarks,
      spawnPoints,
      encounterAnchors,
      connections,
      districts,
      ...attached,
    },
  };
}
