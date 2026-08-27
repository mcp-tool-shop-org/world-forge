/**
 * cli.test.ts — world-forge-export-godot operator CLI (F-1a660063).
 *
 * Imports runGodotCli from the TypeScript source so the suite does not depend
 * on a pre-built dist/cli.js (verify still compiles the bin for npx).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, rm, mkdtemp, access, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runGodotCli, USAGE } from '../cli.js';
import { GODOT_PACK_FORMAT_VERSION } from '../export.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { invalidOrphanProject } from '../../../schema/src/__tests__/fixtures/invalid-orphan.js';

function capture() {
    const stdout: string[] = [];
    const stderr: string[] = [];
    return {
        stdout,
        stderr,
        io: {
            log: (line: string) => stdout.push(line),
            error: (line: string) => stderr.push(line),
            stderrWrite: (line: string) => stderr.push(line),
        },
    };
}

let tmpDir: string;
let validJsonPath: string;
let invalidJsonPath: string;
let badJsonPath: string;

beforeAll(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'wf-godot-cli-'));
    validJsonPath = join(tmpDir, 'valid.json');
    invalidJsonPath = join(tmpDir, 'invalid.json');
    badJsonPath = join(tmpDir, 'bad.json');
    await writeFile(validJsonPath, JSON.stringify(minimalProject, null, 2));
    await writeFile(invalidJsonPath, JSON.stringify(invalidOrphanProject, null, 2));
    await writeFile(badJsonPath, 'not json at all {{{');
});

afterAll(async () => {
    await rm(tmpDir, { recursive: true, force: true });
});

describe('CLI: world-forge-export-godot', () => {
    it('shows help with --help and exits 0 (format version 1.1.0, files/zoneGates)', async () => {
        const cap = capture();
        const code = await runGodotCli(['--help'], cap.io);
        expect(code).toBe(0);
        const out = cap.stdout.join('\n');
        expect(out).toContain('Usage: world-forge-export-godot');
        expect(out).toContain('--validate-only');
        expect(out).toContain('--out');
        expect(out).toContain('--include-world-tscn');
        expect(out).toContain('--no-world-tscn');
        expect(out).toContain(GODOT_PACK_FORMAT_VERSION);
        expect(out).toContain('1.1.0');
        expect(out).toContain('files');
        expect(out).toContain('zoneGates');
        expect(USAGE).toContain('files');
        expect(USAGE).toContain('zoneGates');
    });

    it('shows help with no args and exits 0', async () => {
        const cap = capture();
        const code = await runGodotCli([], cap.io);
        expect(code).toBe(0);
        expect(cap.stdout.join('\n')).toContain('Usage: world-forge-export-godot');
    });

    it('rejects swallowed --out (following token starts with -) with exit 1', async () => {
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--out', '--validate-only'], cap.io);
        expect(code).toBe(1);
        const err = cap.stderr.join('\n');
        expect(err).toContain('--out requires a path');
        expect(err).toMatch(/swallowed flag/);
        let existed = true;
        try {
            await access(join(tmpDir, '--validate-only'));
        } catch {
            existed = false;
        }
        expect(existed).toBe(false);
    });

    it('rejects --out with no value with exit 1', async () => {
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--out'], cap.io);
        expect(code).toBe(1);
        expect(cap.stderr.join('\n')).toContain('--out requires a path');
    });

    it('validation-failure exits 1 with path + message + a fix hint', async () => {
        const cap = capture();
        const code = await runGodotCli([invalidJsonPath], cap.io);
        expect(code).toBe(1);
        const err = cap.stderr.join('\n');
        expect(err).toMatch(/Godot export failed|Validation failed/);
        expect(err).toMatch(/\[.+\] .+/);
        expect(err.toLowerCase()).toContain('hint');
    });

    it('--validate-only on a valid project exits 0 and does not write files', async () => {
        const outDir = join(tmpDir, 'validate-only-out');
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--validate-only', '--out', outDir], cap.io);
        expect(code).toBe(0);
        expect(cap.stdout.join('\n')).toContain('Validation passed');
        let exists = true;
        try {
            await access(outDir);
        } catch {
            exists = false;
        }
        expect(exists).toBe(false);
    });

    it('--out is a loadable Godot 4 project (project.godot + res://-stripped .tres) (F-cd4f3071)', async () => {
        const outDir = join(tmpDir, 'godot-project-out');
        const cap = capture();
        const code = await runGodotCli([validJsonPath, '--out', outDir], cap.io);
        expect(code).toBe(0);
        const godot = await readFile(join(outDir, 'project.godot'), 'utf-8');
        expect(godot).toContain('config_version=5');
        expect(godot).toContain('PackedStringArray("4.x")');
        expect(godot).toContain('run/main_scene="res://world.tscn"');
        expect(godot).toContain('[input]');
        expect(godot).toContain('ui_left=');
        expect(godot).toContain('ui_right=');
        expect(godot).toContain('ui_up=');
        expect(godot).toContain('ui_down=');
        await access(join(outDir, 'world.tscn'));
        await access(join(outDir, 'world_data', 'zones', 'zone-entrance.tres'));
        await access(join(outDir, 'world_data', 'items', 'item-torch.tres'));
        await access(join(outDir, 'scripts', 'player.gd'));
        const tscn = await readFile(join(outDir, 'world.tscn'), 'utf-8');
        expect(tscn).toContain('[node name="Player" type="CharacterBody2D" parent="."]');
        expect(tscn).toContain('[ext_resource type="Resource" path="res://world_data/items/item-torch.tres"');
        let filesSidecar = true;
        try {
            await access(join(outDir, 'files', 'world_data'));
        } catch {
            filesSidecar = false;
        }
        expect(filesSidecar).toBe(false);
    });

    it('copies an image-backed tileset atlas into --out at the Texture2D ExtResource path (F-fd38903f)', async () => {
        const png = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64',
        );
        const fixtureDir = join(tmpDir, 'img-fixture');
        const outDir = join(tmpDir, 'img-out');
        await mkdir(fixtureDir, { recursive: true });
        await writeFile(join(fixtureDir, 'town.png'), png);
        const project = {
            ...minimalProject,
            tilesets: [{
                id: 'town',
                name: 'Town',
                tileWidth: 32,
                tileHeight: 32,
                imagePath: 'town.png',
                tiles: [
                    { id: 'floor', tilesetId: 'town', row: 0, col: 0, tags: ['floor'], walkable: true, opacity: 1 },
                ],
            }],
            tileLayers: [{
                id: 'ground',
                name: 'Ground',
                zIndex: 0,
                tiles: [{ tileId: 'floor', gridX: 0, gridY: 0 }],
            }],
        };
        const jsonPath = join(fixtureDir, 'world.json');
        await writeFile(jsonPath, JSON.stringify(project));
        const cap = capture();
        const code = await runGodotCli([jsonPath, '--out', outDir], cap.io);
        expect(code).toBe(0);
        await access(join(outDir, 'assets', 'tilesets', 'town.png'));
        const copied = await readFile(join(outDir, 'assets', 'tilesets', 'town.png'));
        expect(copied.equals(png)).toBe(true);
        const tscn = await readFile(join(outDir, 'world.tscn'), 'utf-8');
        expect(tscn).toContain('[ext_resource type="Texture2D" path="res://assets/tilesets/town.png"');
    });

    it('fidelity-warns when an asset path is a URI and does not copy it (F-fd38903f)', async () => {
        const outDir = join(tmpDir, 'uri-out');
        const project = {
            ...minimalProject,
            assets: [{
                id: 'remote-sprite',
                kind: 'sprite',
                label: 'Remote',
                path: 'https://example.com/hero.png',
                tags: [],
            }],
            // Referenced so validateProject does not reject the asset as orphaned.
            entityPlacements: minimalProject.entityPlacements.map((ep, i) =>
                i === 0 ? { ...ep, spriteId: 'remote-sprite' } : ep,
            ),
        };
        const jsonPath = join(tmpDir, 'uri-world.json');
        await writeFile(jsonPath, JSON.stringify(project));
        const cap = capture();
        const code = await runGodotCli([jsonPath, '--out', outDir], cap.io);
        expect(code).toBe(0);
        const fidelity = JSON.parse(await readFile(join(outDir, 'fidelity.json'), 'utf-8')) as {
            entries: Array<{ message: string; fieldPath?: string }>;
        };
        expect(fidelity.entries.some((e) => e.message.includes('URI') && e.fieldPath === 'assets.remote-sprite.path')).toBe(true);
        let copied = true;
        try {
            await access(join(outDir, 'assets', 'sprites', 'hero.png'));
        } catch {
            copied = false;
        }
        expect(copied).toBe(false);
    });
});
