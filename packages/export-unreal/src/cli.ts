#!/usr/bin/env node
// cli.ts — world-forge-export-unreal CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToUnreal, applyPackSigning, UNREAL_PACK_FORMAT_VERSION } from './export.js';
import { summarizePack, formatSummary } from './summary.js';
import { diffPacks, formatDiff } from './diff.js';
import type { WorldProject } from '@world-forge/schema';

// UE-A-003: help text is parametrized by UNREAL_PACK_FORMAT_VERSION so the
// "pack format" line stays in sync with the exporter. New Meta fields may land
// in minor versions (e.g. UE-FT-007 signing, UE-FT-008 version migration) —
// callers are told to rely on the format version, not a frozen field list.
const USAGE = `Usage: world-forge-export-unreal <project.json> [options]
       world-forge-export-unreal --summary <pack-dir>
       world-forge-export-unreal --verify <pack-dir>
       world-forge-export-unreal --diff <prev-dir> <new-dir>  [--detailed]

Export options:
  --out <dir>        Output directory (default: ./UnrealPack).
                     <dir> must be a path and must not start with '-'
  --tile-size-cm N   Override world scale (default: 100 cm per tile)
  --sign             Attach a sha256 integrity hash to Meta.Signature
  --validate-only    Validate without writing files
  --verbose          Show detailed export diagnostics
  --warnings-only    With --verbose, hide lossless/info fidelity entries
  --help             Show this help

Summary / diff options:
  --summary <dir>    Print summary of the pack at <dir>.
                     <dir> must be a path and must not start with '-'
  --verify <dir>     Verify pack Signature; exit non-zero on mismatch or unsigned.
                     <dir> must be a path and must not start with '-'
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
  actors/strata.json             — discrete vertical strata + stratum links
  actors/tiles.json              — per-layer tile cells, walkable collision, HISM hints
  actors/props.json              — placed props with walkable collision
  actors/hazards.json            — typed hazard definitions + zone volume actors
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
    const dir = requirePathArg('--summary', args[summaryIdx + 1], './UnrealPack');
    const result = await summarizePack(resolve(dir));
    if ('error' in result) {
      console.error(`Error: ${result.error}`);
      if (result.hint) console.error(`Hint: ${result.hint}`);
      process.exit(1);
    }
    console.log(formatSummary(result));
    process.exit(0);
  }

  const verifyIdx = args.indexOf('--verify');
  if (verifyIdx !== -1) {
    const dir = requirePathArg('--verify', args[verifyIdx + 1], './UnrealPack');
    const result = await summarizePack(resolve(dir));
    if ('error' in result) {
      console.error(`Error: ${result.error}`);
      if (result.hint) console.error(`Hint: ${result.hint}`);
      process.exit(1);
    }
    if (!result.meta.signed) {
      console.error('Error: pack is not signed (no Signature on pack.json).');
      console.error('Hint: re-export with --sign, then --verify.');
      process.exit(1);
    }
    if (result.meta.signatureValid !== true) {
      console.error(`Error: pack signature is INVALID${result.meta.signatureReason ? `: ${result.meta.signatureReason}` : '.'}`);
      process.exit(1);
    }
    console.log(`Signature valid (${result.meta.signatureAlgorithm ?? 'sha256'}).`);
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

  // F-c0271959: leftover/typo'd flags used to be ignored (or become the
  // project path). Closed set + Levenshtein suggestion; flags-first is a
  // usage error, not a missing file named "--out".
  rejectUnknownOrLeadingFlags(args);

  const projectPath = args[0];
  const validateOnly = args.includes('--validate-only');
  const verbose = args.includes('--verbose');
  const warningsOnly = args.includes('--warnings-only');
  const sign = args.includes('--sign');

  const outIdx = args.indexOf('--out');
  const outDir = outIdx !== -1 ? requirePathArg('--out', args[outIdx + 1], './UnrealPack') : './UnrealPack';

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
  } catch (err) {
    console.error(`Error: "${projectPath}" is not valid JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  const exportOptions: { tileSizeCm?: number } = {};
  if (tileSizeCm !== undefined) exportOptions.tileSizeCm = tileSizeCm;
  const result = exportToUnreal(
    project,
    Object.keys(exportOptions).length > 0 ? exportOptions : undefined,
  );

  if (result.success && sign) {
    // F-36785d5f: signing lives behind a dynamic import so the browser-safe
    // exportToUnreal graph never contains node:crypto.
    result.contentPack.Meta = await applyPackSigning(result.contentPack.Meta, { algorithm: 'sha256' });
  }

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
  await writeFile(
    join(resolvedOut, 'actors', 'strata.json'),
    JSON.stringify(result.contentPack.Strata, null, 2),
  );
  await writeFile(
    join(resolvedOut, 'actors', 'tiles.json'),
    JSON.stringify(result.contentPack.Tiles, null, 2),
  );
  await writeFile(
    join(resolvedOut, 'actors', 'props.json'),
    JSON.stringify(result.contentPack.Props, null, 2),
  );
  await writeFile(
    join(resolvedOut, 'actors', 'hazards.json'),
    JSON.stringify(result.contentPack.Hazards, null, 2),
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
  console.log(
    `  Fidelity: ${result.fidelity.summary.losslessPercent}% lossless (${result.fidelity.summary.total} entries, ${result.fidelity.summary.dropped} dropped, ${result.fidelity.summary.approximated} approximated)`,
  );

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

  // F-5aa31629: convertTransitions already records Dropped fidelity for
  // ghost zoneId/targetZoneId, but the operator surface never read it.
  // Mirror the Actors.Dropped block so a lift that didn't ship is named
  // on stderr without --verbose.
  const droppedTransitions = result.fidelity.entries.filter(
    (e) =>
      e.domain === 'transitions' &&
      (e.level === 'dropped' || e.level === 'approximated') &&
      (e.severity === 'warning' || e.severity === 'error'),
  );
  if (droppedTransitions.length > 0) {
    console.error(`Warning: ${droppedTransitions.length} transition(s) dropped:`);
    for (const e of droppedTransitions) {
      const id = e.entityId ?? e.fieldPath ?? '(unknown)';
      console.error(`  - Transition "${id}": ${e.message}${e.reason ? ` (${e.reason})` : ''}`);
    }
    console.error(
      `Hint: fix the missing zoneId/targetZoneId refs in the source project so the UE5 loader can place these lifts/warps.`,
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

/** F-42820520: a following token that starts with '-' is another flag, not a path. */
function requirePathArg(flag: string, value: string | undefined, example: string): string {
  if (!value || value.startsWith('-')) {
    const got = value ?? '(missing)';
    const extra = value?.startsWith('-')
      ? ` — '${value}' looks like a swallowed flag, not a directory`
      : ` (e.g., ${flag} ${example})`;
    console.error(
      `Error: ${flag} requires a path value that does not start with '-' (got '${got}')${extra}`,
    );
    process.exit(1);
    throw new Error('unreachable');
  }
  return value;
}

const KNOWN_FLAGS = [
  '--help',
  '--summary',
  '--verify',
  '--diff',
  '--detailed',
  '--out',
  '--tile-size-cm',
  '--sign',
  '--validate-only',
  '--verbose',
  '--warnings-only',
] as const;

const VALUE_FLAGS = new Set(['--out', '--tile-size-cm']);

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => {
    const row = new Array<number>(n + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

function suggestFlag(unknown: string): string {
  let best: (typeof KNOWN_FLAGS)[number] = KNOWN_FLAGS[0];
  let bestD = Infinity;
  for (const flag of KNOWN_FLAGS) {
    const d = levenshtein(unknown, flag);
    if (d < bestD) {
      bestD = d;
      best = flag;
    }
  }
  return best;
}

function rejectUnknownOrLeadingFlags(args: string[]): void {
  const known = new Set<string>(KNOWN_FLAGS);
  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (!tok.startsWith('-')) continue;
    if (!known.has(tok)) {
      console.error(`Error: unknown option '${tok}'. Did you mean ${suggestFlag(tok)}?`);
      if (args[0]?.startsWith('-')) {
        console.error('Hint: project.json must be the first argument; flags follow.');
      }
      process.exit(1);
    }
    if (VALUE_FLAGS.has(tok)) i += 1;
  }
  if (args[0]?.startsWith('-')) {
    console.error(`Error: expected a project.json path as the first argument (got '${args[0]}').`);
    console.error('Hint: project.json must be the first argument; flags follow.');
    process.exit(1);
  }
}

main().catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  if (process.argv.includes('--verbose') && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
