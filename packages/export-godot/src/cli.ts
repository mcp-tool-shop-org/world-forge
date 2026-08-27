#!/usr/bin/env node
// cli.ts — world-forge-export-godot CLI

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { exportToGodot, GODOT_PACK_FORMAT_VERSION } from './export.js';
import type { WorldProject } from '@world-forge/schema';

export const USAGE = `Usage: world-forge-export-godot <project.json> [options]

Export a WorldProject to a Godot 4 content pack (.tscn + .tres files).

Options:
  --out <dir>              Output directory (default: ./GodotPack).
                           <dir> must be a path and must not start with '-'
  --validate-only          Validate without writing files
  --verbose                Show detailed export diagnostics (includes err.stack on failure)
  --include-world-tscn     Emit world.tscn (default)
  --no-world-tscn          Skip .tscn generation (JSON pack + files/ only)
  --help                   Show this help

Exit codes:
  0  success (or --validate-only passed)
  1  any error (bad args, unreadable input, invalid JSON, GodotExportError, write failure)

Pack format version: ${GODOT_PACK_FORMAT_VERSION}
  ${GODOT_PACK_FORMAT_VERSION} added \`files\` (resourcePath → .tres body) and \`zoneGates\`
  on the JSON pack so a data-driven loader does not need to parse the .tscn.
  Additional pack fields may be added in minor versions. Loaders should gate on
  pack format version, not a frozen field list.

Produces (under --out):
  pack.json       — GodotContentPack JSON (meta, zones, zoneGates, files, …)
  world.tscn      — playable Godot 4 scene (omit with --no-world-tscn)
  files/          — .tres bodies keyed by resourcePath (res:// prefix stripped)
  fidelity.json   — lossless / approximated / dropped report

See also: world-forge-export-unreal (Unreal Engine 5 2.5D).`;

export interface CliIo {
    log: (line: string) => void;
    error: (line: string) => void;
    stderrWrite: (line: string) => void;
}

const defaultIo: CliIo = {
    log: (line) => console.log(line),
    error: (line) => console.error(line),
    stderrWrite: (line) => process.stderr.write(line),
};

/** Convert a `res://...` resourcePath into a files/-relative path; reject `..`. */
function resourcePathToRel(resourcePath: string): string {
    const stripped = resourcePath.replace(/^res:\/\//, '');
    const parts = stripped.split(/[/\\]/).filter((p) => p.length > 0 && p !== '.' && p !== '..');
    return parts.join('/');
}

function invokedAsCli(): boolean {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return import.meta.url === pathToFileURL(resolve(entry)).href;
    } catch {
        return false;
    }
}

export async function runGodotCli(args: string[], io: CliIo = defaultIo): Promise<number> {
    if (args.includes('--help') || args.length === 0) {
        io.log(USAGE);
        return 0;
    }

    const validateOnly = args.includes('--validate-only');
    const verbose = args.includes('--verbose');

    let includeWorldTscn = true;
    for (const a of args) {
        if (a === '--no-world-tscn') includeWorldTscn = false;
        if (a === '--include-world-tscn') includeWorldTscn = true;
    }

    const outIdx = args.indexOf('--out');
    if (outIdx !== -1) {
        const outVal = args[outIdx + 1];
        if (!outVal || outVal.startsWith('-')) {
            io.error(
                `Error: --out requires a path value that does not start with '-' (got '${outVal ?? '(missing)'}')` +
                    (outVal?.startsWith('-')
                        ? ` — '${outVal}' looks like a swallowed flag, not a directory`
                        : ' (e.g., --out ./GodotPack)'),
            );
            return 1;
        }
    }
    const outDir = outIdx !== -1 ? args[outIdx + 1] : './GodotPack';

    const projectPath = args[0];
    if (!projectPath || projectPath.startsWith('-')) {
        io.error(`Error: expected a project.json path as the first argument (got '${projectPath ?? '(missing)'}')`);
        io.error('Hint: world-forge-export-godot <project.json> [--out ./GodotPack]');
        return 1;
    }

    let raw: string;
    try {
        raw = await readFile(resolve(projectPath), 'utf-8');
    } catch (err) {
        io.error(`Error: cannot read "${projectPath}": ${(err as Error).message}`);
        io.error('Hint: pass a readable WorldProject JSON path as the first argument.');
        return 1;
    }

    let project: WorldProject;
    try {
        project = JSON.parse(raw) as WorldProject;
    } catch {
        io.error(`Error: "${projectPath}" is not valid JSON`);
        io.error('Hint: the input must be a WorldProject JSON document.');
        return 1;
    }

    const result = exportToGodot(project, { includeWorldTscn });

    if (!result.success) {
        io.error('Godot export failed:');
        for (const e of result.errors) {
            io.error(`  [${e.path}] ${e.message}`);
        }
        io.error(
            'Hint: fix the listed validation/converter errors in the source project, then re-run. Use --validate-only to check without writing.',
        );
        return 1;
    }

    if (validateOnly) {
        io.log('Validation passed.');
        for (const w of result.warnings) io.log(`  - ${w}`);
        io.log(
            `Fidelity: ${result.fidelity.summary.losslessPercent}% lossless (${result.fidelity.summary.total} entries); incomplete=${result.fidelity.summary.incomplete}`,
        );
        return 0;
    }

    const resolvedOut = resolve(outDir);
    const packForJson = { ...result.contentPack, worldSceneTscn: '' };

    try {
        await mkdir(resolvedOut, { recursive: true });
        io.stderrWrite(
            `Converting Godot pack: ${result.contentPack.zones.length} zones, ${Object.keys(result.contentPack.files).length} files — writing to disk...\n`,
        );
        await writeFile(join(resolvedOut, 'pack.json'), JSON.stringify(packForJson, null, 2));
        await writeFile(join(resolvedOut, 'fidelity.json'), JSON.stringify(result.fidelity, null, 2));
        if (includeWorldTscn && result.contentPack.worldSceneTscn) {
            await writeFile(join(resolvedOut, 'world.tscn'), result.contentPack.worldSceneTscn);
        }

        const filesDir = join(resolvedOut, 'files');
        await mkdir(filesDir, { recursive: true });
        for (const [resourcePath, body] of Object.entries(result.contentPack.files)) {
            const rel = resourcePathToRel(resourcePath);
            if (!rel) {
                io.error(`Error: cannot write file for resourcePath "${resourcePath}": empty relative path`);
                io.error(`Hint: check disk space, directory permissions on ${resolvedOut}, and retry with --out pointing at a writable path.`);
                return 1;
            }
            const dest = join(filesDir, rel);
            await mkdir(dirname(dest), { recursive: true });
            await writeFile(dest, body);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        io.error(`Error: cannot write Godot pack under "${resolvedOut}": ${message}`);
        io.error(`Hint: check disk space, directory permissions on ${resolvedOut}, and retry with --out pointing at a writable path.`);
        return 1;
    }

    io.log(`Exported to ${resolvedOut}/`);
    io.log(
        `  ${result.contentPack.zones.length} zones, ${result.contentPack.dialogues.length} dialogues, ${Object.keys(result.contentPack.files).length} files, ${result.contentPack.zoneGates.length} zoneGates`,
    );
    io.log(
        `  Fidelity: ${result.fidelity.summary.losslessPercent}% lossless (${result.fidelity.summary.total} entries); incomplete=${result.fidelity.summary.incomplete}`,
    );
    for (const w of result.warnings) io.log(`  - ${w}`);

    if (verbose) {
        io.log('\n--- Fidelity entries ---');
        for (const e of result.fidelity.entries) {
            io.log(`  [${e.level}/${e.severity}] ${e.domain}: ${e.message}`);
        }
    }

    return 0;
}

if (invokedAsCli()) {
    runGodotCli(process.argv.slice(2)).then((code) => process.exit(code)).catch((err: Error) => {
        console.error(`Fatal: ${err.message}`);
        if (process.argv.includes('--verbose') && err.stack) {
            console.error(err.stack);
        }
        process.exit(1);
    });
}
