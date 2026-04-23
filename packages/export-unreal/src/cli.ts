#!/usr/bin/env node
// cli.ts — world-forge-export-unreal CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToUnreal } from './export.js';
import type { WorldProject } from '@world-forge/schema';

const USAGE = `Usage: world-forge-export-unreal <project.json> [options]

Options:
  --out <dir>        Output directory (default: ./UnrealPack)
  --tile-size-cm N   Override world scale (default: 100 cm per tile)
  --validate-only    Validate without writing files
  --verbose          Show detailed export diagnostics
  --warnings-only    With --verbose, hide lossless/info fidelity entries
  --help             Show this help

Produces (under --out):
  pack.json                      — manifest (id, name, version, source project, tile size, format version)
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

  const projectPath = args[0];
  const validateOnly = args.includes('--validate-only');
  const verbose = args.includes('--verbose');
  const warningsOnly = args.includes('--warnings-only');

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

  const result = exportToUnreal(project, tileSizeCm !== undefined ? { tileSizeCm } : undefined);

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

  // UE-B-006: zone + district writes are independent — parallelize them so I/O
  // overlap rather than serializing on each fs.write.
  await Promise.all(
    result.contentPack.Zones.map((zone) =>
      writeFile(join(resolvedOut, 'zones', `${safeFile(zone.Id)}.json`), JSON.stringify(zone, null, 2)),
    ),
  );
  await Promise.all(
    result.contentPack.Districts.map((district) =>
      writeFile(
        join(resolvedOut, 'districts', `${safeFile(district.Id)}.json`),
        JSON.stringify(district, null, 2),
      ),
    ),
  );

  console.log(`Exported to ${resolvedOut}/`);
  console.log(
    `  ${result.contentPack.Zones.length} zones, ${result.contentPack.Districts.length} districts, ${result.contentPack.Actors.All.length} actors, ${result.contentPack.Connections.length} connections`,
  );
  console.log(
    `  WorldPartition cells: ${result.contentPack.WorldPartition.CellsX} × ${result.contentPack.WorldPartition.CellsY} @ ${result.contentPack.WorldPartition.CellSizeCm} cm`,
  );
  console.log(`  Fidelity: ${result.fidelity.summary.losslessPercent}% lossless (${result.fidelity.summary.total} entries)`);

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
