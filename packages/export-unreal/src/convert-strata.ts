/**
 * convert-strata.ts — WorldProject vertical strata → Unreal pack data.
 *
 * Mirrors Godot convert-strata.ts: discrete vertical layers export as
 * UnrealStratum entries (Id, Order, ZBand, ZRangeCm, VisibleStrata) plus
 * UnrealStratumLink connectors. Zones whose stratumId resolves get
 * StratumId + ZBand stamped onto UnrealZoneDataAsset (see convert-zones.ts).
 *
 * Link positions are the midpoint of their anchor zones when both resolve,
 * else the single surviving anchor zone's center. An authored fromZoneId /
 * toZoneId that does not resolve drops the link (same contract as
 * convertTransitions targetZoneId). Origin fallback is only used when both
 * zone ids were omitted, and then the link is marked approximated.
 */

import type { WorldProject } from '@world-forge/schema';
import { formatDroppedIdentities, type FidelityEntry } from './fidelity.js';
import {
  elevationToZ,
  gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
  type UnrealVec3,
} from './coordinate-transform.js';

/** z-band units between adjacent strata. order=-1 → -100, order=+1 → +100. */
export const STRATUM_Z_BAND = 100;

export interface UnrealStratum {
  Id: string;
  Name: string;
  Order: number;
  /** order * STRATUM_Z_BAND — the absolute z band zones in this stratum sort into. */
  ZBand: number;
  ZRangeCm?: { FloorCm: number; CeilingCm: number };
  VisibleStrata: string[];
  Tags: string[];
}

export interface UnrealStratumLink {
  Id: string;
  FromStratumId: string;
  ToStratumId: string;
  FromZoneId?: string;
  ToZoneId?: string;
  Bidirectional: boolean;
  LinkType: string;
  LocationCm: UnrealVec3;
}

export interface UnrealStrataManifest {
  Strata: UnrealStratum[];
  Links: UnrealStratumLink[];
}

export interface ConvertStrataResult {
  manifest: UnrealStrataManifest;
  /** zoneId → its stratum (id + z band) for StratumId + ZBand on UnrealZoneDataAsset. */
  zoneStrata: Record<string, { stratumId: string; zBand: number }>;
  fidelity: FidelityEntry[];
}

export function convertStrata(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertStrataResult {
  const fidelity: FidelityEntry[] = [];
  const strataIn = project.strata ?? [];
  const linksIn = project.stratumLinks ?? [];

  const zoneCenter = new Map<string, { gridX: number; gridY: number }>();
  for (const z of project.zones ?? []) {
    zoneCenter.set(z.id, {
      gridX: z.gridX + z.gridWidth / 2,
      gridY: z.gridY + z.gridHeight / 2,
    });
  }

  const bandById = new Map<string, number>();
  const strata: UnrealStratum[] = strataIn.map((s) => {
    const zBand = s.order * STRATUM_Z_BAND;
    bandById.set(s.id, zBand);
    const entry: UnrealStratum = {
      Id: s.id,
      Name: s.name,
      Order: s.order,
      ZBand: zBand,
      VisibleStrata: (s.visibleStrata ?? []).slice(),
      Tags: Array.isArray(s.tags) ? s.tags.slice() : [],
    };
    if (s.zRange) {
      entry.ZRangeCm = {
        FloorCm: elevationToZ(s.zRange.floor),
        CeilingCm: elevationToZ(s.zRange.ceiling),
      };
    }
    return entry;
  });

  const links: UnrealStratumLink[] = [];
  for (const l of linksIn) {
    const fromAuthored = typeof l.fromZoneId === 'string' && l.fromZoneId.length > 0;
    const toAuthored = typeof l.toZoneId === 'string' && l.toZoneId.length > 0;
    const from = fromAuthored ? zoneCenter.get(l.fromZoneId!) : undefined;
    const to = toAuthored ? zoneCenter.get(l.toZoneId!) : undefined;

    if (fromAuthored && from === undefined) {
      fidelity.push({
        level: 'dropped',
        domain: 'structures',
        severity: 'error',
        entityId: l.id,
        fieldPath: `stratumLinks.${l.id}.fromZoneId`,
        message: `Stratum link "${l.id}" dropped — fromZoneId "${l.fromZoneId}" not found.`,
        reason: 'Orphan fromZoneId reference.',
      });
      continue;
    }
    if (toAuthored && to === undefined) {
      fidelity.push({
        level: 'dropped',
        domain: 'structures',
        severity: 'error',
        entityId: l.id,
        fieldPath: `stratumLinks.${l.id}.toZoneId`,
        message: `Stratum link "${l.id}" dropped — toZoneId "${l.toZoneId}" not found.`,
        reason: 'Orphan toZoneId reference.',
      });
      continue;
    }

    let location: UnrealVec3;
    if (from && to) {
      location = gridToUnrealAxis(
        (from.gridX + to.gridX) / 2,
        (from.gridY + to.gridY) / 2,
        tileSizeCm,
      );
    } else if (from) {
      location = gridToUnrealAxis(from.gridX, from.gridY, tileSizeCm);
    } else if (to) {
      location = gridToUnrealAxis(to.gridX, to.gridY, tileSizeCm);
    } else {
      location = { X: 0, Y: 0, Z: 0 };
      fidelity.push({
        level: 'approximated',
        domain: 'structures',
        severity: 'warning',
        entityId: l.id,
        fieldPath: `stratumLinks.${l.id}`,
        message: `Stratum link "${l.id}" has no fromZoneId/toZoneId — placed at world origin (0,0,0).`,
        reason: 'No anchor zones authored; origin is a last-resort placement so a stairwell is not silently dropped.',
      });
    }

    links.push({
      Id: l.id,
      FromStratumId: l.fromStratumId,
      ToStratumId: l.toStratumId,
      FromZoneId: l.fromZoneId,
      ToZoneId: l.toZoneId,
      Bidirectional: l.bidirectional,
      LinkType: l.linkType,
      LocationCm: location,
    });
  }

  const zoneStrata: Record<string, { stratumId: string; zBand: number }> = {};
  const missingStratumIds: string[] = [];
  for (const z of project.zones ?? []) {
    if (z.stratumId === undefined) continue;
    const band = bandById.get(z.stratumId);
    if (band === undefined) {
      missingStratumIds.push(`zone "${z.id}" (stratumId "${z.stratumId}")`);
      continue;
    }
    zoneStrata[z.id] = { stratumId: z.stratumId, zBand: band };
  }

  if (missingStratumIds.length > 0) {
    fidelity.push({
      level: 'dropped',
      domain: 'structures',
      severity: 'warning',
      fieldPath: 'zones.stratumId',
      message: `${missingStratumIds.length} zone(s) reference a stratumId with no matching stratum — not banded: ${formatDroppedIdentities(missingStratumIds)}.`,
      reason: 'A zone could not be assigned to a vertical layer because its stratum was not found.',
    });
  }
  if (strata.length + links.length > 0) {
    fidelity.push({
      level: 'approximated',
      domain: 'structures',
      severity: 'info',
      fieldPath: 'strata/stratumLinks',
      message: `${strata.length} stratum/strata + ${links.length} link(s) exported; zones in a stratum get a ZBand (order × ${STRATUM_Z_BAND}) so layers sort correctly.`,
      reason: 'Strata are a discrete vertical layering; the UE5 loader drives per-level visibility/navigation from the pack, while the z band gives correct cross-level draw/PVS order at load.',
    });
  }

  return { manifest: { Strata: strata, Links: links }, zoneStrata, fidelity };
}
