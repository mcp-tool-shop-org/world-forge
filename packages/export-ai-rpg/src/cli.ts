#!/usr/bin/env node
// cli.ts — world-forge export CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToEngine, type ExportProfile } from './export.js';
import type { WorldProject } from '@world-forge/schema';

const USAGE = `Usage: world-forge-export <project.json> [options]

Options:
  --out <dir>               Output directory (default: ./export) (created if missing)
  --validate-only           Validate without writing files
  --profile <name>          Export profile: 'release' (default) or 'debug'
                            debug adds a _debug block (timestamp, schemaVersion,
                            sourceProjectId, fidelityVerbose) and keeps every
                            fidelity entry. release is the stable, minimal output.
  --dry-run                 Validate + report sizes without writing files
                            (mutually exclusive with --out)
  --no-emit-schema-version  Strip the ContentPack.schemaVersion field
                            (default: schemaVersion IS emitted)
  --emit-schema-version     Force-on (default; useful only to override env)
  --verbose                 Show detailed export diagnostics (includes err.stack on failure)
  --help                    Show this help

Exit codes:
  0  success (or --validate-only / --dry-run passed)
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
  const dryRun = args.includes('--dry-run');
  const outIdx = args.indexOf('--out');

  // EB-002: Bounds check for --out flag argument
  if (outIdx !== -1 && !args[outIdx + 1]) {
    console.error('Error: --out requires a path value (e.g., --out ./my-export)');
    process.exit(1);
  }

  // AIR-FT-005: --dry-run is mutually exclusive with --out
  if (dryRun && outIdx !== -1) {
    console.error('Error: --dry-run and --out are mutually exclusive (dry-run never writes files)');
    process.exit(1);
  }

  const outDir = outIdx !== -1 ? args[outIdx + 1] : './export';

  // AIR-FT-001: --profile flag
  const profileIdx = args.indexOf('--profile');
  if (profileIdx !== -1 && !args[profileIdx + 1]) {
    console.error('Error: --profile requires a value: release | debug');
    process.exit(1);
  }
  const profileRaw = profileIdx !== -1 ? args[profileIdx + 1] : 'release';
  if (profileRaw !== 'release' && profileRaw !== 'debug') {
    console.error(`Error: --profile must be 'release' or 'debug' (got '${profileRaw}')`);
    process.exit(1);
  }
  const profile: ExportProfile = profileRaw;

  // AIR-FT-005: schemaVersion emission (default on; --no-emit-schema-version opts out)
  const emitSchemaVersion = !args.includes('--no-emit-schema-version');

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
  const result = exportToEngine(project, { profile, emitSchemaVersion });

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

  // AIR-FT-005: --dry-run — report sizes, never touch disk
  if (dryRun) {
    const contentPackJson = JSON.stringify(exportResult.contentPack, null, 2);
    const manifestJson = JSON.stringify(exportResult.manifest, null, 2);
    const packMetaJson = JSON.stringify(exportResult.packMeta, null, 2);
    const totalBytes = Buffer.byteLength(contentPackJson, 'utf-8')
      + Buffer.byteLength(manifestJson, 'utf-8')
      + Buffer.byteLength(packMetaJson, 'utf-8');
    console.log('Dry run — no files written.');
    console.log(`  Profile: ${profile}`);
    console.log(`  Zones: ${exportResult.contentPack.zones.length}`);
    console.log(`  Entities: ${exportResult.contentPack.entities.length}`);
    console.log(`  Districts: ${exportResult.contentPack.districts.length}`);
    console.log(`  Items: ${exportResult.contentPack.items.length}`);
    console.log(`  Dialogues: ${exportResult.contentPack.dialogues.length}`);
    console.log(`  content-pack.json: ${Buffer.byteLength(contentPackJson, 'utf-8')} bytes`);
    console.log(`  manifest.json:     ${Buffer.byteLength(manifestJson, 'utf-8')} bytes`);
    console.log(`  pack-meta.json:    ${Buffer.byteLength(packMetaJson, 'utf-8')} bytes`);
    console.log(`  Total:             ${totalBytes} bytes`);
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
    console.log(`  Profile: ${profile}`);
    console.log(`  schemaVersion emitted: ${emitSchemaVersion ? 'yes' : 'no'}`);
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
