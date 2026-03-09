// repairs.ts — pure repair functions for dependency edges

import type { WorldProject } from '@world-forge/schema';
import type { DependencyEdge } from '@world-forge/schema';

/** Kind of repair action. */
export type RepairKind =
  | 'clear-broken-ref'
  | 'relink-asset'
  | 'remove-orphan-asset'
  | 'remove-orphan-pack'
  | 'clear-pack-ref'
  | 'clear-broken-zone-ref'
  | 'clear-broken-dialogue-ref';

/** A repair that can be applied to a project. */
export interface RepairAction {
  kind: RepairKind;
  edge: DependencyEdge;
  label: string;
  apply: (project: WorldProject) => WorldProject;
}

// --- Repair builders ---

function clearAssetRef(edge: DependencyEdge): RepairAction {
  return {
    kind: 'clear-broken-ref',
    edge,
    label: `Clear ${edge.fieldName}`,
    apply: (p) => {
      const field = edge.fieldName;
      const id = edge.sourceId;
      const st = edge.sourceType;

      if (st === 'zone') {
        return {
          ...p,
          zones: p.zones.map((z) =>
            z.id === id ? { ...z, [field]: undefined } : z,
          ),
        };
      }
      if (st === 'entityPlacement') {
        return {
          ...p,
          entityPlacements: p.entityPlacements.map((e) =>
            e.entityId === id ? { ...e, [field]: undefined } : e,
          ),
        };
      }
      if (st === 'itemPlacement') {
        return {
          ...p,
          itemPlacements: p.itemPlacements.map((i) =>
            i.itemId === id ? { ...i, [field]: undefined } : i,
          ),
        };
      }
      if (st === 'landmark') {
        return {
          ...p,
          landmarks: p.landmarks.map((l) =>
            l.id === id ? { ...l, [field]: undefined } : l,
          ),
        };
      }
      return p;
    },
  };
}

function relinkAsset(edge: DependencyEdge, newAssetId: string, newAssetLabel: string): RepairAction {
  return {
    kind: 'relink-asset',
    edge,
    label: `Relink to "${newAssetLabel}"`,
    apply: (p) => {
      const field = edge.fieldName;
      const id = edge.sourceId;
      const st = edge.sourceType;

      if (st === 'zone') {
        return { ...p, zones: p.zones.map((z) => z.id === id ? { ...z, [field]: newAssetId } : z) };
      }
      if (st === 'entityPlacement') {
        return { ...p, entityPlacements: p.entityPlacements.map((e) => e.entityId === id ? { ...e, [field]: newAssetId } : e) };
      }
      if (st === 'itemPlacement') {
        return { ...p, itemPlacements: p.itemPlacements.map((i) => i.itemId === id ? { ...i, [field]: newAssetId } : i) };
      }
      if (st === 'landmark') {
        return { ...p, landmarks: p.landmarks.map((l) => l.id === id ? { ...l, [field]: newAssetId } : l) };
      }
      return p;
    },
  };
}

function removeOrphanAsset(edge: DependencyEdge): RepairAction {
  return {
    kind: 'remove-orphan-asset',
    edge,
    label: `Remove orphan "${edge.sourceLabel || edge.sourceId}"`,
    apply: (p) => ({
      ...p,
      assets: p.assets.filter((a) => a.id !== edge.sourceId),
    }),
  };
}

function removeOrphanPack(edge: DependencyEdge): RepairAction {
  return {
    kind: 'remove-orphan-pack',
    edge,
    label: `Remove orphan pack "${edge.sourceLabel || edge.sourceId}"`,
    apply: (p) => ({
      ...p,
      assetPacks: p.assetPacks.filter((pk) => pk.id !== edge.sourceId),
      assets: p.assets.map((a) => a.packId === edge.sourceId ? { ...a, packId: undefined } : a),
    }),
  };
}

function clearPackRef(edge: DependencyEdge): RepairAction {
  return {
    kind: 'clear-pack-ref',
    edge,
    label: 'Clear packId',
    apply: (p) => ({
      ...p,
      assets: p.assets.map((a) => a.id === edge.sourceId ? { ...a, packId: undefined } : a),
    }),
  };
}

function clearBrokenZoneRef(edge: DependencyEdge): RepairAction {
  return {
    kind: 'clear-broken-zone-ref',
    edge,
    label: `Remove broken zone ref "${edge.targetId}"`,
    apply: (p) => {
      const st = edge.sourceType;
      const targetZoneId = edge.targetId;

      if (st === 'connection') {
        return {
          ...p,
          connections: p.connections.filter((c) =>
            c.fromZoneId !== targetZoneId && c.toZoneId !== targetZoneId,
          ),
        };
      }
      if (st === 'district') {
        return {
          ...p,
          districts: p.districts.map((d) =>
            d.id === edge.sourceId
              ? { ...d, zoneIds: d.zoneIds.filter((zid) => zid !== targetZoneId) }
              : d,
          ),
        };
      }
      if (st === 'spawnPoint') {
        return {
          ...p,
          spawnPoints: p.spawnPoints.filter((sp) => sp.id !== edge.sourceId),
        };
      }
      if (st === 'encounterAnchor') {
        return {
          ...p,
          encounterAnchors: p.encounterAnchors.filter((ea) => ea.id !== edge.sourceId),
        };
      }
      return p;
    },
  };
}

function clearBrokenDialogueRef(edge: DependencyEdge): RepairAction {
  return {
    kind: 'clear-broken-dialogue-ref',
    edge,
    label: 'Clear dialogueId',
    apply: (p) => ({
      ...p,
      entityPlacements: p.entityPlacements.map((e) =>
        e.entityId === edge.sourceId ? { ...e, dialogueId: undefined } : e,
      ),
    }),
  };
}

// --- Public API ---

/**
 * Generate available repair actions for a given dependency edge.
 * Returns empty array for ok/informational edges.
 */
export function repairsForEdge(edge: DependencyEdge, project: WorldProject): RepairAction[] {
  if (edge.status === 'ok' || edge.status === 'informational') return [];

  const repairs: RepairAction[] = [];

  // Asset ref repairs (broken or mismatched)
  if (
    (edge.status === 'broken' || edge.status === 'mismatched') &&
    edge.targetType === 'asset' &&
    (edge.domain === 'zone-asset' || edge.domain === 'entity-asset' || edge.domain === 'item-asset' || edge.domain === 'landmark-asset')
  ) {
    repairs.push(clearAssetRef(edge));

    // Offer relink to same-kind assets
    if (edge.expectedKind) {
      for (const a of project.assets) {
        if (a.kind === edge.expectedKind && a.id !== edge.targetId) {
          repairs.push(relinkAsset(edge, a.id, a.label));
        }
      }
    }
    return repairs;
  }

  // Broken pack ref
  if (edge.status === 'broken' && edge.domain === 'asset-pack') {
    repairs.push(clearPackRef(edge));
    return repairs;
  }

  // Orphaned asset
  if (edge.status === 'orphaned' && edge.domain === 'orphan-asset') {
    repairs.push(removeOrphanAsset(edge));
    return repairs;
  }

  // Orphaned pack
  if (edge.status === 'orphaned' && edge.domain === 'orphan-pack') {
    repairs.push(removeOrphanPack(edge));
    return repairs;
  }

  // Broken zone ref
  if (edge.status === 'broken' && edge.domain === 'zone-ref') {
    repairs.push(clearBrokenZoneRef(edge));
    return repairs;
  }

  // Broken dialogue ref
  if (edge.status === 'broken' && edge.domain === 'dialogue-ref') {
    repairs.push(clearBrokenDialogueRef(edge));
    return repairs;
  }

  return repairs;
}

/** Compose multiple repair actions into a single project transformer. */
export function batchRepair(repairs: RepairAction[]): (project: WorldProject) => WorldProject {
  return (project) => repairs.reduce((p, r) => r.apply(p), project);
}
