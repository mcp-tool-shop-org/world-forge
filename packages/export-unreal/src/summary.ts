/**
 * summary.ts — UE-FT-005 human-readable pack summary.
 *
 * Reads an on-disk Unreal pack directory and produces a compact, human-scan
 * overview: zone/district/entity/asset counts, format version, whether the
 * pack is signed, total size on disk. Pure function — I/O is a single `fs`
 * walk; the caller prints it. CLI wraps this in `--summary`.
 */

import { readFile, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { UnrealPackMeta } from './export.js';

export interface PackSummary {
  packDir: string;
  meta: {
    id: string;
    name: string;
    version: string;
    formatVersion: string;
    signed: boolean;
    signatureAlgorithm?: string;
  };
  counts: {
    zones: number;
    districts: number;
    actors: number;
    parallaxActors: number;
    transitions: number;
    landmarks: number;
    connections: number;
    /** Unique `AssetRef`/`*AssetId` values referenced across zones + parallax. */
    assetRefs: number;
  };
  sizeBytes: number;
}

export interface SummaryError {
  error: string;
  hint?: string;
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as T;
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile() && e.name.endsWith('.json')).map((e) => e.name);
  } catch {
    return [];
  }
}

async function dirSize(dir: string): Promise<number> {
  let total = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await dirSize(full);
      } else if (entry.isFile()) {
        const s = await stat(full);
        total += s.size;
      }
    }
  } catch {
    // Unreadable dir → 0 contribution; caller already validated the root.
  }
  return total;
}

/**
 * Build a summary of the pack at `packDir`. Returns `SummaryError` (not
 * `throw`) for missing/malformed packs so the CLI can print a clean message.
 */
export async function summarizePack(packDir: string): Promise<PackSummary | SummaryError> {
  // Validate pack.json exists and parses.
  let meta: UnrealPackMeta;
  try {
    meta = await readJson<UnrealPackMeta>(join(packDir, 'pack.json'));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      error: `Cannot read pack.json at ${packDir}: ${message}`,
      hint: 'Check that the directory exists and contains a pack.json produced by world-forge-export-unreal.',
    };
  }

  if (typeof meta.FormatVersion !== 'string') {
    return {
      error: `pack.json at ${packDir} is missing FormatVersion — is this a world-forge Unreal pack?`,
      hint: 'Re-export from the editor or CLI to regenerate a well-formed pack.',
    };
  }

  const zoneFiles = await listJsonFiles(join(packDir, 'zones'));
  const districtFiles = await listJsonFiles(join(packDir, 'districts'));

  let actors = 0;
  let parallaxActors = 0;
  let transitions = 0;
  let connections = 0;
  const assetRefs = new Set<string>();

  try {
    const manifest = await readJson<{ All?: unknown[] }>(join(packDir, 'actors', 'manifest.json'));
    actors = Array.isArray(manifest.All) ? manifest.All.length : 0;
  } catch {
    // actors/manifest.json optional — empty packs may omit it.
  }
  try {
    const parallax = await readJson<{ Actors?: unknown[] }>(join(packDir, 'actors', 'parallax-manifest.json'));
    parallaxActors = Array.isArray(parallax.Actors) ? parallax.Actors.length : 0;
  } catch {
    // optional
  }
  try {
    const trans = await readJson<unknown[]>(join(packDir, 'actors', 'transitions.json'));
    transitions = Array.isArray(trans) ? trans.length : 0;
  } catch {
    // optional
  }
  try {
    const cons = await readJson<unknown[]>(join(packDir, 'connections.json'));
    connections = Array.isArray(cons) ? cons.length : 0;
  } catch {
    // optional
  }

  // Walk zone files to collect referenced asset ids.
  for (const file of zoneFiles) {
    try {
      const zone = await readJson<{
        BackgroundAssetId?: string;
        TilesetAssetId?: string;
        SkylineAssetId?: string;
        ParallaxLayers?: Array<{ AssetRef?: string }>;
      }>(join(packDir, 'zones', file));
      if (zone.BackgroundAssetId) assetRefs.add(zone.BackgroundAssetId);
      if (zone.TilesetAssetId) assetRefs.add(zone.TilesetAssetId);
      if (zone.SkylineAssetId) assetRefs.add(zone.SkylineAssetId);
      if (Array.isArray(zone.ParallaxLayers)) {
        for (const p of zone.ParallaxLayers) {
          if (p.AssetRef) assetRefs.add(p.AssetRef);
        }
      }
    } catch {
      // Skip malformed zone — summary is best-effort, not a validator.
    }
  }

  const sizeBytes = await dirSize(packDir);

  const sig = meta.Signature;
  return {
    packDir,
    meta: {
      id: meta.Id,
      name: meta.Name,
      version: meta.Version,
      formatVersion: meta.FormatVersion,
      signed: !!sig,
      signatureAlgorithm: sig?.algorithm,
    },
    counts: {
      zones: zoneFiles.length,
      districts: districtFiles.length,
      actors,
      parallaxActors,
      transitions,
      landmarks: 0, // landmarks are a WorldProject field not exported to UE packs
      connections,
      assetRefs: assetRefs.size,
    },
    sizeBytes,
  };
}

/** Format a summary for stdout printing. Multi-line, aligned values. */
export function formatSummary(summary: PackSummary): string {
  const sizeKb = (summary.sizeBytes / 1024).toFixed(1);
  const lines: string[] = [
    `Pack: ${summary.meta.name} (${summary.meta.id})`,
    `  Version:       ${summary.meta.version}`,
    `  FormatVersion: ${summary.meta.formatVersion}`,
    `  Signed:        ${summary.meta.signed ? `yes (${summary.meta.signatureAlgorithm ?? 'unknown'})` : 'no'}`,
    `  Size on disk:  ${sizeKb} KB`,
    `  Zones:         ${summary.counts.zones}`,
    `  Districts:     ${summary.counts.districts}`,
    `  Actors:        ${summary.counts.actors}`,
    `  Parallax:      ${summary.counts.parallaxActors}`,
    `  Transitions:   ${summary.counts.transitions}`,
    `  Connections:   ${summary.counts.connections}`,
    `  Asset refs:    ${summary.counts.assetRefs}`,
  ];
  return lines.join('\n');
}
