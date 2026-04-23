#!/usr/bin/env node
// cli.ts — world-forge-export-unreal CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToUnreal, UNREAL_PACK_FORMAT_VERSION } from './export.js';
import { summarizePack, formatSummary } from './summary.js';
import { diffPacks, formatDiff } from './diff.js';
import type { WorldProject } from '@world-forge/schema';

// UE-A-003: help text is parametrized by UNREAL_PACK_FORMAT_VERSION so the
// "pack format" line stays in sync with the exporter. New Meta fields may land
// in minor versions (e.g. UE-FT-007 signing, UE-FT-008 version migration) —
// callers are told to rely on the format version, not a frozen field list.
const USAGE = `Usage: world-forge-export-unreal <project.json> [options]
       world-forge-export-unreal --summary <pack-dir>
       world-forge-export-unreal --diff <prev-dir> <new-dir>  [--detailed]

Export options:
  --out <dir>        Output directory (default: ./UnrealPack)
  --tile-size-cm N   Override world scale (default: 100 cm per tile)
  --sign             Attach a sha256 integrity hash to Meta.Signature
  --validate-only    Validate without writing files
  --verbose          Show detailed export diagnostics
  --warnings-only    With --verbose, hide lossless/info fidelity entries
  --help             Show this help

Summary / diff options:
  --summary <dir>    Print summary of the pack at <dir>
  --diff <a> <b>     Compare packs at <a> (previous) and <b> (new)
  --detailed         With --diff, list added/removed/changed ids

Pack format version: ${UNREAL_PACK_FORMAT_VERSION}
  Additional Meta fields may be added in minor versions (e.g. integrity hash,
  schema version). Loaders should gate on pack format version, not field list.

Produces (under --out):
  pack.json                      — manifest (includes pack format version; Meta fields may grow in minor versions)
  zones/<id>.json                — one Primary Data Asset JSON per zone
  districts/<id>.json            — one per district
  actors/manifest.json           — entity placements grouped by zone, BP-class tag per role
  actors/parallax-manifest.json  — one parallax actor per ParallaxLayer across all zones
  actors/transitions.json        — placed transition entities (elevators, warps, lifts)
  connections.json               — ZoneConnection → LevelStreamingHint
  world-partition.json           — grid cell hints (gridWidth/gridHeight → UE cells)
  fidelity.json                  — what was lossless / approximated / dropped`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  // UE-FT-005: read-only subcommands (--summary, --diff) short-circuit before
  // the export pipeline so they work without a project.json argument.
  const summaryIdx = args.indexOf('--summary');
  if (summaryIdx !== -1) {
    const dir = args[summaryIdx + 1];
    if (!dir) {
      console.error('Error: --summary requires a pack directory path (e.g., --summary ./UnrealPack)');
      process.exit(1);
    }
    const result = await summarizePack(resolve(dir));
    if ('error' in result) {
      console.error(`Error: ${result.error}`);
      if (result.hint) console.error(`Hint: ${result.hint}`);
      process.exit(1);
    }
    console.log(formatSummary(result));
    process.exit(0);
  }

  const diffIdx = args.indexOf('--diff');
  if (diffIdx !== -1) {
    const prev = args[diffIdx + 1];
    const next = args[diffIdx + 2];
    if (!prev || !next || prev.startsWith('--') || next.startsWith('--')) {
      console.error('Error: --diff requires two pack directory paths (e.g., --diff ./prev ./new)');
      process.exit(1);
    }
    const detailed = args.includes('--detailed');
    const result = await diffPacks(resolve(prev), resolve(next));
    if ('error' in result) {
      console.error(`Error: ${result.error}`);
      if (result.hint) console.error(`Hint: ${result.hint}`);
      process.exit(1);
    }
    console.log(formatDiff(result, detailed));
    process.exit(0);
  }

  const projectPath = args[0];
  const validateOnly = args.includes('--validate-only');
  const verbose = args.includes('--verbose');
  const warningsOnly = args.includes('--warnings-only');
  const sign = args.includes('--sign');

  const outIdx = args.indexOf('--out');
  if (outIdx !== -1 && !args[outIdx + 1]) {
    console.error('Error: --out requires a path value (e.g., --out ./UnrealPack)');
    process.exit(1);
  }
  const outDir = outIdx !== -1 ? args[outIdx + 1] : './UnrealPack';

  const tileIdx = args.indexOf('--tile-size-cm');
  if (tileIdx !== -1 && !args[tileIdx + 1]) {
    console.error('Error: --tile-size-cm requires a numeric value (e.g., --tile-size-cm 200)');
    process.exit(1);
  }
  const tileSizeCm = tileIdx !== -1 ? Number(args[tileIdx + 1]) : undefined;
  if (tileSizeCm !== undefined && (!Number.isFinite(tileSizeCm) || tileSizeCm <= 0)) {
    console.error(`Error: --tile-size-cm must be a positive finite number (got "${args[tileIdx + 1]}")`);
    process.exit(1);
  }

  let raw: string;
  try {
    raw = await readFile(resolve(projectPath), 'utf-8');
  } catch (err) {
    console.error(`Error: cannot read "${projectPath}": ${(err as Error).message}`);
    process.exit(1);
  }

  let project: WorldProject;
  try {
    project = JSON.parse(raw) as WorldProject;
  } catch {
    console.error(`Error: "${projectPath}" is not valid JSON`);
    process.exit(1);
  }

  const exportOptions: { tileSizeCm?: number; signing?: { algorithm: 'sha256' } } = {};
  if (tileSizeCm !== undefined) exportOptions.tileSizeCm = tileSizeCm;
  if (sign) exportOptions.signing = { algorithm: 'sha256' };
  const result = exportToUnreal(
    project,
    Object.keys(exportOptions).length > 0 ? exportOptions : undefined,
  );

  if (!result.success) {
    console.error('Validation failed:');
    for (const e of result.errors) {
      console.error(`  [${e.path}] ${e.message}`);
    }
    process.exit(1);
  }

  if (validateOnly) {
    console.log('Validation passed.');
    for (const w of result.warnings) console.log(`  - ${w}`);
    process.exit(0);
  }

  const resolvedOut = resolve(outDir);
  await mkdir(resolvedOut, { recursive: true });
  await mkdir(join(resolvedOut, 'zones'), { recursive: true });
  await mkdir(join(resolvedOut, 'districts'), { recursive: true });
  await mkdir(join(resolvedOut, 'actors'), { recursive: true });

  // UE-B-002: progress signal for long exports. Emit a single-line status to
  // stderr before multi-second batches so users don't see a silent pause. Not
  // spammy — one status per logical batch.
  const zoneCount = result.contentPack.Zones.length;
  const districtCount = result.contentPack.Districts.length;
  process.stderr.write(
    `Converting Unreal pack: ${zoneCount} zones, ${districtCount} districts — writing to disk...\n`,
  );

  // Single-file writes stay sequential for determinism (stable stdout ordering
  // on failure, and consistent timestamps when consumers diff the output dir).
  await writeFile(join(resolvedOut, 'pack.json'), JSON.stringify(result.contentPack.Meta, null, 2));
  await writeFile(
    join(resolvedOut, 'world-partition.json'),
    JSON.stringify(result.contentPack.WorldPartition, null, 2),
  );
  await writeFile(join(resolvedOut, 'connections.json'), JSON.stringify(result.contentPack.Connections, null, 2));
  await writeFile(join(resolvedOut, 'fidelity.json'), JSON.stringify(result.fidelity, null, 2));
  await writeFile(join(resolvedOut, 'actors', 'manifest.json'), JSON.stringify(result.contentPack.Actors, null, 2));
  await writeFile(
    join(resolvedOut, 'actors', 'parallax-manifest.json'),
    JSON.stringify(result.contentPack.Parallax, null, 2),
  );
  await writeFile(
    join(resolvedOut, 'actors', 'transitions.json'),
    JSON.stringify(result.contentPack.Transitions, null, 2),
  );

  // UE-B-001: zone + district writes are concurrent but must not silently drop
  // a failure. `Promise.allSettled` lets us aggregate per-file failures so the
  // user sees every broken path at once, not just the first one. Partial
  // success still exits non-zero because the pack on disk is incomplete.
  const zoneWrites = await Promise.allSettled(
    result.contentPack.Zones.map((zone) => {
      const path = join(resolvedOut, 'zones', `${safeFile(zone.Id)}.json`);
      return writeFile(path, JSON.stringify(zone, null, 2)).then(() => ({ path, id: zone.Id }));
    }),
  );
  const districtWrites = await Promise.allSettled(
    result.contentPack.Districts.map((district) => {
      const path = join(resolvedOut, 'districts', `${safeFile(district.Id)}.json`);
      return writeFile(path, JSON.stringify(district, null, 2)).then(() => ({ path, id: district.Id }));
    }),
  );

  const writeFailures: Array<{ kind: 'zone' | 'district'; index: number; message: string }> = [];
  zoneWrites.forEach((r, i) => {
    if (r.status === 'rejected') {
      const zoneId = result.contentPack.Zones[i]?.Id ?? `#${i}`;
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      writeFailures.push({ kind: 'zone', index: i, message: `zones/${zoneId}.json: ${msg}` });
    }
  });
  districtWrites.forEach((r, i) => {
    if (r.status === 'rejected') {
      const dId = result.contentPack.Districts[i]?.Id ?? `#${i}`;
      const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
      writeFailures.push({ kind: 'district', index: i, message: `districts/${dId}.json: ${msg}` });
    }
  });

  if (writeFailures.length > 0) {
    console.error(
      `Pack incomplete: ${writeFailures.length} file write(s) failed. The pack at ${resolvedOut} is corrupted and must not be loaded by UE5:`,
    );
    for (const f of writeFailures) console.error(`  - ${f.message}`);
    console.error(
      `Hint: check disk space, directory permissions on ${resolvedOut}, and retry with --out pointing at a writable path.`,
    );
    process.exit(1);
  }

  console.log(`Exported to ${resolvedOut}/`);
  console.log(
    `  ${result.contentPack.Zones.length} zones, ${result.contentPack.Districts.length} districts, ${result.contentPack.Actors.All.length} actors, ${result.contentPack.Connections.length} connections`,
  );
  console.log(
    `  WorldPartition cells: ${result.contentPack.WorldPartition.CellsX} × ${result.contentPack.WorldPartition.CellsY} @ ${result.contentPack.WorldPartition.CellSizeCm} cm`,
  );
  console.log(`  Fidelity: ${result.fidelity.summary.losslessPercent}% lossless (${result.fidelity.summary.total} entries)`);

  // UE-B-003: surface dropped entities to stderr so users (and CI) see exactly
  // which actors the pack is missing and why. The manifest/fidelity already
  // flag this, but stderr is where a user actually looks when something is
  // off. Also emit as a non-zero-worthy warning — we exit 0 (pack is usable
  // with gaps), but the Incomplete signal propagates through manifest + stderr.
  const droppedActors = result.contentPack.Actors.Dropped;
  if (droppedActors.length > 0) {
    console.error(
      `Warning: pack is INCOMPLETE — ${droppedActors.length} entity placement(s) dropped:`,
    );
    for (const d of droppedActors) {
      console.error(`  - Entity "${d.ActorId}" in missing zone "${d.ZoneId}": ${d.Reason}`);
    }
    console.error(
      `Hint: fix the missing zones in the source project, or remove the stale entity placements. UE5 loader should check Actors.Incomplete on this pack.`,
    );
  }

  for (const w of result.warnings) console.log(`  - ${w}`);

  if (verbose) {
    // UE-B-008: `--warnings-only` filters to meaningful entries. Default stays
    // the current wall-of-text so existing dashboards that parse stdout keep
    // working (back-compat).
    const entries = warningsOnly
      ? result.fidelity.entries.filter((e) => e.level !== 'lossless' || e.severity !== 'info')
      : result.fidelity.entries;
    const header = warningsOnly
      ? `\n--- Fidelity entries (warnings only: ${entries.length}/${result.fidelity.entries.length}) ---`
      : '\n--- Fidelity entries ---';
    console.log(header);
    for (const e of entries) {
      console.log(`  [${e.level}/${e.severity}] ${e.domain}: ${e.message}`);
    }
  }
}

function safeFile(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, '_');
}

main().catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
