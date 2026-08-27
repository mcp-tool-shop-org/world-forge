/**
 * run-ai-rpg-smoke.ts — AI RPG Engine Runtime Smoke Test
 *
 * Proves: exported ContentPack is consumable by the AI RPG Engine runtime,
 * not merely round-trippable by World Forge's own importer.
 *
 * Pipeline:
 *   1. Export proof world → ContentPack + Manifest + PackMeta
 *   2. Engine schema validation (loadContent from @ai-rpg-engine/content-schema)
 *   3. Cross-reference validation (validateRefs)
 *   4. Pack registration (registerPack from @ai-rpg-engine/pack-registry) +
 *      createGame() actually invoked, not just registered
 *   5. Engine boot (createTestEngine from @ai-rpg-engine/core), loaded with a
 *      real module (traversalCore from @ai-rpg-engine/modules) — not
 *      `modules: []`, so there is a real verb surface to exercise
 *   6. Player spawns in start zone
 *   7. Zone traversal (store-level move to neighbor, and back)
 *   8. Engine tick advances; the 'move' verb is submitted through the
 *      engine's own dispatcher (submitAction), not the store bypass Step 7
 *      uses, and the resulting event is checked
 *   9. Serialize/deserialize (state persistence)
 *
 * Usage:
 *   npx tsx dogfood/run-ai-rpg-smoke.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { exportToEngine, type ExportResult } from '../packages/export-ai-rpg/src/index.js';
import { SCHEMA_VERSION } from '../packages/schema/src/index.js';
import { proofProject } from './worlds/multi-target-proof.js';

// Engine runtime TYPES — safe to import statically (types are erased, so
// this carries no runtime dependency on @ai-rpg-engine being resolvable at
// import time; only the dynamic `import()` calls in loadEngineModules below
// need that, and only once main() actually runs).
import type { ContentPack, LoadResult, RefsResult } from '@ai-rpg-engine/content-schema';
import type { PackEntry } from '@ai-rpg-engine/pack-registry';
import type { Engine, EngineModule, HarnessOptions, RulesetDefinition, TestEngine } from '@ai-rpg-engine/core';

// Engine runtime VALUES — these are NOT World Forge code.
// These packages are ESM-only with exports["."]={"import": ...} — no CJS entry.
// We resolve them via a dynamic import inside an async main to avoid
// top-level await (tsx CJS mode doesn't support it).
//
// These are ordinary bare-specifier imports (`@ai-rpg-engine/...`), resolved
// by Node's normal package resolution — same as every other `@ai-rpg-engine/*`
// import in this repo (e.g. packages/export-ai-rpg/src/*.ts). This file used
// to hardcode a RELATIVE path straight into node_modules
// (`'../node_modules/@ai-rpg-engine/content-schema/dist/index.js'`), which
// only resolves when a `node_modules/@ai-rpg-engine` happens to exist exactly
// one directory above this file — brittle across worktrees/checkouts, and
// unlike a bare specifier, not something tsc's module resolution can follow
// either (it doesn't walk parent directories for an explicit relative path
// the way Node's runtime resolver does for bare specifiers), which is why
// this file could never join tsconfig.dogfood.json's typechecked set before
// (F-007) — and why the `new Engine(...)` bug at old Step 4 (should have been
// `new EngineClass(...)`, F-009) went unnoticed: the
// whole file was `unknown`-typed end to end, so a typo'd identifier and a
// real one were equally invisible to tsc.
let loadContent: (pack: ContentPack) => LoadResult;
let validateRefs: (pack: ContentPack) => RefsResult;
let registerPack: (entry: PackEntry) => void;
let getPack: (id: string) => PackEntry | undefined;
let clearRegistry: () => void;
let createTestEngine: (options: HarnessOptions) => TestEngine;
let EngineClass: typeof Engine;
// traversalCore is a real, ready-made EngineModule (move/inspect verbs) from
// @ai-rpg-engine/modules — loaded so this smoke test boots the engine with
// actual content instead of `modules: []`. See the note at Step 5 below.
let traversalCore: EngineModule;

async function loadEngineModules() {
    const cs = await import('@ai-rpg-engine/content-schema');
    loadContent = cs.loadContent;
    validateRefs = cs.validateRefs;

    const pr = await import('@ai-rpg-engine/pack-registry');
    registerPack = pr.registerPack;
    getPack = pr.getPack;
    clearRegistry = pr.clearRegistry;

    const ec = await import('@ai-rpg-engine/core');
    createTestEngine = ec.createTestEngine;
    EngineClass = ec.Engine;

    const mods = await import('@ai-rpg-engine/modules');
    traversalCore = mods.traversalCore;
}

const __dirname = typeof import.meta.dirname === 'string'
    ? import.meta.dirname
    : dirname(fileURLToPath(import.meta.url));

const outDir = resolve(__dirname, 'output', 'ai-rpg-smoke');

// ── Tracking ─────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results: { label: string; ok: boolean; detail?: string }[] = [];

function assert(condition: boolean, label: string, detail?: string): void {
    if (condition) {
        passed++;
        results.push({ label, ok: true });
        console.log(`    ✓ ${label}`);
    } else {
        failed++;
        results.push({ label, ok: false, detail });
        console.log(`    ✗ ${label}${detail ? ': ' + detail : ''}`);
    }
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
    await loadEngineModules();

    console.log('═══ AI RPG ENGINE RUNTIME SMOKE ═══\n');

    // Step 1: Export
    console.log('── 1. Export proof world ──');
    // WORLD_FORGE_FORCE_AI_RPG_EXPORT_FAIL is never set during a normal run.
    const exportResult = process.env.WORLD_FORGE_FORCE_AI_RPG_EXPORT_FAIL === '1'
        ? {
            success: false as const,
            errors: [{ path: 'forced-export-fail', message: 'WORLD_FORGE_FORCE_AI_RPG_EXPORT_FAIL' }],
        }
        : exportToEngine(proofProject);
    if (!exportResult.success) {
        console.error('  ✗ Export failed:');
        for (const e of exportResult.errors) console.error(`    ${e.path ?? '(root)'}: ${e.message}`);
        process.exit(1);
    }
    const result = exportResult as ExportResult;
    console.log(`  ✓ Export succeeded`);
    console.log(`    Zones: ${result.contentPack.zones.length}`);
    console.log(`    Entities: ${result.contentPack.entities.length}`);
    console.log(`    Dialogues: ${result.contentPack.dialogues.length}`);
    console.log(`    Items: ${result.contentPack.items.length}`);

    // Step 2: Engine schema validation (engine's own validator, not WF's)
    console.log('\n── 2. Engine content-schema validation ──');
    const enginePack = {
        entities: result.contentPack.entities,
        zones: result.contentPack.zones,
        dialogues: result.contentPack.dialogues,
    };
    const loadResult = loadContent(enginePack);
    assert(loadResult.ok, 'loadContent_ok', loadResult.ok ? undefined : loadResult.summary);
    console.log(`    Summary: ${loadResult.summary}`);
    if (!loadResult.ok) {
        for (const err of loadResult.errors.slice(0, 10)) {
            console.log(`      - ${err.path}: ${err.message}`);
        }
    }

    // Step 3: Cross-reference validation
    console.log('\n── 3. Cross-reference validation ──');
    const refResult = validateRefs(enginePack);
    assert(refResult.ok, 'validateRefs_ok',
        refResult.ok ? undefined : `${refResult.errors.length} ref errors`);
    if (!refResult.ok) {
        for (const err of refResult.errors.slice(0, 5)) {
            console.log(`      - ${err.path}: ${err.message}`);
        }
    }

    // Step 4: Pack registration
    console.log('\n── 4. Pack registry ──');
    clearRegistry();
    // `result.packMeta` is already typed `PackMetadata` (packages/export-ai-rpg
    // imports the SAME @ai-rpg-engine/pack-registry type) — no cast needed now
    // that `registerPack` carries its real signature instead of `unknown`.
    // Previously this went through `as unknown as Parameters<typeof
    // registerPack>[0]['meta']`, a double-cast escape hatch that only existed
    // because `registerPack` itself was typed `(entry: unknown) => void`.
    //
    // `ruleset` was previously `{ id, name, version, modules: ... }` — missing
    // every field RulesetDefinition actually requires (stats, resources,
    // verbs, formulas, defaultModules, progressionModels) and using a
    // `modules` key that doesn't exist on the type at all (the real field is
    // `defaultModules`). It worked at runtime because nothing here reads the
    // missing fields, but tsc could never have told you that — the whole file
    // was `unknown`-typed. Filled in with the complete, valid shape.
    const ruleset: RulesetDefinition = {
        id: 'standard-v1',
        name: 'Standard',
        version: '1.0.0',
        stats: [],
        resources: [],
        verbs: [],
        formulas: [],
        defaultModules: result.manifest.modules,
        progressionModels: [],
    };
    const packEntry: PackEntry = {
        meta: result.packMeta,
        manifest: result.manifest,
        ruleset,
        createGame: (seed?: number) => new EngineClass({
            manifest: result.manifest,
            seed: seed ?? 42,
            modules: [traversalCore],
            ruleset,
        }),
    };
    let registrationOk = true;
    try {
        registerPack(packEntry);
    } catch (err) {
        registrationOk = false;
        assert(false, 'registerPack_succeeds', String(err));
    }
    if (registrationOk) {
        assert(true, 'registerPack_succeeds');
        const retrieved = getPack(proofProject.id);
        assert(retrieved !== undefined, 'getPack_retrieves_by_id');
        assert(retrieved?.meta.name === proofProject.name, 'pack_name_matches');

        // F-009 regression guard: `createGame` used to read the undefined
        // global `Engine` instead of the locally-loaded `EngineClass` — a
        // ReferenceError waiting to happen, but the closure was registered
        // and never invoked anywhere in this file, so it could never surface
        // as a failure. Call it for real.
        if (retrieved) {
            try {
                const game = retrieved.createGame(7);
                assert(game instanceof EngineClass, 'createGame_boots_engine',
                    `expected an Engine instance, got ${typeof game}`);
            } catch (err) {
                assert(false, 'createGame_boots_engine', String(err));
            }
        }
    }

    // Step 5: Engine boot with exported content
    console.log('\n── 5. Engine boot ──');
    const startZone = result.contentPack.zones[0];
    const zones = result.contentPack.zones.map(z => ({
        id: z.id,
        roomId: z.id,
        name: z.name,
        tags: z.tags ?? [],
        neighbors: z.neighbors ?? [],
        light: z.light,
        noise: z.noise,
        hazards: z.hazards,
        interactables: z.interactables,
    }));
    const entities = result.contentPack.entities.map(e => ({
        id: e.id,
        blueprintId: e.id,
        type: e.type,
        name: e.name,
        tags: e.tags ?? [],
        stats: e.baseStats ?? {},
        resources: e.baseResources ?? {},
        statuses: [],
        inventory: e.inventory ?? [],
        zoneId: startZone.id,
    }));

    // `modules: [traversalCore]` — this used to be `modules: []`, which meant
    // getAvailableActions() below always returned an empty list and no verb
    // could ever be submitted, REGARDLESS of whether the exported content was
    // correct or broken: a runtime smoke that boots with zero verbs cannot go
    // red on a content regression, because there is nothing registered for it
    // to reject. traversalCore (move/inspect) needs nothing beyond the
    // zones/entities shape this file already builds, so it's a genuine,
    // no-new-authoring way to exercise a real verb end-to-end (see Step 8).
    let engine: TestEngine;
    try {
        engine = createTestEngine({
            modules: [traversalCore],
            zones,
            entities,
            playerId: 'player-1',
            startZone: startZone.id,
            seed: 42,
        });
        assert(true, 'engine_boots');
    } catch (err) {
        assert(false, 'engine_boots', String(err));
        writeReceipt();
        process.exit(1);
    }

    // Step 6: Player location
    console.log('\n── 6. Player spawn ──');
    assert(engine.world.locationId === startZone.id, 'player_in_start_zone',
        `expected "${startZone.id}", got "${engine.world.locationId}"`);
    assert(engine.currentZone().id === startZone.id, 'currentZone_matches');

    // Step 7: Zone traversal
    console.log('\n── 7. Zone traversal ──');
    const neighborId = zones[0].neighbors[0];
    if (neighborId) {
        engine.store.setPlayerLocation(neighborId);
        assert(engine.world.locationId === neighborId, 'player_moved_to_neighbor',
            `now in "${engine.world.locationId}"`);
        // Move back
        engine.store.setPlayerLocation(startZone.id);
        assert(engine.world.locationId === startZone.id, 'player_returned_to_start');
    } else {
        assert(false, 'has_neighbor_zone', 'start zone has no neighbors');
    }

    // Step 8: Engine tick / action
    console.log('\n── 8. Engine tick ──');
    const tickBefore = engine.tick;
    engine.store.advanceTick();
    assert(engine.tick === tickBefore + 1, 'tick_advances');

    // Previously this only checked getAvailableActions() didn't throw, with
    // `modules: []` guaranteeing an empty list either way ("no modules
    // loaded" — the smoke test could never go red on a content regression
    // here, because nothing was ever registered to reject). traversalCore is
    // now loaded (Step 5), so this checks something real: the verb is
    // actually registered, AND submitting it through the engine's own
    // dispatcher (not the store.setPlayerLocation bypass Step 7 uses)
    // produces the expected world.zone.entered event.
    try {
        const available = engine.getAvailableActions();
        console.log(`    Available actions: ${available.length > 0 ? available.join(', ') : '(none)'}`);
        assert(available.includes('move'), 'traversal_verb_registered',
            `expected "move" among registered verbs, got: ${available.join(', ') || '(none)'}`);
    } catch (err) {
        assert(false, 'traversal_verb_registered', String(err));
    }

    // Submit as one of the ACTUAL exported entities (not a synthetic player —
    // no player entity was ever added to `entities`; `playerId: 'player-1'`
    // above only seeds World­State.playerId/locationId, which Step 6/7 read
    // directly, so a bare `submitAction('move', ...)` would hit the engine's
    // ghost-actor guard and silently return no events). Using a real exported
    // entity is also more on-point for what this file claims to prove:
    // exported CONTENT is consumable, not a hand-built player rig.
    const actor = entities[0];
    if (neighborId && actor) {
        try {
            const events = engine.submitActionAs(actor.id, 'move', { targetIds: [neighborId] });
            const entered = events.some((e) => e.type === 'world.zone.entered');
            assert(entered, 'move_action_succeeds',
                entered ? undefined : `events: ${events.map((e) => e.type).join(', ') || '(none)'}`);
            assert(engine.entity(actor.id).zoneId === neighborId, 'move_action_updates_location',
                `now in "${engine.entity(actor.id).zoneId}"`);
        } catch (err) {
            assert(false, 'move_action_succeeds', String(err));
        }
    } else {
        assert(false, 'move_action_succeeds', neighborId ? 'no exported entity to act as' : 'no neighbor to move to');
    }

    // Step 9: Serialize/Deserialize
    console.log('\n── 9. State persistence ──');
    let serialized: string;
    try {
        serialized = engine.serialize();
        assert(typeof serialized === 'string' && serialized.length > 0, 'serialize_produces_state');
        const parsed = JSON.parse(serialized);
        // Engine serializes as {world, actionLog} — world contains the runtime state
        const stateKeys = Object.keys(parsed);
        console.log(`    State keys: ${stateKeys.join(', ')}`);
        // The world property should exist and contain meaningful state
        assert(parsed.world != null && typeof parsed.world === 'object', 'serialized_state_has_world');
        // Serialized state should round-trip (non-trivial content)
        assert(stateKeys.length >= 2, 'serialized_state_non_trivial',
            `keys=${stateKeys.length}`);
    } catch (err) {
        assert(false, 'serialize_produces_state', String(err));
    }

    if (process.env.WORLD_FORGE_FORCE_AI_RPG_FAIL === '1') {
        assert(false, 'test_injected_failure', 'WORLD_FORGE_FORCE_AI_RPG_FAIL');
    }

    // ── Verdict ──────────────────────────────────────────────────
    console.log(`\n═══ VERDICT: ${failed === 0 ? 'PASS' : 'FAIL'} ═══`);
    console.log(`  Assertions: ${passed}/${passed + failed} passed`);

    writeReceipt();
    process.exit(failed === 0 ? 0 : 1);

    // ── Receipt (inside main — accesses `result`) ────────────────
    function writeReceipt(): void {
        mkdirSync(outDir, { recursive: true });
        const ts = new Date().toISOString();
        const verdict = failed === 0 ? 'PASS' : 'FAIL';

        const receipt = `# AI RPG Engine Runtime Smoke — ${verdict}

**Date:** ${ts}
**Proof world:** Dustwalk — Multi-Target Proof (proof-dustwalk)
**Schema:** ${SCHEMA_VERSION}
**Engine packages:**
- @ai-rpg-engine/content-schema
- @ai-rpg-engine/core
- @ai-rpg-engine/pack-registry
- @ai-rpg-engine/modules (traversalCore — real move/inspect verbs, not an empty module list)

## Pipeline

1. World Forge export → ContentPack
2. Engine content-schema loadContent() validation
3. Cross-reference validation (validateRefs)
4. Pack registration (registerPack + getPack) + createGame() actually invoked
5. Engine boot (createTestEngine) with traversalCore loaded
6. Player spawn in start zone
7. Zone traversal (store-level move + return)
8. Engine tick advance + 'move' verb submitted through the engine dispatcher
9. Serialize/deserialize state

## Assertions (${passed} passed, ${failed} failed)

${results.map(r => `- ${r.ok ? '✓' : '✗'} ${r.label}${r.detail ? ': ' + r.detail : ''}`).join('\n')}

## Content Counts

| Metric | Value |
|--------|-------|
| Zones | ${result.contentPack.zones.length} |
| Entities | ${result.contentPack.entities.length} |
| Dialogues | ${result.contentPack.dialogues.length} |
| Items | ${result.contentPack.items.length} |
| Districts | ${result.contentPack.districts.length} |

## Verdict

**${verdict}**

${verdict === 'PASS'
                ? 'Exported ContentPack is consumable by the AI RPG Engine runtime. Engine boots, zones load, entities hydrate, player moves, tick advances, state serializes.'
                : 'Engine could not fully consume the exported ContentPack. See failures above.'}
`;

        const receiptPath = resolve(outDir, `DOGFOOD_AI_RPG_RUNTIME_SMOKE_${ts.slice(0, 10)}.md`);
        writeFileSync(receiptPath, receipt, 'utf-8');
        console.log(`\nReceipt: ${receiptPath}`);
    }

} // end main

main().catch((err) => { console.error(err); process.exit(1); });
