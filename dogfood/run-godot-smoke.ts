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
import { execSync } from 'node:child_process';

import { exportToGodot } from '../packages/export-godot/src/index.js';
import { proofProject } from './worlds/multi-target-proof.js';

// ── Path resolution ──────────────────────────────────────────
const __dirname = typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : dirname(fileURLToPath(import.meta.url));

const smokeDir = resolve(__dirname, 'godot-smoke');
const outDir = resolve(__dirname, 'output', 'godot-smoke');

// ── Godot binary resolution ──────────────────────────────────
function findGodot(): string | null {
    // 1. Environment variable (highest priority)
    if (process.env.GODOT_BIN && existsSync(process.env.GODOT_BIN)) {
        return process.env.GODOT_BIN;
    }

    // 2. Common Windows paths
    const candidates = [
        'C:\\Program Files\\Godot\\Godot_v4.4-stable_win64.exe',
        'C:\\Program Files\\Godot\\godot.exe',
        'C:\\Godot\\godot.exe',
        resolve(process.env.LOCALAPPDATA ?? '', 'Programs', 'Godot', 'godot.exe'),
        resolve(process.env.USERPROFILE ?? '', 'scoop', 'apps', 'godot', 'current', 'godot.exe'),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) return candidate;
    }

    // 3. Try `godot` on PATH
    try {
        const result = execSync('where godot', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (result) return result.split('\n')[0].trim();
    } catch { /* not on PATH */ }

    // 4. Try `godot4` on PATH (some installs)
    try {
        const result = execSync('where godot4', { encoding: 'utf-8', timeout: 5000 }).trim();
        if (result) return result.split('\n')[0].trim();
    } catch { /* not on PATH */ }

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
const godotBin = findGodot();
if (!godotBin) {
    console.error('  ✗ Godot 4 not found.');
    console.error('    Set GODOT_BIN environment variable to your Godot 4 executable path.');
    console.error('    Example: GODOT_BIN="C:\\path\\to\\Godot_v4.4-stable_win64.exe"');
    console.error('\n  Skipping engine execution — structural export is validated by multi-target proof.');
    console.error('  To complete engine smoke, install Godot 4 and re-run with GODOT_BIN set.');

    // Write partial receipt
    mkdirSync(outDir, { recursive: true });
    const partialReceipt = buildReceipt(null, 'SKIP — Godot binary not found');
    const receiptPath = resolve(outDir, `DOGFOOD_GODOT_ENGINE_SMOKE_${today()}.md`);
    writeFileSync(receiptPath, partialReceipt, 'utf-8');
    console.log(`\n  Partial receipt: ${receiptPath}`);
    process.exit(2); // Exit 2 = skipped (not failure)
}

console.log(`  Binary: ${godotBin}`);

// Get Godot version
let godotVersion = 'unknown';
try {
    godotVersion = execSync(`"${godotBin}" --version`, { encoding: 'utf-8', timeout: 10000 }).trim();
    console.log(`  Version: ${godotVersion}`);
} catch {
    console.log('  Version: could not determine');
}

// Run headless with smoke script
let godotOutput = '';
let godotExitCode = -1;
const godotCmd = `"${godotBin}" --headless --path "${smokeDir}" --script res://smoke_load_world.gd`;
console.log(`  Command: ${godotCmd}`);

try {
    godotOutput = execSync(godotCmd, {
        encoding: 'utf-8',
        timeout: 30000,
        cwd: smokeDir,
    });
    godotExitCode = 0;
} catch (err: unknown) {
    const execErr = err as { status?: number; stdout?: string; stderr?: string };
    godotExitCode = execErr.status ?? 1;
    godotOutput = (execErr.stdout ?? '') + (execErr.stderr ?? '');
}

console.log(`  Exit code: ${godotExitCode}`);

// Step 4: Parse output
console.log('\n── 4. Parse smoke results ──');
const lines = godotOutput.split('\n').map(l => l.trim()).filter(Boolean);

const kvPairs: Record<string, string> = {};
const passes: string[] = [];
const fails: string[] = [];

for (const line of lines) {
    if (line.startsWith('PASS: ')) passes.push(line.slice(6));
    else if (line.startsWith('FAIL: ')) fails.push(line.slice(6));
    else if (line.includes('=') && !line.startsWith('[') && !line.startsWith('  ')) {
        const [key, ...rest] = line.split('=');
        kvPairs[key] = rest.join('=');
    }
}

console.log(`  Assertions passed: ${passes.length}`);
console.log(`  Assertions failed: ${fails.length}`);
for (const p of passes) console.log(`    ✓ ${p}`);
for (const f of fails) console.log(`    ✗ ${f}`);

if (kvPairs.zone_count) console.log(`  Zone count: ${kvPairs.zone_count}`);
if (kvPairs.entity_count) console.log(`  Entity count: ${kvPairs.entity_count}`);
if (kvPairs.item_count) console.log(`  Item count: ${kvPairs.item_count}`);
if (kvPairs.nav_link_count) console.log(`  Nav links: ${kvPairs.nav_link_count}`);
if (kvPairs.zone_ids) console.log(`  Zone IDs: ${kvPairs.zone_ids}`);

// Check for missing resource / script errors in Godot output
const resourceWarnings = lines.filter(l =>
    l.includes('Failed loading resource') ||
    l.includes('Cannot load source code') ||
    l.includes('res://') && l.includes('not found') ||
    l.includes('SCRIPT ERROR') ||
    l.includes('Cannot open file') ||
    l.match(/ERROR.*load/i)
);
if (resourceWarnings.length > 0) {
    console.log(`\n  ✗ Missing resource/script warnings detected (${resourceWarnings.length}):`);
    for (const w of resourceWarnings) console.log(`    ${w}`);
    fails.push(`missing_resources: ${resourceWarnings.length} resource warnings`);
}

// Step 5: Determine verdict
const smokeVerdict = kvPairs.smoke_verdict ?? (godotExitCode === 0 ? 'PASS' : 'FAIL');
const overallPass = smokeVerdict === 'PASS' && godotExitCode === 0 && resourceWarnings.length === 0;

console.log(`\n═══ VERDICT: ${overallPass ? 'PASS' : 'FAIL'} ═══`);
if (!overallPass) {
    console.log('  Engine could not consume generated scene.');
    if (godotOutput) {
        console.log('\n  Raw Godot output:');
        for (const line of lines.slice(0, 40)) console.log(`    ${line}`);
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
**Schema:** 4.4.0

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
**Schema:** 4.4.0
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
