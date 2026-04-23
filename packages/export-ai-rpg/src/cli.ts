#!/usr/bin/env node
// cli.ts — world-forge export CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToEngine } from './export.js';
import type { WorldProject } from '@world-forge/schema';

const USAGE = `Usage: world-forge-export <project.json> [options]

Options:
  --out <dir>        Output directory (default: ./export) (created if missing)
  --validate-only    Validate without writing files
  --verbose          Show detailed export diagnostics (includes err.stack on failure)
  --help             Show this help

Exit codes:
  0  success (or --validate-only passed)
  1  any error (bad args, unreadable input, invalid JSON, validation failure, write failure)

See also: world-forge-export-unreal (for Unreal Engine 5 2.5D games).`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const projectPath = args[0];
  const validateOnly = args.includes('--validate-only');
  const verbose = args.includes('--verbose');
  const outIdx = args.indexOf('--out');

  // EB-002: Bounds check for --out flag argument
  if (outIdx !== -1 && !args[outIdx + 1]) {
    console.error('Error: --out requires a path value (e.g., --out ./my-export)');
    process.exit(1);
  }
  const outDir = outIdx !== -1 ? args[outIdx + 1] : './export';

  // Read project file
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

  // Export
  const result = exportToEngine(project);

  if (!result.success) {
    console.error('Validation failed:');
    for (const e of result.errors) {
      console.error(`  [${e.path}] ${e.message}`);
    }
    process.exit(1);
  }

  const exportResult = result; // narrowed to ExportResult

  if (validateOnly) {
    console.log('Validation passed.');
    if (exportResult.warnings.length > 0) {
      console.log('Warnings:');
      for (const w of exportResult.warnings) {
        console.log(`  - ${w}`);
      }
    }
    process.exit(0);
  }

  // Write output files
  const resolvedOut = resolve(outDir);
  await mkdir(resolvedOut, { recursive: true });

  await writeFile(
    join(resolvedOut, 'content-pack.json'),
    JSON.stringify(exportResult.contentPack, null, 2),
  );
  await writeFile(
    join(resolvedOut, 'manifest.json'),
    JSON.stringify(exportResult.manifest, null, 2),
  );
  await writeFile(
    join(resolvedOut, 'pack-meta.json'),
    JSON.stringify(exportResult.packMeta, null, 2),
  );

  console.log(`Exported to ${resolvedOut}/`);
  console.log(`  content-pack.json (${exportResult.contentPack.zones.length} zones, ${exportResult.contentPack.entities.length} entities)`);
  console.log(`  manifest.json`);
  console.log(`  pack-meta.json`);

  if (exportResult.warnings.length > 0) {
    console.log('Warnings:');
    for (const w of exportResult.warnings) {
      console.log(`  - ${w}`);
    }
  }

  // EB-013: Verbose diagnostics for debugging export failures
  if (verbose) {
    console.log('\n--- Verbose Diagnostics ---');
    console.log(`  Zones: ${exportResult.contentPack.zones.length}`);
    console.log(`  Entities: ${exportResult.contentPack.entities.length}`);
    console.log(`  Districts: ${exportResult.contentPack.districts.length}`);
    console.log(`  Dialogues: ${exportResult.contentPack.dialogues.length}`);
    console.log(`  Items: ${exportResult.contentPack.items.length}`);
    console.log(`  Progression Trees: ${exportResult.contentPack.progressionTrees.length}`);
    console.log(`  Encounter Anchors: ${exportResult.contentPack.encounterAnchors.length}`);
    console.log(`  Faction Presences: ${exportResult.contentPack.factionPresences.length}`);
    console.log(`  Pressure Hotspots: ${exportResult.contentPack.pressureHotspots.length}`);
    console.log(`  Player Template: ${exportResult.contentPack.playerTemplate ? 'yes' : 'no'}`);
    console.log(`  Build Catalog: ${exportResult.contentPack.buildCatalog ? 'yes' : 'no'}`);
  }
}

main().catch((err: Error) => {
  console.error(`Fatal: ${err.message}`);
  // AIR-B-005: When --verbose is set, also print the stack trace to aid
  // debugging of unexpected top-level failures (e.g. write/permission errors).
  if (process.argv.includes('--verbose') && err.stack) {
    console.error(err.stack);
  }
  process.exit(1);
});
