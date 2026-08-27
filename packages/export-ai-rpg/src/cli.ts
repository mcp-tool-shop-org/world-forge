#!/usr/bin/env node
// cli.ts — world-forge export CLI

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToEngine, type ExportProfile, type ExportResult } from './export.js';
import {
  importProject,
  importFromExportResult,
  detectImportFormat,
  type ImportResult,
  type ImportError,
} from './import.js';
import type { WorldProject } from '@world-forge/schema';
import { buildFidelityReport, type FidelityEntry, type FidelityReport } from './fidelity.js';

const USAGE = `Usage: world-forge-export <project.json> [options]
       world-forge-export --import <file-or-pack-dir> [--out <dir>]
       world-forge-export --from-pack <pack-dir> [--out <dir>]

Options:
  --out <dir>               Output directory (default: ./export) (created if missing).
                            <dir> must be a path and must not start with '-'
                            Mutually exclusive with --validate-only and --dry-run
  --import <file>           Import a WorldProject, ContentPack, ExportResult JSON,
                            or a pack directory. Writes WorldProject JSON to --out
                            (world-project.json) or stdout if --out is omitted.
                            Mutually exclusive with <project.json> export.
  --from-pack <dir>         Import a pack directory as importFromExportResult
                            (content-pack.json + pack-meta.json + manifest.json).
                            Reads sidecar fidelity.json / assets.json /
                            asset-bindings.json / asset-packs.json when present.
  --validate-only           Validate without writing files
                            (mutually exclusive with --out)
  --profile <name>          Export profile: 'release' (default) or 'debug'
                            debug adds a _debug block (timestamp, schemaVersion,
                            sourceProjectId, fidelityVerbose) and keeps every
                            fidelity entry. release is the stable, minimal output.
  --dry-run                 Validate + report sizes without writing files
                            (mutually exclusive with --out)
  --no-emit-schema-version  Strip the ContentPack.schemaVersion field
  --emit-schema-version     Force-on. Wins over --no-emit-schema-version and
                            over WORLD_FORGE_EMIT_SCHEMA_VERSION=0/false/off.
                            (default: schemaVersion IS emitted; the env var
                            WORLD_FORGE_EMIT_SCHEMA_VERSION=0 disables it)
  --verbose                 Show detailed export diagnostics on every path
                            (success, --validate-only, --dry-run, and failure;
                            includes err.stack on failure)
  --help                    Show this help

Produces (under --out):
  content-pack.json         — engine ContentPack
  manifest.json             — GameManifest
  pack-meta.json            — PackMetadata
  fidelity.json             — lossless / approximated / dropped report
  assets.json               — when ExportResult.assets is present
  asset-bindings.json       — when ExportResult.assetBindings is present
  asset-packs.json          — when ExportResult.assetPacks is present

<project.json> may be the first argument or the first non-option token
(so \`world-forge-export --validate-only project.json\` is accepted).
Unknown options (any token starting with '-' that is not listed above)
are errors: the CLI prints "Error: unknown option '<flag>'. See --help."
and exits 1. This tool has no --strict or --pretty flag.

Exit codes:
  0  success (or --validate-only / --dry-run passed)
  1  any error (bad args, unreadable input, invalid JSON, validation failure, write failure)

See also: world-forge-export-unreal (for Unreal Engine 5 2.5D games).`;

const FLAGS_NO_VALUE = new Set([
  '--help',
  '--validate-only',
  '--verbose',
  '--dry-run',
  '--no-emit-schema-version',
  '--emit-schema-version',
]);
const FLAGS_WITH_VALUE = new Set(['--out', '--profile', '--import', '--from-pack']);

/** F-4ac43db0: --emit-schema-version wins over --no-emit-schema-version and over env. */
function resolveEmitSchemaVersion(args: string[]): boolean {
  if (args.includes('--emit-schema-version')) return true;
  if (args.includes('--no-emit-schema-version')) return false;
  const raw = process.env.WORLD_FORGE_EMIT_SCHEMA_VERSION;
  if (raw !== undefined) {
    const v = raw.trim().toLowerCase();
    if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
    if (v === '1' || v === 'true' || v === 'yes' || v === 'on' || v === '') return true;
  }
  return true;
}

function printWarningsAndFidelityList(
  warnings: string[],
  fidelity: FidelityReport,
  log: (...args: unknown[]) => void = (...args) => console.log(...args),
): void {
  if (warnings.length > 0) {
    log('Warnings:');
    for (const w of warnings) {
      log(`  - ${w}`);
    }
  }
  if (fidelity.entries.length > 0) {
    log('Fidelity:');
    for (const e of fidelity.entries) {
      log(`  [${e.level}/${e.domain}] ${e.reason}: ${e.message}`);
    }
  }
}

function printWarningsAndFidelity(exportResult: ExportResult): void {
  printWarningsAndFidelityList(exportResult.warnings, exportResult.fidelity);
}

async function readJsonIfExists(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
    throw err;
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function loadPackDirectory(dir: string): Promise<ExportResult> {
  const contentPackRaw = await readFile(join(dir, 'content-pack.json'), 'utf-8').catch((err: Error) => {
    throw new Error(`cannot read content-pack.json in "${dir}": ${err.message}`);
  });
  const manifestRaw = await readFile(join(dir, 'manifest.json'), 'utf-8').catch((err: Error) => {
    throw new Error(`cannot read manifest.json in "${dir}": ${err.message}`);
  });
  const packMetaRaw = await readFile(join(dir, 'pack-meta.json'), 'utf-8').catch((err: Error) => {
    throw new Error(`cannot read pack-meta.json in "${dir}": ${err.message}`);
  });
  const fidelityRaw = await readJsonIfExists(join(dir, 'fidelity.json'));
  const assets = await readJsonIfExists(join(dir, 'assets.json'));
  const assetBindings = await readJsonIfExists(join(dir, 'asset-bindings.json'));
  const assetPacks = await readJsonIfExists(join(dir, 'asset-packs.json'));
  const fidelity = (fidelityRaw && typeof fidelityRaw === 'object' && fidelityRaw !== null && 'entries' in (fidelityRaw as object))
    ? fidelityRaw as FidelityReport
    : buildFidelityReport([]);
  return {
    success: true,
    contentPack: JSON.parse(contentPackRaw),
    manifest: JSON.parse(manifestRaw),
    packMeta: JSON.parse(packMetaRaw),
    warnings: [],
    fidelity,
    assets: Array.isArray(assets) ? assets as ExportResult['assets'] : undefined,
    assetBindings: assetBindings && typeof assetBindings === 'object' ? assetBindings as ExportResult['assetBindings'] : undefined,
    assetPacks: Array.isArray(assetPacks) ? assetPacks as ExportResult['assetPacks'] : undefined,
  };
}

function printFidelityLine(e: FidelityEntry, indent = '  '): void {
  console.log(`${indent}[${e.level}/${e.domain}] ${e.reason}: ${e.message}`);
}

function printVerboseSuccess(
  exportResult: ExportResult,
  profile: ExportProfile,
  emitSchemaVersion: boolean,
): void {
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
  console.log(`  Fidelity entries: ${exportResult.fidelity.entries.length}`);
  for (const e of exportResult.fidelity.entries) {
    printFidelityLine(e, '    ');
  }
}

async function runImport(opts: {
  importPath: string;
  forcePackDir: boolean;
  outDir: string | undefined;
  hasOut: boolean;
  validateOnly: boolean;
  dryRun: boolean;
  verbose: boolean;
}): Promise<void> {
  const { importPath, forcePackDir, outDir, hasOut, validateOnly, dryRun, verbose } = opts;
  let imported: ImportResult | ImportError;
  try {
    const asDir = forcePackDir || await isDirectory(importPath);
    if (asDir) {
      const pack = await loadPackDirectory(importPath);
      imported = importFromExportResult(pack);
    } else {
      let raw: string;
      try {
        raw = await readFile(importPath, 'utf-8');
      } catch (err) {
        console.error(`Error: cannot read "${importPath}": ${(err as Error).message}`);
        process.exit(1);
        return;
      }
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(
          `Error: "${importPath}" is not valid JSON — ${detail}. Fix the syntax at that location and re-run.`,
        );
        process.exit(1);
        return;
      }
      const format = detectImportFormat(data);
      if (format === null) {
        console.error(
          `Error: "${importPath}" is not a recognized import format. Expected a WorldProject, ContentPack, ExportResult, ProjectBundle, or a pack directory.`,
        );
        process.exit(1);
        return;
      }
      imported = importProject(data);
    }
  } catch (err) {
    console.error(`Error: import failed: ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  if (!imported.success) {
    console.error(`Import failed: ${imported.message}`);
    for (const e of imported.errors) {
      console.error(`  [${e.path}] ${e.message}`);
    }
    process.exit(1);
    return;
  }

  const projectJson = JSON.stringify(imported.project, null, 2);

  if (validateOnly) {
    console.log(`Validation passed. (${imported.format})`);
    printWarningsAndFidelityList(imported.warnings, imported.fidelityReport);
    if (verbose) {
      console.log('\n--- Verbose Diagnostics ---');
      console.log(`  Format: ${imported.format}`);
      console.log(`  Zones: ${imported.project.zones.length}`);
      console.log(`  Entities: ${imported.project.entityPlacements.length}`);
      console.log(`  Fidelity entries: ${imported.fidelityReport.entries.length}`);
    }
    process.exit(0);
  }

  if (dryRun) {
    console.log('Dry run — no files written.');
    console.log(`  Format: ${imported.format}`);
    console.log(`  Zones: ${imported.project.zones.length}`);
    console.log(`  Entities: ${imported.project.entityPlacements.length}`);
    console.log(`  world-project.json: ${Buffer.byteLength(projectJson, 'utf-8')} bytes`);
    printWarningsAndFidelityList(imported.warnings, imported.fidelityReport);
    process.exit(0);
  }

  if (!hasOut || !outDir) {
    process.stdout.write(projectJson.endsWith('\n') ? projectJson : `${projectJson}\n`);
    printWarningsAndFidelityList(imported.warnings, imported.fidelityReport, (...args) => console.error(...args));
    process.exit(0);
  }

  const resolvedOut = resolve(outDir);
  await mkdir(resolvedOut, { recursive: true });
  await writeFile(join(resolvedOut, 'world-project.json'), projectJson);
  console.log(`Imported to ${resolvedOut}/`);
  console.log(`  world-project.json (${imported.project.zones.length} zones, ${imported.project.entityPlacements.length} entities, format ${imported.format})`);
  printWarningsAndFidelityList(imported.warnings, imported.fidelityReport);
  if (verbose) {
    console.log('\n--- Verbose Diagnostics ---');
    console.log(`  Format: ${imported.format}`);
    console.log(`  Fidelity entries: ${imported.fidelityReport.entries.length}`);
  }
  process.exit(0);
}

function collectExportFiles(exportResult: ExportResult): Array<{ name: string; json: string }> {
  const files: Array<{ name: string; json: string }> = [
    { name: 'content-pack.json', json: JSON.stringify(exportResult.contentPack, null, 2) },
    { name: 'manifest.json', json: JSON.stringify(exportResult.manifest, null, 2) },
    { name: 'pack-meta.json', json: JSON.stringify(exportResult.packMeta, null, 2) },
    { name: 'fidelity.json', json: JSON.stringify(exportResult.fidelity, null, 2) },
  ];
  if (exportResult.assets && exportResult.assets.length > 0) {
    files.push({ name: 'assets.json', json: JSON.stringify(exportResult.assets, null, 2) });
  }
  if (exportResult.assetBindings) {
    files.push({ name: 'asset-bindings.json', json: JSON.stringify(exportResult.assetBindings, null, 2) });
  }
  if (exportResult.assetPacks && exportResult.assetPacks.length > 0) {
    files.push({ name: 'asset-packs.json', json: JSON.stringify(exportResult.assetPacks, null, 2) });
  }
  return files;
}

function isConverterFailure(errors: Array<{ path: string; message: string }>): boolean {
  return (
    errors.length > 0 &&
    (errors.every((e) => e.path === 'converter') ||
      errors.some((e) => e.message.startsWith('Converter failed')))
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  // Walk argv: known flags, their values, first non-option as the project path.
  // F-08ce4899: any leftover token that starts with '-' is an unknown option.
  // F-b2103ece: flag-first invocations take the first non-option as <project.json>.
  let projectPath: string | undefined;
  let leadingFlag: string | undefined;
  const present = new Set<string>();
  const values = new Map<string, string>();

  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok.startsWith('-')) {
      if (leadingFlag === undefined) leadingFlag = tok;
      if (FLAGS_NO_VALUE.has(tok)) {
        present.add(tok);
        continue;
      }
      if (FLAGS_WITH_VALUE.has(tok)) {
        const val = args[i + 1];
        if (!val || val.startsWith('-')) {
          if (tok === '--out') {
            console.error(
              `Error: --out requires a path value that does not start with '-' (got '${val ?? '(missing)'}')` +
                (val?.startsWith('-') ? ` — '${val}' looks like a swallowed flag, not a directory` : ' (e.g., --out ./my-export)'),
            );
          } else if (tok === '--import' || tok === '--from-pack') {
            console.error(
              `Error: ${tok} requires a path value that does not start with '-' (got '${val ?? '(missing)'}')` +
                (val?.startsWith('-') ? ` — '${val}' looks like a swallowed flag, not a path` : ''),
            );
          } else {
            console.error(
              `Error: --profile requires a value: release | debug (got '${val ?? '(missing)'}')` +
                (val?.startsWith('-') ? ` — '${val}' looks like a swallowed flag, not a profile` : ''),
            );
          }
          process.exit(1);
        }
        present.add(tok);
        values.set(tok, val);
        i++;
        continue;
      }
      console.error(`Error: unknown option '${tok}'. See --help.`);
      process.exit(1);
    } else if (projectPath === undefined) {
      projectPath = tok;
    }
  }

  const validateOnly = present.has('--validate-only');
  const verbose = present.has('--verbose');
  const dryRun = present.has('--dry-run');
  const hasOut = present.has('--out');
  const hasImport = present.has('--import');
  const hasFromPack = present.has('--from-pack');

  if (hasImport && hasFromPack) {
    console.error('Error: --import and --from-pack are mutually exclusive');
    process.exit(1);
  }

  if (!projectPath && !hasImport && !hasFromPack) {
    console.error(
      `Error: Usage: world-forge-export <project.json> [options] — put the project path first; got '${leadingFlag ?? '(missing)'}'`,
    );
    process.exit(1);
  }

  if (projectPath && (hasImport || hasFromPack)) {
    console.error('Error: --import / --from-pack do not take a <project.json> argument');
    process.exit(1);
  }

  // AIR-FT-005: --dry-run is mutually exclusive with --out
  if (dryRun && hasOut) {
    console.error('Error: --dry-run and --out are mutually exclusive (dry-run never writes files)');
    process.exit(1);
  }

  // F-608e5fc5: --validate-only is the other no-write mode — same exclusivity.
  if (validateOnly && hasOut) {
    console.error(
      'Error: --validate-only and --out are mutually exclusive (validate-only never writes files)',
    );
    process.exit(1);
  }

  const outDir = hasOut ? values.get('--out')! : './export';

  const profileRaw = values.get('--profile') ?? 'release';
  if (profileRaw !== 'release' && profileRaw !== 'debug') {
    console.error(`Error: --profile must be 'release' or 'debug' (got '${profileRaw}')`);
    process.exit(1);
  }
  const profile: ExportProfile = profileRaw;

  // AIR-FT-005 / F-4ac43db0: schemaVersion emission.
  // Priority: --emit-schema-version (force on) > --no-emit-schema-version
  // (force off) > WORLD_FORGE_EMIT_SCHEMA_VERSION env (0/false/off disables)
  // > default on. The positive flag exists to override the env.
  const emitSchemaVersion = resolveEmitSchemaVersion(args);

  if (hasImport || hasFromPack) {
    const importPath = resolve((hasFromPack ? values.get('--from-pack') : values.get('--import'))!);
    await runImport({
      importPath,
      forcePackDir: hasFromPack,
      outDir: hasOut ? values.get('--out')! : undefined,
      hasOut,
      validateOnly,
      dryRun,
      verbose,
    });
    return;
  }

  // Read project file
  if (!projectPath) {
    console.error(
      `Error: Usage: world-forge-export <project.json> [options] — put the project path first; got '${leadingFlag ?? '(missing)'}'`,
    );
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
    // F-a7f30487: keep the parser's location text (position / unexpected token).
    const detail = err instanceof Error ? err.message : String(err);
    console.error(
      `Error: "${projectPath}" is not valid JSON — ${detail}. Fix the syntax at that location and re-run.`,
    );
    if (verbose && err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }

  // Export
  const result = exportToEngine(project, { profile, emitSchemaVersion });

  if (!result.success) {
    // F-3b0e3f5f: converter throws are not schema validation.
    const converter = isConverterFailure(result.errors);
    console.error(converter ? 'Export failed (converter):' : 'Validation failed:');
    for (const e of result.errors) {
      console.error(`  [${e.path}] ${e.message}`);
    }
    // F-f54a9f8b: --verbose must fire on the failure path, not only after a write.
    if (verbose) {
      console.error('\n--- Verbose Diagnostics ---');
      if (converter) {
        console.error('  This is a converter crash, not a project-schema error. Report this as a bug.');
      } else {
        console.error(`  Export did not succeed (${result.errors.length} error(s) listed above).`);
      }
      for (const e of result.errors) {
        console.error(`  [${e.path}] ${e.message}`);
      }
    }
    process.exit(1);
  }

  const exportResult = result; // narrowed to ExportResult

  if (validateOnly) {
    console.log('Validation passed.');
    printWarningsAndFidelity(exportResult);
    if (verbose) printVerboseSuccess(exportResult, profile, emitSchemaVersion);
    process.exit(0);
  }

  // AIR-FT-005: --dry-run — report sizes, never touch disk
  if (dryRun) {
    const files = collectExportFiles(exportResult);
    let totalBytes = 0;
    console.log('Dry run — no files written.');
    console.log(`  Profile: ${profile}`);
    console.log(`  Zones: ${exportResult.contentPack.zones.length}`);
    console.log(`  Entities: ${exportResult.contentPack.entities.length}`);
    console.log(`  Districts: ${exportResult.contentPack.districts.length}`);
    console.log(`  Items: ${exportResult.contentPack.items.length}`);
    console.log(`  Dialogues: ${exportResult.contentPack.dialogues.length}`);
    for (const f of files) {
      const n = Buffer.byteLength(f.json, 'utf-8');
      totalBytes += n;
      console.log(`  ${f.name.padEnd(22)} ${n} bytes`);
    }
    console.log(`  Total:             ${totalBytes} bytes`);
    printWarningsAndFidelity(exportResult);
    if (verbose) printVerboseSuccess(exportResult, profile, emitSchemaVersion);
    process.exit(0);
  }

  // Write output files
  const resolvedOut = resolve(outDir);
  await mkdir(resolvedOut, { recursive: true });

  const files = collectExportFiles(exportResult);
  for (const f of files) {
    await writeFile(join(resolvedOut, f.name), f.json);
  }

  console.log(`Exported to ${resolvedOut}/`);
  console.log(`  content-pack.json (${exportResult.contentPack.zones.length} zones, ${exportResult.contentPack.entities.length} entities)`);
  console.log(`  manifest.json`);
  console.log(`  pack-meta.json`);
  console.log(`  fidelity.json`);
  if (exportResult.assets && exportResult.assets.length > 0) console.log(`  assets.json`);
  if (exportResult.assetBindings) console.log(`  asset-bindings.json`);
  if (exportResult.assetPacks && exportResult.assetPacks.length > 0) console.log(`  asset-packs.json`);

  printWarningsAndFidelity(exportResult);

  // EB-013 / F-f54a9f8b: verbose diagnostics on the write path too.
  if (verbose) {
    printVerboseSuccess(exportResult, profile, emitSchemaVersion);
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
