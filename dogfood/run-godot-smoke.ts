/**
 * run-godot-smoke.ts — Godot Engine Smoke Test Runner
 *
 * Proves: generated .tscn is consumable by Godot 4 headlessly.
 *
 * Steps:
 *   1. Export proof world → Godot content pack + .tscn
 *   2. Copy generated world.tscn into dogfood/godot-smoke/ project
 *   3. Run Godot 4 headless with smoke_load_world.gd
 *   4. Parse structured output, assert all checks pass
 *   5. Write receipt
 *
 * Usage:
 *   GODOT_BIN="path/to/godot" npx tsx dogfood/run-godot-smoke.ts
 *
 * Environment:
 *   GODOT_BIN — Path to Godot 4 executable (required)
 */

import { writeFileSync, copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

import { exportToGodot } from '../packages/export-godot/src/index.js';
import { SCHEMA_VERSION } from '../packages/schema/src/index.js';
import { proofProject } from './worlds/multi-target-proof.js';
import {
    parseSmokeOutput,
    findResourceWarnings,
    computeOverallPass,
    deriveSmokeVerdict,
    assertKvAgainstProof,
} from './godot-smoke-verdict.js';

// ── Path resolution ──────────────────────────────────────────
const __dirname = typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : dirname(fileURLToPath(import.meta.url));

const smokeDir = resolve(__dirname, 'godot-smoke');
const outDir = resolve(__dirname, 'output', 'godot-smoke');

// ── Godot binary resolution ──────────────────────────────────
//
// `where` (step 3/4 below) is a Windows-only shell command (cmd.exe /
// System32) — it does not exist on Linux or macOS. On any POSIX box, both
// `execSync('where ...')` calls throw immediately and get silently swallowed
// by the surrounding catch, so PATH-lookup was previously dead code on every
// non-Windows machine (F-003 / F-7c6f2616). `which` is the POSIX equivalent,
// so the lookup command itself is now chosen per-platform. The hardcoded
// candidate list (step 2) was Windows-only too — it now branches per-platform
// and covers common Linux/macOS install locations as well, so PATH-lookup
// isn't the ONLY cross-platform path left uncovered by a fixed candidate.
const isWindows = process.platform === 'win32';
const PATH_LOOKUP_CMD = isWindows ? 'where' : 'which';

function findGodot(): string | null {
    // 1. Environment variable (highest priority). F-6551ab6c: a set-but-missing
    // GODOT_BIN must not fall through to PATH/candidates — the caller exits 2.
    if (process.env.GODOT_BIN) {
        return existsSync(process.env.GODOT_BIN) ? process.env.GODOT_BIN : null;
    }

    // 2. Common install paths, per platform
    const candidates = isWindows
        ? [
            'C:\\Program Files\\Godot\\Godot_v4.4-stable_win64.exe',
            'C:\\Program Files\\Godot\\godot.exe',
            'C:\\Godot\\godot.exe',
            resolve(process.env.LOCALAPPDATA ?? '', 'Programs', 'Godot', 'godot.exe'),
            resolve(process.env.USERPROFILE ?? '', 'scoop', 'apps', 'godot', 'current', 'godot.exe'),
        ]
        : [
            '/usr/local/bin/godot4',
            '/usr/local/bin/godot',
            '/usr/bin/godot4',
            '/usr/bin/godot',
            '/snap/bin/godot4',
            '/snap/bin/godot',
            '/opt/godot/godot',
            resolve(process.env.HOME ?? '', '.local', 'bin', 'godot4'),
            resolve(process.env.HOME ?? '', 'Applications', 'Godot.app', 'Contents', 'MacOS', 'Godot'),
            '/Applications/Godot.app/Contents/MacOS/Godot',
        ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    // 3. Try `godot` on PATH (where/which per-platform, see above)
    const onPath = lookupOnPath('godot') ?? lookupOnPath('godot4');
    if (onPath) return onPath;

    return null;
}

// ── Main ─────────────────────────────────────────────────────
console.log('═══ GODOT ENGINE SMOKE TEST ═══\n');

// Step 1: Export
console.log('── 1. Export proof world to Godot ──');
const result = exportToGodot(proofProject);
if (!result.success) {
    console.error('  ✗ Export failed:', result.errors);
    process.exit(1);
}
console.log('  ✓ Export succeeded');
console.log(`    Zones: ${result.contentPack.zones.length}`);
console.log(`    Entities: ${result.contentPack.entities.all.length}`);
console.log(`    Scene lines: ${result.contentPack.worldSceneTscn.split('\n').length}`);

// Step 2: Copy .tscn into smoke project
console.log('\n── 2. Deploy scene to smoke project ──');
const sceneTarget = resolve(smokeDir, 'world.tscn');
writeFileSync(sceneTarget, result.contentPack.worldSceneTscn, 'utf-8');
console.log(`  ✓ Copied world.tscn → ${sceneTarget}`);

// Step 3: Find and run Godot
console.log('\n── 3. Run Godot 4 headless ──');

function writeSkipReceipt(verdict: string): void {
    mkdirSync(outDir, { recursive: true });
    const partialReceipt = buildReceipt(null, verdict);
    const receiptPath = resolve(outDir, `DOGFOOD_GODOT_ENGINE_SMOKE_${today()}.md`);
    writeFileSync(receiptPath, partialReceipt, 'utf-8');
    console.log(`\n  Partial receipt: ${receiptPath}`);
}

// F-66a22d53: FORCE-fail skips the binary so the exit-code gate is testable
// without a Godot install. Never set during a normal run.
if (process.env.WORLD_FORGE_FORCE_GODOT_FAIL === '1') {
    console.log('  ✗ Test-injected failure (WORLD_FORGE_FORCE_GODOT_FAIL)');
    mkdirSync(outDir, { recursive: true });
    const receipt = buildReceipt({
        godotBin: '(forced fail — Godot not invoked)',
        godotVersion: 'n/a',
        godotCmd: 'WORLD_FORGE_FORCE_GODOT_FAIL=1',
        godotExitCode: 1,
        godotOutput: '',
        passes: [],
        fails: ['Test-injected failure (WORLD_FORGE_FORCE_GODOT_FAIL)'],
        kvPairs: {},
        smokeVerdict: 'FAIL',
    }, 'FAIL');
    const receiptPath = resolve(outDir, `DOGFOOD_GODOT_ENGINE_SMOKE_${today()}.md`);
    writeFileSync(receiptPath, receipt, 'utf-8');
    console.log(`\nReceipt: ${receiptPath}`);
    process.exit(1);
}

// F-6551ab6c: a pinned GODOT_BIN that does not exist is an operator error,
// not a cue to silently run some other binary from PATH/candidates.
if (process.env.GODOT_BIN && !existsSync(process.env.GODOT_BIN)) {
    console.error(`  ✗ GODOT_BIN is set to "${process.env.GODOT_BIN}" but that path does not exist.`);
    console.error('    Refusing to search PATH/candidates — the pinned binary is missing.');
    writeSkipReceipt('SKIP — GODOT_BIN set but missing');
    process.exit(2);
}

const godotBin = findGodot();
if (!godotBin) {
    console.error('  ✗ Godot 4 not found.');
    console.error('    Set GODOT_BIN environment variable to your Godot 4 executable path.');
    console.error('    Example: GODOT_BIN="C:\\path\\to\\Godot_v4.4-stable_win64.exe"');
    console.error('\n  Skipping engine execution — structural export is validated by multi-target proof.');
    console.error('  To complete engine smoke, install Godot 4 and re-run with GODOT_BIN set.');

    writeSkipReceipt('SKIP — Godot binary not found');
    process.exit(2); // Exit 2 = skipped (not failure)
}

console.log(`  Binary: ${godotBin}`);

// Get Godot version — spawnSync argv, never a shell-concatenated string.
const versionRun = captureSpawn(godotBin, ['--version'], { timeout: 10_000 });
const godotVersion = versionRun.output.trim() || 'unknown';
console.log(`  Version: ${godotVersion}`);

// Run headless with smoke script. Capture stdout+stderr on every run
// (F-9830ed99): execSync on exit 0 returned stdout only, so engine
// warnings on stderr ('Failed loading resource', 'SCRIPT ERROR') never
// reached findResourceWarnings() on the green path.
const godotArgs = ['--headless', '--path', smokeDir, '--script', 'res://smoke_load_world.gd'];
const godotCmd = [godotBin, ...godotArgs].join(' ');
console.log(`  Command: ${godotCmd}`);

const godotRun = captureSpawn(godotBin, godotArgs, { timeout: 30_000, cwd: smokeDir });
const godotOutput = godotRun.output;
const godotExitCode = godotRun.status;

console.log(`  Exit code: ${godotExitCode}`);

// Step 4: Parse output
console.log('\n── 4. Parse smoke results ──');
const { passes, fails, kvPairs } = parseSmokeOutput(godotOutput);

console.log(`  Assertions passed: ${passes.length}`);
console.log(`  Assertions failed: ${fails.length}`);
for (const p of passes) console.log(`    ✓ ${p}`);
for (const f of fails) console.log(`    ✗ ${f}`);

if (kvPairs.zone_count) console.log(`  Zone count: ${kvPairs.zone_count}`);
if (kvPairs.entity_count) console.log(`  Entity count: ${kvPairs.entity_count}`);
if (kvPairs.item_count) console.log(`  Item count: ${kvPairs.item_count}`);
if (kvPairs.nav_link_count) console.log(`  Nav links: ${kvPairs.nav_link_count}`);
if (kvPairs.zone_ids) console.log(`  Zone IDs: ${kvPairs.zone_ids}`);

// F-a6ef9bdd: GDScript EXPECTED_* constants are the in-engine check, not the
// only check. Compare printed counts + zone_ids against proofProject.
const kvFailStart = fails.length;
assertKvAgainstProof(
    kvPairs,
    {
        zoneCount: proofProject.zones.length,
        entityCount: proofProject.entityPlacements.length,
        itemCount: proofProject.itemPlacements.length,
        spawnPointCount: proofProject.spawnPoints.length,
        transitionCount: (proofProject.transitions ?? []).length,
        navLinkCount: proofProject.connections.length,
        zoneIds: proofProject.zones.map((z) => z.id),
    },
    fails,
);
const kvFails = fails.slice(kvFailStart);
if (kvFails.length > 0) {
    console.log(`  Proof-world mismatches: ${kvFails.length}`);
    for (const f of kvFails) console.log(`    ✗ ${f}`);
}

// Check for missing resource / script errors in Godot output
const resourceWarnings = findResourceWarnings(godotOutput);
if (resourceWarnings.length > 0) {
    console.log(`\n  ✗ Missing resource/script warnings detected (${resourceWarnings.length}):`);
    for (const w of resourceWarnings) console.log(`    ${w}`);
    fails.push(`missing_resources: ${resourceWarnings.length} resource warnings`);
}

// Step 5: Determine verdict
//
// F-004 fix: `fails` (parsed above from individual
// `FAIL: ` lines) now GATES the verdict via computeOverallPass, instead of
// being parsed and printed but never actually consulted. See
// dogfood/godot-smoke-verdict.ts for the full rationale and
// dogfood/__tests__/godot-smoke-verdict.test.ts for the regression test that
// proves a smoke_verdict=PASS report with a live FAIL: line is still caught.
const smokeVerdict = deriveSmokeVerdict(kvPairs, godotExitCode);
const overallPass = computeOverallPass({ smokeVerdict, godotExitCode, resourceWarnings, fails, passes });

console.log(`\n═══ VERDICT: ${overallPass ? 'PASS' : 'FAIL'} ═══`);
if (!overallPass) {
    console.log('  Engine could not consume generated scene.');
    if (godotOutput) {
        console.log('\n  Raw Godot output:');
        for (const line of godotOutput.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 40)) console.log(`    ${line}`);
    }
}

// Step 6: Write receipt
mkdirSync(outDir, { recursive: true });
const receipt = buildReceipt({
    godotBin,
    godotVersion,
    godotCmd,
    godotExitCode,
    godotOutput,
    passes,
    fails,
    kvPairs,
    smokeVerdict,
}, overallPass ? 'PASS' : 'FAIL');

const receiptPath = resolve(outDir, `DOGFOOD_GODOT_ENGINE_SMOKE_${today()}.md`);
writeFileSync(receiptPath, receipt, 'utf-8');
console.log(`\nReceipt: ${receiptPath}`);

process.exit(overallPass ? 0 : 1);

// ── Helpers ──────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/**
 * Spawn a process without a shell and always concatenate stdout+stderr.
 * F-9830ed99: execSync returns stdout only on exit 0; resource warnings
 * that Godot prints on stderr were therefore invisible on the green path.
 */
function captureSpawn(
    command: string,
    args: string[],
    opts: { timeout: number; cwd?: string },
): { status: number; output: string } {
    const result = spawnSync(command, args, {
        encoding: 'utf-8',
        timeout: opts.timeout,
        cwd: opts.cwd,
        windowsHide: true,
    });
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    let output = `${stdout}${stderr}`;
    if (result.error) output = `${output}\n${result.error.message}`.trim();
    return { status: result.status ?? 1, output };
}

function lookupOnPath(binName: string): string | null {
    const result = spawnSync(PATH_LOOKUP_CMD, [binName], {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
    });
    const out = (result.stdout ?? '').trim();
    if (result.status === 0 && out) return out.split(/\r?\n/)[0].trim();
    return null;
}

interface SmokeResults {
    godotBin: string;
    godotVersion: string;
    godotCmd: string;
    godotExitCode: number;
    godotOutput: string;
    passes: string[];
    fails: string[];
    kvPairs: Record<string, string>;
    smokeVerdict: string;
}

function buildReceipt(results: SmokeResults | null, verdict: string): string {
    const ts = new Date().toISOString();

    if (!results) {
        return `# Godot Engine Smoke — ${verdict}

**Date:** ${ts}
**Proof world:** Dustwalk — Multi-Target Proof (proof-dustwalk)
**Schema:** ${SCHEMA_VERSION}

## Status

${verdict}

Godot 4 binary not found on this machine. Set \`GODOT_BIN\` and re-run.

## What was validated

- ✓ World Forge exports valid .tscn (structural proof from multi-target-export-proof)
- ⬜ Godot engine scene load (pending binary)
- ⬜ Scene tree node count assertions (pending binary)
- ⬜ Metadata preservation in engine (pending binary)
`;
    }

    return `# Godot Engine Smoke — ${verdict}

**Date:** ${ts}
**Proof world:** Dustwalk — Multi-Target Proof (proof-dustwalk)
**Schema:** ${SCHEMA_VERSION}
**Godot:** ${results.godotVersion}
**Binary:** ${results.godotBin}

## Command

\`\`\`
${results.godotCmd}
\`\`\`

Exit code: ${results.godotExitCode}

## Assertions (${results.passes.length} passed, ${results.fails.length} failed)

${results.passes.map(p => `- ✓ ${p}`).join('\n')}
${results.fails.map(f => `- ✗ ${f}`).join('\n')}

## Counts

| Metric | Value |
|--------|-------|
| Zones | ${results.kvPairs.zone_count ?? '?'} |
| Entities | ${results.kvPairs.entity_count ?? '?'} |
| Items | ${results.kvPairs.item_count ?? '?'} |
| Spawn Points | ${results.kvPairs.spawn_point_count ?? '?'} |
| Transitions | ${results.kvPairs.transition_count ?? '?'} |
| Nav Links | ${results.kvPairs.nav_link_count ?? '?'} |
| Zone IDs | ${results.kvPairs.zone_ids ?? '?'} |
| Entities with metadata | ${results.kvPairs.entities_with_metadata ?? '?'} |

## Verdict

**${verdict}**

${verdict === 'PASS'
            ? 'Generated .tscn is consumable by Godot 4 headlessly. Scene tree identity is preserved.'
            : 'Engine could not consume generated scene. See raw output below.'}

${verdict !== 'PASS' ? `## Raw Output\n\n\`\`\`\n${results.godotOutput.slice(0, 3000)}\n\`\`\`` : ''}
`;
}
