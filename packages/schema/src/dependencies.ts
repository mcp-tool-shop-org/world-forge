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
  fieldName?: string;
  targetType?: string;
  targetId?: string;
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
 * Collect all asset IDs referenced by zones, entities, items, and landmarks.
 *
 * MAINTENANCE NOTE: When adding new entity types with asset refs, add extraction
 * here. This is the single source of truth for "which assets are in use" —
 * both orphan detection and future cleanup tools depend on it.
 */
function collectReferencedAssetIds(project: WorldProject): Set<string> {
  const ids = new Set<string>();
  for (const z of project.zones) {
    if (z.backgroundId) ids.add(z.backgroundId);
    if (z.tilesetId) ids.add(z.tilesetId);
    // 2.5D (v4.2.0): skyline + parallax assetRefs also count as valid references.
    // Mirrors the orphan check in validate.ts — without this, authored 2.5D assets
    // get false-flagged as orphans even though parallax/skyline layers use them.
    if (z.skylineRef) ids.add(z.skylineRef);
    if (z.parallaxLayers) {
      for (const layer of z.parallaxLayers) {
        if (layer.assetRef) ids.add(layer.assetRef);
      }
    }
  }
  for (const ep of project.entityPlacements) {
    if (ep.portraitId) ids.add(ep.portraitId);
    if (ep.spriteId) ids.add(ep.spriteId);
  }
  for (const ip of project.itemPlacements) {
    if (ip.iconId) ids.add(ip.iconId);
  }
  for (const lm of project.landmarks) {
    if (lm.iconId) ids.add(lm.iconId);
  }
  return ids;
}

/**
 * Pre-built lookup maps that callers can pass to {@link scanDependencies} to
 * skip the per-call rebuild cost. All maps are optional; any omitted ones are
 * rebuilt from the project. Callers that invoke multiple validators against
 * the same project (e.g. buildReviewSnapshot → validate + advisory + scan)
 * can build these once and share.
 *
 * SCH-B-006 (v4.4): Editor live-refresh was rebuilding the same four lookups
 * on every keystroke via buildReviewSnapshot. Sharing pre-built maps cuts
 * allocation churn without invalidating callers that don't opt in.
 */
export interface ScanDependenciesLookups {
  /** id → { kind, label } for each asset in project.assets. */
  assetMap?: Map<string, { kind: string; label: string }>;
  /** Set of asset-pack ids. */
  packIds?: Set<string>;
  /** Set of zone ids. */
  zoneIds?: Set<string>;
  /** Set of dialogue ids. */
  dialogueIds?: Set<string>;
}

/**
 * Scan the full reference graph of a WorldProject and classify every edge.
 *
 * Asset refs are checked for existence and kind match.
 * Structural refs (zones, dialogues, packs) are checked for existence.
 * Orphan detection finds assets/packs not referenced by anything.
 *
 * NOTE: For verbose/debug output, callers can inspect the returned edges array
 * directly — each edge includes domain, status, and a human-readable message.
 * A future enhancement could add an optional `verbose` flag to emit additional
 * diagnostic detail (e.g. timing, ref counts per domain).
 *
 * @param prebuilt optional pre-built lookup maps to reuse. When omitted they
 *                 are rebuilt from project — matches the legacy behaviour.
 */
export function scanDependencies(
  project: WorldProject,
  prebuilt?: ScanDependenciesLookups,
): DependencyReport {
  const edges: DependencyEdge[] = [];

  // Build lookup maps (or reuse prebuilt ones from the caller).
  // SCH-B-006: callers like buildReviewSnapshot that also run validateProject
  // and advisoryValidation against the same project can share these to avoid
  // rebuilding four maps per validator pass.
  const assetMap: Map<string, { kind: string; label: string }> =
    prebuilt?.assetMap ??
    new Map((project.assets ?? []).map((a) => [a.id, { kind: a.kind, label: a.label }]));

  const packIds = prebuilt?.packIds ?? new Set((project.assetPacks ?? []).map((p) => p.id));
  const zoneIds = prebuilt?.zoneIds ?? new Set(project.zones.map((z) => z.id));
  const dialogueIds = prebuilt?.dialogueIds ?? new Set(project.dialogues.map((d) => d.id));

  // Helper: check an asset ref field.
  // When refId is null/undefined, the ref is optional and unset — this is not an error.
  // Optional asset refs include: zone.backgroundId, zone.tilesetId, entity.portraitId,
  // entity.spriteId, item.iconId, landmark.iconId. They become required only when
  // the project is ready for visual export.
  function checkAssetRef(
    domain: DepDomain,
    sourceType: string,
    sourceId: string,
    sourceLabel: string | undefined,
    fieldName: string,
    refId: string | undefined,
    expectedKind: string,
  ) {
    // Optional ref — null/undefined means "not yet assigned", not broken
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
  for (const a of project.assets ?? []) {
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
  // MAINTENANCE NOTE: If a new entity type gains asset refs (e.g. encounterAnchors
  // get a spriteId), add it to collectReferencedAssetIds() below. Otherwise those
  // refs won't prevent orphan false-positives.
  const referencedAssetIds = collectReferencedAssetIds(project);
  for (const a of project.assets ?? []) {
    if (!referencedAssetIds.has(a.id)) {
      edges.push({
        domain: 'orphan-asset', status: 'orphaned',
        sourceType: 'asset', sourceId: a.id, sourceLabel: a.label,
        message: `Asset "${a.label}" (${a.kind}) is not referenced by any zone, entity, item, or landmark`,
      });
    }
  }

  // --- Orphan pack detection ---
  const usedPackIds = new Set<string>();
  for (const a of project.assets ?? []) {
    if (a.packId) usedPackIds.add(a.packId);
  }
  for (const pack of project.assetPacks ?? []) {
    if (!usedPackIds.has(pack.id)) {
      edges.push({
        domain: 'orphan-pack', status: 'orphaned',
        sourceType: 'assetPack', sourceId: pack.id, sourceLabel: pack.label,
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
