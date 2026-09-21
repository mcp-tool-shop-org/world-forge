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
 *   world.tscn   the join graph the client instances (zone nodes carry
 *                `metadata/zone_id`). Not a playable pawn: no CharacterBody2D,
 *                no `scripts/player.gd`, no `world_data/*.tres`. The stage
 *                project does not contain those paths.
 *   pack.json    the wire-side truth (zone ids, gates, descriptors, counts).
 *                pack.json.presentation is the drawing contract (cells, anchors,
 *                plates, who stands where), copied from the authored block; the
 *                stage prefers it over the sidecar when present. It is NOT
 *                written onto the engine-lane pack.
 *
 * A client joins wire events to scene nodes by `zone_id`. Emitting both halves
 * from ONE export is what makes that join checkable: if the two ever disagree,
 * the export produced them and the export is where the defect is.
 *
 * Usage:
 *   npx tsx dogfood/export-stage-fixture.ts --world=coverage --out=<stage-fixtures>
 *
 * Options (world names are the keys of WORLDS below — --help prints them live):
 *   --world=<name>  coverage | proof | salt-road   (default: coverage)
 *   --out=<dir>     output directory   (required)
 *   --doctor        additionally write world.doctored.tscn with ONE zone_id
 *                   altered — the RED control for the join proof. A join checker
 *                   that has only ever passed proves nothing.
 *   --strict        exit 1 before writing if any presentation advisory is in
 *                   the export warnings. Non-presentation warnings do not trip it.
 *   --engine-out=<file>
 *                   also write the ENGINE-lane pack (`export-ai-rpg`) the sidecar loads
 *                   with `--content`. Both lanes from ONE invocation, on purpose: the
 *                   client's scene and the sim's content have to describe the same world,
 *                   and generating them from separate commands is how they drift.
 *                   Accepts `--engine-out <file>` as well as `--engine-out=<file>`.
 *   --help, -h      print this contract and exit 0
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import type { WorldProject } from '@world-forge/schema';
import { presentationAdvisories, PRESENTATION_ADVISORY_PREFIX } from '@world-forge/schema';
import { exportToGodot, convertGates } from '../packages/export-godot/src/index.js';
import { exportToEngine } from '../packages/export-ai-rpg/src/index.js';
import { vocabularyCoverageProject } from '../packages/export-ai-rpg/src/__tests__/fixtures/vocabulary-coverage.js';
import { proofProject } from './worlds/multi-target-proof.js';
import { saltRoadProject } from './worlds/salt-road.js';
import { scaleForSandbox } from './worlds/sandbox-scale.js';

const WORLDS: Record<string, WorldProject> = {
    coverage: vocabularyCoverageProject,
    proof: proofProject,
    // Grown to a buildable size — 120×84 tiles at 48px rather than the authored
    // 40×28 at 32. The composition and every frozen string are untouched; only
    // geometry scales. See worlds/sandbox-scale.ts for the measured basis.
    'salt-road': scaleForSandbox(saltRoadProject),
};

const VALUE_FLAGS = new Set(['world', 'out', 'engine-out']);

function printUsage(toErr = true): void {
    const write = toErr ? console.error : console.log;
    const names = Object.keys(WORLDS).join('|');
    write(`usage: npx tsx dogfood/export-stage-fixture.ts --world=<name> --out=<dir> [--doctor] [--strict] [--engine-out=<file>]`);
    write('options:');
    write(`  --world=<name>         ${names}  (default: coverage)`);
    write('  --out=<dir>            output directory (required)');
    write('  --doctor               additionally write world.doctored.tscn with one zone_id altered');
    write('  --strict               exit 1 before writing if any presentation advisory is in the export warnings');
    write('  --engine-out=<file>    also write the engine-lane pack (accepts --engine-out <file>)');
    write('  --help, -h             print this help');
}

// ── Arguments ────────────────────────────────────────────────
// F-e430ef33 / F-aa8332da: --help used to be reported as "--out is required";
// bare `--engine-out` (no =<file>, no following path) used to skip the engine
// lane and still print `done.`. Parse both `=` and space forms; unknown flags
// and a valueless --engine-out are usage errors (exit 2).
const args = process.argv.slice(2);

interface ParsedArgs {
    help: boolean;
    doctor: boolean;
    strict: boolean;
    worldName: string;
    outDir: string | undefined;
    engineOut: string | undefined;
    engineOutMissingValue: boolean;
    unknown: string[];
}

function parseArgs(argv: string[]): ParsedArgs {
    const parsed: ParsedArgs = {
        help: false,
        doctor: false,
        strict: false,
        worldName: 'coverage',
        outDir: undefined,
        engineOut: undefined,
        engineOutMissingValue: false,
        unknown: [],
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]!;
        if (a === '--help' || a === '-h') {
            parsed.help = true;
            continue;
        }
        if (a === '--doctor') {
            parsed.doctor = true;
            continue;
        }
        if (a === '--strict') {
            parsed.strict = true;
            continue;
        }

        if (a.startsWith('--') && a.includes('=')) {
            const eq = a.indexOf('=');
            const name = a.slice(2, eq);
            const value = a.slice(eq + 1);
            if (name === 'world') {
                parsed.worldName = value;
            } else if (name === 'out') {
                parsed.outDir = value === '' ? undefined : value;
            } else if (name === 'engine-out') {
                if (value === '') parsed.engineOutMissingValue = true;
                else parsed.engineOut = value;
            } else {
                parsed.unknown.push(a);
            }
            continue;
        }

        if (a.startsWith('--')) {
            const name = a.slice(2);
            if (VALUE_FLAGS.has(name)) {
                const next = argv[i + 1];
                if (next === undefined || next.startsWith('-')) {
                    if (name === 'engine-out') parsed.engineOutMissingValue = true;
                    // --out / --world without a value fall through as missing.
                    continue;
                }
                i++;
                if (name === 'world') parsed.worldName = next;
                else if (name === 'out') parsed.outDir = next;
                else parsed.engineOut = next;
                continue;
            }
            parsed.unknown.push(a);
            continue;
        }

        parsed.unknown.push(a);
    }
    return parsed;
}

const parsed = parseArgs(args);
const worldName = parsed.worldName;
const outDir = parsed.outDir;
const writeDoctored = parsed.doctor;
const writeStrict = parsed.strict;
const engineOut = parsed.engineOut;
const engineLaneRequested = engineOut !== undefined || parsed.engineOutMissingValue;

if (parsed.help) {
    printUsage(false);
    process.exit(0);
}

if (parsed.unknown.length > 0) {
    console.error(`error: unknown flag: ${parsed.unknown.join(', ')}`);
    printUsage(true);
    process.exit(2);
}

if (parsed.engineOutMissingValue) {
    console.error('error: --engine-out requires a file path (--engine-out=<file> or --engine-out <file>)');
    printUsage(true);
    process.exit(2);
}

if (!outDir) {
    console.error('error: --out=<dir> is required');
    printUsage(true);
    process.exit(2);
}

const project = WORLDS[worldName];
if (!project) {
    console.error(`error: unknown world '${worldName}'. Known: ${Object.keys(WORLDS).join(', ')}`);
    process.exit(2);
}

// ── Export ───────────────────────────────────────────────────
console.log(`── export '${worldName}' (${project.id}) → Godot ──`);
const result = exportToGodot(project, { joinGraph: true });
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
    ...(project.presentation ? { presentation: project.presentation } : {}),
};

// ── Self-checks — a generator that emits a hole must halt, not ship it ──
// Every one of these fired for real during this script's first draft or is one
// keystroke away from firing. They exist because the artefact is consumed by a
// repo that cannot typecheck it and by a test that would happily pass on an empty
// join (two empty sets are equal).
const selfChecks: string[] = [];
let checksRun = 0;

checksRun += 1;
if (wireSide.zoneIds.length === 0) {
    selfChecks.push('zero zones — the join proof would compare two empty sets and pass');
}
checksRun += 1;
if (new Set(wireSide.zoneIds).size !== wireSide.zoneIds.length) {
    selfChecks.push('duplicate zone ids — a set-based join cannot detect a collision');
}
// The authored truth, read from the project rather than from the export, so this
// check cannot be satisfied by the same bug it is looking for.
const authoredGateCount = project.zones.filter((z) => z.entryGate).length;
checksRun += 1;
if (authoredGateCount !== Object.keys(zoneGates).length) {
    selfChecks.push(
        `gate count mismatch: the world authors ${authoredGateCount},`
        + ` the converter produced ${Object.keys(zoneGates).length}`,
    );
}
// The EMITTED count, checked against the authored truth. The check above compares two
// values that were already right; this one covers the number that actually reaches the
// artefact, which is where the surviving copy of the bug lived.
checksRun += 1;
if (wireSide.counts.gatedZones !== authoredGateCount) {
    selfChecks.push(
        `emitted gatedZones=${wireSide.counts.gatedZones} but the world authors ${authoredGateCount}`,
    );
}
// Test-only fault injection (dogfood/__tests__/dogfood-runner-exit-codes.test.ts):
// WORLD_FORGE_FORCE_FIXTURE_FAIL is never set during a normal run.
if (process.env.WORLD_FORGE_FORCE_FIXTURE_FAIL === '1') {
    checksRun += 1;
    selfChecks.push('Test-injected failure (WORLD_FORGE_FORCE_FIXTURE_FAIL) — exercises the exit-code gate');
}
// WORLD_FORGE_FORCE_PRESENTATION_ADVISORY injects a presentation advisory so
// --strict can be tested without editing Salt Road. Never set during a normal run.
if (process.env.WORLD_FORGE_FORCE_PRESENTATION_ADVISORY === '1') {
    result.warnings.push(
        `${PRESENTATION_ADVISORY_PREFIX}test-injected advisory (WORLD_FORGE_FORCE_PRESENTATION_ADVISORY)`,
    );
}
// Same class, one field over: a gate in the projection with no gate in the scene text
// would let the client believe a door is guarded that the exporter never marked.
for (const z of wireSide.zones) {
    if (z.entryGate === null) continue;
    checksRun += 1;
    if (!gateMetadataOnZoneNode(pack.worldSceneTscn, z.id, z.entryGate.mode)) {
        selfChecks.push(`zone '${z.id}' has a gate in pack.json that is not on the zone node`);
    }
}
// The pairing is the whole point: a zone in the pack whose node the scene does not
// carry is an unjoinable zone, and finding that out in Godot is finding out late.
for (const id of wireSide.zoneIds) {
    checksRun += 1;
    if (!pack.worldSceneTscn.includes(`metadata/zone_id = "${id}"`)) {
        selfChecks.push(`zone '${id}' is in the pack but carries no scene node metadata`);
    }
}
// The stage instances this file alone. A pawn or a .tres ExtResource fails
// the load before the joiner runs (missing player.gd / world_data).
checksRun += 1;
if (
    pack.worldSceneTscn.includes('res://scripts/player.gd')
    || pack.worldSceneTscn.includes('CharacterBody2D')
    || pack.worldSceneTscn.includes('res://world_data/')
) {
    selfChecks.push('stage scene still references a play pawn or a world_data resource');
}

if (project.presentation) {
    const emittedZones = new Set(wireSide.zoneIds);
    for (const actor of project.presentation.occupancy) {
        checksRun += 1;
        if (!emittedZones.has(actor.zone)) {
            selfChecks.push(`occupancy '${actor.id}' zone '${actor.zone}' is not in pack.json zoneIds`);
        }
    }
    for (const key of Object.keys(project.presentation.zoneCells)) {
        checksRun += 1;
        if (!emittedZones.has(key)) {
            selfChecks.push(`zoneCells key '${key}' is not in pack.json zoneIds`);
        }
    }
    checksRun += 1;
    if (!project.presentation.occupancy.some((row) => row.id === 'player')) {
        selfChecks.push("occupancy has no row with id === 'player'");
    }
    for (const advisory of presentationAdvisories(project)) {
        checksRun += 1;
        selfChecks.push(advisory);
    }
}

if (selfChecks.length > 0) {
    console.error(`  ✗ ${selfChecks.length} self-check failure(s) — refusing to write:`);
    for (const c of selfChecks) console.error(`    ${c}`);
    process.exit(1);
}
console.log(`  ✓ ${checksRun} self-checks passed`);

if (writeStrict) {
    const presentationWarnings = result.warnings.filter((w) =>
        w.startsWith(PRESENTATION_ADVISORY_PREFIX),
    );
    if (presentationWarnings.length > 0) {
        console.error('  ✗ strict:');
        for (const w of presentationWarnings) console.error(`    ${w}`);
        process.exit(1);
    }
}

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

/** Gate lines must sit on the zone node, before the next child header. */
function gateMetadataOnZoneNode(scene: string, zoneId: string, mode: string): boolean {
    const at = scene.indexOf(`metadata/zone_id = "${zoneId}"`);
    if (at < 0) return false;
    const next = scene.indexOf('\n[node ', at);
    const block = next < 0 ? scene.slice(at) : scene.slice(at, next);
    return block.includes(`metadata/entry_gate_mode = "${mode}"`);
}

/**
 * Top-level keys the stage's pinned engine loads (3.12.0,
 * content-schema gate.ts ALLOWED_PACK_KEYS at 97d6ef1).
 * presentation is not one of them.
 */
const ENGINE_LANE_KEYS = [
    'schemaVersion',
    'entities',
    'zones',
    'dialogues',
    'quests',
    'abilities',
    'statuses',
    'verbs',
    'archetypes',
    'backgrounds',
    'itemUseEffects',
    'districts',
    'buildCatalog',
    'progressionTrees',
    'placements',
    'encounterAnchors',
    'hazardDefinitions',
    'itemPlacements',
    'entityAi',
    'ruleset',
    'ruleProfiles',
    'meta',
    'manifest',
    'factions',
    'items',
    'factionPresences',
    'pressureHotspots',
] as const;

/**
 * The library ContentPack is wider than the engine gate. The file the sidecar
 * reads is the intersection, plus giveItem rows only: a zone stand has no
 * entityId, and the engine requires one.
 */
function projectEngineLane(pack: object): {
    projected: Record<string, unknown>;
    dropped: string[];
    itemPlacementsOmitted: number;
} {
    const raw = pack as Record<string, unknown>;
    const allowed = new Set<string>(ENGINE_LANE_KEYS);
    const dropped = Object.keys(raw).filter((k) => !allowed.has(k)).sort();
    const projected: Record<string, unknown> = {};
    let itemPlacementsOmitted = 0;
    for (const key of ENGINE_LANE_KEYS) {
        if (raw[key] === undefined) continue;
        if (key === 'itemPlacements') {
            const rows = Array.isArray(raw[key]) ? raw[key] as Array<Record<string, unknown>> : [];
            const give = rows.filter((row) =>
                row !== null && typeof row === 'object'
                && typeof row.entityId === 'string' && row.entityId.length > 0
                && typeof row.itemId === 'string' && row.itemId.length > 0,
            );
            itemPlacementsOmitted = rows.length - give.length;
            if (give.length === 0) continue;
            projected[key] = give;
            continue;
        }
        projected[key] = raw[key];
    }
    return { projected, dropped, itemPlacementsOmitted };
}

// ── The engine lane ─────────────────────────────────────────
// The same world through `export-ai-rpg`, which is what the sidecar's `--content` reads.
// Emitted here rather than by a second command because the two halves must describe one
// world; a CI step that generated them separately is exactly how a scene and a simulation
// start disagreeing about which zones exist.
let engineLaneWritten = !engineLaneRequested;
if (engineOut !== undefined) {
    const engineResult = exportToEngine(project);
    if (!engineResult.success) {
        console.error('  ✗ engine-lane export failed:');
        for (const e of engineResult.errors) console.error(`    ${e.path ?? '(root)'}: ${e.message}`);
        process.exit(1);
    }
    const enginePath = resolve(engineOut);
    mkdirSync(dirname(enginePath), { recursive: true });
    // Sidecar 3.12.0 loads this file. Its gate allowlist is narrower than
    // ContentPack, and itemPlacements means giveItem {itemId, entityId} —
    // a zone stand with no entity is SIDECAR_CONTENT_INVALID. Presentation
    // stays on the stage pack.json above and is not a ContentPack key.
    const lane = projectEngineLane(engineResult.contentPack);
    if (lane.dropped.length > 0 || lane.itemPlacementsOmitted > 0) {
        const bits: string[] = [];
        if (lane.dropped.length > 0) bits.push(`dropped ${lane.dropped.join(', ')}`);
        if (lane.itemPlacementsOmitted > 0) {
            bits.push(`omitted ${lane.itemPlacementsOmitted} itemPlacement(s) with no entityId`);
        }
        console.log(`  · engine lane projected for 3.12.0: ${bits.join('; ')}`);
    }
    writeFileSync(enginePath, `${JSON.stringify(lane.projected, null, 2)}\n`, 'utf-8');

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
    engineLaneWritten = true;
}

// F-aa8332da: never print `done.` until every requested lane has written.
if (!engineLaneWritten) {
    console.error('error: --engine-out was requested but the engine lane was not written');
    process.exit(1);
}

console.log('done.');
