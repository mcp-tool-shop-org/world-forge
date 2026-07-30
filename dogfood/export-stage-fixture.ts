/**
 * export-stage-fixture.ts — export a WorldProject into an `ai-rpg-stage` client fixture.
 *
 * The client repo is a pure Godot project with no node toolchain, so the artefacts
 * it renders are GENERATED HERE and committed there — the same shape as
 * `run-godot-smoke.ts`, which deploys a generated `world.tscn` into a checked-in
 * smoke project. This script is the lane; C4's P2 points it at Salt Road.
 *
 * Two files are written, and the pairing is the point:
 *
 *   world.tscn   the scene the client renders (zone nodes carry `metadata/zone_id`)
 *   pack.json    the wire-side truth (zone ids, gates, descriptors, counts)
 *
 * A client joins wire events to scene nodes by `zone_id`. Emitting both halves
 * from ONE export is what makes that join checkable: if the two ever disagree,
 * the export produced them and the export is where the defect is.
 *
 * Usage:
 *   npx tsx dogfood/export-stage-fixture.ts --world=coverage --out=E:/AI/ai-rpg-stage/fixtures
 *
 * Options:
 *   --world=<name>  coverage | proof   (default: coverage)
 *   --out=<dir>     output directory   (required)
 *   --doctor        additionally write world.doctored.tscn with ONE zone_id
 *                   altered — the RED control for the join proof. A join checker
 *                   that has only ever passed proves nothing.
 *   --engine-out=<file>
 *                   also write the ENGINE-lane pack (`export-ai-rpg`) the sidecar loads
 *                   with `--content`. Both lanes from ONE invocation, on purpose: the
 *                   client's scene and the sim's content have to describe the same world,
 *                   and generating them from separate commands is how they drift.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import type { WorldProject } from '@world-forge/schema';
import { exportToGodot, convertGates } from '../packages/export-godot/src/index.js';
import { exportToEngine } from '../packages/export-ai-rpg/src/index.js';
import { vocabularyCoverageProject } from '../packages/export-ai-rpg/src/__tests__/fixtures/vocabulary-coverage.js';
import { proofProject } from './worlds/multi-target-proof.js';
import { saltRoadProject } from './worlds/salt-road.js';

// ── Arguments ────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name: string): string | undefined {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
}
const worldName = flag('world') ?? 'coverage';
const outDir = flag('out');
const writeDoctored = args.includes('--doctor');
const engineOut = flag('engine-out');

if (!outDir) {
    console.error('error: --out=<dir> is required');
    console.error('usage: npx tsx dogfood/export-stage-fixture.ts --world=coverage --out=<dir> [--doctor]');
    process.exit(2);
}

const WORLDS: Record<string, WorldProject> = {
    coverage: vocabularyCoverageProject,
    proof: proofProject,
    'salt-road': saltRoadProject,
};
const project = WORLDS[worldName];
if (!project) {
    console.error(`error: unknown world '${worldName}'. Known: ${Object.keys(WORLDS).join(', ')}`);
    process.exit(2);
}

// ── Export ───────────────────────────────────────────────────
console.log(`── export '${worldName}' (${project.id}) → Godot ──`);
const result = exportToGodot(project);
if (!result.success) {
    console.error('  ✗ export failed:');
    for (const e of result.errors) console.error(`    ${e.path ?? '(root)'}: ${e.message}`);
    process.exit(1);
}

const pack = result.contentPack;

// ⚠ MEASURED, not assumed: `GodotContentPack` has NO gate channel, and
// `GodotZoneResource` has no `entryGate` field. `convertGates` computes gates and
// `exportToGodot` hands them straight to `buildWorldScene`, so the only place a
// Godot consumer can read an entry gate is scene-node metadata
// (`metadata/entry_gate*`, scene-builder.ts:176-181). This script's first draft
// read `zone.entryGate` off the pack, got `undefined` for every zone, and printed
// `gates 0` for a world that authors them — a field that does not exist looks
// exactly like a field that is empty. `dogfood/` is in no tsconfig, so nothing
// caught it. Hence: call the converter that actually produces gates, and ASSERT
// below rather than trust a count.
const zoneGates = convertGates(project).zoneGates;

// `timeOfDay` is authored on the PROJECT's zones and is not a field on
// `GodotZoneResource`, so it is read from the source rather than from the pack — the
// same class of mistake as `entryGate` above, avoided by checking instead of assuming.
const authoredTimeOfDay = new Map<string, string>();
for (const z of project.zones) {
    if (z.timeOfDay !== undefined) authoredTimeOfDay.set(z.id, z.timeOfDay);
}

console.log(
    `  ✓ zones ${pack.zones.length} · entities ${pack.entities.all.length}`
    + ` · gates ${Object.keys(zoneGates).length} · props ${pack.props.length}`,
);
for (const w of result.warnings) console.log(`  ! ${w}`);

// ── The wire-side half ───────────────────────────────────────
// Deliberately a PROJECTION, not the whole pack: the client's job is to bind to
// stable keys, so the fixture publishes exactly the keys a client may bind to and
// nothing else. A fixture that dumped everything would let the client grow a
// dependency on a field the real wire never sends.
const zoneIds = pack.zones.map((z) => z.id).sort();
const wireSide = {
    generatedBy: 'world-forge/dogfood/export-stage-fixture.ts',
    world: { id: project.id, name: project.name, version: project.version },
    packFormat: pack.meta.formatVersion ?? null,
    // Stated in the artefact so a reader of the fixture cannot mistake its purpose.
    // The charter's boundary (§3, §6.2): clients render and request; they never
    // decide. A gate is enforced by the SIM — C3 compiled the gate grammar into
    // engine rules and proved a refusal renders the authored reason. The gate text
    // here exists so the join can be CHECKED, never so the client can adjudicate.
    gatesAreInformational: true,
    zoneIds,
    zones: pack.zones
        .map((z) => ({
            id: z.id,
            // `displayName`, not `name` — `GodotZoneResource` has no `name`, so every
            // fixture emitted before this typecheck existed carried no zone names at
            // all. JSON.stringify drops an undefined value, so the key simply was not
            // there and nothing complained.
            name: z.displayName,
            neighbors: [...(z.neighbors ?? [])].sort(),
            light: z.light,
            noise: z.noise,
            districtId: z.parentDistrictId ?? null,
            elevation: z.elevation ?? null,
            // The AUTHORED half of the scene descriptor, which is what the client's
            // light rig binds to. Derived exactly as `export-ai-rpg`'s `buildScene`
            // derives it — `timeOfDay` from the field, `biome` from the first
            // `biome:`-prefixed tag — so the stage and the sim read one vocabulary
            // rather than two that agree today.
            //
            // The DERIVED half (`variantTags`: dressing:*, lighting:dim, props:*) is
            // deliberately absent: the sim computes those from a zone's condition at
            // runtime, and baking them into a fixture would let the stage render a
            // state nothing had decided.
            timeOfDay: authoredTimeOfDay.get(z.id) ?? null,
            biome: z.tags.find((t) => t.startsWith('biome:'))?.slice('biome:'.length) ?? null,
            // Informational ONLY. The client must never enforce a gate from this;
            // it submits the move and renders the sim's refusal. See the note in
            // `wireSide.gatesAreInformational` below.
            entryGate: zoneGates[z.id]
                ? {
                    conditions: zoneGates[z.id].conditions,
                    mode: zoneGates[z.id].mode,
                    reason: zoneGates[z.id].reason ?? null,
                }
                : null,
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    counts: {
        zones: pack.zones.length,
        districts: pack.districts.length,
        entities: pack.entities.all.length,
        props: pack.props.length,
        hazards: pack.hazards.length,
        // ⚠ `zoneGates`, NOT `pack.zones.filter(z => z.entryGate)`. This line had the
        // same nonexistent-field bug as the log line above and survived the first fix
        // — one site repaired, its sibling missed, and the emitted count read 0 for a
        // world with a gate. The self-check below now covers the EMITTED value, so
        // fixing one site and not the other cannot pass again.
        gatedZones: Object.keys(zoneGates).length,
        strata: pack.strata.length,
        tileLayers: pack.tileLayers.length,
    },
};

// ── Self-checks — a generator that emits a hole must halt, not ship it ──
// Every one of these fired for real during this script's first draft or is one
// keystroke away from firing. They exist because the artefact is consumed by a
// repo that cannot typecheck it and by a test that would happily pass on an empty
// join (two empty sets are equal).
const selfChecks: string[] = [];

if (wireSide.zoneIds.length === 0) {
    selfChecks.push('zero zones — the join proof would compare two empty sets and pass');
}
if (new Set(wireSide.zoneIds).size !== wireSide.zoneIds.length) {
    selfChecks.push('duplicate zone ids — a set-based join cannot detect a collision');
}
// The authored truth, read from the project rather than from the export, so this
// check cannot be satisfied by the same bug it is looking for.
const authoredGateCount = project.zones.filter((z) => z.entryGate).length;
if (authoredGateCount !== Object.keys(zoneGates).length) {
    selfChecks.push(
        `gate count mismatch: the world authors ${authoredGateCount},`
        + ` the converter produced ${Object.keys(zoneGates).length}`,
    );
}
// The EMITTED count, checked against the authored truth. The check above compares two
// values that were already right; this one covers the number that actually reaches the
// artefact, which is where the surviving copy of the bug lived.
if (wireSide.counts.gatedZones !== authoredGateCount) {
    selfChecks.push(
        `emitted gatedZones=${wireSide.counts.gatedZones} but the world authors ${authoredGateCount}`,
    );
}
// Same class, one field over: a gate in the projection with no gate in the scene text
// would let the client believe a door is guarded that the exporter never marked.
for (const z of wireSide.zones) {
    if (z.entryGate === null) continue;
    if (!pack.worldSceneTscn.includes(`metadata/entry_gate_mode = "${z.entryGate.mode}"`)) {
        selfChecks.push(`zone '${z.id}' has a gate in pack.json with no entry_gate metadata in the scene`);
    }
}
// The pairing is the whole point: a zone in the pack whose node the scene does not
// carry is an unjoinable zone, and finding that out in Godot is finding out late.
for (const id of wireSide.zoneIds) {
    if (!pack.worldSceneTscn.includes(`metadata/zone_id = "${id}"`)) {
        selfChecks.push(`zone '${id}' is in the pack but carries no scene node metadata`);
    }
}

if (selfChecks.length > 0) {
    console.error(`  ✗ ${selfChecks.length} self-check failure(s) — refusing to write:`);
    for (const c of selfChecks) console.error(`    ${c}`);
    process.exit(1);
}
console.log(`  ✓ ${4 + wireSide.zoneIds.length} self-checks passed`);

// ── Write ────────────────────────────────────────────────────
const dir = resolve(outDir);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const scenePath = resolve(dir, 'world.tscn');
writeFileSync(scenePath, pack.worldSceneTscn, 'utf-8');
console.log(`  → ${scenePath}`);

const packPath = resolve(dir, 'pack.json');
writeFileSync(packPath, `${JSON.stringify(wireSide, null, 2)}\n`, 'utf-8');
console.log(`  → ${packPath}`);

// ── The RED control ──────────────────────────────────────────
if (writeDoctored) {
    // Alter exactly one zone_id so the scene and the pack disagree in exactly one
    // place. Any weaker doctoring (a removed node, a corrupted file) would fail
    // for reasons unrelated to the join, and would not prove the join is checked.
    const victim = zoneIds[0];
    const needle = `metadata/zone_id = "${victim}"`;
    if (!pack.worldSceneTscn.includes(needle)) {
        console.error(`  ✗ cannot doctor: '${needle}' not found in the scene text`);
        process.exit(1);
    }
    const doctored = pack.worldSceneTscn.replace(needle, `metadata/zone_id = "${victim}-DOCTORED"`);
    if (doctored === pack.worldSceneTscn) {
        console.error('  ✗ doctoring produced an identical file — the control would be vacuous');
        process.exit(1);
    }
    const doctoredPath = resolve(dir, 'world.doctored.tscn');
    writeFileSync(doctoredPath, doctored, 'utf-8');
    console.log(`  → ${doctoredPath}  (zone '${victim}' → '${victim}-DOCTORED')`);
}

// ── The engine lane ─────────────────────────────────────────
// The same world through `export-ai-rpg`, which is what the sidecar's `--content` reads.
// Emitted here rather than by a second command because the two halves must describe one
// world; a CI step that generated them separately is exactly how a scene and a simulation
// start disagreeing about which zones exist.
if (engineOut !== undefined) {
    const engineResult = exportToEngine(project);
    if (!engineResult.success) {
        console.error('  ✗ engine-lane export failed:');
        for (const e of engineResult.errors) console.error(`    ${e.path ?? '(root)'}: ${e.message}`);
        process.exit(1);
    }
    const enginePath = resolve(engineOut);
    mkdirSync(dirname(enginePath), { recursive: true });
    writeFileSync(enginePath, `${JSON.stringify(engineResult.contentPack, null, 2)}
`, 'utf-8');

    // The two lanes must agree on the zone set. Checked rather than trusted: the client
    // joins events to nodes by zone id, so a disagreement here is a silent hole later.
    const engineZoneIds = (engineResult.contentPack.zones ?? []).map((z) => z.id).sort();
    const mismatch = JSON.stringify(engineZoneIds) !== JSON.stringify(zoneIds);
    if (mismatch) {
        console.error('  ✗ the two lanes disagree about which zones exist:');
        console.error(`    godot : ${zoneIds.join(', ')}`);
        console.error(`    engine: ${engineZoneIds.join(', ')}`);
        process.exit(1);
    }
    console.log(`  → ${enginePath}  (engine lane, ${engineZoneIds.length} zones, agrees with the scene)`);
}

console.log('done.');
