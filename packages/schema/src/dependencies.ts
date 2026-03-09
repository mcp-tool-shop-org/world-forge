// dependencies.ts — project dependency graph scanner

import type { WorldProject } from './project.js';

/** Status of a dependency edge. */
export type DepStatus = 'ok' | 'broken' | 'mismatched' | 'orphaned' | 'informational';

/** Domain classification for a dependency edge. */
export type DepDomain =
  | 'zone-asset'
  | 'entity-asset'
  | 'item-asset'
  | 'landmark-asset'
  | 'asset-pack'
  | 'zone-ref'
  | 'dialogue-ref'
  | 'orphan-asset'
  | 'orphan-pack'
  | 'kit-provenance';

/** A single edge in the project's dependency graph. */
export interface DependencyEdge {
  domain: DepDomain;
  status: DepStatus;
  sourceType: string;
  sourceId: string;
  sourceLabel?: string;
  fieldName: string;
  targetType: string;
  targetId: string;
  expectedKind?: string;
  actualKind?: string;
  message: string;
}

/** Aggregated counts by status. */
export interface DependencySummary {
  total: number;
  ok: number;
  broken: number;
  mismatched: number;
  orphaned: number;
  informational: number;
}

/** Full dependency scan result. */
export interface DependencyReport {
  edges: DependencyEdge[];
  summary: DependencySummary;
  byDomain: Record<string, DependencySummary>;
}

function emptySummary(): DependencySummary {
  return { total: 0, ok: 0, broken: 0, mismatched: 0, orphaned: 0, informational: 0 };
}

function addToSummary(summary: DependencySummary, status: DepStatus): void {
  summary.total++;
  summary[status]++;
}

/**
 * Scan the full reference graph of a WorldProject and classify every edge.
 *
 * Asset refs are checked for existence and kind match.
 * Structural refs (zones, dialogues, packs) are checked for existence.
 * Orphan detection finds assets/packs not referenced by anything.
 */
export function scanDependencies(project: WorldProject): DependencyReport {
  const edges: DependencyEdge[] = [];

  // Build lookup maps
  const assetMap = new Map<string, { kind: string; label: string }>();
  for (const a of project.assets) {
    assetMap.set(a.id, { kind: a.kind, label: a.label });
  }

  const packIds = new Set(project.assetPacks.map((p) => p.id));
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const dialogueIds = new Set(project.dialogues.map((d) => d.id));

  // Helper: check an asset ref field
  function checkAssetRef(
    domain: DepDomain,
    sourceType: string,
    sourceId: string,
    sourceLabel: string | undefined,
    fieldName: string,
    refId: string | undefined,
    expectedKind: string,
  ) {
    if (!refId) return;
    const asset = assetMap.get(refId);
    if (!asset) {
      edges.push({
        domain, status: 'broken', sourceType, sourceId, sourceLabel, fieldName,
        targetType: 'asset', targetId: refId, expectedKind,
        message: `${sourceType} "${sourceLabel || sourceId}" ${fieldName} references nonexistent asset "${refId}"`,
      });
    } else if (asset.kind !== expectedKind) {
      edges.push({
        domain, status: 'mismatched', sourceType, sourceId, sourceLabel, fieldName,
        targetType: 'asset', targetId: refId, expectedKind, actualKind: asset.kind,
        message: `${sourceType} "${sourceLabel || sourceId}" ${fieldName} references asset "${refId}" of kind "${asset.kind}", expected "${expectedKind}"`,
      });
    } else {
      edges.push({
        domain, status: 'ok', sourceType, sourceId, sourceLabel, fieldName,
        targetType: 'asset', targetId: refId, expectedKind, actualKind: asset.kind,
        message: `${sourceType} "${sourceLabel || sourceId}" ${fieldName} → asset "${asset.label}"`,
      });
    }
  }

  // --- Zone asset refs ---
  for (const z of project.zones) {
    checkAssetRef('zone-asset', 'zone', z.id, z.name, 'backgroundId', z.backgroundId, 'background');
    checkAssetRef('zone-asset', 'zone', z.id, z.name, 'tilesetId', z.tilesetId, 'tileset');
  }

  // --- Entity asset refs ---
  for (const ep of project.entityPlacements) {
    checkAssetRef('entity-asset', 'entityPlacement', ep.entityId, ep.name, 'portraitId', ep.portraitId, 'portrait');
    checkAssetRef('entity-asset', 'entityPlacement', ep.entityId, ep.name, 'spriteId', ep.spriteId, 'sprite');
  }

  // --- Item asset refs ---
  for (const ip of project.itemPlacements) {
    checkAssetRef('item-asset', 'itemPlacement', ip.itemId, ip.name, 'iconId', ip.iconId, 'icon');
  }

  // --- Landmark asset refs ---
  for (const lm of project.landmarks) {
    checkAssetRef('landmark-asset', 'landmark', lm.id, lm.name, 'iconId', lm.iconId, 'icon');
  }

  // --- Asset → pack refs ---
  for (const a of project.assets) {
    if (!a.packId) continue;
    if (!packIds.has(a.packId)) {
      edges.push({
        domain: 'asset-pack', status: 'broken',
        sourceType: 'asset', sourceId: a.id, sourceLabel: a.label,
        fieldName: 'packId', targetType: 'assetPack', targetId: a.packId,
        message: `Asset "${a.label}" packId references nonexistent pack "${a.packId}"`,
      });
    } else {
      edges.push({
        domain: 'asset-pack', status: 'ok',
        sourceType: 'asset', sourceId: a.id, sourceLabel: a.label,
        fieldName: 'packId', targetType: 'assetPack', targetId: a.packId,
        message: `Asset "${a.label}" → pack "${a.packId}"`,
      });
    }
  }

  // --- Connection zone refs ---
  for (const c of project.connections) {
    const label = c.label || `${c.fromZoneId} → ${c.toZoneId}`;
    if (!zoneIds.has(c.fromZoneId)) {
      edges.push({
        domain: 'zone-ref', status: 'broken',
        sourceType: 'connection', sourceId: `${c.fromZoneId}-${c.toZoneId}`, sourceLabel: label,
        fieldName: 'fromZoneId', targetType: 'zone', targetId: c.fromZoneId,
        message: `Connection "${label}" fromZoneId references nonexistent zone "${c.fromZoneId}"`,
      });
    }
    if (!zoneIds.has(c.toZoneId)) {
      edges.push({
        domain: 'zone-ref', status: 'broken',
        sourceType: 'connection', sourceId: `${c.fromZoneId}-${c.toZoneId}`, sourceLabel: label,
        fieldName: 'toZoneId', targetType: 'zone', targetId: c.toZoneId,
        message: `Connection "${label}" toZoneId references nonexistent zone "${c.toZoneId}"`,
      });
    }
  }

  // --- District zone refs ---
  for (const d of project.districts) {
    for (const zid of d.zoneIds) {
      if (!zoneIds.has(zid)) {
        edges.push({
          domain: 'zone-ref', status: 'broken',
          sourceType: 'district', sourceId: d.id, sourceLabel: d.name,
          fieldName: 'zoneIds', targetType: 'zone', targetId: zid,
          message: `District "${d.name}" references nonexistent zone "${zid}"`,
        });
      }
    }
  }

  // --- Spawn zone refs ---
  for (const sp of project.spawnPoints) {
    if (!zoneIds.has(sp.zoneId)) {
      edges.push({
        domain: 'zone-ref', status: 'broken',
        sourceType: 'spawnPoint', sourceId: sp.id,
        fieldName: 'zoneId', targetType: 'zone', targetId: sp.zoneId,
        message: `Spawn point "${sp.id}" in nonexistent zone "${sp.zoneId}"`,
      });
    }
  }

  // --- Encounter zone + dialogue refs ---
  for (const ea of project.encounterAnchors) {
    if (!zoneIds.has(ea.zoneId)) {
      edges.push({
        domain: 'zone-ref', status: 'broken',
        sourceType: 'encounterAnchor', sourceId: ea.id,
        fieldName: 'zoneId', targetType: 'zone', targetId: ea.zoneId,
        message: `Encounter anchor "${ea.id}" in nonexistent zone "${ea.zoneId}"`,
      });
    }
  }

  // --- Entity dialogue refs ---
  for (const ep of project.entityPlacements) {
    if (!ep.dialogueId) continue;
    if (!dialogueIds.has(ep.dialogueId)) {
      edges.push({
        domain: 'dialogue-ref', status: 'broken',
        sourceType: 'entityPlacement', sourceId: ep.entityId, sourceLabel: ep.name,
        fieldName: 'dialogueId', targetType: 'dialogue', targetId: ep.dialogueId,
        message: `Entity "${ep.name || ep.entityId}" references nonexistent dialogue "${ep.dialogueId}"`,
      });
    }
  }

  // --- Orphan asset detection ---
  const referencedAssetIds = new Set<string>();
  for (const z of project.zones) {
    if (z.backgroundId) referencedAssetIds.add(z.backgroundId);
    if (z.tilesetId) referencedAssetIds.add(z.tilesetId);
  }
  for (const ep of project.entityPlacements) {
    if (ep.portraitId) referencedAssetIds.add(ep.portraitId);
    if (ep.spriteId) referencedAssetIds.add(ep.spriteId);
  }
  for (const ip of project.itemPlacements) {
    if (ip.iconId) referencedAssetIds.add(ip.iconId);
  }
  for (const lm of project.landmarks) {
    if (lm.iconId) referencedAssetIds.add(lm.iconId);
  }
  for (const a of project.assets) {
    if (!referencedAssetIds.has(a.id)) {
      edges.push({
        domain: 'orphan-asset', status: 'orphaned',
        sourceType: 'asset', sourceId: a.id, sourceLabel: a.label,
        fieldName: '', targetType: '', targetId: '',
        message: `Asset "${a.label}" (${a.kind}) is not referenced by any zone, entity, item, or landmark`,
      });
    }
  }

  // --- Orphan pack detection ---
  const usedPackIds = new Set<string>();
  for (const a of project.assets) {
    if (a.packId) usedPackIds.add(a.packId);
  }
  for (const pack of project.assetPacks) {
    if (!usedPackIds.has(pack.id)) {
      edges.push({
        domain: 'orphan-pack', status: 'orphaned',
        sourceType: 'assetPack', sourceId: pack.id, sourceLabel: pack.label,
        fieldName: '', targetType: '', targetId: '',
        message: `Asset pack "${pack.label}" has no assets assigned to it`,
      });
    }
  }

  // Build summary + byDomain
  const summary = emptySummary();
  const byDomain: Record<string, DependencySummary> = {};

  for (const edge of edges) {
    addToSummary(summary, edge.status);
    if (!byDomain[edge.domain]) byDomain[edge.domain] = emptySummary();
    addToSummary(byDomain[edge.domain], edge.status);
  }

  return { edges, summary, byDomain };
}
