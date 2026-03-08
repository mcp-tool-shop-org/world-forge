#!/usr/bin/env node
// cli.ts — world-forge export CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { exportToEngine } from './export.js';
import type { WorldProject } from '@world-forge/schema';

const USAGE = `Usage: world-forge-export <project.json> [options]

Options:
  --out <dir>        Output directory (default: ./export)
  --validate-only    Validate without writing files
  --help             Show this help`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  const projectPath = args[0];
  const validateOnly = args.includes('--validate-only');
  const outIdx = args.indexOf('--out');
  const outDir = outIdx !== -1 && args[outIdx + 1] ? args[outIdx + 1] : './export';

  // Read project file
  const raw = await readFile(resolve(projectPath), 'utf-8').catch(() => {
    console.error(`Error: cannot read "${projectPath}"`);
    process.exit(1);
  });

  let project: WorldProject;
  try {
    project = JSON.parse(raw) as WorldProject;
  } catch {
    console.error(`Error: "${projectPath}" is not valid JSON`);
    process.exit(1);
  }

  // Export
  const result = exportToEngine(project);

  if ('ok' in result) {
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
}

main();
